import * as THREE from 'three';
import type { AircraftVariant } from '../core/constants.ts';

export interface BuiltAircraft {
  group: THREE.Group;
  variant: AircraftVariant;
  propeller?: THREE.Object3D;
  propDisc?: THREE.Mesh;
  afterburnerL?: THREE.Mesh;
  afterburnerR?: THREE.Mesh;
  strobeLeft: THREE.Mesh;
  strobeRight: THREE.Mesh;
  leftWingtipLocal: THREE.Vector3;
  rightWingtipLocal: THREE.Vector3;
  update: (
    dt: number,
    elapsed: number,
    speedNorm: number,
    boost: boolean,
    bankAngle: number
  ) => void;
}

/**
 * Builds a classic red-and-ivory biplane (Tiny Skies homage) facing along -Z.
 */
function buildBiplane(): BuiltAircraft {
  const group = new THREE.Group();

  const redMat = new THREE.MeshStandardMaterial({
    color: '#d6362c',
    roughness: 0.34,
    metalness: 0.22,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: '#f7efe0',
    roughness: 0.42,
    metalness: 0.12,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#2d3238',
    roughness: 0.4,
    metalness: 0.72,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: '#7a4b2a',
    roughness: 0.5,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#9ad8ff',
    roughness: 0.12,
    metalness: 0.6,
    transparent: true,
    opacity: 0.65,
  });

  // Fuselage nose-to-tail along Z (-Z is nose)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 1.15, 12), redMat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // Cream racing stripe & cowling
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.165, 0.22, 12), darkMetalMat);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.set(0, 0, -0.58);
  cowl.castShadow = true;
  group.add(cowl);

  // Cockpit windshield & pilot helmet
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), glassMat);
  shield.position.set(0, 0.17, -0.08);
  shield.rotation.x = 0.5;
  group.add(shield);

  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), woodMat);
  pilot.position.set(0, 0.16, 0.05);
  group.add(pilot);

  // Upper & lower wings
  const topWing = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.04, 0.32), creamMat);
  topWing.position.set(0, 0.24, -0.18);
  topWing.castShadow = true;
  group.add(topWing);

  const botWing = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.04, 0.28), redMat);
  botWing.position.set(0, -0.06, -0.14);
  botWing.castShadow = true;
  group.add(botWing);

  // Interplane wing struts
  for (const sx of [-0.52, -0.22, 0.22, 0.52]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.31, 6), darkMetalMat);
    strut.position.set(sx, 0.09, -0.16);
    group.add(strut);
  }

  // Tailplane & vertical fin
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.18), creamMat);
  hStab.position.set(0, 0.04, 0.52);
  hStab.castShadow = true;
  group.add(hStab);

  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.22), redMat);
  vStab.position.set(0, 0.14, 0.52);
  vStab.castShadow = true;
  group.add(vStab);

  // Landing gear struts & wheels
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), darkMetalMat);
    leg.position.set(lx, -0.18, -0.26);
    leg.rotation.z = lx > 0 ? -0.3 : 0.3;
    group.add(leg);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.035, 10), darkMetalMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(lx * 1.3, -0.28, -0.26);
    group.add(wheel);
  }

  // Spinning propeller & motion-blur disc
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -0.71);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.015), woodMat);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 10), darkMetalMat);
  hub.rotation.x = -Math.PI / 2;
  propeller.add(blade, hub);
  group.add(propeller);

  const propDiscMat = new THREE.MeshBasicMaterial({
    color: '#e8edf2',
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const propDisc = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), propDiscMat);
  propDisc.position.set(0, 0, -0.71);
  group.add(propDisc);

  // Wingtip navigation lights (Red Port -X, Green Starboard +X)
  const strobeLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ff3838' })
  );
  strobeLeft.position.set(-0.78, 0.24, -0.18);
  group.add(strobeLeft);

  const strobeRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#2dff7a' })
  );
  strobeRight.position.set(0.78, 0.24, -0.18);
  group.add(strobeRight);

  return {
    group,
    variant: 'biplane',
    propeller,
    propDisc,
    strobeLeft,
    strobeRight,
    leftWingtipLocal: new THREE.Vector3(-0.78, 0.24, -0.1),
    rightWingtipLocal: new THREE.Vector3(0.78, 0.24, -0.1),
    update: (dt, elapsed, speedNorm) => {
      propeller.rotation.z += dt * (24 + speedNorm * 32);
      propDiscMat.opacity = 0.16 + speedNorm * 0.22;
      const blink = Math.sin(elapsed * 8) > 0.7 ? 1.5 : 0.7;
      strobeLeft.scale.setScalar(blink);
      strobeRight.scale.setScalar(blink);
    },
  };
}

/**
 * Builds a sleek supersonic white-and-cobalt expedition jet facing along -Z.
 */
function buildJet(): BuiltAircraft {
  const group = new THREE.Group();

  const whiteMat = new THREE.MeshStandardMaterial({
    color: '#f2f5fa',
    roughness: 0.25,
    metalness: 0.35,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: '#1b6ef3',
    roughness: 0.3,
    metalness: 0.45,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#222830',
    roughness: 0.45,
    metalness: 0.65,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: '#284566',
    emissive: '#10253b',
    emissiveIntensity: 0.3,
    roughness: 0.08,
    metalness: 0.88,
  });

  // Tapered fuselage + sharp nose cone
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.145, 1.05, 14), whiteMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 14), whiteMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -0.75);
  nose.castShadow = true;
  group.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), canopyMat);
  canopy.scale.set(0.75, 0.72, 2.35);
  canopy.position.set(0, 0.095, -0.34);
  group.add(canopy);

  // Swept delta wings (extruded clean wing profile)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.1, -0.25);
  wingShape.lineTo(0.84, 0.36);
  wingShape.lineTo(0.84, 0.5);
  wingShape.lineTo(0.12, 0.42);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.025,
    bevelEnabled: false,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, whiteMat);
  rightWing.position.set(0, 0.01, -0.05);
  rightWing.castShadow = true;
  group.add(rightWing);

  const leftWing = new THREE.Mesh(wingGeo, whiteMat);
  leftWing.scale.x = -1;
  leftWing.position.set(0, 0.01, -0.05);
  leftWing.castShadow = true;
  group.add(leftWing);

  // Twin canted vertical tail stabilizers with blue accent stripe
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.26), accentMat);
    fin.position.set(side * 0.14, 0.14, 0.42);
    fin.rotation.z = side * -0.26;
    fin.rotation.x = -0.32;
    fin.castShadow = true;
    group.add(fin);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.16, 12), carbonMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 0.075, -0.01, 0.56);
    group.add(nozzle);
  }

  // Twin glowing plasma/afterburner plumes
  const burnerMat = new THREE.MeshBasicMaterial({
    color: '#5ad8ff',
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const afterburnerL = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.42, 10), burnerMat);
  afterburnerL.rotation.x = Math.PI / 2;
  afterburnerL.position.set(-0.075, -0.01, 0.84);
  group.add(afterburnerL);

  const afterburnerR = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.42, 10), burnerMat);
  afterburnerR.rotation.x = Math.PI / 2;
  afterburnerR.position.set(0.075, -0.01, 0.84);
  group.add(afterburnerR);

  // Wingtip navigation lights
  const strobeLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ff3838' })
  );
  strobeLeft.position.set(-0.84, 0.01, 0.42);
  group.add(strobeLeft);

  const strobeRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#2dff7a' })
  );
  strobeRight.position.set(0.84, 0.01, 0.42);
  group.add(strobeRight);

  return {
    group,
    variant: 'jet',
    afterburnerL,
    afterburnerR,
    strobeLeft,
    strobeRight,
    leftWingtipLocal: new THREE.Vector3(-0.84, 0.01, 0.42),
    rightWingtipLocal: new THREE.Vector3(0.84, 0.01, 0.42),
    update: (_dt, elapsed, speedNorm, boost) => {
      const flicker = 0.88 + Math.sin(elapsed * 42) * 0.12;
      const len = (boost ? 1.85 : 0.6 + speedNorm * 0.55) * flicker;
      afterburnerL.scale.set(boost ? 1.25 : 0.9, len, boost ? 1.25 : 0.9);
      afterburnerR.scale.set(boost ? 1.25 : 0.9, len, boost ? 1.25 : 0.9);
      burnerMat.color.set(boost ? '#9ef0ff' : '#40a8ff');
      const blink = Math.sin(elapsed * 8) > 0.7 ? 1.45 : 0.65;
      strobeLeft.scale.setScalar(blink);
      strobeRight.scale.setScalar(blink);
    },
  };
}

/**
 * Factory building the requested aircraft model.
 *
 * @param variant - Aircraft type ('biplane' or 'jet').
 * @returns BuiltAircraft object with mesh group and animation hooks.
 */
export function createAircraftModel(variant: AircraftVariant): BuiltAircraft {
  return variant === 'jet' ? buildJet() : buildBiplane();
}

/**
 * Lightweight 3D ribbon/point contrail renderer for left and right wingtips.
 */
export class WingtipContrails {
  public readonly group = new THREE.Group();
  private readonly maxPoints = 54;
  private readonly leftHistory: THREE.Vector3[] = [];
  private readonly rightHistory: THREE.Vector3[] = [];
  private readonly leftGeo: THREE.BufferGeometry;
  private readonly rightGeo: THREE.BufferGeometry;
  private readonly leftPositions: Float32Array;
  private readonly rightPositions: Float32Array;
  private readonly mat: THREE.LineBasicMaterial;
  private sampleTimer = 0;

  constructor() {
    this.leftPositions = new Float32Array(this.maxPoints * 3);
    this.rightPositions = new Float32Array(this.maxPoints * 3);
    this.leftGeo = new THREE.BufferGeometry();
    this.rightGeo = new THREE.BufferGeometry();
    this.leftGeo.setAttribute('position', new THREE.BufferAttribute(this.leftPositions, 3));
    this.rightGeo.setAttribute('position', new THREE.BufferAttribute(this.rightPositions, 3));

    this.mat = new THREE.LineBasicMaterial({
      color: '#e8f5ff',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    const leftLine = new THREE.Line(this.leftGeo, this.mat);
    const rightLine = new THREE.Line(this.rightGeo, this.mat);
    leftLine.frustumCulled = false;
    rightLine.frustumCulled = false;
    this.group.add(leftLine, rightLine);
  }

  /**
   * Clears existing contrail history (used on instant teleport/approach).
   */
  public reset(): void {
    this.leftHistory.length = 0;
    this.rightHistory.length = 0;
    this.leftGeo.setDrawRange(0, 0);
    this.rightGeo.setDrawRange(0, 0);
  }

  /**
   * Records wingtip world coordinates at steady intervals and updates trail buffers.
   *
   * @param dt - Frame delta time in seconds.
   * @param leftWorld - Left wingtip world-space position.
   * @param rightWorld - Right wingtip world-space position.
   * @param boost - Whether afterburner/boost is active.
   */
  public update(
    dt: number,
    leftWorld: THREE.Vector3,
    rightWorld: THREE.Vector3,
    boost: boolean
  ): void {
    this.sampleTimer += dt;
    this.mat.opacity = boost ? 0.68 : 0.34;
    if (this.sampleTimer < 0.028) return;
    this.sampleTimer = 0;

    this.leftHistory.unshift(leftWorld.clone());
    this.rightHistory.unshift(rightWorld.clone());
    if (this.leftHistory.length > this.maxPoints) this.leftHistory.pop();
    if (this.rightHistory.length > this.maxPoints) this.rightHistory.pop();

    const len = this.leftHistory.length;
    for (let i = 0; i < len; i++) {
      const lp = this.leftHistory[i];
      const rp = this.rightHistory[i];
      this.leftPositions[i * 3] = lp.x;
      this.leftPositions[i * 3 + 1] = lp.y;
      this.leftPositions[i * 3 + 2] = lp.z;
      this.rightPositions[i * 3] = rp.x;
      this.rightPositions[i * 3 + 1] = rp.y;
      this.rightPositions[i * 3 + 2] = rp.z;
    }

    (this.leftGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.rightGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.leftGeo.setDrawRange(0, len);
    this.rightGeo.setDrawRange(0, len);
  }
}
