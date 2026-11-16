/**
 * Core physical and visual constants for the TerraWings 3D globe simulator.
 */

export const GLOBE_RADIUS = 120;
export const TERRAIN_RELIEF_SCALE = 2.35;
export const CLOUD_DECK_ALTITUDE = 6.2;
export const ATMOSPHERE_RADIUS = GLOBE_RADIUS * 1.085;

export const MIN_ALTITUDE_CLEARANCE = 1.15;
export const DEFAULT_ALTITUDE = 4.6;
export const MAX_ALTITUDE = 48;

export const CRUISE_SPEED = 13.5;
export const MIN_SPEED = 4.5;
export const BOOST_SPEED = 32.0;

export const CHECKPOINT_TRIGGER_SURFACE_DIST = 4.4;
export const CHECKPOINT_TRIGGER_MAX_ALT = 14.5;

export type AircraftVariant = 'biplane' | 'jet';
export type CameraMode = 'chase' | 'cinematic' | 'cockpit';

/**
 * Conversion factor from Three.js world units near the surface to display kilometers
 * (purely for evocative aviation HUD telemetry).
 */
export const KM_PER_UNIT = 6371 / GLOBE_RADIUS;

