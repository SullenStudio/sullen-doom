import { lightLevel } from "./palette.js";
import { projectSprite } from "./sprites.js";

/**
 * Particles are points in the world, so they go through the same camera
 * matrix as sprites and are depth-tested against the wall z-buffer.
 *
 * Vertical placement matches the wall projection: a wall of unit height at
 * distance d spans horizon ± h/(2d), so a point at height z lands on
 * horizon + h*(0.5 - z)/d. Sharing that formula is what keeps blood on the
 * floor from floating above it.
 */
export function renderParticles(fb, camera, particles, options) {
  const { shadeTable, paletteSize, zbuf, horizon, lightBoost } = options;
  const { width, height, data } = fb;

  for (const q of particles.items) {
    if (q.life <= 0) continue;
    const p = projectSprite(camera, q.x, q.y);
    if (!p) continue;

    const centreX = Math.round(p.screenX * width);
    if (centreX < 0 || centreX >= width) continue;
    if (p.depth >= zbuf[centreX]) continue;

    const centreY = Math.round(horizon + (height * (0.5 - q.z)) / p.depth);
    const size = Math.max(1, Math.round((height * 0.014) / p.depth));
    const half = size >> 1;

    // Clamp each edge against the unclamped bounds. Deriving the far edge
    // from the already-clamped near edge would pin a particle that is far
    // off-screen to the border instead of dropping it.
    const left = centreX - half;
    const top = centreY - half;
    const x0 = Math.max(0, left);
    const y0 = Math.max(0, top);
    const x1 = Math.min(width, left + size);
    const y1 = Math.min(height, top + size);
    if (x0 >= x1 || y0 >= y1) continue;

    const color = shadeTable[lightLevel(p.depth, 0, lightBoost) * paletteSize + q.colorIndex];
    for (let y = y0; y < y1; y++) {
      const row = y * width;
      for (let x = x0; x < x1; x++) data[row + x] = color;
    }
  }
}
