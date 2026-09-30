import { describe, expect, it, vi } from "vitest";
import { parseMap } from "./map.js";
import { createGameState, createHudBinding } from "./state.js";

const parsed = parseMap([
  "#####",
  "#.E.#",
  "#.P.#",
  "#.E.#",
  "#####",
]);

describe("createGameState", () => {
  it("starts the player where the map says", () => {
    const s = createGameState(parsed);
    expect(s.player.x).toBe(2.5);
    expect(s.player.y).toBe(2.5);
  });

  it("spawns one enemy per marker", () => {
    const s = createGameState(parsed);
    expect(s.enemies.length).toBe(2);
    expect(s.enemies.every((e) => e.hp > 0)).toBe(true);
  });

  it("starts loaded and unhurt", () => {
    const s = createGameState(parsed);
    expect(s.hp).toBe(100);
    expect(s.kills).toBe(0);
    expect(s.phase).toBe("menu");
    expect(s.mags.pistol).toBeGreaterThan(0);
    expect(s.mags.shotgun).toBeUndefined();
    expect(s.owned).toEqual(["pipe", "pistol"]);
    expect(s.pickups).toEqual([]);
    expect(s.reserves.bullets).toBeGreaterThan(0);
    expect(s.reserves.shells).toBe(0);
  });

  it("does not share magazines between pistol and shotgun after a find", () => {
    const s = createGameState(parsed);
    s.owned.push("shotgun");
    s.mags.shotgun = 2;
    s.mags.pistol = 1;
    expect(s.mags.shotgun).toBe(2);
  });

  it("shares the bullet reserve between pistol and chaingun", () => {
    const s = createGameState(parsed);
    const before = s.reserves.bullets;
    s.reserves.bullets -= 5;
    expect(s.reserves.bullets).toBe(before - 5);
  });

  it("gives every reset a fresh enemy list", () => {
    const s = createGameState(parsed);
    s.enemies[0].hp = 0;
    s.reset();
    expect(s.enemies.every((e) => e.hp > 0)).toBe(true);
    expect(s.phase).toBe("play");
  });

  it("does not share enemy objects between resets", () => {
    const s = createGameState(parsed);
    const first = s.enemies[0];
    s.reset();
    expect(s.enemies[0]).not.toBe(first);
  });

  it("keeps the loadout when entering another map", () => {
    const s = createGameState(parsed);
    s.reset();
    s.hp = 41;
    s.mags.pistol = 2;
    s.weapon = "shotgun";
    s.owned.push("shotgun");
    s.kills = 3;
    const next = parseMap(["#####", "#P..#", "#..X#", "#####"]);
    s.enter(next, { keepLoadout: true });
    expect(s.hp).toBe(41);
    expect(s.mags.pistol).toBe(2);
    expect(s.weapon).toBe("shotgun");
    expect(s.owned).toContain("shotgun");
    expect(s.kills).toBe(3);
    expect(s.player.x).toBe(1.5);
    expect(s.enemies).toHaveLength(0);
  });

  it("restores a full loadout when not keeping it", () => {
    const s = createGameState(parsed);
    s.reset();
    s.hp = 10;
    s.mags.pistol = 1;
    const next = parseMap(["#####", "#P..#", "#####"]);
    s.enter(next, { keepLoadout: false });
    expect(s.hp).toBe(100);
    expect(s.mags.pistol).toBeGreaterThan(1);
    expect(s.weapon).toBe("pistol");
    expect(s.owned).toEqual(["pipe", "pistol"]);
    expect(s.kills).toBe(0);
  });

  it("clears floor pickups when entering a map", () => {
    const s = createGameState(parsed);
    s.pickups.push({ x: 1, y: 1, kind: "health", amount: 25, taken: false });
    s.enter(parsed, { keepLoadout: true });
    expect(s.pickups).toEqual([]);
  });
});

describe("createHudBinding", () => {
  const makeElements = () => ({
    hp: { textContent: "" },
    ammo: { textContent: "" },
    kills: { textContent: "" },
  });

  it("writes every field on the first sync", () => {
    const el = makeElements();
    createHudBinding(el).sync({ hp: "HP 100", ammo: "AMMO 8/40", kills: "KILLS 0" });
    expect(el.hp.textContent).toBe("HP 100");
    expect(el.ammo.textContent).toBe("AMMO 8/40");
    expect(el.kills.textContent).toBe("KILLS 0");
  });

  it("does not touch the DOM when nothing changed", () => {
    const el = makeElements();
    const binding = createHudBinding(el);
    const values = { hp: "HP 100", ammo: "AMMO 8/40", kills: "KILLS 0" };
    binding.sync(values);
    const spy = vi.fn();
    Object.defineProperty(el.hp, "textContent", { set: spy, get: () => "HP 100" });
    binding.sync(values);
    expect(spy).not.toHaveBeenCalled();
  });

  it("writes only the field that changed", () => {
    const el = makeElements();
    const binding = createHudBinding(el);
    binding.sync({ hp: "HP 100", ammo: "AMMO 8/40", kills: "KILLS 0" });
    binding.sync({ hp: "HP 90", ammo: "AMMO 8/40", kills: "KILLS 0" });
    expect(el.hp.textContent).toBe("HP 90");
    expect(el.ammo.textContent).toBe("AMMO 8/40");
  });
});
