import * as THREE from 'three';
import { GLOBE_RADIUS, latLonToVector3 } from '../math/globeMath.js';
import { LANDMARKS } from './landmarksData.js';

export class LandmarkBuilder {
  constructor(scene) {
    this.scene = scene;
    this.landmarksGroup = new THREE.Group();
    this.landmarksGroup.name = 'LandmarksGroup';
    this.scene.add(this.landmarksGroup);

    this.landmarkInstances = [];
    this.initLandmarks();
  }

  initLandmarks() {
    LANDMARKS.forEach(data => {
      const landmarkObj = this.createLandmark(data);
      this.landmarksGroup.add(landmarkObj.group);
      this.landmarkInstances.push(landmarkObj);
    });
  }

  createLandmark(data) {
    const group = new THREE.Group();
    group.name = `Landmark_${data.id}`;

    // Compute surface position on globe
    const surfacePos = latLonToVector3(data.lat, data.lon, GLOBE_RADIUS);
    group.position.copy(surfacePos);

    // Orient group so local +Y points away from globe center (surface normal)
    const normal = surfacePos.clone().normalize();
    const upVector = new THREE.Vector3(0, 1, 0);
    group.quaternion.setFromUnitVectors(upVector, normal);

    // Build the specific 3D model
    const model = this.buildModelById(data.id, data);
    group.add(model);

    // Checkpoint glowing ring hovering at flight altitude
    const ringRadius = 1.35;
    const ringGeometry = new THREE.TorusGeometry(ringRadius, 0.12, 16, 48);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.color),
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.position.set(0, data.ringHeight, 0);
    // Orient ring horizontally or facing incoming flight
    ringMesh.rotation.x = Math.PI * 0.5;
    group.add(ringMesh);

    // Glowing inner energy disc inside checkpoint ring
    const discGeometry = new THREE.CircleGeometry(ringRadius * 0.92, 32);
    const discMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(data.color),
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const discMesh = new THREE.Mesh(discGeometry, discMaterial);
    discMesh.position.set(0, data.ringHeight, 0);
    discMesh.rotation.x = Math.PI * 0.5;
    group.add(discMesh);

    // Vertical sky beacon beam (visible from orbit/distance)
    const beamGeometry = new THREE.CylinderGeometry(0.12, 0.45, 18, 16, 1, true);
    beamGeometry.translate(0, 9, 0);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(data.color),
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
    group.add(beamMesh);

    // Calculate world position of the checkpoint ring center for collision detection
    const ringWorldPos = new THREE.Vector3();

    return {
      data,
      group,
      model,
      ringMesh,
      discMesh,
      beamMesh,
      ringWorldPos,
      visited: false,
      color: data.color
    };
  }

  buildModelById(id, data) {
    const container = new THREE.Group();

    switch (id) {
      case 'eiffel-tower':
        this.buildEiffelTower(container);
        break;
      case 'statue-of-liberty':
        this.buildStatueOfLiberty(container);
        break;
      case 'pyramids-giza':
        this.buildPyramids(container);
        break;
      case 'big-ben':
        this.buildBigBen(container);
        break;
      case 'colosseum':
        this.buildColosseum(container);
        break;
      case 'taj-mahal':
        this.buildTajMahal(container);
        break;
      case 'mount-fuji':
        this.buildMountFuji(container);
        break;
      case 'sydney-opera':
        this.buildSydneyOpera(container);
        break;
      case 'christ-redeemer':
        this.buildChristRedeemer(container);
        break;
      case 'golden-gate':
        this.buildGoldenGate(container);
        break;
      case 'great-wall':
        this.buildGreatWall(container);
        break;
      case 'burj-khalifa':
        this.buildBurjKhalifa(container);
        break;
      case 'chichen-itza':
        this.buildChichenItza(container);
        break;
      case 'stonehenge':
        this.buildStonehenge(container);
        break;
      default:
        this.buildGenericMonument(container);
    }

    return container;
  }

  // 1. EIFFEL TOWER (Paris, France)
  buildEiffelTower(group) {
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x82705d,
      roughness: 0.65,
      metalness: 0.75
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x4d3e33,
      roughness: 0.7,
      metalness: 0.8
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xaa8800,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.9
    });

    // 4 Splayed curved lattice legs
    const legSpread = 0.9;
    const legPositions = [
      [-legSpread, -legSpread],
      [legSpread, -legSpread],
      [legSpread, legSpread],
      [-legSpread, legSpread]
    ];

    legPositions.forEach(([lx, lz]) => {
      const legGeom = new THREE.CylinderGeometry(0.12, 0.22, 1.2, 8);
      const leg = new THREE.Mesh(legGeom, darkIronMat);
      leg.position.set(lx, 0.6, lz);
      leg.rotation.x = (lz > 0 ? -1 : 1) * 0.25;
      leg.rotation.z = (lx > 0 ? 1 : -1) * 0.25;
      group.add(leg);
    });

    // Decorative base arches between legs
    const archMat = new THREE.MeshStandardMaterial({ color: 0x6e5d4e, roughness: 0.7 });
    for (let r = 0; r < 4; r++) {
      const archGeom = new THREE.TorusGeometry(0.7, 0.06, 8, 16, Math.PI);
      const arch = new THREE.Mesh(archGeom, archMat);
      arch.rotation.y = r * (Math.PI / 2);
      arch.rotation.z = Math.PI;
      arch.position.set(0, 0.45, 0);
      group.add(arch);
    }

    // Level 1 Platform
    const p1Geom = new THREE.BoxGeometry(1.6, 0.14, 1.6);
    const p1 = new THREE.Mesh(p1Geom, ironMat);
    p1.position.set(0, 1.2, 0);
    group.add(p1);

    // Mid tower legs to Level 2
    const midSpread = 0.45;
    const midLegPositions = [
      [-midSpread, -midSpread],
      [midSpread, -midSpread],
      [midSpread, midSpread],
      [-midSpread, midSpread]
    ];
    midLegPositions.forEach(([mx, mz]) => {
      const mLegGeom = new THREE.CylinderGeometry(0.08, 0.12, 1.0, 8);
      const mLeg = new THREE.Mesh(mLegGeom, ironMat);
      mLeg.position.set(mx, 1.75, mz);
      mLeg.rotation.x = (mz > 0 ? -1 : 1) * 0.18;
      mLeg.rotation.z = (mx > 0 ? 1 : -1) * 0.18;
      group.add(mLeg);
    });

    // Level 2 Platform
    const p2Geom = new THREE.BoxGeometry(1.0, 0.12, 1.0);
    const p2 = new THREE.Mesh(p2Geom, ironMat);
    p2.position.set(0, 2.3, 0);
    group.add(p2);

    // Upper Spire Tower
    const spireGeom = new THREE.ConeGeometry(0.35, 1.8, 8);
    const spire = new THREE.Mesh(spireGeom, ironMat);
    spire.position.set(0, 3.2, 0);
    group.add(spire);

    // Top Cupola Dome & Beacon Mast
    const domeGeom = new THREE.SphereGeometry(0.18, 12, 12);
    const dome = new THREE.Mesh(domeGeom, goldMat);
    dome.position.set(0, 4.15, 0);
    group.add(dome);

    const mastGeom = new THREE.CylinderGeometry(0.02, 0.05, 0.6, 8);
    const mast = new THREE.Mesh(mastGeom, goldMat);
    mast.position.set(0, 4.5, 0);
    group.add(mast);

    // Revolving searchlight beam on top
    const searchlightGeom = new THREE.ConeGeometry(0.8, 4.0, 16, 1, true);
    searchlightGeom.translate(0, 2.0, 0);
    searchlightGeom.rotateX(Math.PI * 0.5);
    const searchlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const searchlight = new THREE.Mesh(searchlightGeom, searchlightMat);
    searchlight.position.set(0, 4.5, 0);
    searchlight.name = 'eiffel_searchlight';
    group.add(searchlight);
  }

  // 2. STATUE OF LIBERTY (New York, USA)
  buildStatueOfLiberty(group) {
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0x948b81, roughness: 0.85 });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0x56a386, roughness: 0.6, metalness: 0.2 });
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xff9900,
      emissiveIntensity: 2.0,
      roughness: 0.2
    });

    // Star-shaped / stepped Fort Wood base
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 2.2), graniteMat);
    base1.position.set(0, 0.175, 0);
    group.add(base1);

    const base2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), graniteMat);
    base2.position.set(0, 0.55, 0);
    group.add(base2);

    // Neoclassical Pedestal with columns
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 1.0), graniteMat);
    ped.position.set(0, 1.3, 0);
    group.add(ped);

    // Pedestal cornices
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 1.2), graniteMat);
    cornice.position.set(0, 1.9, 0);
    group.add(cornice);

    // Statue body (draped robe)
    const bodyGeom = new THREE.CylinderGeometry(0.3, 0.5, 1.4, 12);
    const body = new THREE.Mesh(bodyGeom, copperMat);
    body.position.set(0, 2.65, 0);
    group.add(body);

    // Head with radiate crown
    const headGeom = new THREE.SphereGeometry(0.2, 12, 12);
    const head = new THREE.Mesh(headGeom, copperMat);
    head.position.set(0, 3.45, 0);
    group.add(head);

    // 7 Spikes on crown
    for (let i = 0; i < 7; i++) {
      const angle = (i / 6 - 0.5) * Math.PI * 0.65;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 4), copperMat);
      spike.position.set(Math.sin(angle) * 0.22, 3.6, Math.cos(angle) * 0.22);
      spike.rotation.z = -angle * 0.6;
      group.add(spike);
    }

    // Upraised right arm holding torch
    const armGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8);
    const arm = new THREE.Mesh(armGeom, copperMat);
    arm.position.set(0.25, 3.65, 0.1);
    arm.rotation.z = -0.35;
    arm.rotation.x = -0.2;
    group.add(arm);

    // Torch & Glowing Flame
    const torchGeom = new THREE.CylinderGeometry(0.08, 0.03, 0.25, 8);
    const torch = new THREE.Mesh(torchGeom, copperMat);
    torch.position.set(0.4, 4.05, 0.2);
    group.add(torch);

    const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), flameMat);
    flame.position.set(0.4, 4.22, 0.2);
    group.add(flame);

    // Left arm holding tablet
    const tabletArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.25), copperMat);
    tabletArm.position.set(-0.3, 2.8, 0.15);
    tabletArm.rotation.z = 0.4;
    group.add(tabletArm);
  }

  // 3. GREAT PYRAMIDS & SPHINX (Cairo, Egypt)
  buildPyramids(group) {
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.9 });
    const goldCapMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xdd9900,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.85
    });

    // Desert terrain base
    const dune = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.25, 24), sandMat);
    dune.position.set(0, 0.1, 0);
    group.add(dune);

    // 1. Great Pyramid of Khufu (Main)
    const khufuGeom = new THREE.ConeGeometry(1.6, 2.2, 4);
    khufuGeom.rotateY(Math.PI * 0.25);
    const khufu = new THREE.Mesh(khufuGeom, sandMat);
    khufu.position.set(-0.4, 1.2, -0.4);
    group.add(khufu);

    // Golden Pyramidion (Cap stone)
    const capGeom = new THREE.ConeGeometry(0.35, 0.48, 4);
    capGeom.rotateY(Math.PI * 0.25);
    const cap = new THREE.Mesh(capGeom, goldCapMat);
    cap.position.set(-0.4, 2.1, -0.4);
    group.add(cap);

    // 2. Pyramid of Khafre
    const khafreGeom = new THREE.ConeGeometry(1.35, 1.9, 4);
    khafreGeom.rotateY(Math.PI * 0.25);
    const khafre = new THREE.Mesh(khafreGeom, sandMat);
    khafre.position.set(0.8, 1.05, 0.6);
    group.add(khafre);

    // 3. Pyramid of Menkaure (Smaller)
    const menkaureGeom = new THREE.ConeGeometry(0.8, 1.1, 4);
    menkaureGeom.rotateY(Math.PI * 0.25);
    const menkaure = new THREE.Mesh(menkaureGeom, sandMat);
    menkaure.position.set(1.8, 0.65, 1.4);
    group.add(menkaure);

    // 4. The Great Sphinx
    const sphinxGroup = new THREE.Group();
    sphinxGroup.position.set(-0.9, 0.2, 1.2);
    sphinxGroup.rotation.y = -Math.PI * 0.35;

    // Body (Lion)
    const sphinxBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.2), sandMat);
    sphinxBody.position.set(0, 0.18, 0);
    sphinxGroup.add(sphinxBody);

    // Paws
    const pawL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.6), sandMat);
    pawL.position.set(-0.2, 0.06, 0.7);
    const pawR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.6), sandMat);
    pawR.position.set(0.2, 0.06, 0.7);
    sphinxGroup.add(pawL);
    sphinxGroup.add(pawR);

    // Head with Pharaonic Nemes Headdress
    const sphinxHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), sandMat);
    sphinxHead.position.set(0, 0.5, 0.4);
    sphinxGroup.add(sphinxHead);

    group.add(sphinxGroup);
  }

  // 4. BIG BEN & WESTMINSTER (London, UK)
  buildBigBen(group) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc8b598, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d5a5b, roughness: 0.5, metalness: 0.6 });
    const dialMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe6a3,
      emissiveIntensity: 1.2,
      roughness: 0.3
    });

    // Palace wing base
    const palace = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.0), stoneMat);
    palace.position.set(0.7, 0.4, 0);
    group.add(palace);

    // Elizabeth Tower Shaft
    const towerGeom = new THREE.BoxGeometry(0.75, 2.5, 0.75);
    const tower = new THREE.Mesh(towerGeom, stoneMat);
    tower.position.set(-0.6, 1.25, 0);
    group.add(tower);

    // Clock Belfry box
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.75, 0.88), stoneMat);
    belfry.position.set(-0.6, 2.7, 0);
    group.add(belfry);

    // 4 Illuminated Clock Dials
    const dialGeom = new THREE.CircleGeometry(0.26, 16);
    const offsets = [
      [0, 0, 0.45, 0],
      [0, 0, -0.45, Math.PI],
      [0.45, 0, 0, Math.PI * 0.5],
      [-0.45, 0, 0, -Math.PI * 0.5]
    ];
    offsets.forEach(([dx, dy, dz, ry]) => {
      const dial = new THREE.Mesh(dialGeom, dialMat);
      dial.position.set(-0.6 + dx, 2.7 + dy, dz);
      dial.rotation.y = ry;
      group.add(dial);
    });

    // Spire roof
    const spireGeom = new THREE.ConeGeometry(0.55, 1.2, 4);
    spireGeom.rotateY(Math.PI * 0.25);
    const spire = new THREE.Mesh(spireGeom, roofMat);
    spire.position.set(-0.6, 3.65, 0);
    group.add(spire);

    // Needle finial
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.5, 8), roofMat);
    needle.position.set(-0.6, 4.35, 0);
    group.add(needle);
  }

  // 5. THE COLOSSEUM (Rome, Italy)
  buildColosseum(group) {
    const travertineMat = new THREE.MeshStandardMaterial({ color: 0xdec6a5, roughness: 0.85 });
    const innerWallMat = new THREE.MeshStandardMaterial({ color: 0xbfa382, roughness: 0.9 });
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xdfcbaf, roughness: 0.95 });

    // Outer intact curved arcade wall
    const outerGeom = new THREE.CylinderGeometry(1.6, 1.7, 1.4, 32, 1, true, 0, Math.PI * 1.55);
    const outer = new THREE.Mesh(outerGeom, travertineMat);
    outer.position.set(0, 0.7, 0);
    group.add(outer);

    // Outer wall tiers decorative rings
    for (let h = 0.35; h <= 1.4; h += 0.45) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.04, 8, 32, Math.PI * 1.55), travertineMat);
      ring.position.set(0, h, 0);
      ring.rotation.x = Math.PI * 0.5;
      group.add(ring);
    }

    // Lower ruined section
    const lowerGeom = new THREE.CylinderGeometry(1.5, 1.6, 0.7, 32, 1, true, Math.PI * 1.55, Math.PI * 0.45);
    const lower = new THREE.Mesh(lowerGeom, innerWallMat);
    lower.position.set(0, 0.35, 0);
    group.add(lower);

    // Inner stepped seating cavea tiers
    const cavea1 = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.5, 24, 1, true), innerWallMat);
    cavea1.position.set(0, 0.35, 0);
    group.add(cavea1);

    const cavea2 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.3, 24, 1, true), innerWallMat);
    cavea2.position.set(0, 0.2, 0);
    group.add(cavea2);

    // Arena sand floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), sandMat);
    floor.position.set(0, 0.1, 0);
    floor.rotation.x = -Math.PI * 0.5;
    group.add(floor);
  }

  // 6. TAJ MAHAL (Agra, India)
  buildTajMahal(group) {
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35, metalness: 0.1 });
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0d9488,
      emissiveIntensity: 0.5,
      roughness: 0.1
    });

    // Square raised plinth base
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 2.0), marbleMat);
    plinth.position.set(0, 0.15, 0);
    group.add(plinth);

    // Main central octagonal mausoleum
    const mainBody = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.9, 8), marbleMat);
    mainBody.position.set(0, 0.75, 0);
    group.add(mainBody);

    // Central Grand Onion Dome
    const domeGeom = new THREE.SphereGeometry(0.55, 16, 16);
    domeGeom.scale(1, 1.35, 1);
    const dome = new THREE.Mesh(domeGeom, marbleMat);
    dome.position.set(0, 1.7, 0);
    group.add(dome);

    // Golden Finial
    const finial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.05, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.9 })
    );
    finial.position.set(0, 2.45, 0);
    group.add(finial);

    // 4 Corner Chattris (mini domes)
    const cRadius = 0.5;
    [
      [-cRadius, -cRadius],
      [cRadius, -cRadius],
      [cRadius, cRadius],
      [-cRadius, cRadius]
    ].forEach(([cx, cz]) => {
      const cDome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), marbleMat);
      cDome.position.set(cx, 1.35, cz);
      group.add(cDome);
    });

    // 4 Tall Free-standing Corner Minarets
    const mDist = 1.05;
    [
      [-mDist, -mDist],
      [mDist, -mDist],
      [mDist, mDist],
      [-mDist, mDist]
    ].forEach(([mx, mz]) => {
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8), marbleMat);
      minaret.position.set(mx, 1.05, mz);
      // Slight outward tilt (historic architectural detail!)
      minaret.rotation.x = mz * 0.03;
      minaret.rotation.z = -mx * 0.03;
      group.add(minaret);

      // Minaret cupola
      const mCupola = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), marbleMat);
      mCupola.position.set(mx, 2.0, mz);
      group.add(mCupola);
    });

    // Cyan reflecting pool in front
    const pool = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.6), poolMat);
    pool.position.set(0, 0.02, 1.6);
    group.add(pool);
  }

  // 7. MOUNT FUJI & TORII GATE (Honshu, Japan)
  buildMountFuji(group) {
    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x333b47, roughness: 0.85 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const toriiMat = new THREE.MeshStandardMaterial({
      color: 0xeb3b1c, // Vermilion Shinto red
      emissive: 0x881100,
      emissiveIntensity: 0.35,
      roughness: 0.5
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });

    // Lower volcano cone (basalt rock)
    const volcanoBase = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.0, 24, 1, true), basaltMat);
    volcanoBase.position.set(0, 1.0, 0);
    group.add(volcanoBase);

    // Snow-capped peak
    const volcanoPeak = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 24), snowMat);
    volcanoPeak.position.set(0, 2.4, 0);
    group.add(volcanoPeak);

    // Summit caldera crater
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.2, 16), basaltMat);
    crater.position.set(0, 3.0, 0);
    group.add(crater);

    // Monumental Shinto Torii Gate standing in the foreground
    const torii = new THREE.Group();
    torii.position.set(0, 0, 1.8);

    // 2 Pillars
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 12), toriiMat);
    p1.position.set(-0.6, 0.65, 0);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 12), toriiMat);
    p2.position.set(0.6, 0.65, 0);
    torii.add(p1);
    torii.add(p2);

    // Kasagi top curved lintel (black roof cap)
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.22), blackMat);
    kasagi.position.set(0, 1.35, 0);
    torii.add(kasagi);

    // Shimaki vermilion crossbeam
    const shimaki = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.18), toriiMat);
    shimaki.position.set(0, 1.25, 0);
    torii.add(shimaki);

    // Nuki lower beam
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.14), toriiMat);
    nuki.position.set(0, 0.95, 0);
    torii.add(nuki);

    group.add(torii);
  }

  // 8. SYDNEY OPERA HOUSE (Sydney, Australia)
  buildSydneyOpera(group) {
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0x8a8479, roughness: 0.8 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.35, metalness: 0.15 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.3,
      roughness: 0.2
    });

    // Harbor promontory deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.3, 1.8), graniteMat);
    deck.position.set(0, 0.15, 0);
    group.add(deck);

    // Build series of interlocking curved sail shells
    const shellConfigs = [
      { x: -0.65, z: -0.2, h: 1.4, s: 0.8 },
      { x: -0.15, z: -0.2, h: 1.8, s: 1.0 },
      { x: 0.45, z: -0.2, h: 1.2, s: 0.7 },
      { x: -0.5, z: 0.35, h: 1.3, s: 0.75 },
      { x: 0.1, z: 0.35, h: 1.6, s: 0.9 }
    ];

    shellConfigs.forEach(cfg => {
      const sailGeom = new THREE.ConeGeometry(0.55 * cfg.s, cfg.h, 4, 1, false, 0, Math.PI * 0.85);
      sailGeom.rotateY(Math.PI * 0.25);
      sailGeom.rotateZ(0.2);
      const sail = new THREE.Mesh(sailGeom, sailMat);
      sail.position.set(cfg.x, cfg.h * 0.5 + 0.25, cfg.z);
      group.add(sail);

      // Glass front
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.4 * cfg.s, cfg.h * 0.6), glassMat);
      glass.position.set(cfg.x + 0.15, cfg.h * 0.35 + 0.25, cfg.z);
      glass.rotation.y = -Math.PI * 0.4;
      group.add(glass);
    });
  }

  // 9. CHRIST THE REDEEMER (Rio de Janeiro, Brazil)
  buildChristRedeemer(group) {
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x3d4f3b, roughness: 0.9 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xced4da, roughness: 0.5 });

    // Mount Corcovado steep peak
    const peakGeom = new THREE.CylinderGeometry(0.8, 1.8, 1.4, 8);
    const peak = new THREE.Mesh(peakGeom, mountainMat);
    peak.position.set(0, 0.7, 0);
    group.add(peak);

    // Pedestal Base
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), stoneMat);
    pedestal.position.set(0, 1.65, 0);
    group.add(pedestal);

    // Robed Body
    const bodyGeom = new THREE.CylinderGeometry(0.22, 0.38, 1.5, 8);
    const body = new THREE.Mesh(bodyGeom, stoneMat);
    body.position.set(0, 2.65, 0);
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), stoneMat);
    head.position.set(0, 3.55, 0);
    group.add(head);

    // Outstretched arms (monumental wingspan!)
    const armsGeom = new THREE.BoxGeometry(2.4, 0.22, 0.22);
    const arms = new THREE.Mesh(armsGeom, stoneMat);
    arms.position.set(0, 3.25, 0);
    group.add(arms);
  }

  // 10. GOLDEN GATE BRIDGE (San Francisco, USA)
  buildGoldenGate(group) {
    const intOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xc0362c, // International Orange
      roughness: 0.5,
      metalness: 0.3
    });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1e40af,
      roughness: 0.1,
      metalness: 0.8
    });

    // Bay water strip
    const bay = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 1.4), waterMat);
    bay.position.set(0, 0.02, 0);
    group.add(bay);

    // Suspended road deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.4), deckMat);
    deck.position.set(0, 0.75, 0);
    group.add(deck);

    // Twin Art Deco Suspension Towers
    [-1.0, 1.0].forEach(tx => {
      // 2 Legs per tower
      [-0.15, 0.15].forEach(tz => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.5, 0.12), intOrangeMat);
        leg.position.set(tx, 1.25, tz);
        group.add(leg);
      });

      // Cross struts / chevron bracing
      for (let sh = 0.8; sh <= 2.3; sh += 0.5) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.34), intOrangeMat);
        strut.position.set(tx, sh, 0);
        group.add(strut);
      }
    });

    // Sweeping parabolic suspension cables
    [-0.15, 0.15].forEach(cz => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.7, 0.8, cz),
        new THREE.Vector3(-1.0, 2.45, cz),
        new THREE.Vector3(0, 0.9, cz),
        new THREE.Vector3(1.0, 2.45, cz),
        new THREE.Vector3(1.7, 0.8, cz)
      ]);
      const cableGeom = new THREE.TubeGeometry(curve, 32, 0.025, 6, false);
      const cable = new THREE.Mesh(cableGeom, intOrangeMat);
      group.add(cable);
    });
  }

  // 11. GREAT WALL OF CHINA (China)
  buildGreatWall(group) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8272, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 });

    // Serpentine wall segments snaking along mountain curves
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.5, 0.2, -0.6),
      new THREE.Vector3(-0.7, 0.5, -0.2),
      new THREE.Vector3(0.1, 0.7, 0.2),
      new THREE.Vector3(0.8, 0.4, 0.6),
      new THREE.Vector3(1.6, 0.3, 0.9)
    ]);

    const wallGeom = new THREE.TubeGeometry(path, 32, 0.18, 6, false);
    const wall = new THREE.Mesh(wallGeom, stoneMat);
    group.add(wall);

    // Watchtower 1
    const tower1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.65), stoneMat);
    tower1.position.set(-0.7, 0.65, -0.2);
    group.add(tower1);

    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 4), roofMat);
    roof1.rotateY(Math.PI * 0.25);
    roof1.position.set(-0.7, 1.2, -0.2);
    group.add(roof1);

    // Watchtower 2
    const tower2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.65), stoneMat);
    tower2.position.set(0.8, 0.55, 0.6);
    group.add(tower2);

    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 4), roofMat);
    roof2.rotateY(Math.PI * 0.25);
    roof2.position.set(0.8, 1.1, 0.6);
    group.add(roof2);
  }

  // 12. BURJ KHALIFA (Dubai, UAE)
  buildBurjKhalifa(group) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.2,
      metalness: 0.85
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.95
    });
    const strobeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3.0
    });

    // Stepping spire tiers (Y-shaped setbacks)
    const tiers = [
      { r: 0.75, h: 1.0, y: 0.5 },
      { r: 0.55, h: 1.0, y: 1.5 },
      { r: 0.4, h: 1.0, y: 2.5 },
      { r: 0.28, h: 0.9, y: 3.45 },
      { r: 0.18, h: 0.8, y: 4.3 }
    ];

    tiers.forEach(t => {
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.85, t.r, t.h, 6), glassMat);
      tier.position.set(0, t.y, 0);
      group.add(tier);
    });

    // Soaring needle pinnacle spire
    const pinnacle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 1.4, 8), steelMat);
    pinnacle.position.set(0, 5.4, 0);
    group.add(pinnacle);

    // Flashing aircraft warning strobe
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), strobeMat);
    strobe.position.set(0, 6.1, 0);
    strobe.name = 'burj_strobe';
    group.add(strobe);
  }

  // 13. CHICHEN ITZA PYRAMID (Yucatan, Mexico)
  buildChichenItza(group) {
    const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xc4b59d, roughness: 0.85 });

    // 9 Stepped tiers
    let currentY = 0.1;
    let size = 2.2;
    for (let i = 0; i < 9; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(size, 0.16, size), limestoneMat);
      step.position.set(0, currentY, 0);
      group.add(step);
      currentY += 0.16;
      size -= 0.18;
    }

    // Summit temple sanctuary
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.75), limestoneMat);
    temple.position.set(0, currentY + 0.1, 0);
    group.add(temple);

    // 4 Staircases
    const stairMat = new THREE.MeshStandardMaterial({ color: 0xad9e87, roughness: 0.9 });
    for (let r = 0; r < 4; r++) {
      const stairGeom = new THREE.BoxGeometry(0.35, 1.4, 0.9);
      stairGeom.rotateX(-0.55);
      const stair = new THREE.Mesh(stairGeom, stairMat);
      stair.rotation.y = r * (Math.PI / 2);
      stair.position.set(0, 0.7, 0);
      group.add(stair);
    }
  }

  // 14. STONEHENGE (Wiltshire, UK)
  buildStonehenge(group) {
    const sarsenMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9 });

    // Circular grassy earthwork
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.1, 32), grassMat);
    ground.position.set(0, 0.05, 0);
    group.add(ground);

    // Outer circle of standing megaliths
    const stoneCount = 14;
    const radius = 1.3;
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Vertical sarsen stone
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.14), sarsenMat);
      stone.position.set(x, 0.5, z);
      stone.rotation.y = -angle;
      group.add(stone);

      // Horizontal lintel stone connecting adjacent stones
      if (i % 2 === 0) {
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.16), sarsenMat);
        lintel.position.set(x, 1.0, z);
        lintel.rotation.y = -angle;
        group.add(lintel);
      }
    }

    // Inner horseshoe trilithons (taller)
    for (let j = 0; j < 5; j++) {
      const hAngle = (j / 4 - 0.5) * Math.PI * 1.2;
      const hx = Math.cos(hAngle) * 0.7;
      const hz = Math.sin(hAngle) * 0.7;

      const innerStone = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.3, 0.16), sarsenMat);
      innerStone.position.set(hx, 0.7, hz);
      innerStone.rotation.y = -hAngle;
      group.add(innerStone);
    }
  }

  buildGenericMonument(group) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5, metalness: 0.6 });
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.35, 2.5, 4), mat);
    obelisk.position.set(0, 1.25, 0);
    group.add(obelisk);
  }

  update(delta, time) {
    // Animate checkpoint rings (slow rotation + gentle vertical float)
    this.landmarkInstances.forEach(inst => {
      if (inst.ringMesh) {
        inst.ringMesh.rotation.z += delta * 1.2;
        // Subtle vertical bounce
        const floatOffset = Math.sin(time * 2.5 + inst.data.lat) * 0.15;
        inst.ringMesh.position.y = inst.data.ringHeight + floatOffset;
        if (inst.discMesh) {
          inst.discMesh.position.y = inst.data.ringHeight + floatOffset;
        }

        // Cache world position for proximity tests
        inst.ringMesh.getWorldPosition(inst.ringWorldPos);
      }

      // If visited, soften beam or turn emerald
      if (inst.visited && inst.beamMesh) {
        inst.beamMesh.material.color.set(0x10b981);
        inst.ringMesh.material.color.set(0x10b981);
        inst.ringMesh.material.emissive.set(0x10b981);
      }
    });

    // Animate Eiffel Tower searchlight rotation
    const eiffel = this.landmarkInstances.find(l => l.data.id === 'eiffel-tower');
    if (eiffel) {
      const searchlight = eiffel.model.getObjectByName('eiffel_searchlight');
      if (searchlight) {
        searchlight.rotation.y += delta * 1.5;
      }
    }

    // Blink Burj Khalifa strobe
    const burj = this.landmarkInstances.find(l => l.data.id === 'burj-khalifa');
    if (burj) {
      const strobe = burj.model.getObjectByName('burj_strobe');
      if (strobe) {
        const isBlinking = Math.sin(time * 8.0) > 0.7;
        strobe.visible = isBlinking;
      }
    }
  }
}

