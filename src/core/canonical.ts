// Canonical JSON: sorted keys, numbers rounded to 0.01, -0 as 0, undefined dropped.
// The same hole always serializes to the same string, so it always gets the same share code.

export const NUMBER_PRECISION = 100;

export function roundNumber(v: number): number {
  const r = Math.round(v * NUMBER_PRECISION) / NUMBER_PRECISION;
  return r === 0 ? 0 : r;
}

export function canonicalize(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot canonicalize a non-finite number");
    return roundNumber(value);
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
