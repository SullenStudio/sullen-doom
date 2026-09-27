import { describe, expect, it } from "vitest";
import { parseMap } from "../game/map.js";
import { generateTextures } from "../assets/textures.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderWalls } from "./walls.js";

const FOV = Math.PI / 3;
const textures = generateTextures(1);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);

const { map } = parseMap([
  "#######",
  "#.....#",
  "#.....#",
  "#.....#",
  "#######",
]);

function render(camera, width = 64, height = 40) {
  const fb = createFramebuffer(width, height);
  fb.clear(0);
  const zbuf = new Float32Array(width);
  renderWalls(fb, map, camera, textures, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    maxDist: 32,
    lightBoost: 0,
    horizon: height >> 1,
  });
  return { fb, zbuf, width, height };
}

describe("renderWalls", () => {
  it("fills the z-buffer with perpendicular distances", () => {
    const { zbuf, width } = render(makeCamera(3.5, 2.5, 0, FOV));
    expect(zbuf.length).toBe(width);
    for (const d of zbuf) {
      expect(d).toBeGreaterThan(0);
      expect(Number.isFinite(d)).toBe(true);
    }
  });

  it("draws a nearer wall taller than a farther one", () => {
    const heightAt = (camX) => {
      const { fb, width, height } = render(makeCamera(camX, 2.5, 0, FOV));
      const column = width >> 1;
      let count = 0;
      for (let y = 0; y < height; y++) {
        if (fb.data[y * width + column] !== 0) count++;
      }
      return count;
    };
    expect(heightAt(5.0)).toBeGreaterThan(heightAt(1.5));
  });

  it("centres the wall on the horizon", () => {
    const { fb, width, height } = render(makeCamera(3.5, 2.5, 0, FOV));
    const column = width >> 1;
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      if (fb.data[y * width + column] !== 0) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    const centre = (top + bottom) / 2;
    expect(Math.abs(centre - height / 2)).toBeLessThanOrEqual(1);
  });

  it("leaves nothing above and below an almost-distant wall", () => {
    const { fb, width } = render(makeCamera(1.2, 2.5, 0, FOV));
    const column = width >> 1;
    expect(fb.data[column]).toBe(0);
  });

  it("darkens a wall as it recedes", () => {
    const brightness = (camX) => {
      const { fb, width, height } = render(makeCamera(camX, 2.5, 0, FOV));
      const pixel = fb.data[(height >> 1) * width + (width >> 1)];
      return (pixel & 255) + ((pixel >> 8) & 255) + ((pixel >> 16) & 255);
    };
    expect(brightness(5.6)).toBeGreaterThan(brightness(1.2));
  });

  it("writes something into every column of a closed room", () => {
    const { fb, width, height } = render(makeCamera(3.5, 2.5, 0.4, FOV));
    for (let x = 0; x < width; x++) {
      expect(fb.data[(height >> 1) * width + x]).not.toBe(0);
    }
  });

  it("survives a camera standing in a wall without throwing", () => {
    expect(() => render(makeCamera(0.5, 0.5, 0, FOV))).not.toThrow();
  });

  it("marks a miss with Infinity in the z-buffer while a hit column stays finite", () => {
    // A long open corridor: walls only at the far ends (columns 0 and 22),
    // more than maxDist apart. A ray sent straight down its centreline never
    // reaches either end wall within maxDist and must miss; rays sent toward
    // the near top/bottom walls hit within a couple of units.
    const { map: corridor } = parseMap([
      "#######################",
      "#.....................#",
      "#.....................#",
      "#.....................#",
      "#######################",
    ]);
    const width = 64;
    const height = 40;
    const fb = createFramebuffer(width, height);
    fb.clear(0);
    const zbuf = new Float32Array(width);
    const camera = makeCamera(2.5, 2.5, 0, FOV);
    renderWalls(fb, corridor, camera, textures, {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      maxDist: 10,
      lightBoost: 0,
      horizon: height >> 1,
    });

    // Straight ahead (cameraX === 0 exactly for the middle column): the ray
    // travels parallel to the corridor and never hits the near top/bottom
    // walls, and the end walls are far past maxDist.
    const centre = width >> 1;
    expect(zbuf[centre]).toBe(Infinity);

    // The leftmost and rightmost columns are angled sharply enough to hit
    // the corridor's top/bottom wall a couple of units away, well inside
    // maxDist.
    expect(Number.isFinite(zbuf[0])).toBe(true);
    expect(zbuf[0]).toBeGreaterThan(0);
    expect(zbuf[0]).toBeLessThan(10);
    expect(Number.isFinite(zbuf[width - 1])).toBe(true);
    expect(zbuf[width - 1]).toBeGreaterThan(0);
    expect(zbuf[width - 1]).toBeLessThan(10);
  });
});
