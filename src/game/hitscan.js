import { castColumn } from "../render/raycast.js";

/**
 * Enemies are hit-tested as upright cylinders. The radius is a little under
 * half a cell so two of them can stand side by side without their hitboxes
 * overlapping.
 */
export const ENEMY_RADIUS = 0.32;

/**
 * Distance to the first wall along a ray.
 *
 * Reuses the renderer's wall DDA by handing it a camera whose plane is zero,
 * so screen column 0 IS this ray. Because the direction is unit length, the
 * perpendicular distance the cast returns is the plain distance along the
 * ray — the two only differ when the plane spreads the ray away from the
 * view direction.
 */
export function wallDistance(map, ox, oy, dirX, dirY, maxDist) {
  const camera = { x: ox, y: oy, dirX, dirY, planeX: 0, planeY: 0 };
  const hit = castColumn(map, camera, 0, maxDist);
  return hit.hit ? Math.min(hit.dist, maxDist) : maxDist;
}

/** True when the first wall along the segment sits at or beyond the target. */
export function hasLineOfSight(map, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return true;
  return wallDistance(map, ax, ay, dx / dist, dy / dist, dist) >= dist - 1e-3;
}

/**
 * Nearest positive intersection of a ray with a circle, or null.
 *
 * Solves |origin + t*dir - centre|^2 = radius^2. The coefficient on t^2 is
 * the squared length of the direction, which is 1 because callers pass a
 * unit vector, so the quadratic reduces to t^2 + b*t + c = 0.
 */
export function rayCircle(ox, oy, dirX, dirY, cx, cy, radius) {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = 2 * (fx * dirX + fy * dirY);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  let t = (-b - root) / 2;
  // Standing inside the circle puts the near root behind us; use the exit.
  if (t < 0) t = (-b + root) / 2;
  if (t < 0) return null;
  return t;
}

/**
 * Casts one ray and reports the first thing it strikes. Walls and enemies
 * compete on distance, so an enemy behind cover is never hit.
 */
export function castHitscan(
  map,
  ox,
  oy,
  dirX,
  dirY,
  enemies,
  maxDist,
  radius = ENEMY_RADIUS,
) {
  const wall = wallDistance(map, ox, oy, dirX, dirY, maxDist);
  let best = null;
  let bestT = Math.min(wall, maxDist);

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const t = rayCircle(ox, oy, dirX, dirY, enemy.x, enemy.y, radius);
    if (t === null || t >= bestT) continue;
    bestT = t;
    best = enemy;
  }

  if (best) {
    return {
      kind: "enemy",
      enemy: best,
      dist: bestT,
      x: ox + dirX * bestT,
      y: oy + dirY * bestT,
    };
  }
  if (wall < maxDist) {
    return {
      kind: "wall",
      enemy: null,
      dist: wall,
      x: ox + dirX * wall,
      y: oy + dirY * wall,
    };
  }
  return {
    kind: "none",
    enemy: null,
    dist: maxDist,
    x: ox + dirX * maxDist,
    y: oy + dirY * maxDist,
  };
}
