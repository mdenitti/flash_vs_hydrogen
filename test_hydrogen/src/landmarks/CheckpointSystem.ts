import * as THREE from 'three';
import {
  CHECKPOINT_TRIGGER_MAX_ALT,
  CHECKPOINT_TRIGGER_SURFACE_DIST,
  GLOBE_RADIUS,
} from '../core/constants.ts';
import { getLocalTangentBasis, greatCircleAngle, latLonToVector3 } from '../core/geo.ts';
import { type BuiltLandmark, createLandmarkModel } from './LandmarkModels.ts';
import { LANDMARKS, type LandmarkDefinition } from './landmarksData.ts';

export interface CheckpointInstance {
  definition: LandmarkDefinition;
  rootGroup: THREE.Group;
  model: BuiltLandmark;
  unitNormal: THREE.Vector3;
  surfaceRadius: number;
  ringGroup: THREE.Group;
  ringOuterMat: THREE.MeshBasicMaterial;
  ringInnerMat: THREE.MeshBasicMaterial;
  beaconMesh: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  discovered: boolean;
  pulseBoost: number;
}

interface CelebrationBurst {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
  maxAge: number;
}

/**
 * Evaluates whether an aircraft position counts as flying over or through a checkpoint.
 *
 * @param aircraftPos - Current world position of the aircraft.
 * @param landmarkNormal - Normalized radial outward vector of the landmark.
 * @param landmarkSurfaceRadius - Ground radius beneath the landmark.
 * @param landmarkRingAlt - Target ring altitude offset above ground.
 * @returns True if the aircraft is within the horizontal and vertical fly-over envelope.
 */
export function isCheckpointFlyover(
  aircraftPos: THREE.Vector3,
  landmarkNormal: THREE.Vector3,
  landmarkSurfaceRadius: number,
  landmarkRingAlt: number
): boolean {
  const aircraftRadius = aircraftPos.length();
  if (aircraftRadius < 1e-4) return false;
  const aircraftNormal = aircraftPos.clone().divideScalar(aircraftRadius);
  const arcDist = greatCircleAngle(aircraftNormal, landmarkNormal) * GLOBE_RADIUS;
  const altAboveGround = aircraftRadius - landmarkSurfaceRadius;
  const maxAlt = Math.max(CHECKPOINT_TRIGGER_MAX_ALT, landmarkRingAlt + 6.5);
  return arcDist <= CHECKPOINT_TRIGGER_SURFACE_DIST && altAboveGround >= 0.3 && altAboveGround <= maxAlt;
}

/**
 * Creates a soft circular radial glow texture for celebration burst particles.
 *
 * @returns CanvasTexture with smooth circular alpha gradient.
 */
function createParticleDiscTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.7, 'rgba(140,255,205,0.28)');
  grad.addColorStop(1.0, 'rgba(140,255,205,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Manages all world landmarks, glowing fly-over checkpoint rings, sky beacons,
 * night illumination transitions, and discovery particle bursts.
 */
export class CheckpointSystem {
  public readonly group = new THREE.Group();
  public readonly checkpoints: CheckpointInstance[] = [];
  private readonly bursts: CelebrationBurst[] = [];
  private readonly particleTex = createParticleDiscTexture();
  private activeTargetId: string = LANDMARKS[0].id;

  constructor(
    getSurfaceRadius: (lat: number, lon: number) => number,
    onDiscovered?: (cp: CheckpointInstance, totalDiscovered: number, total: number) => void
  ) {
    this.onDiscoveredCallback = onDiscovered;
    for (const def of LANDMARKS) {
      const cp = this.createCheckpoint(def, getSurfaceRadius(def.lat, def.lon));
      this.checkpoints.push(cp);
      this.group.add(cp.rootGroup);
    }
  }

  private onDiscoveredCallback?: (
    cp: CheckpointInstance,
    totalDiscovered: number,
    total: number
  ) => void;

  /**
   * Instantiates one landmark model + checkpoint halo + sky beacon at its geographic location.
   */
  private createCheckpoint(def: LandmarkDefinition, surfaceRadius: number): CheckpointInstance {
    const rootGroup = new THREE.Group();
    const unitNormal = latLonToVector3(def.lat, def.lon, 1).normalize();
    const { east, north, up } = getLocalTangentBasis(unitNormal);

    // Orient root group so +Y = up, +Z = South (or rotated by headingDeg), +X = East
    const basisMat = new THREE.Matrix4().makeBasis(
      east,
      up,
      north.clone().negate()
    );
    const headingQuat = new THREE.Quaternion().setFromAxisAngle(
      up,
      -THREE.MathUtils.degToRad(def.headingDeg)
    );
    rootGroup.quaternion.setFromRotationMatrix(basisMat).premultiply(headingQuat);
    rootGroup.position.copy(unitNormal).multiplyScalar(surfaceRadius);

    const model = createLandmarkModel(def.id);
    rootGroup.add(model.group);

    // Aerial fly-over checkpoint ring hovering cleanly above the landmark
    const ringGroup = new THREE.Group();
    ringGroup.position.set(0, def.ringAltitude, 0);

    const accent = new THREE.Color(def.accentColor);
    const ringOuterMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.9,
    });
    const ringInnerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
    });

    const outerTorus = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.095, 12, 48), ringOuterMat);
    outerTorus.rotation.x = Math.PI / 2;
    ringGroup.add(outerTorus);

    const innerTorus = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.045, 8, 36), ringInnerMat);
    innerTorus.rotation.x = Math.PI / 2;
    ringGroup.add(innerTorus);

    // 4 subtle directional chevrons spinning around the halo
    const chevronGeo = new THREE.OctahedronGeometry(0.16, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const chev = new THREE.Mesh(chevronGeo, ringOuterMat);
      chev.position.set(Math.cos(a) * 2.42, 0, Math.sin(a) * 2.42);
      ringGroup.add(chev);
    }

    rootGroup.add(ringGroup);

    // Translucent vertical light pillar visible from across continents, fading near aircraft
    const beaconHeight = 20;
    const beaconGeo = new THREE.CylinderGeometry(0.28, 1.35, beaconHeight, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0, def.ringAltitude + beaconHeight * 0.5, 0);
    rootGroup.add(beaconMesh);

    return {
      definition: def,
      rootGroup,
      model,
      unitNormal,
      surfaceRadius,
      ringGroup,
      ringOuterMat,
      ringInnerMat,
      beaconMesh,
      beaconMat,
      discovered: false,
      pulseBoost: 0,
    };
  }

  /**
   * Snaps all landmarks onto the displaced 3D terrain elevation once Earth textures finish loading.
   *
   * @param getSurfaceRadius - Elevation lookup function returning ground radius for (lat, lon).
   */
  public reanchorToTerrain(getSurfaceRadius: (lat: number, lon: number) => number): void {
    for (const cp of this.checkpoints) {
      const r = getSurfaceRadius(cp.definition.lat, cp.definition.lon);
      cp.surfaceRadius = r;
      cp.rootGroup.position.copy(cp.unitNormal).multiplyScalar(r);
    }
  }

  /**
   * Sets the active navigation target landmark ID shown in HUD directional compass.
   *
   * @param id - Landmark identifier.
   */
  public setActiveTarget(id: string): void {
    this.activeTargetId = id;
  }

  /**
   * Returns the currently active navigation target checkpoint.
   *
   * @returns CheckpointInstance matching activeTargetId, or first checkpoint fallback.
   */
  public getActiveTarget(): CheckpointInstance {
    return (
      this.checkpoints.find((c) => c.definition.id === this.activeTargetId) ??
      this.checkpoints[0]
    );
  }

  /**
   * Returns count of discovered checkpoints.
   *
   * @returns Number of cleared landmarks.
   */
  public getDiscoveredCount(): number {
    let count = 0;
    for (const cp of this.checkpoints) {
      if (cp.discovered) count++;
    }
    return count;
  }

  /**
   * Selects the nearest undiscovered checkpoint relative to a world position.
   *
   * @param pos - Reference 3D world position.
   * @returns Nearest undiscovered CheckpointInstance or null if all discovered.
   */
  public findNearestUndiscovered(pos: THREE.Vector3): CheckpointInstance | null {
    const dir = pos.clone().normalize();
    let best: CheckpointInstance | null = null;
    let bestAngle = Infinity;
    for (const cp of this.checkpoints) {
      if (cp.discovered) continue;
      const angle = greatCircleAngle(dir, cp.unitNormal);
      if (angle < bestAngle) {
        bestAngle = angle;
        best = cp;
      }
    }
    return best;
  }

  /**
   * Spawns a radial 3D particle celebration burst at the checkpoint ring's world position.
   */
  private spawnBurst(cp: CheckpointInstance): void {
    const count = 90;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const worldRingPos = new THREE.Vector3();
    cp.ringGroup.getWorldPosition(worldRingPos);

    const { east, north, up } = getLocalTangentBasis(cp.unitNormal);
    const vel = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 6.5;
      const upSpeed = 1.5 + Math.random() * 5.0;
      const ringOffset = 1.2 + Math.random() * 0.9;

      positions[i * 3] =
        worldRingPos.x + east.x * Math.cos(a) * ringOffset + north.x * Math.sin(a) * ringOffset;
      positions[i * 3 + 1] =
        worldRingPos.y + east.y * Math.cos(a) * ringOffset + north.y * Math.sin(a) * ringOffset;
      positions[i * 3 + 2] =
        worldRingPos.z + east.z * Math.cos(a) * ringOffset + north.z * Math.sin(a) * ringOffset;

      vel
        .set(0, 0, 0)
        .addScaledVector(east, Math.cos(a) * speed)
        .addScaledVector(north, Math.sin(a) * speed)
        .addScaledVector(up, upSpeed);
      velocities[i * 3] = vel.x;
      velocities[i * 3 + 1] = vel.y;
      velocities[i * 3 + 2] = vel.z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#7cffc2',
      size: 0.65,
      map: this.particleTex,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.group.add(points);
    this.bursts.push({ points, velocities, age: 0, maxAge: 1.5 });
  }

  /**
   * Updates all landmark night lights, beacon animations, particle bursts, and
   * checks if the aircraft flew over/through any checkpoint.
   *
   * @param dt - Frame delta time in seconds.
   * @param elapsed - Total elapsed time in seconds.
   * @param aircraftPos - Current aircraft world position.
   * @param sunDir - Current normalized sun direction vector.
   */
  public update(
    dt: number,
    elapsed: number,
    aircraftPos: THREE.Vector3,
    sunDir: THREE.Vector3
  ): void {
    const emerald = new THREE.Color('#3af09d');

    for (const cp of this.checkpoints) {
      // Animate checkpoint ring spin & hover bob
      cp.ringGroup.rotation.y = elapsed * (cp.discovered ? 0.65 : 1.15);
      cp.ringGroup.position.y = cp.definition.ringAltitude + Math.sin(elapsed * 2.2 + cp.definition.lat) * 0.22;

      if (cp.pulseBoost > 0) {
        cp.pulseBoost = Math.max(0, cp.pulseBoost - dt * 1.4);
      }
      const scalePulse = 1 + cp.pulseBoost * 0.45;
      cp.ringGroup.scale.setScalar(scalePulse);

      // Update night illumination based on local solar angle
      const sunDot = cp.unitNormal.dot(sunDir);
      const nightFactor = THREE.MathUtils.smoothstep(-sunDot, -0.18, 0.22);
      for (const item of cp.model.nightGlowMaterials) {
        item.material.emissiveIntensity = THREE.MathUtils.lerp(
          item.dayIntensity,
          item.nightIntensity,
          nightFactor
        );
      }

      // Aviation strobes blink crisply
      for (const strobe of cp.model.strobeMaterials) {
        const blink = Math.pow(Math.max(0, Math.sin(elapsed * 5.2 + strobe.phase)), 8);
        strobe.material.emissiveIntensity = 0.25 + blink * 3.4;
      }

      // Fade sky beacon cleanly as aircraft gets close so the landmark looks crisp
      const worldCenter = cp.unitNormal.clone().multiplyScalar(cp.surfaceRadius);
      const dist = aircraftPos.distanceTo(worldCenter);
      const isTarget = cp.definition.id === this.activeTargetId;
      const distFade = THREE.MathUtils.smoothstep(dist, 14.0, 34.0);
      const baseBeaconAlpha = cp.discovered ? 0.06 : isTarget ? 0.30 : 0.16;
      cp.beaconMat.opacity = baseBeaconAlpha * distFade;
      cp.beaconMesh.visible = cp.beaconMat.opacity > 0.01;

      // Check fly-over trigger
      if (
        isCheckpointFlyover(
          aircraftPos,
          cp.unitNormal,
          cp.surfaceRadius,
          cp.definition.ringAltitude
        )
      ) {
        if (!cp.discovered) {
          cp.discovered = true;
          cp.pulseBoost = 1.0;
          cp.ringOuterMat.color.copy(emerald);
          cp.beaconMat.color.copy(emerald);
          this.spawnBurst(cp);

          // Automatically advance active target to nearest remaining undiscovered checkpoint
          const next = this.findNearestUndiscovered(aircraftPos);
          if (next) {
            this.activeTargetId = next.definition.id;
          }

          this.onDiscoveredCallback?.(
            cp,
            this.getDiscoveredCount(),
            this.checkpoints.length
          );
        } else if (cp.pulseBoost < 0.05) {
          cp.pulseBoost = 0.5;
        }
      }
    }

    // Update active celebration bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      if (b.age >= b.maxAge) {
        this.group.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
        continue;
      }

      const posAttr = b.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let p = 0; p < arr.length; p++) {
        arr[p] += b.velocities[p] * dt;
        b.velocities[p] *= 0.96;
      }
      posAttr.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = 1 - b.age / b.maxAge;
    }
  }
}
