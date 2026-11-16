import * as THREE from 'three';
import type { AircraftVariant, CameraMode } from '../core/constants.ts';
import {
  computeBearingDegrees,
  formatLatLon,
  greatCircleAngle,
  normalizeSignedAngle,
} from '../core/geo.ts';
import type { FlightTelemetry } from '../flight/FlightController.ts';
import type { CheckpointInstance } from '../landmarks/CheckpointSystem.ts';
import type { LandmarkDefinition } from '../landmarks/landmarksData.ts';

export interface HudActions {
  onSelectTarget: (id: string) => void;
  onJumpToLandmark: (def: LandmarkDefinition) => void;
  onSelectAircraft: (variant: AircraftVariant) => void;
  onCycleCamera: () => void;
  onToggleAutopilot: () => void;
  onToggleInvertPitch: () => void;
  onToggleAudio: () => void;
  onSunAngleChange: (angleRad: number) => void;
  onToggleAutoSun: () => void;
}

const CARDINAL_POINTS: Array<{ deg: number; label: string; cardinal: boolean }> = [
  { deg: 0, label: 'N', cardinal: true },
  { deg: 45, label: 'NE', cardinal: false },
  { deg: 90, label: 'E', cardinal: true },
  { deg: 135, label: 'SE', cardinal: false },
  { deg: 180, label: 'S', cardinal: true },
  { deg: 225, label: 'SW', cardinal: false },
  { deg: 270, label: 'W', cardinal: true },
  { deg: 315, label: 'NW', cardinal: false },
];

/**
 * Manages the glassmorphic aviation HUD, live compass tape, screen-space
 * checkpoint guide indicator, collapsible world landmarks drawer, and discovery toasts.
 */
export class HudController {
  private readonly root: HTMLDivElement;
  private readonly progressEl: HTMLElement;
  private readonly compassTrackEl: HTMLElement;
  private readonly targetNameEl: HTMLElement;
  private readonly targetDistEl: HTMLElement;
  private readonly speedEl: HTMLElement;
  private readonly altEl: HTMLElement;
  private readonly coordsEl: HTMLElement;
  private readonly drawerEl: HTMLElement;
  private readonly screenMarkerEl: HTMLElement;
  private readonly markerLabelEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly toastEyebrowEl: HTMLElement;
  private readonly toastTitleEl: HTMLElement;
  private readonly toastFactEl: HTMLElement;

  private readonly btnAutopilot: HTMLButtonElement;
  private readonly btnCamera: HTMLButtonElement;
  private readonly btnBiplane: HTMLButtonElement;
  private readonly btnJet: HTMLButtonElement;
  private readonly btnInvert: HTMLButtonElement;
  private readonly btnAudio: HTMLButtonElement;
  private readonly btnAutoSun: HTMLButtonElement;
  private readonly sunSliderEl: HTMLInputElement;

  private readonly tickEls: HTMLElement[] = [];
  private readonly pipEls = new Map<string, HTMLElement>();
  private readonly poiItemEls = new Map<string, HTMLElement>();

  private toastTimer = 0;
  private drawerOpen = true;
  private readonly projVec = new THREE.Vector3();

  constructor(
    container: HTMLElement,
    checkpoints: CheckpointInstance[],
    actions: HudActions
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud-layer';

    this.root.innerHTML = `
      <div class="hud-top-left">
        <div class="hud-panel brand-card">
          <div class="brand-row">
            <span class="brand-title">TerraWings</span>
            <span class="progress-pill" id="hud-progress">0 / ${checkpoints.length}</span>
          </div>
          <div class="sun-controls">
            <span>Sun</span>
            <input type="range" id="hud-sun-slider" min="0" max="6.283" step="0.01" value="0.9" />
            <button class="icon-btn" id="hud-auto-sun" title="Toggle Day/Night Orbit">Auto</button>
            <button class="icon-btn" id="hud-audio" title="Toggle Sound">Sound Off</button>
          </div>
        </div>
      </div>

      <div class="hud-top-center">
        <div class="hud-panel compass-bar">
          <div class="compass-center-mark"></div>
          <div class="compass-track" id="hud-compass-track"></div>
        </div>
        <div class="hud-panel target-chip">
          <span class="target-name" id="hud-target-name">Eiffel Tower</span>
          <span class="target-dist" id="hud-target-dist">0 km</span>
          <button class="icon-btn" id="hud-autopilot" title="Autopilot to active target (P)">Auto-Fly [P]</button>
        </div>
      </div>

      <div class="hud-top-right">
        <button class="hud-panel icon-btn drawer-toggle" id="hud-drawer-toggle">
          <span>Checkpoints</span>
          <span id="hud-drawer-arrow">Hide</span>
        </button>
        <div class="hud-panel poi-drawer" id="hud-poi-drawer"></div>
      </div>

      <div class="hud-panel hud-bottom-left">
        <div class="telem-stat">
          <span class="telem-label">Airspeed</span>
          <span class="telem-value" id="hud-speed">0 km/h</span>
        </div>
        <div class="telem-stat">
          <span class="telem-label">Altitude AGL</span>
          <span class="telem-value" id="hud-alt">0 m</span>
        </div>
        <div class="telem-stat">
          <span class="telem-label">Position</span>
          <span class="telem-value" id="hud-coords">0.00° N, 0.00° E</span>
        </div>
      </div>

      <div class="hud-bottom-right">
        <div class="hud-panel controls-bar">
          <button class="icon-btn active" id="hud-plane-biplane">Biplane</button>
          <button class="icon-btn" id="hud-plane-jet">Jet</button>
          <button class="icon-btn" id="hud-camera">Cam: Chase [C]</button>
          <button class="icon-btn" id="hud-invert">Pitch: Arcade</button>
        </div>
        <div class="hud-panel keybinds-strip">
          <span><span class="key-cap">W A S D</span> / Arrows Fly</span>
          <span><span class="key-cap">Shift</span> Boost</span>
          <span><span class="key-cap">Space</span> Slow</span>
          <span><span class="key-cap">Drag</span> Look</span>
          <span><span class="key-cap">Scroll</span> Zoom</span>
        </div>
      </div>

      <div class="poi-screen-marker" id="hud-screen-marker">
        <span class="poi-marker-dot"></span>
        <span id="hud-marker-label">Eiffel Tower</span>
      </div>

      <div class="discovery-toast" id="hud-toast">
        <div class="toast-eyebrow" id="hud-toast-eyebrow">Checkpoint Cleared</div>
        <div class="toast-title" id="hud-toast-title">Eiffel Tower</div>
        <div class="toast-fact" id="hud-toast-fact"></div>
      </div>
    `;

    container.appendChild(this.root);

    this.progressEl = this.root.querySelector('#hud-progress')!;
    this.compassTrackEl = this.root.querySelector('#hud-compass-track')!;
    this.targetNameEl = this.root.querySelector('#hud-target-name')!;
    this.targetDistEl = this.root.querySelector('#hud-target-dist')!;
    this.speedEl = this.root.querySelector('#hud-speed')!;
    this.altEl = this.root.querySelector('#hud-alt')!;
    this.coordsEl = this.root.querySelector('#hud-coords')!;
    this.drawerEl = this.root.querySelector('#hud-poi-drawer')!;
    this.screenMarkerEl = this.root.querySelector('#hud-screen-marker')!;
    this.markerLabelEl = this.root.querySelector('#hud-marker-label')!;
    this.toastEl = this.root.querySelector('#hud-toast')!;
    this.toastEyebrowEl = this.root.querySelector('#hud-toast-eyebrow')!;
    this.toastTitleEl = this.root.querySelector('#hud-toast-title')!;
    this.toastFactEl = this.root.querySelector('#hud-toast-fact')!;

    this.btnAutopilot = this.root.querySelector('#hud-autopilot')!;
    this.btnCamera = this.root.querySelector('#hud-camera')!;
    this.btnBiplane = this.root.querySelector('#hud-plane-biplane')!;
    this.btnJet = this.root.querySelector('#hud-plane-jet')!;
    this.btnInvert = this.root.querySelector('#hud-invert')!;
    this.btnAudio = this.root.querySelector('#hud-audio')!;
    this.btnAutoSun = this.root.querySelector('#hud-auto-sun')!;
    this.sunSliderEl = this.root.querySelector('#hud-sun-slider')!;

    const drawerToggle = this.root.querySelector('#hud-drawer-toggle') as HTMLButtonElement;
    const drawerArrow = this.root.querySelector('#hud-drawer-arrow') as HTMLElement;

    drawerToggle.addEventListener('click', () => {
      this.drawerOpen = !this.drawerOpen;
      this.drawerEl.classList.toggle('collapsed', !this.drawerOpen);
      drawerArrow.textContent = this.drawerOpen ? 'Hide' : 'Show';
    });

    // Build compass ticks & POI pips
    for (const c of CARDINAL_POINTS) {
      const tick = document.createElement('div');
      tick.className = `compass-tick${c.cardinal ? ' cardinal' : ''}`;
      tick.textContent = c.label;
      this.compassTrackEl.appendChild(tick);
      this.tickEls.push(tick);
    }

    for (const cp of checkpoints) {
      const pip = document.createElement('div');
      pip.className = 'compass-poi-pip';
      pip.title = cp.definition.name;
      this.compassTrackEl.appendChild(pip);
      this.pipEls.set(cp.definition.id, pip);

      // Build checkpoint drawer item
      const item = document.createElement('div');
      item.className = 'poi-item';
      item.innerHTML = `
        <div class="poi-meta">
          <div class="poi-title">${cp.definition.name}</div>
          <div class="poi-sub">${cp.definition.city}, ${cp.definition.country}</div>
        </div>
        <div class="poi-actions">
          <button class="mini-btn" data-action="track">Track</button>
          <button class="mini-btn" data-action="fly">Fly Here</button>
        </div>
      `;
      const trackBtn = item.querySelector('[data-action="track"]') as HTMLButtonElement;
      const flyBtn = item.querySelector('[data-action="fly"]') as HTMLButtonElement;
      trackBtn.addEventListener('click', () => actions.onSelectTarget(cp.definition.id));
      flyBtn.addEventListener('click', () => actions.onJumpToLandmark(cp.definition));

      this.drawerEl.appendChild(item);
      this.poiItemEls.set(cp.definition.id, item);
    }

    this.btnAutopilot.addEventListener('click', actions.onToggleAutopilot);
    this.btnCamera.addEventListener('click', actions.onCycleCamera);
    this.btnBiplane.addEventListener('click', () => actions.onSelectAircraft('biplane'));
    this.btnJet.addEventListener('click', () => actions.onSelectAircraft('jet'));
    this.btnInvert.addEventListener('click', actions.onToggleInvertPitch);
    this.btnAudio.addEventListener('click', actions.onToggleAudio);
    this.btnAutoSun.addEventListener('click', actions.onToggleAutoSun);
    this.sunSliderEl.addEventListener('input', () => {
      actions.onSunAngleChange(parseFloat(this.sunSliderEl.value));
    });
  }

  /**
   * Displays the discovery toast notification for a cleared checkpoint.
   *
   * @param def - Discovered landmark definition.
   * @param discoveredCount - Total discovered checkpoints so far.
   * @param totalCount - Total checkpoints in the world.
   */
  public showDiscoveryToast(
    def: LandmarkDefinition,
    discoveredCount: number,
    totalCount: number
  ): void {
    const allCleared = discoveredCount === totalCount;
    this.toastEyebrowEl.textContent = allCleared
      ? `All ${totalCount} Landmarks Discovered`
      : `Checkpoint Cleared · ${discoveredCount} / ${totalCount}`;
    this.toastTitleEl.textContent = `${def.name} · ${def.city}, ${def.country}`;
    this.toastFactEl.textContent = def.fact;
    this.toastEl.classList.add('visible');
    this.toastTimer = 4.6;
  }

  /**
   * Syncs audio button label state.
   *
   * @param enabled - Whether audio is unmuted.
   */
  public setAudioState(enabled: boolean): void {
    this.btnAudio.textContent = enabled ? 'Sound On' : 'Sound Off';
    this.btnAudio.classList.toggle('active', enabled);
  }

  /**
   * Syncs auto-sun orbit button and slider state.
   *
   * @param autoSun - Whether automatic day/night cycle is enabled.
   * @param sunAngle - Current solar azimuth angle in radians.
   */
  public setSunState(autoSun: boolean, sunAngle: number): void {
    this.btnAutoSun.classList.toggle('active', autoSun);
    const wrapped = ((sunAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    this.sunSliderEl.value = wrapped.toFixed(2);
  }

  /**
   * Updates all dynamic HUD telemetry, compass tape ticks, checkpoint drawer
   * states, and the screen-space active target indicator each frame.
   *
   * @param dt - Frame delta time in seconds.
   * @param telemetry - Current aircraft flight telemetry.
   * @param checkpoints - Array of all world checkpoint instances.
   * @param activeTarget - Currently tracked checkpoint.
   * @param aircraftPos - Current aircraft world position.
   * @param camera - Active camera for screen-space target projection.
   */
  public update(
    dt: number,
    telemetry: FlightTelemetry,
    checkpoints: CheckpointInstance[],
    activeTarget: CheckpointInstance,
    aircraftPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera
  ): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastEl.classList.remove('visible');
      }
    }

    // Telemetry updates
    this.speedEl.textContent = `${telemetry.speedKmh} km/h`;
    this.speedEl.classList.toggle('boost', telemetry.boost);
    this.altEl.textContent = `${telemetry.altitudeMeters.toLocaleString()} m`;
    this.coordsEl.textContent = formatLatLon(telemetry.lat, telemetry.lon);

    const discoveredCount = checkpoints.filter((c) => c.discovered).length;
    this.progressEl.textContent = `${discoveredCount} / ${checkpoints.length}`;

    this.btnAutopilot.classList.toggle('active', telemetry.autopilot);
    this.btnAutopilot.textContent = telemetry.autopilot ? 'Auto-Fly: ON [P]' : 'Auto-Fly [P]';

    const camNames: Record<CameraMode, string> = {
      chase: 'Chase',
      cinematic: 'Orbit',
      cockpit: 'Cockpit',
    };
    this.btnCamera.textContent = `Cam: ${camNames[telemetry.cameraMode]} [C]`;
    this.btnBiplane.classList.toggle('active', telemetry.variant === 'biplane');
    this.btnJet.classList.toggle('active', telemetry.variant === 'jet');
    this.btnInvert.textContent = telemetry.invertPitch ? 'Pitch: Sim' : 'Pitch: Arcade';
    this.btnInvert.classList.toggle('active', telemetry.invertPitch);

    // Compass tape positioning (visible FOV window = +-75 deg)
    const fovWindowDeg = 75;
    CARDINAL_POINTS.forEach((c, idx) => {
      const diff = normalizeSignedAngle(c.deg - telemetry.headingDeg);
      const el = this.tickEls[idx];
      if (Math.abs(diff) > fovWindowDeg) {
        el.style.display = 'none';
      } else {
        el.style.display = 'block';
        el.style.left = `${50 + (diff / fovWindowDeg) * 48}%`;
      }
    });

    for (const cp of checkpoints) {
      const pip = this.pipEls.get(cp.definition.id);
      if (pip) {
        const bearing = computeBearingDegrees(
          telemetry.lat,
          telemetry.lon,
          cp.definition.lat,
          cp.definition.lon
        );
        const diff = normalizeSignedAngle(bearing - telemetry.headingDeg);
        const clampedDiff = THREE.MathUtils.clamp(diff, -fovWindowDeg, fovWindowDeg);
        pip.style.left = `${50 + (clampedDiff / fovWindowDeg) * 48}%`;
        pip.classList.toggle('discovered', cp.discovered);
        pip.classList.toggle('target', cp.definition.id === activeTarget.definition.id);
      }

      const item = this.poiItemEls.get(cp.definition.id);
      if (item) {
        item.classList.toggle('discovered', cp.discovered);
        item.classList.toggle('active', cp.definition.id === activeTarget.definition.id);
      }
    }

    // Active target chip & distance
    const aircraftNormal = aircraftPos.clone().normalize();
    const angle = greatCircleAngle(aircraftNormal, activeTarget.unitNormal);
    const distKm = Math.round(angle * 6371);
    const worldDist = angle * 120;
    this.targetNameEl.textContent = `${activeTarget.definition.name}`;
    this.targetDistEl.textContent = `${distKm.toLocaleString()} km`;

    // Screen-space waypoint marker for active checkpoint
    activeTarget.ringGroup.getWorldPosition(this.projVec);
    this.projVec.project(camera);

    const behindCamera = this.projVec.z > 1;
    let sx = (this.projVec.x * 0.5 + 0.5) * window.innerWidth;
    let sy = (-this.projVec.y * 0.5 + 0.5) * window.innerHeight;

    if (behindCamera) {
      sx = window.innerWidth - sx;
      sy = window.innerHeight - sy;
    }

    const pad = 44;
    const isOffscreen =
      behindCamera ||
      sx < pad ||
      sx > window.innerWidth - pad ||
      sy < pad ||
      sy > window.innerHeight - pad;

    if (isOffscreen) {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      const dx = sx - cx;
      const dy = sy - cy;
      const maxX = cx - pad;
      const maxY = cy - pad;
      const scale = Math.min(
        maxX / Math.max(1e-4, Math.abs(dx)),
        maxY / Math.max(1e-4, Math.abs(dy))
      );
      sx = cx + dx * scale;
      sy = cy + dy * scale;
    }

    // Hide screen marker once landmark is close on-screen so 3D monument stays crisp
    const closeFade = isOffscreen
      ? 0.92
      : THREE.MathUtils.smoothstep(worldDist, 20.0, 32.0);
    this.screenMarkerEl.style.opacity = `${closeFade.toFixed(2)}`;
    this.screenMarkerEl.style.left = `${sx}px`;
    this.screenMarkerEl.style.top = `${isOffscreen ? sy : Math.max(82, sy - 26)}px`;
    this.markerLabelEl.textContent = `${activeTarget.definition.name} · ${distKm.toLocaleString()} km`;
  }
}
