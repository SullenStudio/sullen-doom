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
 * True when the actor's collision circle overlaps a solid cell. Four AABB
 * corners is the Wolf3D test: cheap, and a little conservative at corners.
 */
export function circleHitsWall(map, x, y, radius) {
  if (radius <= 0) return map.isSolidAt(x, y);
  return (
    map.isSolidAt(x - radius, y - radius) ||
    map.isSolidAt(x + radius, y - radius) ||
    map.isSolidAt(x - radius, y + radius) ||
    map.isSolidAt(x + radius, y + radius)
  );
}

/**
 * Move one axis at a time so a blocked step can still slide along a wall
 * or around an enemy, matching the old walk rule.
 */
export function slideMove(map, actor, nx, ny, { blockers = [], minDist = 0, radius = 0 } = {}) {
  const blocked = (x, y) =>
    circleHitsWall(map, x, y, radius) || overlapsBody(x, y, blockers, minDist);
  if (!blocked(nx, actor.y)) actor.x = nx;
  if (!blocked(actor.x, ny)) actor.y = ny;
}

/**
 * If a body has been shoved so its radius overlaps a wall, clamp it into the
 * inner square of its current open cell.
 */
export function resolveWallOverlap(map, actor, radius) {
  if (radius <= 0) return;
  if (!circleHitsWall(map, actor.x, actor.y, radius)) return;
  const cellX = Math.floor(actor.x);
  const cellY = Math.floor(actor.y);
  if (map.isSolid(cellX, cellY)) return;
  const lo = radius + 1e-4;
  const hi = 1 - radius - 1e-4;
  if (hi <= lo) return;
  actor.x = Math.max(cellX + lo, Math.min(cellX + hi, actor.x));
  actor.y = Math.max(cellY + lo, Math.min(cellY + hi, actor.y));
}

/**
 * Nudge overlapping living bodies apart so they cannot occupy one point.
 * Wall resolution is left to resolveWallOverlap after the push.
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
