import * as THREE from 'three';
import { GLOBE_RADIUS } from '../core/constants.ts';
import { getLocalTangentBasis } from '../core/geo.ts';

interface CloudClusterMeta {
  unitNormal: THREE.Vector3;
  altitude: number;
  baseScale: number;
  driftSpeed: number;
  puffs: Array<{ offset: THREE.Vector3; radius: number }>;
}

/**
 * Generates instanced 3D puffy cumulus cloud clusters floating in Earth's lower
 * atmosphere so the player experiences exhilarating parallax and cloud fly-throughs.
 */
export class VolumetricClouds {
  public readonly group = new THREE.Group();
  private readonly instancedMesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly clusters: CloudClusterMeta[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly totalPuffs: number;

  constructor(clusterCount = 130) {
    const puffGeo = new THREE.IcosahedronGeometry(1, 2);
    this.material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.96,
      metalness: 0.0,
    });

    let puffCounter = 0;
    for (let c = 0; c < clusterCount; c++) {
      // Uniform sphere sampling
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const rHoriz = Math.sqrt(1 - u * u);
      const unitNormal = new THREE.Vector3(
        rHoriz * Math.cos(theta),
        u,
        rHoriz * Math.sin(theta)
      ).normalize();

      const puffCount = 4 + Math.floor(Math.random() * 4);
      const puffs: Array<{ offset: THREE.Vector3; radius: number }> = [];
      for (let p = 0; p < puffCount; p++) {
        puffs.push({
          offset: new THREE.Vector3(
            (Math.random() - 0.5) * 3.1,
            (Math.random() - 0.5) * 0.45,
            (Math.random() - 0.5) * 2.4
          ),
          radius: 0.75 + Math.random() * 0.85,
        });
        puffCounter++;
      }

      this.clusters.push({
        unitNormal,
        altitude: 3.4 + Math.random() * 3.0,
        baseScale: 0.55 + Math.random() * 0.42,
        driftSpeed: 0.002 + Math.random() * 0.003,
        puffs,
      });
    }

    this.totalPuffs = puffCounter;
    this.instancedMesh = new THREE.InstancedMesh(puffGeo, this.material, this.totalPuffs);
    this.instancedMesh.receiveShadow = false;
    this.instancedMesh.castShadow = false;
    this.group.add(this.instancedMesh);
  }

  /**
   * Updates cloud drift, day/night tinting per cluster, and soft proximity fade
   * when the camera slices directly through a cloud puff.
   *
   * @param dt - Frame delta time in seconds.
   * @param sunDir - Current normalized sun direction vector.
   * @param cameraPos - Current camera world-space position.
   */
  public update(dt: number, sunDir: THREE.Vector3, cameraPos: THREE.Vector3): void {
    const dayCol = new THREE.Color('#eef4fc');
    const sunsetCol = new THREE.Color('#ffad7a');
    const nightCol = new THREE.Color('#2c3d63');
    const color = new THREE.Color();
    const yAxis = new THREE.Vector3(0, 1, 0);

    let idx = 0;
    for (const cluster of this.clusters) {
      // Gentle eastward atmospheric wind drift around Earth's axis
      cluster.unitNormal.applyAxisAngle(yAxis, cluster.driftSpeed * dt);

      const { east, north, up } = getLocalTangentBasis(cluster.unitNormal);
      const centerPos = up.clone().multiplyScalar(GLOBE_RADIUS + cluster.altitude);

      const sunDot = up.dot(sunDir);
      const dayMix = THREE.MathUtils.smoothstep(sunDot, -0.2, 0.3);
      const twilightMix = Math.exp(-Math.pow((sunDot + 0.02) / 0.17, 2));
      color.copy(nightCol).lerp(dayCol, dayMix).lerp(sunsetCol, twilightMix * 0.65);

      for (const puff of cluster.puffs) {
        this.dummy.position
          .copy(centerPos)
          .addScaledVector(east, puff.offset.x * cluster.baseScale)
          .addScaledVector(up, puff.offset.y * cluster.baseScale)
          .addScaledVector(north, puff.offset.z * cluster.baseScale);

        // Shrink smoothly right next to camera so flying past/through clouds stays crisp
        const distToCam = this.dummy.position.distanceTo(cameraPos);
        const camScaleFade = THREE.MathUtils.smoothstep(distToCam, 2.4, 6.8);

        const s = puff.radius * cluster.baseScale * camScaleFade;
        this.dummy.scale.set(s * 1.35, s * 0.62, s * 1.15);
        this.dummy.lookAt(centerPos.clone().add(east));
        this.dummy.updateMatrix();

        this.instancedMesh.setMatrixAt(idx, this.dummy.matrix);
        this.instancedMesh.setColorAt(idx, color);
        idx++;
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }
}
