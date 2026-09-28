// Every weapon is a row in this table rather than a branch in the firing
// code. Phase 2B adds the shotgun, machine gun, launcher and plasma gun as
// four more entries, and the code that fires them does not change.

export const AMMO_BULLETS = "bullets";

export const WEAPONS = {
  pipe: {
    id: "pipe",
    name: "PIPE",
    kind: "melee",
    damage: 2,
    range: 1.45,
    // Half-angle of the swing, in radians. A swing sweeps; it is not a bullet.
    arc: 0.5,
    cooldown: 0.34,
    swingTime: 0.34,
    knockback: 0.22,
    shake: 0.1,
    lightBoost: 0,
  },
  pistol: {
    id: "pistol",
    name: "PISTOL",
    kind: "hitscan",
    damage: 1,
    pellets: 1,
    spread: 0,
    range: 20,
    cooldown: 0.16,
    ammo: AMMO_BULLETS,
    magSize: 8,
    reloadTime: 0.85,
    knockback: 0.14,
    shake: 0.18,
    lightBoost: 0.35,
  },
};

/** Index + 1 is the number key that selects the weapon. */
export const WEAPON_SLOTS = ["pipe", "pistol"];

export function weaponBySlot(slot) {
  const id = WEAPON_SLOTS[slot - 1];
  return id ? WEAPONS[id] : null;
}

export function weaponById(id) {
  // Own properties only. A plain object literal answers for inherited keys,
  // so a bare lookup would hand back Object.prototype.toString for the id
  // "toString" instead of null.
  return Object.hasOwn(WEAPONS, id) ? WEAPONS[id] : null;
}

/** Cycles through the carried weapons; `step` is +1 or -1. */
export function nextWeaponId(id, step) {
  const at = WEAPON_SLOTS.indexOf(id);
  if (at < 0) return WEAPON_SLOTS[0];
  const count = WEAPON_SLOTS.length;
  return WEAPON_SLOTS[(at + step + count) % count];
}
