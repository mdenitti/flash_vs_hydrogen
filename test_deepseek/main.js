import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    earthRadius: 100,
    atmosphereRadius: 104,
    cloudsRadius: 103,
    initialDistance: 350,
    minDistance: 105,
    minOrbitDistance: 30,
    maxDistance: 2000,
    poiSize: 12, // Max dimension of a POI model in world units
    flightSpeed: 0.5,
    autoFlightSpeed: 0.02,
};

// ============================================
// POINTS OF INTEREST DATA
// ============================================
const POIS = [
    {
        id: 'eiffel',
        name: 'Eiffel Tower',
        location: 'Paris, France',
        lat: 48.8584,
        lon: 2.2945,
        color: 0xd4a574,
        icon: '🗼',
        buildModel: buildEiffelTower,
    },
    {
        id: 'liberty',
        name: 'Statue of Liberty',
        location: 'New York, USA',
        lat: 40.6892,
        lon: -74.0445,
        color: 0x88c9a1,
        icon: '🗽',
        buildModel: buildStatueOfLiberty,
    },
    {
        id: 'bigben',
        name: 'Big Ben',
        location: 'London, UK',
        lat: 51.5007,
        lon: -0.1246,
        color: 0xc9b896,
        icon: '🕰️',
        buildModel: buildBigBen,
    },
    {
        id: 'burj',
        name: 'Burj Khalifa',
        location: 'Dubai, UAE',
        lat: 25.1972,
        lon: 55.2744,
        color: 0xe8e8e8,
        icon: '🏙️',
        buildModel: buildBurjKhalifa,
    },
    {
        id: 'sydney',
        name: 'Sydney Opera House',
        location: 'Sydney, Australia',
        lat: -33.8568,
        lon: 151.2153,
        color: 0xf5f0e8,
        icon: '🎭',
        buildModel: buildSydneyOpera,
    },
    {
        id: 'christ',
        name: 'Christ the Redeemer',
        location: 'Rio de Janeiro, Brazil',
        lat: -22.9519,
        lon: -43.2105,
        color: 0xf8f8f8,
        icon: '⛪',
        buildModel: buildChristRedeemer,
    },
    {
        id: 'pyramid',
        name: 'Great Pyramid of Giza',
        location: 'Giza, Egypt',
        lat: 29.9792,
        lon: 31.1342,
        color: 0xd4b896,
        icon: '🔺',
        buildModel: buildPyramid,
    },
    {
        id: 'tokyo',
        name: 'Tokyo Tower',
        location: 'Tokyo, Japan',
        lat: 35.6586,
        lon: 139.7454,
        color: 0xe84a4a,
        icon: '🗼',
        buildModel: buildTokyoTower,
    },
    {
        id: 'petra',
        name: 'Petra Treasury',
        location: 'Petra, Jordan',
        lat: 30.3285,
        lon: 35.4444,
        color: 0xd48a6a,
        icon: '🏛️',
        buildModel: buildPetra,
    },
    {
        id: 'machu',
        name: 'Machu Picchu',
        location: 'Cusco, Peru',
        lat: -13.1631,
        lon: -72.5450,
        color: 0x9a8a7a,
        icon: '🏔️',
        buildModel: buildMachuPicchu,
    },
];

// ============================================
// GLOBAL STATE
// ============================================
let scene, camera, renderer, controls;
let earthGroup, earthMesh, atmosphereMesh, cloudsMesh;
let poiMeshes = new Map();
let poiLabels = new Map();
let currentMode = 'free'; // 'free', 'orbit', 'auto'
let targetPoi = null;
let flightProgress = 0;
let flightStartPos = new THREE.Vector3();
let flightStartQuat = new THREE.Quaternion();
let timeOfDay = 0.3; // 0-1, 0.5 = noon
let simulationSpeed = 1;
let clock = new THREE.Clock();
let frameCount = 0;

// Mouse/touch for free flight
let mouse = { x: 0, y: 0 };
let targetRotation = { x: 0, y: 0 };
let currentRotation = { x: 0, y: 0 };
let velocity = new THREE.Vector3();
let isPointerLocked = false;

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    await setupScene();
    await createEarth();
    await createAtmosphere();
    await createClouds();
    await createStars();
    createPOIs();
    setupControls();
    setupEventListeners();
    setupUI();
    animate();
}

async function setupScene() {
    const container = document.getElementById('canvas-container');
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 0, CONFIG.initialDistance);
    
    // Earth group (rotates with Earth)
    earthGroup = new THREE.Group();
    scene.add(earthGroup);
    
    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffee, 2.5);
    sunLight.position.set(1, 0.3, 1).normalize();
    sunLight.castShadow = true;
    scene.add(sunLight);
    window.sunLight = sunLight;
    
    const ambientLight = new THREE.AmbientLight(0x223355, 0.5);
    scene.add(ambientLight);
    
    // Rim light for night side
    const rimLight = new THREE.DirectionalLight(0x4466aa, 0.3);
    rimLight.position.set(-1, -0.3, -1).normalize();
    scene.add(rimLight);
    
    // Store lights for day/night cycle
    scene.userData.sunLight = sunLight;
    scene.userData.ambientLight = ambientLight;
    scene.userData.rimLight = rimLight;
}

async function createEarth() {
    const radius = CONFIG.earthRadius;
    
    // Load textures
    const textureLoader = new THREE.TextureLoader();
    
    // Using high-quality procedural/texture URLs
    const dayTexture = textureLoader.load('https://unpkg.com/three-globe@2.27.1/example/img/earth-day.jpg');
    const nightTexture = textureLoader.load('https://unpkg.com/three-globe@2.27.1/example/img/earth-night.jpg');
    const specularTexture = textureLoader.load('https://unpkg.com/three-globe@2.27.1/example/img/earth-water.png');
    const normalTexture = textureLoader.load('https://unpkg.com/three-globe@2.27.1/example/img/earth-topology.png');
    
    [dayTexture, nightTexture, specularTexture, normalTexture].forEach(t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    
    // Custom shader material for realistic Earth
    const earthMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uDayTexture: { value: dayTexture },
            uNightTexture: { value: nightTexture },
            uSpecularTexture: { value: specularTexture },
            uNormalTexture: { value: normalTexture },
            uSunDirection: { value: new THREE.Vector3(1, 0.3, 1).normalize() },
            uTimeOfDay: { value: timeOfDay },
            uAtmosphereRadius: { value: CONFIG.atmosphereRadius },
            uEarthRadius: { value: radius },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            varying vec2 vUv;
            varying vec3 vViewDir;
            
            void main() {
                vNormal = normalize(mat3(modelMatrix) * normal);
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vUv = uv;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewDir = normalize(cameraPosition - vWorldPosition);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D uDayTexture;
            uniform sampler2D uNightTexture;
            uniform sampler2D uSpecularTexture;
            uniform sampler2D uNormalTexture;
            uniform vec3 uSunDirection;
            uniform float uTimeOfDay;
            uniform float uAtmosphereRadius;
            uniform float uEarthRadius;
            
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            varying vec2 vUv;
            varying vec3 vViewDir;
            
            // Noise function for procedural details
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            
            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 5; i++) {
                    value += amplitude * noise(p);
                    p *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }
            
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewDir);
                
                // Calculate sun dot product
                float rawSunDot = dot(normal, uSunDirection);
                
                // Day/night terminator with smooth transition
                float terminator = smoothstep(-0.1, 0.1, rawSunDot);
                
                // Sample textures
                vec3 dayColor = texture(uDayTexture, vUv).rgb;
                vec3 nightColor = texture(uNightTexture, vUv).rgb;
                float specular = texture(uSpecularTexture, vUv).r;

                // Bump mapping from the elevation map (subtle terrain relief)
                vec2 texel = vec2(1.0 / 1600.0, 1.0 / 800.0);
                float h = texture(uNormalTexture, vUv).r;
                float hx = texture(uNormalTexture, vUv + vec2(texel.x, 0.0)).r - h;
                float hy = texture(uNormalTexture, vUv + vec2(0.0, texel.y)).r - h;
                vec3 up = abs(normal.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
                vec3 tangent = normalize(cross(up, normal));
                vec3 bitangent = cross(normal, tangent);
                normal = normalize(normal - tangent * hx * 25.0 - bitangent * hy * 25.0);

                // Specular highlight (ocean)
                float oceanSpecular = pow(max(dot(reflect(-uSunDirection, normal), viewDir), 0.0), 48.0) * specular * 1.2;
                
                // Day/night blend
                vec3 color = mix(nightColor, dayColor, terminator);
                
                // Add specular
                color += vec3(oceanSpecular) * terminator;
                
                // Atmosphere glow at limb
                float atmosphere = 1.0 - max(dot(normal, viewDir), 0.0);
                atmosphere = pow(atmosphere, 3.0);
                color += vec3(0.3, 0.5, 0.9) * atmosphere * 0.4 * terminator;
                
                // Night side: city lights with subtle animation
                float nightFactor = 1.0 - terminator;
                if (nightFactor > 0.0) {
                    // Procedural city lights
                    float lights = fbm(vUv * 50.0 + uTimeOfDay * 0.1) * nightColor.r * 2.0;
                    lights = smoothstep(0.7, 1.0, lights);
                    color += vec3(1.0, 0.9, 0.7) * lights * nightFactor * 0.5;
                }
                
                // Fresnel for edge glow
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
                color += vec3(0.2, 0.4, 0.8) * fresnel * 0.15;
                
                // Gamma correction
                color = pow(color, vec3(1.0 / 2.2));
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
    });
    
    // High-poly sphere for better detail
    const geometry = new THREE.IcosahedronGeometry(radius, 64);
    earthMesh = new THREE.Mesh(geometry, earthMaterial);
    earthMesh.castShadow = true;
    earthMesh.receiveShadow = true;
    earthGroup.add(earthMesh);
    
    // Store for updates
    earthMesh.userData.material = earthMaterial;
    window.earthMesh = earthMesh;
}

async function createAtmosphere() {
    const radius = CONFIG.atmosphereRadius;
    
    // Atmosphere shader with Rayleigh scattering approximation
    const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uEarthRadius: { value: CONFIG.earthRadius },
            uAtmosphereRadius: { value: radius },
            uSunDirection: { value: new THREE.Vector3(1, 0.3, 1).normalize() },
            uTimeOfDay: { value: timeOfDay },
            uCameraPosition: { value: camera.position },
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            varying float vViewDepth;
            
            void main() {
                vNormal = normalize(mat3(modelMatrix) * normal);
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewDepth = -mvPosition.z;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float uEarthRadius;
            uniform float uAtmosphereRadius;
            uniform vec3 uSunDirection;
            uniform float uTimeOfDay;
            uniform vec3 uCameraPosition;
            
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            varying float vViewDepth;
            
            void main() {
                vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
                vec3 normal = normalize(vNormal);
                vec3 sunDir = normalize(uSunDirection);
                
                // Soft limb glow: strongest where the view ray grazes the shell
                float rim = 1.0 - max(dot(normal, viewDir), 0.0);
                rim = pow(rim, 3.0);
                
                // Sun-side scattering, faint on the night side
                float sunPhase = 0.5 + 0.5 * dot(-viewDir, sunDir);
                float dayFactor = smoothstep(-0.2, 0.2, dot(normal, sunDir));
                
                vec3 color = vec3(0.3, 0.55, 1.0) * (0.6 + 0.6 * sunPhase) * rim * 1.6;
                float alpha = clamp(rim * dayFactor * 0.85, 0.0, 0.85);
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    atmosphereMesh = new THREE.Mesh(geometry, atmosphereMaterial);
    atmosphereMesh.renderOrder = 1;
    earthGroup.add(atmosphereMesh);
    
    window.atmosphereMesh = atmosphereMesh;
}

async function createClouds() {
    const radius = CONFIG.cloudsRadius;
    const textureLoader = new THREE.TextureLoader();
    const cloudTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r165/examples/textures/planets/earth_clouds_1024.png');
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;
    
    const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uCloudTexture: { value: cloudTexture },
            uTime: { value: 0 },
            uSunDirection: { value: new THREE.Vector3(1, 0.3, 1).normalize() },
            uTimeOfDay: { value: timeOfDay },
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            void main() {
                vUv = uv;
                vNormal = normalize(mat3(modelMatrix) * normal);
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uCloudTexture;
            uniform float uTime;
            uniform vec3 uSunDirection;
            uniform float uTimeOfDay;
            
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            
            void main() {
                // Slow cloud rotation
                vec2 uv = vUv + vec2(uTime * 0.00001, 0.0);
                vec4 clouds = texture(uCloudTexture, uv);
                
                float cloudAlpha = clouds.a * 0.9;
                
                // Lighting
                float sunDot = max(dot(vNormal, uSunDirection), 0.0);
                float dayFactor = smoothstep(-0.1, 0.1, sunDot);
                
                vec3 color = mix(vec3(0.3, 0.3, 0.4), vec3(1.0, 0.98, 0.95), dayFactor);
                
                // Silver lining
                float rim = 1.0 - max(dot(vNormal, normalize(vWorldPosition)), 0.0);
                color += vec3(1.0, 0.9, 0.8) * pow(rim, 3.0) * 0.3 * dayFactor;
                
                // Night side darker
                color *= mix(0.15, 1.0, dayFactor);
                
                gl_FragColor = vec4(color, cloudAlpha * dayFactor);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    cloudsMesh = new THREE.Mesh(geometry, cloudMaterial);
    cloudsMesh.renderOrder = 2;
    earthGroup.add(cloudsMesh);
    
    window.cloudsMesh = cloudsMesh;
}

function createStars() {
    // Star field
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 8000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
        const radius = 5000 + Math.random() * 5000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        
        // Star colors: mostly white, some colored
        const colorChoice = Math.random();
        if (colorChoice < 0.6) {
            colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
        } else if (colorChoice < 0.8) {
            colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 0.7;
        } else if (colorChoice < 0.9) {
            colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0;
        } else {
            colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.5; colors[i * 3 + 2] = 0.3;
        }
        
        sizes[i] = Math.random() * 2 + 0.5;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starMaterial = new THREE.PointsMaterial({
        size: 1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        depthWrite: false,
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.renderOrder = -1;
    scene.add(stars);
    window.stars = stars;
    
    // Milky way band
    createMilkyWay();
}

function createMilkyWay() {
    const geometry = new THREE.BufferGeometry();
    const count = 20000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
        // Concentrate around galactic plane
        const angle = Math.random() * Math.PI * 2;
        const distance = 5000 + Math.random() * 5000;
        const height = (Math.random() - 0.5) * 800 * Math.exp(-Math.random() * 2);
        
        positions[i * 3] = distance * Math.cos(angle);
        positions[i * 3 + 1] = height;
        positions[i * 3 + 2] = distance * Math.sin(angle);
        
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.2;
        sizes[i] = Math.random() * 1.5 + 0.3;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: 1,
        vertexColors: true,
        transparent: true,
        opacity: 0.3,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    
    const milkyWay = new THREE.Points(geometry, material);
    milkyWay.rotation.x = Math.PI / 2;
    milkyWay.renderOrder = -1;
    scene.add(milkyWay);
    window.milkyWay = milkyWay;
}

// ============================================
// POI MODEL BUILDERS (Procedural, Large Scale)
// ============================================

function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = lon * Math.PI / 180;
    // Matches the equirectangular UV layout of the earth geometry
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

function createPOIs() {
    const up = new THREE.Vector3(0, 1, 0);

    POIS.forEach((poi, index) => {
        const surfacePos = latLonToVector3(poi.lat, poi.lon, CONFIG.earthRadius);
        const normal = surfacePos.clone().normalize();

        // Build the model
        const model = poi.buildModel(poi.color);

        // Normalize the model so every landmark is visible but not gigantic
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = CONFIG.poiSize / maxDim;
        model.scale.setScalar(scale);

        // Put the base of the model at the anchor origin, centered horizontally
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.set(
            -center.x * scale,
            -box.min.y * scale,
            -center.z * scale
        );

        // Anchor to the earth surface, standing up along the surface normal
        const anchor = new THREE.Group();
        anchor.position.copy(surfacePos);
        anchor.quaternion.setFromUnitVectors(up, normal);
        anchor.userData.poiId = poi.id;
        anchor.add(model);

        earthGroup.add(anchor);

        const height = size.y * scale;
        poiMeshes.set(poi.id, { mesh: anchor, poi, height });

        // Create label sprite above and slightly to the side of the model.
        // Alternate side/height a little so nearby labels do not stack.
        const east = new THREE.Vector3().crossVectors(up, normal);
        if (east.lengthSq() < 1e-6) east.set(1, 0, 0); else east.normalize();
        const side = index % 2 === 0 ? 12 : -12;
        const stagger = (index % 3) * 7;
        const labelPos = surfacePos.clone()
            .addScaledVector(normal, height + 9 + stagger)
            .addScaledVector(east, side);
        createPOILabel(poi, labelPos);
    });
}

function createPOILabel(poi, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    
    // Background
    const gradient = ctx.createLinearGradient(0, 0, 256, 96);
    gradient.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
    gradient.addColorStop(1, 'rgba(10, 15, 30, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 96);
    
    // Border
    ctx.strokeStyle = '#6496ff';
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(1, 1, 254, 94, 12);
        ctx.stroke();
    } else {
        ctx.strokeRect(1, 1, 254, 94);
    }
    
    // Icon
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(poi.icon, 48, 56);
    
    // Name
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(poi.name, 72, 38);
    
    // Location
    ctx.font = '14px Segoe UI';
    ctx.fillStyle = '#88a0cc';
    ctx.fillText(poi.location, 72, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(80, 30, 1);
    sprite.renderOrder = 10;
    
    earthGroup.add(sprite);
    poiLabels.set(poi.id, sprite);
}

function buildEiffelTower(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color, 
        metalness: 0.7, 
        roughness: 0.3,
        emissive: color,
        emissiveIntensity: 0.1,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x332211, 
        metalness: 0.5, 
        roughness: 0.5,
    });
    
    // Four main legs
    const legGeo = new THREE.CylinderGeometry(3, 6, 120, 8);
    const legPositions = [
        [-15, -15], [15, -15], [15, 15], [-15, 15]
    ];
    legPositions.forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, material);
        leg.position.set(x, 60, z);
        leg.castShadow = true;
        group.add(leg);
    });
    
    // Cross beams
    const beamGeo = new THREE.BoxGeometry(40, 2, 2);
    for (let i = 1; i < 6; i++) {
        const y = i * 20;
        const beam1 = new THREE.Mesh(beamGeo, darkMaterial);
        beam1.position.set(0, y, 0);
        beam1.rotation.y = 0;
        group.add(beam1);
        const beam2 = beam1.clone();
        beam2.rotation.y = Math.PI / 2;
        group.add(beam2);
    }
    
    // First platform
    const platform1 = new THREE.Mesh(
        new THREE.CylinderGeometry(35, 35, 8, 16),
        darkMaterial
    );
    platform1.position.y = 120;
    platform1.castShadow = true;
    group.add(platform1);
    
    // Second stage - tapering
    const legGeo2 = new THREE.CylinderGeometry(2, 5, 80, 8);
    legPositions.forEach(([x, z]) => {
        const sx = x * 1.5;
        const sz = z * 1.5;
        const leg = new THREE.Mesh(legGeo2, material);
        leg.position.set(sx, 160, sz);
        group.add(leg);
    });
    
    // Second platform
    const platform2 = new THREE.Mesh(
        new THREE.CylinderGeometry(20, 20, 6, 16),
        darkMaterial
    );
    platform2.position.y = 200;
    group.add(platform2);
    
    // Top tower
    const topGeo = new THREE.CylinderGeometry(1, 4, 60, 8);
    const top = new THREE.Mesh(topGeo, material);
    top.position.y = 240;
    group.add(top);
    
    // Antenna
    const antennaGeo = new THREE.CylinderGeometry(0.3, 0.3, 30, 6);
    const antenna = new THREE.Mesh(antennaGeo, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1, roughness: 0.1 }));
    antenna.position.y = 280;
    group.add(antenna);
    
    // Lights
    addTowerLights(group);
    
    return group;
}

function buildStatueOfLiberty(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color, 
        metalness: 0.2, 
        roughness: 0.6,
    });
    const goldMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        metalness: 1, 
        roughness: 0.1,
        emissive: 0xffd700,
        emissiveIntensity: 0.5,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.8 });
    
    // Base/pedestal
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(40, 50, 40, 4, 4, 4),
        darkMaterial
    );
    base.position.y = 25;
    base.castShadow = true;
    group.add(base);
    
    // Pedestal top
    const pedTop = new THREE.Mesh(
        new THREE.CylinderGeometry(18, 20, 10, 16),
        darkMaterial
    );
    pedTop.position.y = 55;
    group.add(pedTop);
    
    // Body (robe)
    const bodyGeo = new THREE.ConeGeometry(12, 60, 8);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 95;
    body.castShadow = true;
    group.add(body);
    
    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(6, 16, 16),
        material
    );
    head.position.y = 135;
    group.add(head);
    
    // Crown (7 spikes)
    for (let i = 0; i < 7; i++) {
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(1, 8, 4),
            goldMaterial
        );
        const angle = (i / 7) * Math.PI * 2;
        spike.position.set(
            Math.sin(angle) * 7,
            142,
            Math.cos(angle) * 7
        );
        spike.rotation.x = -Math.PI / 3;
        spike.rotation.z = angle;
        group.add(spike);
    }
    
    // Torch arm (raised)
    const torchArm = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 2, 25, 6),
        material
    );
    torchArm.position.set(15, 120, 0);
    torchArm.rotation.z = -Math.PI / 4;
    torchArm.rotation.x = Math.PI / 6;
    group.add(torchArm);
    
    // Torch flame
    const torch = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 12),
        goldMaterial
    );
    torch.position.set(25, 138, 0);
    group.add(torch);
    
    // Torch light
    const torchLight = new THREE.PointLight(0xffdd88, 5, 200);
    torchLight.position.copy(torch.position);
    group.add(torchLight);
    
    // Tablet arm
    const tabletArm = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 2, 20, 6),
        material
    );
    tabletArm.position.set(-12, 110, 5);
    tabletArm.rotation.z = Math.PI / 6;
    tabletArm.rotation.y = Math.PI / 4;
    group.add(tabletArm);
    
    // Tablet
    const tablet = new THREE.Mesh(
        new THREE.BoxGeometry(12, 18, 2),
        material
    );
    tablet.position.set(-20, 115, 8);
    group.add(tablet);
    
    return group;
}

function buildBigBen(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color, 
        metalness: 0.1, 
        roughness: 0.7,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x221100, roughness: 0.8 });
    const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.2 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x88aaff, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.6 });
    
    // Main tower shaft
    const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(25, 180, 25),
        material
    );
    shaft.position.y = 90;
    shaft.castShadow = true;
    group.add(shaft);
    
    // Corner turrets
    for (let x of [-16, 16]) {
        for (let z of [-16, 16]) {
            const turret = new THREE.Mesh(
                new THREE.CylinderGeometry(4, 5, 190, 8),
                darkMaterial
            );
            turret.position.set(x, 95, z);
            group.add(turret);
            
            // Turret roof
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(6, 12, 8),
                darkMaterial
            );
            roof.position.set(x, 195, z);
            group.add(roof);
        }
    }
    
    // Clock faces (4 sides)
    const clockFaceGeo = new THREE.CylinderGeometry(12, 12, 2, 32);
    const clockFaceMat = new THREE.MeshStandardMaterial({ 
        color: 0xf5f0e0, 
        roughness: 0.3,
        emissive: 0xffffee,
        emissiveIntensity: 0.3,
    });
    
    for (let i = 0; i < 4; i++) {
        const face = new THREE.Mesh(clockFaceGeo, clockFaceMat);
        const angle = (i / 4) * Math.PI * 2;
        face.position.set(Math.sin(angle) * 13.5, 150, Math.cos(angle) * 13.5);
        face.rotation.y = angle;
        group.add(face);
        
        // Clock hands (simplified)
        const handGeo = new THREE.BoxGeometry(0.5, 6, 0.5);
        const handMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const hourHand = new THREE.Mesh(handGeo, handMat);
        hourHand.position.set(0, 0, -1.2);
        face.add(hourHand);
        const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), handMat);
        minHand.position.set(0, 0, -1.3);
        face.add(minHand);
    }
    
    // Belfry (open section with bells)
    const belfry = new THREE.Mesh(
        new THREE.BoxGeometry(30, 30, 30),
        material
    );
    belfry.position.y = 185;
    group.add(belfry);
    
    // Arches on belfry
    for (let i = 0; i < 4; i++) {
        const arch = new THREE.Mesh(
            new THREE.BoxGeometry(10, 15, 3),
            material
        );
        const angle = (i / 4) * Math.PI * 2;
        arch.position.set(Math.sin(angle) * 16, 185, Math.cos(angle) * 16);
        arch.rotation.y = angle;
        group.add(arch);
    }
    
    // Pyramid roof
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(20, 25, 4),
        darkMaterial
    );
    roof.position.y = 215;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    
    // Spire
    const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 2, 30, 8),
        goldMaterial
    );
    spire.position.y = 245;
    group.add(spire);
    
    // Cross on top
    const cross = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1, 1),
        goldMaterial
    );
    cross.position.y = 262;
    group.add(cross);
    const cross2 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 8, 1),
        goldMaterial
    );
    cross2.position.y = 262;
    group.add(cross2);
    
    return group;
}

function buildBurjKhalifa(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xeeeeee, 
        metalness: 0.5, 
        roughness: 0.4,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x88ccff, 
        metalness: 0.1, 
        roughness: 0.05, 
        transparent: true, 
        opacity: 0.7 
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5 });
    
    // Three-winged Y-shape base
    const wingGeo = new THREE.BoxGeometry(15, 300, 15);
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const wing = new THREE.Mesh(wingGeo, material);
        wing.position.set(Math.sin(angle) * 12, 150, Math.cos(angle) * 12);
        wing.rotation.y = angle;
        wing.castShadow = true;
        group.add(wing);
    }
    
    // Central core
    const core = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 10, 320, 16),
        material
    );
    core.position.y = 160;
    core.castShadow = true;
    group.add(core);
    
    // Tapering sections
    const sections = [
        { h: 40, r1: 10, r2: 9, y: 340 },
        { h: 40, r1: 9, r2: 8, y: 380 },
        { h: 40, r1: 8, r2: 7, y: 420 },
        { h: 40, r1: 7, r2: 6, y: 460 },
        { h: 40, r1: 6, r2: 5, y: 500 },
        { h: 30, r1: 5, r2: 4, y: 535 },
        { h: 30, r1: 4, r2: 3, y: 565 },
        { h: 30, r1: 3, r2: 2, y: 595 },
        { h: 20, r1: 2, r2: 1, y: 615 },
    ];
    
    sections.forEach(s => {
        const sec = new THREE.Mesh(
            new THREE.CylinderGeometry(s.r1, s.r2, s.h, 16),
            material
        );
        sec.position.y = s.y;
        sec.castShadow = true;
        group.add(sec);
    });
    
    // Spire
    const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 1, 50, 8),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1, roughness: 0.1 })
    );
    spire.position.y = 650;
    group.add(spire);
    
    // Aircraft warning lights
    for (let y = 300; y < 650; y += 50) {
        const light = new THREE.Mesh(
            new THREE.SphereGeometry(1, 8, 8),
            new THREE.MeshStandardMaterial({ 
                color: 0xff0000, 
                emissive: 0xff0000, 
                emissiveIntensity: 2 
            })
        );
        light.position.set(12, y, 0);
        group.add(light);
    }
    
    return group;
}

function buildSydneyOpera(color) {
    const group = new THREE.Group();
    const shellMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0xf5f0e8, 
        metalness: 0.1, 
        roughness: 0.3,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
    });
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.8 });
    
    // Platform base
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(100, 10, 70),
        baseMaterial
    );
    base.position.y = 5;
    base.castShadow = true;
    group.add(base);
    
    // Shell groups (simplified as curved segments)
    const shellPositions = [
        { x: -30, z: 0, rot: 0, h: 60, w: 35 },
        { x: 0, z: 0, rot: 0, h: 70, w: 40 },
        { x: 30, z: 0, rot: 0, h: 60, w: 35 },
        { x: -15, z: -25, rot: Math.PI / 2, h: 50, w: 30 },
        { x: 15, z: -25, rot: Math.PI / 2, h: 50, w: 30 },
    ];
    
    shellPositions.forEach(s => {
        // Create shell using multiple curved segments
        for (let i = 0; i < 5; i++) {
            const segment = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    s.w * (1 - i * 0.15),
                    s.w * (1 - (i + 1) * 0.15),
                    s.h / 5,
                    32,
                    1,
                    true,
                    0,
                    Math.PI * 0.6
                ),
                shellMaterial
            );
            segment.position.set(s.x, 10 + s.h / 5 * (i + 0.5), s.z);
            segment.rotation.y = s.rot;
            segment.rotation.x = -Math.PI / 2;
            segment.castShadow = true;
            group.add(segment);
        }
    });
    
    // Glass walls between shells
    const glassGeo = new THREE.BoxGeometry(40, 60, 2);
    const glassWall1 = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({ color: 0x88aaff, transparent: true, opacity: 0.5, roughness: 0.1 }));
    glassWall1.position.set(-30, 35, -20);
    group.add(glassWall1);
    
    const glassWall2 = new THREE.Mesh(glassGeo, glassWall1.material);
    glassWall2.position.set(30, 35, -20);
    group.add(glassWall2);
    
    return group;
}

function buildChristRedeemer(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xf8f8f8, 
        metalness: 0.1, 
        roughness: 0.6,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.8 });
    
    // Pedestal
    const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(20, 25, 30, 16),
        darkMaterial
    );
    pedestal.position.y = 15;
    pedestal.castShadow = true;
    group.add(pedestal);
    
    // Chapel base
    const chapel = new THREE.Mesh(
        new THREE.BoxGeometry(25, 20, 15),
        darkMaterial
    );
    chapel.position.y = 40;
    group.add(chapel);
    
    // Body/robe
    const body = new THREE.Mesh(
        new THREE.ConeGeometry(12, 50, 8),
        material
    );
    body.position.y = 80;
    body.castShadow = true;
    group.add(body);
    
    // Arms outstretched
    const armGeo = new THREE.CylinderGeometry(3, 2, 35, 8);
    const leftArm = new THREE.Mesh(armGeo, material);
    leftArm.position.set(-30, 85, 0);
    leftArm.rotation.z = Math.PI / 2;
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo, material);
    rightArm.position.set(30, 85, 0);
    rightArm.rotation.z = -Math.PI / 2;
    group.add(rightArm);
    
    // Hands
    const handGeo = new THREE.SphereGeometry(4, 12, 12);
    const leftHand = new THREE.Mesh(handGeo, material);
    leftHand.position.set(-50, 85, 0);
    group.add(leftHand);
    
    const rightHand = new THREE.Mesh(handGeo, material);
    rightHand.position.set(50, 85, 0);
    group.add(rightHand);
    
    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(6, 16, 16),
        material
    );
    head.position.y = 115;
    group.add(head);
    
    // Halo
    const haloGeo = new THREE.TorusGeometry(8, 0.5, 8, 32);
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        metalness: 1, 
        roughness: 0.1,
        emissive: 0xffd700,
        emissiveIntensity: 0.5,
    }));
    halo.position.y = 123;
    halo.rotation.x = -Math.PI / 2;
    group.add(halo);
    
    return group;
}

function buildPyramid(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xd4b896, 
        metalness: 0.0, 
        roughness: 0.9,
    });
    const capMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        metalness: 1, 
        roughness: 0.1,
        emissive: 0xffd700,
        emissiveIntensity: 0.3,
    });
    
    // Main pyramid
    const pyramid = new THREE.Mesh(
        new THREE.ConeGeometry(80, 130, 4),
        material
    );
    pyramid.position.y = 65;
    pyramid.rotation.y = Math.PI / 4;
    pyramid.castShadow = true;
    group.add(pyramid);
    
    // Capstone (pyramidion)
    const cap = new THREE.Mesh(
        new THREE.ConeGeometry(4, 8, 4),
        capMaterial
    );
    cap.position.y = 134;
    cap.rotation.y = Math.PI / 4;
    group.add(cap);
    
    // Base platform
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(90, 90, 5, 32),
        new THREE.MeshStandardMaterial({ color: 0xaa9988, roughness: 0.9 })
    );
    base.position.y = 2.5;
    group.add(base);
    
    // Sphinx (small but recognizable)
    const sphinx = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 40), material);
    sBody.position.set(120, 6, 0);
    sphinx.add(sBody);
    const sHead = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), material);
    sHead.position.set(120, 18, 20);
    sphinx.add(sHead);
    const sLegs = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 25), material);
    sLegs.position.set(120, 3, 5);
    sphinx.add(sLegs);
    group.add(sphinx);
    
    // Two smaller pyramids
    for (let i = 0; i < 2; i++) {
        const small = new THREE.Mesh(
            new THREE.ConeGeometry(35, 60, 4),
            material
        );
        small.position.set(i === 0 ? -130 : 130, 30, -100);
        small.rotation.y = Math.PI / 4;
        small.castShadow = true;
        group.add(small);
    }
    
    return group;
}

function buildTokyoTower(color) {
    const group = new THREE.Group();
    const redMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xe84a4a, 
        metalness: 0.7, 
        roughness: 0.3,
        emissive: 0xe84a4a,
        emissiveIntensity: 0.15,
    });
    const whiteMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        metalness: 0.5, 
        roughness: 0.3,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    
    // Main tower - lattice structure simplified
    const mainGeo = new THREE.CylinderGeometry(3, 20, 280, 4);
    const main = new THREE.Mesh(mainGeo, redMaterial);
    main.position.y = 140;
    main.castShadow = true;
    group.add(main);
    
    // Four legs
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(2, 6, 140, 6),
            redMaterial
        );
        leg.position.set(Math.sin(angle) * 18, 70, Math.cos(angle) * 18);
        group.add(leg);
    }
    
    // Main observatory (first)
    const obs1 = new THREE.Mesh(
        new THREE.CylinderGeometry(25, 25, 15, 16),
        whiteMaterial
    );
    obs1.position.y = 120;
    group.add(obs1);
    
    // Second observatory
    const obs2 = new THREE.Mesh(
        new THREE.CylinderGeometry(15, 15, 12, 16),
        whiteMaterial
    );
    obs2.position.y = 240;
    group.add(obs2);
    
    // Top spire
    const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 4, 60, 8),
        redMaterial
    );
    spire.position.y = 300;
    group.add(spire);
    
    // Antenna
    const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 40, 6),
        darkMaterial
    );
    antenna.position.y = 340;
    group.add(antenna);
    
    // Red/white bands
    for (let y = 20; y < 280; y += 20) {
        const band = new THREE.Mesh(
            new THREE.CylinderGeometry(
                3 + (20 - 3) * (y / 280),
                3 + (20 - 3) * ((y + 5) / 280),
                5, 4
            ),
            y % 40 < 20 ? redMaterial : whiteMaterial
        );
        band.position.y = y;
        group.add(band);
    }
    
    // Aircraft lights
    for (let y of [120, 240, 300, 340]) {
        const light = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 8, 8),
            new THREE.MeshStandardMaterial({ 
                color: 0xff0000, 
                emissive: 0xff0000, 
                emissiveIntensity: 3 
            })
        );
        light.position.set(0, y, 25);
        group.add(light);
    }
    
    return group;
}

function buildPetra(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xd48a6a, 
        metalness: 0.0, 
        roughness: 0.95,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.9 });
    
    // Cliff face
    const cliff = new THREE.Mesh(
        new THREE.BoxGeometry(80, 60, 10),
        material
    );
    cliff.position.y = 30;
    cliff.position.z = -5;
    cliff.castShadow = true;
    group.add(cliff);
    
    // Facade - Treasury (Al-Khazneh)
    // Lower level - 6 columns
    for (let i = 0; i < 6; i++) {
        const col = new THREE.Mesh(
            new THREE.CylinderGeometry(3, 3.5, 25, 16),
            material
        );
        col.position.set(-30 + i * 12, 12.5, 2);
        group.add(col);
    }
    
    // Pediment
    const pediment = new THREE.Mesh(
        new THREE.BoxGeometry(60, 2, 5),
        material
    );
    pediment.position.set(0, 26, 2);
    group.add(pediment);
    
    // Triangular pediment top
    const pedTop = new THREE.Mesh(
        new THREE.ConeGeometry(30, 12, 4),
        material
    );
    pedTop.position.set(0, 35, 2);
    pedTop.rotation.y = Math.PI / 4;
    group.add(pedTop);
    
    // Upper level - circular tholos
    const tholos = new THREE.Mesh(
        new THREE.CylinderGeometry(12, 12, 15, 16),
        material
    );
    tholos.position.set(0, 45, 2);
    group.add(tholos);
    
    // Tholos columns
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const col = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 1.5, 15, 12),
            material
        );
        col.position.set(Math.sin(angle) * 12, 45, 2 + Math.cos(angle) * 12);
        group.add(col);
    }
    
    // Tholos roof
    const tholosRoof = new THREE.Mesh(
        new THREE.ConeGeometry(12, 8, 16),
        material
    );
    tholosRoof.position.set(0, 56, 2);
    group.add(tholosRoof);
    
    // Urn on top
    const urn = new THREE.Mesh(
        new THREE.SphereGeometry(4, 12, 12),
        material
    );
    urn.position.set(0, 62, 2);
    urn.scale.y = 1.5;
    group.add(urn);
    
    // Doorway (dark)
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(8, 18, 2),
        darkMaterial
    );
    door.position.set(0, 9, 3);
    group.add(door);
    
    return group;
}

function buildMachuPicchu(color) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x9a8a7a, 
        metalness: 0.0, 
        roughness: 0.9,
    });
    const greenMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4a6644, 
        roughness: 0.9,
    });
    
    // Mountain base
    const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(100, 80, 8),
        new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.9 })
    );
    mountain.position.y = 40;
    group.add(mountain);
    
    // Terraces
    for (let i = 0; i < 6; i++) {
        const terrace = new THREE.Mesh(
            new THREE.CylinderGeometry(70 - i * 10, 80 - i * 10, 8, 16),
            greenMaterial
        );
        terrace.position.y = 5 + i * 10;
        group.add(terrace);
    }
    
    // Main plaza
    const plaza = new THREE.Mesh(
        new THREE.BoxGeometry(60, 3, 40),
        material
    );
    plaza.position.set(0, 45, 0);
    group.add(plaza);
    
    // Temple of the Sun (curved)
    const temple = new THREE.Mesh(
        new THREE.CylinderGeometry(12, 12, 10, 16, 1, true, 0, Math.PI),
        material
    );
    temple.position.set(0, 52, 15);
    temple.rotation.y = Math.PI;
    group.add(temple);
    
    // Intihuatana stone
    const inti = new THREE.Mesh(
        new THREE.BoxGeometry(4, 6, 4),
        material
    );
    inti.position.set(-20, 50, 0);
    group.add(inti);
    
    // Sacred rock
    const sacred = new THREE.Mesh(
        new THREE.BoxGeometry(8, 4, 10),
        material
    );
    sacred.position.set(20, 48, -5);
    group.add(sacred);
    
    // Huayna Picchu peak behind
    const peak = new THREE.Mesh(
        new THREE.ConeGeometry(40, 60, 6),
        new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.9 })
    );
    peak.position.set(0, 80, -80);
    group.add(peak);
    
    // Llamas (small)
    for (let i = 0; i < 3; i++) {
        const llama = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 6), material);
        body.position.y = 2;
        llama.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 6), material);
        neck.position.set(0, 4, 3);
        llama.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), material);
        head.position.set(0, 6, 3);
        llama.add(head);
        
        llama.position.set(-30 + i * 10, 48, -15 + i * 5);
        llama.scale.setScalar(0.8);
        group.add(llama);
    }
    
    return group;
}

function addTowerLights(group) {
    // Add subtle lights on tower
    const lightPositions = [
        { y: 120, r: 35 }, { y: 160, r: 25 }, { y: 200, r: 15 }, { y: 240, r: 8 }
    ];
    
    lightPositions.forEach(p => {
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const light = new THREE.Mesh(
                new THREE.SphereGeometry(0.8, 8, 8),
                new THREE.MeshStandardMaterial({ 
                    color: 0xfff8e8, 
                    emissive: 0xfff8e8, 
                    emissiveIntensity: 2 
                })
            );
            light.position.set(Math.sin(angle) * p.r, p.y, Math.cos(angle) * p.r);
            group.add(light);
        }
    });
    
    // Beacon at top
    const beacon = new THREE.SpotLight(0xffffee, 100, 500, Math.PI / 6, 0.5, 1);
    beacon.position.set(0, 290, 0);
    beacon.target.position.set(0, 0, 100);
    group.add(beacon);
    group.add(beacon.target);
}

// ============================================
// CONTROLS & INTERACTION
// ============================================
function setupControls() {
    // OrbitControls for orbit mode
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = CONFIG.minOrbitDistance;
    controls.maxDistance = CONFIG.maxDistance;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI - 0.1;
    
    // Disable by default (free flight mode)
    controls.enabled = false;
}

function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', onResize);
    
    // Pointer lock for free flight
    renderer.domElement.addEventListener('click', () => {
        if (currentMode === 'free') {
            requestPointerLock();
        }
    });
    
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isPointerLocked && currentMode === 'free') {
            mouse.x += e.movementX * 0.002;
            mouse.y += e.movementY * 0.002;
            mouse.y = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, mouse.y));
        }
    });
    
    // Keyboard for movement
    const keys = {};
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.keys = keys;
    
    // UI Buttons
    document.getElementById('btn-fly').addEventListener('click', () => startAutoFlight());
    document.getElementById('btn-orbit').addEventListener('click', () => setMode('orbit'));
    document.getElementById('btn-free').addEventListener('click', () => setMode('free'));
    document.getElementById('btn-home').addEventListener('click', () => resetView());
    document.getElementById('btn-time').addEventListener('click', () => toggleDayNight());
    
    // Speed slider
    document.getElementById('speed-slider').addEventListener('input', (e) => {
        simulationSpeed = parseFloat(e.target.value);
        document.getElementById('speed-value').textContent = simulationSpeed.toFixed(1) + 'x';
    });
    
    // POI list clicks
    document.getElementById('poi-list').addEventListener('click', (e) => {
        const item = e.target.closest('.poi-item');
        if (item) {
            const poiId = item.dataset.poi;
            selectPOI(poiId);
        }
    });
    
    // Raycaster for hover
    window.addEventListener('mousemove', onMouseMove);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
    if (currentMode !== 'free') return;
    
    // Update crosshair position for non-pointer-lock
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Raycast to find hovered POI
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x, y), camera);
    
    const poiMeshesArray = Array.from(poiMeshes.values()).map(p => p.mesh);
    const intersects = ray.intersectObjects(poiMeshesArray, true);
    
    // Reset all
    document.querySelectorAll('.poi-item').forEach(el => el.classList.remove('hovered'));
    
    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        // Find parent POI group
        let parent = mesh.parent;
        while (parent && !parent.userData.poiId) parent = parent.parent;
        if (parent && parent.userData.poiId) {
            const item = document.querySelector(`.poi-item[data-poi="${parent.userData.poiId}"]`);
            if (item) item.classList.add('hovered');
        }
    }
}

function setMode(mode) {
    currentMode = mode;
    controls.enabled = mode === 'orbit';
    
    const indicator = document.getElementById('mode-indicator');
    indicator.textContent = mode === 'free' ? 'FREE FLIGHT' : 
                           mode === 'orbit' ? 'ORBIT MODE' : 'AUTO FLIGHT';
    indicator.style.borderColor = mode === 'auto' ? '#64ff96' : '#6496ff';
    indicator.style.color = mode === 'auto' ? '#64ff96' : '#6496ff';
    
    // Update button states
    document.querySelectorAll('#controls-panel .btn').forEach(btn => btn.classList.remove('primary'));
    if (mode === 'orbit') document.getElementById('btn-orbit').classList.add('primary');
    else if (mode === 'free') document.getElementById('btn-free').classList.add('primary');
    
    if (mode === 'free') {
        requestPointerLock();
    }
}

function requestPointerLock() {
    try {
        const result = renderer.domElement.requestPointerLock();
        if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (e) {
        // Pointer lock can be rejected (e.g. not from a user gesture) - ignore
    }
}

function selectPOI(poiId) {
    const poiData = poiMeshes.get(poiId);
    if (!poiData) return;
    
    targetPoi = poiData;
    
    // Update UI
    document.querySelectorAll('.poi-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.poi-item[data-poi="${poiId}"]`)?.classList.add('active');
    document.getElementById('target').textContent = poiData.poi.name;
    
    // Show POI info
    showPOIInfo(poiData.poi);
}

function startAutoFlight() {
    if (!targetPoi) return;
    
    currentMode = 'auto';
    flightProgress = 0;
    
    // Store start position/rotation
    flightStartPos.copy(camera.position);
    flightStartQuat.copy(camera.quaternion);
    
    // Calculate target position (above and behind POI)
    const poiPos = targetPoi.mesh.getWorldPosition(new THREE.Vector3());
    const earthCenter = new THREE.Vector3(0, 0, 0);
    const dir = poiPos.clone().sub(earthCenter).normalize();
    const targetPos = dir.clone().multiplyScalar(CONFIG.earthRadius + 70);
    const lookAtPos = poiPos.clone();
    
    // Store for interpolation
    window.flightTargetPos = targetPos;
    window.flightLookAtPos = lookAtPos;
    
    setMode('auto');
}

function resetView() {
    currentMode = 'free';
    targetPoi = null;
    flightProgress = 0;
    
    // Animate camera back to home
    const homePos = new THREE.Vector3(0, 0, CONFIG.initialDistance);
    animateCameraTo(homePos, new THREE.Vector3(0, 0, 0), 2000);
    
    setMode('free');
    document.getElementById('target').textContent = 'None';
    document.querySelectorAll('.poi-item').forEach(el => el.classList.remove('active'));
    hidePOIInfo();
}

function toggleDayNight() {
    timeOfDay = timeOfDay > 0.5 ? 0.1 : 0.7;
    updateDayNightCycle();
}

function updateDayNightCycle() {
    // Update sun direction based on time of day
    const angle = (timeOfDay - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle) * 0.5, Math.sin(angle)).normalize();
    
    scene.userData.sunLight.position.copy(sunDir);
    scene.userData.sunLight.intensity = timeOfDay > 0.3 && timeOfDay < 0.7 ? 2.5 : 0.1;
    scene.userData.ambientLight.intensity = timeOfDay > 0.3 && timeOfDay < 0.7 ? 0.5 : 0.1;
    scene.userData.rimLight.intensity = timeOfDay > 0.3 && timeOfDay < 0.7 ? 0.3 : 1.0;
    
    // Update shader uniforms
    if (earthMesh?.userData?.material) {
        earthMesh.userData.material.uniforms.uSunDirection.value.copy(sunDir);
        earthMesh.userData.material.uniforms.uTimeOfDay.value = timeOfDay;
    }
    if (atmosphereMesh?.material) {
        atmosphereMesh.material.uniforms.uSunDirection.value.copy(sunDir);
        atmosphereMesh.material.uniforms.uTimeOfDay.value = timeOfDay;
    }
    if (cloudsMesh?.material) {
        cloudsMesh.material.uniforms.uSunDirection.value.copy(sunDir);
        cloudsMesh.material.uniforms.uTimeOfDay.value = timeOfDay;
    }
}

function animateCameraTo(targetPos, targetLookAt, duration) {
    const startPos = camera.position.clone();
    const startQuat = camera.quaternion.clone();
    const startTime = performance.now();
    
    const tempCam = new THREE.Object3D();
    tempCam.position.copy(targetPos);
    tempCam.lookAt(targetLookAt);
    const targetQuat = tempCam.quaternion.clone();
    
    function animateCamera() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        
        camera.position.lerpVectors(startPos, targetPos, eased);
        camera.quaternion.slerpQuaternions(startQuat, targetQuat, eased);
        
        if (t < 1) requestAnimationFrame(animateCamera);
    }
    animateCamera();
}

function showPOIInfo(poi) {
    const el = document.getElementById('poi-info');
    document.getElementById('poi-info-name').textContent = poi.name;
    document.getElementById('poi-info-dist').textContent = poi.location;
    el.classList.remove('hidden');
    el.classList.add('visible');
}

function hidePOIInfo() {
    const el = document.getElementById('poi-info');
    el.classList.remove('visible');
    el.classList.add('hidden');
}

function setupUI() {
    // Populate POI list
    const list = document.getElementById('poi-list');
    POIS.forEach(poi => {
        const item = document.createElement('li');
        item.className = 'poi-item';
        item.dataset.poi = poi.id;
        item.innerHTML = `
            <span class="poi-icon" style="background: ${poi.color.toString(16).padStart(6, '0')}33;">${poi.icon}</span>
            <div>
                <div class="poi-name">${poi.name}</div>
                <div class="poi-location">${poi.location}</div>
            </div>
            <span class="poi-distance" data-poi="${poi.id}">-- km</span>
        `;
        list.appendChild(item);
    });
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta() * simulationSpeed;
    const elapsed = clock.getElapsedTime();
    frameCount++;
    
    // Earth rotation
    earthGroup.rotation.y += 0.00005 * simulationSpeed;
    
    // Clouds rotation (slightly faster)
    if (cloudsMesh) cloudsMesh.rotation.y += 0.00008 * simulationSpeed;
    
    // Stars slow rotation
    if (window.stars) window.stars.rotation.y += 0.000005;
    if (window.milkyWay) window.milkyWay.rotation.y += 0.000003;
    
    // Update atmosphere camera uniform
    if (atmosphereMesh) {
        atmosphereMesh.material.uniforms.uCameraPosition.value.copy(camera.position);
    }
    
    // Update cloud time uniform
    if (cloudsMesh) {
        cloudsMesh.material.uniforms.uTime.value = elapsed * 1000;
    }
    
    // Mode-specific camera control
    if (currentMode === 'free') {
        updateFreeFlight(delta);
    } else if (currentMode === 'orbit') {
        controls.update();
    } else if (currentMode === 'auto') {
        updateAutoFlight(delta);
    }
    
    // Update POI labels (billboard to camera)
    updatePOILabels();
    
    // Update UI
    updateFlightData();
    updatePOIDistances();
    
    // Render
    renderer.render(scene, camera);
}

function updateFreeFlight(delta) {
    const keys = window.keys || {};
    const speed = CONFIG.flightSpeed * 100 * delta;
    const rotSpeed = 2 * delta;
    
    // Mouse look
    currentRotation.x += (mouse.x - currentRotation.x) * 0.1;
    currentRotation.y += (mouse.y - currentRotation.y) * 0.1;
    
    // Create rotation quaternion from mouse
    const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-currentRotation.y, -currentRotation.x, 0, 'YXZ')
    );
    camera.quaternion.slerp(quat, 0.1);
    
    // Movement relative to camera orientation
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    
    if (keys['KeyW'] || keys['ArrowUp']) velocity.addScaledVector(forward, speed);
    if (keys['KeyS'] || keys['ArrowDown']) velocity.addScaledVector(forward, -speed);
    if (keys['KeyD'] || keys['ArrowRight']) velocity.addScaledVector(right, speed);
    if (keys['KeyA'] || keys['ArrowLeft']) velocity.addScaledVector(right, -speed);
    if (keys['Space']) velocity.addScaledVector(up, speed);
    if (keys['ShiftLeft'] || keys['ShiftRight']) velocity.addScaledVector(up, -speed);
    
    // Apply velocity
    camera.position.add(velocity);
    
    // Dampen velocity
    velocity.multiplyScalar(0.95);
    
    // Collision with Earth surface
    const distFromCenter = camera.position.length();
    const minDist = CONFIG.minDistance;
    if (distFromCenter < minDist) {
        camera.position.normalize().multiplyScalar(minDist);
        velocity.set(0, 0, 0);
    }
    
    // Max distance
    if (distFromCenter > CONFIG.maxDistance) {
        camera.position.normalize().multiplyScalar(CONFIG.maxDistance);
    }
}

function updateAutoFlight(delta) {
    if (!targetPoi || !window.flightTargetPos) return;
    
    flightProgress += CONFIG.autoFlightSpeed * delta * 60;
    flightProgress = Math.min(flightProgress, 1);
    
    // Eased interpolation
    const eased = 1 - Math.pow(1 - flightProgress, 3);
    
    // Position
    camera.position.lerpVectors(flightStartPos, window.flightTargetPos, eased);
    
    // Look at target
    const lookTarget = new THREE.Vector3().lerpVectors(
        new THREE.Vector3().copy(camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(flightStartQuat)),
        window.flightLookAtPos,
        eased
    );
    camera.lookAt(lookTarget);
    
    // Check if arrived
    if (flightProgress >= 1) {
        currentMode = 'orbit';
        controls.enabled = true;
        controls.target.copy(window.flightLookAtPos);
        setMode('orbit');
        
        // Show info
        showPOIInfo(targetPoi.poi);
    }
}

function updatePOILabels() {
    const anchorWorld = new THREE.Vector3();
    const spriteWorld = new THREE.Vector3();
    const camToAnchor = new THREE.Vector3();

    poiLabels.forEach((sprite, id) => {
        const poiData = poiMeshes.get(id);
        if (!poiData) return;

        poiData.mesh.getWorldPosition(anchorWorld);
        sprite.getWorldPosition(spriteWorld);
        
        // Billboard
        sprite.lookAt(camera.position);
        
        // Scale based on distance so labels keep a constant on-screen size
        const dist = camera.position.distanceTo(spriteWorld);
        const scale = THREE.MathUtils.clamp(dist * 0.0022, 0.2, 4);
        sprite.scale.set(80 * scale, 30 * scale, 1);
        
        // Hide labels whose landmark is on the far side of the Earth
        camToAnchor.copy(camera.position).sub(anchorWorld).normalize();
        const facing = anchorWorld.clone().normalize().dot(camToAnchor);
        const limbFade = THREE.MathUtils.smoothstep(facing, 0.0, 0.15);
        const distanceFade = dist < 500 ? 1 : 500 / dist;

        sprite.material.opacity = limbFade * distanceFade;
        sprite.visible = sprite.material.opacity > 0.02;
    });
}

function updateFlightData() {
    const pos = camera.position;
    const distFromCenter = pos.length();
    const altitude = Math.max(0, distFromCenter - CONFIG.earthRadius);
    
    // Lat/lon from camera position
    const lat = 90 - Math.acos(pos.y / distFromCenter) * 180 / Math.PI;
    const lon = Math.atan2(pos.z, -pos.x) * 180 / Math.PI;
    
    // Speed
    const speed = velocity.length() * 60 * 60 / 1000; // km/h approx
    
    document.getElementById('altitude').textContent = altitude.toFixed(0) + ' km';
    document.getElementById('speed').textContent = speed.toFixed(0) + ' km/h';
    document.getElementById('latitude').textContent = lat.toFixed(2) + '°';
    document.getElementById('longitude').textContent = lon.toFixed(2) + '°';
}

function updatePOIDistances() {
    const camPos = camera.position;
    
    POIS.forEach(poi => {
        const poiData = poiMeshes.get(poi.id);
        if (!poiData) return;
        
        const poiPos = poiData.mesh.getWorldPosition(new THREE.Vector3());
        const dist = camPos.distanceTo(poiPos);
        
        const distEl = document.querySelector(`.poi-distance[data-poi="${poi.id}"]`);
        if (distEl) {
            distEl.textContent = Math.max(0, dist).toFixed(0) + ' km';
        }
    });
}

// ============================================
// START
// ============================================
init().catch(console.error);