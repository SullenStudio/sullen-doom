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

describe("renderWeapon", () => {
  it("draws the gun in the lower half of the screen", () => {
    const fb = blank();
    renderWeapon(fb, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
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
    renderWeapon(gun, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    renderWeapon(stick, { weapon: "stick", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    expect([...gun.data]).not.toEqual([...stick.data]);
  });

  it("kicks the gun when it has just fired", () => {
    const calm = blank();
    const fired = blank();
    renderWeapon(calm, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    renderWeapon(fired, { weapon: "gun", cooldown: 0.12, swing: 0, swingTime: 0.34 }, OPTS);
    expect([...calm.data]).not.toEqual([...fired.data]);
  });

  it("moves the stick through its swing", () => {
    const start = blank();
    const mid = blank();
    renderWeapon(start, { weapon: "stick", cooldown: 0, swing: 0.34, swingTime: 0.34 }, OPTS);
    renderWeapon(mid, { weapon: "stick", cooldown: 0, swing: 0.17, swingTime: 0.34 }, OPTS);
    expect([...start.data]).not.toEqual([...mid.data]);
  });

  it("stays inside the buffer at any size", () => {
    const small = createFramebuffer(16, 12);
    small.clear(0);
    expect(() =>
      renderWeapon(small, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS),
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
    ]) {
      const fb = createFramebuffer(w, h);
      fb.clear(0);
      // cooldown > 0 draws the muzzle flash too, the widest state the gun
      // ever reaches.
      renderWeapon(fb, { weapon: "gun", cooldown: 0.12, swing: 0, swingTime: 0.34 }, OPTS);
      for (let y = 0; y < h; y++) {
        expect(fb.data[y * w + (w - 1)]).toBe(0);
      }
      for (let x = 0; x < w; x++) {
        expect(fb.data[(h - 1) * w + x]).toBe(0);
      }
    }
  });
});

describe("renderCrosshair", () => {
  it("marks the exact centre of the screen", () => {
    const fb = blank();
    renderCrosshair(fb, shadeTable, PALETTE_SIZE);
    expect(fb.data[(HEIGHT >> 1) * WIDTH + (WIDTH >> 1)]).not.toBe(0);
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
