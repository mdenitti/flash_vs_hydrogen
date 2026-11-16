import * as THREE from 'three';
import { GLOBE_RADIUS } from './constants.ts';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Converts geographic coordinates (latitude & longitude in degrees) to 3D Cartesian
 * coordinates matching Three.js SphereGeometry's equirectangular UV projection.
 *
 * At lat=0, lon=0 -> (+R, 0, 0).
 * At lat=0, lon=+90E -> (0, 0, -R).
 * At lat=+90N -> (0, +R, 0).
 *
 * @param latDeg - Latitude in degrees [-90, 90].
 * @param lonDeg - Longitude in degrees [-180, 180].
 * @param radius - Sphere radius in world units (defaults to GLOBE_RADIUS).
 * @param target - Optional Vector3 to populate in place.
 * @returns The 3D Cartesian position vector.
 */
export function latLonToVector3(
  latDeg: number,
  lonDeg: number,
  radius: number = GLOBE_RADIUS,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const lat = latDeg * DEG_TO_RAD;
  const lon = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(lat);

  target.set(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * cosLat * Math.sin(lon)
  );
  return target;
}

/**
 * Converts a 3D Cartesian position around the origin back into geographic latitude
 * and longitude in degrees.
 *
 * @param position - 3D Cartesian coordinate relative to globe center.
 * @returns Object containing `lat` and `lon` in degrees and `radius`.
 */
export function vector3ToLatLon(position: THREE.Vector3): {
  lat: number;
  lon: number;
  radius: number;
} {
  const radius = position.length();
  if (radius < 1e-6) {
    return { lat: 0, lon: 0, radius: 0 };
  }
  const ny = THREE.MathUtils.clamp(position.y / radius, -1, 1);
  const lat = Math.asin(ny) * RAD_TO_DEG;
  const lon = Math.atan2(-position.z, position.x) * RAD_TO_DEG;
  return { lat, lon, radius };
}

/**
 * Computes an orthonormal local East-North-Up tangent frame at a given radial normal.
 *
 * @param upNormal - Normalized outward surface normal vector.
 * @returns Orthonormal basis vectors `{ east, north, up }`.
 */
export function getLocalTangentBasis(upNormal: THREE.Vector3): {
  east: THREE.Vector3;
  north: THREE.Vector3;
  up: THREE.Vector3;
} {
  const up = upNormal.clone().normalize();
  const worldNorth = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(worldNorth, up);
  if (east.lengthSq() < 1e-6) {
    east.set(1, 0, 0);
  } else {
    east.normalize();
  }
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { east, north, up };
}

/**
 * Computes compass heading in degrees [0, 360) from an outward surface normal and
 * a forward flight direction projected onto the local tangent plane.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 *
 * @param upNormal - Normalized outward vector from globe center.
 * @param forwardDir - Normalized world-space forward direction vector.
 * @returns Compass heading in degrees [0, 360).
 */
export function computeCompassHeading(
  upNormal: THREE.Vector3,
  forwardDir: THREE.Vector3
): number {
  const { east, north, up } = getLocalTangentBasis(upNormal);
  const tangentForward = forwardDir
    .clone()
    .addScaledVector(up, -forwardDir.dot(up));
  if (tangentForward.lengthSq() < 1e-8) {
    return 0;
  }
  tangentForward.normalize();
  const northComp = tangentForward.dot(north);
  const eastComp = tangentForward.dot(east);
  const deg = Math.atan2(eastComp, northComp) * RAD_TO_DEG;
  return (deg + 360) % 360;
}

/**
 * Computes great-circle central angle (in radians) between two normalized radial vectors.
 *
 * @param normalA - First unit direction from globe center.
 * @param normalB - Second unit direction from globe center.
 * @returns Great-circle angle in radians [0, PI].
 */
export function greatCircleAngle(
  normalA: THREE.Vector3,
  normalB: THREE.Vector3
): number {
  return Math.acos(THREE.MathUtils.clamp(normalA.dot(normalB), -1, 1));
}

/**
 * Computes great-circle initial compass bearing (in degrees [0, 360)) from point A to point B.
 *
 * @param fromLat - Origin latitude in degrees.
 * @param fromLon - Origin longitude in degrees.
 * @param toLat - Destination latitude in degrees.
 * @param toLon - Destination longitude in degrees.
 * @returns Compass bearing in degrees [0, 360).
 */
export function computeBearingDegrees(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const phi1 = fromLat * DEG_TO_RAD;
  const phi2 = toLat * DEG_TO_RAD;
  const dLambda = (toLon - fromLon) * DEG_TO_RAD;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.atan2(y, x) * RAD_TO_DEG + 360) % 360;
}

/**
 * Normalizes an angular difference into [-180, 180] degrees.
 *
 * @param angleDeg - Angle difference in degrees.
 * @returns Shortest signed angle in [-180, 180].
 */
export function normalizeSignedAngle(angleDeg: number): number {
  let a = ((angleDeg + 180) % 360 + 360) % 360 - 180;
  if (a === -180) a = 180;
  return a;
}

/**
 * Formats latitude and longitude into readable aviation coordinates (e.g. "48.86° N, 2.29° E").
 *
 * @param lat - Latitude in degrees.
 * @param lon - Longitude in degrees.
 * @returns Formatted coordinate string.
 */
export function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

