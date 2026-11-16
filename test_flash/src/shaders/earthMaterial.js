import * as THREE from 'three';

/**
 * Creates custom high-fidelity Earth ShaderMaterial that dynamically blends
 * daytime satellite imagery, night city lights, specular ocean reflection,
 * twilight scattering along the terminator, and atmospheric limb haze.
 */
export function createEarthMaterial(textures, sunDirection) {
  const uniforms = {
    dayTexture: { value: textures.day },
    nightTexture: { value: textures.night },
    specularTexture: { value: textures.specular },
    normalTexture: { value: textures.normal },
    sunDirection: { value: sunDirection },
    atmosphereColor: { value: new THREE.Color(0x3a88e9) },
    twilightColor: { value: new THREE.Color(0xe65c00) }
  };

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform sampler2D specularTexture;
    uniform sampler2D normalTexture;
    uniform vec3 sunDirection;
    uniform vec3 atmosphereColor;
    uniform vec3 twilightColor;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec3 sunDir = normalize(sunDirection);

      // Dot product between surface normal and sunlight
      float sunDot = dot(normal, sunDir);

      // Smooth day-to-night blend across twilight terminator
      float dayFactor = smoothstep(-0.15, 0.20, sunDot);
      float nightFactor = 1.0 - dayFactor;

      // Sample textures
      vec3 dayColor = texture2D(dayTexture, vUv).rgb;
      vec3 nightColor = texture2D(nightTexture, vUv).rgb;
      float specMask = texture2D(specularTexture, vUv).r;

      // Daylight diffuse with ambient skylight
      float diffuse = max(sunDot, 0.0);
      vec3 dayLighting = dayColor * (diffuse * 0.95 + 0.08);

      // Ocean specular sun reflection
      vec3 halfVector = normalize(sunDir + viewDir);
      float specAngle = max(dot(normal, halfVector), 0.0);
      float specular = pow(specAngle, 32.0) * specMask;
      vec3 oceanSpecular = vec3(1.0, 0.96, 0.85) * specular * 1.8 * dayFactor;

      // Sunset / Sunrise atmospheric reddening along terminator
      float terminator = smoothstep(0.0, 0.25, 1.0 - abs(sunDot * 3.5));
      vec3 sunsetGlow = twilightColor * terminator * dayFactor * 0.45;

      // Night city lights (warm golden glow)
      vec3 cityLights = nightColor * vec3(1.3, 1.1, 0.8) * nightFactor * 2.2;

      // Atmospheric limb haze (Rayleigh scattering)
      float limb = 1.0 - max(dot(viewDir, normal), 0.0);
      float hazeFactor = pow(limb, 3.2) * (dayFactor * 0.8 + 0.2);
      vec3 atmosphericHaze = atmosphereColor * hazeFactor * 0.85;

      // Combine all layers
      vec3 finalColor = dayLighting + oceanSpecular + sunsetGlow + cityLights + atmosphericHaze;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader
  });
}

/**
 * Creates outer atmospheric halo glow shell with inverted Fresnel effect.
 */
export function createAtmosphereHaloMaterial(sunDirection) {
  const uniforms = {
    sunDirection: { value: sunDirection },
    glowColor: { value: new THREE.Color(0x0088ff) }
  };

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 sunDirection;
    uniform vec3 glowColor;

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec3 sunDir = normalize(sunDirection);

      // Inverted Fresnel: highest at the rim
      float rim = 1.0 - max(dot(viewDir, normal), 0.0);
      float intensity = pow(rim, 3.0) * 1.6;

      // Atmosphere is brightest on the sunlit limb, softer on dark side
      float sunFacing = dot(normal, sunDir) * 0.5 + 0.5;
      float alpha = intensity * (sunFacing * 0.75 + 0.25);

      vec3 color = mix(glowColor * 0.7, vec3(0.5, 0.85, 1.0), sunFacing);

      gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
}

