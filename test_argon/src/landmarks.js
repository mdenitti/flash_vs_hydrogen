import * as THREE from 'three';

export const LANDMARKS_DATA = [
  {
    id: 'eiffel-tower',
    name: 'Eiffel Tower',
    city: 'Paris, France',
    emoji: '🗼',
    lat: 48.8584,
    lon: 2.2945,
    description:
      'Gustave Eiffel’s 330-meter wrought-iron lattice masterpiece built for the 1889 World’s Fair on the Champ de Mars.',
    color: 0xfbbf24,
  },
  {
    id: 'statue-of-liberty',
    name: 'Statue of Liberty',
    city: 'New York, USA',
    emoji: '🗽',
    lat: 40.6892,
    lon: -74.0445,
    description:
      'Colossal neoclassical copper monument on Liberty Island welcoming travelers entering New York Harbor since 1886.',
    color: 0x34d399,
  },
  {
    id: 'golden-gate',
    name: 'Golden Gate Bridge',
    city: 'San Francisco, USA',
    emoji: '🌉',
    lat: 37.8199,
    lon: -122.4783,
    description:
      'Iconic International Orange suspension bridge spanning the Golden Gate strait between San Francisco Bay and the Pacific.',
    color: 0xf97316,
  },
  {
    id: 'pyramids-of-giza',
    name: 'Pyramids of Giza',
    city: 'Cairo, Egypt',
    emoji: '🏜️',
    lat: 29.9792,
    lon: 31.1342,
    description:
      'Ancient Fourth Dynasty limestone pyramids of Khufu, Khafre, and Menkaure guarded by the Great Sphinx on the Giza Plateau.',
    color: 0xfacc15,
  },
  {
    id: 'sydney-opera-house',
    name: 'Sydney Opera House',
    city: 'Sydney, Australia',
    emoji: '⛵',
    lat: -33.8568,
    lon: 151.2153,
    description:
      'Jørn Utzon’s expressionist marvel of interlocking precast concrete shells poised on Bennelong Point in Sydney Harbour.',
    color: 0x38bdf8,
  },
  {
    id: 'taj-mahal',
    name: 'Taj Mahal',
    city: 'Agra, India',
    emoji: '🕌',
    lat: 27.1751,
    lon: 78.0421,
    description:
      'Ivory-white marble mausoleum commissioned in 1632 on the banks of the Yamuna River, flanked by four minarets and gardens.',
    color: 0xf472b6,
  },
  {
    id: 'colosseum',
    name: 'Roman Colosseum',
    city: 'Rome, Italy',
    emoji: '🏛️',
    lat: 41.8902,
    lon: 12.4922,
    description:
      'The Flavian Amphitheatre of Imperial Rome, the largest ancient travertine and tuff amphitheatre ever built.',
    color: 0xfb923c,
  },
  {
    id: 'mount-fuji',
    name: 'Mount Fuji & Torii',
    city: 'Honshu, Japan',
    emoji: '🗻',
    lat: 35.3606,
    lon: 138.7274,
    description:
      'Japan’s sacred 3,776-meter snow-capped stratovolcano paired with the vermilion Chureito Pagoda and Torii gate.',
    color: 0xf43f5e,
  },
  {
    id: 'christ-redeemer',
    name: 'Christ the Redeemer',
    city: 'Rio de Janeiro, Brazil',
    emoji: '⛰️',
    lat: -22.9519,
    lon: -43.2105,
    description:
      'Art Deco soapstone statue atop the 700-meter peak of Mount Corcovado overlooking Guanabara Bay and Sugarloaf Mountain.',
    color: 0x22d3ee,
  },
  {
    id: 'big-ben',
    name: 'Big Ben & Westminster',
    city: 'London, UK',
    emoji: '🕰️',
    lat: 51.5007,
    lon: -0.1246,
    description:
      'Augustus Pugin’s Neo-Gothic Elizabeth Clock Tower rising beside the Houses of Parliament along the River Thames.',
    color: 0xeab308,
  },
  {
    id: 'burj-khalifa',
    name: 'Burj Khalifa',
    city: 'Dubai, UAE',
    emoji: '🏙️',
    lat: 25.1972,
    lon: 55.2744,
    description:
      'World’s tallest megatall skyscraper soaring 828 meters above Downtown Dubai in a spiraling Y-shaped glass silhouette.',
    color: 0x60a5fa,
  },
  {
    id: 'chichen-itza',
    name: 'Chichen Itza · El Castillo',
    city: 'Yucatan, Mexico',
    emoji: '🗿',
    lat: 20.6843,
    lon: -88.5678,
    description:
      'Mesoamerican step-pyramid of Kukulcan featuring four monumental staircases and 365 solar calendar steps.',
    color: 0x4ade80,
  },
];

// Convert Lat/Lon (degrees) and radius into 3D Cartesian vector
export function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Convert 3D Cartesian vector back to Lat/Lon (degrees)
export function vector3ToLatLon(vec) {
  const r = vec.length();
  if (r === 0) return { lat: 0, lon: 0 };
  const phi = Math.acos(THREE.MathUtils.clamp(vec.y / r, -1, 1));
  const lat = 90 - THREE.MathUtils.radToDeg(phi);
  let lon = THREE.MathUtils.radToDeg(Math.atan2(vec.z, -vec.x)) - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

// Build specific procedural 3D architectural monument for each ID
function buildMonumentGeometry(id) {
  const group = new THREE.Group();

  switch (id) {
    case 'eiffel-tower': {
      // Rich Parisian bronze-iron material with warm self-illumination
      const ironMat = new THREE.MeshStandardMaterial({
        color: 0xc29356,
        metalness: 0.72,
        roughness: 0.32,
        emissive: 0x4a2e0b,
        emissiveIntensity: 0.45,
      });
      const deckGlowMat = new THREE.MeshStandardMaterial({
        color: 0xffe082,
        emissive: 0xffb300,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      });
      const baseParkMat = new THREE.MeshStandardMaterial({
        color: 0x1e4620,
        roughness: 0.85,
      });

      // Champ de Mars circular park plinth
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.28, 32), baseParkMat);
      plinth.position.y = 0.14;
      group.add(plinth);

      // 4 Curved lattice legs (lower stage + middle stage)
      const legOffsets = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];

      legOffsets.forEach(([ox, oz]) => {
        // Foundation masonry shoe
        const shoe = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.35, 0.55),
          new THREE.MeshStandardMaterial({ color: 0x948774, roughness: 0.7 })
        );
        shoe.position.set(ox * 1.25, 0.32, oz * 1.25);
        group.add(shoe);

        // Lower leg (base to 1st deck: y=0.35 to y=2.6)
        const legLow = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 2.4, 4), ironMat);
        legLow.position.set(ox * 0.98, 1.5, oz * 0.98);
        legLow.rotation.z = ox * 0.23;
        legLow.rotation.x = -oz * 0.23;
        legLow.rotation.y = Math.PI / 4;
        group.add(legLow);

        // Middle leg (1st deck to 2nd deck: y=2.6 to y=5.1)
        const legMid = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 2.55, 4), ironMat);
        legMid.position.set(ox * 0.54, 3.85, oz * 0.54);
        legMid.rotation.z = ox * 0.14;
        legMid.rotation.x = -oz * 0.14;
        legMid.rotation.y = Math.PI / 4;
        group.add(legMid);
      });

      // 4 Iconic Semicircular Base Arches on each facade
      for (let i = 0; i < 4; i++) {
        const archPivot = new THREE.Group();
        archPivot.rotation.y = (i * Math.PI) / 2;
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(0.82, 0.08, 10, 28, Math.PI),
          ironMat
        );
        arch.position.set(0, 0.45, 1.08);
        archPivot.add(arch);
        group.add(archPivot);
      }

      // 1st Observation Deck (wide double-story platform with golden lit pavilion)
      const deck1Outer = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.28, 2.15), ironMat);
      deck1Outer.position.y = 2.65;
      group.add(deck1Outer);

      const deck1Glow = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.16, 1.88), deckGlowMat);
      deck1Glow.position.y = 2.84;
      group.add(deck1Glow);

      // 2nd Observation Deck
      const deck2Outer = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.24, 1.36), ironMat);
      deck2Outer.position.y = 5.05;
      group.add(deck2Outer);

      const deck2Glow = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.15, 1.16), deckGlowMat);
      deck2Glow.position.y = 5.22;
      group.add(deck2Glow);

      // Upper tapered lattice tower shaft (y=5.2 to y=8.9)
      const upperShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.56, 3.7, 4),
        ironMat
      );
      upperShaft.position.y = 7.05;
      upperShaft.rotation.y = Math.PI / 4;
      group.add(upperShaft);

      // Horizontal lattice truss bands along upper shaft
      for (let h = 5.8; h <= 8.4; h += 0.65) {
        const t = (h - 5.2) / 3.7;
        const w = THREE.MathUtils.lerp(0.82, 0.38, t);
        const band = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, w), ironMat);
        band.position.y = h;
        group.add(band);
      }

      // 3rd Observation Summit Platform & Gustave Eiffel Cupola
      const deck3 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.65), ironMat);
      deck3.position.y = 8.95;
      group.add(deck3);

      const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.55, 16), deckGlowMat);
      cupola.position.y = 9.3;
      group.add(cupola);

      // Tall Broadcast Antenna Needle Spire
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.09, 1.85, 12), ironMat);
      needle.position.y = 10.35;
      group.add(needle);

      // Golden Rotating Beacon & Searchlight Cones at the Summit
      const beaconOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
      );
      beaconOrb.position.y = 9.55;
      group.add(beaconOrb);

      const beamPivot = new THREE.Group();
      beamPivot.position.y = 9.55;
      beamPivot.name = 'rotatingBeacon';
      const coneGeo = new THREE.ConeGeometry(0.85, 5.5, 20, 1, true);
      coneGeo.translate(0, -2.75, 0);
      coneGeo.rotateZ(Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const beam1 = new THREE.Mesh(coneGeo, coneMat);
      const beam2 = new THREE.Mesh(coneGeo, coneMat);
      beam2.rotation.y = Math.PI;
      beamPivot.add(beam1, beam2);
      group.add(beamPivot);
      break;
    }

    case 'statue-of-liberty': {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.65 });
      const copperMat = new THREE.MeshStandardMaterial({
        color: 0x4ca98e,
        roughness: 0.42,
        metalness: 0.25,
        emissive: 0x134e4a,
        emissiveIntensity: 0.35,
      });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

      // Star Fort Wood base
      const starBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 0.8, 11), stoneMat);
      starBase.position.y = 0.4;
      group.add(starBase);

      // Stepped granite pedestal
      const ped1 = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.5, 1.85), stoneMat);
      ped1.position.y = 1.55;
      group.add(ped1);

      const ped2 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.8, 1.45), stoneMat);
      ped2.position.y = 3.2;
      group.add(ped2);

      // Draped copper robes (lower + torso)
      const robeLower = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.82, 2.4, 18), copperMat);
      robeLower.position.y = 5.3;
      group.add(robeLower);

      const robeUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.58, 1.6, 18), copperMat);
      robeUpper.position.y = 7.1;
      group.add(robeUpper);

      // Head & 7-ray Crown
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), copperMat);
      head.position.y = 8.25;
      group.add(head);

      for (let i = -3; i <= 3; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.55, 6), copperMat);
        const angle = i * 0.35;
        spike.position.set(Math.sin(angle) * 0.42, 8.55 + Math.cos(angle) * 0.15, 0.1);
        spike.rotation.z = -angle;
        group.add(spike);
      }

      // Raised Right Arm & Golden Torch
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.1, 10), copperMat);
      arm.position.set(0.55, 8.65, 0.15);
      arm.rotation.z = -0.18;
      group.add(arm);

      const torchCup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.12, 0.3, 12), copperMat);
      torchCup.position.set(0.72, 9.75, 0.15);
      group.add(torchCup);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.68, 12), flameMat);
      flame.position.set(0.72, 10.22, 0.15);
      group.add(flame);

      const flameGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0xfde047,
          transparent: true,
          opacity: 0.4,
        })
      );
      flameGlow.position.set(0.72, 10.15, 0.15);
      group.add(flameGlow);
      break;
    }

    case 'golden-gate': {
      const orangeMat = new THREE.MeshStandardMaterial({
        color: 0xe04a2f,
        roughness: 0.38,
        metalness: 0.45,
        emissive: 0x5c190d,
        emissiveIntensity: 0.35,
      });
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.15,
        metalness: 0.7,
      });

      // Bay water base
      const bay = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.18, 36), waterMat);
      bay.position.y = 0.09;
      group.add(bay);

      // Two Art Deco Twin Towers at x = -1.65 and x = +1.65
      [-1.65, 1.65].forEach((tx) => {
        // Concrete pier
        const pier = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.8, 1.25),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
        );
        pier.position.set(tx, 0.45, 0);
        group.add(pier);

        // Two vertical tower legs
        [-0.42, 0.42].forEach((tz) => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 6.8, 0.26), orangeMat);
          leg.position.set(tx, 3.8, tz);
          group.add(leg);
        });

        // 4 Horizontal Art Deco Cross Struts
        [2.1, 3.7, 5.2, 6.7].forEach((ty) => {
          const strut = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 1.05), orangeMat);
          strut.position.set(tx, ty, 0);
          group.add(strut);
        });
      });

      // Main Roadway Deck
      const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, 0.95), orangeMat);
      deck.position.y = 2.05;
      group.add(deck);

      const asphalt = new THREE.Mesh(new THREE.BoxGeometry(6.75, 0.06, 0.76), deckMat);
      asphalt.position.y = 2.18;
      group.add(asphalt);

      // Parabolic Suspension Cables & Vertical Suspenders
      [-0.42, 0.42].forEach((cz) => {
        const points = [];
        for (let i = -32; i <= 32; i++) {
          const x = (i / 32) * 3.35;
          let y;
          if (Math.abs(x) <= 1.65) {
            const norm = x / 1.65;
            y = 2.35 + norm * norm * 4.75;
          } else {
            const sideNorm = (Math.abs(x) - 1.65) / 1.7;
            y = 7.1 * (1 - sideNorm * 0.72);
          }
          points.push(new THREE.Vector3(x, y, cz));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const cableGeo = new THREE.TubeGeometry(curve, 48, 0.065, 8, false);
        const cable = new THREE.Mesh(cableGeo, orangeMat);
        group.add(cable);

        // Vertical suspender ropes
        for (let x = -3.0; x <= 3.0; x += 0.38) {
          if (Math.abs(Math.abs(x) - 1.65) < 0.15) continue;
          let topY;
          if (Math.abs(x) <= 1.65) {
            const norm = x / 1.65;
            topY = 2.35 + norm * norm * 4.75;
          } else {
            const sideNorm = (Math.abs(x) - 1.65) / 1.7;
            topY = 7.1 * (1 - sideNorm * 0.72);
          }
          const h = topY - 2.1;
          if (h > 0.2) {
            const rope = new THREE.Mesh(
              new THREE.CylinderGeometry(0.018, 0.018, h, 6),
              orangeMat
            );
            rope.position.set(x, 2.1 + h / 2, cz);
            group.add(rope);
          }
        }
      });
      break;
    }

    case 'pyramids-of-giza': {
      const sandMat = new THREE.MeshStandardMaterial({ color: 0xd9a85b, roughness: 0.85 });
      const limestoneMat = new THREE.MeshStandardMaterial({
        color: 0xe6be7a,
        roughness: 0.65,
        emissive: 0x3d2807,
        emissiveIntensity: 0.25,
      });
      const goldCapMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.88,
        roughness: 0.15,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
      });

      const plateau = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.3, 0.35, 32), sandMat);
      plateau.position.y = 0.175;
      group.add(plateau);

      // Great Pyramid of Khufu (with golden capstone)
      const khufu = new THREE.Mesh(new THREE.ConeGeometry(2.15, 3.8, 4), limestoneMat);
      khufu.position.set(-1.05, 2.1, -0.85);
      khufu.rotation.y = Math.PI / 4;
      group.add(khufu);

      const capstone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), goldCapMat);
      capstone.position.set(-1.05, 3.65, -0.85);
      capstone.rotation.y = Math.PI / 4;
      group.add(capstone);

      // Pyramid of Khafre
      const khafre = new THREE.Mesh(new THREE.ConeGeometry(1.85, 3.35, 4), limestoneMat);
      khafre.position.set(1.1, 1.85, 0.45);
      khafre.rotation.y = Math.PI / 4;
      group.add(khafre);

      // Pyramid of Menkaure
      const menkaure = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.0, 4), limestoneMat);
      menkaure.position.set(2.2, 1.15, 1.85);
      menkaure.rotation.y = Math.PI / 4;
      group.add(menkaure);

      // Great Sphinx in foreground
      const sphinxBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 1.35), limestoneMat);
      sphinxBody.position.set(-0.85, 0.55, 1.75);
      group.add(sphinxBody);

      const sphinxHead = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.62, 5), limestoneMat);
      sphinxHead.position.set(-0.85, 1.05, 2.25);
      group.add(sphinxHead);
      break;
    }

    case 'sydney-opera-house': {
      const podiumMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6 });
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.22,
        metalness: 0.15,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.18,
      });

      // Bennelong Point Podium
      const podium = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.65, 2.7), podiumMat);
      podium.position.y = 0.325;
      group.add(podium);

      // Iconic Vaulted Shell Sails (two parallel banks of 4 interlocking sails)
      [-0.58, 0.58].forEach((zOffset, bankIdx) => {
        const heights = [3.4, 2.85, 2.2, 1.6];
        heights.forEach((h, i) => {
          const sailGeo = new THREE.ConeGeometry(0.75, h, 18, 1, false, 0, Math.PI);
          const sail = new THREE.Mesh(sailGeo, shellMat);
          sail.position.set(-1.1 + i * 0.78 + bankIdx * 0.15, 0.65 + h * 0.42, zOffset);
          sail.rotation.z = -0.28;
          sail.rotation.y = Math.PI / 2;
          group.add(sail);
        });
      });
      break;
    }

    case 'taj-mahal': {
      const marbleMat = new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        roughness: 0.25,
        metalness: 0.1,
        emissive: 0xfef3c7,
        emissiveIntensity: 0.28,
      });
      const goldFinialMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.85,
        roughness: 0.2,
      });

      // White marble terrace platform
      const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 3.6), marbleMat);
      platform.position.y = 0.275;
      group.add(platform);

      // Reflecting Pool in front
      const pool = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.12, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.8 })
      );
      pool.position.set(0, 0.08, 2.8);
      group.add(pool);

      // Main Mausoleum Cube
      const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.85, 1.85), marbleMat);
      mainBody.position.y = 1.45;
      group.add(mainBody);

      // Central Onion Dome
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.65, 24), marbleMat);
      drum.position.y = 2.65;
      group.add(drum);

      const onionDome = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 24), marbleMat);
      onionDome.scale.set(1, 1.28, 1);
      onionDome.position.y = 3.45;
      group.add(onionDome);

      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.75, 12), goldFinialMat);
      finial.position.y = 4.75;
      group.add(finial);

      // 4 Corner Minarets
      [
        [-1.52, -1.52],
        [1.52, -1.52],
        [1.52, 1.52],
        [-1.52, 1.52],
      ].forEach(([mx, mz]) => {
        const minaret = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.2, 3.1, 16),
          marbleMat
        );
        minaret.position.set(mx, 2.05, mz);
        group.add(minaret);

        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), marbleMat);
        cap.position.set(mx, 3.7, mz);
        group.add(cap);
      });
      break;
    }

    case 'colosseum': {
      const travertineMat = new THREE.MeshStandardMaterial({
        color: 0xd6b88d,
        roughness: 0.7,
        emissive: 0x573b12,
        emissiveIntensity: 0.28,
      });
      const arenaMat = new THREE.MeshStandardMaterial({ color: 0xa17c52, roughness: 0.85 });

      // Elliptical Arena Floor
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 0.3, 36), arenaMat);
      floor.scale.set(1.22, 1, 0.95);
      floor.position.y = 0.15;
      group.add(floor);

      // Inner Ring Wall (3 stories)
      const innerWall = new THREE.Mesh(
        new THREE.CylinderGeometry(2.15, 2.15, 2.1, 36, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xc2a174,
          roughness: 0.75,
          side: THREE.DoubleSide,
        })
      );
      innerWall.scale.set(1.22, 1, 0.95);
      innerWall.position.y = 1.15;
      group.add(innerWall);

      // Iconic Asymmetric Outer Ring Wall (4 stories tall on North side)
      const outerWall = new THREE.Mesh(
        new THREE.CylinderGeometry(2.45, 2.45, 3.1, 36, 1, true, 0, Math.PI * 1.18),
        new THREE.MeshStandardMaterial({
          color: 0xdcc096,
          roughness: 0.65,
          side: THREE.DoubleSide,
          emissive: 0x5c3d10,
          emissiveIntensity: 0.3,
        })
      );
      outerWall.scale.set(1.22, 1, 0.95);
      outerWall.position.y = 1.65;
      group.add(outerWall);

      // Arched tier rings
      [0.85, 1.65, 2.45].forEach((ry) => {
        const cornice = new THREE.Mesh(
          new THREE.TorusGeometry(2.46, 0.07, 8, 40),
          travertineMat
        );
        cornice.rotation.x = Math.PI / 2;
        cornice.scale.set(1.22, 0.95, 1);
        cornice.position.y = ry;
        group.add(cornice);
      });
      break;
    }

    case 'mount-fuji': {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x3b4262, roughness: 0.75 });
      const snowMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.3,
        emissive: 0x93c5fd,
        emissiveIntensity: 0.25,
      });
      const vermilionMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.35,
        emissive: 0x991b1b,
        emissiveIntensity: 0.4,
      });

      // Volcanic Cone Base
      const volcano = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 3.8, 4.4, 32),
        rockMat
      );
      volcano.position.y = 2.2;
      group.add(volcano);

      // Snow Cap
      const snowCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.98, 2.15, 1.85, 32),
        snowMat
      );
      snowCap.position.y = 3.55;
      group.add(snowCap);

      // Giant Vermilion Torii Gate in Foreground
      const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.9, 12), vermilionMat);
      pillarL.position.set(-0.65, 0.95, 2.85);
      const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.9, 12), vermilionMat);
      pillarR.position.set(0.65, 0.95, 2.85);
      const kasagi = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.24), vermilionMat);
      kasagi.position.set(0, 1.9, 2.85);
      const nuki = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 0.16), vermilionMat);
      nuki.position.set(0, 1.5, 2.85);
      group.add(pillarL, pillarR, kasagi, nuki);
      break;
    }

    case 'christ-redeemer': {
      const mountainMat = new THREE.MeshStandardMaterial({ color: 0x2d4f38, roughness: 0.85 });
      const statueMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.32,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.25,
      });

      // Steep Corcovado Peak
      const peak = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.2, 16), mountainMat);
      peak.position.y = 2.1;
      group.add(peak);

      // Octagonal Soapstone Pedestal
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 8), statueMat);
      pedestal.position.y = 4.35;
      group.add(pedestal);

      // Statue Robe Body
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 3.1, 14), statueMat);
      body.position.y = 6.4;
      group.add(body);

      // Wide Outstretched Arms (Cross Silhouette)
      const arms = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.36, 0.32), statueMat);
      arms.position.y = 7.35;
      group.add(arms);

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), statueMat);
      head.position.y = 8.2;
      group.add(head);
      break;
    }

    case 'big-ben': {
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0xd4b47c,
        roughness: 0.55,
        emissive: 0x452c08,
        emissiveIntensity: 0.3,
      });
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.6,
        roughness: 0.35,
      });
      const clockFaceMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });

      // Westminster Hall Base Wing
      const hall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 1.4), stoneMat);
      hall.position.set(-1.1, 0.8, 0);
      group.add(hall);

      // Elizabeth Tower Shaft
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.15, 6.2, 1.15), stoneMat);
      shaft.position.set(0.6, 3.1, 0);
      group.add(shaft);

      // Clock Stage Housing
      const clockStage = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.35, 1.38), stoneMat);
      clockStage.position.set(0.6, 6.55, 0);
      group.add(clockStage);

      // 4 Glowing Clock Dials
      for (let i = 0; i < 4; i++) {
        const dialPivot = new THREE.Group();
        dialPivot.position.set(0.6, 6.55, 0);
        dialPivot.rotation.y = (i * Math.PI) / 2;
        const dial = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), clockFaceMat);
        dial.position.z = 0.71;
        dialPivot.add(dial);
        group.add(dialPivot);
      }

      // Stepped Gothic Spire
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.92, 2.4, 4), roofMat);
      spire.position.set(0.6, 8.4, 0);
      spire.rotation.y = Math.PI / 4;
      group.add(spire);
      break;
    }

    case 'burj-khalifa': {
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        metalness: 0.88,
        roughness: 0.14,
        emissive: 0x1e3a8a,
        emissiveIntensity: 0.4,
      });

      // Glowing Turquoise Fountain Lake Base
      const lake = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.6, 0.2, 32),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      lake.position.y = 0.1;
      group.add(lake);

      // Spiraling Y-shaped stepped setbacks
      const tiers = 10;
      for (let i = 0; i < tiers; i++) {
        const h = 1.6 + i * 0.92;
        const r = 1.15 * Math.pow(0.81, i);
        const tierMesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 6), glassMat);
        tierMesh.position.y = h / 2;
        tierMesh.rotation.y = i * 0.52;
        group.add(tierMesh);
      }

      // Sky-piercing Needle Spire & Red Aviation Strobe
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.14, 2.8, 12), glassMat);
      spire.position.y = 10.6;
      group.add(spire);

      const strobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e })
      );
      strobe.position.y = 12.1;
      group.add(strobe);
      break;
    }

    case 'chichen-itza': {
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0xc8b89a,
        roughness: 0.75,
        emissive: 0x362f23,
        emissiveIntensity: 0.25,
      });

      // 9 Stepped Mayan Terraces
      for (let i = 0; i < 9; i++) {
        const w = 3.6 - i * 0.33;
        const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.36, w), stoneMat);
        step.position.y = 0.18 + i * 0.36;
        group.add(step);
      }

      // 4 Axial Staircases
      for (let i = 0; i < 4; i++) {
        const stairPivot = new THREE.Group();
        stairPivot.rotation.y = (i * Math.PI) / 2;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.72, 3.65, 0.32), stoneMat);
        ramp.position.set(0, 1.62, 1.18);
        ramp.rotation.x = -0.58;
        stairPivot.add(ramp);
        group.add(stairPivot);
      }

      // Upper Temple Sanctum
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.95), stoneMat);
      temple.position.y = 3.62;
      group.add(temple);
      break;
    }
  }

  return group;
}

export class LandmarksManager {
  constructor(globeRadius, scene) {
    this.globeRadius = globeRadius;
    this.scene = scene;
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.landmarks = [];
    this.burstParticles = [];
    this.sharedParticleGeo = new THREE.SphereGeometry(0.32, 8, 8);
    this.scaleMultiplier = 1.8;

    this.initLandmarks();
  }

  initLandmarks() {
    LANDMARKS_DATA.forEach((data, index) => {
      const anchor = new THREE.Group();
      const surfacePos = latLonToVector3(data.lat, data.lon, this.globeRadius);
      anchor.position.copy(surfacePos);

      // Orient upright along the local surface normal
      const normal = surfacePos.clone().normalize();
      anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Build the bespoke 3D architectural monument
      const monument = buildMonumentGeometry(data.id);
      anchor.add(monument);

      // Holographic Fly-Over Checkpoint Ring hovering above the monument
      const ringGroup = new THREE.Group();
      const ringAltitude = data.id === 'burj-khalifa' ? 12.8 : data.id === 'eiffel-tower' ? 11.2 : 9.4;
      ringGroup.position.y = ringAltitude;

      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.13, 16, 48),
        new THREE.MeshBasicMaterial({
          color: data.color,
          transparent: true,
          opacity: 0.88,
        })
      );
      const innerHalo = new THREE.Mesh(
        new THREE.RingGeometry(1.9, 2.25, 48),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.25,
        })
      );
      ringGroup.add(ringMesh, innerHalo);
      anchor.add(ringGroup);

      // Vertical Atmospheric Beacon Beam so landmarks are visible from afar
      const beamHeight = 32;
      const beamGeo = new THREE.CylinderGeometry(0.08, 0.45, beamHeight, 12, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: data.color,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const skyBeam = new THREE.Mesh(beamGeo, beamMat);
      skyBeam.position.y = beamHeight / 2;
      anchor.add(skyBeam);

      anchor.scale.setScalar(this.scaleMultiplier);
      this.rootGroup.add(anchor);

      this.landmarks.push({
        ...data,
        index,
        anchor,
        monument,
        ringGroup,
        ringMesh,
        skyBeam,
        surfacePos,
        normal,
        visited: false,
        cooldown: 0,
      });
    });
  }

  setScale(mult) {
    this.scaleMultiplier = mult;
    this.landmarks.forEach((lm) => {
      lm.anchor.scale.setScalar(mult);
    });
  }

  getCheckpointWorldPos(lm) {
    const worldPos = new THREE.Vector3();
    lm.ringGroup.getWorldPosition(worldPos);
    return worldPos;
  }

  spawnCelebrationBurst(worldPos, colorHex) {
    const count = 42;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        this.sharedParticleGeo,
        new THREE.MeshBasicMaterial({ color: colorHex })
      );
      mesh.position.copy(worldPos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28
      );
      this.scene.add(mesh);
      this.burstParticles.push({ mesh, vel, life: 1.4 });
    }
  }

  update(dt, elapsedTime, targetIndex) {
    this.landmarks.forEach((lm, idx) => {
      // Spin the aerial checkpoint ring
      lm.ringGroup.rotation.y = elapsedTime * 1.4 + idx;
      lm.ringGroup.rotation.z = Math.sin(elapsedTime * 2 + idx) * 0.15;

      // Pulse target ring & sky beam
      const isTarget = idx === targetIndex;
      const pulse = 1 + Math.sin(elapsedTime * 4) * 0.12;
      lm.ringGroup.scale.setScalar(isTarget ? pulse * 1.18 : 1.0);
      lm.skyBeam.material.opacity = isTarget
        ? 0.34 + Math.sin(elapsedTime * 5) * 0.1
        : lm.visited
        ? 0.08
        : 0.18;

      // Rotate the Eiffel Tower searchlight beacon
      const beacon = lm.monument.getObjectByName('rotatingBeacon');
      if (beacon) {
        beacon.rotation.y = elapsedTime * 1.1;
      }

      if (lm.cooldown > 0) {
        lm.cooldown -= dt;
      }
    });

    // Update celebration burst particles
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.burstParticles.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.setScalar(p.life);
      }
    }
  }
}
