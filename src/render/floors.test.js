import { describe, expect, it } from "vitest";
import { TEXTURE_SLOT, generateTextures } from "../assets/textures.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderFloorCeiling } from "./floors.js";

const FOV = Math.PI / 3;
const textures = generateTextures(1);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const WIDTH = 64;
const HEIGHT = 40;

function render(camera) {
  const fb = createFramebuffer(WIDTH, HEIGHT);
  fb.clear(0);
  renderFloorCeiling(
    fb,
    camera,
    textures[TEXTURE_SLOT.floor],
    textures[TEXTURE_SLOT.ceiling],
    {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      lightBoost: 0,
      horizon: HEIGHT >> 1,
    },
  );
  return fb;
}

const luma = (p) => (p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255);

// A single pixel's brightness also depends on which texel it landed on, so
// comparisons average a whole row. That isolates the lighting from the
// texture detail and keeps the test from flapping on a seed change.
const rowLuma = (fb, y) => {
  let sum = 0;
  for (let x = 0; x < WIDTH; x++) sum += luma(fb.data[y * WIDTH + x]);
  return sum / WIDTH;
};

// Warmth separates the two surfaces: the floor is grey concrete, the ceiling
// is rust, which carries far more red than blue.
const warmth = (fb, y) => {
  let sum = 0;
  for (let x = 0; x < WIDTH; x++) {
    const p = fb.data[y * WIDTH + x];
    sum += (p & 255) - ((p >> 16) & 255);
  }
  return sum / WIDTH;
};

describe("renderFloorCeiling", () => {
  it("leaves no row of the buffer untouched", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    for (let y = 0; y < HEIGHT; y++) {
      expect(fb.data[y * WIDTH + (WIDTH >> 1)]).not.toBe(0);
    }
  });

  it("brightens towards the bottom of the screen, which is nearest", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    expect(rowLuma(fb, HEIGHT - 1)).toBeGreaterThan(
      rowLuma(fb, (HEIGHT >> 1) + 2),
    );
  });

  it("draws the ceiling with a different surface than the floor", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    const floorRow = (HEIGHT >> 1) + 6;
    const ceilingRow = HEIGHT - floorRow - 1;
    expect(warmth(fb, ceilingRow)).toBeGreaterThan(warmth(fb, floorRow));
  });

  it("changes what it draws when the camera moves", () => {
    const a = render(makeCamera(2.5, 2.5, 0, FOV));
    const b = render(makeCamera(2.9, 2.5, 0, FOV));
    expect([...a.data]).not.toEqual([...b.data]);
  });

  it("does not throw at negative world coordinates", () => {
    expect(() => render(makeCamera(-3.25, -1.75, 2.1, FOV))).not.toThrow();
  });

  it("never divides by zero on the horizon row", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    for (const pixel of fb.data) {
      expect(Number.isFinite(pixel)).toBe(true);
    }
  });

  it("mirrors the ceiling about a shifted horizon, not the buffer centre", () => {
    // With the horizon pushed off centre, the ceiling must follow it. The
    // two are indistinguishable while the horizon sits at height / 2, so
    // this is the only arrangement that can catch the difference.
    const shifted = (HEIGHT >> 1) - 8;
    const fb = createFramebuffer(WIDTH, HEIGHT);
    fb.clear(0);
    renderFloorCeiling(
      fb,
      makeCamera(2.5, 2.5, 0, FOV),
      textures[TEXTURE_SLOT.floor],
      textures[TEXTURE_SLOT.ceiling],
      { shadeTable, paletteSize: PALETTE_SIZE, lightBoost: 0, horizon: shifted },
    );
    // One row below the horizon is floor; its mirror one row above is
    // ceiling. Warmth separates them: the ceiling is rust, the floor grey.
    const warmthAt = (y) => {
      let sum = 0;
      for (let x = 0; x < WIDTH; x++) {
        const p = fb.data[y * WIDTH + x];
        sum += (p & 255) - ((p >> 16) & 255);
      }
      return sum / WIDTH;
    };
    // A plain "ceiling side is warmer than floor side" comparison is not
    // enough to catch a mirror bug here: mirroring about the buffer centre
    // instead of the horizon still paints the floor row with *some*
    // ceiling-textured content (just sampled at the wrong distance), and
    // that miscoloured floor row is still warmer than nothing — only a
    // little cooler than the genuine ceiling row next to it, because both
    // are rust. The comparison survives on that thin margin even when the
    // mirror is wrong. Pinning each side to an absolute threshold instead
    // — measured against genuine floor/ceiling rows far from the horizon —
    // actually fails when the floor row comes back rust-warm instead of
    // concrete-cool.
    expect(warmthAt(shifted - 6)).toBeGreaterThan(30);
    expect(warmthAt(shifted + 6)).toBeLessThan(15);
  });
});
