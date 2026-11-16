import './style.css';
import * as THREE from 'three';
import { createWorld, geoVector, tangentToward, RADIUS } from './globe.js';
import { LANDMARKS } from './landmarks.js';
import { initUI } from './ui.js';

const state = { mode:'orbit', position:geoVector(28,-20), direction:new THREE.Vector3(), altitude:2.15, speed:0, throttle:.4, paused:false, autopilot:null, night:false, targetNight:0, viewTween:null, flightTime:0, selected:LANDMARKS[0] };
state.direction.copy(tangentToward(state.position,geoVector(48.8584,2.2945)));
let world, ui, audioContext, audioGain, soundEnabled=false;
const keys = new Set();
const trailPoints=[];
let lastTrailTime=0, telemetryTimer=0, animationTime=0;
const clock = new THREE.Clock();
function toggleSound(){
  try {
    if(!audioContext){audioContext=new(window.AudioContext||window.webkitAudioContext)();const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate);const channel=buffer.getChannelData(0);let last=0;for(let i=0;i<channel.length;i++){last=(last+(Math.random()*2-1)*.02)/1.02;channel[i]=last*3.5;}const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;audioGain=audioContext.createGain();audioGain.gain.value=0;source.connect(filter);filter.connect(audioGain);audioGain.connect(audioContext.destination);source.start();}
    audioContext.resume();soundEnabled=!soundEnabled;audioGain.gain.setTargetAtTime(soundEnabled?.16:0,audioContext.currentTime,.4);return soundEnabled;
  }catch{ui.notify('Ambient audio is unavailable in this browser.');return false;}
}
function setView(mode){
  state.mode=mode;state.viewTween=null;world.controls.enabled=mode==='orbit';ui.setView(mode);
  if(mode==='orbit'){world.camera.up.set(0,1,0);world.controls.target.set(0,0,0);state.viewTween={start:world.camera.position.clone(),end:state.position.clone().multiplyScalar(34),time:0,duration:1.7};}
  else if(state.speed===0&&!state.autopilot){state.speed=.022;state.throttle=.4;state.paused=false;ui.notify('You have the controls. W/S speed · A/D turn · ↑/↓ altitude');}
}
function selectDestination(destination){
  state.selected=destination;
  const target=geoVector(destination.lat,destination.lon);
  world.setRoute(state.position,target);
  world.landmarkObjects.forEach(item=>{const selected=item.destination.id===destination.id;item.label.classList.toggle('active',selected);item.ring.material.opacity=selected?.95:.25;item.ring.scale.setScalar(selected?1:.68);});
  if(state.mode==='orbit'){state.viewTween={start:world.camera.position.clone(),end:geoVector(destination.lat-17,destination.lon-15,Math.max(30,world.camera.position.length())),time:0,duration:1.7};}
}
function flyTo(destination){
  if(state.autopilot?.id===destination.id&&!state.paused){state.paused=true;ui.setFlightStatus('FLIGHT PAUSED');return;}
  state.selected=destination;state.autopilot=destination;state.paused=false;state.speed=.055;
  const target=geoVector(destination.lat,destination.lon);
  if(state.position.angleTo(target)<.08){state.position.copy(geoVector(destination.lat-16,destination.lon-20));trailPoints.length=0;}
  state.direction.copy(tangentToward(state.position,target));
  world.setRoute(state.position,target);
  setView('flight');ui.setFlightStatus('AUTOPILOT · '+destination.city.toUpperCase());ui.notify(`Next stop: ${destination.name}. Enjoy the flight.`);
}
function pause(){if(state.speed===0&&!state.autopilot){state.speed=.025;state.paused=false;}else state.paused=!state.paused;ui.notify(state.paused?'Flight paused. Press Space to resume.':'Back in the skies.');}
function setKey(key,down){if(down)keys.add(key);else keys.delete(key);}
ui=initUI({selectDestination,flyTo,setView,zoom:delta=>{if(state.mode==='flight'){state.altitude=THREE.MathUtils.clamp(state.altitude-delta*.25,.8,5);}else{state.viewTween=null;world.camera.position.multiplyScalar(delta>0?.9:1.1);world.camera.position.clampLength(14,47);}},toggleNight:()=>{state.night=!state.night;state.targetNight=state.night?1:0;return state.night;},reset:()=>{state.paused=false;state.speed=0;state.autopilot=null;state.altitude=2.15;state.position.copy(geoVector(28,-20));state.direction.copy(tangentToward(state.position,geoVector(48.8584,2.2945)));trailPoints.length=0;setView('orbit');state.viewTween={start:world.camera.position.clone(),end:geoVector(23,-10,34),time:0,duration:1.5};ui.setFlightStatus('READY FOR TAKEOFF');},toggleSound,setKey,pause});
try{world=createWorld(document.querySelector('#world'),ui.setLoading);}catch(error){console.error(error);document.querySelector('#loading').classList.add('done');document.querySelector('#fatal-error').hidden=false;throw error;}
world.controls.addEventListener('start',()=>{state.viewTween=null;});
selectDestination(LANDMARKS[0]);state.viewTween=null;
world.camera.position.copy(geoVector(23,-10,window.innerWidth<760?42:34));
world.ready.then(failures=>{ui.finishLoading();if(failures.length)ui.notify('Some Earth imagery could not load. Reload to retry.');});
let hidden=false;document.addEventListener('visibilitychange',()=>{hidden=document.hidden;keys.clear();clock.getDelta();});
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('keydown',event=>{
  if(event.target.matches('input,textarea')||document.querySelector('dialog[open]'))return;
  const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(key)){event.preventDefault();if(key===' '){if(!event.repeat)pause();return;}setKey(key,true);if(['w','a','s','d','arrowleft','arrowright'].includes(key)){if(state.autopilot){state.autopilot=null;ui.notify('Autopilot disengaged. You have the controls.');}if(state.mode!=='flight')setView('flight');state.paused=false;}}
  if(key==='g')setView('orbit');if(key==='f')setView('flight');
});
window.addEventListener('keyup',event=>setKey(event.key.toLowerCase(),false));
for(const button of document.querySelectorAll('.mobile-flight-controls button')){button.addEventListener('pointerdown',()=>{state.autopilot=null;state.paused=false;if(state.mode!=='flight')setView('flight');});}

const position=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),lookTarget=new THREE.Vector3(),right=new THREE.Vector3(),back=new THREE.Vector3(),basis=new THREE.Matrix4(),targetQuaternion=new THREE.Quaternion();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05);if(hidden)return;animationTime+=dt;
  if(!state.paused){
    if(keys.has('w'))state.throttle=Math.min(1,state.throttle+dt*.3);
    if(keys.has('s'))state.throttle=Math.max(0,state.throttle-dt*.4);
    if(keys.has('arrowup'))state.altitude=Math.min(5,state.altitude+dt*.9);
    if(keys.has('arrowdown'))state.altitude=Math.max(.75,state.altitude-dt*.9);
    const steering=(keys.has('a')||keys.has('arrowleft')?1:0)-(keys.has('d')||keys.has('arrowright')?1:0);
    if(steering)state.direction.applyAxisAngle(state.position,steering*dt*.85);
    if(state.autopilot){const target=geoVector(state.autopilot.lat,state.autopilot.lon);state.direction.copy(tangentToward(state.position,target));state.speed=.065;state.altitude=THREE.MathUtils.damp(state.altitude,2.15,2,dt);}
    else if(state.speed>0||keys.has('w'))state.speed=THREE.MathUtils.damp(state.speed,state.throttle*.075*(keys.has('shift')?3.2:1),2.5,dt);
    if(state.speed>.00001){const angle=state.speed*dt;const next=state.position.clone().multiplyScalar(Math.cos(angle)).addScaledVector(state.direction,Math.sin(angle)).normalize();state.direction.addScaledVector(next,-state.direction.dot(next)).normalize();state.position.copy(next);state.flightTime+=dt;}
  }
  position.copy(state.position).multiplyScalar(RADIUS+state.altitude);world.plane.position.copy(position);
  right.crossVectors(state.direction,state.position).normalize();back.copy(state.direction).negate();basis.makeBasis(right,state.position,back);targetQuaternion.setFromRotationMatrix(basis);world.plane.quaternion.slerp(targetQuaternion,1-Math.exp(-dt*8));
  if(keys.has('a'))world.plane.rotateZ(.16);if(keys.has('d'))world.plane.rotateZ(-.16);
  world.plane.userData.propeller.rotation.z+=dt*(state.paused?0:40+state.speed*250);
  if(animationTime-lastTrailTime>.1&&state.speed>.001&&!state.paused){trailPoints.push(position.clone());if(trailPoints.length>150)trailPoints.shift();world.trail.geometry.dispose();world.trail.geometry=new THREE.BufferGeometry().setFromPoints(trailPoints);lastTrailTime=animationTime;}
  // A checkpoint is collected by proximity to the actual elevated ring, never by selecting a card.
  for(const item of world.landmarkObjects){
    const isSelected=item.destination.id===state.selected.id;
    item.ring.material.opacity=(isSelected?.73:.18)+Math.sin(animationTime*1.8)*.08;
    if(!state.paused&&state.speed>.001&&position.distanceTo(item.ring.position)<.62){
      ui.discover(item.destination.id);item.ring.material.color.set('#aed4b2');
      if(state.autopilot?.id===item.destination.id){state.autopilot=null;state.speed=0;state.throttle=.4;state.paused=true;ui.setFlightStatus('CHECKPOINT DISCOVERED');}
    }
  }
  if(state.mode==='flight'){
    world.controls.enabled=false;
    desiredCamera.copy(position).addScaledVector(state.direction,-5.4).addScaledVector(state.position,3.2);
    world.camera.position.lerp(desiredCamera,1-Math.exp(-dt*2.2));
    world.camera.up.lerp(state.position,1-Math.exp(-dt*3)).normalize();
    lookTarget.copy(position).addScaledVector(state.direction,3.7).addScaledVector(state.position,-1.6);
    world.camera.lookAt(lookTarget);
  }else if(state.viewTween){
    const tween=state.viewTween;tween.time+=dt;const t=Math.min(tween.time/tween.duration,1);const ease=t*t*(3-2*t);
    const a=tween.start.clone().normalize(),b=tween.end.clone().normalize();const q=new THREE.Quaternion().setFromUnitVectors(a,b);const turn=new THREE.Quaternion().slerp(q,ease);world.camera.position.copy(a.applyQuaternion(turn)).multiplyScalar(THREE.MathUtils.lerp(tween.start.length(),tween.end.length(),ease));world.camera.up.set(0,1,0);world.camera.lookAt(0,0,0);world.controls.target.set(0,0,0);if(t>=1)state.viewTween=null;
  }else world.controls.update();
  world.clouds.rotation.y+=dt*.0007;
  world.uniforms.nightMode.value=THREE.MathUtils.damp(world.uniforms.nightMode.value,state.targetNight,2,dt);
  world.clouds.material.opacity=THREE.MathUtils.lerp(.48,.17,world.uniforms.nightMode.value);
  world.sun.intensity=THREE.MathUtils.lerp(3.4,.8,world.uniforms.nightMode.value);
  // Hide labels behind the sphere, outside the viewport, and during close flight.
  const width=window.innerWidth,height=window.innerHeight;
  world.landmarkObjects.forEach(item=>{const screen=item.labelPosition.clone().project(world.camera);const facing=item.normal.dot(world.camera.position.clone().sub(item.normal.clone().multiplyScalar(10)).normalize());const show=facing>.16&&screen.z<1&&screen.z>-1&&Math.abs(screen.x)<.96&&Math.abs(screen.y)<.9&&(state.mode==='orbit'||item.destination.id===state.selected.id);item.label.style.opacity=show?'1':'0';item.label.style.transform=`translate(${(screen.x*.5+.5)*width}px, ${(-screen.y*.5+.5)*height}px) translate(-50%,-50%)`;});
  telemetryTimer+=dt;if(telemetryTimer>.2){telemetryTimer=0;const north=tangentToward(state.position,new THREE.Vector3(0,1,0));const east=new THREE.Vector3().crossVectors(north,state.position).normalize();const heading=(THREE.MathUtils.radToDeg(Math.atan2(state.direction.dot(east),state.direction.dot(north)))+360)%360;const status=state.paused?(state.speed===0?'CHECKPOINT DISCOVERED':'FLIGHT PAUSED'):state.autopilot?'AUTOPILOT · '+state.autopilot.city.toUpperCase():state.speed>.001?'FREE FLIGHT':'READY FOR TAKEOFF';ui.updateTelemetry({speed:state.paused?0:state.speed*6500,altitude:state.altitude/2.15*12000,heading,status});}
  world.renderer.render(world.scene,world.camera);
}
animate();
