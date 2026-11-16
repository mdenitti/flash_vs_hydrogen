import * as THREE from 'three';
import {
  type AircraftVariant,
  BOOST_SPEED,
  type CameraMode,
  CRUISE_SPEED,
  DEFAULT_ALTITUDE,
  GLOBE_RADIUS,
  KM_PER_UNIT,
  MAX_ALTITUDE,
  MIN_ALTITUDE_CLEARANCE,
  MIN_SPEED,
} from '../core/constants.ts';
import {
  computeCompassHeading,
  getLocalTangentBasis,
  greatCircleAngle,
  latLonToVector3,
  vector3ToLatLon,
} from '../core/geo.ts';
import type { LandmarkDefinition } from '../landmarks/landmarksData.ts';
import {
  type BuiltAircraft,
  createAircraftModel,
  WingtipContrails,
} from './AircraftModels.ts';

export interface FlightTelemetry {
  lat: number;
  lon: number;
  headingDeg: number;
  altitudeUnits: number;
  altitudeMeters: number;
  speedKmh: number;
  speedNorm: number;
  boost: boolean;
  autopilot: boolean;
  cameraMode: CameraMode;
  variant: AircraftVariant;
  invertPitch: boolean;
}

/**
 * Pure, gimbal-lock-free spherical tangent-frame flight step using quaternion
 * parallel transport along great circles.
 *
 * @param unitNormal - Current radial outward normal from globe center (mutated in place).
 * @param forwardTangent - Current forward tangent direction (mutated in place).
 * @param altitude - Current altitude above GLOBE_RADIUS.
 * @param speed - Forward airspeed in world units/sec.
 * @param pitchAngle - Aircraft pitch angle in radians (+ = climb).
 * @param turnRate - Angular yaw rate in radians/sec (+ = turn right).
 * @param dt - Time step in seconds.
 * @param minAltitude - Minimum allowed altitude (terrain clearance).
 * @returns Updated clamped altitude above GLOBE_RADIUS.
 */
export function stepSphericalFlight(
  unitNormal: THREE.Vector3,
  forwardTangent: THREE.Vector3,
  altitude: number,
  speed: number,
  pitchAngle: number,
  turnRate: number,
  dt: number,
  minAltitude: number
): number {
  unitNormal.normalize();
  forwardTangent
    .addScaledVector(unitNormal, -forwardTangent.dot(unitNormal))
    .normalize();

  // Apply yaw around local surface normal (negative angle = clockwise / right turn)
  if (Math.abs(turnRate) > 1e-6) {
    forwardTangent.applyAxisAngle(unitNormal, -turnRate * dt).normalize();
  }

  // Parallel transport along great-circle arc around left tangent axis
  const horizSpeed = Math.cos(pitchAngle) * speed;
  const radius = GLOBE_RADIUS + altitude;
  const arcAngle = (horizSpeed * dt) / Math.max(1, radius);

  const leftAxis = new THREE.Vector3().crossVectors(unitNormal, forwardTangent);
  if (leftAxis.lengthSq() > 1e-8) {
    leftAxis.normalize();
    unitNormal.applyAxisAngle(leftAxis, arcAngle).normalize();
    forwardTangent.applyAxisAngle(leftAxis, arcAngle);
    // Re-orthogonalize to prevent numerical drift
    forwardTangent
      .addScaledVector(unitNormal, -forwardTangent.dot(unitNormal))
      .normalize();
  }

  const nextAlt = altitude + Math.sin(pitchAngle) * speed * dt;
  return THREE.MathUtils.clamp(nextAlt, minAltitude, MAX_ALTITUDE);
}

/**
 * Manages aircraft flight physics, keyboard/pointer inputs, autopilot navigation,
 * aircraft model swapping, contrails, and smooth chase/cinematic/cockpit cameras.
 */
export class FlightController {
  public readonly rootGroup = new THREE.Group();
  public readonly contrails = new WingtipContrails();

  public unitNormal = new THREE.Vector3();
  public forwardTangent = new THREE.Vector3();
  public altitude = DEFAULT_ALTITUDE;
  public speed = CRUISE_SPEED;
  public pitchAngle = 0;
  public bankAngle = 0;

  private aircraft: BuiltAircraft;
  private variant: AircraftVariant = 'biplane';
  private cameraMode: CameraMode = 'chase';
  private invertPitch = false;
  private autopilot = false;

  private readonly keys = new Set<string>();
  private pointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private orbitYawOffset = 0;
  private orbitPitchOffset = 0.22;
  private orbitZoom = 1.0;
  private orbitIdleTimer = 0;

  private readonly camLookAtCurrent = new THREE.Vector3();
  private readonly camPosCurrent = new THREE.Vector3();
  private camInitialized = false;

  private readonly worldPos = new THREE.Vector3();
  private readonly leftTipWorld = new THREE.Vector3();
  private readonly rightTipWorld = new THREE.Vector3();

  private readonly getSurfaceRadius: (lat: number, lon: number) => number;
  private readonly onUserInteract?: () => void;

  constructor(
    domElement: HTMLElement,
    getSurfaceRadius: (lat: number, lon: number) => number,
    onUserInteract?: () => void
  ) {
    this.getSurfaceRadius = getSurfaceRadius;
    this.onUserInteract = onUserInteract;

    this.aircraft = createAircraftModel(this.variant);
    this.rootGroup.add(this.aircraft.group);

    // Spawn just southwest of Paris facing northeast toward Eiffel Tower & Europe
    this.setLocationAndHeading(45.9, -0.4, 40, DEFAULT_ALTITUDE);
    this.bindEvents(domElement);
  }

  /**
   * Positions the aircraft at a geographic coordinate, compass heading, and altitude.
   *
   * @param latDeg - Latitude in degrees.
   * @param lonDeg - Longitude in degrees.
   * @param headingDeg - Initial compass heading in degrees (0=N, 90=E).
   * @param altitude - Altitude above sea level.
   */
  public setLocationAndHeading(
    latDeg: number,
    lonDeg: number,
    headingDeg: number,
    altitude: number
  ): void {
    this.unitNormal.copy(latLonToVector3(latDeg, lonDeg, 1)).normalize();
    const { east, north } = getLocalTangentBasis(this.unitNormal);
    const rad = THREE.MathUtils.degToRad(headingDeg);
    this.forwardTangent
      .set(0, 0, 0)
      .addScaledVector(north, Math.cos(rad))
      .addScaledVector(east, Math.sin(rad))
      .normalize();

    const groundAlt = this.getSurfaceRadius(latDeg, lonDeg) - GLOBE_RADIUS;
    this.altitude = Math.max(altitude, groundAlt + MIN_ALTITUDE_CLEARANCE);
    this.pitchAngle = 0;
    this.bankAngle = 0;
    this.contrails.reset();
    this.syncAircraftTransform();
    this.camInitialized = false;
  }

  /**
   * Repositions the aircraft onto a dramatic 1.4-second scenic approach vector
   * aimed directly at the selected landmark checkpoint.
   *
   * @param landmark - Target landmark definition.
   */
  public jumpToApproach(landmark: LandmarkDefinition): void {
    // Place aircraft ~16 units SW/SE of landmark so it faces toward the monument & sun
    const approachLat = THREE.MathUtils.clamp(landmark.lat - 4.6, -82, 82);
    const approachLon = landmark.lon - 5.2;
    const targetPos = latLonToVector3(landmark.lat, landmark.lon, 1).normalize();
    const startPos = latLonToVector3(approachLat, approachLon, 1).normalize();

    this.unitNormal.copy(startPos);
    // Tangent forward vector pointing straight toward landmark along great circle
    this.forwardTangent
      .copy(targetPos)
      .addScaledVector(startPos, -targetPos.dot(startPos))
      .normalize();

    const groundAlt = this.getSurfaceRadius(approachLat, approachLon) - GLOBE_RADIUS;
    this.altitude = Math.max(landmark.ringAltitude + 0.5, groundAlt + MIN_ALTITUDE_CLEARANCE + 1.2);
    this.speed = CRUISE_SPEED;
    this.pitchAngle = 0;
    this.bankAngle = 0;
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0.22;
    this.contrails.reset();
    this.syncAircraftTransform();
    this.camInitialized = false;
  }

  /**
   * Switches between classic biplane and expedition supersonic jet.
   *
   * @param nextVariant - Target aircraft variant.
   */
  public setVariant(nextVariant: AircraftVariant): void {
    if (this.variant === nextVariant) return;
    this.variant = nextVariant;
    this.rootGroup.remove(this.aircraft.group);
    this.aircraft = createAircraftModel(nextVariant);
    this.rootGroup.add(this.aircraft.group);
    this.contrails.reset();
  }

  /**
   * Cycles or sets the active camera perspective ('chase' | 'cinematic' | 'cockpit').
   *
   * @param mode - Optional explicit CameraMode; cycles if omitted.
   * @returns Active CameraMode.
   */
  public setCameraMode(mode?: CameraMode): CameraMode {
    const order: CameraMode[] = ['chase', 'cinematic', 'cockpit'];
    if (mode) {
      this.cameraMode = mode;
    } else {
      const idx = (order.indexOf(this.cameraMode) + 1) % order.length;
      this.cameraMode = order[idx];
    }
    this.aircraft.group.visible = this.cameraMode !== 'cockpit';
    this.orbitYawOffset = 0;
    return this.cameraMode;
  }

  /**
   * Toggles inverted pitch controls (flight-sim style vs arcade climb).
   *
   * @param next - Optional explicit boolean.
   * @returns Current invertPitch state.
   */
  public toggleInvertPitch(next?: boolean): boolean {
    this.invertPitch = next ?? !this.invertPitch;
    return this.invertPitch;
  }

  /**
   * Enables or disables smooth autopilot steering toward the active checkpoint.
   *
   * @param next - Optional explicit boolean.
   * @returns Current autopilot state.
   */
  public setAutopilot(next?: boolean): boolean {
    this.autopilot = next ?? !this.autopilot;
    return this.autopilot;
  }

  /**
   * Returns current world-space position of the aircraft.
   *
   * @returns Cloned world position Vector3.
   */
  public getWorldPosition(): THREE.Vector3 {
    return this.worldPos.copy(this.unitNormal).multiplyScalar(GLOBE_RADIUS + this.altitude);
  }

  /**
   * Computes current flight telemetry snapshot for HUD rendering.
   *
   * @returns FlightTelemetry object.
   */
  public getTelemetry(): FlightTelemetry {
    const pos = this.getWorldPosition();
    const { lat, lon } = vector3ToLatLon(pos);
    const groundAlt = this.getSurfaceRadius(lat, lon) - GLOBE_RADIUS;
    const agl = Math.max(0, this.altitude - groundAlt);
    const headingDeg = computeCompassHeading(this.unitNormal, this.forwardTangent);
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    return {
      lat,
      lon,
      headingDeg,
      altitudeUnits: agl,
      altitudeMeters: Math.round(agl * 420),
      speedKmh: Math.round(this.speed * KM_PER_UNIT * 4.2),
      speedNorm: THREE.MathUtils.clamp(
        (this.speed - MIN_SPEED) / (BOOST_SPEED - MIN_SPEED),
        0,
        1
      ),
      boost,
      autopilot: this.autopilot,
      cameraMode: this.cameraMode,
      variant: this.variant,
      invertPitch: this.invertPitch,
    };
  }

  /**
   * Registers keyboard, mouse drag orbit, and scroll zoom event listeners.
   */
  private bindEvents(domElement: HTMLElement): void {
    window.addEventListener('keydown', (e) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      this.onUserInteract?.();
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    domElement.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.orbitIdleTimer = 0;
      this.onUserInteract?.();
    });

    window.addEventListener('pointerup', () => {
      this.pointerDown = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.pointerDown) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      this.orbitYawOffset -= dx * 0.0065;
      this.orbitPitchOffset = THREE.MathUtils.clamp(
        this.orbitPitchOffset + dy * 0.005,
        -0.12,
        1.15
      );
      this.orbitIdleTimer = 0;
    });

    domElement.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.orbitZoom = THREE.MathUtils.clamp(
          this.orbitZoom + e.deltaY * 0.0011,
          0.55,
          2.6
        );
      },
      { passive: false }
    );
  }

  /**
   * Advances flight physics, autopilot steering, contrails, and camera tracking.
   *
   * @param dt - Frame delta time in seconds.
   * @param elapsed - Total elapsed time in seconds.
   * @param camera - Active Three.js PerspectiveCamera to update.
   * @param activeTarget - Currently tracked checkpoint landmark for autopilot guidance.
   */
  public update(
    dt: number,
    elapsed: number,
    camera: THREE.PerspectiveCamera,
    activeTarget?: LandmarkDefinition
  ): void {
    const safeDt = Math.min(dt, 0.05);

    let turnInput = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) turnInput -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) turnInput += 1;

    let pitchInput = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) pitchInput += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) pitchInput -= 1;
    if (this.invertPitch) pitchInput = -pitchInput;

    // Manual steering automatically cancels autopilot if player grabs stick
    if (turnInput !== 0 || pitchInput !== 0) {
      this.autopilot = false;
    }

    // Autopilot steering smoothly guides toward active checkpoint
    if (this.autopilot && activeTarget) {
      const targetNormal = latLonToVector3(activeTarget.lat, activeTarget.lon, 1).normalize();
      const toTarget = targetNormal
        .clone()
        .addScaledVector(this.unitNormal, -targetNormal.dot(this.unitNormal));

      if (toTarget.lengthSq() > 1e-6) {
        toTarget.normalize();
        const right = new THREE.Vector3()
          .crossVectors(this.forwardTangent, this.unitNormal)
          .normalize();
        const forwardDot = this.forwardTangent.dot(toTarget);
        const rightDot = right.dot(toTarget);
        const angleErr = Math.atan2(rightDot, forwardDot);
        turnInput = THREE.MathUtils.clamp(angleErr * 2.2, -1, 1);
      }

      const desiredAlt = activeTarget.ringAltitude;
      const altErr = desiredAlt - this.altitude;
      pitchInput = THREE.MathUtils.clamp(altErr * 0.35, -0.75, 0.75);

      const distAngle = greatCircleAngle(this.unitNormal, targetNormal);
      if (distAngle * GLOBE_RADIUS < 3.2) {
        this.autopilot = false;
      }
    }

    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const brake = this.keys.has('Space');
    const targetSpeed = boost
      ? BOOST_SPEED
      : brake
        ? MIN_SPEED
        : this.variant === 'jet'
          ? CRUISE_SPEED * 1.25
          : CRUISE_SPEED;

    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, 1 - Math.exp(-safeDt * 4.5));

    const maxPitch = 0.62;
    const targetPitch = pitchInput * maxPitch;
    this.pitchAngle = THREE.MathUtils.lerp(
      this.pitchAngle,
      targetPitch,
      1 - Math.exp(-safeDt * 6.0)
    );

    const targetBank = turnInput * 0.78;
    this.bankAngle = THREE.MathUtils.lerp(
      this.bankAngle,
      targetBank,
      1 - Math.exp(-safeDt * 7.0)
    );

    const turnRate = turnInput * (this.variant === 'jet' ? 1.45 : 1.25);

    const posBefore = this.getWorldPosition();
    const { lat, lon } = vector3ToLatLon(posBefore);
    const groundAlt = this.getSurfaceRadius(lat, lon) - GLOBE_RADIUS;
    const minAlt = groundAlt + MIN_ALTITUDE_CLEARANCE;

    this.altitude = stepSphericalFlight(
      this.unitNormal,
      this.forwardTangent,
      this.altitude,
      this.speed,
      this.pitchAngle,
      turnRate,
      safeDt,
      minAlt
    );

    // Smooth auto-flatten pitch if near terrain floor
    if (this.altitude <= minAlt + 0.08 && this.pitchAngle < 0) {
      this.pitchAngle *= 0.85;
    }

    this.syncAircraftTransform();

    // Animate aircraft model & contrails
    const speedNorm = THREE.MathUtils.clamp(
      (this.speed - MIN_SPEED) / (BOOST_SPEED - MIN_SPEED),
      0,
      1
    );
    this.aircraft.update(safeDt, elapsed, speedNorm, boost, this.bankAngle);

    this.aircraft.group.localToWorld(
      this.leftTipWorld.copy(this.aircraft.leftWingtipLocal)
    );
    this.aircraft.group.localToWorld(
      this.rightTipWorld.copy(this.aircraft.rightWingtipLocal)
    );
    this.contrails.update(safeDt, this.leftTipWorld, this.rightTipWorld, boost);

    this.updateCamera(safeDt, camera, boost);
  }

  /**
   * Aligns aircraft rootGroup to the local spherical tangent frame + pitch & bank angles.
   */
  private syncAircraftTransform(): void {
    const pos = this.getWorldPosition();
    this.rootGroup.position.copy(pos);

    const right = new THREE.Vector3()
      .crossVectors(this.forwardTangent, this.unitNormal)
      .normalize();
    const back = this.forwardTangent.clone().negate();

    const basis = new THREE.Matrix4().makeBasis(right, this.unitNormal, back);
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(basis);

    // Local pitch (+X) and bank roll (-Z for right wing down when banking right)
    const localRot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitchAngle, 0, -this.bankAngle, 'YXZ')
    );
    this.rootGroup.quaternion.copy(baseQuat).multiply(localRot);
  }

  /**
   * Updates camera position, lookAt, up vector, and speed FOV smoothly.
   */
  private updateCamera(
    dt: number,
    camera: THREE.PerspectiveCamera,
    boost: boolean
  ): void {
    const planePos = this.getWorldPosition();
    const right = new THREE.Vector3()
      .crossVectors(this.forwardTangent, this.unitNormal)
      .normalize();

    if (!this.pointerDown) {
      this.orbitIdleTimer += dt;
      if (this.orbitIdleTimer > 1.8) {
        this.orbitYawOffset = THREE.MathUtils.lerp(
          this.orbitYawOffset,
          0,
          1 - Math.exp(-dt * 2.2)
        );
      }
    }

    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();

    if (this.cameraMode === 'cockpit') {
      desiredPos
        .copy(planePos)
        .addScaledVector(this.unitNormal, 0.35)
        .addScaledVector(this.forwardTangent, 0.35);
      desiredLook
        .copy(planePos)
        .addScaledVector(this.forwardTangent, 12.0)
        .addScaledVector(this.unitNormal, Math.sin(this.pitchAngle) * 10.0 - 0.8);
      camera.position.copy(desiredPos);
      camera.up.copy(this.unitNormal);
      camera.lookAt(desiredLook);
      const targetFov = boost ? 68 : 60;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 6));
      camera.updateProjectionMatrix();
      this.camInitialized = false;
      return;
    }

    const baseDist = (this.cameraMode === 'cinematic' ? 9.5 : 5.4) * this.orbitZoom;
    const lookAhead = this.cameraMode === 'cinematic' ? 7.0 : 5.5;

    // Orbit offset around aircraft local frame
    const cosY = Math.cos(this.orbitYawOffset);
    const sinY = Math.sin(this.orbitYawOffset);
    const horizDir = new THREE.Vector3()
      .addScaledVector(this.forwardTangent, -cosY)
      .addScaledVector(right, sinY)
      .normalize();

    const elevAngle =
      this.cameraMode === 'cinematic'
        ? this.orbitPitchOffset + 0.14
        : this.orbitPitchOffset;

    desiredPos
      .copy(planePos)
      .addScaledVector(horizDir, Math.cos(elevAngle) * baseDist)
      .addScaledVector(this.unitNormal, Math.sin(elevAngle) * baseDist);

    // Ensure camera never dips below Earth's surface
    const { lat, lon } = vector3ToLatLon(desiredPos);
    const minCamRadius = this.getSurfaceRadius(lat, lon) + 0.9;
    if (desiredPos.length() < minCamRadius) {
      desiredPos.normalize().multiplyScalar(minCamRadius);
    }

    desiredLook
      .copy(planePos)
      .addScaledVector(this.forwardTangent, lookAhead)
      .addScaledVector(this.unitNormal, this.cameraMode === 'cinematic' ? -0.4 : 0.25);

    if (!this.camInitialized) {
      this.camPosCurrent.copy(desiredPos);
      this.camLookAtCurrent.copy(desiredLook);
      this.camInitialized = true;
    } else {
      const stiffness = 1 - Math.exp(-dt * 8.5);
      this.camPosCurrent.lerp(desiredPos, stiffness);
      this.camLookAtCurrent.lerp(desiredLook, stiffness);
    }

    camera.position.copy(this.camPosCurrent);
    camera.up.lerp(this.unitNormal, 1 - Math.exp(-dt * 7.5)).normalize();
    camera.lookAt(this.camLookAtCurrent);

    const targetFov = boost ? 64 : this.cameraMode === 'cinematic' ? 54 : 52;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 5));
    camera.updateProjectionMatrix();
  }
}
