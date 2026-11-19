import type { Hole, Vec2 } from "./types";

// Built with arithmetic only (no Math.cos) so the example is identical in every engine.
const D = 0.7071;
function octagon([cx, cz]: Vec2, rx: number, rz: number): Vec2[] {
  return [
    [cx + rx, cz],
    [cx + rx * D, cz + rz * D],
    [cx, cz + rz],
    [cx - rx * D, cz + rz * D],
    [cx - rx, cz],
    [cx - rx * D, cz - rz * D],
    [cx, cz - rz],
    [cx + rx * D, cz - rz * D],
  ];
}

/** A par 4 dogleg right, about 390 m, used for tests and as a starting hole. */
export function exampleHole(): Hole {
  return {
    format: "golfhole",
    version: 1,
    meta: {
      id: "example-dogleg-right",
      name: "The Elbow",
      author: "Golf Game",
      description: "A par 4 that bends right around a pond. Cut the corner if you dare.",
      par: 4,
      createdAt: "2026-11-19T00:00:00.000Z",
    },
    bounds: { width: 180, length: 440 },
    tees: [
      { id: "tee-black", name: "black", position: [60, 12], heading: 0, size: [8, 6] },
      { id: "tee-white", name: "white", position: [61, 32], heading: 0, size: [8, 6] },
      { id: "tee-red", name: "red", position: [63, 62], heading: 0.05, size: [7, 5] },
    ],
    pins: [
      { id: "pin-center", position: [128, 400] },
      { id: "pin-back", position: [131, 410] },
    ],
    activePinId: "pin-center",
    route: {
      points: [
        { position: [60, 15], width: 18 },
        { position: [62, 150], width: 34 },
        { position: [76, 242], width: 32 },
        { position: [118, 330], width: 30 },
        { position: [128, 398], width: 26 },
      ],
    },
    shapes: [
      { id: "green", surface: "green", outline: octagon([128, 401], 17, 15), edgeSoftness: 1.5, shaping: { kind: "green", undulation: 0.4, tilt: [0, 0.015], raise: 0.8 } },
      { id: "tee-pad-black", surface: "tee", outline: octagon([60, 12], 6, 5), edgeSoftness: 1, shaping: { kind: "pad", raise: 0.5 } },
      { id: "tee-pad-white", surface: "tee", outline: octagon([61, 32], 6, 5), edgeSoftness: 1, shaping: { kind: "pad", raise: 0.4 } },
      { id: "tee-pad-red", surface: "tee", outline: octagon([63, 62], 5, 4), edgeSoftness: 1, shaping: { kind: "pad", raise: 0.3 } },
      { id: "pond", surface: "water", outline: octagon([104, 278], 24, 30), edgeSoftness: 2, shaping: { kind: "water", waterLevel: -1.5, bankSteepness: 0.6 } },
      { id: "bunker-corner", surface: "sand", outline: octagon([50, 250], 9, 13), edgeSoftness: 1, shaping: { kind: "bunker", depth: 1.2, lip: 0.4 } },
      { id: "bunker-green-left", surface: "sand", outline: octagon([106, 392], 7, 10), edgeSoftness: 1, shaping: { kind: "bunker", depth: 1.4, lip: 0.6 } },
      { id: "bunker-green-back", surface: "sand", outline: octagon([140, 423], 10, 5), edgeSoftness: 1, shaping: { kind: "bunker", depth: 1, lip: 0.3 } },
    ],
    procedural: { seed: 20261119, roughness: 0.45, elevationRange: 12, corridorFlatten: 0.6, slope: [0, -0.01] },
    overrides: {},
  };
}
