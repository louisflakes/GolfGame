// Share codes: "GH1." + base64url(deflate-raw(canonical JSON)). See docs/HOLE_FORMAT.md.

import { base64urlToBytes, bytesToBase64url } from "./base64url";
import { canonicalJson } from "./canonical";
import type { Hole } from "./types";
import { parseHole, type Issue } from "./validate";

export const SHARE_PREFIX = "GH1.";
/** Longest share code we accept, in characters. */
export const MAX_CODE_LENGTH = 500_000;
/** Largest decompressed hole we accept, in bytes. Guards against compression bombs. */
export const MAX_JSON_BYTES = 4_000_000;

export type DecodeResult =
  | { ok: true; hole: Hole; warnings: Issue[] }
  | { ok: false; error: string; issues?: Issue[] };

export async function encodeHole(hole: Hole): Promise<string> {
  const json = canonicalJson(hole);
  const compressed = await transform(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return SHARE_PREFIX + bytesToBase64url(compressed);
}

export async function decodeHole(input: string): Promise<DecodeResult> {
  const code = extractShareCode(input);
  if (!code) return { ok: false, error: "No share code found" };
  if (code.length > MAX_CODE_LENGTH) return { ok: false, error: "Share code is too long" };

  let json: string;
  try {
    const bytes = base64urlToBytes(code.slice(SHARE_PREFIX.length));
    const inflated = await transform(bytes, new DecompressionStream("deflate-raw"), MAX_JSON_BYTES);
    json = new TextDecoder("utf-8", { fatal: true }).decode(inflated);
  } catch (e) {
    return { ok: false, error: `Share code is damaged (${(e as Error).message})` };
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "Share code does not contain valid hole data" };
  }

  const result = parseHole(data);
  if (!result.hole) return { ok: false, error: "Hole data is invalid", issues: result.errors };
  return { ok: true, hole: result.hole, warnings: result.warnings };
}

/** Finds a share code in raw text, a URL, or a URL fragment like "#hole=GH1.xxx". */
export function extractShareCode(input: string): string | undefined {
  const match = /GH1\.[A-Za-z0-9_-]*/.exec(input);
  return match?.[0];
}

export function shareUrl(code: string, base: string): string {
  const url = new URL(base);
  url.hash = `hole=${code}`;
  return url.toString();
}

async function transform(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  maxBytes = Infinity,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const done = writer.write(input as Uint8Array<ArrayBuffer>).then(() => writer.close());
  done.catch(() => {}); // errors surface through the reader below

  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("data too large");
    }
    parts.push(value);
  }
  await done;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
