import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { ENEMY_RADIUS } from "./hitscan.js";
import { PLAYER_RADIUS, slideMove } from "./move.js";

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
});
