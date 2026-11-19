import * as THREE from "three";
import type { Vec2 } from "../core/types";

// Hole coordinates are map coordinates: x to the right, z up the map toward the green.
// Three.js is right-handed, so a player facing +z would have +x on their left.
// We place hole z at world -z, which keeps +x on the player's right, matching the map.

export function holeToWorld([x, z]: Vec2, height = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x, height, -z);
}

/** Unit direction in hole coordinates for a heading (radians clockwise from +z). */
export function headingToDirection(heading: number): Vec2 {
  return [Math.sin(heading), Math.cos(heading)];
}
