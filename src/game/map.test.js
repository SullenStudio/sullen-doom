import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";

const LINES = [
  "#####",
  "#.P.#",
  "#.E24",
  "#...#",
  "#####",
];

describe("parseMap", () => {
  it("reads the grid size", () => {
    const { map } = parseMap(LINES);
    expect(map.cols).toBe(5);
    expect(map.rows).toBe(5);
  });

  it("rejects a ragged grid", () => {
    expect(() => parseMap(["###", "##"])).toThrow(/rectangular/i);
  });

  it("rejects an empty grid", () => {
    expect(() => parseMap([])).toThrow(/empty/i);
  });

  it("treats walls and digits as solid, floor markers as open", () => {
    const { map } = parseMap(LINES);
    expect(map.isSolid(0, 0)).toBe(true);
    expect(map.isSolid(4, 2)).toBe(true);
    expect(map.isSolid(3, 2)).toBe(true);
    expect(map.isSolid(1, 1)).toBe(false);
    expect(map.isSolid(2, 1)).toBe(false);
    expect(map.isSolid(2, 2)).toBe(false);
  });

  it("treats everything outside the grid as solid", () => {
    const { map } = parseMap(LINES);
    expect(map.isSolid(-1, 0)).toBe(true);
    expect(map.isSolid(0, -1)).toBe(true);
    expect(map.isSolid(5, 0)).toBe(true);
    expect(map.isSolid(0, 5)).toBe(true);
  });

  it("accepts float coordinates through isSolidAt", () => {
    const { map } = parseMap(LINES);
    expect(map.isSolidAt(1.9, 1.1)).toBe(false);
    expect(map.isSolidAt(0.5, 0.5)).toBe(true);
    expect(map.isSolidAt(-0.1, 1.5)).toBe(true);
  });

  it("maps wall digits onto texture slots", () => {
    const { map } = parseMap(LINES);
    expect(map.textureAt(0, 0)).toBe(0);
    expect(map.textureAt(3, 2)).toBe(1);
    expect(map.textureAt(4, 2)).toBe(3);
  });

  it("puts the player in the middle of their cell", () => {
    const { playerStart } = parseMap(LINES);
    expect(playerStart.x).toBe(2.5);
    expect(playerStart.y).toBe(1.5);
    expect(playerStart.angle).toBe(0);
  });

  it("falls back to the first open cell when there is no P", () => {
    const { playerStart } = parseMap(["###", "#.#", "###"]);
    expect(playerStart.x).toBe(1.5);
    expect(playerStart.y).toBe(1.5);
  });

  it("collects enemy spawns at cell centres", () => {
    const { enemySpawns } = parseMap(LINES);
    expect(enemySpawns).toEqual([{ x: 2.5, y: 2.5 }]);
  });

  it("treats X as a walkable exit, not a wall", () => {
    const { map, exits } = parseMap(["#####", "#P.X#", "#####"]);
    expect(map.isSolidAt(3.5, 1.5)).toBe(false);
    expect(map.isExitAt(3.5, 1.5)).toBe(true);
    expect(map.isExitAt(2.5, 1.5)).toBe(false);
    expect(exits).toEqual([{ x: 3.5, y: 1.5 }]);
  });
});
