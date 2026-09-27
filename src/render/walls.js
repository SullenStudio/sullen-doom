import { lightLevel } from "./palette.js";
import { castColumn } from "./raycast.js";

/**
 * Draws one textured column per screen pixel and records its depth.
 *
 * Call this after the floor pass: walls overwrite the floor where they
 * stand, which is cheaper than working out the exact floor span first.
 */
export function renderWalls(fb, map, camera, textures, options) {
  const { shadeTable, paletteSize, zbuf, maxDist, lightBoost, horizon } = options;
  const { width, height, data } = fb;

  for (let x = 0; x < width; x++) {
    const cameraX = (2 * x) / width - 1;
    const ray = castColumn(map, camera, cameraX, maxDist);
    if (!ray.hit) {
      zbuf[x] = Infinity;
      continue;
    }
    zbuf[x] = ray.dist;

    const lineHeight = Math.round(height / ray.dist);
    const top = horizon - (lineHeight >> 1);
    const bottom = top + lineHeight;

    const tex = textures[map.textureAt(ray.mapX, ray.mapY)];
    const texSize = tex.size;
    let texX = Math.floor(ray.texU * texSize);
    if (texX >= texSize) texX = texSize - 1;

    const shadeBase = lightLevel(ray.dist, ray.side, lightBoost) * paletteSize;
    const texStep = texSize / lineHeight;

    const yStart = top < 0 ? 0 : top;
    const yEnd = bottom > height ? height : bottom;
    // Skipping the clipped-off top of a tall column keeps the texture
    // anchored: without this the texture would slide as the player walks
    // into a wall.
    let texPos = (yStart - top) * texStep;
    let index = yStart * width + x;

    for (let y = yStart; y < yEnd; y++) {
      let texY = texPos | 0;
      if (texY >= texSize) texY = texSize - 1;
      texPos += texStep;
      data[index] = shadeTable[shadeBase + tex.pixels[texY * texSize + texX]];
      index += width;
    }
  }
}
