import { describe, expect, it } from "vitest";
import { createFramebuffer } from "./framebuffer.js";
import { rgb } from "./palette.js";

const RED = rgb(255, 0, 0);
const BLUE = rgb(0, 0, 255);

describe("createFramebuffer", () => {
  it("allocates one 32-bit pixel per cell", () => {
    const fb = createFramebuffer(8, 4);
    expect(fb.data.length).toBe(32);
    expect(fb.width).toBe(8);
    expect(fb.height).toBe(4);
  });

  it("can wrap a caller-supplied buffer", () => {
    const buffer = new ArrayBuffer(8 * 4 * 4);
    const fb = createFramebuffer(8, 4, buffer);
    fb.clear(RED);
    expect(new Uint32Array(buffer)[0]).toBe(RED);
  });

  it("clears every pixel", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(RED);
    expect([...fb.data].every((p) => p === RED)).toBe(true);
  });
});

describe("fillRect", () => {
  it("fills exactly the requested box", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.fillRect(1, 1, 2, 2, RED);
    expect(fb.data[0]).toBe(0);
    expect(fb.data[5]).toBe(RED);
    expect(fb.data[6]).toBe(RED);
    expect(fb.data[9]).toBe(RED);
    expect(fb.data[10]).toBe(RED);
    expect(fb.data[15]).toBe(0);
  });

  it("clips against every edge instead of wrapping", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.fillRect(-2, -2, 3, 3, RED);
    expect(fb.data[0]).toBe(RED);
    expect(fb.data[1]).toBe(0);
    expect(fb.data[4]).toBe(0);
  });

  it("ignores a box that is fully outside", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(BLUE);
    fb.fillRect(10, 10, 4, 4, RED);
    fb.fillRect(-10, 0, 4, 4, RED);
    expect([...fb.data].every((p) => p === BLUE)).toBe(true);
  });

  it("ignores a box with no area", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(BLUE);
    fb.fillRect(1, 1, 0, 5, RED);
    fb.fillRect(1, 1, 5, -3, RED);
    expect([...fb.data].every((p) => p === BLUE)).toBe(true);
  });
});

describe("verticalLine", () => {
  it("fills from y0 up to but not including y1", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.verticalLine(2, 1, 3, RED);
    expect(fb.data[2]).toBe(0);
    expect(fb.data[6]).toBe(RED);
    expect(fb.data[10]).toBe(RED);
    expect(fb.data[14]).toBe(0);
  });

  it("clips vertically and rejects out-of-range columns", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.verticalLine(0, -5, 99, RED);
    fb.verticalLine(9, 0, 4, BLUE);
    expect(fb.data[0]).toBe(RED);
    expect(fb.data[12]).toBe(RED);
    expect([...fb.data].includes(BLUE)).toBe(false);
  });
});
