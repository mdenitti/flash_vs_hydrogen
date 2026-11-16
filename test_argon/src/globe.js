import * as THREE from 'three';

export class UltrarealisticGlobe {
  constructor(scene, radius = 160) {
    this.scene = scene;
    this.radius = radius;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.sunDirection = new THREE.Vector3(1, 0.35, 0.5).normalize();
    this.cloudRotationOffset = 0;

    const loader = new THREE.TextureLoader();
    const maxAnisotropy = 8;

    const dayTex = loader.load('/textures/earth_atmos_2048.jpg');
    const normalTex = loader.load('/textures/earth_normal_2048.jpg');
    const specTex = loader.load('/textures/earth_specular_2048.jpg');
    const lightsTex = loader.load('/textures/earth_lights_2048.png');
    const cloudsTex = loader.load('/textures/earth_clouds_1024.png');
    const moonTex = loader.load('/textures/moon_1024.jpg');

    [dayTex, lightsTex, moonTex].forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
    });
    [normalTex, specTex, cloudsTex].forEach((t) => {
      t.colorSpace = THREE.NoColorSpace;
    });
    [dayTex, normalTex, specTex, lightsTex, cloudsTex, moonTex].forEach((t) => {
      t.anisotropy = maxAnisotropy;
    });
    cloudsTex.wrapS = THREE.RepeatWrapping;
    cloudsTex.wrapT = THREE.ClampToEdgeWrapping;

    this.createStarfield();
    this.createEarthSurface(dayTex, normalTex, specTex, lightsTex, cloudsTex);
    this.createCloudLayer(cloudsTex);
    this.createAtmosphereHalo();
    this.createVolumetricSkyClouds();
    this.createSunAndMoon(moonTex);
    this.createGreatCircleGuideArc();
  }

  createStarfield() {
    const count = 4500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 1100 + Math.random() * 700;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const tint = Math.random();
      if (tint < 0.25) {
        colors[i * 3] = 0.75;
        colors[i * 3 + 1] = 0.86;
        colors[i * 3 + 2] = 1.0;
      } else if (tint < 0.5) {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.94;
        colors[i * 3 + 2] = 0.82;
      } else {
        colors[i * 3] = 0.95;
        colors[i * 3 + 1] = 0.97;
        colors[i * 3 + 2] = 1.0;
      }
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  createEarthSurface(dayTex, normalTex, specTex, lightsTex, cloudsTex) {
    const geo = new THREE.SphereGeometry(this.radius, 128, 128);

    this.earthUniforms = {
      uDayTexture: { value: dayTex },
      uNormalMap: { value: normalTex },
      uSpecularMap: { value: specTex },
      uLightsTexture: { value: lightsTex },
      uCloudsTexture: { value: cloudsTex },
      uSunDir: { value: this.sunDirection },
      uCloudOffset: { value: 0.0 },
    };

    const vertexShader = /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      varying vec3 vTangent;
      varying vec3 vBitangent;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vPosWorld = worldPosition.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);

        // Compute smooth geographic East tangent basis for normal map relief shading
        vec3 tangent = length(normal.xz) > 0.001
          ? normalize(vec3(-normal.z, 0.0, normal.x))
          : vec3(1.0, 0.0, 0.0);
        vTangent = normalize(mat3(modelMatrix) * tangent);
        vBitangent = normalize(cross(vNormalWorld, vTangent));

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;

    const fragmentShader = /* glsl */ `
      uniform sampler2D uDayTexture;
      uniform sampler2D uNormalMap;
      uniform sampler2D uSpecularMap;
      uniform sampler2D uLightsTexture;
      uniform sampler2D uCloudsTexture;
      uniform vec3 uSunDir;
      uniform float uCloudOffset;

      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      varying vec3 vTangent;
      varying vec3 vBitangent;

      void main() {
        vec3 dayColor = texture2D(uDayTexture, vUv).rgb;
        vec3 nightLights = texture2D(uLightsTexture, vUv).rgb;
        float oceanMask = texture2D(uSpecularMap, vUv).r;

        // Perturb surface normal using normal map for mountain relief
        vec3 mapN = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
        mapN.xy *= 1.85;
        mat3 TBN = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormalWorld));
        vec3 N = normalize(TBN * mapN);
        vec3 geoN = normalize(vNormalWorld);

        vec3 V = normalize(cameraPosition - vPosWorld);
        vec3 L = normalize(uSunDir);

        float sunDot = dot(geoN, L);
        float reliefDot = max(dot(N, L), 0.0);

        // Cloud shadow sampling on ground
        vec2 shadowUv = vec2(fract(vUv.x + uCloudOffset - 0.0025), vUv.y);
        float cloudShadow = texture2D(uCloudsTexture, shadowUv).r;

        // Smooth day/night blend factor
        float dayFactor = smoothstep(-0.18, 0.25, sunDot);
        float twilightFactor = smoothstep(-0.22, 0.04, sunDot) * (1.0 - smoothstep(0.04, 0.32, sunDot));

        // Enhance ocean deep blue & continental vibrancy
        vec3 vibrantDay = mix(dayColor * 1.25, dayColor * vec3(0.88, 1.08, 1.28), oceanMask * 0.48);
        vec3 litDay = vibrantDay * (0.24 + 0.88 * reliefDot) * (1.0 - cloudShadow * 0.35);

        // Ocean sun specular glint
        vec3 H = normalize(L + V);
        float specBase = pow(max(dot(N, H), 0.0), 46.0);
        float specBroad = pow(max(dot(geoN, H), 0.0), 12.0);
        vec3 oceanGlint = vec3(1.0, 0.93, 0.80) * (specBase * 0.75 + specBroad * 0.22) * oceanMask * dayFactor;

        // Warm sunset/sunrise twilight band along the terminator
        vec3 twilightGlow = vec3(1.0, 0.42, 0.14) * twilightFactor * (0.55 + 0.45 * (1.0 - oceanMask));

        // Night hemisphere: moonlit indigo ambient + glowing golden city lights
        vec3 nightAmbient = vibrantDay * vec3(0.14, 0.22, 0.38);
        vec3 cityGlow = pow(nightLights, vec3(1.2)) * vec3(1.0, 0.82, 0.48) * 2.2 * (1.0 - cloudShadow * 0.5);
        vec3 litNight = nightAmbient + cityGlow * (1.0 - smoothstep(-0.08, 0.18, sunDot));

        // Atmospheric horizon Fresnel scattering on the surface
        float fresnel = pow(1.0 - max(dot(geoN, V), 0.0), 3.2);
        vec3 atmoRimColor = mix(vec3(0.08, 0.28, 0.65), vec3(0.32, 0.68, 1.0), dayFactor);
        atmoRimColor = mix(atmoRimColor, vec3(1.0, 0.5, 0.2), twilightFactor * 0.7);

        vec3 finalColor = mix(litNight, litDay + oceanGlint, dayFactor) + twilightGlow * 0.48;
        finalColor += atmoRimColor * fresnel * (0.22 + 0.58 * dayFactor);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: this.earthUniforms,
      vertexShader,
      fragmentShader,
    });

    this.earthMesh = new THREE.Mesh(geo, mat);
    this.group.add(this.earthMesh);
  }

  createCloudLayer(cloudsTex) {
    const cloudGeo = new THREE.SphereGeometry(this.radius * 1.008, 96, 96);
    this.cloudUniforms = {
      uCloudsTexture: { value: cloudsTex },
      uSunDir: { value: this.sunDirection },
      uCloudOffset: { value: 0.0 },
    };

    const cloudMat = new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalWorld;
        void main() {
          vUv = uv;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uCloudsTexture;
        uniform vec3 uSunDir;
        uniform float uCloudOffset;
        varying vec2 vUv;
        varying vec3 vNormalWorld;

        void main() {
          vec2 uvShifted = vec2(fract(vUv.x + uCloudOffset), vUv.y);
          float cloudDensity = texture2D(uCloudsTexture, uvShifted).r;
          float sunDot = dot(normalize(vNormalWorld), normalize(uSunDir));
          float dayFactor = smoothstep(-0.2, 0.25, sunDot);
          float twilight = smoothstep(-0.22, 0.05, sunDot) * (1.0 - smoothstep(0.05, 0.3, sunDot));

          vec3 cloudCol = mix(vec3(0.08, 0.13, 0.24), vec3(1.0, 0.99, 1.0), dayFactor);
          cloudCol = mix(cloudCol, vec3(1.0, 0.58, 0.32), twilight * 0.75);

          gl_FragColor = vec4(cloudCol, cloudDensity * 0.72);
        }
      `,
    });

    this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.group.add(this.cloudMesh);
  }

  createAtmosphereHalo() {
    const haloGeo = new THREE.SphereGeometry(this.radius * 1.095, 96, 96);
    this.haloUniforms = {
      uSunDir: { value: this.sunDirection },
    };

    const haloMat = new THREE.ShaderMaterial({
      uniforms: this.haloUniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vNormalWorld;
        varying vec3 vPosWorld;
        void main() {
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vPosWorld = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        varying vec3 vNormalWorld;
        varying vec3 vPosWorld;

        void main() {
          vec3 V = normalize(cameraPosition - vPosWorld);
          vec3 N = normalize(vNormalWorld);
          float rim = pow(clamp(0.68 - dot(N, V), 0.0, 1.0), 2.4);

          float sunAngle = dot(-N, normalize(uSunDir));
          float daySide = smoothstep(-0.35, 0.35, sunAngle);
          float sunsetBand = smoothstep(-0.35, 0.0, sunAngle) * (1.0 - smoothstep(0.0, 0.4, sunAngle));

          vec3 scatterColor = mix(vec3(0.05, 0.16, 0.42), vec3(0.28, 0.68, 1.0), daySide);
          scatterColor = mix(scatterColor, vec3(1.0, 0.48, 0.18), sunsetBand * 0.75);

          float alpha = rim * (0.18 + 0.78 * daySide);
          gl_FragColor = vec4(scatterColor, alpha);
        }
      `,
    });

    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.group.add(this.haloMesh);
  }

  // Create 3D puffy cloud clusters at flight altitude so the plane can fly right through them
  createVolumetricSkyClouds() {
    this.skyCloudsGroup = new THREE.Group();
    this.group.add(this.skyCloudsGroup);

    const puffGeo = new THREE.DodecahedronGeometry(1.0, 1);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.62,
      flatShading: true,
    });

    const clusterCount = 48;
    for (let c = 0; c < clusterCount; c++) {
      const cluster = new THREE.Group();
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const alt = this.radius + 7.5 + Math.random() * 6.5;

      const pos = new THREE.Vector3(
        alt * Math.sin(phi) * Math.cos(theta),
        alt * Math.cos(phi),
        alt * Math.sin(phi) * Math.sin(theta)
      );
      cluster.position.copy(pos);
      cluster.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());

      const puffs = 4 + Math.floor(Math.random() * 4);
      for (let p = 0; p < puffs; p++) {
        const mesh = new THREE.Mesh(puffGeo, puffMat);
        mesh.position.set(
          (Math.random() - 0.5) * 3.8,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 2.4
        );
        mesh.scale.set(
          1.4 + Math.random() * 1.5,
          0.55 + Math.random() * 0.45,
          1.1 + Math.random() * 1.2
        );
        cluster.add(mesh);
      }

      this.skyCloudsGroup.add(cluster);
    }
  }

  createSunAndMoon(moonTex) {
    // Directional sunlight + ambient hemisphere light
    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.8);
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.85);
    this.scene.add(this.hemiLight);

    // Visible Sun sphere + glowing corona
    this.sunGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(26, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfffef0 })
    );
    const sunCorona = new THREE.Mesh(
      new THREE.SphereGeometry(48, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
      })
    );
    this.sunGroup.add(sunCore, sunCorona);
    this.scene.add(this.sunGroup);

    // Orbiting 3D Moon
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(14, 32, 32),
      new THREE.MeshStandardMaterial({
        map: moonTex,
        roughness: 0.88,
      })
    );
    this.scene.add(this.moonMesh);
  }

  createGreatCircleGuideArc() {
    this.arcMaxPoints = 64;
    const positions = new Float32Array(this.arcMaxPoints * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineDashedMaterial({
      color: 0xfbbf24,
      dashSize: 2.2,
      gapSize: 1.2,
      transparent: true,
      opacity: 0.85,
    });

    this.guideArcLine = new THREE.Line(geo, mat);
    this.guideArcLine.frustumCulled = false;
    this.scene.add(this.guideArcLine);
  }

  updateGuideArc(planePos, targetWorldPos) {
    const posAttr = this.guideArcLine.geometry.attributes.position;
    const startDir = planePos.clone().normalize();
    const endDir = targetWorldPos.clone().normalize();
    const startAlt = planePos.length();
    const endAlt = targetWorldPos.length();

    const dot = THREE.MathUtils.clamp(startDir.dot(endDir), -1, 1);
    const omega = Math.acos(dot);
    let fallbackAxis = null;
    if (omega > Math.PI - 0.001) {
      fallbackAxis = new THREE.Vector3().crossVectors(startDir, new THREE.Vector3(0, 1, 0));
      if (fallbackAxis.lengthSq() < 0.001) {
        fallbackAxis.crossVectors(startDir, new THREE.Vector3(1, 0, 0));
      }
      fallbackAxis.normalize();
    }

    const sinOmega = Math.sin(omega);
    const dir = new THREE.Vector3();

    for (let i = 0; i < this.arcMaxPoints; i++) {
      const t = i / (this.arcMaxPoints - 1);
      if (fallbackAxis) {
        dir.copy(startDir).applyAxisAngle(fallbackAxis, omega * t).normalize();
      } else if (sinOmega < 0.0001) {
        dir.copy(startDir).lerp(endDir, t).normalize();
      } else {
        const w1 = Math.sin((1 - t) * omega) / sinOmega;
        const w2 = Math.sin(t * omega) / sinOmega;
        dir.copy(startDir).multiplyScalar(w1).addScaledVector(endDir, w2).normalize();
      }
      const midBoost = Math.sin(t * Math.PI) * 8.5;
      const alt = THREE.MathUtils.lerp(startAlt, endAlt, t) + midBoost;
      const pt = dir.clone().multiplyScalar(alt);
      posAttr.setXYZ(i, pt.x, pt.y, pt.z);
    }

    posAttr.needsUpdate = true;
    this.guideArcLine.computeLineDistances();
  }

  setSolarTimeHours(hoursUTC) {
    // Convert UTC hour (0..24) into solar longitude angle so 12:00 UTC is Prime Meridian (+X)
    // and 15:00-18:00 UTC illuminates Europe + Atlantic + Americas (-Z)
    const angle = -((hoursUTC - 12) / 24) * Math.PI * 2;
    this.sunDirection.set(Math.cos(angle), 0.34, Math.sin(angle)).normalize();

    this.sunLight.position.copy(this.sunDirection).multiplyScalar(900);
    this.sunGroup.position.copy(this.sunDirection).multiplyScalar(920);

    // Place Moon opposite to Sun with slight orbital inclination
    const moonDir = this.sunDirection.clone().negate();
    moonDir.y += 0.18;
    moonDir.normalize();
    this.moonMesh.position.copy(moonDir).multiplyScalar(540);
  }

  update(dt) {
    this.cloudRotationOffset = (this.cloudRotationOffset + dt * 0.0018) % 1.0;
    this.earthUniforms.uCloudOffset.value = this.cloudRotationOffset;
    this.cloudUniforms.uCloudOffset.value = this.cloudRotationOffset;
    this.skyCloudsGroup.rotation.y += dt * 0.008;
    this.moonMesh.rotation.y += dt * 0.05;
  }
}
