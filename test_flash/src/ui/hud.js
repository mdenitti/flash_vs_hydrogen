import * as THREE from 'three';
import { computeHeadingDegrees, vector3ToLatLon } from '../math/globeMath.js';
import { LANDMARKS } from '../landmarks/landmarksData.js';

export class HUD {
  constructor({
    aircraft,
    globe,
    checkpointSystem,
    soundManager,
    onWarpToLandmark
  }) {
    this.aircraft = aircraft;
    this.globe = globe;
    this.checkpointSystem = checkpointSystem;
    this.soundManager = soundManager;
    this.onWarpToLandmark = onWarpToLandmark;

    this.mouseFlightEnabled = false;

    this.cacheDOMElements();
    this.bindEvents();
    this.initRadarCanvas();
    this.populateLandmarkSelector();
  }

  cacheDOMElements() {
    this.dom = {
      speedVal: document.getElementById('hud-speed-val'),
      speedBar: document.getElementById('hud-speed-bar'),
      altVal: document.getElementById('hud-alt-val'),
      headingTape: document.getElementById('hud-heading-tape'),
      pitchLadder: document.getElementById('hud-pitch-ladder'),
      waypointTag: document.getElementById('hud-waypoint-tag'),
      waypointDist: document.getElementById('hud-waypoint-dist'),
      waypointArrow: document.getElementById('hud-waypoint-arrow'),
      discoveredCount: document.getElementById('stat-discovered-count'),
      celebrationModal: document.getElementById('celebration-modal'),
      celebrationTitle: document.getElementById('celebration-title'),
      celebrationLoc: document.getElementById('celebration-loc'),
      celebrationFact: document.getElementById('celebration-fact'),
      landmarkSelect: document.getElementById('landmark-select'),
      warpBtn: document.getElementById('warp-btn'),
      radarCanvas: document.getElementById('radar-canvas'),
      muteBtn: document.getElementById('btn-mute'),
      cameraBtn: document.getElementById('btn-camera'),
      mouseModeBtn: document.getElementById('btn-mouse-mode'),
      helpModal: document.getElementById('help-modal'),
      btnHelp: document.getElementById('btn-help'),
      closeHelp: document.getElementById('close-help-btn'),
      timePresetBtns: document.querySelectorAll('.time-btn')
    };
  }

  bindEvents() {
    // Sound Mute
    if (this.dom.muteBtn) {
      this.dom.muteBtn.addEventListener('click', () => {
        const isMuted = this.soundManager.toggleMute();
        this.dom.muteBtn.textContent = isMuted ? '🔇 Audio: Off' : '🔊 Audio: On';
      });
    }

    // Camera Mode toggle
    if (this.dom.cameraBtn) {
      this.dom.cameraBtn.addEventListener('click', () => {
        const modes = ['chase', 'cockpit', 'orbit'];
        const currentIdx = modes.indexOf(this.aircraft.cameraMode);
        const nextMode = modes[(currentIdx + 1) % modes.length];
        this.aircraft.cameraMode = nextMode;
        this.dom.cameraBtn.textContent = `🎥 Cam: ${nextMode.toUpperCase()}`;
      });
    }

    // Mouse Flight Toggle
    if (this.dom.mouseModeBtn) {
      this.dom.mouseModeBtn.addEventListener('click', () => {
        this.mouseFlightEnabled = !this.mouseFlightEnabled;
        this.dom.mouseModeBtn.classList.toggle('active', this.mouseFlightEnabled);
        this.dom.mouseModeBtn.textContent = this.mouseFlightEnabled ? '🖱️ Mouse Steer: ON' : '🖱️ Mouse Steer: OFF';
      });
    }

    // Fast travel warp button
    if (this.dom.warpBtn && this.dom.landmarkSelect) {
      this.dom.warpBtn.addEventListener('click', () => {
        const id = this.dom.landmarkSelect.value;
        const target = LANDMARKS.find(l => l.id === id);
        if (target && this.onWarpToLandmark) {
          this.onWarpToLandmark(target);
          this.showNotice(`Warped to approach vector: ${target.name}`);
        }
      });
    }

    // Help modal toggle
    if (this.dom.btnHelp && this.dom.helpModal) {
      this.dom.btnHelp.addEventListener('click', () => {
        this.dom.helpModal.classList.toggle('hidden');
      });
    }
    if (this.dom.closeHelp && this.dom.helpModal) {
      this.dom.closeHelp.addEventListener('click', () => {
        this.dom.helpModal.classList.add('hidden');
      });
    }

    // Time of day preset buttons
    if (this.dom.timePresetBtns) {
      this.dom.timePresetBtns.forEach(btn => {
        btn.addEventListener('click', e => {
          this.dom.timePresetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const timeVal = btn.getAttribute('data-time');
          let angle = 0;
          if (timeVal === 'dawn') angle = Math.PI * 0.05;
          else if (timeVal === 'noon') angle = Math.PI * 0.5;
          else if (timeVal === 'sunset') angle = Math.PI * 0.95;
          else if (timeVal === 'night') angle = Math.PI * 1.5;

          this.globe.setSunAngle(angle);
        });
      });
    }

    // Mouse flight steering handler
    window.addEventListener('mousemove', e => {
      if (!this.mouseFlightEnabled) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      // Deadzone in the center
      const deadzone = 0.08;
      if (Math.abs(nx) > deadzone) {
        this.aircraft.input.roll = (nx - Math.sign(nx) * deadzone) * 1.2;
      } else {
        this.aircraft.input.roll = 0;
      }
      if (Math.abs(ny) > deadzone) {
        this.aircraft.input.pitch = (ny - Math.sign(ny) * deadzone) * 1.2;
      } else {
        this.aircraft.input.pitch = 0;
      }
    });

    // Touch controls setup (virtual thumbsticks for mobile)
    this.initTouchControls();
  }

  initTouchControls() {
    const touchStick = document.getElementById('touch-stick-zone');
    const touchStickKnob = document.getElementById('touch-stick-knob');
    const touchBoost = document.getElementById('touch-boost-btn');
    const touchBrake = document.getElementById('touch-brake-btn');

    if (!touchStick || !touchStickKnob) return;

    let touchId = null;
    let startX = 0;
    let startY = 0;
    const maxRadius = 45;

    touchStick.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      const rect = touchStick.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    }, { passive: false });

    touchStick.addEventListener('touchmove', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          const clampedDist = Math.min(dist, maxRadius);

          const knobX = Math.cos(angle) * clampedDist;
          const knobY = Math.sin(angle) * clampedDist;

          touchStickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

          this.aircraft.input.roll = knobX / maxRadius;
          this.aircraft.input.pitch = knobY / maxRadius;
        }
      }
    }, { passive: false });

    const resetStick = e => {
      touchStickKnob.style.transform = 'translate(0px, 0px)';
      this.aircraft.input.roll = 0;
      this.aircraft.input.pitch = 0;
      touchId = null;
    };

    touchStick.addEventListener('touchend', resetStick);
    touchStick.addEventListener('touchcancel', resetStick);

    if (touchBoost) {
      touchBoost.addEventListener('touchstart', e => {
        e.preventDefault();
        this.aircraft.input.boost = true;
      });
      touchBoost.addEventListener('touchend', e => {
        e.preventDefault();
        this.aircraft.input.boost = false;
      });
    }

    if (touchBrake) {
      touchBrake.addEventListener('touchstart', e => {
        e.preventDefault();
        this.aircraft.input.brake = true;
      });
      touchBrake.addEventListener('touchend', e => {
        e.preventDefault();
        this.aircraft.input.brake = false;
      });
    }
  }

  populateLandmarkSelector() {
    if (!this.dom.landmarkSelect) return;
    this.dom.landmarkSelect.innerHTML = '';
    LANDMARKS.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.flag} ${l.name} (${l.location})`;
      this.dom.landmarkSelect.appendChild(opt);
    });
  }

  initRadarCanvas() {
    if (!this.dom.radarCanvas) return;
    this.radarCtx = this.dom.radarCanvas.getContext('2d');
  }

  showCelebration(landmarkInst, count, total) {
    if (!this.dom.celebrationModal) return;

    this.dom.celebrationTitle.textContent = `${landmarkInst.data.flag} ${landmarkInst.data.name}`;
    this.dom.celebrationLoc.textContent = landmarkInst.data.location;
    this.dom.celebrationFact.textContent = landmarkInst.data.funFact;
    this.dom.discoveredCount.textContent = `${count} / ${total}`;

    this.dom.celebrationModal.classList.remove('hidden');
    this.dom.celebrationModal.classList.add('animate-slide');

    // Auto dismiss after 6 seconds
    if (this.celebrationTimeout) clearTimeout(this.celebrationTimeout);
    this.celebrationTimeout = setTimeout(() => {
      this.dom.celebrationModal.classList.add('hidden');
    }, 6000);
  }

  showNotice(msg) {
    const banner = document.getElementById('hud-toast');
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 2800);
  }

  update(aircraft, nearestLandmark, nearestDistKm) {
    // 1. Airspeed & Altitude
    // speed is in game units (0.45 - 2.4) -> convert to knots: ~180 - 650 kts
    const knots = Math.round(aircraft.speed * 280);
    if (this.dom.speedVal) {
      this.dom.speedVal.textContent = knots;
    }
    if (this.dom.speedBar) {
      const pct = Math.min(100, Math.max(0, ((aircraft.speed - 0.45) / (2.4 - 0.45)) * 100));
      this.dom.speedBar.style.width = `${pct}%`;
    }

    // Altitude: units above surface * 1000 meters
    const altMeters = Math.round(aircraft.altitude * 850);
    if (this.dom.altVal) {
      this.dom.altVal.textContent = `${altMeters.toLocaleString()} M`;
    }

    // 2. Heading Tape
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quaternion).normalize();
    const headingDeg = computeHeadingDegrees(aircraft.position, forward);
    if (this.dom.headingTape) {
      this.dom.headingTape.style.transform = `translateX(${-headingDeg * 3}px)`;
    }

    // 3. Pitch Ladder Artificial Horizon
    const normal = aircraft.position.clone().normalize();
    const pitchAngle = Math.asin(Math.max(-1, Math.min(1, forward.dot(normal)))) * (180 / Math.PI);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quaternion).normalize();
    const rollAngle = Math.asin(Math.max(-1, Math.min(1, right.dot(normal)))) * (180 / Math.PI);

    if (this.dom.pitchLadder) {
      this.dom.pitchLadder.style.transform = `translateY(${pitchAngle * 4}px) rotate(${rollAngle}deg)`;
    }

    // 4. Nearest Waypoint Indicator
    if (nearestLandmark && this.dom.waypointTag) {
      this.dom.waypointTag.textContent = `${nearestLandmark.data.flag} ${nearestLandmark.data.name}`;
      this.dom.waypointDist.textContent = `${nearestDistKm.toLocaleString()} KM`;

      // Calculate bearing angle to nearest landmark on screen
      const dirToTarget = nearestLandmark.ringWorldPos.clone().sub(aircraft.position).normalize();
      const dotFwd = forward.dot(dirToTarget);
      const dotRight = right.dot(dirToTarget);
      const angleRad = Math.atan2(dotRight, dotFwd);
      const angleDeg = angleRad * (180 / Math.PI);

      if (this.dom.waypointArrow) {
        this.dom.waypointArrow.style.transform = `rotate(${angleDeg}deg)`;
      }
    }

    // 5. Draw Mini-Globe Radar
    this.drawRadar(aircraft);
  }

  drawRadar(aircraft) {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.44;

    ctx.clearRect(0, 0, w, h);

    // Radar circular globe background
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 20, 36, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Concentric range rings
    [0.35, 0.7].forEach(ratio => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.stroke();

    // Map latitude and longitude to radar
    // We project the hemisphere visible from the aircraft's current location!
    const planePosNorm = aircraft.position.clone().normalize();
    const planeForward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quaternion).normalize();
    const planeRight = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quaternion).normalize();
    const planeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quaternion).normalize();

    // Draw landmarks on radar
    this.checkpointSystem.landmarkBuilder.landmarkInstances.forEach(inst => {
      const instNorm = inst.ringWorldPos.clone().normalize();
      const dot = planePosNorm.dot(instNorm);

      // Only show landmarks on this hemisphere (dot > 0)
      if (dot > -0.1) {
        // Project onto tangent plane relative to aircraft heading
        const diff = inst.ringWorldPos.clone().sub(aircraft.position);
        const relFwd = diff.dot(planeForward);
        const relRight = diff.dot(planeRight);

        // Normalize to radar scale
        const radarScale = 0.005;
        let rx = cx + relRight * radarScale;
        let ry = cy - relFwd * radarScale;

        // Clamp to radar radius
        const d = Math.hypot(rx - cx, ry - cy);
        if (d > r - 4) {
          rx = cx + ((rx - cx) / d) * (r - 4);
          ry = cy + ((ry - cy) / d) * (r - 4);
        }

        ctx.beginPath();
        ctx.arc(rx, ry, inst.visited ? 3.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = inst.visited ? '#10b981' : inst.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Draw Player Aircraft Symbol at Center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}
