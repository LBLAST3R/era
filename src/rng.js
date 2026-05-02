/** Deterministic RNG (mulberry32) for reproducible organisms. */
export function hashSeed(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seedString) {
  const rng = mulberry32(hashSeed(seedString));
  return {
    rng,
    rand(min, max) {
      return rng() * (max - min) + min;
    },
    randInt(min, maxExclusive) {
      return Math.floor(rng() * (maxExclusive - min)) + min;
    }
  };
}
