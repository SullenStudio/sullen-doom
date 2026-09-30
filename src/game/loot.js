import { AMMO_BULLETS, AMMO_SHELLS, WEAPONS } from "./weapons.js";

export const PICKUP_RADIUS = 0.48;
export const MEDKIT_HEAL = 25;
export const MAX_HP = 100;
export const BULLET_DROP = 8;
export const SHELL_DROP = 4;
export const FIND_WEAPONS = ["shotgun", "chaingun"];

export function livingEnemyCount(enemies) {
  let n = 0;
  for (const e of enemies) if (e.hp > 0) n += 1;
  return n;
}

/**
 * One drop per kill. Missing guns are uncommon; the rest is health or ammo.
 * `random` is injectable so the table is testable.
 */
export function rollDrop(random, owned) {
  const missing = FIND_WEAPONS.filter((id) => !owned.includes(id));
  const t = random();
  if (missing.length > 0 && t < 0.16) {
    if (missing.includes("shotgun") && (t < 0.1 || !missing.includes("chaingun"))) {
      return { kind: "weapon", weaponId: "shotgun" };
    }
    return { kind: "weapon", weaponId: missing[missing.length - 1] };
  }
  if (t < 0.45) return { kind: "health", amount: MEDKIT_HEAL };
  if (t < 0.78) return { kind: "ammo", ammo: AMMO_BULLETS, amount: BULLET_DROP };
  return { kind: "ammo", ammo: AMMO_SHELLS, amount: SHELL_DROP };
}

export function makePickup(x, y, drop) {
  return { x, y, taken: false, ...drop };
}

export function applyPickup(state, pickup) {
  if (pickup.taken) return null;
  if (pickup.kind === "health") {
    if (state.hp >= MAX_HP) return null;
    pickup.taken = true;
    const before = state.hp;
    state.hp = Math.min(MAX_HP, state.hp + pickup.amount);
    return { kind: "health", gained: state.hp - before };
  }
  pickup.taken = true;
  if (pickup.kind === "ammo") {
    state.reserves[pickup.ammo] = (state.reserves[pickup.ammo] ?? 0) + pickup.amount;
    return { kind: "ammo", ammo: pickup.ammo, amount: pickup.amount };
  }
  if (pickup.kind === "weapon") {
    if (!state.owned.includes(pickup.weaponId)) state.owned.push(pickup.weaponId);
    const weapon = WEAPONS[pickup.weaponId];
    if (weapon?.kind === "hitscan") {
      state.mags[weapon.id] = weapon.magSize;
      const extra = weapon.ammo === AMMO_SHELLS ? 8 : 20;
      state.reserves[weapon.ammo] = (state.reserves[weapon.ammo] ?? 0) + extra;
    }
    state.weapon = pickup.weaponId;
    return { kind: "weapon", weaponId: pickup.weaponId };
  }
  return null;
}

export function collectPickups(state, radius = PICKUP_RADIUS) {
  const collected = [];
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y) >= radius) continue;
    const result = applyPickup(state, pickup);
    if (result) collected.push(result);
  }
  return collected;
}
