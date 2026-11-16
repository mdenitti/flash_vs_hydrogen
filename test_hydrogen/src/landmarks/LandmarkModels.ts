import * as THREE from 'three';

export interface BuiltLandmark {
  group: THREE.Group;
  /** Materials that light up warmly when the landmark passes into twilight/night. */
  nightGlowMaterials: Array<{
    material: THREE.MeshStandardMaterial;
    dayIntensity: number;
    nightIntensity: number;
  }>;
  /** Strobe spheres that pulse at aviation frequency. */
  strobeMaterials: Array<{
    material: THREE.MeshStandardMaterial;
    phase: number;
    baseColor: THREE.Color;
  }>;
}

const UP_VEC = new THREE.Vector3(0, 1, 0);

/**
 * Helper to create and attach a Mesh to a parent Group with shadows configured.
 *
 * @param parent - Parent Three.js Object3D.
 * @param geometry - BufferGeometry for the mesh.
 * @param material - Material for the mesh.
 * @param position - Local position [x, y, z].
 * @param rotation - Optional local Euler rotation [x, y, z].
 * @param castShadow - Whether mesh casts shadows.
 * @param receiveShadow - Whether mesh receives shadows.
 * @returns Created THREE.Mesh instance.
 */
function addPart(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

/**
 * Connects two 3D points with a tapered structural beam cylinder.
 *
 * @param parent - Parent Object3D.
 * @param start - Start point in local space.
 * @param end - End point in local space.
 * @param radiusBottom - Radius at start point.
 * @param radiusTop - Radius at end point.
 * @param material - Material for the beam.
 * @param radialSegments - Cylinder radial segments.
 * @returns Created beam Mesh.
 */
function addStrut(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radiusBottom: number,
  radiusTop: number,
  material: THREE.Material,
  radialSegments = 6
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radialSegments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP_VEC, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Adds a standard submerged circular earth-matching plinth beneath a landmark
 * so monuments sit solidly on Earth's curved terrain without floating corners.
 *
 * @param parent - Landmark group.
 * @param radius - Top radius of the foundation pad.
 * @param color - Surface color matching the local biome.
 */
function addFoundationPad(
  parent: THREE.Object3D,
  radius: number,
  color: string
): void {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.96,
    metalness: 0.0,
  });
  addPart(
    parent,
    new THREE.CylinderGeometry(radius * 0.56, radius * 0.78, 0.9, 24),
    mat,
    [0, -0.44, 0],
    [0, 0, 0],
    false,
    true
  );
}

/**
 * Builds the Eiffel Tower (Paris): 4 sweeping curved lattice legs, base arches,
 * 1st & 2nd observation decks, tapered spire, golden night floodlights, and strobe.
 */
function buildEiffelTower(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 2.2, '#4a623a');

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#787b69', roughness: 0.9 });
  const poolMat = new THREE.MeshStandardMaterial({ color: '#2b5e70', roughness: 0.2, metalness: 0.3 });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#5c4b3b',
    roughness: 0.58,
    metalness: 0.52,
  });
  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: '#ffd99c',
    emissive: '#ffaa38',
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });
  ctx.nightGlowMaterials.push({
    material: warmGlowMat,
    dayIntensity: 0.2,
    nightIntensity: 2.2,
  });

  // Champ de Mars esplanade & reflecting pond
  addPart(g, new THREE.BoxGeometry(2.8, 0.14, 3.6), stoneMat, [0, 0.05, 0], [0, 0, 0], false, true);
  addPart(g, new THREE.BoxGeometry(0.95, 0.06, 1.5), poolMat, [0, 0.11, 1.75], [0, 0, 0], false, true);

  // 4 sweeping curved legs built across 4 vertical curve tiers
  const levels = [
    { y: 0.08, half: 1.18, r: 0.13 },
    { y: 0.95, half: 0.88, r: 0.105 },
    { y: 1.85, half: 0.62, r: 0.085 },
    { y: 3.35, half: 0.34, r: 0.068 },
    { y: 5.75, half: 0.12, r: 0.048 },
  ];

  const signs: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];

  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const a = levels[lvl];
    const b = levels[lvl + 1];
    for (let c = 0; c < 4; c++) {
      const [sx, sz] = signs[c];
      const [nx, nz] = signs[(c + 1) % 4];
      const p1 = new THREE.Vector3(sx * a.half, a.y, sz * a.half);
      const p2 = new THREE.Vector3(sx * b.half, b.y, sz * b.half);
      addStrut(g, p1, p2, a.r, b.r, ironMat, 6);

      // Cross-bracing lattice struts between adjacent corner legs
      const p1Next = new THREE.Vector3(nx * a.half, a.y, nz * a.half);
      const p2Next = new THREE.Vector3(nx * b.half, b.y, nz * b.half);
      if (lvl >= 1) {
        addStrut(g, p1, p2Next, 0.032, 0.032, ironMat, 4);
        addStrut(g, p1Next, p2, 0.032, 0.032, ironMat, 4);
      }
      // Horizontal perimeter ring girders
      addStrut(g, p2, p2Next, 0.038, 0.038, ironMat, 4);
    }
  }

  // Iconic decorative base arches on all 4 sides
  for (let i = 0; i < 4; i++) {
    const archGroup = new THREE.Group();
    archGroup.rotation.y = (i * Math.PI) / 2;
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.055, 8, 18, Math.PI),
      ironMat
    );
    arch.position.set(0, 0.62, 0.88);
    arch.castShadow = true;
    archGroup.add(arch);
    g.add(archGroup);
  }

  // 1st Deck & 2nd Deck observation platforms with glowing undersides
  addPart(g, new THREE.BoxGeometry(1.42, 0.16, 1.42), ironMat, [0, 1.85, 0]);
  addPart(g, new THREE.BoxGeometry(1.32, 0.07, 1.32), warmGlowMat, [0, 1.77, 0], [0, 0, 0], false, false);

  addPart(g, new THREE.BoxGeometry(0.84, 0.15, 0.84), ironMat, [0, 3.35, 0]);
  addPart(g, new THREE.BoxGeometry(0.76, 0.07, 0.76), warmGlowMat, [0, 3.27, 0], [0, 0, 0], false, false);

  // 3rd Observation lantern & summit spire
  addPart(g, new THREE.CylinderGeometry(0.24, 0.28, 0.26, 8), warmGlowMat, [0, 5.82, 0]);
  addPart(g, new THREE.CylinderGeometry(0.14, 0.26, 0.35, 8), ironMat, [0, 6.08, 0]);
  addPart(g, new THREE.CylinderGeometry(0.025, 0.09, 1.05, 8), ironMat, [0, 6.68, 0]);

  // Aviation strobe beacon
  const strobeMat = new THREE.MeshStandardMaterial({
    color: '#ff4b3a',
    emissive: '#ff301c',
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  ctx.strobeMaterials.push({
    material: strobeMat,
    phase: 0,
    baseColor: new THREE.Color('#ff301c'),
  });
  addPart(g, new THREE.SphereGeometry(0.11, 10, 10), strobeMat, [0, 7.22, 0], [0, 0, 0], false, false);
}

/**
 * Builds the Statue of Liberty (New York Harbor): Fort Wood 11-point star pedestal,
 * copper-verdigris robed figure, 7-ray crown, tablet, and glowing golden torch.
 */
function buildStatueOfLiberty(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 2.0, '#3e5e46');

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#b8aa96', roughness: 0.82 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#7a7267', roughness: 0.88 });
  const copperMat = new THREE.MeshStandardMaterial({
    color: '#4ea88f',
    roughness: 0.56,
    metalness: 0.28,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#ffcf5c',
    emissive: '#ff9d22',
    emissiveIntensity: 0.95,
    roughness: 0.25,
    metalness: 0.65,
  });
  ctx.nightGlowMaterials.push({
    material: goldMat,
    dayIntensity: 0.9,
    nightIntensity: 2.8,
  });

  // 11-pointed Fort Wood star base
  const starShape = new THREE.Shape();
  const points = 11;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1.68 : 1.24;
    const a = (i / (points * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.42, bevelEnabled: false });
  starGeo.rotateX(-Math.PI / 2);
  addPart(g, starGeo, darkStoneMat, [0, 0.0, 0]);

  // Multi-tiered granite pedestal
  addPart(g, new THREE.BoxGeometry(1.5, 0.55, 1.5), stoneMat, [0, 0.68, 0]);
  addPart(g, new THREE.BoxGeometry(1.18, 1.65, 1.18), stoneMat, [0, 1.75, 0]);
  addPart(g, new THREE.BoxGeometry(1.32, 0.22, 1.32), stoneMat, [0, 2.65, 0]);

  // Copper robed Lady Liberty figure
  addPart(g, new THREE.CylinderGeometry(0.32, 0.56, 2.25, 12), copperMat, [0, 3.88, 0]);
  // Draped shoulder sash & torso
  addPart(g, new THREE.CylinderGeometry(0.28, 0.36, 0.72, 10), copperMat, [0, 4.95, 0]);
  // Head & neck
  addPart(g, new THREE.SphereGeometry(0.24, 14, 12), copperMat, [0, 5.48, 0]);

  // 7-ray iconic spiked crown
  for (let i = -3; i <= 3; i++) {
    const angle = i * 0.34;
    addPart(
      g,
      new THREE.ConeGeometry(0.038, 0.34, 5),
      copperMat,
      [Math.sin(angle) * 0.25, 5.66 + Math.cos(angle) * 0.12, 0.08],
      [0.2, 0, -angle]
    );
  }

  // Left arm holding the tablet
  addPart(g, new THREE.CylinderGeometry(0.085, 0.1, 0.85, 8), copperMat, [-0.36, 4.82, 0.15], [0.25, 0, 0.4]);
  addPart(g, new THREE.BoxGeometry(0.28, 0.4, 0.09), copperMat, [-0.46, 4.88, 0.28], [-0.2, 0.3, 0.25]);

  // Right arm raised high holding the gleaming golden torch
  addPart(g, new THREE.CylinderGeometry(0.08, 0.105, 1.48, 8), copperMat, [0.34, 5.58, 0.05], [0, 0, -0.24]);
  addPart(g, new THREE.CylinderGeometry(0.14, 0.09, 0.25, 10), goldMat, [0.54, 6.32, 0.05]);
  addPart(g, new THREE.ConeGeometry(0.13, 0.42, 10), goldMat, [0.54, 6.62, 0.05], [0, 0, 0], false, false);
}

/**
 * Builds the Great Pyramids of Giza & Great Sphinx on a golden sandstone plateau.
 */
function buildGizaPyramids(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 4.5, '#c9a66b');

  const sandMat = new THREE.MeshStandardMaterial({ color: '#cfa968', roughness: 0.92 });
  const limestoneMat = new THREE.MeshStandardMaterial({ color: '#dec087', roughness: 0.86 });
  const goldCapstoneMat = new THREE.MeshStandardMaterial({
    color: '#ffd452',
    emissive: '#ffaa1d',
    emissiveIntensity: 0.25,
    roughness: 0.22,
    metalness: 0.82,
  });
  ctx.nightGlowMaterials.push({
    material: goldCapstoneMat,
    dayIntensity: 0.25,
    nightIntensity: 1.2,
  });

  addPart(g, new THREE.CylinderGeometry(3.4, 3.85, 0.35, 24), sandMat, [0, -0.14, 0], [0, 0, 0], false, true);

  // Khufu (Great Pyramid) + gleaming golden pyramidion
  addPart(g, new THREE.ConeGeometry(2.3, 3.25, 4), limestoneMat, [-1.0, 1.62, -0.9], [0, Math.PI / 4, 0]);
  addPart(g, new THREE.ConeGeometry(0.32, 0.45, 4), goldCapstoneMat, [-1.0, 3.04, -0.9], [0, Math.PI / 4, 0]);

  // Khafre (second pyramid)
  addPart(g, new THREE.ConeGeometry(1.9, 2.75, 4), limestoneMat, [1.25, 1.38, 0.65], [0, Math.PI / 4, 0]);

  // Menkaure (third pyramid)
  addPart(g, new THREE.ConeGeometry(1.15, 1.7, 4), limestoneMat, [2.55, 0.85, 1.85], [0, Math.PI / 4, 0]);

  // Great Sphinx resting on the eastern ridge
  const sphinx = new THREE.Group();
  sphinx.position.set(1.35, 0.05, -2.05);
  sphinx.rotation.y = 0.4;
  addPart(sphinx, new THREE.BoxGeometry(1.55, 0.56, 0.68), limestoneMat, [0, 0.28, 0]);
  addPart(sphinx, new THREE.BoxGeometry(0.75, 0.18, 0.22), limestoneMat, [0.95, 0.09, -0.22]);
  addPart(sphinx, new THREE.BoxGeometry(0.75, 0.18, 0.22), limestoneMat, [0.95, 0.09, 0.22]);
  addPart(sphinx, new THREE.CylinderGeometry(0.32, 0.36, 0.68, 8), limestoneMat, [0.68, 0.72, 0]);
  addPart(sphinx, new THREE.SphereGeometry(0.28, 10, 10), limestoneMat, [0.72, 1.12, 0]);
  // Nemes headdress flares
  addPart(sphinx, new THREE.BoxGeometry(0.32, 0.5, 0.64), limestoneMat, [0.64, 0.96, 0], [0, 0, 0.15]);
  g.add(sphinx);
}

/**
 * Builds the Roman Colosseum: elliptical multi-tier travertine arcade with iconic
 * asymmetrical partial outer upper wall, exposed hypogeum arena, and amber night uplighting.
 */
function buildColosseum(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 3.0, '#7c7e58');

  const travertineMat = new THREE.MeshStandardMaterial({ color: '#d8c5a0', roughness: 0.82 });
  const darkArchMat = new THREE.MeshStandardMaterial({
    color: '#2d231a',
    emissive: '#ff902e',
    emissiveIntensity: 0.1,
    roughness: 0.9,
  });
  ctx.nightGlowMaterials.push({
    material: darkArchMat,
    dayIntensity: 0.08,
    nightIntensity: 1.05,
  });
  const sandFloorMat = new THREE.MeshStandardMaterial({ color: '#c4aa7e', roughness: 0.92 });

  const oval = new THREE.Group();
  oval.scale.set(1.22, 1, 0.96);

  // Arena sandy floor + exposed hypogeum ruin walls
  addPart(oval, new THREE.CylinderGeometry(1.75, 1.85, 0.25, 32), sandFloorMat, [0, 0.12, 0], [0, 0, 0], false, true);
  for (let k = -2; k <= 2; k++) {
    addPart(oval, new THREE.BoxGeometry(2.1 - Math.abs(k) * 0.35, 0.26, 0.08), travertineMat, [0, 0.32, k * 0.32]);
  }

  // Stepped inner bowl
  addPart(
    oval,
    new THREE.CylinderGeometry(2.35, 1.72, 1.45, 32, 1, true),
    travertineMat,
    [0, 0.72, 0]
  );

  // Outer multi-tier curved stone facade + iconic broken 4th-level crown
  const outerLower = new THREE.CylinderGeometry(2.55, 2.58, 1.55, 36, 1, true);
  const outerMatDouble = travertineMat.clone();
  outerMatDouble.side = THREE.DoubleSide;
  addPart(oval, outerLower, outerMatDouble, [0, 0.78, 0]);

  // Partial broken upper attic tier (~56% of circumference)
  const upperArc = new THREE.CylinderGeometry(
    2.53,
    2.55,
    0.85,
    24,
    1,
    true,
    -Math.PI * 0.55,
    Math.PI * 1.12
  );
  addPart(oval, upperArc, outerMatDouble, [0, 1.95, 0]);

  // Top rim cap along the intact outer wall
  addPart(
    oval,
    new THREE.TorusGeometry(2.54, 0.12, 6, 28, Math.PI * 1.12),
    travertineMat,
    [0, 2.38, 0],
    [Math.PI / 2, 0, -Math.PI * 0.05]
  );

  // 24 arched arcade pillars & glowing dark openings around perimeter
  const archCount = 24;
  for (let i = 0; i < archCount; i++) {
    const angle = (i / archCount) * Math.PI * 2;
    const rx = Math.cos(angle) * 2.57;
    const rz = Math.sin(angle) * 2.57;
    addPart(
      oval,
      new THREE.BoxGeometry(0.16, 1.55, 0.24),
      travertineMat,
      [rx, 0.78, rz],
      [0, -angle, 0]
    );
    // Illuminated arched window niches across 2 tiers
    const archX = Math.cos(angle + Math.PI / archCount) * 2.53;
    const archZ = Math.sin(angle + Math.PI / archCount) * 2.53;
    addPart(
      oval,
      new THREE.BoxGeometry(0.1, 0.44, 0.26),
      darkArchMat,
      [archX, 0.52, archZ],
      [0, -(angle + Math.PI / archCount), 0],
      false,
      false
    );
    addPart(
      oval,
      new THREE.BoxGeometry(0.1, 0.44, 0.26),
      darkArchMat,
      [archX, 1.18, archZ],
      [0, -(angle + Math.PI / archCount), 0],
      false,
      false
    );
  }

  g.add(oval);
}

/**
 * Builds the Sydney Opera House: Bennelong Point granite podium with soaring
 * white ribbed spherical sail shells and warm golden glass fronts.
 */
function buildSydneyOperaHouse(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 3.2, '#225978');

  const graniteMat = new THREE.MeshStandardMaterial({ color: '#9c9286', roughness: 0.78 });
  const shellMat = new THREE.MeshStandardMaterial({
    color: '#f6f3ea',
    roughness: 0.35,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#6b7e8c',
    emissive: '#ffbf6e',
    emissiveIntensity: 0.22,
    roughness: 0.2,
    metalness: 0.65,
  });
  ctx.nightGlowMaterials.push({
    material: glassMat,
    dayIntensity: 0.2,
    nightIntensity: 1.5,
  });

  // Harbor podium deck
  addPart(g, new THREE.BoxGeometry(3.4, 0.5, 5.2), graniteMat, [0, 0.24, 0]);

  /**
   * Helper to build one soaring spherical sail shell vault.
   */
  const addSail = (
    x: number,
    y: number,
    z: number,
    scale: number,
    rotY: number,
    tiltX: number
  ) => {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(scale, 16, 14, 0, Math.PI * 0.92, 0, Math.PI * 0.58),
      shellMat
    );
    shell.position.set(x, y, z);
    shell.rotation.set(tiltX, rotY, 0);
    shell.scale.set(0.75, 1.35, 1.15);
    shell.castShadow = true;
    shell.receiveShadow = true;
    g.add(shell);

    // Warm glass mouth infill
    addPart(
      g,
      new THREE.ConeGeometry(scale * 0.65, scale * 1.15, 3),
      glassMat,
      [x, y + scale * 0.45, z],
      [tiltX * 0.4, rotY, 0],
      false,
      false
    );
  };

  // Main Concert Hall cluster (4 soaring sails)
  addSail(-0.62, 0.45, -1.3, 1.15, 0, -0.35);
  addSail(-0.62, 0.5, -0.4, 1.48, 0, -0.3);
  addSail(-0.62, 0.48, 0.55, 1.32, 0, 0.32);
  addSail(-0.62, 0.42, 1.35, 0.95, 0, 0.38);

  // Joan Sutherland Theatre cluster (3 sails)
  addSail(0.72, 0.42, -1.0, 1.02, 0.15, -0.32);
  addSail(0.72, 0.48, -0.15, 1.28, 0.15, -0.26);
  addSail(0.72, 0.42, 0.72, 0.92, 0.15, 0.34);

  // Bennelong Restaurant sail at tip
  addSail(0.08, 0.38, 1.95, 0.85, 0.2, -0.35);
}

/**
 * Builds the Taj Mahal (Agra, India): white Makrana marble plinth, 4 minarets,
 * recessed pishtaq arches, sculpted bulbous onion dome, and Charbagh reflecting pool.
 */
function buildTajMahal(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 3.4, '#4e7344');

  const marbleMat = new THREE.MeshStandardMaterial({
    color: '#f8f5ef',
    emissive: '#ffdcb8',
    emissiveIntensity: 0.04,
    roughness: 0.38,
    metalness: 0.05,
  });
  ctx.nightGlowMaterials.push({
    material: marbleMat,
    dayIntensity: 0.04,
    nightIntensity: 0.32,
  });
  const archMat = new THREE.MeshStandardMaterial({ color: '#39414a', roughness: 0.7 });
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3aa0b8', roughness: 0.18, metalness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c542', roughness: 0.25, metalness: 0.85 });

  // White marble platform + red sandstone forecourt + reflecting pool
  addPart(g, new THREE.BoxGeometry(3.2, 0.38, 3.2), marbleMat, [0, 0.18, -0.5]);
  addPart(g, new THREE.BoxGeometry(0.65, 0.06, 2.75), waterMat, [0, 0.06, 2.15], [0, 0, 0], false, true);

  // Main chamfered marble mausoleum
  addPart(g, new THREE.CylinderGeometry(1.18, 1.18, 1.38, 8), marbleMat, [0, 1.06, -0.5], [0, Math.PI / 8, 0]);

  // 4 grand arched pishtaq portals
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const dist = 0.96;
    addPart(
      g,
      new THREE.BoxGeometry(0.82, 1.56, 0.24),
      marbleMat,
      [Math.sin(angle) * dist, 1.14, -0.5 + Math.cos(angle) * dist],
      [0, angle, 0]
    );
    addPart(
      g,
      new THREE.BoxGeometry(0.52, 1.08, 0.08),
      archMat,
      [Math.sin(angle) * (dist + 0.1), 0.98, -0.5 + Math.cos(angle) * (dist + 0.1)],
      [0, angle, 0]
    );
  }

  // Iconic bulbous onion dome via LatheGeometry
  const domePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.68, 0.0),
    new THREE.Vector2(0.76, 0.35),
    new THREE.Vector2(0.72, 0.72),
    new THREE.Vector2(0.42, 1.15),
    new THREE.Vector2(0.1, 1.42),
    new THREE.Vector2(0.0, 1.52),
  ];
  const domeGeo = new THREE.LatheGeometry(domePoints, 24);
  addPart(g, new THREE.CylinderGeometry(0.72, 0.72, 0.45, 24), marbleMat, [0, 1.92, -0.5]);
  addPart(g, domeGeo, marbleMat, [0, 2.12, -0.5]);
  addPart(g, new THREE.CylinderGeometry(0.02, 0.06, 0.55, 8), goldMat, [0, 3.85, -0.5]);

  // 4 roof chhatri domes
  for (const [cx, cz] of [
    [0.64, 0.14],
    [-0.64, 0.14],
    [0.64, -1.14],
    [-0.64, -1.14],
  ]) {
    addPart(g, new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8), marbleMat, [cx, 1.9, cz]);
    addPart(g, new THREE.SphereGeometry(0.22, 10, 10), marbleMat, [cx, 2.1, cz]);
  }

  // 4 corner minarets
  for (const [mx, mz] of [
    [1.38, 0.88],
    [-1.38, 0.88],
    [1.38, -1.88],
    [-1.38, -1.88],
  ]) {
    addPart(g, new THREE.CylinderGeometry(0.11, 0.16, 2.15, 12), marbleMat, [mx, 1.42, mz]);
    addPart(g, new THREE.SphereGeometry(0.14, 10, 10), marbleMat, [mx, 2.6, mz]);
    addPart(g, new THREE.CylinderGeometry(0.015, 0.03, 0.25, 6), goldMat, [mx, 2.78, mz]);
  }
}

/**
 * Builds Christ the Redeemer crowning the lush green Corcovado peak above Rio.
 */
function buildChristRedeemer(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 2.7, '#2d5c33');

  const peakMat = new THREE.MeshStandardMaterial({ color: '#336b38', roughness: 0.92 });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#6b6862', roughness: 0.88 });
  const soapstoneMat = new THREE.MeshStandardMaterial({
    color: '#f2f0eb',
    emissive: '#cce7ff',
    emissiveIntensity: 0.12,
    roughness: 0.55,
  });
  ctx.nightGlowMaterials.push({
    material: soapstoneMat,
    dayIntensity: 0.08,
    nightIntensity: 0.92,
  });

  // Dramatic Corcovado mountain peak
  addPart(g, new THREE.ConeGeometry(2.5, 3.25, 10), peakMat, [0, 1.58, 0]);
  addPart(g, new THREE.CylinderGeometry(1.1, 1.5, 0.7, 9), rockMat, [0, 2.75, 0]);

  // Art Deco stone pedestal
  addPart(g, new THREE.BoxGeometry(0.95, 0.78, 0.95), rockMat, [0, 3.45, 0]);

  // Christ figure with wide outstretched arms
  addPart(g, new THREE.CylinderGeometry(0.28, 0.42, 1.85, 10), soapstoneMat, [0, 4.72, 0]);
  addPart(g, new THREE.BoxGeometry(3.1, 0.34, 0.34), soapstoneMat, [0, 5.42, 0]);
  addPart(g, new THREE.SphereGeometry(0.24, 12, 12), soapstoneMat, [0, 5.9, 0]);
}

/**
 * Builds the Golden Gate Bridge: International Orange stepped Art Deco towers,
 * sweeping parabolic main suspension cables, suspender cables, and illuminated roadway.
 */
function buildGoldenGateBridge(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 1.8, '#235978');

  const orangeMat = new THREE.MeshStandardMaterial({
    color: '#c93a28',
    roughness: 0.45,
    metalness: 0.32,
  });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#8e8d87', roughness: 0.88 });
  const roadMat = new THREE.MeshStandardMaterial({ color: '#393d44', roughness: 0.82 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#ffd89a',
    emissive: '#ffb048',
    emissiveIntensity: 0.4,
    roughness: 0.3,
  });
  ctx.nightGlowMaterials.push({
    material: lampMat,
    dayIntensity: 0.2,
    nightIntensity: 2.2,
  });

  // Roadway deck spanning 9.2 units
  addPart(g, new THREE.BoxGeometry(0.78, 0.18, 9.2), roadMat, [0, 1.32, 0]);
  addPart(g, new THREE.BoxGeometry(0.84, 0.08, 9.2), orangeMat, [0, 1.24, 0]);

  // Illuminated centerline bridge lamps
  for (let z = -4.2; z <= 4.2; z += 0.7) {
    addPart(g, new THREE.SphereGeometry(0.055, 6, 6), lampMat, [0.32, 1.46, z], [0, 0, 0], false, false);
    addPart(g, new THREE.SphereGeometry(0.055, 6, 6), lampMat, [-0.32, 1.46, z], [0, 0, 0], false, false);
  }

  // Twin Art Deco stepped towers at z = -2.1 and z = +2.1
  for (const tz of [-2.1, 2.1]) {
    addPart(g, new THREE.BoxGeometry(1.15, 0.5, 0.78), concreteMat, [0, 0.18, tz]);
    for (const tx of [-0.42, 0.42]) {
      addPart(g, new THREE.BoxGeometry(0.2, 4.45, 0.24), orangeMat, [tx, 2.4, tz]);
    }
    // Horizontal cross-struts
    for (const cy of [1.8, 2.75, 3.65, 4.45]) {
      addPart(g, new THREE.BoxGeometry(0.92, 0.16, 0.2), orangeMat, [0, cy, tz]);
    }
  }

  // Sweeping parabolic catenary main suspension cables on both sides
  for (const cx of [-0.42, 0.42]) {
    const cablePts = [
      new THREE.Vector3(cx, 1.38, -4.6),
      new THREE.Vector3(cx, 2.55, -3.35),
      new THREE.Vector3(cx, 4.58, -2.1),
      new THREE.Vector3(cx, 2.18, -0.9),
      new THREE.Vector3(cx, 1.56, 0.0),
      new THREE.Vector3(cx, 2.18, 0.9),
      new THREE.Vector3(cx, 4.58, 2.1),
      new THREE.Vector3(cx, 2.55, 3.35),
      new THREE.Vector3(cx, 1.38, 4.6),
    ];
    const curve = new THREE.CatmullRomCurve3(cablePts);
    const cableGeo = new THREE.TubeGeometry(curve, 44, 0.055, 6, false);
    addPart(g, cableGeo, orangeMat);

    // Vertical suspender cables
    for (let t = 0.08; t <= 0.92; t += 0.06) {
      const pt = curve.getPoint(t);
      if (pt.y > 1.48) {
        addStrut(
          g,
          new THREE.Vector3(cx, 1.38, pt.z),
          new THREE.Vector3(cx, pt.y, pt.z),
          0.016,
          0.016,
          orangeMat,
          4
        );
      }
    }
  }
}

/**
 * Builds Mount Fuji & Tokyo Tower side-by-side: snow-capped symmetrical volcano
 * paired with Japan's vermilion-and-white steel lattice observation tower.
 */
function buildFujiAndTokyoTower(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 4.2, '#415e3b');

  const basaltMat = new THREE.MeshStandardMaterial({ color: '#4c525c', roughness: 0.92 });
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f7f9ff', roughness: 0.48 });
  const redMat = new THREE.MeshStandardMaterial({ color: '#df3f2c', roughness: 0.45, metalness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f4f4f6', roughness: 0.45 });
  const obsMat = new THREE.MeshStandardMaterial({
    color: '#ffe0a3',
    emissive: '#ff9c3b',
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  ctx.nightGlowMaterials.push({
    material: obsMat,
    dayIntensity: 0.25,
    nightIntensity: 2.0,
  });

  // Mount Fuji (concave volcanic profile via LatheGeometry)
  const fujiGroup = new THREE.Group();
  fujiGroup.position.set(-1.35, 0, -0.35);
  const fujiPts = [
    new THREE.Vector2(2.65, 0),
    new THREE.Vector2(2.05, 0.72),
    new THREE.Vector2(1.42, 1.55),
    new THREE.Vector2(0.82, 2.45),
    new THREE.Vector2(0.45, 3.05),
    new THREE.Vector2(0.28, 2.98),
    new THREE.Vector2(0.0, 2.94),
  ];
  addPart(fujiGroup, new THREE.LatheGeometry(fujiPts, 28), basaltMat);

  // Snowcap mantle
  const snowPts = [
    new THREE.Vector2(1.28, 1.85),
    new THREE.Vector2(0.84, 2.47),
    new THREE.Vector2(0.46, 3.07),
    new THREE.Vector2(0.28, 3.0),
    new THREE.Vector2(0.0, 2.96),
  ];
  addPart(fujiGroup, new THREE.LatheGeometry(snowPts, 28), snowMat);
  g.add(fujiGroup);

  // Tokyo Tower beside Fuji
  const tt = new THREE.Group();
  tt.position.set(1.85, 0, 0.85);
  const tiers = [
    { y: 0.05, h: 0.88, r: 0.09, mat: redMat },
    { y: 1.55, h: 0.48, r: 0.07, mat: whiteMat },
    { y: 2.55, h: 0.34, r: 0.055, mat: redMat },
    { y: 3.95, h: 0.18, r: 0.04, mat: whiteMat },
    { y: 5.15, h: 0.1, r: 0.025, mat: redMat },
  ];
  const corners: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  for (let t = 0; t < tiers.length - 1; t++) {
    const a = tiers[t];
    const b = tiers[t + 1];
    for (let c = 0; c < 4; c++) {
      const [sx, sz] = corners[c];
      const [nx, nz] = corners[(c + 1) % 4];
      const p1 = new THREE.Vector3(sx * a.h, a.y, sz * a.h);
      const p2 = new THREE.Vector3(sx * b.h, b.y, sz * b.h);
      const p2n = new THREE.Vector3(nx * b.h, b.y, nz * b.h);
      addStrut(tt, p1, p2, a.r, b.r, a.mat, 5);
      addStrut(tt, p2, p2n, 0.032, 0.032, a.mat, 4);
    }
  }
  addPart(tt, new THREE.BoxGeometry(0.86, 0.24, 0.86), obsMat, [0, 2.55, 0]);
  addPart(tt, new THREE.BoxGeometry(0.42, 0.2, 0.42), obsMat, [0, 4.1, 0]);
  addPart(tt, new THREE.CylinderGeometry(0.02, 0.07, 1.45, 8), whiteMat, [0, 5.75, 0]);

  const strobeMat = new THREE.MeshStandardMaterial({
    color: '#ff4238',
    emissive: '#ff2b1c',
    emissiveIntensity: 2.0,
  });
  ctx.strobeMaterials.push({
    material: strobeMat,
    phase: 1.5,
    baseColor: new THREE.Color('#ff2b1c'),
  });
  addPart(tt, new THREE.SphereGeometry(0.1, 8, 8), strobeMat, [0, 6.5, 0], [0, 0, 0], false, false);
  g.add(tt);
}

/**
 * Builds the Burj Khalifa (Dubai): ultra-tall spiraling Y-wing setback glass spire.
 */
function buildBurjKhalifa(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 2.4, '#c7b084');

  const waterMat = new THREE.MeshStandardMaterial({ color: '#2ab3c7', roughness: 0.16, metalness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#9ec4d9',
    emissive: '#6ad8ff',
    emissiveIntensity: 0.12,
    roughness: 0.18,
    metalness: 0.78,
  });
  ctx.nightGlowMaterials.push({
    material: glassMat,
    dayIntensity: 0.08,
    nightIntensity: 1.15,
  });

  addPart(g, new THREE.CylinderGeometry(1.75, 1.8, 0.1, 24), waterMat, [0, 0.04, 0], [0, 0, 0], false, true);

  // Spiraling Y-wing setbacks ascending over 7 tiers
  const wingHeights = [1.4, 2.3, 3.2, 4.2, 5.1, 6.0, 7.1];
  for (let tier = 0; tier < wingHeights.length; tier++) {
    const h = wingHeights[tier];
    const wingLen = 1.05 - tier * 0.12;
    const wingThick = 0.34 - tier * 0.032;
    const angle = (tier % 3) * ((Math.PI * 2) / 3);
    addPart(
      g,
      new THREE.CylinderGeometry(wingThick * 0.72, wingThick * 0.85, h, 8),
      glassMat,
      [Math.cos(angle) * wingLen * 0.45, h / 2, Math.sin(angle) * wingLen * 0.45]
    );
  }

  // Central hexagonal core + needle spire
  addPart(g, new THREE.CylinderGeometry(0.16, 0.36, 7.35, 6), glassMat, [0, 3.68, 0]);
  addPart(g, new THREE.CylinderGeometry(0.018, 0.11, 1.55, 8), glassMat, [0, 8.05, 0]);

  const strobeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#bdefff',
    emissiveIntensity: 2.2,
  });
  ctx.strobeMaterials.push({
    material: strobeMat,
    phase: 0.8,
    baseColor: new THREE.Color('#bdefff'),
  });
  addPart(g, new THREE.SphereGeometry(0.12, 10, 10), strobeMat, [0, 8.85, 0], [0, 0, 0], false, false);
}

/**
 * Builds Big Ben & Palace of Westminster (London): Neo-Gothic limestone tower,
 * 4 glowing golden clock dials, dark slate roof spire, and Westminster wing.
 */
function buildBigBen(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 2.5, '#4c6643');

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#cbb489', roughness: 0.78 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#37424a', roughness: 0.65, metalness: 0.2 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffd159', roughness: 0.3, metalness: 0.7 });
  const clockGlowMat = new THREE.MeshStandardMaterial({
    color: '#fff3cf',
    emissive: '#ffcf6e',
    emissiveIntensity: 0.55,
    roughness: 0.3,
  });
  ctx.nightGlowMaterials.push({
    material: clockGlowMat,
    dayIntensity: 0.4,
    nightIntensity: 2.4,
  });

  // Westminster Palace wing along the Thames
  addPart(g, new THREE.BoxGeometry(2.6, 1.45, 1.2), stoneMat, [-1.15, 0.72, 0]);
  addPart(g, new THREE.BoxGeometry(2.7, 0.35, 1.3), roofMat, [-1.15, 1.58, 0]);
  for (const tx of [-2.25, -0.35]) {
    addPart(g, new THREE.ConeGeometry(0.24, 0.85, 4), roofMat, [tx, 1.98, 0], [0, Math.PI / 4, 0]);
  }

  // Elizabeth Tower (Big Ben) shaft
  addPart(g, new THREE.BoxGeometry(0.98, 3.6, 0.98), stoneMat, [0.8, 1.8, 0]);
  // Clock housing cube
  addPart(g, new THREE.BoxGeometry(1.12, 1.05, 1.12), stoneMat, [0.8, 3.92, 0]);

  // 4 iconic glowing golden clock dials
  const dialOffsets: [[number, number, number], [number, number, number]][] = [
    [[0.8, 3.92, 0.58], [0, 0, 0]],
    [[0.8, 3.92, -0.58], [0, Math.PI, 0]],
    [[1.38, 3.92, 0], [0, Math.PI / 2, 0]],
    [[0.22, 3.92, 0], [0, -Math.PI / 2, 0]],
  ];
  for (const [pos, rot] of dialOffsets) {
    addPart(g, new THREE.CylinderGeometry(0.38, 0.38, 0.05, 18), clockGlowMat, pos, [Math.PI / 2 + rot[0], rot[1], rot[2]]);
  }

  // Ornate belfry + steep Neo-Gothic slate spire + golden finial
  addPart(g, new THREE.BoxGeometry(0.92, 0.55, 0.92), goldMat, [0.8, 4.65, 0]);
  addPart(g, new THREE.ConeGeometry(0.68, 1.55, 4), roofMat, [0.8, 5.65, 0], [0, Math.PI / 4, 0]);
  addPart(g, new THREE.CylinderGeometry(0.02, 0.05, 0.45, 6), goldMat, [0.8, 6.48, 0]);
}

/**
 * Builds Chichen Itza (El Castillo, Mexico): 9-tiered Mayan limestone step pyramid
 * with 4 monumental staircases and emerald Yucatan jungle canopy clusters.
 */
function buildChichenItza(ctx: BuiltLandmark): void {
  const g = ctx.group;
  addFoundationPad(g, 3.6, '#396130');

  const limestoneMat = new THREE.MeshStandardMaterial({ color: '#c4ba9e', roughness: 0.88 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#45433b', roughness: 0.92 });
  const jungleMat = new THREE.MeshStandardMaterial({ color: '#2b5e27', roughness: 0.88 });

  // 9 stepped Mayan tiers
  const tiers = 9;
  for (let i = 0; i < tiers; i++) {
    const size = 3.5 - i * 0.26;
    const y = 0.16 + i * 0.3;
    addPart(g, new THREE.BoxGeometry(size, 0.3, size), limestoneMat, [0, y, 0]);
  }

  // 4 steep staircases ascending each face
  for (let s = 0; s < 4; s++) {
    const stairGroup = new THREE.Group();
    stairGroup.rotation.y = (s * Math.PI) / 2;
    addPart(stairGroup, new THREE.BoxGeometry(0.55, 0.25, 2.85), limestoneMat, [0, 1.4, 1.1], [-0.82, 0, 0]);
    g.add(stairGroup);
  }

  // Summit Temple of Kukulcan
  addPart(g, new THREE.BoxGeometry(1.15, 0.72, 1.15), limestoneMat, [0, 3.12, 0]);
  addPart(g, new THREE.BoxGeometry(0.32, 0.44, 0.16), darkStoneMat, [0, 3.04, 0.56]);

  // Surrounding Yucatan jungle canopy clusters
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    const r = 2.6 + (i % 3) * 0.38;
    addPart(
      g,
      new THREE.DodecahedronGeometry(0.42 + (i % 2) * 0.16, 1),
      jungleMat,
      [Math.cos(a) * r, 0.24, Math.sin(a) * r]
    );
  }
}

/**
 * Factory creating the 3D procedural architectural landmark mesh for a given landmark ID.
 *
 * @param id - Landmark identifier from LANDMARKS.
 * @returns BuiltLandmark containing the root Group and animatable night/strobe materials.
 */
export function createLandmarkModel(id: string): BuiltLandmark {
  const ctx: BuiltLandmark = {
    group: new THREE.Group(),
    nightGlowMaterials: [],
    strobeMaterials: [],
  };

  switch (id) {
    case 'eiffel':
      buildEiffelTower(ctx);
      break;
    case 'liberty':
      buildStatueOfLiberty(ctx);
      break;
    case 'giza':
      buildGizaPyramids(ctx);
      break;
    case 'colosseum':
      buildColosseum(ctx);
      break;
    case 'sydney':
      buildSydneyOperaHouse(ctx);
      break;
    case 'tajmahal':
      buildTajMahal(ctx);
      break;
    case 'redeemer':
      buildChristRedeemer(ctx);
      break;
    case 'goldengate':
      buildGoldenGateBridge(ctx);
      break;
    case 'fuji_tokyo':
      buildFujiAndTokyoTower(ctx);
      break;
    case 'burj':
      buildBurjKhalifa(ctx);
      break;
    case 'bigben':
      buildBigBen(ctx);
      break;
    case 'chichen':
      buildChichenItza(ctx);
      break;
    default:
      addFoundationPad(ctx.group, 1.5, '#888888');
  }

  return ctx;
}
