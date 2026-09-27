import { describe, expect, it } from "vitest";
import { makeEnemySprite } from "../assets/textures.js";
import { parseMap } from "../game/map.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderWalls } from "./walls.js";
import { projectSprite, renderSprites } from "./sprites.js";
import { generateTextures } from "../assets/textures.js";

const FOV = Math.PI / 3;
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const bitmap = makeEnemySprite(7);
const WIDTH = 96;
const HEIGHT = 60;

describe("projectSprite", () => {
  it("puts a sprite straight ahead in the middle of the screen", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const p = projectSprite(cam, 5.5, 2.5);
    expect(p.screenX).toBeCloseTo(0.5, 6);
    expect(p.depth).toBeCloseTo(3, 6);
  });

  it("rejects anything behind the camera", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    expect(projectSprite(cam, 0.5, 2.5)).toBe(null);
  });

  it("puts a sprite on the fov edge at the screen edge", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const depth = 3;
    const offset = depth * Math.tan(FOV / 2);
    expect(projectSprite(cam, 2.5 + depth, 2.5 + offset).screenX)
      .toBeCloseTo(1, 6);
    expect(projectSprite(cam, 2.5 + depth, 2.5 - offset).screenX)
      .toBeCloseTo(0, 6);
  });

  it("agrees with the wall projection at the screen edge", () => {
    // This is the bug the old renderer had: sprites used a linear angle
    // mapping while walls used a tangent one, so they drifted apart towards
    // the edges. Both must now agree to the pixel.
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const depth = 4;
    for (const cameraX of [-0.9, -0.5, 0, 0.5, 0.9]) {
      // A point sitting exactly on the ray for this screen column.
      const rayX = cam.dirX + cam.planeX * cameraX;
      const rayY = cam.dirY + cam.planeY * cameraX;
      const p = projectSprite(cam, cam.x + rayX * depth, cam.y + rayY * depth);
      expect(p.screenX).toBeCloseTo((cameraX + 1) / 2, 6);
    }
  });

  it("keeps depth independent of horizontal offset", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const straight = projectSprite(cam, 5.5, 2.5);
    const offset = projectSprite(cam, 5.5, 3.5);
    expect(offset.depth).toBeCloseTo(straight.depth, 6);
  });
});

describe("renderSprites", () => {
  const { map } = parseMap([
    "#########",
    "#.......#",
    "#.......#",
    "#.......#",
    "#########",
  ]);
  const textures = generateTextures(1);

  function scene(sprites, camera) {
    const fb = createFramebuffer(WIDTH, HEIGHT);
    fb.clear(0);
    const zbuf = new Float32Array(WIDTH);
    renderWalls(fb, map, camera, textures, {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      maxDist: 32,
      lightBoost: 0,
      horizon: HEIGHT >> 1,
    });
    const before = Uint32Array.from(fb.data);
    renderSprites(fb, camera, sprites, {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      lightBoost: 0,
      horizon: HEIGHT >> 1,
      scale: 0.7,
    });
    return { fb, before };
  }

  const changedColumns = (fb, before) => {
    const cols = new Set();
    for (let i = 0; i < fb.data.length; i++) {
      if (fb.data[i] !== before[i]) cols.add(i % WIDTH);
    }
    return cols;
  };

  it("draws a visible sprite near the middle of the screen", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const { fb, before } = scene([{ x: 5.0, y: 2.5, bitmap, hit: 0 }], cam);
    const cols = changedColumns(fb, before);
    expect(cols.size).toBeGreaterThan(0);
    const centre = [...cols].reduce((a, b) => a + b, 0) / cols.size;
    expect(Math.abs(centre - WIDTH / 2)).toBeLessThan(4);
  });

  it("draws nothing for a sprite behind the camera", () => {
    const cam = makeCamera(5.0, 2.5, 0, FOV);
    const { fb, before } = scene([{ x: 2.0, y: 2.5, bitmap, hit: 0 }], cam);
    expect(changedColumns(fb, before).size).toBe(0);
  });

  it("hides a sprite standing behind a wall", () => {
    const { map: walled } = parseMap([
      "#########",
      "#...#...#",
      "#...#...#",
      "#...#...#",
      "#########",
    ]);
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const fb = createFramebuffer(WIDTH, HEIGHT);
    fb.clear(0);
    const zbuf = new Float32Array(WIDTH);
    renderWalls(fb, walled, cam, textures, {
      shadeTable, paletteSize: PALETTE_SIZE, zbuf,
      maxDist: 32, lightBoost: 0, horizon: HEIGHT >> 1,
    });
    const before = Uint32Array.from(fb.data);
    renderSprites(fb, cam, [{ x: 6.5, y: 2.5, bitmap, hit: 0 }], {
      shadeTable, paletteSize: PALETTE_SIZE, zbuf,
      lightBoost: 0, horizon: HEIGHT >> 1, scale: 0.7,
    });
    expect(changedColumns(fb, before).size).toBe(0);
  });

  it("draws a near sprite wider than a far one", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const near = scene([{ x: 3.2, y: 2.5, bitmap, hit: 0 }], cam);
    const far = scene([{ x: 6.5, y: 2.5, bitmap, hit: 0 }], cam);
    expect(changedColumns(near.fb, near.before).size)
      .toBeGreaterThan(changedColumns(far.fb, far.before).size);
  });

  it("draws the nearer of two overlapping sprites on top", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const both = scene(
      [
        { x: 6.5, y: 2.5, bitmap, hit: 0 },
        { x: 3.2, y: 2.5, bitmap, hit: 0 },
      ],
      cam,
    );
    const onlyNear = scene([{ x: 3.2, y: 2.5, bitmap, hit: 0 }], cam);
    const centre = (HEIGHT >> 1) * WIDTH + (WIDTH >> 1);
    expect(both.fb.data[centre]).toBe(onlyNear.fb.data[centre]);
  });

  it("flashes a sprite that was just hit", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const calm = scene([{ x: 4.0, y: 2.5, bitmap, hit: 0 }], cam);
    const struck = scene([{ x: 4.0, y: 2.5, bitmap, hit: 0.2 }], cam);
    expect([...calm.fb.data]).not.toEqual([...struck.fb.data]);
  });
});
