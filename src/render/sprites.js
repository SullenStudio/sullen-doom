import { SHADE_LEVELS, TRANSPARENT, lightLevel } from "./palette.js";

/**
 * Transforms a world point into camera space using the inverse of the
 * [plane | dir] matrix.
 *
 * The old renderer projected sprites by raw angle while projecting walls
 * through a tangent, so the two drifted apart towards the screen edges and
 * an enemy pressed against a wall appeared to float off it. Sharing this
 * matrix with the wall cast is what keeps them locked together.
 *
 * Returns `screenX` as a fraction of screen width so the maths stays
 * resolution independent.
 */
export function projectSprite(camera, worldX, worldY) {
  const relX = worldX - camera.x;
  const relY = worldY - camera.y;
  const det = camera.planeX * camera.dirY - camera.dirX * camera.planeY;
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;

  const transformX = invDet * (camera.dirY * relX - camera.dirX * relY);
  const depth = invDet * (-camera.planeY * relX + camera.planeX * relY);
  if (depth <= 1e-4) return null;

  return { depth, screenX: 0.5 * (1 + transformX / depth) };
}

export function renderSprites(fb, camera, sprites, options) {
  const { shadeTable, paletteSize, zbuf, lightBoost, horizon, scale } = options;
  const { width, height, data } = fb;

  // Far to near: the depth test against zbuf handles walls, but sprites
  // overlapping each other are resolved by paint order.
  const visible = [];
  for (const sprite of sprites) {
    const p = projectSprite(camera, sprite.x, sprite.y);
    if (p) visible.push({ sprite, depth: p.depth, screenX: p.screenX });
  }
  visible.sort((a, b) => b.depth - a.depth);

  for (const { sprite, depth, screenX } of visible) {
    const bitmap = sprite.bitmap;
    const drawH = Math.round((height / depth) * (sprite.scale ?? scale));
    if (drawH <= 0) continue;
    const drawW = Math.round(drawH * (bitmap.width / bitmap.height));
    if (drawW <= 0) continue;

    const centreX = Math.round(screenX * width);
    // Feet sit on the horizon line pushed down by half a wall height, which
    // is where the floor meets a unit-tall wall at this depth.
    const bottom = horizon + Math.round(height / (2 * depth));
    const top = bottom - drawH;

    const left = centreX - (drawW >> 1);
    const xStart = Math.max(0, left);
    const xEnd = Math.min(width, left + drawW);
    const yStart = Math.max(0, top);
    const yEnd = Math.min(height, bottom);

    const flash = sprite.hit > 0;
    const level = flash
      ? SHADE_LEVELS - 1
      : lightLevel(depth, 0, lightBoost);
    const shadeBase = level * paletteSize;

    for (let x = xStart; x < xEnd; x++) {
      if (depth >= zbuf[x]) continue;
      const texX = Math.min(
        bitmap.width - 1,
        Math.floor(((x - left) * bitmap.width) / drawW),
      );
      for (let y = yStart; y < yEnd; y++) {
        const texY = Math.min(
          bitmap.height - 1,
          Math.floor(((y - top) * bitmap.height) / drawH),
        );
        const index = bitmap.pixels[texY * bitmap.width + texX];
        if (index === TRANSPARENT) continue;
        data[y * width + x] = shadeTable[shadeBase + index];
      }
    }
  }
}
