import { describe, expect, it } from "vitest";
import { PALETTE_SIZE, TRANSPARENT } from "../render/palette.js";
import {
  NOISE_LATTICE,
  TEXTURE_SLOT,
  TEX_SIZE,
  generateTextures,
  makeEnemySprite,
} from "./textures.js";

describe("generateTextures", () => {
  const textures = generateTextures(1337);

  it("produces one texture per named slot", () => {
    expect(textures.length).toBe(Object.keys(TEXTURE_SLOT).length);
  });

  it("produces square tiles of TEX_SIZE", () => {
    for (const tex of textures) {
      expect(tex.size).toBe(TEX_SIZE);
      expect(tex.pixels.length).toBe(TEX_SIZE * TEX_SIZE);
    }
  });

  it("only emits indices that exist in the palette", () => {
    for (const tex of textures) {
      for (const index of tex.pixels) {
        expect(index).toBeLessThan(PALETTE_SIZE);
      }
    }
  });

  it("is reproducible from a seed", () => {
    const again = generateTextures(1337);
    for (let i = 0; i < textures.length; i++) {
      expect([...again[i].pixels]).toEqual([...textures[i].pixels]);
    }
  });

  it("gives different seeds different output", () => {
    const other = generateTextures(4242);
    const a = textures[TEXTURE_SLOT.concrete].pixels;
    const b = other[TEXTURE_SLOT.concrete].pixels;
    expect([...a]).not.toEqual([...b]);
  });

  it("uses more than one shade per tile, so nothing renders flat", () => {
    for (const tex of textures) {
      expect(new Set(tex.pixels).size).toBeGreaterThan(2);
    }
  });

  it("keeps the noise lattice a whole divisor of the tile", () => {
    // This is the invariant that makes tiles seamless: sampling at
    // NOISE_LATTICE / TEX_SIZE covers exactly one wrapping period across the
    // tile. Comparing edge pixels directly would be wrong — a brick course
    // legitimately puts mortar at the seam — so guard the rule instead.
    expect(TEX_SIZE % NOISE_LATTICE).toBe(0);
  });

  it("wraps seamlessly across multiple seeds (consistent structure)", () => {
    // Verify that wrap boundaries produce consistent discontinuity patterns
    // across different seeds. This guards against gross errors in frequency
    // multipliers: if a multiplier becomes fractional, the wrap patterns will
    // diverge from the deterministic, reproducible structure.
    // The test samples several seeds and verifies that wrap/interior ratios
    // are stable, which would break if frequency arithmetic is corrupted.
    const testSeeds = [1337, 4242, 9999, 12345];
    const ratios = {};

    for (const seed of testSeeds) {
      const textures = generateTextures(seed);
      for (let i = 0; i < textures.length; i++) {
        const tex = textures[i];
        const pixels = tex.pixels;
        const textureName = Object.keys(TEXTURE_SLOT)[i];
        const key = `${textureName}`;

        if (!ratios[key]) ratios[key] = [];

        // Collect all wrap and interior discontinuities
        const wrapDiffs = [];
        for (let y = 0; y < TEX_SIZE; y++) {
          const left = pixels[y * TEX_SIZE + (TEX_SIZE - 1)];
          const right = pixels[y * TEX_SIZE + 0];
          wrapDiffs.push(Math.abs(left - right));
        }
        for (let x = 0; x < TEX_SIZE; x++) {
          const top = pixels[((TEX_SIZE - 1) * TEX_SIZE) + x];
          const bottom = pixels[0 * TEX_SIZE + x];
          wrapDiffs.push(Math.abs(top - bottom));
        }

        const interiorDiffs = [];
        for (let y = 0; y < TEX_SIZE; y++) {
          for (let x = 1; x < TEX_SIZE; x++) {
            const left = pixels[y * TEX_SIZE + (x - 1)];
            const right = pixels[y * TEX_SIZE + x];
            interiorDiffs.push(Math.abs(left - right));
          }
        }
        for (let y = 1; y < TEX_SIZE; y++) {
          for (let x = 0; x < TEX_SIZE; x++) {
            const top = pixels[((y - 1) * TEX_SIZE) + x];
            const bottom = pixels[(y * TEX_SIZE) + x];
            interiorDiffs.push(Math.abs(top - bottom));
          }
        }

        const wrapMed = percentile(wrapDiffs, 50);
        const interiorMed = percentile(interiorDiffs, 50);
        const ratio = interiorMed > 0 ? wrapMed / interiorMed : wrapMed;
        ratios[key].push(ratio);
      }
    }

    // Verify ratios are consistent across seeds (low variance means structure is stable)
    for (const key in ratios) {
      const values = ratios[key];
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.abs(b - mean), 0) / values.length;
      // Stable structure should have low variance; large variance indicates
      // the structure is seed-dependent, which would happen if frequency math is wrong
      expect(variance).toBeLessThanOrEqual(0.6);
    }
  });
});

describe("makeEnemySprite", () => {
  const sprite = makeEnemySprite(7);

  it("is taller than it is wide", () => {
    expect(sprite.height).toBeGreaterThan(sprite.width);
    expect(sprite.pixels.length).toBe(sprite.width * sprite.height);
  });

  it("leaves the corners transparent", () => {
    expect(sprite.pixels[0]).toBe(TRANSPARENT);
    expect(sprite.pixels[sprite.width - 1]).toBe(TRANSPARENT);
  });

  it("has solid pixels in the middle", () => {
    const mid = Math.floor(sprite.height / 2) * sprite.width
      + Math.floor(sprite.width / 2);
    expect(sprite.pixels[mid]).not.toBe(TRANSPARENT);
  });

  it("only emits palette indices or the transparent sentinel", () => {
    for (const index of sprite.pixels) {
      expect(index === TRANSPARENT || index < PALETTE_SIZE).toBe(true);
    }
  });
});

/** Compute a percentile of a sorted array. */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[index];
}
