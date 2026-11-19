// Seeded PRNG (sfc32). Arithmetic only, so it gives identical sequences in every JS engine.
// All randomness in core/ and physics/ must come from here, never Math.random().

export interface Rng {
  /** Next unsigned 32-bit integer. */
  nextUint32(): number;
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
}

export function createRng(seed: number): Rng {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;

  const nextUint32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };

  // Warm up so nearby seeds diverge.
  for (let i = 0; i < 15; i++) nextUint32();

  const next = () => nextUint32() / 4294967296;
  return {
    nextUint32,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}
