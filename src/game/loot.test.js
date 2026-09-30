import { describe, expect, it } from "vitest";
import {
  AMMO_BULLETS,
  AMMO_SHELLS,
  STARTING_WEAPONS,
  startingMags,
  startingOwned,
  startingReserves,
} from "./weapons.js";
import {
  BULLET_DROP,
  MAX_HP,
  MEDKIT_HEAL,
  SHELL_DROP,
  applyPickup,
  collectPickups,
  livingEnemyCount,
  makePickup,
  rollDrop,
} from "./loot.js";

describe("livingEnemyCount", () => {
  it("counts only living enemies", () => {
    expect(livingEnemyCount([{ hp: 8 }, { hp: 0 }, { hp: 3 }])).toBe(2);
    expect(livingEnemyCount([])).toBe(0);
  });
});

describe("rollDrop", () => {
  const starter = STARTING_WEAPONS;

  it("drops a shotgun while it is still missing", () => {
    expect(rollDrop(() => 0, starter)).toEqual({ kind: "weapon", weaponId: "shotgun" });
  });

  it("drops a chaingun once the shotgun is already owned", () => {
    expect(rollDrop(() => 0, [...starter, "shotgun"])).toEqual({
      kind: "weapon",
      weaponId: "chaingun",
    });
  });

  it("drops health when the roll lands in the medkit band", () => {
    expect(rollDrop(() => 0.3, starter)).toEqual({ kind: "health", amount: MEDKIT_HEAL });
  });

  it("drops bullets in the ammo band", () => {
    expect(rollDrop(() => 0.6, starter)).toEqual({
      kind: "ammo",
      ammo: AMMO_BULLETS,
      amount: BULLET_DROP,
    });
  });

  it("drops shells in the late ammo band", () => {
    expect(rollDrop(() => 0.9, starter)).toEqual({
      kind: "ammo",
      ammo: AMMO_SHELLS,
      amount: SHELL_DROP,
    });
  });

  it("does not drop a gun the player already carries", () => {
    const owned = [...starter, "shotgun", "chaingun"];
    expect(rollDrop(() => 0, owned).kind).not.toBe("weapon");
  });
});

describe("applyPickup", () => {
  function loadout() {
    return {
      hp: 70,
      owned: startingOwned(),
      mags: startingMags(),
      reserves: startingReserves(),
      weapon: "pistol",
    };
  }

  it("heals without going past MAX_HP", () => {
    const state = loadout();
    const pickup = makePickup(1, 1, { kind: "health", amount: MEDKIT_HEAL });
    const result = applyPickup(state, pickup);
    expect(result.gained).toBe(MEDKIT_HEAL);
    expect(state.hp).toBe(95);
    expect(pickup.taken).toBe(true);
  });

  it("leaves a medkit on the floor at full health", () => {
    const state = { ...loadout(), hp: MAX_HP };
    const pickup = makePickup(1, 1, { kind: "health", amount: MEDKIT_HEAL });
    expect(applyPickup(state, pickup)).toBe(null);
    expect(pickup.taken).toBe(false);
    expect(state.hp).toBe(MAX_HP);
  });

  it("adds ammo to the matching reserve", () => {
    const state = loadout();
    const before = state.reserves[AMMO_BULLETS];
    applyPickup(state, makePickup(1, 1, { kind: "ammo", ammo: AMMO_BULLETS, amount: 8 }));
    expect(state.reserves[AMMO_BULLETS]).toBe(before + 8);
  });

  it("unlocks a found gun, fills its mag and switches to it", () => {
    const state = loadout();
    applyPickup(state, makePickup(1, 1, { kind: "weapon", weaponId: "shotgun" }));
    expect(state.owned).toContain("shotgun");
    expect(state.mags.shotgun).toBeGreaterThan(0);
    expect(state.reserves[AMMO_SHELLS]).toBeGreaterThan(0);
    expect(state.weapon).toBe("shotgun");
  });
});

describe("collectPickups", () => {
  it("takes a nearby drop and ignores a distant one", () => {
    const state = {
      player: { x: 2.5, y: 2.5 },
      hp: 70,
      owned: startingOwned(),
      mags: startingMags(),
      reserves: startingReserves(),
      weapon: "pistol",
      pickups: [
        makePickup(2.5, 2.5, { kind: "health", amount: MEDKIT_HEAL }),
        makePickup(8, 8, { kind: "ammo", ammo: AMMO_BULLETS, amount: 8 }),
      ],
    };
    const got = collectPickups(state);
    expect(got).toHaveLength(1);
    expect(got[0].kind).toBe("health");
    expect(state.pickups[0].taken).toBe(true);
    expect(state.pickups[1].taken).toBe(false);
  });
});
