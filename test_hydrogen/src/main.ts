import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FlightAudio } from './core/audio.ts';
import { GLOBE_RADIUS } from './core/constants.ts';
import { FlightController } from './flight/FlightController.ts';
import { VolumetricClouds } from './flight/VolumetricClouds.ts';
import { buildGlobe } from './globe/GlobeBuilder.ts';
import { CheckpointSystem } from './landmarks/CheckpointSystem.ts';
import { HudController } from './ui/HudController.ts';
import './style.css';

/**
 * Computes normalized sun direction vector from an orbital azimuth angle.
 *
 * @param angleRad - Solar azimuth angle in radians.
 * @param target - Optional Vector3 to update in place.
 * @returns Normalized sun direction vector.
 */
function computeSunDirection(
  angleRad: number,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  return target
    .set(Math.cos(angleRad), 0.34, -Math.sin(angleRad))
    .normalize();
}

/**
 * Bootstraps the Three.js ultrarealistic globe flight experience.
 */
function bootstrap(): void {
  const container = document.getElementById('app');
  if (!container) return;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    52,
    window.innerWidth / window.innerHeight,
    0.12,
    3400
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  container.appendChild(renderer.domElement);

  // Post-processing pipeline with high-threshold HDR bloom (glows sun, city lights, strobes)
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.26,
    0.45,
    1.12
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // Lighting: Sunlight + subtle atmospheric sky/ground fill
  let sunAngle = 0.62; // Golden afternoon sun across Europe & Africa
  let autoSun = false;
  const sunDir = computeSunDirection(sunAngle);

  const sunLight = new THREE.DirectionalLight('#fff8eb', 2.75);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 160;
  const shadowExtent = 26;
  sunLight.shadow.camera.left = -shadowExtent;
  sunLight.shadow.camera.right = shadowExtent;
  sunLight.shadow.camera.top = shadowExtent;
  sunLight.shadow.camera.bottom = -shadowExtent;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const ambientFill = new THREE.AmbientLight('#8fb6e8', 0.34);
  scene.add(ambientFill);

  const hemiFill = new THREE.HemisphereLight('#a8d2ff', '#16243d', 0.42);
  scene.add(hemiFill);

  // Build Earth globe, shaders, drifting clouds, atmosphere, Moon & starfield
  const globe = buildGlobe(renderer, sunDir);
  scene.add(globe.group);

  // Volumetric cumulus cloud clusters in lower atmosphere
  const volumetricClouds = new VolumetricClouds(135);
  scene.add(volumetricClouds.group);

  // Procedural audio
  const audio = new FlightAudio();

  // Landmarks & Fly-Over Checkpoint System
  let hud: HudController;
  const checkpointSystem = new CheckpointSystem(
    globe.getSurfaceRadius,
    (cp, discoveredCount, totalCount) => {
      audio.playCheckpointChime(discoveredCount === totalCount);
      hud.showDiscoveryToast(cp.definition, discoveredCount, totalCount);
    }
  );
  scene.add(checkpointSystem.group);

  // Snap landmarks flush to real 3D topography once elevation texture finishes loading
  void globe.readyPromise.then(() => {
    checkpointSystem.reanchorToTerrain(globe.getSurfaceRadius);
  });

  // Aircraft & Spherical Flight Controller
  const flight = new FlightController(
    renderer.domElement,
    globe.getSurfaceRadius
  );
  scene.add(flight.rootGroup);
  scene.add(flight.contrails.group);

  // Aviation HUD & Interactive Controls
  hud = new HudController(container, checkpointSystem.checkpoints, {
    onSelectTarget: (id) => {
      checkpointSystem.setActiveTarget(id);
    },
    onJumpToLandmark: (def) => {
      checkpointSystem.setActiveTarget(def.id);
      flight.jumpToApproach(def);
    },
    onSelectAircraft: (variant) => {
      flight.setVariant(variant);
    },
    onCycleCamera: () => {
      flight.setCameraMode();
    },
    onToggleAutopilot: () => {
      flight.setAutopilot();
    },
    onToggleInvertPitch: () => {
      flight.toggleInvertPitch();
    },
    onToggleAudio: () => {
      const state = audio.setEnabled();
      hud.setAudioState(state);
    },
    onSunAngleChange: (angleRad) => {
      autoSun = false;
      sunAngle = angleRad;
      computeSunDirection(sunAngle, sunDir);
      hud.setSunState(autoSun, sunAngle);
    },
    onToggleAutoSun: () => {
      autoSun = !autoSun;
      hud.setSunState(autoSun, sunAngle);
    },
  });

  hud.setSunState(autoSun, sunAngle);

  // Global keyboard shortcuts for camera, autopilot, aircraft swap, and audio
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyC') {
      flight.setCameraMode();
    } else if (e.code === 'KeyP') {
      flight.setAutopilot();
    } else if (e.code === 'KeyB') {
      const next = flight.getTelemetry().variant === 'biplane' ? 'jet' : 'biplane';
      flight.setVariant(next);
    } else if (e.code === 'KeyM') {
      const state = audio.setEnabled();
      hud.setAudioState(state);
    }
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });

  let lastTimeMs = performance.now();
  let elapsed = 0;
  const focusSurfacePos = new THREE.Vector3();

  /**
   * Main 60fps simulation and render loop.
   */
  const animate = (): void => {
    requestAnimationFrame(animate);
    const nowMs = performance.now();
    const dt = Math.min((nowMs - lastTimeMs) * 0.001, 0.05);
    lastTimeMs = nowMs;
    elapsed += dt;

    if (autoSun) {
      sunAngle = (sunAngle + dt * 0.09) % (Math.PI * 2);
      computeSunDirection(sunAngle, sunDir);
      hud.setSunState(autoSun, sunAngle);
    }

    flight.update(dt, elapsed, camera, checkpointSystem.getActiveTarget().definition);

    const aircraftPos = flight.getWorldPosition();
    const telemetry = flight.getTelemetry();

    // Anchor dynamic directional shadow frustum onto the Earth patch beneath the aircraft
    focusSurfacePos
      .copy(aircraftPos)
      .normalize()
      .multiplyScalar(GLOBE_RADIUS);
    sunLight.target.position.copy(focusSurfacePos);
    sunLight.position.copy(focusSurfacePos).addScaledVector(sunDir, 85);

    globe.update(dt, elapsed, sunDir, camera.position);
    volumetricClouds.update(dt, sunDir, camera.position);
    checkpointSystem.update(dt, elapsed, aircraftPos, sunDir);
    const activeTarget = checkpointSystem.getActiveTarget();
    audio.update(telemetry.speedNorm, telemetry.altitudeUnits, telemetry.variant);
    hud.update(
      dt,
      telemetry,
      checkpointSystem.checkpoints,
      activeTarget,
      aircraftPos,
      camera
    );

    composer.render();
  };

  animate();
}

bootstrap();
