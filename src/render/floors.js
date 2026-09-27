import { lightLevel } from "./palette.js";

/**
 * Horizontal texture mapping for the floor and ceiling.
 *
 * Every screen row below the horizon corresponds to one constant distance
 * from the camera, so the texture coordinate can be stepped linearly across
 * the row. One row of work replaces one ray per pixel. The ceiling is the
 * same row mirrored about the horizon.
 *
 * Runs before the wall pass and covers the whole buffer; walls then paint
 * over it.
 */
export function renderFloorCeiling(fb, camera, floorTex, ceilingTex, options) {
  const { shadeTable, paletteSize, lightBoost, horizon } = options;
  const { width, height, data } = fb;

  // Rays through the left and right edges of the screen.
  const rayDirX0 = camera.dirX - camera.planeX;
  const rayDirY0 = camera.dirY - camera.planeY;
  const rayDirX1 = camera.dirX + camera.planeX;
  const rayDirY1 = camera.dirY + camera.planeY;

  const floorSize = floorTex.size;
  const ceilSize = ceilingTex.size;
  const floorMask = floorSize - 1;
  const ceilMask = ceilSize - 1;
  // Textures are power-of-two so wrapping is a bitwise AND. Guard the
  // assumption rather than silently drawing garbage.
  if ((floorSize & floorMask) !== 0 || (ceilSize & ceilMask) !== 0) {
    throw new Error("floor and ceiling textures must be power-of-two sized");
  }

  const eyeHeight = 0.5 * height;

  // Start everything in the dark. The loop below cannot reach the horizon
  // row (its distance is infinite) nor the row mirroring it, and leaving
  // those as uninitialised zero would punch two transparent lines across
  // the screen.
  data.fill(shadeTable[0]);

  for (let y = horizon + 1; y < height; y++) {
    const rowDist = eyeHeight / (y - horizon);

    const stepX = (rowDist * (rayDirX1 - rayDirX0)) / width;
    const stepY = (rowDist * (rayDirY1 - rayDirY0)) / width;
    let worldX = camera.x + rowDist * rayDirX0;
    let worldY = camera.y + rowDist * rayDirY0;

    const shadeBase = lightLevel(rowDist, 0, lightBoost) * paletteSize;
    const floorRow = y * width;
    const ceilRow = (height - y - 1) * width;

    for (let x = 0; x < width; x++) {
      const fx = Math.floor(worldX * floorSize) & floorMask;
      const fy = Math.floor(worldY * floorSize) & floorMask;
      const cx = Math.floor(worldX * ceilSize) & ceilMask;
      const cy = Math.floor(worldY * ceilSize) & ceilMask;

      data[floorRow + x] =
        shadeTable[shadeBase + floorTex.pixels[fy * floorSize + fx]];
      data[ceilRow + x] =
        shadeTable[shadeBase + ceilingTex.pixels[cy * ceilSize + cx]];

      worldX += stepX;
      worldY += stepY;
    }
  }
}
