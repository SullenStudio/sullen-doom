import { describe, expect, it } from "vitest";
import { parseMap } from "../game/map.js";
import { castColumn, makeCamera } from "./raycast.js";

const FOV = Math.PI / 3;
// A 5x5 box with a single pillar at (3, 1).
const { map } = parseMap([
  "#####",
  "#..3#",
  "#...#",
  "#...#",
  "#####",
]);

describe("makeCamera", () => {
  it("points the direction vector along the angle", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    expect(cam.dirX).toBeCloseTo(1, 10);
    expect(cam.dirY).toBeCloseTo(0, 10);
  });

  it("puts the plane to the camera's right, scaled by half the fov", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    expect(cam.planeX).toBeCloseTo(0, 10);
    expect(cam.planeY).toBeCloseTo(Math.tan(FOV / 2), 10);
  });

  it("keeps the plane perpendicular to the direction at any angle", () => {
    const cam = makeCamera(1, 1, 0.9, FOV);
    expect(cam.dirX * cam.planeX + cam.dirY * cam.planeY).toBeCloseTo(0, 10);
  });
});

describe("castColumn", () => {
  it("measures a straight shot down +x", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
    expect(hit.dist).toBeCloseTo(1.5, 10);
    expect(hit.side).toBe(0);
    expect(hit.mapX).toBe(4);
    expect(hit.mapY).toBe(2);
  });

  it("measures a straight shot down +y and reports the other side", () => {
    const cam = makeCamera(2.5, 2.5, Math.PI / 2, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
    expect(hit.dist).toBeCloseTo(1.5, 10);
    expect(hit.side).toBe(1);
    expect(hit.mapY).toBe(4);
  });

  it("measures a straight shot down -x", () => {
    const cam = makeCamera(2.5, 2.5, Math.PI, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.dist).toBeCloseTo(1.5, 10);
    expect(hit.mapX).toBe(0);
  });

  it("reports perpendicular distance, not euclidean", () => {
    // An off-centre column is farther away in a straight line, but the
    // perpendicular distance to a flat wall ahead must stay 1.5.
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const hit = castColumn(map, cam, 0.5, 32);
    expect(hit.dist).toBeCloseTo(1.5, 10);
  });

  it("finds the nearest surface, stopping at the pillar", () => {
    const cam = makeCamera(3.5, 3.5, -Math.PI / 2, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.mapY).toBe(1);
    expect(hit.dist).toBeCloseTo(1.5, 10);
  });

  it("returns a texture coordinate inside [0, 1)", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    for (let i = -10; i <= 10; i++) {
      const hit = castColumn(map, cam, i / 10, 32);
      expect(hit.texU).toBeGreaterThanOrEqual(0);
      expect(hit.texU).toBeLessThan(1);
    }
  });

  it("walks the texture coordinate monotonically across a flat wall", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const left = castColumn(map, cam, -0.4, 32);
    const right = castColumn(map, cam, 0.4, 32);
    expect(left.mapX).toBe(4);
    expect(right.mapX).toBe(4);
    expect(right.texU).toBeGreaterThan(left.texU);
  });

  it("walks the texture coordinate monotonically facing Math.PI", () => {
    const cam = makeCamera(2.5, 2.5, Math.PI, FOV);
    const left = castColumn(map, cam, -0.4, 32);
    const right = castColumn(map, cam, 0.4, 32);
    expect(left.mapX).toBe(0);
    expect(right.mapX).toBe(0);
    expect(right.texU).toBeGreaterThan(left.texU);
  });

  it("walks the texture coordinate monotonically facing Math.PI / 2", () => {
    const cam = makeCamera(2.5, 2.5, Math.PI / 2, FOV);
    const left = castColumn(map, cam, -0.4, 32);
    const right = castColumn(map, cam, 0.4, 32);
    expect(left.mapY).toBe(4);
    expect(right.mapY).toBe(4);
    expect(right.texU).toBeGreaterThan(left.texU);
  });

  it("walks the texture coordinate monotonically facing -Math.PI / 2", () => {
    const cam = makeCamera(2.5, 2.5, -Math.PI / 2, FOV);
    const left = castColumn(map, cam, -0.4, 32);
    const right = castColumn(map, cam, 0.4, 32);
    expect(left.mapY).toBe(0);
    expect(right.mapY).toBe(0);
    expect(right.texU).toBeGreaterThan(left.texU);
  });

  it("reports a miss when the wall is beyond maxDist", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const hit = castColumn(map, cam, 0, 0.5);
    expect(hit.hit).toBe(false);
  });

  it("does not loop forever when the camera stands inside a wall", () => {
    const cam = makeCamera(0.5, 0.5, 0.3, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
    expect(hit.dist).toBeGreaterThan(0);
    expect(hit.mapX).toBe(0);
    expect(hit.mapY).toBe(0);
  });

  it("ensures dist is at least MIN_DIST when camera is flush against a wall", () => {
    // Camera flush against wall at x=1
    const cam1 = makeCamera(1.0, 2.5, Math.PI, FOV);
    const hit1 = castColumn(map, cam1, 0, 32);
    expect(hit1.dist).toBeGreaterThanOrEqual(0.01);

    // Camera flush against wall at y=1
    const cam2 = makeCamera(2.5, 1.0, -Math.PI / 2, FOV);
    const hit2 = castColumn(map, cam2, 0, 32);
    expect(hit2.dist).toBeGreaterThanOrEqual(0.01);
  });

  it("traces a diagonal ray with interleaved steps", () => {
    // Diagonal ray from non-half coordinate should exercise both x and y steps.
    // Camera at (2.3, 3.1) facing 0.7 radians.
    const cam = makeCamera(2.3, 3.1, 0.7, FOV);
    const hit = castColumn(map, cam, 0, 32);
    // Ray should hit the wall at y=4 first.
    expect(hit.hit).toBe(true);
    expect(hit.mapY).toBe(4);
    // Distance computed by hand:
    // dirX = cos(0.7) ≈ 0.7648, dirY = sin(0.7) ≈ 0.6442
    // planeX = -0.6442 * tan(π/6) ≈ -0.372, planeY = 0.7648 * tan(π/6) ≈ 0.442
    // rayDir = (0.7648, 0.6442), cameraX = 0
    // DDA steps: x from 2→3 at sideDistX≈0.915, then y from 3→4 at sideDistY≈1.397
    // Hits solid at (3, 4), side=1, dist = (4 - 3.1 + 0) / 0.6442 ≈ 1.397
    expect(hit.dist).toBeCloseTo(1.397, 2);
  });
});

describe("locked gate", () => {
  const { map } = parseMap(["#####", "#P.X#", "#####"]);

  it("stops a ray on the closed door", () => {
    const cam = makeCamera(1.5, 1.5, 0, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
    expect(hit.mapX).toBe(3);
    expect(hit.mapY).toBe(1);
    expect(hit.dist).toBeCloseTo(1.5, 10);
  });

  it("lets a ray through once the gate opens", () => {
    map.openExits();
    const cam = makeCamera(1.5, 1.5, 0, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
    expect(hit.mapX).toBe(4);
    expect(hit.dist).toBeCloseTo(2.5, 10);
  });
});
