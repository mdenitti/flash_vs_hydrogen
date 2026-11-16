import * as THREE from 'three';

export const GLOBE_RADIUS = 100;

/**
 * Convert Latitude and Longitude to 3D Vector3 Cartesian position on the globe.
 * Matches Three.js SphereGeometry UV mapping exactly.
 * @param {number} lat - Latitude in degrees (-90 to +90)
 * @param {number} lon - Longitude in degrees (-180 to +180)
 * @param {number} radius - Sphere radius (default GLOBE_RADIUS)
 * @returns {THREE.Vector3}
 */
export function latLonToVector3(lat, lon, radius = GLOBE_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

/**
 * Convert 3D Vector3 Cartesian position to Latitude, Longitude, and Altitude.
 * @param {THREE.Vector3} pos
 * @param {number} radius - Base globe radius
 * @returns {{lat: number, lon: number, alt: number}}
 */
export function vector3ToLatLon(pos, radius = GLOBE_RADIUS) {
  const r = pos.length();
  const phi = Math.acos(Math.max(-1, Math.min(1, pos.y / r)));
  const lat = 90 - (phi * 180 / Math.PI);
  const theta = Math.atan2(pos.z, -pos.x);
  let lon = (theta * 180 / Math.PI) - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return {
    lat,
    lon,
    alt: r - radius
  };
}

/**
 * Great-circle distance between two points on the globe in kilometers.
 * Real Earth radius ~ 6,371 km.
 * @param {THREE.Vector3} pos1
 * @param {THREE.Vector3} pos2
 * @returns {number} Distance in km
 */
export function calcGreatCircleDistanceKm(pos1, pos2) {
  const v1 = pos1.clone().normalize();
  const v2 = pos2.clone().normalize();
  const dot = Math.max(-1, Math.min(1, v1.dot(v2)));
  const angle = Math.acos(dot);
  return Math.round(angle * 6371);
}

/**
 * Compute local surface tangent frame (East, North, Up) at a point on the sphere.
 * @param {THREE.Vector3} position
 * @returns {{up: THREE.Vector3, north: THREE.Vector3, east: THREE.Vector3}}
 */
export function getLocalSurfaceFrame(position) {
  const up = position.clone().normalize();
  const worldNorth = new THREE.Vector3(0, 1, 0);

  // If at the poles, pick an arbitrary orthogonal vector
  let east;
  if (Math.abs(up.dot(worldNorth)) > 0.999) {
    east = new THREE.Vector3(1, 0, 0);
  } else {
    east = new THREE.Vector3().crossVectors(worldNorth, up).normalize();
  }

  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { up, north, east };
}

/**
 * Compute heading angle in degrees (0 to 360, 0 = North, 90 = East, etc.)
 * for a forward vector on the globe.
 * @param {THREE.Vector3} position
 * @param {THREE.Vector3} forward
 * @returns {number} Heading in degrees (0-360)
 */
export function computeHeadingDegrees(position, forward) {
  const { up, north, east } = getLocalSurfaceFrame(position);
  // Project forward onto horizontal tangent plane
  const projFwd = forward.clone().sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
  const dotNorth = Math.max(-1, Math.min(1, projFwd.dot(north)));
  const dotEast = projFwd.dot(east);
  let angleDeg = Math.acos(dotNorth) * (180 / Math.PI);
  if (dotEast < 0) {
    angleDeg = 360 - angleDeg;
  }
  return (Math.round(angleDeg) + 360) % 360;
}

