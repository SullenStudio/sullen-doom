import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { ENEMY_RADIUS } from "./hitscan.js";
import { PLAYER_RADIUS, circleHitsWall, resolveWallOverlap, slideMove, separateBodies } from "./move.js";

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

const actor = (x, y) => ({ x, y });
const foe = (x, y, hp = 2) => ({ x, y, hp });
const minDist = ENEMY_RADIUS + PLAYER_RADIUS;

describe("slideMove", () => {
  it("walks into open space", () => {
    const player = actor(2.5, 2.5);
    slideMove(map, player, 3.1, 2.5);
    expect(player.x).toBeCloseTo(3.1, 10);
    expect(player.y).toBeCloseTo(2.5, 10);
  });

  it("does not walk into a wall", () => {
    const player = actor(1.5, 1.5);
    slideMove(map, player, 0.4, 1.5);
    expect(player.x).toBe(1.5);
  });

  it("slides along a wall instead of stopping dead", () => {
    const player = actor(1.5, 2.5);
    slideMove(map, player, 0.4, 3.2);
    expect(player.x).toBe(1.5);
    expect(player.y).toBeCloseTo(3.2, 10);
  });

  it("does not walk through a living enemy", () => {
    const player = actor(2.5, 2.5);
    const enemy = foe(4.5, 2.5);
    slideMove(map, player, 4.5, 2.5, { blockers: [enemy], minDist });
    expect(Math.hypot(player.x - enemy.x, player.y - enemy.y)).toBeGreaterThanOrEqual(
      minDist,
    );
  });

  it("slides around an enemy when one axis is blocked", () => {
    const player = actor(3.5, 2.5);
    const enemy = foe(4.5, 2.5);
    slideMove(map, player, 4.5, 3.5, { blockers: [enemy], minDist });
    expect(player.x).toBe(3.5);
    expect(player.y).toBeCloseTo(3.5, 10);
  });

  it("walks over a dead enemy", () => {
    const player = actor(2.5, 2.5);
    const corpse = foe(3.5, 2.5, 0);
    slideMove(map, player, 3.5, 2.5, { blockers: [corpse], minDist });
    expect(player.x).toBeCloseTo(3.5, 10);
  });

  it("does not let a radius clip into a wall the centre has not reached", () => {
    const player = actor(1.3, 1.5);
    slideMove(map, player, 1.1, 1.5, { radius: PLAYER_RADIUS });
    expect(player.x).toBe(1.3);
  });
});

describe("circleHitsWall", () => {
  it("ignores radius zero and tests the centre only", () => {
    expect(circleHitsWall(map, 1.3, 1.5, 0)).toBe(false);
    expect(circleHitsWall(map, 0.4, 1.5, 0)).toBe(true);
  });

  it("flags a body whose rim overlaps a wall cell", () => {
    expect(circleHitsWall(map, 1.1, 1.5, PLAYER_RADIUS)).toBe(true);
    expect(circleHitsWall(map, 1.5, 1.5, PLAYER_RADIUS)).toBe(false);
  });
});

describe("resolveWallOverlap", () => {
  it("pulls a body whose radius overlaps a wall back inside the cell", () => {
    const player = actor(1.05, 1.5);
    resolveWallOverlap(map, player, PLAYER_RADIUS);
    expect(player.x).toBeGreaterThanOrEqual(1 + PLAYER_RADIUS);
    expect(circleHitsWall(map, player.x, player.y, PLAYER_RADIUS)).toBe(false);
  });

  it("leaves a body that is already clear", () => {
    const player = actor(2.5, 2.5);
    resolveWallOverlap(map, player, PLAYER_RADIUS);
    expect(player.x).toBe(2.5);
    expect(player.y).toBe(2.5);
  });
});

describe("separateBodies", () => {
  it("pushes overlapping living enemies apart", () => {
    const a = foe(4.5, 4.5);
    const b = foe(4.6, 4.5);
    separateBodies([a, b], 0.7);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.7 - 1e-9);
  });

  it("ignores corpses", () => {
    const a = foe(4.5, 4.5);
    const b = foe(4.55, 4.5, 0);
    const ax = a.x;
    separateBodies([a, b], 0.7);
    expect(a.x).toBe(ax);
  });
});
