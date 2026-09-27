// The renderer writes packed 32-bit pixels straight into the buffer that
// backs an ImageData. Byte order there is R,G,B,A, so on a little-endian
// machine the correct packing is 0xAABBGGRR. Every platform this ships to
// is little-endian; if that ever stops being true, this is the one place
// that has to change.

export const SHADE_LEVELS = 32;
export const RAMP_SIZE = 6;

/** Palette index reserved to mean "draw nothing here". */
export const TRANSPARENT = 255;

export function rgb(r, g, b) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Six-step ramps, dark to light. Textures pick a ramp and a step; the
// shade table then supplies the lighting.
const BASE = [
  // concrete
  [58, 56, 54], [74, 71, 68], [92, 88, 84],
  [110, 105, 99], [128, 122, 115], [146, 140, 132],
  // brick
  [58, 26, 20], [78, 34, 26], [98, 44, 32],
  [120, 56, 40], [142, 70, 50], [164, 88, 64],
  // rust
  [64, 34, 14], [88, 48, 18], [112, 64, 24],
  [136, 84, 32], [158, 104, 44], [180, 128, 60],
  // flesh
  [72, 26, 30], [98, 38, 42], [124, 52, 56],
  [150, 70, 72], [176, 94, 94], [200, 124, 120],
  // tech
  [22, 38, 42], [30, 54, 60], [40, 72, 80],
  [52, 92, 100], [66, 114, 122], [84, 138, 146],
  // bone
  [86, 80, 66], [112, 105, 88], [138, 130, 110],
  [164, 156, 134], [192, 184, 160], [220, 212, 190],
  // signal colours, not a ramp: see ACCENT below
  [120, 10, 8], [168, 20, 14], [214, 168, 40],
  [250, 214, 90], [96, 190, 224], [180, 240, 255],
];

/** Start index of each six-step shading ramp, ordered dark to light. */
export const RAMP = {
  concrete: 0,
  brick: 6,
  rust: 12,
  flesh: 18,
  tech: 24,
  bone: 30,
};

/**
 * Signal colours. These are deliberately not a ramp: plasma is not "a
 * lighter gold", and pretending otherwise would let a texture generator ask
 * for a brighter step and get a different hue instead.
 */
export const ACCENT = {
  bloodDark: 36,
  blood: 37,
  gold: 38,
  goldLight: 39,
  plasma: 40,
  plasmaLight: 41,
};

export const PALETTE = new Uint32Array(BASE.map(([r, g, b]) => rgb(r, g, b)));
export const PALETTE_SIZE = PALETTE.length;

/**
 * Precomputes every colour at every light level once, so shading a pixel at
 * runtime is an array read instead of three multiplications.
 */
export function buildShadeTable(palette, levels = SHADE_LEVELS) {
  const table = new Uint32Array(palette.length * levels);
  for (let level = 0; level < levels; level++) {
    const factor = level / (levels - 1);
    const row = level * palette.length;
    for (let i = 0; i < palette.length; i++) {
      const c = palette[i];
      table[row + i] = rgb(
        Math.round((c & 255) * factor),
        Math.round(((c >> 8) & 255) * factor),
        Math.round(((c >> 16) & 255) * factor),
      );
    }
  }
  return table;
}

const FALLOFF = 0.16;
const SIDE_DIM = 0.78;

/**
 * Light level for a surface `dist` away. `side` of 1 marks a wall face
 * perpendicular to the other axis and gets dimmed, which is what makes
 * corners legible. `boost` is additive light from muzzle flashes.
 */
function lightFalloff(dist, side = 0, boost = 0) {
  const base = 1 / (1 + Math.max(0, dist) * FALLOFF);
  return base * (side ? SIDE_DIM : 1) + boost;
}

export function lightLevel(dist, side = 0, boost = 0) {
  const t = lightFalloff(dist, side, boost);
  const level = Math.round(t * (SHADE_LEVELS - 1));
  if (level < 0) return 0;
  if (level > SHADE_LEVELS - 1) return SHADE_LEVELS - 1;
  return level;
}
