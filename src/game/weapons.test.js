import { describe, expect, it } from "vitest";
import {
  AMMO_BULLETS,
  WEAPONS,
  WEAPON_SLOTS,
  nextWeaponId,
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
});
