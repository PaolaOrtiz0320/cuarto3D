import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let scene, camera, renderer, controls;
let model;
const clock = new THREE.Clock();

init();
animate();

function init() {
    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    // Cámara (origen = posición del visor)
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.6, 0); // altura de ojos

    // Renderer + WebXR
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // WebXR
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor'); // y=0 es el piso

    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Botón VR
    const vrButton = VRButton.createButton(renderer);
    document.body.appendChild(vrButton);

    // Controles (solo desktop)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.6, -3);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI * 0.95;
    controls.update();

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Suelo extra (por si el modelo no trae)
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('models/Field_Square_Tile.jpg');

    const groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        roughness: 0.8,
        metalness: 0.2
    });

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Cargar modelo FBX
    const loader = new FBXLoader();
    const loadingElement = document.getElementById('loading');

    loader.load(
        'models/cuarto.fbx',
        (fbx) => {
            model = fbx;

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) child.material.needsUpdate = true;
                }
            });

            // Caja del modelo para escalar/centrar
            let box = new THREE.Box3().setFromObject(model);
            let size = box.getSize(new THREE.Vector3());
            let center = box.getCenter(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 10 / maxDim; // ajusta si queda muy grande / pequeño
            model.scale.multiplyScalar(scale);

            // Recalcular después del escalado
            box = new THREE.Box3().setFromObject(model);
            size = box.getSize(new THREE.Vector3());
            center = box.getCenter(new THREE.Vector3());

            // --- Posicionar el cuarto alrededor del visor ---
            // Queremos que el visor (0,0,0) quede en una zona libre, NO en la cama
            const roomOffsetZ = 2.0;  // mueve todo el cuarto hacia atrás/adelante
            const roomOffsetX = 0.0;  // si quieres moverte hacia un lado, cambia esto

            model.position.set(
                -center.x + roomOffsetX,
                -box.min.y,                // piso en y = 0
                -center.z - roomOffsetZ    // juega con el signo / valor
            );
            // -------------------------------------------------

            scene.add(model);

            // Para modo desktop: que mire al centro del cuarto
            controls.target.set(0, 1.5, 0);
            controls.update();

            loadingElement.style.display = 'none';
            console.log('Modelo cargado exitosamente');
        },
        (xhr) => {
            const percent = xhr.total ? (xhr.loaded / xhr.total) * 100 : 0;
            loadingElement.textContent = `Cargando modelo: ${Math.round(percent)}%`;
        },
        (error) => {
            console.error('Error al cargar el modelo:', error);
            loadingElement.textContent = 'Error al cargar el modelo. Verifica la consola.';
            loadingElement.style.color = 'red';
        }
    );

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    const delta = clock.getDelta();

    // En desktop actualizamos OrbitControls;
    // en VR la orientación la manda el visor.
    if (!renderer.xr.isPresenting) {
        controls.update();
    }

    if (model && model.mixer) {
        model.mixer.update(delta);
    }

    renderer.render(scene, camera);
}
