# Golf Game

A browser golf game about designing your own holes, sharing them, and playing them in third person.

- [Design](docs/DESIGN.md)
- [Hole format](docs/HOLE_FORMAT.md)
- [Roadmap](docs/ROADMAP.md)

## Development

Requires Node 22+.

```sh
npm install
npm run dev               # local dev server
npm test                  # unit tests (Vitest)
npm run typecheck
npm run build             # type-check and build static site to dist/
npm run check:screenshot  # build, open in headless Chromium, fail on errors, save screenshots/
```

## Layout

```
src/core/     hole format types, validation, canonical JSON, share codes, seeded RNG, example hole
src/render/   Three.js rendering (currently a flat top-down placeholder view)
src/main.ts   viewer page: shows a hole, its checks and its share code; opens #hole= links
scripts/      screenshot smoke test
```
