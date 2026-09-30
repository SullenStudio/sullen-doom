import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { ENEMY_RADIUS, castHitscan, hasLineOfSight, rayCircle, wallDistance } from "./hitscan.js";

// Open room, walls on the border only. Interior cells 1..7 on both axes.
const { map } = parseMap([
  "#########",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#########",
]);

// A room split by a wall down column 4.
const { map: split } = parseMap([
  "#########",
  "#...#...#",
  "#...#...#",
  "#...#...#",
  "#########",
]);

const foe = (x, y, hp = 2) => ({ x, y, hp, hit: 0 });

describe("rayCircle", () => {
  it("returns the near intersection of a circle straight ahead", () => {
    // Circle centred 3 away, radius 0.5: the ray enters at 2.5.
    expect(rayCircle(0, 0, 1, 0, 3, 0, 0.5)).toBeCloseTo(2.5, 10);
  });

  it("misses a circle the ray passes beside", () => {
    expect(rayCircle(0, 0, 1, 0, 3, 2, 0.5)).toBe(null);
  });

  it("misses a circle behind the origin", () => {
    expect(rayCircle(0, 0, 1, 0, -3, 0, 0.5)).toBe(null);
  });

  it("returns the exit point when the origin is inside the circle", () => {
    expect(rayCircle(0, 0, 1, 0, 0, 0, 0.5)).toBeCloseTo(0.5, 10);
  });

  it("grazes a circle touched exactly on its edge", () => {
    const t = rayCircle(0, 0, 1, 0, 3, 0.5, 0.5);
    expect(t).not.toBe(null);
    expect(t).toBeCloseTo(3, 6);
  });

  it("works along an arbitrary direction", () => {
    const k = Math.SQRT1_2;
    expect(rayCircle(0, 0, k, k, 2 * k, 2 * k, 0.5)).toBeCloseTo(1.5, 10);
  });
});

describe("wallDistance", () => {
  it("measures the wall straight ahead", () => {
    expect(wallDistance(map, 4.5, 4.5, 1, 0, 32)).toBeCloseTo(3.5, 10);
  });

  it("measures the wall behind", () => {
    expect(wallDistance(map, 4.5, 4.5, -1, 0, 32)).toBeCloseTo(3.5, 10);
  });

  it("reports maxDist when no wall is within range", () => {
    expect(wallDistance(map, 4.5, 4.5, 1, 0, 1.5)).toBe(1.5);
  });
});

describe("hasLineOfSight", () => {
  it("is clear across open floor", () => {
    expect(hasLineOfSight(map, 2.5, 2.5, 6.5, 2.5)).toBe(true);
  });

  it("is blocked by a wall between two rooms", () => {
    expect(hasLineOfSight(split, 2.5, 2.5, 6.0, 2.5)).toBe(false);
  });

  it("is clear when the two points are the same", () => {
    expect(hasLineOfSight(map, 4.5, 4.5, 4.5, 4.5)).toBe(true);
  });
});

describe("castHitscan", () => {
  it("strikes an enemy standing in the open", () => {
    const e = foe(7.0, 4.5);
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [e], 20);
    expect(shot.kind).toBe("enemy");
    expect(shot.enemy).toBe(e);
    expect(shot.dist).toBeCloseTo(2.5 - ENEMY_RADIUS, 6);
  });

  it("reports the impact point on the enemy's near side", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 4.5)], 20);
    expect(shot.x).toBeCloseTo(7.0 - ENEMY_RADIUS, 6);
    expect(shot.y).toBeCloseTo(4.5, 6);
  });

  it("misses an enemy the ray passes beside", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 6.0)], 20);
    expect(shot.kind).toBe("wall");
  });

  it("does not shoot through a wall", () => {
    // Player left of the partition, enemy right of it.
    const shot = castHitscan(split, 2.5, 2.5, 1, 0, [foe(6.0, 2.5)], 20);
    expect(shot.kind).toBe("wall");
    expect(shot.enemy).toBe(null);
  });

  it("ignores a dead enemy", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 4.5, 0)], 20);
    expect(shot.kind).toBe("wall");
  });

  it("picks the nearer of two enemies on the same line", () => {
    const near = foe(6.0, 4.5);
    const far = foe(7.0, 4.5);
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [far, near], 20);
    expect(shot.enemy).toBe(near);
  });

  it("reports none when nothing is inside maxDist", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 4.5)], 0.5);
    expect(shot.kind).toBe("none");
    expect(shot.dist).toBe(0.5);
  });

  it("ignores an enemy further away than the wall behind it", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(9.5, 4.5)], 20);
    expect(shot.kind).toBe("wall");
  });

  it("always reports a finite impact point", () => {
    for (const a of [0, 0.7, Math.PI / 2, 2.4, Math.PI, 4.1, 5.9]) {
      const shot = castHitscan(map, 4.5, 4.5, Math.cos(a), Math.sin(a), [], 20);
      expect(Number.isFinite(shot.x)).toBe(true);
      expect(Number.isFinite(shot.y)).toBe(true);
      expect(shot.dist).toBeGreaterThan(0);
    }
  });
});
