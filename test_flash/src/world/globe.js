import * as THREE from 'three';
import { GLOBE_RADIUS } from '../math/globeMath.js';
import { createEarthMaterial, createAtmosphereHaloMaterial } from '../shaders/earthMaterial.js';

export class Globe {
  constructor(scene) {
    this.scene = scene;
    this.globeRadius = GLOBE_RADIUS;

    // Sun directional vector (in world space)
    this.sunAngle = Math.PI * 0.25; // default angle
    this.sunDirection = new THREE.Vector3(
      Math.cos(this.sunAngle),
      0.3,
      Math.sin(this.sunAngle)
    ).normalize();

    this.initLights();
    this.initStarfield();
    this.initTexturesAndEarth();
  }

  initLights() {
    // Main directional sunlight
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(500);
    this.scene.add(this.sunLight);

    // Subtle cosmic ambient light
    this.ambientLight = new THREE.AmbientLight(0x0a1428, 0.25);
    this.scene.add(this.ambientLight);
  }

  initStarfield() {
    const starCount = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const starColors = [
      new THREE.Color(0xffffff), // white
      new THREE.Color(0xaad5ff), // blue-white
      new THREE.Color(0xffebba), // warm yellow
      new THREE.Color(0xffcca0), // orange
      new THREE.Color(0x99ccff)  // cyan
    ];

    for (let i = 0; i < starCount; i++) {
      // Distribute stars on a large outer celestial sphere (radius 1800-2400)
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1800 + Math.random() * 600;

      const sinPhi = Math.sin(phi);
      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);

      const color = starColors[Math.floor(Math.random() * starColors.length)];
      // Subtle brightness variation
      const brightness = 0.5 + Math.random() * 0.5;
      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  initTexturesAndEarth() {
    const textureLoader = new THREE.TextureLoader();

    // Load textures
    const dayTex = textureLoader.load('/textures/earth_day.jpg');
    const nightTex = textureLoader.load('/textures/earth_night.png');
    const specularTex = textureLoader.load('/textures/earth_specular.jpg');
    const normalTex = textureLoader.load('/textures/earth_normal.jpg');
    const cloudsTex = textureLoader.load('/textures/earth_clouds.png');

    // Configure texture filtering
    [dayTex, nightTex, specularTex, normalTex, cloudsTex].forEach(tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
    });

    // 1. Main Earth Sphere
    const earthGeometry = new THREE.SphereGeometry(this.globeRadius, 96, 96);
    this.earthMaterial = createEarthMaterial(
      {
        day: dayTex,
        night: nightTex,
        specular: specularTex,
        normal: normalTex
      },
      this.sunDirection
    );

    this.earthMesh = new THREE.Mesh(earthGeometry, this.earthMaterial);
    this.earthMesh.name = 'Earth';
    this.scene.add(this.earthMesh);

    // 2. Cloud Sphere (slightly above earth surface)
    const cloudGeometry = new THREE.SphereGeometry(this.globeRadius + 0.65, 80, 80);
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      roughness: 1.0,
      metalness: 0.0,
      depthWrite: false
    });

    this.cloudMesh = new THREE.Mesh(cloudGeometry, this.cloudMaterial);
    this.cloudMesh.name = 'Clouds';
    this.scene.add(this.cloudMesh);

    // 3. Outer Atmosphere Glow Halo
    const haloGeometry = new THREE.SphereGeometry(this.globeRadius * 1.028, 80, 80);
    this.haloMaterial = createAtmosphereHaloMaterial(this.sunDirection);
    this.haloMesh = new THREE.Mesh(haloGeometry, this.haloMaterial);
    this.haloMesh.name = 'AtmosphereHalo';
    this.scene.add(this.haloMesh);
  }

  /**
   * Set Sun angle / Time of day.
   * @param {number} angleRad - Angle around the globe (0 to 2*PI)
   */
  setSunAngle(angleRad) {
    this.sunAngle = angleRad;
    this.sunDirection.set(
      Math.cos(this.sunAngle),
      0.35 * Math.sin(this.sunAngle * 0.5),
      Math.sin(this.sunAngle)
    ).normalize();

    this.sunLight.position.copy(this.sunDirection).multiplyScalar(500);

    if (this.earthMaterial && this.earthMaterial.uniforms) {
      this.earthMaterial.uniforms.sunDirection.value.copy(this.sunDirection);
    }
    if (this.haloMaterial && this.haloMaterial.uniforms) {
      this.haloMaterial.uniforms.sunDirection.value.copy(this.sunDirection);
    }
  }

  update(delta) {
    // Slowly rotate clouds independently
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += delta * 0.0035;
    }

    // Slowly twinkle starfield or rotate slightly
    if (this.starfield) {
      this.starfield.rotation.y += delta * 0.0004;
    }
  }
}

