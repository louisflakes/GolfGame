# Design

## Goals

- **Designing holes is the game.** Playing exists to test and enjoy what you built.
- **Semi-procedural:** you set the strategy, the generator makes it look natural.
- **Interesting terrain:** elevation and slopes matter on every shot.
- **Shareable:** a hole is a short code or link.

**Not now:** deep swing mechanics, multiplayer, character customization, a hosted backend.

---

## Architecture

TypeScript + Vite + Three.js. Static build output, published as a claude.ai artifact for previews and deployable to Cloudflare Pages later.

```
src/
  core/     hole format, validation, share codes, seeded RNG, noise, terrain generation
  physics/  ball flight, bounce, roll, surface interaction
  render/   Three.js terrain, surfaces, ball, camera, character
  sign/     2D overview sign renderer (Canvas2D)
  editor/   tools, command/undo stack, 2D editor view
  play/     shot flow, swing meter, scoring
  ui/       menus, panels, HUD
```

`core/` and `physics/` are pure: no DOM, no Three.js. They are unit-tested with Vitest and stay reusable by a future backend.

**Determinism.** Generation and physics must give the same result on every machine, so that a share code always produces the same hole, and so that leaderboards stay possible later. Rules:
- All randomness comes from a seeded PRNG. Never `Math.random()` in `core/` or `physics/`.
- Our own noise implementation, no library.
- Avoid `Math.sin`/`cos`/`exp`/`pow` in generation and physics, because their precision is not guaranteed to be identical across browsers. Use our own approximations, or arithmetic only (`+ - * /` and `Math.sqrt` are exact under IEEE 754).
- Physics runs on a fixed timestep.

---

## Surfaces

The first set. Each surface has physics values and a look. The values are starting points to tune in the physics prototype.

| Surface | Bounce (restitution) | Roll friction | Shot power from lie | Spin from lie | Notes |
|---|---|---|---|---|---|
| Tee | 0.35 | 0.10 | 100% | 100% | Ball is teed up for woods |
| Fairway | 0.35 | 0.12 | 100% | 100% | |
| Fringe | 0.30 | 0.15 | 95% | 80% | Ring around green |
| Green | 0.25 | 0.06 | putter only by default | — | Slope matters most here |
| Rough | 0.20 | 0.35 | 85% | 50% | Adds random spread |
| Sand | 0.05 | 0.90 | 70% | 60% | Ball plugs on steep landing |
| Water | — | — | — | — | Penalty stroke, drop at entry point |

Out of bounds is a hole boundary, not a surface: penalty stroke and replay from the previous spot.

---

## Ball physics

- **Ball:** 45.93 g, 42.67 mm diameter.
- **Flight:** gravity, aerodynamic drag, and lift from spin (Magnus effect). Side spin curves the ball. Wind comes later.
- **Impact:** split velocity into normal and tangential parts. Normal part is scaled by the surface's restitution. Tangential part loses speed to friction, and backspin can stop or pull the ball back on soft surfaces.
- **Roll:** rolling resistance from the surface, plus gravity along the slope. The ball stops below a speed threshold on a gentle enough slope.
- **Timestep:** fixed, 1/240 s.

## Clubs

Each club has a loft, a maximum carry and a base spin. Starting set:

Driver, 3-wood, 5-iron, 7-iron, 9-iron, pitching wedge, sand wedge, putter.

## Swing (kept simple on purpose)

- **Before the shot:** pick a club, aim, and set a spin dot on the ball (top/back spin and side spin).
- **Swing:** a 3-click meter. Click to start, click to set power, click to set accuracy. A miss on accuracy adds hook or slice.
- **Putting:** power only, with a slope grid shown on the green.

---

## Overview sign

The stylized top-down map shown at the tee, like the sign at a real hole.

- Drawn in 2D from the hole data: surface colors, shading from elevation (hillshade), trees and hazards as simple icons.
- Shows the hole number, par, and distance from each tee to the pin.
- **The same renderer draws the editor's main view.** The editor is effectively "editing the sign", so what you design is what players see.

## Editor

**Layout:** a 2D top-down view (the sign renderer) for editing, plus a 3D preview you can orbit or fly through. A **Playtest** button drops you onto the tee.

**Tools, first version:**
- Place tees and pins.
- Draw the fairway route: a path with control points and a width at each point.
- Draw shapes (green, bunker, water, fairway sections) as curved outlines with soft edges.
- Paint surfaces with a brush.
- Sculpt terrain: raise, lower, smooth, flatten.
- Procedural settings and a **Reroll** button for the seed.

**Behavior:**
- Every edit is a command on an undo/redo stack.
- Autosave to browser storage.
- Validation warnings: pin not on a green, tee too close to hazards, suggested par from length.

## Sharing

- A hole encodes to a share code: JSON, then deflate compression, then base64url, with a version prefix (for example `GH1.`).
- The code fits in a URL fragment (`#hole=GH1....`), so a link opens the hole directly.
- Full details are in [HOLE_FORMAT.md](HOLE_FORMAT.md).
