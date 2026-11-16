import * as THREE from 'three';

export class AircraftController {
  constructor(scene, globeRadius) {
    this.scene = scene;
    this.globeRadius = globeRadius;

    // Root frame positioned on the sphere; +Y = up (away from Earth center), +Z = forward, +X = left
    this.anchor = new THREE.Group();
    this.scene.add(this.anchor);

    // Visual banking / pitching mesh container inside anchor
    this.meshGroup = new THREE.Group();
    this.anchor.add(this.meshGroup);

    this.buildAirplaneMesh();
    this.initContrails();
    this.sharedFlareGeo = new THREE.SphereGeometry(0.32, 12, 12);
    this.flares = [];
  }

  buildAirplaneMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.45,
      roughness: 0.22,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      metalness: 0.55,
      roughness: 0.25,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      metalness: 0.4,
      roughness: 0.3,
      emissive: 0x9a3412,
      emissiveIntensity: 0.4,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.9,
      roughness: 0.08,
      transparent: true,
      opacity: 0.78,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Sleek Fuselage (oriented along +Z forward)
    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.28, 2.5, 24),
      bodyMat
    );
    fuselage.rotation.x = Math.PI / 2;
    this.meshGroup.add(fuselage);

    // Tapered Rear Tail Cone & Exhaust Nozzle at -Z
    const tailCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.15, 0.75, 20),
      darkMetalMat
    );
    tailCone.rotation.x = Math.PI / 2;
    tailCone.position.z = -1.55;
    this.meshGroup.add(tailCone);

    // Pointed Aerodynamic Nose Cone at +Z
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95, 24), accentMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 1.72;
    this.meshGroup.add(nose);

    // Twin Wing-Mounted Engine Nacelles & Spinning Propellers
    this.propGroup = new THREE.Group();
    this.leftProp = new THREE.Group();
    this.rightProp = new THREE.Group();

    const bladeMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.65,
    });
    const blurMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });

    [-0.92, 0.92].forEach((ex, i) => {
      const nacelle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 0.78, 16),
        darkMetalMat
      );
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(ex, -0.04, 0.32);
      this.meshGroup.add(nacelle);

      const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 16), trimMat);
      spinner.rotation.x = Math.PI / 2;
      spinner.position.set(ex, -0.04, 0.82);
      this.meshGroup.add(spinner);

      const rotor = i === 0 ? this.leftProp : this.rightProp;
      rotor.position.set(ex, -0.04, 0.74);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.055, 0.015), bladeMat);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.68, 0.015), bladeMat);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), blurMat);
      rotor.add(b1, b2, disc);
      this.meshGroup.add(rotor);
    });

    // Bubble Cockpit Canopy
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), glassMat);
    canopy.scale.set(0.82, 0.74, 2.35);
    canopy.position.set(0, 0.19, 0.35);
    this.meshGroup.add(canopy);

    // Swept Main Wings
    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.065, 0.64), bodyMat);
    mainWing.position.set(0, 0.0, 0.12);
    this.meshGroup.add(mainWing);

    const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.07, 0.18), accentMat);
    wingStripe.position.set(0, 0.0, 0.26);
    this.meshGroup.add(wingStripe);

    // Upturned Winglets at Wingtips
    [-1.9, 1.9].forEach((wx) => {
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.44), trimMat);
      winglet.position.set(wx, 0.18, 0.04);
      winglet.rotation.z = wx < 0 ? 0.22 : -0.22;
      this.meshGroup.add(winglet);
    });

    // Navigation Wingtip Strobe Lights (Red Port, Green Starboard)
    const portLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    portLight.position.set(1.94, 0.36, 0.04);

    const starboardLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    starboardLight.position.set(-1.94, 0.36, 0.04);
    this.meshGroup.add(portLight, starboardLight);

    // Tail Horizontal Stabilizer & Elevator at -Z
    this.elevator = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.05, 0.38), accentMat);
    this.elevator.position.set(0, 0.1, -1.28);
    this.meshGroup.add(this.elevator);

    // Swept Vertical Tail Fin & Rudder at -Z
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.82, 0.58), trimMat);
    tailFin.position.set(0, 0.44, -1.22);
    tailFin.rotation.x = -0.22;
    this.meshGroup.add(tailFin);

    // Rear Afterburner Glow Cone (visible when boosting)
    this.afterburnerCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.15, 16),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
      })
    );
    this.afterburnerCone.rotation.x = -Math.PI / 2;
    this.afterburnerCone.position.z = -2.15;
    this.meshGroup.add(this.afterburnerCone);

    // Scale aircraft nicely relative to landmarks & globe
    this.meshGroup.scale.setScalar(1.15);
  }

  initContrails() {
    this.trailLength = 56;
    this.leftTrailPts = [];
    this.rightTrailPts = [];

    const createTrailLine = () => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(this.trailLength * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.55,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.scene.add(line);
      return line;
    };

    this.leftTrailLine = createTrailLine();
    this.rightTrailLine = createTrailLine();
  }

  resetContrails(worldPos) {
    this.leftTrailPts = [];
    this.rightTrailPts = [];
    for (let i = 0; i < this.trailLength; i++) {
      this.leftTrailPts.push(worldPos.clone());
      this.rightTrailPts.push(worldPos.clone());
    }
  }

  fireSkyFlare() {
    const colors = [0x38bdf8, 0xfbbf24, 0xf43f5e, 0x34d399, 0xa855f7];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const worldPos = new THREE.Vector3();
    this.anchor.getWorldPosition(worldPos);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.anchor.quaternion);

    const flareMesh = new THREE.Mesh(
      this.sharedFlareGeo,
      new THREE.MeshBasicMaterial({ color })
    );
    flareMesh.position.copy(worldPos).addScaledVector(forward, 2.2);
    this.scene.add(flareMesh);

    this.flares.push({
      mesh: flareMesh,
      vel: forward.multiplyScalar(78),
      life: 1.8,
    });
  }

  updateVisuals(dt, rollAngle, pitchAngle, isBoosting) {
    // Spin counter-rotating wing propellers rapidly
    const spinSpeed = dt * (isBoosting ? 46 : 28);
    if (this.leftProp) this.leftProp.rotation.z += spinSpeed;
    if (this.rightProp) this.rightProp.rotation.z -= spinSpeed;

    // Bank & pitch visual aircraft mesh smoothly
    this.meshGroup.rotation.z = rollAngle;
    this.meshGroup.rotation.x = -pitchAngle * 0.65;
    this.elevator.rotation.x = pitchAngle * 0.5;

    // Afterburner cone glow
    this.afterburnerCone.material.opacity = isBoosting ? 0.78 + Math.random() * 0.2 : 0.0;
    this.afterburnerCone.scale.y = isBoosting ? 1.0 + Math.random() * 0.35 : 0.5;

    // Update wingtip contrails in world space
    const leftTip = new THREE.Vector3(2.1, 0.05, -0.1);
    const rightTip = new THREE.Vector3(-2.1, 0.05, -0.1);
    this.meshGroup.localToWorld(leftTip);
    this.meshGroup.localToWorld(rightTip);

    if (this.leftTrailPts.length === 0) {
      this.resetContrails(leftTip);
    }

    this.leftTrailPts.pop();
    this.leftTrailPts.unshift(leftTip);
    this.rightTrailPts.pop();
    this.rightTrailPts.unshift(rightTip);

    const updateBuffer = (line, pts) => {
      const attr = line.geometry.attributes.position;
      for (let i = 0; i < pts.length; i++) {
        attr.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
      }
      attr.needsUpdate = true;
    };

    updateBuffer(this.leftTrailLine, this.leftTrailPts);
    updateBuffer(this.rightTrailLine, this.rightTrailPts);

    // Update sky flares
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.flares.splice(i, 1);
      } else {
        f.mesh.position.addScaledVector(f.vel, dt);
        f.mesh.scale.setScalar(0.5 + f.life * 0.6);
      }
    }
  }
}
