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

  // k counts rows away from the horizon on both sides at once: row
  // `horizon + k` is the k-th floor row below it, and its mirror on the
  // ceiling side is `horizon - k - 1` (the "-1" is not an off-by-one to
  // clean up — the horizon itself sits on the boundary between those two
  // rows, not inside either one, so the row immediately below it and the
  // row immediately above it are each one step removed from that boundary,
  // not zero).
  //
  // The two sides need different numbers of rows once the horizon isn't at
  // height / 2 (shake, or simply an even buffer height, moves it there),
  // so the loop runs as long as whichever side needs more and each write is
  // guarded on its own. Without that, sizing the loop to the floor side
  // alone — as if the two were always equal — silently drops however many
  // rows the ceiling side is longer by, leaving them on the dark prefill.
  // That gap is real: it is not masked by the walls, which centre on the
  // horizon rather than reaching all the way to the buffer edge.
  const floorSpan = height - 1 - horizon;
  const ceilSpan = horizon;
  const maxK = Math.max(floorSpan, ceilSpan);

  for (let k = 1; k <= maxK; k++) {
    const rowDist = eyeHeight / k;

    const stepX = (rowDist * (rayDirX1 - rayDirX0)) / width;
    const stepY = (rowDist * (rayDirY1 - rayDirY0)) / width;
    let worldX = camera.x + rowDist * rayDirX0;
    let worldY = camera.y + rowDist * rayDirY0;

    const shadeBase = lightLevel(rowDist, 0, lightBoost) * paletteSize;

    const y = horizon + k;
    const ceilY = horizon - k - 1;
    const drawFloor = y < height;
    const drawCeil = ceilY >= 0;
    const floorRow = y * width;
    const ceilRow = ceilY * width;

    for (let x = 0; x < width; x++) {
      const fx = Math.floor(worldX * floorSize) & floorMask;
      const fy = Math.floor(worldY * floorSize) & floorMask;
      const cx = Math.floor(worldX * ceilSize) & ceilMask;
      const cy = Math.floor(worldY * ceilSize) & ceilMask;

      if (drawFloor) {
        data[floorRow + x] =
          shadeTable[shadeBase + floorTex.pixels[fy * floorSize + fx]];
      }
      if (drawCeil) {
        data[ceilRow + x] =
          shadeTable[shadeBase + ceilingTex.pixels[cy * ceilSize + cx]];
      }

      worldX += stepX;
      worldY += stepY;
    }
  }
}
