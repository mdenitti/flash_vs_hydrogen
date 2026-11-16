import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LANDMARKS = [
  { id: 'paris', type: 'eiffel', name: 'Eiffel Tower', city: 'Paris', country: 'France', lat: 48.8584, lon: 2.2945, subtitle: 'The City of Light, from a new perspective.', category: 'ARCHITECTURE' },
  { id: 'new-york', type: 'liberty', name: 'Statue of Liberty', city: 'New York', country: 'United States', lat: 40.6892, lon: -74.0445, subtitle: 'A timeless welcome above New York Harbor.', category: 'MONUMENT' },
  { id: 'giza', type: 'pyramids', name: 'Pyramids of Giza', city: 'Giza', country: 'Egypt', lat: 29.9792, lon: 31.1342, subtitle: 'Four thousand years, beneath your wings.', category: 'ANCIENT WONDER' },
  { id: 'agra', type: 'taj', name: 'Taj Mahal', city: 'Agra', country: 'India', lat: 27.1751, lon: 78.0421, subtitle: 'A marble masterpiece on the Yamuna.', category: 'ARCHITECTURE' },
  { id: 'rio', type: 'christ', name: 'Christ the Redeemer', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.9519, lon: -43.2105, subtitle: 'Open arms over the marvelous city.', category: 'MONUMENT' },
  { id: 'sydney', type: 'opera', name: 'Sydney Opera House', city: 'Sydney', country: 'Australia', lat: -33.8568, lon: 151.2153, subtitle: 'Sculpted sails at the edge of the harbor.', category: 'ARCHITECTURE' },
  { id: 'fuji', type: 'fuji', name: 'Mount Fuji', city: 'Honshu', country: 'Japan', lat: 35.3606, lon: 138.7274, subtitle: 'Find stillness above the snow-capped summit.', category: 'NATURAL WONDER' },
  { id: 'rome', type: 'colosseum', name: 'Colosseum', city: 'Rome', country: 'Italy', lat: 41.8902, lon: 12.4922, subtitle: 'An eternal icon in the heart of Rome.', category: 'ANCIENT WONDER' },
];

// Geometries are baked into material batches, keeping the architectural detail
// without turning every strut or column into a separate draw call.
class Builder {
  constructor() { this.buckets = new Map(); }
  add(geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    geometry.applyMatrix4(matrix);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    // All primitive geometries have normals/UVs; generated shapes do too.
    flat.clearGroups();
    if (!this.buckets.has(material)) this.buckets.set(material, []);
    this.buckets.get(material).push(flat);
  }
  box(size, position, material, rotation) { this.add(new THREE.BoxGeometry(...size), material, position, undefined, rotation); }
  cylinder(top, bottom, height, position, material, sides = 12) {
    this.add(new THREE.CylinderGeometry(top, bottom, height, sides), material, position);
  }
  sphere(radius, position, material, scale = [1, 1, 1]) {
    this.add(new THREE.SphereGeometry(radius, 16, 12), material, position, scale);
  }
  beam(a, b, radius, material, sides = 6) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const vector = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radius, radius, vector.length(), sides);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()));
    this.add(geometry, material, from.add(to).multiplyScalar(0.5).toArray());
  }
  finish() {
    const group = new THREE.Group();
    for (const [material, geometries] of this.buckets) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error('Landmark geometry could not be merged');
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
    return group;
  }
}

const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.08, ...options });
const bronze = material('#c6a26d', { metalness: 0.7, roughness: 0.34 });
const bronzeLight = material('#e1c394', { metalness: 0.62, roughness: 0.42 });
const paleStone = material('#eee4cb');
const sandstone = material('#d5aa68');
const darkStone = material('#7f745e');
const white = material('#fff7df', { roughness: 0.42 });
const teal = material('#62a997', { metalness: 0.35 });
const dark = material('#253636');
const gold = material('#ffc663', { metalness: 0.65, emissive: '#b5771b', emissiveIntensity: 0.25 });
const ground = material('#687562');

function eiffel() {
  const b = new Builder();
  const levels = [[0, .39], [.18, .31], [.43, .235], [.76, .15], [1.05, .084], [1.38, .038], [1.52, .027]];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let level = 0; level < levels.length - 1; level++) {
    const [y0, r0] = levels[level], [y1, r1] = levels[level + 1];
    corners.forEach(([sx, sz], i) => {
      const [tx, tz] = corners[(i + 1) % 4];
      b.beam([sx * r0, y0, sz * r0], [sx * r1, y1, sz * r1], level < 2 ? .022 : .013, bronze);
      // Crossed bracing on all four sides leaves the tower visibly open.
      b.beam([sx * r0, y0, sz * r0], [tx * r1, y1, tz * r1], .007, bronzeLight);
      b.beam([tx * r0, y0, tz * r0], [sx * r1, y1, sz * r1], .007, bronzeLight);
      b.beam([sx * r1, y1, sz * r1], [tx * r1, y1, tz * r1], .011, bronze);
      const midY = (y0 + y1) / 2, midR = (r0 + r1) / 2;
      b.beam([sx * midR, midY, sz * midR], [tx * midR, midY, tz * midR], .006, bronze);
    });
  }
  // Four broad stone footings and the observation platforms.
  corners.forEach(([sx, sz]) => b.box([.14, .045, .14], [sx * .39, .022, sz * .39], paleStone));
  [[.43, .58], [.76, .40], [1.4, .14]].forEach(([height, width]) => {
    b.box([width, .045, width], [0, height, 0], bronze);
    const r = width / 2;
    corners.forEach(([sx, sz], i) => {
      const [tx, tz] = corners[(i + 1) % 4];
      b.beam([sx * r, height + .058, sz * r], [tx * r, height + .058, tz * r], .008, bronzeLight);
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        b.beam([(sx + (tx - sx) * t) * r, height + .022, (sz + (tz - sz) * t) * r], [(sx + (tx - sx) * t) * r, height + .058, (sz + (tz - sz) * t) * r], .003, bronze);
      }
    });
  });
  // The lower arches are open semicircles, not filled triangles.
  for (let face = 0; face < 4; face++) {
    const angle = face * Math.PI / 2;
    const point = (theta) => {
      const x = Math.cos(theta) * .29, z = .31;
      return [x * Math.cos(angle) - z * Math.sin(angle), .08 + Math.sin(theta) * .22, x * Math.sin(angle) + z * Math.cos(angle)];
    };
    for (let i = 0; i < 14; i++) b.beam(point(i * Math.PI / 14), point((i + 1) * Math.PI / 14), .014, bronze);
  }
  b.cylinder(.017, .03, .19, [0, 1.61, 0], bronzeLight);
  b.cylinder(.004, .01, .16, [0, 1.785, 0], bronzeLight, 6);
  b.sphere(.018, [0, 1.86, 0], gold);
  return b.finish();
}

function liberty() {
  const b = new Builder();
  b.box([.6, .08, .6], [0, .04, 0], paleStone);
  b.box([.43, .08, .43], [0, .12, 0], paleStone);
  b.box([.33, .34, .33], [0, .33, 0], sandstone);
  b.box([.4, .07, .4], [0, .535, 0], paleStone);
  b.cylinder(.135, .22, .6, [0, .86, 0], teal, 11);
  b.sphere(.17, [0, 1.11, 0], teal, [1, 1.1, .68]);
  // Long robe folds reinforce the draped silhouette at globe scale.
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    b.beam([Math.cos(angle) * .12, 1.14, Math.sin(angle) * .1], [Math.cos(angle) * .2, .59, Math.sin(angle) * .2], .018, teal);
  }
  b.cylinder(.055, .06, .08, [0, 1.29, 0], teal);
  b.sphere(.095, [0, 1.39, .01], teal, [.85, 1.18, .9]);
  b.cylinder(.11, .09, .045, [0, 1.46, 0], teal);
  for (let i = 0; i < 7; i++) {
    const angle = i / 6 * Math.PI;
    b.beam([Math.cos(angle) * .075, 1.47, Math.sin(angle) * .04], [Math.cos(angle) * .19, 1.49 + Math.sin(angle) * .12, Math.sin(angle) * .06], .011, teal);
  }
  b.beam([-.12, 1.17, 0], [-.24, 1.04, .03], .062, teal);
  b.beam([-.24, 1.04, .03], [-.14, .96, .12], .05, teal);
  b.box([.15, .25, .04], [-.15, 1.05, .15], teal, [0, 0, -.2]);
  b.beam([.12, 1.18, 0], [.25, 1.39, 0], .057, teal);
  b.beam([.25, 1.39, 0], [.29, 1.65, 0], .04, teal);
  b.cylinder(.033, .022, .13, [.29, 1.69, 0], bronze);
  b.cylinder(.07, .025, .065, [.29, 1.77, 0], gold);
  b.sphere(.062, [.29, 1.845, 0], gold, [.7, 1.4, .7]);
  return b.finish();
}

function pyramids() {
  const b = new Builder();
  b.cylinder(.82, .88, .045, [0, .023, 0], sandstone, 48);
  const pyramid = (x, z, size, height) => {
    b.add(new THREE.ConeGeometry(size, height, 4), sandstone, [x, height / 2 + .045, z], [1, 1, 1], [0, Math.PI / 4, 0]);
    // Fine stone courses catch side lighting, remaining subtle at a distance.
    for (let i = 1; i < 15; i++) {
      const y = height * i / 15;
      const width = size * Math.SQRT2 * (1 - i / 15);
      const r = width / 2;
      [[[-r, y, -r], [r, y, -r]], [[r, y, -r], [r, y, r]], [[r, y, r], [-r, y, r]], [[-r, y, r], [-r, y, -r]]].forEach(([a, c]) => b.beam([a[0] + x, a[1] + .045, a[2] + z], [c[0] + x, c[1] + .045, c[2] + z], .003, bronzeLight, 4));
    }
  };
  pyramid(-.25, -.11, .61, 1.15);
  pyramid(.39, .21, .38, .72);
  pyramid(-.02, .57, .19, .33);
  // A small sphinx shape at the causeway.
  b.box([.12, .09, .25], [-.56, .09, .49], paleStone);
  b.sphere(.073, [-.56, .17, .58], sandstone, [.9, 1, .8]);
  return b.finish();
}

function onionDome(b, position, scale, mat) {
  const points = [[0, 0], [.19, 0], [.29, .1], [.30, .22], [.24, .34], [.13, .43], [.035, .50], [0, .54]].map(([r, h]) => new THREE.Vector2(r, h));
  b.add(new THREE.LatheGeometry(points, 24), mat, position, [scale, scale, scale]);
}

function taj() {
  const b = new Builder();
  b.box([1.16, .06, 1.02], [0, .03, 0], paleStone);
  b.box([.62, .48, .5], [0, .30, 0], white);
  b.box([.7, .045, .58], [0, .565, 0], paleStone);
  b.cylinder(.23, .23, .10, [0, .63, 0], white, 24);
  onionDome(b, [0, .68, 0], 1.2, white);
  b.beam([0, 1.3, 0], [0, 1.43, 0], .009, gold);
  b.sphere(.023, [0, 1.34, 0], gold);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * .5, z = sz * .42;
    b.cylinder(.033, .052, .8, [x, .46, z], white, 12);
    for (const y of [.35, .62, .86]) b.cylinder(.067, .067, .025, [x, y, z], paleStone, 12);
    b.cylinder(.035, .035, .08, [x, .915, z], white, 12);
    onionDome(b, [x, .96, z], .22, white);
    b.beam([x, 1.07, z], [x, 1.13, z], .004, gold);
    const cx = sx * .26, cz = sz * .2;
    b.cylinder(.07, .07, .13, [cx, .64, cz], white, 12);
    onionDome(b, [cx, .705, cz], .31, white);
  }
  // Deep pointed portals on each face give the marble block its identity.
  const arch = new THREE.Shape();
  arch.moveTo(-.075, 0); arch.lineTo(.075, 0); arch.lineTo(.075, .17);
  arch.quadraticCurveTo(.075, .24, 0, .3); arch.quadraticCurveTo(-.075, .24, -.075, .17); arch.closePath();
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    const radius = side % 2 === 0 ? .251 : .311;
    b.add(new THREE.ShapeGeometry(arch), darkStone, [Math.sin(angle) * radius, .095, Math.cos(angle) * radius], undefined, [0, angle, 0]);
  }
  return b.finish();
}

function christ() {
  const b = new Builder();
  b.add(new THREE.ConeGeometry(.5, .38, 9), ground, [0, .19, 0]);
  b.box([.34, .14, .3], [0, .39, 0], darkStone);
  b.box([.27, .07, .23], [0, .495, 0], paleStone);
  b.cylinder(.10, .17, .69, [0, .88, 0], paleStone, 8);
  b.box([.29, .25, .15], [0, 1.22, 0], white);
  b.beam([-.10, 1.29, 0], [-.68, 1.30, 0], .065, white);
  b.beam([.10, 1.29, 0], [.68, 1.30, 0], .065, white);
  b.box([.13, .038, .055], [-.73, 1.3, .008], paleStone);
  b.box([.13, .038, .055], [.73, 1.3, .008], paleStone);
  b.cylinder(.048, .06, .09, [0, 1.405, 0], paleStone, 10);
  b.sphere(.093, [0, 1.51, .005], white, [.83, 1.18, .9]);
  for (const x of [-.085, 0, .085]) b.beam([x * .6, 1.23, .09], [x, .55, .15], .011, white);
  return b.finish();
}

function opera() {
  const b = new Builder();
  b.box([1.5, .10, .87], [0, .05, 0], sandstone);
  b.box([1.3, .1, .7], [0, .14, 0], paleStone);
  const shell = (x, z, width, height, angle) => {
    const shape = new THREE.Shape();
    shape.moveTo(-width * .55, 0);
    shape.quadraticCurveTo(-width * .35, height * .58, width * .17, height);
    shape.quadraticCurveTo(width * .57, height * .53, width * .55, .02);
    shape.quadraticCurveTo(0, -.015, -width * .55, 0);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: .15, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, steps: 1, curveSegments: 18 });
    b.add(geom, white, [x, .20, z], undefined, [0, angle, -.10]);
    // Raised center ribs emphasize the shell geometry.
    const points = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      points.push(new THREE.Vector3(width * (.55 - .38 * t), height * t, .17));
    }
    const rib = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, .009, 4, false);
    b.add(rib, paleStone, [x, .20, z], undefined, [0, angle, -.10]);
  };
  shell(-.43, -.26, .47, .58, 0);
  shell(-.12, -.23, .59, .94, 0);
  shell(.28, -.19, .58, 1.13, 0);
  shell(-.43, .12, .42, .48, .12);
  shell(-.10, .14, .5, .73, .12);
  shell(.27, .17, .5, .89, .12);
  b.box([.43, .22, .1], [.35, .29, .35], dark);
  return b.finish();
}

function fuji() {
  const b = new Builder();
  const mountain = material('#61746f');
  const snow = material('#f5faf7', { roughness: .88 });
  const foothill = material('#465e48');
  b.cylinder(.8, .87, .08, [0, .04, 0], foothill, 48);
  const radialSegments = 64;
  // Multiple rings allow a concave slope and a lightly uneven snowline.
  const createSlope = (rings, mat, snowLine = false) => {
    const vertices = [], normals = [], uvs = [], indices = [];
    for (let j = 0; j < rings.length; j++) {
      const [radius, y] = rings[j];
      for (let i = 0; i <= radialSegments; i++) {
        const theta = i / radialSegments * Math.PI * 2;
        const ripple = Math.sin(theta * 9) * .006 + Math.sin(theta * 17) * .004;
        const height = y + (snowLine && j === 0 ? Math.sin(theta * 7) * .035 + Math.sin(theta * 13) * .021 : 0);
        vertices.push(Math.cos(theta) * (radius + ripple), height, Math.sin(theta) * (radius + ripple));
        normals.push(0, 1, 0); uvs.push(i / radialSegments, j / (rings.length - 1));
        if (j > 0 && i > 0) {
          const a = j * (radialSegments + 1) + i;
          indices.push(a, a - radialSegments - 1, a - 1, a - 1, a - radialSegments - 1, a - radialSegments - 2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices); g.computeVertexNormals();
    b.add(g, mat);
  };
  createSlope([[.84, .07], [.65, .20], [.48, .41], [.33, .65], [.19, .93], [.10, 1.12], [.08, 1.15]], mountain);
  createSlope([[.29, .74], [.2, .93], [.10, 1.12], [.08, 1.16], [.04, 1.16]], snow, true);
  b.cylinder(.04, .04, .012, [0, 1.151, 0], darkStone, 16);
  return b.finish();
}

function colosseum() {
  const b = new Builder();
  const stone = material('#dcc59b');
  const recess = material('#6d6454');
  b.cylinder(.7, .73, .065, [0, .0325, 0], stone, 64);
  // Three open arcades surround the inner arena.
  for (let tier = 0; tier < 3; tier++) {
    const y = .065 + tier * .255;
    const segments = 40;
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const height = tier === 2 && i > 23 && i < 35 ? .10 : .22;
      const x = Math.sin(angle) * .61, z = Math.cos(angle) * .46;
      b.box([.047, height, .07], [x, y + height / 2, z], stone, [0, angle, 0]);
      const next = (i + .5) / segments * Math.PI * 2;
      const cx = Math.sin(next) * .61, cz = Math.cos(next) * .46;
      // Keystone arches leave dark voids through the structure.
      if (height > .15) {
        const torus = new THREE.TorusGeometry(.041, .017, 5, 12, Math.PI);
        b.add(torus, stone, [cx, y + .145, cz], [1, 1, 1], [0, next, 0]);
      }
      b.box([.115, .035, .085], [cx, y + height + .015, cz], paleStone, [0, next, 0]);
    }
  }
  // Inner ring and recessed sand floor are visible from flight altitude.
  b.cylinder(.43, .43, .06, [0, .095, 0], sandstone, 48);
  b.cylinder(.46, .46, .10, [0, .11, 0], recess, 48);
  b.cylinder(.41, .41, .015, [0, .17, 0], sandstone, 48);
  const result = b.finish();
  result.scale.set(1.15, 1.4, 1.15);
  return result;
}

const factories = { eiffel, liberty, pyramids, taj, christ, opera, fuji, colosseum };
export function createLandmark(type) {
  const make = factories[type];
  if (!make) throw new Error(`Unknown landmark type: ${type}`);
  const group = make();
  group.name = `landmark-${type}`;
  return group;
}
