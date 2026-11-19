// Hole format, version 1. See docs/HOLE_FORMAT.md.

export const HOLE_FORMAT = "golfhole";
export const HOLE_VERSION = 1;

/** Map coordinates [x, z] in meters: x to the right, z up the map toward the green. */
export type Vec2 = [number, number];

export const SURFACE_IDS = ["tee", "fairway", "fringe", "green", "rough", "sand", "water"] as const;
export type SurfaceId = (typeof SURFACE_IDS)[number];

export type Par = 3 | 4 | 5 | 6;

export interface Hole {
  format: typeof HOLE_FORMAT;
  version: typeof HOLE_VERSION;
  meta: HoleMeta;
  bounds: { width: number; length: number };

  // Layer 1: intent
  tees: Tee[];
  pins: Pin[];
  activePinId: string;
  route: Route;
  shapes: Shape[];

  // Layer 2: procedural
  procedural: ProceduralSettings;

  // Layer 3: overrides
  overrides: {
    height?: SparseGrid;
    surface?: SparseGrid;
  };
}

export interface HoleMeta {
  id: string;
  name: string;
  author?: string;
  description?: string;
  par: Par;
  /** ISO date string. */
  createdAt: string;
}

export interface Tee {
  id: string;
  name: string;
  position: Vec2;
  /** Aim direction in radians clockwise from +z (0 = up the map, positive = right). */
  heading: number;
  size: Vec2;
}

export interface Pin {
  id: string;
  position: Vec2;
}

export interface RoutePoint {
  position: Vec2;
  width: number;
}

export interface Route {
  points: RoutePoint[];
}

export interface Shape {
  id: string;
  surface: SurfaceId;
  outline: Vec2[];
  edgeSoftness: number;
  shaping?: ShapeShaping;
}

export type ShapeShaping =
  | { kind: "green"; undulation: number; tilt?: Vec2; raise: number }
  | { kind: "bunker"; depth: number; lip: number }
  | { kind: "water"; waterLevel: number; bankSteepness: number }
  | { kind: "pad"; raise: number }
  | { kind: "none" };

export type ShapingKind = ShapeShaping["kind"];

export interface ProceduralSettings {
  /** Unsigned 32-bit integer. */
  seed: number;
  /** 0..1 */
  roughness: number;
  /** Meters between lowest and highest ground. */
  elevationRange: number;
  /** 0..1 */
  corridorFlatten: number;
  slope?: Vec2;
}

export interface SparseGridChunk {
  cx: number;
  cz: number;
  /** base64 of quantized values. */
  data: string;
}

export interface SparseGrid {
  cellSize: number;
  chunkSize: number;
  chunks: SparseGridChunk[];
}
