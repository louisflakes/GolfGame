import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("produces a fixed sequence for a seed (golden values: changing these breaks every shared hole)", () => {
    const rng = createRng(12345);
    const values = Array.from({ length: 5 }, () => rng.nextUint32());
    expect(values).toMatchInlineSnapshot(`
      [
        3833628664,
        3868810187,
        1830013216,
        2895153340,
        3558647913,
      ]
    `);
  });

  it("repeats for the same seed and differs for nearby seeds", () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const seqA = Array.from({ length: 20 }, () => a.nextUint32());
    expect(Array.from({ length: 20 }, () => b.nextUint32())).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => c.nextUint32())).not.toEqual(seqA);
  });

  it("keeps helpers in range", () => {
    const rng = createRng(99);
    for (let i = 0; i < 10000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(-3, 3);
      expect(Number.isInteger(n) && n >= -3 && n <= 3).toBe(true);
    }
  });
});
