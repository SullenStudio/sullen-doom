/**
 * Player collision radius, in map cells. Combined with ENEMY_RADIUS this is
 * the gap the walk code refuses to close, so a living enemy is a solid body
 * instead of a sprite you can stroll through.
 */
export const PLAYER_RADIUS = 0.2;

function overlapsBody(x, y, bodies, minDist) {
  if (!bodies || minDist <= 0) return false;
  for (const body of bodies) {
    if (body.hp <= 0) continue;
    if (Math.hypot(x - body.x, y - body.y) < minDist) return true;
  }
  return false;
}

/**
 * Move one axis at a time so a blocked step can still slide along a wall
 * or around an enemy, matching the old walk rule.
 */
export function slideMove(map, actor, nx, ny, { blockers = [], minDist = 0 } = {}) {
  if (!map.isSolidAt(nx, actor.y) && !overlapsBody(nx, actor.y, blockers, minDist)) {
    actor.x = nx;
  }
  if (!map.isSolidAt(actor.x, ny) && !overlapsBody(actor.x, ny, blockers, minDist)) {
    actor.y = ny;
  }
}

/**
 * Nudge overlapping living bodies apart so they cannot occupy one point.
 * Wall resolution is left to the next walk step.
 */
export function separateBodies(bodies, minDist) {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;
      if (dist < 1e-6) {
        b.x += minDist * 0.5;
        continue;
      }
      const push = (minDist - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}

