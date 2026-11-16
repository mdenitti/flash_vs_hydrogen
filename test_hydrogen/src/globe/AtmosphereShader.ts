import * as THREE from 'three';

/**
 * Creates the outer Rayleigh/Mie atmospheric scattering halo material rendered
 * on a slightly oversized BackSide sphere around the Earth. Fades out smoothly
 * at low altitude where the inner sky dome handles horizon scattering.
 *
 * @param sunDir - Normalized world-space vector pointing toward the sun.
 * @returns Configured ShaderMaterial for the outer atmosphere limb.
 */
export function createAtmosphereMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uDayColor: { value: new THREE.Color('#3b9eff') },
      uTwilightColor: { value: new THREE.Color('#e85f27') },
      uNightColor: { value: new THREE.Color('#09132b') },
      uCameraAltitude: { value: 4.5 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uDayColor;
      uniform vec3 uTwilightColor;
      uniform vec3 uNightColor;
      uniform float uCameraAltitude;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(vWorldPos - cameraPosition);
        float sunOrientation = dot(normal, normalize(uSunDir));

        // Grazing limb intensity from BackSide sphere normal
        float rim = clamp(1.0 + dot(viewDir, normal), 0.0, 1.0);
        float alpha = pow(smoothstep(0.0, 0.44, rim), 2.8);

        // Day -> twilight -> night scattering colors
        vec3 scatterColor = mix(uTwilightColor, uDayColor, smoothstep(-0.22, 0.55, sunOrientation));
        scatterColor = mix(uNightColor, scatterColor, smoothstep(-0.48, -0.05, sunOrientation));

        float sunMask = smoothstep(-0.55, 0.75, sunOrientation);
        // Smoothly reveal outer limb glow as altitude climbs toward orbit
        float orbitalReveal = smoothstep(8.0, 26.0, uCameraAltitude);
        float finalAlpha = alpha * mix(0.12, 0.78, sunMask) * mix(0.28, 1.0, orbitalReveal);

        gl_FragColor = vec4(scatterColor, clamp(finalAlpha, 0.0, 0.85));
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Creates the dynamic inner sky dome & deep space backdrop shader that blends
 * between deep cosmic night/sun corona at high altitude and luminous atmospheric
 * horizon scattering when flying low inside the atmosphere.
 *
 * @param sunDir - Normalized world-space sun direction.
 * @returns Configured ShaderMaterial for the outer sky dome.
 */
export function createSkyDomeMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uLocalUp: { value: new THREE.Vector3(0, 1, 0) },
      uCameraAltitude: { value: 4.5 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uLocalUp;
      uniform float uCameraAltitude;

      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        vec3 sunDir = normalize(uSunDir);
        vec3 up = normalize(uLocalUp);

        float sunCos = dot(dir, sunDir);
        float localSunHeight = dot(up, sunDir);
        float horizonDot = clamp(dot(dir, up), -0.5, 1.0);

        // Atmospheric presence fades cleanly as we climb toward orbital space
        float atmoWeight = 1.0 - smoothstep(11.0, 38.0, uCameraAltitude);
        float dayWeight = smoothstep(-0.22, 0.25, localSunHeight);
        float twilightWeight = exp(-pow((localSunHeight + 0.02) / 0.16, 2.0));

        // Rich, well-exposed atmospheric sky palette (never clips daytime sky into bloom)
        vec3 spaceColor = vec3(0.008, 0.014, 0.032);
        vec3 zenithDay = vec3(0.055, 0.19, 0.48);
        vec3 horizonDay = vec3(0.32, 0.56, 0.84);
        vec3 horizonSunset = vec3(0.84, 0.36, 0.17);

        vec3 skyZenith = mix(spaceColor, zenithDay, dayWeight * 0.88);
        vec3 skyHorizon = mix(vec3(0.02, 0.04, 0.09), horizonDay, dayWeight);
        skyHorizon = mix(skyHorizon, horizonSunset, twilightWeight * 0.72);

        float horizonCurve = pow(1.0 - clamp(abs(horizonDot), 0.0, 1.0), 2.8);
        vec3 skyColor = mix(skyZenith, skyHorizon, horizonCurve);

        vec3 baseColor = mix(spaceColor, skyColor, atmoWeight);

        // Crisp HDR solar disc + warm Mie corona
        float sunDisc = smoothstep(0.99945, 0.99982, sunCos);
        float sunHalo = pow(max(sunCos, 0.0), 56.0) * 0.35 + pow(max(sunCos, 0.0), 10.0) * 0.08;
        vec3 sunTint = mix(vec3(1.0, 0.55, 0.28), vec3(1.0, 0.97, 0.90), smoothstep(-0.1, 0.4, localSunHeight));
        baseColor += sunTint * (sunHalo + sunDisc * 3.8);

        gl_FragColor = vec4(baseColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/**
 * Creates the drifting planetary cloud shell material using the blue channel of
 * the 4K Earth bump/roughness/clouds packed texture.
 *
 * @param bumpRoughCloudsTex - Packed 4K Earth texture (B = clouds).
 * @param sunDir - Normalized sun direction vector.
 * @param cloudAlt - Cloud shell altitude above GLOBE_RADIUS.
 * @param globeRadius - Base globe radius.
 * @returns Configured ShaderMaterial for planetary cloud deck.
 */
export function createCloudShellMaterial(
  bumpRoughCloudsTex: THREE.Texture,
  sunDir: THREE.Vector3,
  cloudAlt: number,
  globeRadius: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCloudTex: { value: bumpRoughCloudsTex },
      uSunDir: { value: sunDir.clone().normalize() },
      uUvOffset: { value: 0 },
      uCloudRadius: { value: globeRadius + cloudAlt },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uCloudTex;
      uniform vec3 uSunDir;
      uniform float uUvOffset;
      uniform float uCloudRadius;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec2 shiftedUv = vec2(fract(vUv.x + uUvOffset), vUv.y);
        float cloudRaw = texture2D(uCloudTex, shiftedUv).b;
        float density = smoothstep(0.26, 0.88, cloudRaw);
        if (density < 0.02) discard;

        vec3 normal = normalize(vWorldNormal);
        float sunDot = dot(normal, normalize(uSunDir));

        // Day -> golden twilight -> cool midnight cloud colors
        vec3 dayCloud = vec3(0.90, 0.94, 0.98);
        vec3 sunsetCloud = vec3(0.94, 0.52, 0.34);
        vec3 nightCloud = vec3(0.05, 0.07, 0.14);

        float twilight = exp(-pow((sunDot + 0.02) / 0.18, 2.0));
        vec3 cloudColor = mix(nightCloud, dayCloud, smoothstep(-0.22, 0.32, sunDot));
        cloudColor = mix(cloudColor, sunsetCloud, twilight * 0.6);

        // Fade gently when camera passes right through the cloud deck
        float camRadius = length(cameraPosition);
        float camFade = smoothstep(0.35, 2.4, abs(camRadius - uCloudRadius));
        float viewDot = abs(dot(normalize(cameraPosition - vWorldPos), normal));
        float limbFade = smoothstep(0.04, 0.28, viewDot);

        float alpha = density * 0.56 * camFade * limbFade;
        gl_FragColor = vec4(cloudColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
