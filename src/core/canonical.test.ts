import { describe, expect, it } from "vitest";
import { canonicalJson } from "./canonical";

describe("canonicalJson", () => {
  it("sorts keys at every level", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } })).toBe('{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}');
  });

  it("rounds numbers to 0.01 and normalizes -0", () => {
    expect(canonicalJson([1.234, 1.235, -0.001, -0, 2 ** 32 - 1])).toBe("[1.23,1.24,0,0,4294967295]");
  });

  it("drops undefined values", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("is idempotent", () => {
    const once = canonicalJson({ x: [0.1 + 0.2, 1 / 3, 123.456789] });
    expect(canonicalJson(JSON.parse(once))).toBe(once);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ a: NaN })).toThrow();
    expect(() => canonicalJson({ a: Infinity })).toThrow();
  });
});
