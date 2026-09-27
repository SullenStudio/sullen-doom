// Deterministic pseudo-randomness for procedural assets. Every generated
// texture and sprite must be reproducible from a seed, so nothing here may
// call Math.random.

/** mulberry32: small, fast, good enough for art generation. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * Value noise on a `size` x `size` lattice. Wrapping the lattice makes the
 * result tileable with period `size`, which is what lets a 64x64 texture
 * repeat across a wall without a visible seam.
 */
export function makeValueNoise(rng, size = 64) {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();

  const at = (cx, cy) => {
    const x = ((cx % size) + size) % size;
    const y = ((cy % size) + size) % size;
    return grid[y * size + x];
  };

  return function noise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smoothstep(x - x0);
    const fy = smoothstep(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  };
}

/** Stacked octaves. Gives texture detail at more than one scale. */
export function fbm(noise, x, y, octaves = 4) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}
