// Every weapon is a row in this table rather than a branch in the firing
// code. The launcher and plasma gun still need a projectile kind; shotgun
// and chaingun are extra hitscan rows.

export const AMMO_BULLETS = "bullets";
export const AMMO_SHELLS = "shells";

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
    shake: 0.15,
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
    reloadTime: 1.9,
    knockback: 0.14,
    shake: 0.3,
    lightBoost: 0.35,
  },
  shotgun: {
    id: "shotgun",
    name: "SHOTGUN",
    kind: "hitscan",
    damage: 1,
    pellets: 7,
    spread: 0.12,
    range: 14,
    cooldown: 0.72,
    ammo: AMMO_SHELLS,
    magSize: 2,
    reloadTime: 2.6,
    knockback: 0.05,
    shake: 0.55,
    lightBoost: 0.6,
  },
  chaingun: {
    id: "chaingun",
    name: "CHAINGUN",
    kind: "hitscan",
    damage: 1,
    pellets: 1,
    spread: 0.03,
    spreadHeat: 0.14,
    range: 18,
    cooldown: 0.07,
    ammo: AMMO_BULLETS,
    magSize: 40,
    reloadTime: 3.2,
    knockback: 0.08,
    shake: 0.22,
    lightBoost: 0.28,
  },
};

/** Index + 1 is the number key that selects the weapon. */
export const WEAPON_SLOTS = ["pipe", "pistol", "shotgun", "chaingun"];

/** What the player carries at the start of a campaign. */
export const STARTING_WEAPONS = ["pipe", "pistol"];

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

/**
 * Cycles through the weapons the player actually carries. `owned` defaults
 * to every slot so callers that have not started tracking loadouts still
 * wrap the full table.
 */
export function nextWeaponId(id, step, owned = WEAPON_SLOTS) {
  const pool = WEAPON_SLOTS.filter((slot) => owned.includes(slot));
  const carried = pool.length ? pool : STARTING_WEAPONS;
  const at = carried.indexOf(id);
  if (at < 0) return carried[0];
  return carried[(at + step + carried.length) % carried.length];
}

export function startingOwned() {
  return STARTING_WEAPONS.slice();
}

export function startingMags() {
  const mags = {};
  for (const id of STARTING_WEAPONS) {
    const weapon = WEAPONS[id];
    if (weapon.kind === "hitscan") mags[id] = weapon.magSize;
  }
  return mags;
}

export function startingReserves() {
  return {
    [AMMO_BULLETS]: 24,
    [AMMO_SHELLS]: 0,
  };
}

export function magOf(mags, weapon) {
  return mags[weapon.id] ?? 0;
}

export function reserveOf(reserves, weapon) {
  return weapon.ammo ? (reserves[weapon.ammo] ?? 0) : 0;
}
