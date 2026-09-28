import { describe, expect, it } from "vitest";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable, rgb } from "./palette.js";
import { renderCrosshair, renderFlash, renderWeapon } from "./weaponview.js";

const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const WIDTH = 96;
const HEIGHT = 60;
const OPTS = { shadeTable, paletteSize: PALETTE_SIZE };

function blank() {
  const fb = createFramebuffer(WIDTH, HEIGHT);
  fb.clear(0);
  return fb;
}

const painted = (fb) => [...fb.data].filter((p) => p !== 0).length;

/** Smallest axis-aligned box containing every painted pixel. */
function boundingBox(fb) {
  const { width, height, data } = fb;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

/**
 * True if every painted pixel is reachable from every other painted pixel
 * via 4-connected neighbours — i.e. the shape is one silhouette, not
 * several disconnected islands.
 */
function isSingleConnectedRegion(fb) {
  const { width, height, data } = fb;
  let start = -1;
  let totalPainted = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== 0) {
      totalPainted++;
      if (start === -1) start = i;
    }
  }
  if (totalPainted === 0) return false;

  const visited = new Uint8Array(width * height);
  const stack = [start];
  visited[start] = 1;
  let reached = 0;
  while (stack.length > 0) {
    const i = stack.pop();
    reached++;
    const x = i % width;
    const y = (i / width) | 0;
    const neighbours = [];
    if (x > 0) neighbours.push(i - 1);
    if (x < width - 1) neighbours.push(i + 1);
    if (y > 0) neighbours.push(i - width);
    if (y < height - 1) neighbours.push(i + width);
    for (const n of neighbours) {
      if (data[n] !== 0 && !visited[n]) {
        visited[n] = 1;
        stack.push(n);
      }
    }
  }
  return reached === totalPainted;
}

// resize() in main.js clamps the internal buffer height to [120, 720]; the
// weapon geometry must hold at both ends of that range, not just the sizes
// that happened to be spot-checked during development.
const CLAMP_EXTREME_SIZES = [
  [480, 120],
  [480, 720],
];

describe("renderWeapon", () => {
  it("draws the gun in the lower half of the screen", () => {
    const fb = blank();
    renderWeapon(fb, { weapon: "pistol", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    let topHalf = 0;
    for (let y = 0; y < HEIGHT >> 1; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (fb.data[y * WIDTH + x] !== 0) topHalf++;
      }
    }
    expect(painted(fb)).toBeGreaterThan(0);
    expect(topHalf).toBe(0);
  });

  it("draws the stick differently from the gun", () => {
    const gun = blank();
    const stick = blank();
    renderWeapon(gun, { weapon: "pistol", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    renderWeapon(stick, { weapon: "pipe", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    expect([...gun.data]).not.toEqual([...stick.data]);
  });

  it("kicks the gun when it has just fired", () => {
    const calm = blank();
    const fired = blank();
    renderWeapon(calm, { weapon: "pistol", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    renderWeapon(fired, { weapon: "pistol", cooldown: 0.12, swing: 0, swingTime: 0.34 }, OPTS);
    expect([...calm.data]).not.toEqual([...fired.data]);
  });

  it("moves the stick through its swing", () => {
    const start = blank();
    const mid = blank();
    renderWeapon(start, { weapon: "pipe", cooldown: 0, swing: 0.34, swingTime: 0.34 }, OPTS);
    renderWeapon(mid, { weapon: "pipe", cooldown: 0, swing: 0.17, swingTime: 0.34 }, OPTS);
    expect([...start.data]).not.toEqual([...mid.data]);
  });

  it("stays inside the buffer at any size", () => {
    const small = createFramebuffer(16, 12);
    small.clear(0);
    expect(() =>
      renderWeapon(small, { weapon: "pistol", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS),
    ).not.toThrow();
  });

  // The internal buffer is always 480 wide but its height varies with the
  // window's aspect ratio (see resize() in main.js): 480x270 on 16:9,
  // 480x300 on 16:10, and much taller on a narrow window. A layout that
  // mixes width-scaled and height-scaled offsets can fit at one size and
  // clip clean off the edge at another, which is exactly what happened
  // before this test existed: the muzzle flash was drawn past the right
  // edge of the buffer at 480x300 and was entirely invisible.
  it("keeps a margin from the right and bottom edges at several buffer sizes", () => {
    for (const [w, h] of [
      [480, 270],
      [480, 300],
      [480, 600],
      [96, 60],
      ...CLAMP_EXTREME_SIZES,
    ]) {
      const fb = createFramebuffer(w, h);
      fb.clear(0);
      // cooldown > 0 draws the muzzle flash too, the widest state the gun
      // ever reaches.
      renderWeapon(fb, { weapon: "pistol", cooldown: 0.12, swing: 0, swingTime: 0.34 }, OPTS);
      for (let y = 0; y < h; y++) {
        expect(fb.data[y * w + (w - 1)]).toBe(0);
      }
      for (let x = 0; x < w; x++) {
        expect(fb.data[(h - 1) * w + x]).toBe(0);
      }
    }
  });

  // Nothing above checks the *shape* of the gun, only that it stays clear of
  // the edges. That leaves room for it to shrink to a sliver, or for its
  // parts to drift apart into disconnected floating rectangles, without
  // failing anything — which is most of what went wrong the first time this
  // geometry was written. These two tests pin the shape down directly, at
  // the resize() clamp extremes.
  it("spans roughly a quarter to a third of the buffer width at its widest (recoil + flash)", () => {
    for (const [w, h] of CLAMP_EXTREME_SIZES) {
      const fb = createFramebuffer(w, h);
      fb.clear(0);
      renderWeapon(fb, { weapon: "pistol", cooldown: 0.12, swing: 0, swingTime: 0.34 }, OPTS);
      const { minX, maxX } = boundingBox(fb);
      const widthFrac = (maxX - minX + 1) / w;
      // Design target is ~0.28-0.29; the band is wide enough to survive
      // ordinary art tweaks but would catch the gun being halved in size
      // (~0.15) or blown out well past a third (~0.4+).
      expect(widthFrac).toBeGreaterThan(0.2);
      expect(widthFrac).toBeLessThan(0.35);
    }
  });

  it("draws the gun as a single connected silhouette at its widest (recoil + flash)", () => {
    for (const [w, h] of CLAMP_EXTREME_SIZES) {
      const fb = createFramebuffer(w, h);
      fb.clear(0);
      renderWeapon(fb, { weapon: "pistol", cooldown: 0.12, swing: 0, swingTime: 0.34 }, OPTS);
      expect(isSingleConnectedRegion(fb)).toBe(true);
    }
  });
});

describe("renderCrosshair", () => {
  it("marks the exact centre of the screen", () => {
    const fb = blank();
    renderCrosshair(fb, shadeTable, PALETTE_SIZE);
    expect(fb.data[(HEIGHT >> 1) * WIDTH + (WIDTH >> 1)]).not.toBe(0);
  });

  it("looks different once a hit lands", () => {
    const calm = blank();
    const struck = blank();
    renderCrosshair(calm, shadeTable, PALETTE_SIZE, 0);
    renderCrosshair(struck, shadeTable, PALETTE_SIZE, 1);
    expect([...calm.data]).not.toEqual([...struck.data]);
  });

  it("paints more of the screen when marking a hit", () => {
    const calm = blank();
    const struck = blank();
    renderCrosshair(calm, shadeTable, PALETTE_SIZE, 0);
    renderCrosshair(struck, shadeTable, PALETTE_SIZE, 1);
    const lit = (fb) => [...fb.data].filter((p) => p !== 0).length;
    expect(lit(struck)).toBeGreaterThan(lit(calm));
  });

  it("stays inside the buffer while marking a hit", () => {
    const fb = createFramebuffer(24, 16);
    fb.clear(0);
    expect(() => renderCrosshair(fb, shadeTable, PALETTE_SIZE, 1)).not.toThrow();
  });

  it("defaults to the calm crosshair when no mark is given", () => {
    const implicit = blank();
    const explicit = blank();
    renderCrosshair(implicit, shadeTable, PALETTE_SIZE);
    renderCrosshair(explicit, shadeTable, PALETTE_SIZE, 0);
    expect([...implicit.data]).toEqual([...explicit.data]);
  });
});

describe("renderFlash", () => {
  it("does nothing at zero strength", () => {
    const fb = blank();
    renderFlash(fb, rgb(255, 0, 0), 0);
    expect(painted(fb)).toBe(0);
  });

  it("tints the whole screen at full strength", () => {
    const fb = blank();
    renderFlash(fb, rgb(255, 0, 0), 1);
    expect(painted(fb)).toBe(WIDTH * HEIGHT);
  });

  it("blends partially in between", () => {
    const half = blank();
    const full = blank();
    renderFlash(half, rgb(255, 0, 0), 0.5);
    renderFlash(full, rgb(255, 0, 0), 1);
    expect(half.data[0]).not.toBe(full.data[0]);
    expect(half.data[0]).not.toBe(0);
  });

  it("clamps strengths outside [0, 1]", () => {
    const fb = blank();
    expect(() => renderFlash(fb, rgb(255, 0, 0), 5)).not.toThrow();
    expect(() => renderFlash(fb, rgb(255, 0, 0), -5)).not.toThrow();
  });
});
