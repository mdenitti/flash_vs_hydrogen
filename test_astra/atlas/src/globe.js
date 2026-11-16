import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLandmark, LANDMARKS } from './landmarks.js';

export const RADIUS = 10;
export function geoVector(lat, lon, radius = 1) {
  const p = THREE.MathUtils.degToRad(lat), t = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(p) * Math.cos(t), Math.sin(p), -Math.cos(p) * Math.sin(t)).multiplyScalar(radius);
}
export function tangentToward(from, to) {
  const tangent = to.clone().addScaledVector(from, -from.dot(to));
  if (tangent.lengthSq() < 1e-9) tangent.crossVectors(from, Math.abs(from.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
  return tangent.normalize();
}

const vertexShader = `varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
void main(){vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);vPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const earthFragment = `uniform sampler2D dayMap;uniform sampler2D nightMap;uniform sampler2D specMap;uniform sampler2D normalMap;uniform vec3 sunDirection;uniform float nightMode;varying vec2 vUv;varying vec3 vNormal;varying vec3 vPosition;
void main(){
vec3 N=normalize(vNormal);vec3 V=normalize(cameraPosition-vPosition);float light=dot(N,sunDirection);float day=smoothstep(-.16,.28,light);
vec3 land=texture2D(dayMap,vUv).rgb;float water=texture2D(specMap,vUv).r;vec3 mapNormal=texture2D(normalMap,vUv).rgb*2.-1.;float relief=1.+mapNormal.x*.14+mapNormal.y*.1;
vec3 base=land*(.16+max(light,0.)*1.14)*relief;
vec3 H=normalize(sunDirection+V);float glint=pow(max(dot(N,H),0.),85.)*water; base+=vec3(.72,.85,1.)*glint*.4;
vec3 night=texture2D(nightMap,vUv).rgb;float darkness=max(1.-day,nightMode*.84);base=mix(base,land*.075+night*1.7,darkness);
float rim=pow(1.-max(dot(N,V),0.),3.);base+=vec3(.08,.24,.4)*rim*(.3+day*.7);
gl_FragColor=vec4(base,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export function createWorld(canvas, onProgress) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.setClearColor('#080e17');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .05, 500);
  camera.position.copy(geoVector(23, -10, 34));
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .065;
  controls.enablePan = false; controls.minDistance = 14; controls.maxDistance = 47;
  controls.rotateSpeed = .42; controls.zoomSpeed = .7;
  const sunDirection = geoVector(25, -42);
  const sun = new THREE.DirectionalLight('#fff2da', 3.4); sun.position.copy(sunDirection).multiplyScalar(60); scene.add(sun);
  const fill = new THREE.DirectionalLight('#b5d9ff', 1.3); fill.position.copy(geoVector(20, 70, 40)); scene.add(fill);
  scene.add(new THREE.AmbientLight('#b3c5db', 1.3));
  const manager = new THREE.LoadingManager();
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const failed = [];
  manager.onProgress = (url, loaded, total) => onProgress(Math.round(loaded / total * 100), 'Loading Earth imagery');
  manager.onError = url => failed.push(url);
  manager.onLoad = () => resolveReady(failed);
  const loader = new THREE.TextureLoader(manager);
  function texture(name, color = false) {
    const result = loader.load(`/textures/${name}.jpg`);
    if (color) result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return result;
  }
  const uniforms = { dayMap:{value:texture('earth-day',true)},nightMap:{value:texture('earth-night',true)},specMap:{value:texture('earth-specular')},normalMap:{value:texture('earth-normal')},sunDirection:{value:sunDirection},nightMode:{value:0} };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 160, 96),new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader:earthFragment }));
  scene.add(earth);
  const cloudTexture = texture('earth-clouds');
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(RADIUS+.065,128,80), new THREE.MeshPhongMaterial({color:'#eff7ff',alphaMap:cloudTexture,transparent:true,opacity:.48,depthWrite:false,shininess:0}));
  scene.add(clouds);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(10.27,100,64),new THREE.ShaderMaterial({
    vertexShader,fragmentShader:`varying vec3 vNormal;varying vec3 vPosition;uniform vec3 sunDirection;void main(){vec3 N=normalize(vNormal);vec3 V=normalize(cameraPosition-vPosition);float rim=pow(1.-abs(dot(N,V)),3.5);float day=.45+.55*max(dot(N,sunDirection),0.);gl_FragColor=vec4(vec3(.17,.46,.77)*rim*day,rim*.55);}`,
    uniforms:{sunDirection:{value:sunDirection}},side:THREE.BackSide,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false
  })); scene.add(atmosphere);
  // A restrained star field: the horizon, not the UI, carries the spectacle.
  let seed=3271; const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const starPositions=[],starColors=[];
  for(let i=0;i<1900;i++){const v=new THREE.Vector3(random()-.5,random()-.5,random()-.5).normalize().multiplyScalar(100+random()*90);starPositions.push(v.x,v.y,v.z);const c=.16+random()*.4;starColors.push(c*.8,c*.9,c);}
  const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starsGeo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({size:.095,vertexColors:true,transparent:true,opacity:.67,sizeAttenuation:true,depthWrite:false}));scene.add(stars);
  // Subtle orbit guides make the planet feel suspended in a flight instrument.
  const orbitGuide=new THREE.Group();
  for(const radius of [13.2,13.27]) {const pts=[];for(let i=0;i<=256;i++){const a=i/256*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*radius,0,Math.sin(a)*radius));}const geo=new THREE.BufferGeometry().setFromPoints(pts);const mat=new THREE.LineDashedMaterial({color:'#7d9daf',transparent:true,opacity:.1,dashSize:radius===13.2?.07:.018,gapSize:radius===13.2?.3:.5});const line=new THREE.Line(geo,mat);line.computeLineDistances();orbitGuide.add(line);}
  orbitGuide.rotation.z=.21;orbitGuide.rotation.x=.15;scene.add(orbitGuide);
  const landmarkObjects = LANDMARKS.map(destination => {
    const normal=geoVector(destination.lat,destination.lon);
    const group = createLandmark(destination.type);
    group.position.copy(normal).multiplyScalar(RADIUS-.018);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    group.scale.setScalar(destination.id==='paris'?1.02:.74);
    scene.add(group);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.58,.022,10,80),new THREE.MeshBasicMaterial({color:'#efb17a',transparent:true,opacity:.65}));
    ring.position.copy(normal).multiplyScalar(12.15);
    const north=tangentToward(normal,new THREE.Vector3(0,1,0));
    const east=new THREE.Vector3().crossVectors(normal,north).normalize();
    ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,normal,north));
    ring.scale.setScalar(.75);
    scene.add(ring);
    const base = new THREE.Mesh(new THREE.RingGeometry(.38,.41,64),new THREE.MeshBasicMaterial({color:'#edb387',side:THREE.DoubleSide,transparent:true,opacity:.38,depthWrite:false}));
    base.position.copy(normal).multiplyScalar(10.035);base.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);scene.add(base);
    const label = document.createElement('div');label.className='globe-label';const dot=document.createElement('i');const text=document.createElement('span');text.textContent=destination.name.toUpperCase();label.append(dot,text);document.querySelector('#labels').append(label);
    return {destination,normal,group,ring,base,label,labelPosition:normal.clone().multiplyScalar(12.9)};
  });
  const plane = createPlane(); scene.add(plane);
  const trailGeometry = new THREE.BufferGeometry();const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:'#e9d1a2',transparent:true,opacity:.45,depthWrite:false}));scene.add(trail);
  let route;
  function setRoute(start,end){if(route){scene.remove(route);route.geometry.dispose();route.material.dispose();}const points=[];const angle=start.angleTo(end);for(let i=0;i<=90;i++){const t=i/90;let point;if(angle<.0001)point=start.clone();else if(angle>Math.PI-.0001){const axis=new THREE.Vector3().crossVectors(start,new THREE.Vector3(0,1,0)).normalize();point=start.clone().applyAxisAngle(axis,Math.PI*t);}else point=start.clone().multiplyScalar(Math.sin((1-t)*angle)/Math.sin(angle)).addScaledVector(end,Math.sin(t*angle)/Math.sin(angle));points.push(point.normalize().multiplyScalar(12.15));}route=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:'#e6a56f',transparent:true,opacity:.48,dashSize:.09,gapSize:.09}));route.computeLineDistances();scene.add(route);}
  function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  resize();window.addEventListener('resize',resize);
  return {renderer,scene,camera,controls,earth,clouds,uniforms,landmarkObjects,plane,trail,ready,setRoute,resize,sun,fill};
}

function createPlane(){
  const group=new THREE.Group();
  const cream=new THREE.MeshStandardMaterial({color:'#fff8e6',roughness:.38,metalness:.12});
  const orange=new THREE.MeshStandardMaterial({color:'#dd7442',roughness:.4,metalness:.1});
  const blue=new THREE.MeshPhysicalMaterial({color:'#81bacb',roughness:.16,metalness:.45,clearcoat:1});
  const dark=new THREE.MeshStandardMaterial({color:'#283343',roughness:.4});
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;};
  const fuselage=add(new THREE.CapsuleGeometry(.11,.82,8,16),cream,0,0,0);fuselage.rotation.x=Math.PI/2;
  const nose=add(new THREE.SphereGeometry(.111,16,12),orange,0,0,-.51);nose.scale.z=.7;
  const canopy=add(new THREE.SphereGeometry(.12,16,12),blue,0,.082,-.08);canopy.scale.set(.82,.7,1.6);
  const wingShape=new THREE.Shape();wingShape.moveTo(-.85,.1);wingShape.lineTo(-.86,-.065);wingShape.lineTo(-.17,-.19);wingShape.lineTo(.17,-.19);wingShape.lineTo(.86,-.065);wingShape.lineTo(.85,.1);wingShape.lineTo(.14,.18);wingShape.lineTo(-.14,.18);wingShape.closePath();
  const wings=add(new THREE.ExtrudeGeometry(wingShape,{depth:.025,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1}),cream,0,0,-.05);wings.rotation.x=Math.PI/2;
  add(new THREE.BoxGeometry(.13,.03,.16),orange,-.81,0,-.03);add(new THREE.BoxGeometry(.13,.03,.16),orange,.81,0,-.03);
  add(new THREE.BoxGeometry(.57,.025,.15),cream,0,.03,.38);
  const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.lineTo(0,.27);finShape.lineTo(.16,.04);finShape.lineTo(.2,0);finShape.closePath();const fin=add(new THREE.ExtrudeGeometry(finShape,{depth:.028,bevelEnabled:false}),orange,-.014,.02,.5);fin.rotation.y=Math.PI/2;
  const propeller=add(new THREE.BoxGeometry(.54,.025,.016),dark,0,0,-.61);group.userData.propeller=propeller;
  add(new THREE.SphereGeometry(.035,8,6),dark,0,0,-.62);
  for(const x of [-.2,.2]){add(new THREE.BoxGeometry(.025,.14,.025),dark,x,-.12,.05);const wheel=add(new THREE.CylinderGeometry(.06,.06,.035,12),dark,x,-.2,.05);wheel.rotation.z=Math.PI/2;}
  group.scale.setScalar(.77);
  return group;
}
