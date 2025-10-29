import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

let camera, scene, renderer;
let orbit, pointerLock;
let mode = 'third'; // "first" or "third"

init();
animate();

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 15);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7.5);
  scene.add(dir);

  // Load auditorium model
  const loader = new GLTFLoader();
  loader.load(
    '/auditorium.glb',
    (gltf) => {
      scene.add(gltf.scene);
      console.log('Model loaded:', gltf);
    },
    undefined,
    (error) => console.error('Error loading GLB:', error)
  );

  // Grid (optional for orientation)
  const grid = new THREE.GridHelper(200, 100);
  scene.add(grid);

  // Controls
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 2, 0);
  orbit.update();

  pointerLock = new PointerLockControls(camera, document.body);
  document.addEventListener('click', () => {
    if (mode === 'first') pointerLock.lock();
  });

  // Resize
  window.addEventListener('resize', onWindowResize);

  // Keyboard handling
  setupMovement();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Simple WASD movement
const move = { forward: false, back: false, left: false, right: false };

function setupMovement() {
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': move.forward = true; break;
      case 'KeyS': move.back = true; break;
      case 'KeyA': move.left = true; break;
      case 'KeyD': move.right = true; break;
      case 'KeyV': toggleView(); break;
    }
  });
  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': move.forward = false; break;
      case 'KeyS': move.back = false; break;
      case 'KeyA': move.left = false; break;
      case 'KeyD': move.right = false; break;
    }
  });
}

function toggleView() {
  if (mode === 'third') {
    orbit.enabled = false;
    mode = 'first';
    pointerLock.lock();
  } else {
    mode = 'third';
    if (pointerLock.isLocked) pointerLock.unlock();
    orbit.enabled = true;
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  if (mode === 'first' && pointerLock.isLocked) {
    const speed = 0.15;
    if (move.forward) pointerLock.moveForward(speed);
    if (move.back) pointerLock.moveForward(-speed);
    if (move.left) pointerLock.moveRight(-speed);
    if (move.right) pointerLock.moveRight(speed);
  } else if (mode === 'third') {
    orbit.update();
  }

  renderer.render(scene, camera);
}
