import { describe, expect, it } from "vitest";
import { base64urlToBytes, bytesToBase64url } from "./base64url";
import { createRng } from "./rng";

describe("base64url", () => {
  it("matches Node's encoder and round-trips for every length up to 64", () => {
    const rng = createRng(1);
    for (let len = 0; len <= 64; len++) {
      const bytes = Uint8Array.from({ length: len }, () => rng.int(0, 255));
      const encoded = bytesToBase64url(bytes);
      expect(encoded).toBe(Buffer.from(bytes).toString("base64url"));
      expect(base64urlToBytes(encoded)).toEqual(bytes);
    }
  });

  it("rejects invalid characters and lengths", () => {
    expect(() => base64urlToBytes("ab+c")).toThrow();
    expect(() => base64urlToBytes("abcde")).toThrow();
    expect(() => base64urlToBytes("abéc")).toThrow();
  });
});
