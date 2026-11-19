# Hole format

A hole is one JSON document. The editor changes it, play mode builds the 3D world from it, the sign renderer draws it, and sharing sends it.

## Core idea: three layers

1. **Intent:** what the designer placed. This includes tees, pins, the fairway route and shapes. It's small and meaningful.
2. **Procedural:** a seed plus settings. The generator turns intent and seed into natural terrain.
3. **Overrides:** manual sculpting and surface painting, on top of the generated result.

The final hole is always `generate(intent, procedural) + overrides`. Changing the seed or settings rerolls the generated part and keeps your intent and overrides.

## Coordinates

- Units are meters. Y is up (matching Three.js).
- The hole sits in a rectangle from `(0, 0)` to `(width, length)` on the X/Z plane. The tee is usually near `z = 0` and play runs toward `+z`.
- Heights are meters above a base level of 0.

## Schema (TypeScript)

```ts
interface Hole {
  format: "golfhole";
  version: 1;

  meta: {
    id: string;            // random id, set on creation
    name: string;
    author?: string;
    description?: string;
    par: 3 | 4 | 5 | 6;
    createdAt: string;     // ISO date
  };

  bounds: { width: number; length: number };  // meters, e.g. 160 x 520

  // ---- Layer 1: intent ----
  tees: Tee[];
  pins: Pin[];
  activePinId: string;
  route: Route;            // the fairway route, guides generation
  shapes: Shape[];         // greens, bunkers, water, fairway pieces; drawn in order

  // ---- Layer 2: procedural ----
  procedural: ProceduralSettings;

  // ---- Layer 3: overrides ----
  overrides: {
    height?: SparseGrid;   // added to generated height
    surface?: SparseGrid;  // painted surface ids, replace generated surface
  };
}

interface Tee {
  id: string;
  name: "black" | "blue" | "white" | "red" | string;
  position: Vec2;          // center of the tee box
  heading: number;         // aim direction, radians, 0 = +z
  size: Vec2;              // box width and depth
}

interface Pin {
  id: string;
  position: Vec2;          // must be on a green shape
}

interface Route {
  // Centerline from tee to green. Smooth curve through the points.
  points: { position: Vec2; width: number }[];
}

interface Shape {
  id: string;
  surface: SurfaceId;
  outline: Vec2[];         // closed curve control points (smoothed)
  edgeSoftness: number;    // meters of blend at the border
  shaping?: ShapeShaping;  // how the shape changes terrain
}

type ShapeShaping =
  | { kind: "green"; undulation: number; tilt?: Vec2; raise: number }
  | { kind: "bunker"; depth: number; lip: number }
  | { kind: "water"; waterLevel: number; bankSteepness: number }
  | { kind: "pad"; raise: number }            // tee pads, raised fairway sections
  | { kind: "none" };

interface ProceduralSettings {
  seed: number;            // 32-bit integer
  roughness: number;       // 0..1, size of rolling hills
  elevationRange: number;  // meters between lowest and highest ground
  corridorFlatten: number; // 0..1, how much the route is smoothed out
  slope?: Vec2;            // overall tilt of the land, e.g. downhill hole
}

type SurfaceId = "tee" | "fairway" | "fringe" | "green" | "rough" | "sand" | "water";

type Vec2 = [number, number];  // [x, z]
```

## Grids

The final hole resolves to two grids:
- **Height:** 1 m cells across the whole hole. Greens get their own 0.25 m patch, because putting needs fine detail.
- **Surface:** 0.5 m cells, one surface id per cell.

```ts
interface SparseGrid {
  cellSize: number;
  chunkSize: number;                 // cells per chunk side, e.g. 32
  chunks: { cx: number; cz: number; data: string }[];  // base64 of quantized values
}
```

Only chunks that were changed are stored. Height overrides are stored as int16 centimeters.

## Generation pipeline

Every step is deterministic and only uses the seeded RNG.

1. **Base noise:** layered noise from the seed, scaled by `roughness` and `elevationRange`, tilted by `slope`.
2. **Corridor:** smooth and ease the terrain along the route, by `corridorFlatten`.
3. **Shapes:** apply each shape's shaping. Greens get a raised pad with gentle undulation, bunkers get a depression with a lip, water gets a basin, and tee pads get flattened.
4. **Height overrides:** add the sculpt deltas.
5. **Surfaces:** start with rough everywhere. Generate fairway along the route at the route width. Draw shapes in order. Add a fringe ring around greens. Apply painted overrides last.

## Share codes

```
GH1.<base64url( deflate-raw( canonical JSON ) )>
```

- **Canonical JSON:** sorted keys, numbers rounded to centimeters. The same hole always gives the same code.
- **Compression:** the browser's built-in `CompressionStream("deflate-raw")`.
- **Target size:** under about 2 KB for a hole without manual sculpting, so it fits comfortably in a URL. Holes with heavy sculpting will be larger and may need a backend later.
- **Versioning:** the `GH1` prefix and the `version` field allow migrating old holes when the format changes.
