import { describe, expect, it } from "vitest";
import { bytesToBase64url } from "./base64url";
import { canonicalize } from "./canonical";
import { exampleHole } from "./examples";
import { decodeHole, encodeHole, extractShareCode, MAX_JSON_BYTES, SHARE_PREFIX, shareUrl } from "./shareCode";

async function deflate(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return SHARE_PREFIX + bytesToBase64url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

describe("share codes", () => {
  it("round-trips the example hole", async () => {
    const code = await encodeHole(exampleHole());
    expect(code.startsWith(SHARE_PREFIX)).toBe(true);
    const result = await decodeHole(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hole).toEqual(canonicalize(exampleHole()));
    expect(result.warnings).toEqual([]);
    expect(await encodeHole(result.hole)).toBe(code);
  });

  it("gives the same code regardless of key order", async () => {
    const hole = exampleHole();
    const reordered = Object.fromEntries(Object.entries(hole).reverse()) as typeof hole;
    expect(await encodeHole(reordered)).toBe(await encodeHole(hole));
  });

  it("keeps a simple hole's code short enough for a URL", async () => {
    const code = await encodeHole(exampleHole());
    expect(code.length).toBeLessThan(2048);
  });

  it("finds codes inside URLs and pasted text", async () => {
    const code = await encodeHole(exampleHole());
    const url = shareUrl(code, "https://example.com/play");
    expect(url).toBe(`https://example.com/play#hole=${code}`);
    expect(extractShareCode(url)).toBe(code);
    expect(extractShareCode(`  check this out: ${code}\n`)).toBe(code);
    const result = await decodeHole(url);
    expect(result.ok).toBe(true);
  });

  it("fails cleanly on bad input", async () => {
    const cases = ["", "hello", "GH1.", "GH1.!!!!", "GH1.abcde", await deflate("not json"), await deflate('{"format":"golfhole"}')];
    for (const input of cases) {
      const result = await decodeHole(input);
      expect(result.ok, input).toBe(false);
    }
  });

  it("reports validation issues for invalid hole data", async () => {
    const result = await decodeHole(await deflate(JSON.stringify({ ...exampleHole(), tees: [] })));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues?.map((i) => i.path)).toContain("tees");
  });

  it("rejects data that inflates past the size limit", async () => {
    const bomb = await deflate(" ".repeat(MAX_JSON_BYTES + 1));
    expect(bomb.length).toBeLessThan(20_000);
    const result = await decodeHole(bomb);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/too large/);
  });
});
