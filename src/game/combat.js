import { castHitscan } from "./hitscan.js";

/** How long a struck enemy renders at full brightness. */
export const HIT_FLASH_T = 0.22;

/** Number of rays a melee swing sweeps across its arc. */
const SWING_RAYS = 5;

function shove(map, enemy, dx, dy) {
  // Same axis-at-a-time rule the walk code uses, so knockback can slide
  // along a wall instead of stopping dead or tunnelling through it.
  if (!map.isSolidAt(enemy.x + dx, enemy.y)) enemy.x += dx;
  if (!map.isSolidAt(enemy.x, enemy.y + dy)) enemy.y += dy;
}

/**
 * Casts one ray and applies its damage. Returns a record of what happened,
 * or null if the ray reached nothing worth reporting.
 *
 * `alreadyHit` lets a multi-ray attack — a melee sweep — damage each enemy
 * at most once.
 */
function resolveRay(world, weapon, angle, alreadyHit) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const shot = castHitscan(
    world.map,
    world.player.x,
    world.player.y,
    dirX,
    dirY,
    world.enemies,
    weapon.range,
  );
  if (shot.kind === "none") return null;
  if (shot.kind === "enemy" && alreadyHit.has(shot.enemy)) return null;

  const record = {
    kind: shot.kind,
    x: shot.x,
    y: shot.y,
    dirX,
    dirY,
    enemy: shot.enemy,
    damage: 0,
    killed: false,
  };

  if (shot.kind === "enemy") {
    alreadyHit.add(shot.enemy);
    shot.enemy.hp -= weapon.damage;
    shot.enemy.hit = HIT_FLASH_T;
    shove(world.map, shot.enemy, dirX * weapon.knockback, dirY * weapon.knockback);
    record.damage = weapon.damage;
    record.killed = shot.enemy.hp <= 0;
  }

  return record;
}

/**
 * Fires a hitscan weapon. One ray per pellet, each jittered within the
 * weapon's spread. `random` is injectable so the spread is testable.
 */
export function fireWeapon(world, weapon, random = Math.random) {
  const hits = [];
  const alreadyHit = new Set();
  const pellets = weapon.pellets ?? 1;
  for (let i = 0; i < pellets; i++) {
    const jitter = weapon.spread ? (random() * 2 - 1) * weapon.spread : 0;
    const record = resolveRay(world, weapon, world.player.a + jitter, alreadyHit);
    if (record) hits.push(record);
  }
  return hits;
}

/**
 * Swings a melee weapon. Several rays spread across the arc, because a swing
 * sweeps an area rather than travelling down a line — but each enemy still
 * takes the damage only once.
 */
export function swingMelee(world, weapon) {
  const hits = [];
  const alreadyHit = new Set();
  for (let i = 0; i < SWING_RAYS; i++) {
    const t = SWING_RAYS === 1 ? 0.5 : i / (SWING_RAYS - 1);
    const angle = world.player.a + (t * 2 - 1) * weapon.arc;
    const record = resolveRay(world, weapon, angle, alreadyHit);
    if (record) hits.push(record);
  }
  return hits;
}
