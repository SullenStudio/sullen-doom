/**
 * Digital differential analyser. Steps from grid line to grid line instead
 * of crawling along the ray in tiny increments, so a cast costs about twenty
 * iterations and — crucially — lands on an exact surface point, which is
 * what makes texturing possible at all.
 *
 * The camera carries a direction vector and a plane vector to its right.
 * A screen column maps to `cameraX` in [-1, 1] and the ray is
 * `dir + plane * cameraX`. Walls, floors and sprites all share this frame,
 * which is what keeps them aligned with each other.
 */
export function makeCamera(x, y, angle, fov) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const half = Math.tan(fov / 2);
  // Right-hand vector for this game's convention: forward is (cos, sin) and
  // strafe-right is (-sin, cos).
  return {
    x,
    y,
    angle,
    dirX,
    dirY,
    planeX: -dirY * half,
    planeY: dirX * half,
  };
}

export function castColumn(map, camera, cameraX, maxDist = 32) {
  const rayDirX = camera.dirX + camera.planeX * cameraX;
  const rayDirY = camera.dirY + camera.planeY * cameraX;

  let mapX = Math.floor(camera.x);
  let mapY = Math.floor(camera.y);

  const deltaX = Math.abs(rayDirX) < 1e-9 ? Infinity : Math.abs(1 / rayDirX);
  const deltaY = Math.abs(rayDirY) < 1e-9 ? Infinity : Math.abs(1 / rayDirY);

  let stepX;
  let stepY;
  let sideDistX;
  let sideDistY;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (camera.x - mapX) * deltaX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - camera.x) * deltaX;
  }
  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (camera.y - mapY) * deltaY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - camera.y) * deltaY;
  }

  // Standing inside a wall would otherwise let the ray escape the level.
  if (map.isSolid(mapX, mapY)) {
    return {
      hit: true, dist: 0.01, side: 0, texU: 0, mapX, mapY, rayDirX, rayDirY,
    };
  }

  let side = 0;
  let travelled = 0;
  let hit = false;
  while (travelled < maxDist) {
    if (sideDistX < sideDistY) {
      travelled = sideDistX;
      sideDistX += deltaX;
      mapX += stepX;
      side = 0;
    } else {
      travelled = sideDistY;
      sideDistY += deltaY;
      mapY += stepY;
      side = 1;
    }
    if (map.isSolid(mapX, mapY)) {
      hit = true;
      break;
    }
  }

  if (!hit) {
    return {
      hit: false, dist: maxDist, side, texU: 0, mapX, mapY, rayDirX, rayDirY,
    };
  }

  const dist = side === 0
    ? (mapX - camera.x + (1 - stepX) / 2) / rayDirX
    : (mapY - camera.y + (1 - stepY) / 2) / rayDirY;

  let texU = side === 0
    ? camera.y + dist * rayDirY
    : camera.x + dist * rayDirX;
  texU -= Math.floor(texU);
  // Mirror two of the four facings so texture U always grows left to right
  // as seen by the player. This game's plane is (-dirY, dirX), which swaps
  // which two facings need mirroring compared to the standard (dirY, -dirX).
  if ((side === 0 && rayDirX < 0) || (side === 1 && rayDirY > 0)) {
    texU = 1 - texU;
  }
  if (texU >= 1) texU = 0.999999;

  return { hit: true, dist, side, texU, mapX, mapY, rayDirX, rayDirY };
}
