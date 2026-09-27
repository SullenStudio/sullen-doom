import { describe, expect, it } from "vitest";
import {
  ACCENT,
  PALETTE,
  PALETTE_SIZE,
  RAMP,
  RAMP_SIZE,
  SHADE_LEVELS,
  buildShadeTable,
  lightLevel,
  rgb,
} from "./palette.js";

describe("rgb", () => {
  it("packs as 0xAABBGGRR with opaque alpha", () => {
    expect(rgb(255, 0, 0)).toBe(0xff0000ff >>> 0);
    expect(rgb(0, 255, 0)).toBe(0xff00ff00 >>> 0);
    expect(rgb(0, 0, 255)).toBe(0xffff0000 >>> 0);
  });
});

describe("PALETTE", () => {
  it("holds every ramp at full size", () => {
    expect(PALETTE_SIZE).toBe(PALETTE.length);
    for (const start of Object.values(RAMP)) {
      expect(start + RAMP_SIZE).toBeLessThanOrEqual(PALETTE_SIZE);
    }
  });

  it("leaves 255 free as the transparent sentinel", () => {
    expect(PALETTE_SIZE).toBeLessThan(255);
  });

  it("orders every shading ramp from dark to light", () => {
    // Texture generators pick a step inside a ramp to mean "lighter" or
    // "darker". If a ramp is not monotonic that meaning silently breaks.
    const luma = (c) => {
      const r = c & 255;
      const g = (c >> 8) & 255;
      const b = (c >> 16) & 255;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    for (const start of Object.values(RAMP)) {
      for (let i = 1; i < RAMP_SIZE; i++) {
        expect(luma(PALETTE[start + i])).toBeGreaterThan(
          luma(PALETTE[start + i - 1]),
        );
      }
    }
  });

  it("keeps every accent inside the palette and outside the ramps", () => {
    const rampEnd = Math.max(...Object.values(RAMP)) + RAMP_SIZE;
    for (const index of Object.values(ACCENT)) {
      expect(index).toBeGreaterThanOrEqual(rampEnd);
      expect(index).toBeLessThan(PALETTE_SIZE);
    }
  });
});

describe("buildShadeTable", () => {
  const table = buildShadeTable(PALETTE, SHADE_LEVELS);

  it("has one entry per colour per level", () => {
    expect(table.length).toBe(PALETTE_SIZE * SHADE_LEVELS);
  });

  it("returns the untouched colour at the brightest level", () => {
    const top = (SHADE_LEVELS - 1) * PALETTE_SIZE;
    for (let i = 0; i < PALETTE_SIZE; i++) {
      expect(table[top + i]).toBe(PALETTE[i]);
    }
  });

  it("returns black at the darkest level", () => {
    for (let i = 0; i < PALETTE_SIZE; i++) {
      expect(table[i]).toBe(rgb(0, 0, 0));
    }
  });

  it("never gets darker as the level rises", () => {
    const index = RAMP.brick + 3;
    let previous = -1;
    for (let l = 0; l < SHADE_LEVELS; l++) {
      const value = table[l * PALETTE_SIZE + index] & 255;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("lightLevel", () => {
  it("is brightest right in front of the camera", () => {
    expect(lightLevel(0, 0, 0)).toBe(SHADE_LEVELS - 1);
  });

  it("falls off with distance", () => {
    expect(lightLevel(8, 0, 0)).toBeLessThan(lightLevel(2, 0, 0));
  });

  it("darkens side walls so corners stay readable", () => {
    expect(lightLevel(4, 1, 0)).toBeLessThan(lightLevel(4, 0, 0));
  });

  it("brightens under a muzzle flash", () => {
    expect(lightLevel(6, 0, 0.5)).toBeGreaterThan(lightLevel(6, 0, 0));
  });

  it("stays in range for absurd inputs", () => {
    expect(lightLevel(1e6, 1, 0)).toBe(0);
    expect(lightLevel(0, 0, 10)).toBe(SHADE_LEVELS - 1);
  });
});
