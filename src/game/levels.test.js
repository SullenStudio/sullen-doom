import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { LEVELS, nextLevelIndex } from "./levels.js";

function flood(map, start) {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (map.isSolid(nx, ny) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

describe("LEVELS", () => {
  it("is a campaign of at least three maps", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every map a name, a start and an exit", () => {
    for (const level of LEVELS) {
      expect(level.name.length).toBeGreaterThan(0);
      const parsed = parseMap(level.lines);
      expect(parsed.playerStart).toBeTruthy();
      expect(parsed.exits.length).toBeGreaterThan(0);
    }
  });

  it("lets the player reach the locked gate on every map", () => {
    for (const level of LEVELS) {
      const { map, playerStart, exits } = parseMap(level.lines);
      const start = { x: Math.floor(playerStart.x), y: Math.floor(playerStart.y) };
      const seen = flood(map, start);
      for (const exit of exits) {
        const ex = Math.floor(exit.x);
        const ey = Math.floor(exit.y);
        expect(map.isSolid(ex, ey)).toBe(true);
        const adjacent = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => seen.has(`${ex + dx},${ey + dy}`));
        expect(adjacent).toBe(true);
      }
    }
  });

  it("lets the player walk onto the exit once the gate opens", () => {
    for (const level of LEVELS) {
      const { map, playerStart, exits } = parseMap(level.lines);
      map.openExits();
      const start = { x: Math.floor(playerStart.x), y: Math.floor(playerStart.y) };
      const seen = flood(map, start);
      expect(exits.every((exit) => seen.has(`${Math.floor(exit.x)},${Math.floor(exit.y)}`))).toBe(
        true,
      );
    }
  });
});

describe("nextLevelIndex", () => {
  it("advances through the campaign and then finishes", () => {
    expect(nextLevelIndex(0, LEVELS.length)).toBe(1);
    expect(nextLevelIndex(LEVELS.length - 1, LEVELS.length)).toBe(null);
  });
});
