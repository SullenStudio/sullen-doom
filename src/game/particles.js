/**
 * A fixed pool of short-lived world points: blood from a struck enemy,
 * chips from a wall. Nothing is allocated during a frame — the pool is
 * built once and a ring cursor lets a new burst overwrite the oldest
 * particles rather than growing without bound.
 *
 * `z` is height above the floor in the same units the renderer uses for
 * wall height: 0 is the floor, 1 is the ceiling.
 */

const GRAVITY = 2.6;
/** Height at which a particle stops falling and starts sliding to a halt. */
const REST_Z = 0.02;
const FLOOR_DRAG = 0.4;

export function createParticles(capacity = 192) {
  const items = [];
  for (let i = 0; i < capacity; i++) {
    items.push({
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 1,
      colorIndex: 0,
    });
  }
  let cursor = 0;

  return {
    capacity,
    items,

    clear() {
      for (const q of items) q.life = 0;
    },

    spawnBurst(x, y, z, dirX, dirY, count, options) {
      const {
        colorIndex,
        speed = 2.2,
        spread = 0.8,
        life = 0.5,
        lift = 1.2,
        random = Math.random,
      } = options;
      const base = Math.atan2(dirY, dirX);
      for (let i = 0; i < count; i++) {
        const q = items[cursor];
        cursor = (cursor + 1) % capacity;
        const angle = base + (random() * 2 - 1) * spread;
        const s = speed * (0.4 + random() * 0.6);
        q.x = x;
        q.y = y;
        q.z = z;
        q.vx = Math.cos(angle) * s;
        q.vy = Math.sin(angle) * s;
        q.vz = lift * (0.5 + random());
        q.maxLife = life * (0.6 + random() * 0.8);
        q.life = q.maxLife;
        q.colorIndex = colorIndex;
      }
    },

    update(dt, map) {
      for (const q of items) {
        if (q.life <= 0) continue;
        q.life -= dt;
        if (q.life <= 0) continue;

        q.vz -= GRAVITY * dt;

        // Axis at a time, the same rule the walk code uses, so a particle
        // slides along a wall instead of stopping dead or tunnelling.
        const nx = q.x + q.vx * dt;
        if (map.isSolidAt(nx, q.y)) q.vx = 0;
        else q.x = nx;
        const ny = q.y + q.vy * dt;
        if (map.isSolidAt(q.x, ny)) q.vy = 0;
        else q.y = ny;

        q.z += q.vz * dt;
        if (q.z <= REST_Z) {
          q.z = REST_Z;
          q.vz = 0;
          q.vx *= FLOOR_DRAG;
          q.vy *= FLOOR_DRAG;
        }
      }
    },

    activeCount() {
      let n = 0;
      for (const q of items) if (q.life > 0) n++;
      return n;
    },
  };
}
