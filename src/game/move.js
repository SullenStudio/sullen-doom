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
