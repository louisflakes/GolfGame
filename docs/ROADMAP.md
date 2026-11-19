# Roadmap

Each phase ends with something playable, published as a claude.ai artifact so it can be tried from a link.

## Phase 0: Setup
- Vite + TypeScript + Three.js project, Vitest, a Playwright screenshot check.
- Hole format types, validation, and share-code encode/decode with tests.

**Done when:** an example hole round-trips through a share code with identical output.

## Phase 1: Prototypes
Throwaway experiments to answer the risky questions.

1. **Terrain:** generate and render a hole from its data. Is it both hilly and easy to read, with clear surfaces?
2. **Ball physics:** flight, bounce and roll on each surface. Does it feel right?
3. **Editor interaction:** draw shapes and the route on the 2D sign view. Is it pleasant to use?

**Done when:** each question has a yes, or we know what to change.

## Phase 2: Vertical slice
One complete loop, with rough art:

- **Edit:** place tee and pin, draw the route and shapes, set procedural settings, reroll.
- **Sign:** the overview sign is generated automatically.
- **Play:** in third person with a placeholder character, 8 clubs, the 3-click swing and the spin dot, through to holing out.
- **Share:** export a share code or link, and import it.

**Done when:** you can design a hole, send a link, and someone else can play it.

## Phase 3: Editor v2
- Sculpt brushes and surface painting.
- Richer procedural controls, and templates such as "par 4 dogleg left" as starting points.
- Trees and simple props.
- Validation warnings and par suggestion.

## Phase 4: Courses
- Chain holes into a course with a scorecard.
- Course-level layout planning: holes placed together on one piece of land.

## Later (only if it's fun)
- Hosted gallery and backend, probably Cloudflare.
- Deeper swing mechanics and wind.
- Player customization.
- Many more terrain types and features.
