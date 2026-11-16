import * as THREE from 'three';
import { GLOBE_RADIUS, latLonToVector3 } from '../math/globeMath.js';

export class Aircraft {
  constructor(scene) {
    this.scene = scene;
    this.globeRadius = GLOBE_RADIUS;

    // Flight state
    this.altitude = 4.5; // height above globe surface (units)
    this.speed = 1.0;
    this.minSpeed = 0.45;
    this.cruiseSpeed = 1.0;
    this.maxSpeed = 2.4;
    this.acceleration = 1.8;
    this.isBoosting = false;
    this.isBraking = false;

    // Rotational velocities for smooth flight physics
    this.pitchRate = 0;
    this.rollRate = 0;
    this.yawRate = 0;

    // Control inputs
    this.input = {
      pitch: 0,
      roll: 0,
      yaw: 0,
      boost: false,
      brake: false
    };

    // Camera settings
    this.cameraMode = 'chase'; // 'chase' | 'cockpit' | 'orbit'
    this.cameraDampedPos = new THREE.Vector3();
    this.cameraDampedLookAt = new THREE.Vector3();

    // Spawn near Paris / Western Europe so the user can immediately see the Eiffel Tower!
    this.initPositionAndOrientation();
    this.buildAircraftMesh();
    this.initContrails();
  }

  initPositionAndOrientation() {
    // Start north over the English Channel flying South towards the Eiffel Tower in Paris
    const startLat = 51.2;
    const startLon = 2.2945;
    this.position = latLonToVector3(startLat, startLon, this.globeRadius + this.altitude);

    // Initial orientation: local +Y is normal away from globe, local -Z points South towards Paris
    const normal = this.position.clone().normalize();
    const targetPos = latLonToVector3(48.8584, 2.2945, this.globeRadius + 4.8);
    const forward = targetPos.clone().sub(this.position).normalize();
    const up = normal;
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(forward, right).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(right, correctedUp, forward.clone().negate());
    this.quaternion = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
  }

  buildAircraftMesh() {
    this.group = new THREE.Group();
    this.group.name = 'PlayerAircraft';
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);
    this.scene.add(this.group);

    // Visual materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, // Vibrant aero cyan/sky blue
      roughness: 0.3,
      metalness: 0.7
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.5
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.75
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.2,
      metalness: 0.95
    });

    // 1. Aerodynamic Streamlined Fuselage
    const fuselageGeom = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 16);
    fuselageGeom.rotateX(Math.PI * 0.5);
    const fuselage = new THREE.Mesh(fuselageGeom, bodyMat);
    fuselage.scale.set(1.0, 0.85, 1.0);
    this.group.add(fuselage);

    // Nose Cone
    const noseGeom = new THREE.ConeGeometry(0.18, 0.65, 16);
    noseGeom.rotateX(-Math.PI * 0.5);
    const nose = new THREE.Mesh(noseGeom, whiteMat);
    nose.position.set(0, 0, -1.4);
    this.group.add(nose);

    // Tail Cone
    const tailConeGeom = new THREE.ConeGeometry(0.28, 0.8, 16);
    tailConeGeom.rotateX(Math.PI * 0.5);
    const tailCone = new THREE.Mesh(tailConeGeom, whiteMat);
    tailCone.position.set(0, 0, 1.45);
    this.group.add(tailCone);

    // 2. Cockpit Bubble Canopy
    const canopyGeom = new THREE.SphereGeometry(0.22, 16, 16);
    canopyGeom.scale(0.8, 0.9, 1.8);
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 0.18, -0.25);
    this.group.add(canopy);

    // Pilot Silhouette Head
    const pilotHead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), darkMat);
    pilotHead.position.set(0, 0.16, -0.15);
    this.group.add(pilotHead);

    // 3. Main Wings (Swept with winglets)
    const wingGeom = new THREE.BoxGeometry(3.6, 0.04, 0.65);
    const mainWings = new THREE.Mesh(wingGeom, whiteMat);
    mainWings.position.set(0, -0.02, -0.1);
    this.group.add(mainWings);

    // Wing stripes / color accent
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.66), bodyMat);
    stripeL.position.set(-1.4, -0.02, -0.1);
    const stripeR = new THREE.Mesh(stripeL.geometry, bodyMat);
    stripeR.position.set(1.4, -0.02, -0.1);
    this.group.add(stripeL);
    this.group.add(stripeR);

    // Winglets (upturned tips)
    const wingletGeom = new THREE.BoxGeometry(0.04, 0.28, 0.4);
    const wingletL = new THREE.Mesh(wingletGeom, bodyMat);
    wingletL.position.set(-1.8, 0.12, -0.1);
    const wingletR = new THREE.Mesh(wingletGeom, bodyMat);
    wingletR.position.set(1.8, 0.12, -0.1);
    this.group.add(wingletL);
    this.group.add(wingletR);

    // 4. Articulated Ailerons (tilt with roll input)
    const aileronGeom = new THREE.BoxGeometry(0.8, 0.03, 0.15);
    this.aileronL = new THREE.Mesh(aileronGeom, darkMat);
    this.aileronL.position.set(-1.1, -0.02, 0.28);
    this.aileronR = new THREE.Mesh(aileronGeom, darkMat);
    this.aileronR.position.set(1.1, -0.02, 0.28);
    this.group.add(this.aileronL);
    this.group.add(this.aileronR);

    // 5. Tailplane (Horizontal Stabilizer & Elevators)
    const tailplaneGeom = new THREE.BoxGeometry(1.3, 0.03, 0.35);
    const tailplane = new THREE.Mesh(tailplaneGeom, whiteMat);
    tailplane.position.set(0, 0.08, 1.4);
    this.group.add(tailplane);

    // Articulated Elevators (tilt with pitch input)
    const elevatorGeom = new THREE.BoxGeometry(1.2, 0.025, 0.12);
    this.elevators = new THREE.Mesh(elevatorGeom, darkMat);
    this.elevators.position.set(0, 0.08, 1.62);
    this.group.add(this.elevators);

    // 6. Vertical Fin & Articulated Rudder
    const finGeom = new THREE.BoxGeometry(0.04, 0.65, 0.45);
    finGeom.translate(0, 0.3, 0);
    const fin = new THREE.Mesh(finGeom, bodyMat);
    fin.position.set(0, 0.1, 1.25);
    fin.rotation.x = -0.25;
    this.group.add(fin);

    // Articulated Rudder (swings with yaw input)
    const rudderGeom = new THREE.BoxGeometry(0.03, 0.55, 0.14);
    rudderGeom.translate(0, 0.25, 0);
    this.rudder = new THREE.Mesh(rudderGeom, darkMat);
    this.rudder.position.set(0, 0.15, 1.55);
    this.group.add(this.rudder);

    // 7. Spinning Propeller Assembly
    this.propellerGroup = new THREE.Group();
    this.propellerGroup.position.set(0, 0, -1.75);

    // Spinner hub
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 12), chromeMat);
    spinner.rotation.x = -Math.PI * 0.5;
    this.propellerGroup.add(spinner);

    // 3 Propeller blades
    const bladeGeom = new THREE.BoxGeometry(0.08, 0.75, 0.015);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeom, darkMat);
      blade.rotation.z = b * (Math.PI * 2 / 3);
      this.propellerGroup.add(blade);
    }

    // Semi-transparent motion blur disk
    const blurDiskGeom = new THREE.CircleGeometry(0.75, 24);
    const blurDiskMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    const blurDisk = new THREE.Mesh(blurDiskGeom, blurDiskMat);
    this.propellerGroup.add(blurDisk);

    this.group.add(this.propellerGroup);

    // 8. Navigation Lights & Strobes
    const redLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0033 })
    );
    redLight.position.set(-1.8, 0.12, -0.1);
    this.group.add(redLight);

    const greenLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff66 })
    );
    greenLight.position.set(1.8, 0.12, -0.1);
    this.group.add(greenLight);

    this.tailStrobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.tailStrobe.position.set(0, 0.7, 1.45);
    this.group.add(this.tailStrobe);

    // Boost Afterburner Glow (visible when boosting)
    const afterburnerGeom = new THREE.ConeGeometry(0.2, 1.2, 16, 1, true);
    afterburnerGeom.rotateX(Math.PI * 0.5);
    afterburnerGeom.translate(0, 0, 0.6);
    this.afterburnerMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });
    this.afterburnerMesh = new THREE.Mesh(afterburnerGeom, this.afterburnerMat);
    this.afterburnerMesh.position.set(0, 0, 1.7);
    this.group.add(this.afterburnerMesh);
  }

  initContrails() {
    this.maxTrailPoints = 120;
    this.trailPointsL = [];
    this.trailPointsR = [];

    const trailMat = new THREE.LineBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.65,
      linewidth: 2
    });

    const geomL = new THREE.BufferGeometry();
    const geomR = new THREE.BufferGeometry();
    geomL.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxTrailPoints * 3), 3));
    geomR.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxTrailPoints * 3), 3));

    this.lineL = new THREE.Line(geomL, trailMat);
    this.lineR = new THREE.Line(geomR, trailMat);
    this.lineL.frustumCulled = false;
    this.lineR.frustumCulled = false;

    this.scene.add(this.lineL);
    this.scene.add(this.lineR);
  }

  updateContrails() {
    const tipL = new THREE.Vector3(-1.8, 0, -0.1).applyMatrix4(this.group.matrixWorld);
    const tipR = new THREE.Vector3(1.8, 0, -0.1).applyMatrix4(this.group.matrixWorld);

    this.trailPointsL.unshift(tipL);
    this.trailPointsR.unshift(tipR);

    if (this.trailPointsL.length > this.maxTrailPoints) {
      this.trailPointsL.pop();
      this.trailPointsR.pop();
    }

    const posAttrL = this.lineL.geometry.attributes.position;
    const posAttrR = this.lineR.geometry.attributes.position;

    for (let i = 0; i < this.trailPointsL.length; i++) {
      const pL = this.trailPointsL[i];
      const pR = this.trailPointsR[i];
      posAttrL.setXYZ(i, pL.x, pL.y, pL.z);
      posAttrR.setXYZ(i, pR.x, pR.y, pR.z);
    }
    this.lineL.geometry.setDrawRange(0, this.trailPointsL.length);
    this.lineR.geometry.setDrawRange(0, this.trailPointsR.length);
    posAttrL.needsUpdate = true;
    posAttrR.needsUpdate = true;
  }

  update(delta, time) {
    // 1. Throttle / Speed dynamics
    let targetSpeed = this.cruiseSpeed;
    if (this.input.boost) {
      targetSpeed = this.maxSpeed;
      this.isBoosting = true;
    } else if (this.input.brake) {
      targetSpeed = this.minSpeed;
      this.isBraking = true;
    } else {
      this.isBoosting = false;
      this.isBraking = false;
    }

    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, delta * this.acceleration);

    // Spin propeller
    if (this.propellerGroup) {
      this.propellerGroup.rotation.z += delta * (30.0 + this.speed * 25.0);
    }

    // Flash tail strobe
    if (this.tailStrobe) {
      this.tailStrobe.visible = Math.sin(time * 6.0) > 0.8;
    }

    // Afterburner glow
    if (this.afterburnerMat) {
      const targetOpacity = this.isBoosting ? 0.85 : 0.0;
      this.afterburnerMat.opacity = THREE.MathUtils.lerp(this.afterburnerMat.opacity, targetOpacity, delta * 8.0);
    }

    // 2. Flight control rates & Aerodynamics
    const targetPitchRate = this.input.pitch * 1.8;
    const targetRollRate = this.input.roll * 2.6;
    const targetYawRate = this.input.yaw * 1.2;

    this.pitchRate = THREE.MathUtils.lerp(this.pitchRate, targetPitchRate, delta * 6.0);
    this.rollRate = THREE.MathUtils.lerp(this.rollRate, targetRollRate, delta * 6.0);
    this.yawRate = THREE.MathUtils.lerp(this.yawRate, targetYawRate, delta * 6.0);

    // Animate control surfaces
    if (this.aileronL && this.aileronR) {
      this.aileronL.rotation.x = -this.rollRate * 0.35;
      this.aileronR.rotation.x = this.rollRate * 0.35;
    }
    if (this.elevators) {
      this.elevators.rotation.x = this.pitchRate * 0.35;
    }
    if (this.rudder) {
      this.rudder.rotation.y = -this.yawRate * 0.35;
    }

    // 3. Spherical Orientation & Flight Physics
    // Current vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion).normalize();
    const planeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion).normalize();
    const planeRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion).normalize();

    // Normal to sphere at current position
    const globeNormal1 = this.position.clone().normalize();

    // Bank-to-turn aerodynamic coupling:
    // Banking left/right tilts the lift vector, inducing turning around the globe normal
    const bankDot = planeRight.dot(globeNormal1);
    const bankInducedYaw = bankDot * 1.6;

    // Advance position along forward vector
    const moveDist = this.speed * delta * 2.8;
    const nextPos = this.position.clone().add(forward.clone().multiplyScalar(moveDist));

    // Constrain altitude within flight envelope (1.35 to 45.0 units above surface)
    let currentR = nextPos.length();
    const minR = this.globeRadius + 1.35;
    const maxR = this.globeRadius + 45.0;

    // Ground repulsion: push upward if getting too low
    if (currentR < minR) {
      nextPos.normalize().multiplyScalar(minR);
      currentR = minR;
    } else if (currentR > maxR) {
      nextPos.normalize().multiplyScalar(maxR);
      currentR = maxR;
    }

    const globeNormal2 = nextPos.clone().normalize();
    this.altitude = currentR - this.globeRadius;
    this.position.copy(nextPos);

    // 4. Geodesic Curvature Alignment (Singularity-Free Globe Flight)
    // Minimal rotation from globe normal 1 to globe normal 2
    const qCurvature = new THREE.Quaternion().setFromUnitVectors(globeNormal1, globeNormal2);
    this.quaternion.premultiply(qCurvature);

    // 5. Apply local control rotations (Pitch, Roll, Yaw)
    const qDeltaPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchRate * delta);
    const qDeltaRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.rollRate * delta);
    const qDeltaYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(this.yawRate + bankInducedYaw) * delta);

    this.quaternion.multiply(qDeltaPitch);
    this.quaternion.multiply(qDeltaRoll);
    this.quaternion.multiply(qDeltaYaw);

    // Gentle auto-leveling assist (stabilizes roll when user is not pressing roll keys)
    if (Math.abs(this.input.roll) < 0.05) {
      const currentNormal = this.position.clone().normalize();
      const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);
      const rollMisalignment = currentUp.dot(currentNormal);
      if (rollMisalignment > 0.01) {
        // Compute correction torque to bring plane's up closer to globe normal
        const cross = new THREE.Vector3().crossVectors(currentUp, currentNormal);
        const forwardProj = forward.clone().multiplyScalar(cross.dot(forward));
        const qAutoLevel = new THREE.Quaternion().setFromAxisAngle(forward, forwardProj.length() * Math.sign(cross.dot(forward)) * delta * 0.8);
        this.quaternion.premultiply(qAutoLevel);
      }
    }

    // Sync 3D Mesh
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);

    // Update contrails
    this.updateContrails();
  }

  /**
   * Update Camera smoothly based on current cameraMode ('chase', 'cockpit', 'orbit')
   */
  updateCamera(camera, delta) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion).normalize();

    if (this.cameraMode === 'cockpit') {
      // First person inside cockpit canopy
      const cockpitOffset = new THREE.Vector3(0, 0.22, -0.3).applyQuaternion(this.quaternion);
      camera.position.copy(this.position).add(cockpitOffset);

      const lookTarget = this.position.clone().add(forward.clone().multiplyScalar(50.0));
      camera.lookAt(lookTarget);
      camera.up.copy(up);
      camera.fov = 72;
      camera.updateProjectionMatrix();

    } else if (this.cameraMode === 'chase') {
      // Dynamic chase camera
      const boostPullback = this.isBoosting ? 1.6 : 0.0;
      const camDist = 5.8 + boostPullback;
      const camHeight = 1.65;

      const idealPos = this.position.clone()
        .sub(forward.clone().multiplyScalar(camDist))
        .add(up.clone().multiplyScalar(camHeight));

      const idealLookAt = this.position.clone().add(forward.clone().multiplyScalar(6.0));

      if (this.cameraDampedPos.lengthSq() === 0) {
        this.cameraDampedPos.copy(idealPos);
        this.cameraDampedLookAt.copy(idealLookAt);
      } else {
        const lerpFactor = THREE.MathUtils.clamp(delta * 9.0, 0, 1);
        this.cameraDampedPos.lerp(idealPos, lerpFactor);
        this.cameraDampedLookAt.lerp(idealLookAt, lerpFactor);
      }

      camera.position.copy(this.cameraDampedPos);
      camera.lookAt(this.cameraDampedLookAt);
      camera.up.copy(up);

      // Dynamic FOV kick during boost
      const targetFov = this.isBoosting ? 74 : 60;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 5.0);
      camera.updateProjectionMatrix();

    } else if (this.cameraMode === 'orbit') {
      // Smooth high-altitude orbit camera viewing the plane and globe
      const orbitOffset = new THREE.Vector3(0, 8.0, 14.0).applyQuaternion(this.quaternion);
      const idealPos = this.position.clone().add(orbitOffset);
      camera.position.lerp(idealPos, delta * 3.0);
      camera.lookAt(this.position);
      camera.up.copy(up);
    }
  }

  /**
   * Instantly fly / warp to near a landmark.
   * @param {Object} landmarkData
   */
  warpToLandmark(landmarkData) {
    // Position plane approaching from north / northwest at scenic flight altitude
    const approachLat = landmarkData.lat + 1.2;
    const approachLon = landmarkData.lon;
    this.position = latLonToVector3(approachLat, approachLon, this.globeRadius + 4.5);

    // Orient facing the landmark checkpoint ring
    const targetPos = latLonToVector3(landmarkData.lat, landmarkData.lon, this.globeRadius + landmarkData.ringHeight);
    const forward = targetPos.clone().sub(this.position).normalize();
    const up = this.position.clone().normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(forward, right).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(right, correctedUp, forward.clone().negate());
    this.quaternion = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);

    // Reset camera smoothing
    this.cameraDampedPos.set(0, 0, 0);
  }
}
