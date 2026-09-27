import { fbm, makeRng, makeValueNoise } from "../core/rng.js";
import { ACCENT, RAMP, RAMP_SIZE, TRANSPARENT } from "../render/palette.js";

// Every surface in the game is generated here at boot. Nothing is loaded
// from disk: it keeps the build tiny, the startup instant, and the origin of
// every pixel unambiguous.

export const TEX_SIZE = 64;

/**
 * Period at which the noise lattice wraps. Sampling at exactly
 * NOISE_LATTICE / TEX_SIZE puts one whole period across a tile, which is
 * what makes the tile seamless. Every frequency below is an INTEGER multiple
 * of STEP_UV for that reason — a fractional multiplier produces a visible
 * seam down every wall.
 */
export const NOISE_LATTICE = 8;
const STEP_UV = NOISE_LATTICE / TEX_SIZE;

export const TEXTURE_SLOT = {
  brick: 0,
  metal: 1,
  concrete: 2,
  flesh: 3,
  tech: 4,
  floor: 5,
  ceiling: 6,
};

/** Picks a step inside a six-colour ramp from a 0..1 value. */
function step(ramp, t) {
  let s = Math.floor(t * RAMP_SIZE);
  if (s < 0) s = 0;
  if (s > RAMP_SIZE - 1) s = RAMP_SIZE - 1;
  return ramp + s;
}

function blank() {
  return new Uint8Array(TEX_SIZE * TEX_SIZE);
}

function brick(rng, ox = 0, oy = 0) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  // Both periods divide TEX_SIZE, so the courses continue across the seam.
  const BRICK_H = 16;
  const BRICK_W = 32;
  const MORTAR = 2;
  for (let y = 0; y < TEX_SIZE; y++) {
    const gy = y + oy;
    const row = Math.floor(gy / BRICK_H);
    const offset = (row % 2) * (BRICK_W / 2);
    for (let x = 0; x < TEX_SIZE; x++) {
      const gx = x + ox;
      const lx = (gx + offset) % BRICK_W;
      const ly = gy % BRICK_H;
      const grain = fbm(noise, gx * STEP_UV * 2, gy * STEP_UV * 2, 3);
      if (ly < MORTAR || lx < MORTAR) {
        px[y * TEX_SIZE + x] = step(RAMP.concrete, 0.2 + grain * 0.25);
      } else {
        // Darken towards the bottom of each brick so the courses read.
        const shadow = (ly - MORTAR) / (BRICK_H - MORTAR);
        px[y * TEX_SIZE + x] = step(
          RAMP.brick,
          0.75 - shadow * 0.35 + (grain - 0.5) * 0.4,
        );
      }
    }
  }
  return px;
}

function metal(rng, ox = 0, oy = 0) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    const gy = y + oy;
    for (let x = 0; x < TEX_SIZE; x++) {
      const gx = x + ox;
      // Four periods across, one down: stretched noise reads as brushing.
      const brushed = fbm(noise, gx * STEP_UV * 4, gy * STEP_UV, 3);
      const rot = fbm(noise, gx * STEP_UV + 20, gy * STEP_UV + 20, 2);
      const plate = gy % 32 < 2 || gx % 32 < 2 ? -0.25 : 0;
      const ramp = rot > 0.58 ? RAMP.rust : RAMP.concrete;
      px[y * TEX_SIZE + x] = step(ramp, 0.35 + brushed * 0.5 + plate);
    }
  }
  return px;
}

function concrete(rng, ox = 0, oy = 0) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    const gy = y + oy;
    for (let x = 0; x < TEX_SIZE; x++) {
      const gx = x + ox;
      const grain = fbm(noise, gx * STEP_UV * 3, gy * STEP_UV * 3, 4);
      const crack = fbm(noise, gx * STEP_UV + 7, gy * STEP_UV + 7, 2);
      const dark = crack > 0.46 && crack < 0.5 ? -0.3 : 0;
      px[y * TEX_SIZE + x] = step(RAMP.concrete, 0.3 + grain * 0.5 + dark);
    }
  }
  return px;
}

function flesh(rng, ox = 0, oy = 0) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    const gy = y + oy;
    for (let x = 0; x < TEX_SIZE; x++) {
      const gx = x + ox;
      const lumpy = fbm(noise, gx * STEP_UV, gy * STEP_UV, 3);
      const veins = fbm(noise, gx * STEP_UV * 2 + 11, gy * STEP_UV * 2 + 11, 2);
      const vein = veins > 0.62 ? 0.3 : 0;
      px[y * TEX_SIZE + x] = step(RAMP.flesh, 0.25 + lumpy * 0.55 + vein);
    }
  }
  return px;
}

function tech(rng, ox = 0, oy = 0) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    const gy = y + oy;
    for (let x = 0; x < TEX_SIZE; x++) {
      const gx = x + ox;
      const grain = fbm(noise, gx * STEP_UV * 4, gy * STEP_UV * 4, 2);
      const inPanel = gx % 16 > 1 && gy % 16 > 1;
      if (!inPanel) {
        px[y * TEX_SIZE + x] = step(RAMP.tech, 0.15 + grain * 0.2);
      } else if (gx % 16 === 8 && gy % 16 > 4 && gy % 16 < 12) {
        // A lit strip on each panel gives the corridor something to glint.
        px[y * TEX_SIZE + x] = ACCENT.plasma;
      } else {
        px[y * TEX_SIZE + x] = step(RAMP.tech, 0.45 + grain * 0.4);
      }
    }
  }
  return px;
}

function floorTile(rng, ox = 0, oy = 0) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    const gy = y + oy;
    for (let x = 0; x < TEX_SIZE; x++) {
      const gx = x + ox;
      const grain = fbm(noise, gx * STEP_UV * 2, gy * STEP_UV * 2, 4);
      const grout = gx % 16 < 1 || gy % 16 < 1 ? -0.3 : 0;
      px[y * TEX_SIZE + x] = step(RAMP.concrete, 0.22 + grain * 0.45 + grout);
    }
  }
  return px;
}

function ceilingTile(rng, ox = 0, oy = 0) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    const gy = y + oy;
    for (let x = 0; x < TEX_SIZE; x++) {
      const gx = x + ox;
      const grain = fbm(noise, gx * STEP_UV * 2, gy * STEP_UV * 2, 3);
      px[y * TEX_SIZE + x] = step(RAMP.rust, 0.12 + grain * 0.3);
    }
  }
  return px;
}

export function generateTextures(seed = 1337) {
  // Each generator gets its own stream so adding one later does not reshuffle
  // the others.
  const builders = [brick, metal, concrete, flesh, tech, floorTile, ceilingTile];
  return builders.map((build, i) => ({
    size: TEX_SIZE,
    pixels: build(makeRng(seed + i * 7919)),
  }));
}

/**
 * Generate a tile at a specific origin, for testing periodicity.
 * The tile at (ox, oy) should be pixel-identical to the tile at (ox + TEX_SIZE, oy)
 * and at (ox, oy + TEX_SIZE) if the texture is seamless.
 */
export function generateTileAt(slot, seed = 1337, ox = 0, oy = 0) {
  const builders = [brick, metal, concrete, flesh, tech, floorTile, ceilingTile];
  if (slot < 0 || slot >= builders.length) {
    throw new Error(`Invalid texture slot: ${slot}`);
  }
  return {
    size: TEX_SIZE,
    pixels: builders[slot](makeRng(seed + slot * 7919), ox, oy),
  };
}

const SPRITE_W = 32;
const SPRITE_H = 48;

/**
 * Placeholder enemy until phase 3 brings the real constructive generator.
 * A shaded blob with eyes: crude, but it proves the sprite pipeline and it
 * already shades and depth-sorts like the real thing will.
 */
export function makeEnemySprite(seed = 7) {
  const rng = makeRng(seed);
  // A sprite never tiles, so its noise frequency is unconstrained.
  const noise = makeValueNoise(rng, 16);
  const px = new Uint8Array(SPRITE_W * SPRITE_H).fill(TRANSPARENT);
  const cx = SPRITE_W / 2;
  for (let y = 0; y < SPRITE_H; y++) {
    // Narrow at the head, widest at the belly, tapering to the feet.
    const t = y / (SPRITE_H - 1);
    const width = SPRITE_W * (0.22 + 0.26 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    for (let x = 0; x < SPRITE_W; x++) {
      const dx = (x - cx) / width;
      if (Math.abs(dx) > 1) continue;
      const round = Math.sqrt(1 - dx * dx);
      const grain = fbm(noise, x * 0.3, y * 0.3, 2);
      px[y * SPRITE_W + x] = step(RAMP.flesh, 0.2 + round * 0.5 + grain * 0.25);
    }
  }
  // Eyes.
  const eyeY = Math.floor(SPRITE_H * 0.2);
  for (const ex of [cx - 4, cx + 3]) {
    for (let y = eyeY; y < eyeY + 3; y++) {
      for (let x = Math.floor(ex); x < Math.floor(ex) + 2; x++) {
        px[y * SPRITE_W + x] = ACCENT.goldLight;
      }
    }
  }
  return { width: SPRITE_W, height: SPRITE_H, pixels: px };
}
