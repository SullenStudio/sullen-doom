import { describe, expect, it } from "vitest";
import { TRANSPARENT, rgb } from "./palette.js";
import { bitmapFromRows, blitIndexed, blitRgba } from "./blit.js";
import { createFramebuffer } from "./framebuffer.js";

describe("bitmapFromRows", () => {
  it("stores legend colours and skips dots", () => {
    const bmp = bitmapFromRows([".A.", "AAA"], { A: 3 });
    expect(bmp.width).toBe(3);
    expect(bmp.height).toBe(2);
    expect(bmp.pixels[0]).toBe(TRANSPARENT);
    expect(bmp.pixels[1]).toBe(3);
    expect([...bmp.pixels]).toEqual([TRANSPARENT, 3, TRANSPARENT, 3, 3, 3]);
  });
});

describe("blitIndexed", () => {
  it("paints scaled opaque pixels and skips transparent ones", () => {
    const fb = createFramebuffer(6, 4);
    fb.clear(0);
    const bmp = bitmapFromRows(["A.", ".A"], { A: 1 });
    blitIndexed(fb, bmp, 1, 1, 1, 1, (index) => index + 10);
    expect(fb.data[1 * 6 + 1]).toBe(11);
    expect(fb.data[1 * 6 + 2]).toBe(0);
    expect(fb.data[2 * 6 + 2]).toBe(11);
  });
});

describe("blitRgba", () => {
  it("copies opaque pixels and skips clear ones", () => {
    const fb = createFramebuffer(4, 2);
    fb.clear(0);
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0]);
    blitRgba(fb, { width: 2, height: 1, rgba }, 1, 1, 2, 1);
    expect(fb.data[1 * 4 + 1]).toBe(rgb(10, 20, 30));
    expect(fb.data[1 * 4 + 2]).toBe(0);
  });

  it("scales with nearest neighbour", () => {
    const fb = createFramebuffer(4, 2);
    fb.clear(0);
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    blitRgba(fb, { width: 1, height: 1, rgba }, 0, 0, 2, 2);
    const red = rgb(255, 0, 0);
    expect(fb.data[0]).toBe(red);
    expect(fb.data[1]).toBe(red);
    expect(fb.data[4]).toBe(red);
    expect(fb.data[5]).toBe(red);
    expect(fb.data[2]).toBe(0);
  });
});
