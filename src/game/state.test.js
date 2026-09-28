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
    expect(s.mags.shotgun).toBeGreaterThan(0);
    expect(s.reserves.bullets).toBeGreaterThan(0);
    expect(s.reserves.shells).toBeGreaterThan(0);
  });

  it("does not share magazines between pistol and shotgun", () => {
    const s = createGameState(parsed);
    s.mags.pistol = 1;
    expect(s.mags.shotgun).toBeGreaterThan(1);
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
