// main.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/* ----------------------------------------------------------------
   Globals
-------------------------------------------------------------------*/

let scene, camera, renderer, clock;
let player;
let colliderModel = null;   // base_auditorium.glb
let renderModel  = null;    // final_auditorium.glb
const colliders = [];       // all meshes used for collision
window.colliderModel = colliderModel; // for debugging
window.renderModel  = renderModel;  // for debugging
let mode = "third";         // "first" or "third"

const input = { forward:false, back:false, left:false, right:false };

let yaw = 0;
let pitch = 0;

// Player constants
const PLAYER_HEIGHT = 1.0;
const PLAYER_RADIUS = 0.25;
const MOVE_SPEED    = 4.0;

// Step / jump behaviour
const MAX_STEP_HEIGHT  = 0.35;   // normal "walk up" height
const MAX_JUMP_HEIGHT  = 0.8;    // max height when pressing space
const MAX_DROP_HEIGHT  = 1.2;    // don't fall down more than this
const JUMP_WINDOW_TIME = 0.25;   // seconds where jump is "active"

let jumpTimer = 0;               // > 0 means we are in jump window

// Camera distance for 3rd person
let cameraDistance = 6;
const CAMERA_DIST_MIN = 2.5;
const CAMERA_DIST_MAX = 10;

// Reusable raycaster
const raycaster = new THREE.Raycaster();

// HUD
const hud = document.getElementById("hud");

// Spawn point guess (close to what you had)
const SPAWN_POS = new THREE.Vector3(-10.0, 3.0, 6.725);

/* ----------------------------------------------------------------
   Init
-------------------------------------------------------------------*/

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
  hemi.position.set(0, 100, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(40, 80, 40);
  dir.castShadow = true;
  scene.add(dir);

  // Player: blue box
  const geo = new THREE.BoxGeometry(PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3399ff });
  player = new THREE.Mesh(geo, mat);
  player.castShadow = true;
  scene.add(player);

  // Load models
  const loader = new GLTFLoader();

  // --- Collision model ---
  // --- Collision model ---
  loader.load("./base_auditorium.glb", gltf => {
      colliderModel = gltf.scene;

      colliderModel.traverse(obj => {
        if (obj.isMesh) {
          // FIX: Use DoubleSide so rays hit the floor even if normals are flipped
          // FIX: Use Wireframe so you can verify the physics model aligns with visuals
          obj.material = new THREE.MeshBasicMaterial({
             color: 0xff0000,
             wireframe: true, 
             side: THREE.DoubleSide 
          });
          
          // If you want it invisible later, set this to false. 
          // For now, keep it true to debug.
          obj.visible = false; 
          
          colliders.push(obj);
        }
      });

      scene.add(colliderModel);
      console.log("Collision model loaded.");
      tryPlacePlayer();
    },
    // ... error handler
  );

  // --- Render model ---
  loader.load(
    "./final_auditorium.glb",
    gltf => {
      renderModel = gltf.scene;

      renderModel.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      scene.add(renderModel);
      console.log("Render model loaded.");
      tryPlacePlayer();
    },
    undefined,
    err => console.error("Error loading final_auditorium.glb:", err)
  );

  // Events
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("wheel", onWheel, { passive: true });
  
  document.body.addEventListener("click", () => {
    if (mode === "first") {
        document.body.requestPointerLock();
    }
});
  updateHUD();
}

/* ----------------------------------------------------------------
   Spawn player once both models are loaded
-------------------------------------------------------------------*/

function tryPlacePlayer() {
  if (!colliderModel || !renderModel) return; // wait for both

  // raycast from spawn pos downward onto colliders
  raycaster.set(SPAWN_POS, new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObjects(colliders, true);

  if (hits.length > 0) {
    const floorY = hits[0].point.y;
    player.position.set(SPAWN_POS.x, floorY + PLAYER_HEIGHT * 0.5, SPAWN_POS.z);

    // Initialize camera behind player
    camera.position.set(
      player.position.x - 2,
      player.position.y + 2,
      player.position.z - 4
    );
    camera.lookAt(player.position);

    console.log("Spawned player at:", player.position);
  } else {
    console.warn("Could not find floor at spawn location; using default (0,0,0).");
    player.position.set(0, PLAYER_HEIGHT * 0.5, 0);
  }
}

/* ----------------------------------------------------------------
   Input / HUD
-------------------------------------------------------------------*/

function updateHUD() {
  hud.innerHTML = `
    <b>View:</b> ${mode === "first" ? "First Person" : "Third Person"}<br/>
    WASD = move, Mouse = look (hold LMB in 3rd), Scroll = zoom (3rd),<br/>
    Space = climb stairs / step up, V = toggle view
  `;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
  switch (e.code) {
    case "KeyW": input.forward = true; break;
    case "KeyS": input.back    = true; break;
    case "KeyA": input.left    = true; break;
    case "KeyD": input.right   = true; break;

    case "Space":
      // start jump window: allows stepping up higher ledges
      jumpTimer = JUMP_WINDOW_TIME;
      break;

    case "KeyV":
      mode = (mode === "third") ? "first" : "third";
      player.visible = (mode === "third");
      updateHUD();
      break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case "KeyW": input.forward = false; break;
    case "KeyS": input.back    = false; break;
    case "KeyA": input.left    = false; break;
    case "KeyD": input.right   = false; break;
  }
}

function onMouseMove(e) {
    // Only rotate if we are in First Person AND the pointer is locked
    if (mode === "first") {
        if (document.pointerLockElement === document.body) {
            const sensitivity = 0.002;
            // movementX gives infinite delta values even if mouse is "stuck"
            yaw -= e.movementX * sensitivity;
            pitch -= e.movementY * sensitivity;
        }
    } 
    // Keep Third Person logic separate (Hold Left Mouse Button)
    else if (mode === "third" && (e.buttons & 1) === 1) {
        const sensitivity = 0.0025;
        yaw -= e.movementX * sensitivity;
        pitch -= e.movementY * sensitivity;
    }

    // Clamp pitch so you don't break your neck
    const maxPitch = Math.PI / 2 - 0.1;
    pitch = THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch);
}

function onWheel(e) {
  if (mode !== "third") return;
  cameraDistance += e.deltaY * 0.01;
  cameraDistance = THREE.MathUtils.clamp(cameraDistance, CAMERA_DIST_MIN, CAMERA_DIST_MAX);
}

/* ----------------------------------------------------------------
   Floor / collision helpers
-------------------------------------------------------------------*/

// Return floor Y under given position (x,z). null if nothing found.
function getFloorHeightAt(pos) {
  if (colliders.length === 0) return null;

  const origin = new THREE.Vector3(pos.x, pos.y + 3, pos.z);
  raycaster.set(origin, new THREE.Vector3(0, -1, 0));

  const hits = raycaster.intersectObjects(colliders, true);
  if (hits.length === 0) return null;

  return hits[0].point.y;
}

// Check if a wall/seat is directly in front of us
function hitsWall(fromPos, moveVec) {
  if (colliders.length === 0) return false;

  const dir = moveVec.clone().setY(0).normalize();
  if (dir.lengthSq() === 0) return false;

  const start = fromPos.clone();
  
  // --- THE FIX IS HERE ---
  // OLD: start.y += PLAYER_HEIGHT * 0.5; (Chest height)
  // NEW: We want to ignore steps. 
  // If MAX_STEP_HEIGHT is 0.18, we start the ray at 0.25.
  // This allows the ray to pass OVER the step, but still hit big walls.
  start.y += MAX_STEP_HEIGHT + 0.1; 

  raycaster.set(start, dir);
  
  // Only check a short distance ahead so we can get close to things
  raycaster.far = PLAYER_RADIUS + moveVec.length() * 1.2;

  const hits = raycaster.intersectObjects(colliders, true);
  return hits.length > 0;
}

// Stick to floor when not moving
function followFloor() {
  const floorY = getFloorHeightAt(player.position);
  if (floorY !== null) {
    const targetY = floorY + PLAYER_HEIGHT * 0.5;
    player.position.y = THREE.MathUtils.lerp(player.position.y, targetY, 0.3);
  }
}

/* ----------------------------------------------------------------
   Movement
-------------------------------------------------------------------*/

function movePlayer(delta) {
  if (colliders.length === 0) return;

  if (jumpTimer > 0) {
    jumpTimer -= delta;
    if (jumpTimer < 0) jumpTimer = 0;
  }

  // --- Camera-relative movement ---
  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  camForward.normalize();

  const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

  const move = new THREE.Vector3();
  if (input.forward) move.add(camForward);
  if (input.back)    move.sub(camForward);
  if (input.left)    move.sub(camRight);
  if (input.right)   move.add(camRight);

  if (move.lengthSq() === 0) {
    followFloor();
    return;
  }

  move.normalize().multiplyScalar(MOVE_SPEED * delta);

  const currentPos = player.position.clone();
  const currentFloorY = getFloorHeightAt(currentPos);
  if (currentFloorY === null) return;

  // Proposed new position (horizontal only)
  const proposedPos = currentPos.clone().add(new THREE.Vector3(move.x, 0, move.z));
  const newFloorY = getFloorHeightAt(proposedPos);
  if (newFloorY === null) return;  // outside auditorium

  const heightDiff = newFloorY - currentFloorY;

  // Step / jump rules
  const maxUp = (jumpTimer > 0) ? MAX_JUMP_HEIGHT : MAX_STEP_HEIGHT;
  if (heightDiff > maxUp) {
    // too high to climb
    return;
  }

  if (heightDiff < -MAX_DROP_HEIGHT) {
    // too far down (sudden drop) -> block
    return;
  }

  // Wall / seat collision
  if (hitsWall(currentPos, move)) {
    return;
  }

  // Commit movement
  player.position.copy(proposedPos);
  player.position.y = newFloorY + PLAYER_HEIGHT * 0.5;

  // Face movement direction
  const angle = Math.atan2(move.x, move.z);
  player.rotation.y = angle;
}

/* ----------------------------------------------------------------
   Camera
-------------------------------------------------------------------*/

function updateCamera() {
  if (mode === "first") {
    const head = player.position.clone();
    head.y += 0.4; // eye height
    camera.position.copy(head);
    const euler = new THREE.Euler(pitch, yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);
    return;
  }

  // --- Third Person ---
  const target = player.position.clone();
  target.y += 0.5;

  const offset = new THREE.Vector3(0, 0, cameraDistance);
  offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  const desiredCamPos = target.clone().add(offset);

  // Camera collision: ray from target to desiredCamPos
  raycaster.set(target, desiredCamPos.clone().sub(target).normalize());
  raycaster.far = cameraDistance;

  const hits = raycaster.intersectObjects(colliders, true);

  if (hits.length > 0) {
    const hitPoint = hits[0].point.clone();
    const dir = desiredCamPos.clone().sub(target).normalize();
    hitPoint.addScaledVector(dir, -0.2); // pull forward a bit
    camera.position.copy(hitPoint);
  } else {
    camera.position.copy(desiredCamPos);
  }

  camera.lookAt(target);
}

/* ----------------------------------------------------------------
   Main loop
-------------------------------------------------------------------*/

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  movePlayer(delta);
  updateCamera();

  renderer.render(scene, camera);
}
