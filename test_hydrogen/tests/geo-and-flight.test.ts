import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GLOBE_RADIUS, MAX_ALTITUDE } from '../src/core/constants.ts';
import {
  computeBearingDegrees,
  computeCompassHeading,
  getLocalTangentBasis,
  greatCircleAngle,
  latLonToVector3,
  normalizeSignedAngle,
  vector3ToLatLon,
} from '../src/core/geo.ts';
import { stepSphericalFlight } from '../src/flight/FlightController.ts';
import { isCheckpointFlyover } from '../src/landmarks/CheckpointSystem.ts';
import { LANDMARKS } from '../src/landmarks/landmarksData.ts';

test('latLonToVector3 and vector3ToLatLon roundtrip matches Three.js SphereGeometry axes', () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [0, 90],
    [0, -90],
    [48.8584, 2.2945],
    [-33.8568, 151.2153],
    [40.6892, -74.0445],
  ];

  for (const [lat, lon] of cases) {
    const vec = latLonToVector3(lat, lon, GLOBE_RADIUS);
    assert.ok(Math.abs(vec.length() - GLOBE_RADIUS) < 1e-6);
    const out = vector3ToLatLon(vec);
    assert.ok(Math.abs(out.lat - lat) < 1e-5, `lat mismatch for ${lat}: ${out.lat}`);
    assert.ok(Math.abs(out.lon - lon) < 1e-5, `lon mismatch for ${lon}: ${out.lon}`);
  }

  // Specific axis checks matching Three.js SphereGeometry UV mapping
  const prime = latLonToVector3(0, 0, 1);
  assert.ok(prime.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-6);

  const east90 = latLonToVector3(0, 90, 1);
  assert.ok(east90.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6);

  const northPole = latLonToVector3(90, 0, 1);
  assert.ok(northPole.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-6);
});

test('computeCompassHeading matches cardinal directions', () => {
  const normal = latLonToVector3(45, 10, 1).normalize();
  const { east, north } = getLocalTangentBasis(normal);

  assert.ok(Math.abs(normalizeSignedAngle(computeCompassHeading(normal, north) - 0)) < 1e-4);
  assert.ok(Math.abs(normalizeSignedAngle(computeCompassHeading(normal, east) - 90)) < 1e-4);
  assert.ok(
    Math.abs(normalizeSignedAngle(computeCompassHeading(normal, north.clone().negate()) - 180)) <
      1e-4
  );
  assert.ok(
    Math.abs(normalizeSignedAngle(computeCompassHeading(normal, east.clone().negate()) - 270)) <
      1e-4
  );
});

test('computeBearingDegrees returns accurate geographic bearings', () => {
  const eastBearing = computeBearingDegrees(0, 0, 0, 45);
  assert.ok(Math.abs(eastBearing - 90) < 1e-4);

  const parisToLondon = computeBearingDegrees(48.8584, 2.2945, 51.5007, -0.1246);
  assert.ok(parisToLondon > 315 && parisToLondon < 345);
});

test('stepSphericalFlight moves forward along forwardTangent and crosses poles without gimbal lock', () => {
  const normal = latLonToVector3(85, 0, 1).normalize();
  const { north } = getLocalTangentBasis(normal);
  const forward = north.clone().normalize();
  let alt = 4.5;

  const initialNormal = normal.clone();
  const nextAlt = stepSphericalFlight(normal, forward, alt, 15, 0, 0, 0.05, 1.15);
  assert.equal(nextAlt, 4.5);

  const delta = normal.clone().sub(initialNormal);
  assert.ok(delta.dot(forward) > 0, 'Aircraft must move forward in direction of forwardTangent');

  // Fly straight across the North Pole for 1000 steps
  for (let i = 0; i < 1000; i++) {
    alt = stepSphericalFlight(normal, forward, alt, 18, 0, 0, 0.016, 1.15);
  }

  assert.ok(Number.isFinite(normal.x) && Number.isFinite(normal.y) && Number.isFinite(normal.z));
  assert.ok(Math.abs(normal.length() - 1) < 1e-5);
  assert.ok(Math.abs(normal.dot(forward)) < 1e-5);
  assert.ok(normal.y < 0.99, 'Aircraft should have flown cleanly past the North Pole');
});

test('stepSphericalFlight turns clockwise on positive turnRate and clamps altitude', () => {
  const normal = latLonToVector3(20, 10, 1).normalize();
  const { north } = getLocalTangentBasis(normal);
  const forward = north.clone().normalize();

  const headingBefore = computeCompassHeading(normal, forward);
  stepSphericalFlight(normal, forward, 5, 10, 0, Math.PI / 2, 0.5, 1.15);
  const headingAfter = computeCompassHeading(normal, forward);

  const deltaHeading = normalizeSignedAngle(headingAfter - headingBefore);
  assert.ok(deltaHeading > 35 && deltaHeading < 55, `Expected ~45 deg right turn, got ${deltaHeading}`);

  const clampedHigh = stepSphericalFlight(normal, forward, MAX_ALTITUDE, 20, 0.5, 0, 1.0, 1.15);
  assert.equal(clampedHigh, MAX_ALTITUDE);

  const clampedLow = stepSphericalFlight(normal, forward, 1.5, 20, -0.5, 0, 1.0, 1.2);
  assert.equal(clampedLow, 1.2);
});

test('isCheckpointFlyover triggers only within surface & altitude envelope', () => {
  const eiffel = LANDMARKS.find((l) => l.id === 'eiffel')!;
  const eiffelNormal = latLonToVector3(eiffel.lat, eiffel.lon, 1).normalize();

  const insidePos = eiffelNormal.clone().multiplyScalar(GLOBE_RADIUS + eiffel.ringAltitude);
  assert.equal(
    isCheckpointFlyover(insidePos, eiffelNormal, GLOBE_RADIUS, eiffel.ringAltitude),
    true
  );

  // Too high in orbit
  const tooHighPos = eiffelNormal.clone().multiplyScalar(GLOBE_RADIUS + 35);
  assert.equal(
    isCheckpointFlyover(tooHighPos, eiffelNormal, GLOBE_RADIUS, eiffel.ringAltitude),
    false
  );

  // Too far away horizontally
  const farNormal = latLonToVector3(eiffel.lat + 8, eiffel.lon, 1).normalize();
  const farPos = farNormal.clone().multiplyScalar(GLOBE_RADIUS + eiffel.ringAltitude);
  assert.equal(
    isCheckpointFlyover(farPos, eiffelNormal, GLOBE_RADIUS, eiffel.ringAltitude),
    false
  );
});

test('LANDMARKS catalog has 12 unique, well-formed global checkpoints', () => {
  assert.equal(LANDMARKS.length, 12);
  const ids = new Set(LANDMARKS.map((l) => l.id));
  assert.equal(ids.size, 12);
  for (const lm of LANDMARKS) {
    assert.ok(lm.lat >= -90 && lm.lat <= 90);
    assert.ok(lm.lon >= -180 && lm.lon <= 180);
    assert.ok(lm.height >= 4.0);
    assert.ok(lm.ringAltitude >= lm.height);
    assert.ok(greatCircleAngle(latLonToVector3(lm.lat, lm.lon, 1), new THREE.Vector3(1, 0, 0)) >= 0);
  }
});

