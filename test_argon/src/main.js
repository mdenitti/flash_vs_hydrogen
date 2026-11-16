import * as THREE from 'three';
import { UltrarealisticGlobe } from './globe.js';
import { LandmarksManager, latLonToVector3, vector3ToLatLon } from './landmarks.js';
import { AircraftController } from './aircraft.js';
import { FlightAudio } from './audio.js';

const GLOBE_RADIUS = 160;

// Scene, Camera & Renderer
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  56,
  window.innerWidth / window.innerHeight,
  0.5,
  3500
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// World Subsystems
const globe = new UltrarealisticGlobe(scene, GLOBE_RADIUS);
const landmarksMgr = new LandmarksManager(GLOBE_RADIUS, scene);
const aircraft = new AircraftController(scene, GLOBE_RADIUS);
const audio = new FlightAudio();

// Flight State (Orthonormal Frame on Sphere)
const flight = {
  normal: new THREE.Vector3(0, 1, 0),
  forward: new THREE.Vector3(0, 0, 1),
  altitude: 16.5,
  minAltitude: 3.8,
  maxAltitude: 68.0,
  baseSpeed: 18.0,
  currentSpeed: 18.0,
  rollAngle: 0,
  pitchAngle: 0,
  autopilot: false,
  targetIndex: 0, // Starts targeting Eiffel Tower
  cameraMode: 0, // 0: Chase, 1: Cockpit, 2: Orbit Drone, 3: Globe Overview
  solarHours: 14.5,
  dynamicSunCycle: true,
  xp: 0,
};

// Camera free-look mouse orbit offsets
let isPointerDown = false;
let prevPointer = { x: 0, y: 0 };
let camYawOffset = 0;
let camPitchOffset = 0.26;
let camZoomDist = 12.2;

// Place aircraft on a scenic approach vector toward a landmark
function approachLandmark(index) {
  const lm = landmarksMgr.landmarks[index];
  if (!lm) return;

  const targetNormal = lm.normal.clone().normalize();
  // Create tangent approach direction from South-West heading North-East toward the monument
  const worldUp = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(worldUp, targetNormal).normalize();
  if (east.lengthSq() < 0.001) east.set(1, 0, 0);
  const north = new THREE.Vector3().crossVectors(targetNormal, east).normalize();

  const approachDir = north.clone().multiplyScalar(0.75).addScaledVector(east, 0.66).normalize();

  // Step back along the sphere by ~0.15 radians so the monument is right ahead of the nose
  const backAngle = 0.145;
  const rotAxis = new THREE.Vector3().crossVectors(targetNormal, approachDir).normalize();
  const startNormal = targetNormal.clone().applyAxisAngle(rotAxis, -backAngle).normalize();
  const startForward = approachDir
    .clone()
    .sub(startNormal.clone().multiplyScalar(approachDir.dot(startNormal)))
    .normalize();

  flight.normal.copy(startNormal);
  flight.forward.copy(startForward);
  const ringWorldPos = landmarksMgr.getCheckpointWorldPos(lm);
  flight.altitude = THREE.MathUtils.clamp(
    ringWorldPos.length() - GLOBE_RADIUS,
    flight.minAltitude,
    flight.maxAltitude
  );
  flight.rollAngle = 0;
  flight.pitchAngle = 0;

  syncAircraftTransform();
  const worldPos = new THREE.Vector3();
  aircraft.anchor.getWorldPosition(worldPos);
  aircraft.resetContrails(worldPos);

  // Snap camera smoothly behind aircraft
  camYawOffset = 0;
  camPitchOffset = 0.26;
  updateCamera(1.0);
}

function syncAircraftTransform() {
  const pos = flight.normal.clone().multiplyScalar(GLOBE_RADIUS + flight.altitude);
  aircraft.anchor.position.copy(pos);

  const left = new THREE.Vector3().crossVectors(flight.normal, flight.forward).normalize();
  flight.forward.crossVectors(left, flight.normal).normalize();

  const rotMatrix = new THREE.Matrix4().makeBasis(left, flight.normal, flight.forward);
  aircraft.anchor.quaternion.setFromRotationMatrix(rotMatrix);
}

// Input Handling
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'Space') {
    e.preventDefault();
    aircraft.fireSkyFlare();
    audio.playFlareBurst();
  } else if (e.code === 'KeyP') {
    toggleAutopilot();
  } else if (e.code === 'KeyT') {
    approachLandmark(flight.targetIndex);
    audio.playLockBeep();
  } else if (e.code === 'KeyC') {
    cycleCameraMode();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('blur', () => {
  Object.keys(keys).forEach((k) => {
    keys[k] = false;
  });
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  isPointerDown = true;
  prevPointer.x = e.clientX;
  prevPointer.y = e.clientY;
});

window.addEventListener('pointermove', (e) => {
  if (!isPointerDown) return;
  const dx = e.clientX - prevPointer.x;
  const dy = e.clientY - prevPointer.y;
  prevPointer.x = e.clientX;
  prevPointer.y = e.clientY;

  camYawOffset -= dx * 0.0065;
  camPitchOffset = THREE.MathUtils.clamp(camPitchOffset + dy * 0.0055, -0.45, 1.15);
});

window.addEventListener('pointerup', () => {
  isPointerDown = false;
});

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    camZoomDist = THREE.MathUtils.clamp(camZoomDist + e.deltaY * 0.012, 5.5, 55.0);
  },
  { passive: false }
);

// UI DOM Elements & Binding
const landmarkListEl = document.getElementById('landmark-list');
const poiLabelsContainer = document.getElementById('poi-labels-container');
const floatingLabelEls = [];

function initLandmarkUI() {
  document.getElementById('total-count').textContent = landmarksMgr.landmarks.length;

  landmarksMgr.landmarks.forEach((lm, idx) => {
    // Sidebar item
    const item = document.createElement('div');
    item.className = `landmark-item ${idx === flight.targetIndex ? 'active-target' : ''}`;
    item.dataset.index = idx;
    item.innerHTML = `
      <div class="landmark-info">
        <span class="landmark-emoji">${lm.emoji}</span>
        <div>
          <div class="landmark-name">${lm.name}</div>
          <div class="landmark-region">${lm.city}</div>
        </div>
      </div>
      <div class="landmark-meta">
        <span class="landmark-dist" id="sidebar-dist-${idx}">0 km</span>
        <button class="landmark-warp-btn" data-warp="${idx}" title="Instant approach to ${lm.name}">Fly Here</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.dataset.warp !== undefined) {
        selectTargetLandmark(idx);
        approachLandmark(idx);
        return;
      }
      selectTargetLandmark(idx);
    });

    landmarkListEl.appendChild(item);

    // 3D Floating Label Pill
    const labelEl = document.createElement('div');
    labelEl.className = `poi-floating-label ${idx === flight.targetIndex ? 'is-target' : ''}`;
    labelEl.innerHTML = `
      <div class="poi-floating-pill">
        <span>${lm.emoji}</span>
        <span>${lm.name}</span>
        <span class="poi-pill-dist" id="pill-dist-${idx}">0 km</span>
      </div>
      <div class="poi-stem"></div>
    `;
    labelEl.addEventListener('click', () => {
      selectTargetLandmark(idx);
    });
    poiLabelsContainer.appendChild(labelEl);
    floatingLabelEls.push(labelEl);
  });
}

function selectTargetLandmark(index) {
  flight.targetIndex = index;
  audio.playLockBeep();

  document.querySelectorAll('.landmark-item').forEach((el, i) => {
    el.classList.toggle('active-target', i === index);
  });
  floatingLabelEls.forEach((el, i) => {
    el.classList.toggle('is-target', i === index);
  });

  const lm = landmarksMgr.landmarks[index];
  document.getElementById('target-poi-name').textContent = lm.name;
}

function toggleAutopilot(forceState) {
  flight.autopilot = forceState !== undefined ? forceState : !flight.autopilot;
  const btn = document.getElementById('btn-autopilot');
  const badge = document.getElementById('flight-mode-badge');

  btn.classList.toggle('active', flight.autopilot);
  btn.textContent = flight.autopilot ? '🧭 Autopilot: ON' : '🧭 Autopilot to Target';

  if (flight.autopilot) {
    badge.textContent = 'AUTOPILOT NAV';
    badge.className = 'status-badge autopilot';
  } else {
    badge.textContent = 'MANUAL PILOT';
    badge.className = 'status-badge manual';
  }
}

const CAMERA_MODES = ['Chase', 'Cockpit', 'Drone', 'Globe'];
function cycleCameraMode() {
  flight.cameraMode = (flight.cameraMode + 1) % CAMERA_MODES.length;
  document.getElementById('btn-camera').textContent = `🎥 Cam: ${CAMERA_MODES[flight.cameraMode]}`;
}

// Bind Left Panel Controls
const sunSlider = document.getElementById('sun-slider');
const solarTimeLabel = document.getElementById('solar-time-label');

function formatHoursUTC(val) {
  const hrs = Math.floor(val) % 24;
  const mins = Math.floor((val % 1) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

sunSlider.addEventListener('input', (e) => {
  flight.solarHours = parseFloat(e.target.value);
  solarTimeLabel.textContent = formatHoursUTC(flight.solarHours);
  globe.setSolarTimeHours(flight.solarHours);
});

const scaleSlider = document.getElementById('landmark-scale-slider');
const scaleLabel = document.getElementById('scale-label');
scaleSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  scaleLabel.textContent = `${val.toFixed(1)}x`;
  landmarksMgr.setScale(val);
});

document.getElementById('btn-autopilot').addEventListener('click', () => toggleAutopilot());
document.getElementById('btn-teleport').addEventListener('click', () => {
  approachLandmark(flight.targetIndex);
  audio.playLockBeep();
});
document.getElementById('btn-camera').addEventListener('click', () => cycleCameraMode());

const btnDayCycle = document.getElementById('btn-daycycle');
btnDayCycle.addEventListener('click', () => {
  flight.dynamicSunCycle = !flight.dynamicSunCycle;
  btnDayCycle.classList.toggle('active', flight.dynamicSunCycle);
  btnDayCycle.textContent = flight.dynamicSunCycle ? '☀️ Cycle: On' : '☀️ Cycle: Pause';
});

const btnAudio = document.getElementById('btn-audio');
btnAudio.addEventListener('click', () => {
  const on = audio.toggle();
  btnAudio.classList.toggle('active', on);
  btnAudio.textContent = on ? '🔊 Audio: On' : '🔊 Audio: Off';
});

document.getElementById('toast-next-btn').addEventListener('click', () => {
  const nextIdx = (flight.targetIndex + 1) % landmarksMgr.landmarks.length;
  selectTargetLandmark(nextIdx);
  document.getElementById('checkpoint-toast').classList.add('hidden');
});

// Checkpoint Discovery Toast Logic
let toastTimeout = null;
function triggerCheckpointDiscovery(lm) {
  lm.cooldown = 8.0;
  if (!lm.visited) {
    lm.visited = true;
    flight.xp += 500;
    const visitedTotal = landmarksMgr.landmarks.filter((item) => item.visited).length;
    document.getElementById('visited-count').textContent = visitedTotal;

    const sidebarEl = landmarkListEl.children[lm.index];
    if (sidebarEl) sidebarEl.classList.add('visited');
    if (floatingLabelEls[lm.index]) floatingLabelEls[lm.index].classList.add('is-visited');
  }

  audio.playCheckpointChime();
  const ringPos = landmarksMgr.getCheckpointWorldPos(lm);
  landmarksMgr.spawnCelebrationBurst(ringPos, lm.color);

  // Populate & Show Toast Postcard
  const toastEl = document.getElementById('checkpoint-toast');
  document.getElementById('toast-title').textContent = `${lm.emoji} ${lm.name}`;
  const latStr = `${Math.abs(lm.lat).toFixed(2)}° ${lm.lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lm.lon).toFixed(2)}° ${lm.lon >= 0 ? 'E' : 'W'}`;
  document.getElementById('toast-location').textContent = `${lm.city} · ${latStr}, ${lonStr}`;
  document.getElementById('toast-desc').textContent = lm.description;
  document.getElementById('toast-xp').textContent = `TOTAL XP: ${flight.xp}`;
  toastEl.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 6500);

  // If autopilot is active, automatically advance to next unvisited landmark
  if (flight.autopilot) {
    const nextUnvisited = landmarksMgr.landmarks.findIndex((item, idx) => !item.visited && idx !== lm.index);
    const nextIdx = nextUnvisited !== -1 ? nextUnvisited : (lm.index + 1) % landmarksMgr.landmarks.length;
    selectTargetLandmark(nextIdx);
  }
}

// Update Camera Modes
const smoothCamPos = new THREE.Vector3();
const smoothLookAt = new THREE.Vector3();

function updateCamera(lerpFactor = 0.12) {
  const planePos = aircraft.anchor.position;
  const up = flight.normal;
  const forward = flight.forward;
  const left = new THREE.Vector3().crossVectors(up, forward).normalize();

  let desiredPos = new THREE.Vector3();
  let desiredTarget = new THREE.Vector3();

  if (flight.cameraMode === 0) {
    // Chase Cam with mouse orbit support
    const cosY = Math.cos(camYawOffset);
    const sinY = Math.sin(camYawOffset);
    const horizBack = forward
      .clone()
      .multiplyScalar(-cosY)
      .addScaledVector(left, sinY)
      .normalize();

    desiredPos
      .copy(planePos)
      .addScaledVector(horizBack, camZoomDist * Math.cos(camPitchOffset))
      .addScaledVector(up, camZoomDist * Math.sin(camPitchOffset) + 2.8);

    desiredTarget
      .copy(planePos)
      .addScaledVector(forward, 9.0)
      .addScaledVector(up, -1.1);
  } else if (flight.cameraMode === 1) {
    // Cockpit / Nose Cam
    desiredPos.copy(planePos).addScaledVector(up, 0.85).addScaledVector(forward, 1.4);
    desiredTarget.copy(planePos).addScaledVector(forward, 30.0).addScaledVector(up, 0.2);
    lerpFactor = 0.45;
  } else if (flight.cameraMode === 2) {
    // Cinematic Side-Front Drone Cam
    desiredPos
      .copy(planePos)
      .addScaledVector(forward, 8.5)
      .addScaledVector(left, 9.5)
      .addScaledVector(up, 3.8);
    desiredTarget.copy(planePos).addScaledVector(up, 0.5);
  } else {
    // High-Altitude Orbital Globe Overview Cam
    desiredPos.copy(planePos).addScaledVector(up, 95.0).addScaledVector(forward, -45.0);
    desiredTarget.copy(planePos);
  }

  if (lerpFactor >= 1.0) {
    smoothCamPos.copy(desiredPos);
    smoothLookAt.copy(desiredTarget);
  } else {
    smoothCamPos.lerp(desiredPos, lerpFactor);
    smoothLookAt.lerp(desiredTarget, lerpFactor * 1.4);
  }

  camera.position.copy(smoothCamPos);
  camera.up.copy(up);
  camera.lookAt(smoothLookAt);
}

// Update 2D Global Radar Minimap
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');

function updateRadarMinimap(lat, lon, headingDeg, elapsedTime) {
  const w = radarCanvas.width;
  const h = radarCanvas.height;
  radarCtx.clearRect(0, 0, w, h);

  // Subtle lat/lon graticule grid
  radarCtx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  radarCtx.lineWidth = 1;
  for (let gx = 1; gx < 6; gx++) {
    radarCtx.beginPath();
    radarCtx.moveTo((w / 6) * gx, 0);
    radarCtx.lineTo((w / 6) * gx, h);
    radarCtx.stroke();
  }
  for (let gy = 1; gy < 4; gy++) {
    radarCtx.beginPath();
    radarCtx.moveTo(0, (h / 4) * gy);
    radarCtx.lineTo(w, (h / 4) * gy);
    radarCtx.stroke();
  }

  // Equator line
  radarCtx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  radarCtx.beginPath();
  radarCtx.moveTo(0, h / 2);
  radarCtx.lineTo(w, h / 2);
  radarCtx.stroke();

  const toMapXY = (la, lo) => ({
    x: ((lo + 180) / 360) * w,
    y: ((90 - la) / 180) * h,
  });

  const planeXY = toMapXY(lat, lon);
  const targetLm = landmarksMgr.landmarks[flight.targetIndex];
  if (targetLm) {
    const targetXY = toMapXY(targetLm.lat, targetLm.lon);
    radarCtx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    radarCtx.setLineDash([4, 3]);
    radarCtx.beginPath();
    radarCtx.moveTo(planeXY.x, planeXY.y);
    radarCtx.lineTo(targetXY.x, targetXY.y);
    radarCtx.stroke();
    radarCtx.setLineDash([]);
  }

  // Plot all 12 landmarks
  landmarksMgr.landmarks.forEach((lm, idx) => {
    const pt = toMapXY(lm.lat, lm.lon);
    const isTarget = idx === flight.targetIndex;

    if (isTarget) {
      const pulseR = 5 + Math.sin(elapsedTime * 6) * 2.5;
      radarCtx.strokeStyle = '#fbbf24';
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, pulseR, 0, Math.PI * 2);
      radarCtx.stroke();
    }

    radarCtx.fillStyle = isTarget ? '#fbbf24' : lm.visited ? '#34d399' : '#38bdf8';
    radarCtx.beginPath();
    radarCtx.arc(pt.x, pt.y, isTarget ? 3.5 : 2.5, 0, Math.PI * 2);
    radarCtx.fill();
  });

  // Plot Aircraft Icon
  radarCtx.save();
  radarCtx.translate(planeXY.x, planeXY.y);
  radarCtx.rotate(THREE.MathUtils.degToRad(headingDeg));
  radarCtx.fillStyle = '#ffffff';
  radarCtx.beginPath();
  radarCtx.moveTo(0, -5.5);
  radarCtx.lineTo(4, 4.5);
  radarCtx.lineTo(0, 2.5);
  radarCtx.lineTo(-4, 4.5);
  radarCtx.closePath();
  radarCtx.fill();
  radarCtx.restore();
}

// Update HUD Telemetry & Floating 3D Landmark Labels
const compassTapeEl = document.getElementById('compass-tape');
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function updateHUD(elapsedTime) {
  const planePos = aircraft.anchor.position;
  const { lat, lon } = vector3ToLatLon(planePos);

  // Compute compass heading (0° = North, 90° = East)
  const worldNorth = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(worldNorth, flight.normal);
  if (east.lengthSq() < 0.001) east.set(1, 0, 0);
  else east.normalize();
  const north = new THREE.Vector3().crossVectors(flight.normal, east).normalize();
  const nComp = flight.forward.dot(north);
  const eComp = flight.forward.dot(east);
  let headingDeg = THREE.MathUtils.radToDeg(Math.atan2(eComp, nComp));
  if (headingDeg < 0) headingDeg += 360;

  const hdgRounded = Math.round(headingDeg) % 360;
  document.getElementById('hud-heading').textContent = `${String(hdgRounded).padStart(3, '0')}°`;
  const cardIdx = Math.round(hdgRounded / 45) % 8;
  document.getElementById('hud-cardinal').textContent = CARDINALS[cardIdx];

  // Build scrolling text compass tape
  const baseTen = Math.round(hdgRounded / 10) * 10;
  let tapeParts = [];
  for (let offset = -30; offset <= 30; offset += 10) {
    let deg = (baseTen + offset + 360) % 360;
    if (deg === 0) tapeParts.push('N');
    else if (deg === 90) tapeParts.push('E');
    else if (deg === 180) tapeParts.push('S');
    else if (deg === 270) tapeParts.push('W');
    else tapeParts.push(String(deg / 10).padStart(2, '0'));
  }
  compassTapeEl.textContent = tapeParts.join(' · ');

  // Airspeed & Altitude readouts
  const knots = Math.round(flight.currentSpeed * 18.5);
  const feet = Math.round((flight.altitude - 2.0) * 850);
  document.getElementById('hud-speed').textContent = knots;
  document.getElementById('hud-altitude').textContent = feet.toLocaleString();

  document.getElementById('speed-bar-fill').style.width = `${Math.min(100, (knots / 700) * 100)}%`;
  document.getElementById('alt-bar-fill').style.width = `${
    ((flight.altitude - flight.minAltitude) / (flight.maxAltitude - flight.minAltitude)) * 100
  }%`;

  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  document.getElementById('hud-lat').textContent = `${Math.abs(lat).toFixed(2)}° ${latDir}`;
  document.getElementById('hud-lon').textContent = `${Math.abs(lon).toFixed(2)}° ${lonDir}`;

  // Project 3D Landmarks to 2D Screen & check Checkpoint Proximity
  const camToGlobeCenter = camera.position.clone().normalize();

  landmarksMgr.landmarks.forEach((lm, idx) => {
    const ringWorldPos = landmarksMgr.getCheckpointWorldPos(lm);
    const distUnits = planePos.distanceTo(ringWorldPos);
    const distKm = Math.round(distUnits * 28);

    const sideDistEl = document.getElementById(`sidebar-dist-${idx}`);
    if (sideDistEl) sideDistEl.textContent = `${distKm.toLocaleString()} km`;

    const pillDistEl = document.getElementById(`pill-dist-${idx}`);
    if (pillDistEl) pillDistEl.textContent = `${distKm.toLocaleString()} km`;

    if (idx === flight.targetIndex) {
      document.getElementById('target-poi-dist').textContent = `${distKm.toLocaleString()} km`;
      globe.updateGuideArc(planePos, ringWorldPos);
    }

    // Check if aircraft flew over the landmark or through its checkpoint ring
    const surfaceDist = planePos.distanceTo(lm.surfacePos);
    const triggerRadius = 6.2 * landmarksMgr.scaleMultiplier;
    if ((distUnits < triggerRadius || surfaceDist < triggerRadius * 1.15) && lm.cooldown <= 0) {
      triggerCheckpointDiscovery(lm);
    }

    // Project floating label to screen if on visible hemisphere
    const labelEl = floatingLabelEls[idx];
    const dotVisible = lm.normal.dot(camToGlobeCenter);
    const ndc = ringWorldPos.clone().project(camera);

    if (dotVisible > 0.12 && ndc.z < 1.0 && Math.abs(ndc.x) < 0.96 && Math.abs(ndc.y) < 0.94) {
      const sx = (ndc.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
      labelEl.style.display = 'flex';
      labelEl.style.left = `${sx}px`;
      labelEl.style.top = `${sy - 14}px`;
    } else {
      labelEl.style.display = 'none';
    }
  });

  updateRadarMinimap(lat, lon, headingDeg, elapsedTime);
}

// Initialize UI, Sun Position, and Start Approach to Eiffel Tower
initLandmarkUI();
globe.setSolarTimeHours(flight.solarHours);
approachLandmark(0); // Start right on approach to the Eiffel Tower in Paris!

// Main Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.getElapsedTime();

  // Optional dynamic solar progression
  if (flight.dynamicSunCycle) {
    flight.solarHours = (flight.solarHours + dt * 0.08) % 24;
    sunSlider.value = flight.solarHours;
    solarTimeLabel.textContent = formatHoursUTC(flight.solarHours);
    globe.setSolarTimeHours(flight.solarHours);
  }

  // Flight Controls & Physics
  const isBoosting = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  const isSlowing = !!(keys['ControlLeft'] || keys['ControlRight']);
  document.getElementById('boost-badge').classList.toggle('hidden', !isBoosting);

  const targetSpeed = isBoosting
    ? flight.baseSpeed * 2.05
    : isSlowing
    ? flight.baseSpeed * 0.52
    : flight.baseSpeed;
  flight.currentSpeed = THREE.MathUtils.lerp(flight.currentSpeed, targetSpeed, dt * 4.5);

  let turnInput = 0;
  let pitchInput = 0;

  if (keys['KeyA'] || keys['ArrowLeft']) turnInput += 1;
  if (keys['KeyD'] || keys['ArrowRight']) turnInput -= 1;
  if (keys['KeyW'] || keys['ArrowUp']) pitchInput -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) pitchInput += 1;

  // Disengage autopilot if user manually steers
  if ((turnInput !== 0 || pitchInput !== 0) && flight.autopilot) {
    toggleAutopilot(false);
  }

  if (flight.autopilot) {
    // Great-Circle Autopilot Guidance toward Target Landmark Checkpoint Ring
    const targetLm = landmarksMgr.landmarks[flight.targetIndex];
    if (targetLm) {
      const desiredTangent = targetLm.normal
        .clone()
        .sub(flight.normal.clone().multiplyScalar(targetLm.normal.dot(flight.normal)))
        .normalize();

      const left = new THREE.Vector3().crossVectors(flight.normal, flight.forward).normalize();
      const sideDot = desiredTangent.dot(left);
      const forwardDot = desiredTangent.dot(flight.forward);
      if (forwardDot < 0) {
        turnInput = sideDot >= 0 ? 1 : -1;
      } else {
        turnInput = THREE.MathUtils.clamp(sideDot * 3.5, -1, 1);
      }

      const ringWorldPos = landmarksMgr.getCheckpointWorldPos(targetLm);
      const desiredAlt = ringWorldPos.length() - GLOBE_RADIUS;
      const altError = desiredAlt - flight.altitude;
      pitchInput = THREE.MathUtils.clamp(altError * 0.22, -0.85, 0.85);
    }
  }

  // Apply Turn (Yaw around surface normal + visual Roll bank)
  const yawRate = 1.15;
  if (Math.abs(turnInput) > 0.001) {
    flight.forward.applyAxisAngle(flight.normal, turnInput * yawRate * dt).normalize();
  }
  flight.rollAngle = THREE.MathUtils.lerp(flight.rollAngle, -turnInput * 0.68, dt * 6.0);
  flight.pitchAngle = THREE.MathUtils.lerp(flight.pitchAngle, pitchInput * 0.55, dt * 6.0);

  // Apply Climb / Descent Altitude
  flight.altitude = THREE.MathUtils.clamp(
    flight.altitude + flight.pitchAngle * 24.0 * dt,
    flight.minAltitude,
    flight.maxAltitude
  );

  // Advance aircraft forward (+Z nose-first) along the Great Circle on the sphere
  const angularVel = (flight.currentSpeed / (GLOBE_RADIUS + flight.altitude)) * dt;
  const leftAxis = new THREE.Vector3().crossVectors(flight.normal, flight.forward).normalize();
  flight.normal.applyAxisAngle(leftAxis, angularVel).normalize();
  flight.forward.applyAxisAngle(leftAxis, angularVel).normalize();

  syncAircraftTransform();

  // Update Subsystems
  aircraft.updateVisuals(dt, flight.rollAngle, flight.pitchAngle, isBoosting);
  globe.update(dt);
  landmarksMgr.update(dt, elapsedTime, flight.targetIndex);
  audio.update((flight.currentSpeed - 9) / 28, isBoosting);

  updateCamera(0.14);
  updateHUD(elapsedTime);

  renderer.render(scene, camera);
}

animate();

// Responsive Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
