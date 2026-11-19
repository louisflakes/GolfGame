import { describe, expect, it } from "vitest";
import { exampleHole } from "./examples";
import type { Hole } from "./types";
import { parseHole, suggestPar } from "./validate";

function withChange(change: (h: Hole) => void): Hole {
  const h = exampleHole();
  change(h);
  return h;
}

const errorPaths = (input: unknown) => parseHole(input).errors.map((e) => e.path);

describe("parseHole", () => {
  it("accepts the example hole with no errors or warnings", () => {
    const result = parseHole(exampleHole());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.hole).toEqual(exampleHole());
  });

  it("rejects non-objects and wrong format or version", () => {
    expect(parseHole(null).hole).toBeUndefined();
    expect(parseHole([]).hole).toBeUndefined();
    expect(errorPaths({ ...exampleHole(), format: "other" })).toContain("format");
    expect(errorPaths({ ...exampleHole(), version: 2 })).toContain("version");
  });

  it("drops unknown keys", () => {
    const input = { ...exampleHole(), extra: 1, meta: { ...exampleHole().meta, junk: "x" } };
    const { hole } = parseHole(input);
    expect(hole).toEqual(exampleHole());
  });

  it("reports missing and malformed fields with paths", () => {
    expect(errorPaths(withChange((h) => delete (h as Partial<Hole>).route))).toContain("route");
    expect(errorPaths(withChange((h) => (h.tees[0]!.position = [1] as never)))).toContain("tees[0].position");
    expect(errorPaths(withChange((h) => (h.meta.par = 7 as never)))).toContain("meta.par");
    expect(errorPaths(withChange((h) => (h.shapes[0]!.surface = "lava" as never)))).toContain("shapes[0].surface");
    expect(errorPaths(withChange((h) => (h.procedural.seed = 1.5)))).toContain("procedural.seed");
    expect(errorPaths(withChange((h) => (h.procedural.roughness = NaN)))).toContain("procedural.roughness");
    expect(errorPaths(withChange((h) => (h.shapes[0]!.shaping = { kind: "mystery" } as never)))).toContain(
      "shapes[0].shaping.kind",
    );
  });

  it("requires at least one tee, one pin and two route points", () => {
    expect(errorPaths(withChange((h) => (h.tees = [])))).toContain("tees");
    expect(errorPaths(withChange((h) => (h.pins = [])))).toContain("pins");
    expect(errorPaths(withChange((h) => (h.route.points = h.route.points.slice(0, 1))))).toContain("route.points");
  });

  it("rejects positions outside the bounds", () => {
    expect(errorPaths(withChange((h) => (h.pins[0]!.position = [500, 10])))).toContain("pins[0].position");
    expect(errorPaths(withChange((h) => (h.route.points[1]!.position = [-1, 10])))).toContain(
      "route.points[1].position",
    );
  });

  it("rejects duplicate ids and a missing active pin", () => {
    expect(errorPaths(withChange((h) => (h.shapes[1]!.id = h.shapes[0]!.id)))).toContain("shapes[1].id");
    expect(errorPaths(withChange((h) => (h.activePinId = "nope")))).toContain("activePinId");
  });

  it("rejects text that is too long", () => {
    expect(errorPaths(withChange((h) => (h.meta.name = "x".repeat(61))))).toContain("meta.name");
  });

  it("validates override grids", () => {
    const good = withChange((h) => (h.overrides.height = { cellSize: 1, chunkSize: 32, chunks: [{ cx: 0, cz: 1, data: "AAEC" }] }));
    expect(parseHole(good).errors).toEqual([]);
    const bad = withChange((h) => (h.overrides.height = { cellSize: 1, chunkSize: 32, chunks: [{ cx: 0, cz: 1, data: "<script>" }] }));
    expect(errorPaths(bad)).toContain("overrides.height.chunks[0].data");
  });

  it("warns, without failing, about design problems", () => {
    const offGreen = parseHole(withChange((h) => (h.pins[0]!.position = [60, 100])));
    expect(offGreen.hole).toBeDefined();
    expect(offGreen.warnings.map((w) => w.path)).toContain("pins[0].position");

    const wrongPar = parseHole(withChange((h) => (h.meta.par = 3)));
    expect(wrongPar.hole).toBeDefined();
    expect(wrongPar.warnings.map((w) => w.path)).toContain("meta.par");
  });
});

describe("suggestPar", () => {
  it("follows length bands", () => {
    expect(suggestPar(150)).toBe(3);
    expect(suggestPar(380)).toBe(4);
    expect(suggestPar(500)).toBe(5);
    expect(suggestPar(700)).toBe(6);
  });
});
