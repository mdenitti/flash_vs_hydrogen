import * as THREE from 'three';
import {
  ATMOSPHERE_RADIUS,
  CLOUD_DECK_ALTITUDE,
  GLOBE_RADIUS,
  TERRAIN_RELIEF_SCALE,
} from '../core/constants.ts';
import {
  createAtmosphereMaterial,
  createCloudShellMaterial,
  createSkyDomeMaterial,
} from './AtmosphereShader.ts';

export interface GlobeAssembly {
  group: THREE.Group;
  earthMesh: THREE.Mesh;
  cloudMesh: THREE.Mesh;
  atmosphereMesh: THREE.Mesh;
  skyDomeMesh: THREE.Mesh;
  moonMesh: THREE.Mesh;
  starsPoints: THREE.Points;
  getSurfaceRadius: (latDeg: number, lonDeg: number) => number;
  getWaterMask: (latDeg: number, lonDeg: number) => number;
  update: (
    dt: number,
    elapsed: number,
    sunDir: THREE.Vector3,
    cameraPos: THREE.Vector3
  ) => void;
  readyPromise: Promise<void>;
}

/**
 * Samples pixel brightness from a loaded HTMLImageElement into a flat Uint8Array
 * grid for fast O(1) terrain elevation and water mask lookups.
 */
class EquirectangularGrid {
  public readonly width: number;
  public readonly height: number;
  public readonly data: Uint8ClampedArray;

  constructor(image: HTMLImageElement, targetWidth = 1024, targetHeight = 512) {
    this.width = targetWidth;
    this.height = targetHeight;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      this.data = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
    } else {
      this.data = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    }
  }

  /**
   * Bilinearly samples channel (0=R, 1=G, 2=B) at geographic coordinates.
   *
   * @param latDeg - Latitude in degrees [-90, 90].
   * @param lonDeg - Longitude in degrees [-180, 180].
   * @param channel - RGB channel index (0..2).
   * @returns Normalized sample in [0, 1].
   */
  public sample(latDeg: number, lonDeg: number, channel = 0): number {
    const u = (((lonDeg + 180) / 360) % 1 + 1) % 1;
    const v = THREE.MathUtils.clamp((90 - latDeg) / 180, 0, 1);

    const fx = u * (this.width - 1);
    const fy = v * (this.height - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = (x0 + 1) % this.width;
    const y1 = Math.min(this.height - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;

    const i00 = (y0 * this.width + x0) * 4 + channel;
    const i10 = (y0 * this.width + x1) * 4 + channel;
    const i01 = (y1 * this.width + x0) * 4 + channel;
    const i11 = (y1 * this.width + x1) * 4 + channel;

    const c0 = this.data[i00] * (1 - tx) + this.data[i10] * tx;
    const c1 = this.data[i01] * (1 - tx) + this.data[i11] * tx;
    return (c0 * (1 - ty) + c1 * ty) / 255;
  }
}

/**
 * Loads an image from URL via TextureLoader and resolves with the Texture.
 *
 * @param loader - Shared THREE.TextureLoader instance.
 * @param url - Public path to the texture image.
 * @param anisotropy - Max anisotropic filtering supported by GPU.
 * @param isSRGB - Whether to mark colorSpace as SRGBColorSpace.
 * @returns Promise resolving with loaded THREE.Texture.
 */
function loadTextureAsync(
  loader: THREE.TextureLoader,
  url: string,
  anisotropy: number,
  isSRGB = false
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.anisotropy = anisotropy;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        if (isSRGB) {
          tex.colorSpace = THREE.SRGBColorSpace;
        }
        resolve(tex);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Generates a soft circular radial sprite texture for photographic star points.
 *
 * @returns CanvasTexture with smooth circular radial alpha falloff.
 */
function createStarSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(220,235,255,0.22)');
  grad.addColorStop(1.0, 'rgba(200,220,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the starry space backdrop with variable star spectral temperatures
 * and subtle Milky Way band density.
 *
 * @returns THREE.Points mesh representing distant stars.
 */
function createStarfield(): THREE.Points {
  const starCount = 5200;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  const palette = [
    new THREE.Color('#cad8ff'), // O/B blue-white
    new THREE.Color('#f4f6ff'), // A white
    new THREE.Color('#fff2dc'), // G warm white
    new THREE.Color('#ffd3a8'), // K orange-gold
  ];

  for (let i = 0; i < starCount; i++) {
    // Mix isotropic sky stars with denser galactic plane belt
    const inMilkyWay = i < starCount * 0.42;
    const theta = Math.random() * Math.PI * 2;
    let phi: number;
    if (inMilkyWay) {
      const gaussian = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      phi = Math.PI * 0.5 + gaussian * 0.42;
    } else {
      phi = Math.acos(2 * Math.random() - 1);
    }

    const r = 1650 + Math.random() * 250;
    const sinPhi = Math.sin(phi);
    let x = r * sinPhi * Math.cos(theta);
    let y = r * Math.cos(phi);
    let z = r * sinPhi * Math.sin(theta);

    // Tilt Milky Way plane diagonally across the sky
    if (inMilkyWay) {
      const tilt = 0.68;
      const ny = y * Math.cos(tilt) - z * Math.sin(tilt);
      const nz = y * Math.sin(tilt) + z * Math.cos(tilt);
      y = ny;
      z = nz;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const baseColor = palette[Math.floor(Math.random() * palette.length)];
    const brightness = 0.35 + Math.pow(Math.random(), 2.6) * 0.9;
    colors[i * 3] = baseColor.r * brightness;
    colors[i * 3 + 1] = baseColor.g * brightness;
    colors[i * 3 + 2] = baseColor.b * brightness;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 4.6,
    map: createStarSpriteTexture(),
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}

/**
 * Constructs the ultrarealistic Earth globe, displaced 3D topography, GLSL ocean/land
 * PBR shader enhancements, drifting planetary clouds, Rayleigh atmosphere halo,
 * dynamic horizon sky dome, starfield, and orbiting Moon.
 *
 * @param renderer - Active WebGLRenderer used to determine max anisotropy.
 * @param sunDir - Initial normalized sun direction vector.
 * @returns GlobeAssembly with meshes, elevation samplers, and per-frame update hook.
 */
export function buildGlobe(
  renderer: THREE.WebGLRenderer,
  sunDir: THREE.Vector3
): GlobeAssembly {
  const group = new THREE.Group();
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();

  const dayTex = loader.load('/textures/earth-blue-marble.jpg');
  dayTex.colorSpace = THREE.SRGBColorSpace;
  dayTex.anisotropy = maxAnisotropy;

  const nightTex = loader.load('/textures/earth_night_4096.jpg');
  nightTex.colorSpace = THREE.SRGBColorSpace;
  nightTex.anisotropy = maxAnisotropy;

  const normalTex = loader.load('/textures/earth_normal_2048.jpg');
  normalTex.anisotropy = maxAnisotropy;

  const bumpRoughCloudsTex = loader.load('/textures/earth_bump_roughness_clouds_4096.jpg');
  bumpRoughCloudsTex.anisotropy = maxAnisotropy;

  const specularTex = loader.load('/textures/earth_specular_2048.jpg');
  specularTex.anisotropy = maxAnisotropy;

  const moonTex = loader.load('/textures/moon_1024.jpg');
  moonTex.colorSpace = THREE.SRGBColorSpace;

  const shaderUniforms = {
    uSunDir: { value: sunDir.clone().normalize() },
    uTime: { value: 0 },
    uCloudOffset: { value: 0 },
    uNightMap: { value: nightTex },
    uSpecularMap: { value: specularTex },
    uBumpRoughCloudsMap: { value: bumpRoughCloudsTex },
  };

  // High-density Earth sphere geometry for physical terrain relief & smooth horizon
  const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 256, 128);

  const earthMat = new THREE.MeshStandardMaterial({
    map: dayTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.15, 1.15),
    metalness: 0.04,
    roughness: 0.72,
  });

  earthMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = shaderUniforms.uSunDir;
    shader.uniforms.uTime = shaderUniforms.uTime;
    shader.uniforms.uCloudOffset = shaderUniforms.uCloudOffset;
    shader.uniforms.uNightMap = shaderUniforms.uNightMap;
    shader.uniforms.uSpecularMap = shaderUniforms.uSpecularMap;
    shader.uniforms.uBumpRoughCloudsMap = shaderUniforms.uBumpRoughCloudsMap;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying vec3 vGlobeWorldPos;
        varying vec3 vGlobeWorldNormal;
        varying vec2 vGlobeUv;
      `
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vec4 globeWorldPosition = modelMatrix * vec4( transformed, 1.0 );
        vGlobeWorldPos = globeWorldPosition.xyz;
        vGlobeWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
        vGlobeUv = uv;
      `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uCloudOffset;
        uniform sampler2D uNightMap;
        uniform sampler2D uSpecularMap;
        uniform sampler2D uBumpRoughCloudsMap;

        varying vec3 vGlobeWorldPos;
        varying vec3 vGlobeWorldNormal;
        varying vec2 vGlobeUv;

        float globeHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float globeNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(globeHash(i + vec3(0,0,0)), globeHash(i + vec3(1,0,0)), f.x),
                mix(globeHash(i + vec3(0,1,0)), globeHash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(globeHash(i + vec3(0,0,1)), globeHash(i + vec3(1,0,1)), f.x),
                mix(globeHash(i + vec3(0,1,1)), globeHash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float globeFbm(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * globeNoise(p);
            p *= 2.15;
            a *= 0.5;
          }
          return v;
        }
      `
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        float oceanMask = smoothstep(0.28, 0.72, texture2D(uSpecularMap, vGlobeUv).r);
        vec3 brcSample = texture2D(uBumpRoughCloudsMap, vGlobeUv).rgb;

        // Subtle close-range land micro-texture so flying low feels organic & rich
        float microLand = globeFbm(vGlobeWorldPos * 0.95);
        float landShade = mix(0.88, 1.14, microLand);
        diffuseColor.rgb = mix(diffuseColor.rgb * landShade, diffuseColor.rgb, oceanMask);

        // Enhance deep/coastal ocean vibrancy slightly under sunlight
        vec3 deepWaterBoost = diffuseColor.rgb * vec3(0.95, 1.06, 1.16);
        diffuseColor.rgb = mix(diffuseColor.rgb, deepWaterBoost, oceanMask * 0.55);

        // Soft planetary cloud shadows cast onto Earth surface
        vec2 shadowUv = vec2(fract(vGlobeUv.x + uCloudOffset + 0.0025), clamp(vGlobeUv.y - 0.0015, 0.0, 1.0));
        float cloudShadowRaw = texture2D(uBumpRoughCloudsMap, shadowUv).b;
        float cloudShadow = smoothstep(0.32, 0.9, cloudShadowRaw);
        float sunFacingShadow = smoothstep(-0.05, 0.25, dot(normalize(vGlobeWorldNormal), normalize(uSunDir)));
        diffuseColor.rgb *= 1.0 - cloudShadow * 0.28 * sunFacingShadow;
      `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        float oceanMaskR = smoothstep(0.28, 0.72, texture2D(uSpecularMap, vGlobeUv).r);
        float snowLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float landRoughness = mix(0.86, 0.58, smoothstep(0.65, 0.92, snowLum));
        roughnessFactor = mix(landRoughness, 0.15, oceanMaskR);
      `
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        float oceanMaskN = smoothstep(0.28, 0.72, texture2D(uSpecularMap, vGlobeUv).r);
        vec3 nWorld = normalize(vGlobeWorldNormal);

        // Procedural ocean swell ripples vs crisp terrain micro-bumps in world space -> view space
        vec3 waveA = vGlobeWorldPos * 3.8 + vec3(uTime * 0.32, 0.0, uTime * 0.19);
        vec3 waveB = vGlobeWorldPos * 7.6 - vec3(uTime * 0.21, uTime * 0.28, 0.0);
        vec3 landPos = vGlobeWorldPos * 2.6;

        float eps = 0.04;
        float h0 = mix(globeFbm(landPos), (globeNoise(waveA) + globeNoise(waveB) * 0.5) * 0.66, oceanMaskN);
        float hx = mix(globeFbm(landPos + vec3(eps, 0.0, 0.0)), (globeNoise(waveA + vec3(eps, 0.0, 0.0)) + globeNoise(waveB + vec3(eps, 0.0, 0.0)) * 0.5) * 0.66, oceanMaskN);
        float hy = mix(globeFbm(landPos + vec3(0.0, eps, 0.0)), (globeNoise(waveA + vec3(0.0, eps, 0.0)) + globeNoise(waveB + vec3(0.0, eps, 0.0)) * 0.5) * 0.66, oceanMaskN);
        float hz = mix(globeFbm(landPos + vec3(0.0, 0.0, eps)), (globeNoise(waveA + vec3(0.0, 0.0, eps)) + globeNoise(waveB + vec3(0.0, 0.0, eps)) * 0.5) * 0.66, oceanMaskN);

        vec3 grad = vec3(hx - h0, hy - h0, hz - h0) / eps;
        grad -= nWorld * dot(grad, nWorld);
        float strength = mix(0.085, 0.055, oceanMaskN);
        vec3 worldPerturb = -grad * strength;
        vec3 viewPerturb = (viewMatrix * vec4(worldPerturb, 0.0)).xyz;
        normal = normalize(normal + viewPerturb);
      `
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
        #include <emissivemap_fragment>
        float sunDot = dot(normalize(vGlobeWorldNormal), normalize(uSunDir));
        float nightMask = smoothstep(0.16, -0.22, sunDot);
        vec3 cityLights = texture2D(uNightMap, vGlobeUv).rgb;
        // Slightly warm gold city light boost and soft ocean night ambient
        totalEmissiveRadiance += cityLights * vec3(1.45, 1.15, 0.78) * nightMask * 1.35;
        totalEmissiveRadiance += vec3(0.008, 0.015, 0.032) * nightMask;
      `
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        vec3 globeN = normalize(vGlobeWorldNormal);
        vec3 globeV = normalize(cameraPosition - vGlobeWorldPos);
        float fresnelView = pow(1.0 - max(dot(globeN, globeV), 0.0), 3.1);
        float sunDotFinal = dot(globeN, normalize(uSunDir));

        // Rayleigh atmospheric aerial perspective + golden terminator scatter
        float dayAtmo = smoothstep(-0.28, 0.45, sunDotFinal);
        float twilightBand = exp(-pow((sunDotFinal + 0.02) / 0.17, 2.0));
        vec3 horizonScatter = mix(vec3(0.02, 0.04, 0.10), vec3(0.28, 0.56, 0.86), dayAtmo);
        horizonScatter = mix(horizonScatter, vec3(0.88, 0.38, 0.16), twilightBand * 0.68);

        outgoingLight = mix(outgoingLight, horizonScatter, fresnelView * mix(0.20, 0.46, dayAtmo));
        // Subtle warm sunset glow across terminator terrain
        outgoingLight += vec3(0.22, 0.08, 0.02) * twilightBand * (1.0 - oceanMask * 0.35) * 0.28;

        #include <opaque_fragment>
      `
      );
  };

  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.receiveShadow = true;
  group.add(earthMesh);

  // Drifting high-altitude cloud deck
  const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS + CLOUD_DECK_ALTITUDE, 128, 64);
  const cloudMat = createCloudShellMaterial(
    bumpRoughCloudsTex,
    sunDir,
    CLOUD_DECK_ALTITUDE,
    GLOBE_RADIUS
  );
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.renderOrder = 2;
  group.add(cloudMesh);

  // Outer Rayleigh atmospheric halo
  const atmoGeo = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 96, 48);
  const atmoMat = createAtmosphereMaterial(sunDir);
  const atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
  atmosphereMesh.renderOrder = 3;
  group.add(atmosphereMesh);

  // Dynamic sky & solar corona dome
  const skyGeo = new THREE.SphereGeometry(2200, 48, 32);
  const skyMat = createSkyDomeMaterial(sunDir);
  const skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
  skyDomeMesh.renderOrder = -2;
  group.add(skyDomeMesh);

  // Distant multi-spectral starfield
  const starsPoints = createStarfield();
  starsPoints.renderOrder = -1;
  group.add(starsPoints);

  // Orbiting textured Moon in outer space
  const moonGeo = new THREE.SphereGeometry(11.5, 48, 32);
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    roughness: 0.92,
    metalness: 0.0,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(-480, 145, -360);
  group.add(moonMesh);

  let elevGrid: EquirectangularGrid | null = null;
  let waterGrid: EquirectangularGrid | null = null;

  /**
   * Computes terrain surface radius at given lat/lon using loaded 4K elevation & water masks.
   *
   * @param latDeg - Latitude in degrees.
   * @param lonDeg - Longitude in degrees.
   * @returns World radius from globe center to ground surface.
   */
  const getSurfaceRadius = (latDeg: number, lonDeg: number): number => {
    if (!elevGrid || !waterGrid) return GLOBE_RADIUS;
    const water = waterGrid.sample(latDeg, lonDeg, 0);
    if (water > 0.55) return GLOBE_RADIUS;
    const landMask = 1 - THREE.MathUtils.smoothstep(water, 0.25, 0.6);
    const elev = elevGrid.sample(latDeg, lonDeg, 0);
    return GLOBE_RADIUS + elev * TERRAIN_RELIEF_SCALE * landMask;
  };

  /**
   * Returns [0..1] ocean water mask (1 = open ocean, 0 = solid land).
   *
   * @param latDeg - Latitude in degrees.
   * @param lonDeg - Longitude in degrees.
   * @returns Ocean water mask in [0, 1].
   */
  const getWaterMask = (latDeg: number, lonDeg: number): number => {
    if (!waterGrid) return 0;
    return waterGrid.sample(latDeg, lonDeg, 0);
  };

  // Load packed elevation & water mask images to displace globe geometry smoothly
  const readyPromise = Promise.all([
    loadTextureAsync(loader, '/textures/earth_bump_roughness_clouds_4096.jpg', maxAnisotropy),
    loadTextureAsync(loader, '/textures/earth_specular_2048.jpg', maxAnisotropy),
  ]).then(([brcTex, specTex]) => {
    const brcImg = brcTex.image as HTMLImageElement;
    const specImg = specTex.image as HTMLImageElement;
    elevGrid = new EquirectangularGrid(brcImg, 1024, 512);
    waterGrid = new EquirectangularGrid(specImg, 1024, 512);

    const posAttr = earthGeo.getAttribute('position') as THREE.BufferAttribute;
    const uvAttr = earthGeo.getAttribute('uv') as THREE.BufferAttribute;
    const v = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const u = uvAttr.getX(i);
      const uvY = uvAttr.getY(i);
      const lonDeg = u * 360 - 180;
      const latDeg = uvY * 180 - 90;
      const r = getSurfaceRadius(latDeg, lonDeg);
      v.normalize().multiplyScalar(r);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }

    posAttr.needsUpdate = true;
    earthGeo.computeVertexNormals();
  });

  const tempUp = new THREE.Vector3();

  /**
   * Updates globe shaders, cloud drift, atmospheric limb, sky dome, and Moon orbit.
   *
   * @param dt - Frame delta time in seconds.
   * @param elapsed - Total elapsed time in seconds.
   * @param currentSunDir - Current normalized sun direction vector.
   * @param cameraPos - Current world-space camera position.
   */
  const update = (
    dt: number,
    elapsed: number,
    currentSunDir: THREE.Vector3,
    cameraPos: THREE.Vector3
  ): void => {
    shaderUniforms.uSunDir.value.copy(currentSunDir).normalize();
    shaderUniforms.uTime.value = elapsed;
    shaderUniforms.uCloudOffset.value = (shaderUniforms.uCloudOffset.value + dt * 0.0014) % 1;

    cloudMat.uniforms.uSunDir.value.copy(shaderUniforms.uSunDir.value);
    cloudMat.uniforms.uUvOffset.value = shaderUniforms.uCloudOffset.value;

    const camRadius = cameraPos.length();
    const camAlt = Math.max(0, camRadius - GLOBE_RADIUS);
    atmoMat.uniforms.uSunDir.value.copy(shaderUniforms.uSunDir.value);
    atmoMat.uniforms.uCameraAltitude.value = camAlt;

    tempUp.copy(cameraPos).normalize();
    skyMat.uniforms.uSunDir.value.copy(shaderUniforms.uSunDir.value);
    skyMat.uniforms.uLocalUp.value.copy(tempUp);
    skyMat.uniforms.uCameraAltitude.value = camAlt;

    // Fade star visibility in bright low-altitude daytime sky, crisp at night & high orbit
    const localSunHeight = tempUp.dot(shaderUniforms.uSunDir.value);
    const daySuppression = THREE.MathUtils.smoothstep(localSunHeight, -0.15, 0.25);
    const orbitReveal = THREE.MathUtils.smoothstep(camAlt, 14, 34);
    const starAlpha = THREE.MathUtils.clamp(
      Math.max(1 - daySuppression * 0.96, orbitReveal),
      0.0,
      0.92
    );
    (starsPoints.material as THREE.PointsMaterial).opacity = starAlpha;

    // Gentle Moon orbit
    const moonAngle = elapsed * 0.008 + 2.4;
    moonMesh.position.set(
      Math.cos(moonAngle) * 580,
      155,
      Math.sin(moonAngle) * 580
    );
    moonMesh.rotation.y = elapsed * 0.02;
  };

  return {
    group,
    earthMesh,
    cloudMesh,
    atmosphereMesh,
    skyDomeMesh,
    moonMesh,
    starsPoints,
    getSurfaceRadius,
    getWaterMask,
    update,
    readyPromise,
  };
}
