import { describe, expect, it } from "vitest";
import {
  AMMO_BULLETS,
  AMMO_SHELLS,
  WEAPONS,
  WEAPON_SLOTS,
  nextWeaponId,
  startingMags,
  startingReserves,
  weaponById,
  weaponBySlot,
} from "./weapons.js";

describe("WEAPONS", () => {
  it("keys every entry by its own id", () => {
    for (const [key, weapon] of Object.entries(WEAPONS)) {
      expect(weapon.id).toBe(key);
    }
  });

  it("gives every weapon the fields the firing code always reads", () => {
    for (const weapon of Object.values(WEAPONS)) {
      expect(typeof weapon.name).toBe("string");
      expect(weapon.damage).toBeGreaterThan(0);
      expect(weapon.range).toBeGreaterThan(0);
      expect(weapon.cooldown).toBeGreaterThan(0);
      expect(weapon.knockback).toBeGreaterThanOrEqual(0);
      expect(weapon.shake).toBeGreaterThanOrEqual(0);
      expect(weapon.lightBoost).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives melee weapons an arc and a swing time", () => {
    for (const weapon of Object.values(WEAPONS)) {
      if (weapon.kind !== "melee") continue;
      expect(weapon.arc).toBeGreaterThan(0);
      expect(weapon.swingTime).toBeGreaterThan(0);
    }
  });

  it("gives hitscan weapons ammo, a magazine and a pellet count", () => {
    for (const weapon of Object.values(WEAPONS)) {
      if (weapon.kind !== "hitscan") continue;
      expect(typeof weapon.ammo).toBe("string");
      expect(weapon.magSize).toBeGreaterThan(0);
      expect(weapon.reloadTime).toBeGreaterThan(0);
      expect(weapon.pellets).toBeGreaterThanOrEqual(1);
      expect(weapon.spread).toBeGreaterThanOrEqual(0);
    }
  });

  it("only uses kinds the combat code knows", () => {
    for (const weapon of Object.values(WEAPONS)) {
      expect(["melee", "hitscan"]).toContain(weapon.kind);
    }
  });

  it("starts the player on a weapon that never runs out", () => {
    expect(WEAPONS[WEAPON_SLOTS[0]].kind).toBe("melee");
  });
});

describe("WEAPON_SLOTS", () => {
  it("names only weapons that exist", () => {
    for (const id of WEAPON_SLOTS) expect(WEAPONS[id]).toBeDefined();
  });

  it("has no duplicates", () => {
    expect(new Set(WEAPON_SLOTS).size).toBe(WEAPON_SLOTS.length);
  });

  it("offers pipe, pistol, shotgun and chaingun in that order", () => {
    expect(WEAPON_SLOTS).toEqual(["pipe", "pistol", "shotgun", "chaingun"]);
  });
});

describe("weaponBySlot", () => {
  it("maps the number keys one-based", () => {
    expect(weaponBySlot(1).id).toBe(WEAPON_SLOTS[0]);
    expect(weaponBySlot(2).id).toBe(WEAPON_SLOTS[1]);
  });

  it("returns null for a slot nobody carries", () => {
    expect(weaponBySlot(0)).toBe(null);
    expect(weaponBySlot(9)).toBe(null);
    expect(weaponBySlot(-1)).toBe(null);
  });
});

describe("weaponById", () => {
  it("finds a known weapon and rejects an unknown one", () => {
    expect(weaponById(WEAPON_SLOTS[0]).id).toBe(WEAPON_SLOTS[0]);
    expect(weaponById("railgun")).toBe(null);
  });

  it("does not mistake an inherited property for a weapon", () => {
    // A plain object literal answers for keys it never declared.
    for (const id of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      expect(weaponById(id)).toBe(null);
    }
  });
});

describe("nextWeaponId", () => {
  it("steps forward and wraps", () => {
    const last = WEAPON_SLOTS[WEAPON_SLOTS.length - 1];
    expect(nextWeaponId(WEAPON_SLOTS[0], 1)).toBe(WEAPON_SLOTS[1]);
    expect(nextWeaponId(last, 1)).toBe(WEAPON_SLOTS[0]);
  });

  it("steps backward and wraps", () => {
    const last = WEAPON_SLOTS[WEAPON_SLOTS.length - 1];
    expect(nextWeaponId(WEAPON_SLOTS[0], -1)).toBe(last);
  });

  it("falls back to the first slot for an unknown id", () => {
    expect(nextWeaponId("railgun", 1)).toBe(WEAPON_SLOTS[0]);
  });
});

describe("ammo", () => {
  it("names the bullet pool the pistol draws from", () => {
    expect(WEAPONS.pistol.ammo).toBe(AMMO_BULLETS);
  });

  it("puts the shotgun on its own shell pool", () => {
    expect(WEAPONS.shotgun.ammo).toBe(AMMO_SHELLS);
    expect(WEAPONS.shotgun.pellets).toBe(7);
    expect(WEAPONS.shotgun.spread).toBeGreaterThan(0);
  });

  it("lets the chaingun share bullets with the pistol", () => {
    expect(WEAPONS.chaingun.ammo).toBe(AMMO_BULLETS);
    expect(WEAPONS.chaingun.cooldown).toBeLessThan(WEAPONS.pistol.cooldown);
    expect(WEAPONS.chaingun.spreadHeat).toBeGreaterThan(0);
  });

  it("starts every hitscan weapon with a full magazine", () => {
    const mags = startingMags();
    for (const id of WEAPON_SLOTS) {
      const weapon = WEAPONS[id];
      if (weapon.kind !== "hitscan") {
        expect(mags[id]).toBeUndefined();
        continue;
      }
      expect(mags[id]).toBe(weapon.magSize);
    }
  });

  it("starts with a reserve for every ammo type in the table", () => {
    const reserves = startingReserves();
    expect(reserves[AMMO_BULLETS]).toBeGreaterThan(0);
    expect(reserves[AMMO_SHELLS]).toBeGreaterThan(0);
  });
});
