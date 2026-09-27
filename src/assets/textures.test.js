import { describe, expect, it } from "vitest";
import { PALETTE_SIZE, TRANSPARENT } from "../render/palette.js";
import {
  NOISE_LATTICE,
  TEXTURE_SLOT,
  TEX_SIZE,
  generateTextures,
  generateTileAt,
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

  it("tiles are periodic with period TEX_SIZE (bit-exact)", () => {
    // A seamless tile repeats with period TEX_SIZE on both axes.
    // This is a bit-exact property: the tile at origin (0, 0) must be
    // pixel-identical to the tile at (TEX_SIZE, 0) and (0, TEX_SIZE).
    // A fractional frequency multiplier breaks this: for m=1.5, the noise
    // shift is 12 lattice units (which repeats every 8), producing completely
    // different pixels. A structural period that doesn't divide TEX_SIZE
    // also breaks periodicity.
    const seed = 1337;
    for (let slot = 0; slot < Object.keys(TEXTURE_SLOT).length; slot++) {
      const origin_0_0 = generateTileAt(slot, seed, 0, 0);
      const origin_W_0 = generateTileAt(slot, seed, TEX_SIZE, 0);
      const origin_0_W = generateTileAt(slot, seed, 0, TEX_SIZE);

      expect(origin_0_0.pixels).toEqual(origin_W_0.pixels);
      expect(origin_0_0.pixels).toEqual(origin_0_W.pixels);
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
