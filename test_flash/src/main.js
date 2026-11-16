import * as THREE from 'three';
import { Globe } from './world/globe.js';
import { Aircraft } from './entities/aircraft.js';
import { LandmarkBuilder } from './landmarks/landmarkBuilder.js';
import { CheckpointSystem } from './systems/checkpointSystem.js';
import { SoundManager } from './audio/soundManager.js';
import { HUD } from './ui/hud.js';

class App {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.clock = new THREE.Clock();

    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initWorld();
    this.initAudioAndSystems();
    this.initInputListeners();

    // Responsive resize
    window.addEventListener('resize', () => this.onResize());

    // Start loop
    this.animate();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010409);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      4000
    );
  }

  initWorld() {
    // 1. Globe with Day/Night/Clouds/Atmosphere/Sun
    this.globe = new Globe(this.scene);

    // 2. 14 Global Landmarks with Big 3D Geometry and Beacons
    this.landmarkBuilder = new LandmarkBuilder(this.scene);

    // 3. Player Aircraft
    this.aircraft = new Aircraft(this.scene);
  }

  initAudioAndSystems() {
    this.soundManager = new SoundManager();

    // Checkpoint & Discovery System
    this.checkpointSystem = new CheckpointSystem(
      this.scene,
      this.landmarkBuilder,
      this.soundManager,
      (landmarkInst, count, total) => {
        if (this.hud) {
          this.hud.showCelebration(landmarkInst, count, total);
        }
      }
    );

    // Modern Aerospace HUD
    this.hud = new HUD({
      aircraft: this.aircraft,
      globe: this.globe,
      checkpointSystem: this.checkpointSystem,
      soundManager: this.soundManager,
      onWarpToLandmark: landmarkData => {
        this.aircraft.warpToLandmark(landmarkData);
      }
    });

    // Resume Web Audio Context on first interaction
    const resumeAudio = () => {
      this.soundManager.ensureContext();
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
  }

  initInputListeners() {
    this.keys = {};

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      this.updateInputState();

      // Quick hotkeys
      if (e.code === 'KeyC') {
        const modes = ['chase', 'cockpit', 'orbit'];
        const curIdx = modes.indexOf(this.aircraft.cameraMode);
        this.aircraft.cameraMode = modes[(curIdx + 1) % modes.length];
        const camBtn = document.getElementById('btn-camera');
        if (camBtn) camBtn.textContent = `🎥 Cam: ${this.aircraft.cameraMode.toUpperCase()}`;
      } else if (e.code === 'KeyM') {
        const isMuted = this.soundManager.toggleMute();
        const muteBtn = document.getElementById('btn-mute');
        if (muteBtn) muteBtn.textContent = isMuted ? '🔇 Audio: Off' : '🔊 Audio: On';
      } else if (e.code === 'KeyH') {
        const helpModal = document.getElementById('help-modal');
        if (helpModal) helpModal.classList.toggle('hidden');
      }
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      this.updateInputState();
    });
  }

  updateInputState() {
    // If mouse flight is active and not pressing keys, keep mouse flight values
    if (this.hud && this.hud.mouseFlightEnabled &&
        !this.keys['KeyW'] && !this.keys['KeyS'] && !this.keys['ArrowUp'] && !this.keys['ArrowDown'] &&
        !this.keys['KeyA'] && !this.keys['KeyD'] && !this.keys['ArrowLeft'] && !this.keys['ArrowRight']) {
      // Mouse flight handles roll and pitch
    } else {
      let pitch = 0;
      let roll = 0;
      let yaw = 0;

      // Pitch: S pulls nose UP, W pushes nose DOWN (Standard flight stick convention)
      if (this.keys['KeyS'] || this.keys['ArrowDown']) pitch += 1;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) pitch -= 1;

      // Roll: A banks LEFT, D banks RIGHT
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) roll -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) roll += 1;

      // Yaw: Q yaws left, E yaws right
      if (this.keys['KeyQ']) yaw -= 1;
      if (this.keys['KeyE']) yaw += 1;

      this.aircraft.input.pitch = pitch;
      this.aircraft.input.roll = roll;
      this.aircraft.input.yaw = yaw;
    }

    // Boost: Spacebar
    this.aircraft.input.boost = !!(this.keys['Space']);

    // Brake / Decelerate: Shift or KeyB
    this.aircraft.input.brake = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyB']);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update Aircraft Flight Physics
    this.aircraft.update(delta, elapsedTime);

    // 2. Update Camera Tracking
    this.aircraft.updateCamera(this.camera, delta);

    // 3. Update Globe & Atmospheres
    this.globe.update(delta);

    // 4. Update Landmarks & Checkpoint Rings
    this.landmarkBuilder.update(delta, elapsedTime);

    // 5. Update Checkpoint Detection & Particle Bursts
    this.checkpointSystem.update(this.aircraft.position, delta, elapsedTime);

    // 6. Update Audio Synthesis
    this.soundManager.update(this.aircraft.speed, this.aircraft.isBoosting);

    // 7. Update Aerospace HUD
    this.hud.update(
      this.aircraft,
      this.checkpointSystem.nearestLandmark,
      this.checkpointSystem.nearestDistanceKm
    );

    // 8. Render WebGL Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});

