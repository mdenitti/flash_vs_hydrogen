import * as THREE from 'three';
import { calcGreatCircleDistanceKm } from '../math/globeMath.js';

export class CheckpointSystem {
  constructor(scene, landmarkBuilder, soundManager, onCheckpointDiscovered) {
    this.scene = scene;
    this.landmarkBuilder = landmarkBuilder;
    this.soundManager = soundManager;
    this.onCheckpointDiscovered = onCheckpointDiscovered;

    this.checkRadius = 3.2; // radius to trigger checkpoint ring
    this.discoveredCount = 0;
    this.totalLandmarks = landmarkBuilder.landmarkInstances.length;

    // Particle explosions pool
    this.activeParticleBursts = [];

    // Spatial UI tracking data
    this.nearestLandmark = null;
    this.nearestDistanceKm = 0;
  }

  update(aircraftPosition, delta, time) {
    const currentPos = aircraftPosition;
    let minDistance = Infinity;
    let closest = null;

    this.landmarkBuilder.landmarkInstances.forEach(inst => {
      // Calculate 3D euclidean distance to checkpoint ring
      const dist3D = currentPos.distanceTo(inst.ringWorldPos);
      const distKm = calcGreatCircleDistanceKm(currentPos, inst.ringWorldPos);

      inst.distanceKm = distKm;
      inst.distance3D = dist3D;

      if (distKm < minDistance) {
        minDistance = distKm;
        closest = inst;
      }

      // Check proximity trigger for unvisited landmark
      if (!inst.visited && dist3D <= this.checkRadius) {
        this.triggerCheckpoint(inst);
      }
    });

    this.nearestLandmark = closest;
    this.nearestDistanceKm = minDistance;

    // Update active particle bursts
    this.updateParticles(delta);
  }

  triggerCheckpoint(inst) {
    inst.visited = true;
    this.discoveredCount++;

    // Audio chime
    this.soundManager.playCheckpointChime();

    // Spawn 3D particle burst at the ring location
    this.spawnParticleBurst(inst.ringWorldPos, inst.color);

    // Notify UI
    if (this.onCheckpointDiscovered) {
      this.onCheckpointDiscovered(inst, this.discoveredCount, this.totalLandmarks);
    }
  }

  spawnParticleBurst(position, colorHex) {
    const particleCount = 140;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    const baseColor = new THREE.Color(colorHex);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Random spherical velocity
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const speed = 4.0 + Math.random() * 8.0;

      const vx = speed * Math.sin(phi) * Math.cos(theta);
      const vy = speed * Math.cos(phi);
      const vz = speed * Math.sin(phi) * Math.sin(theta);

      velocities.push(new THREE.Vector3(vx, vy, vz));
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: baseColor,
      size: 0.8,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.activeParticleBursts.push({
      points,
      velocities,
      age: 0,
      maxAge: 1.6
    });
  }

  updateParticles(delta) {
    for (let i = this.activeParticleBursts.length - 1; i >= 0; i--) {
      const burst = this.activeParticleBursts[i];
      burst.age += delta;

      const progress = burst.age / burst.maxAge;
      if (progress >= 1.0) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        this.activeParticleBursts.splice(i, 1);
        continue;
      }

      // Update positions
      const positions = burst.points.geometry.attributes.position.array;
      for (let p = 0; p < burst.velocities.length; p++) {
        const vel = burst.velocities[p];
        positions[p * 3] += vel.x * delta;
        positions[p * 3 + 1] += vel.y * delta;
        positions[p * 3 + 2] += vel.z * delta;

        // Slow down with drag
        vel.multiplyScalar(0.96);
      }
      burst.points.geometry.attributes.position.needsUpdate = true;

      // Fade out
      burst.points.material.opacity = 1.0 - progress;
      burst.points.material.size = 0.8 * (1.0 + progress * 0.5);
    }
  }
}

