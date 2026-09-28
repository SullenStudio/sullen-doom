import { TRANSPARENT, rgb } from "./palette.js";

/**
 * Copies an indexed bitmap into the framebuffer. `255` is transparent.
 * Scale is nearest-neighbour so the weapon stays chunky at any buffer size.
 */
export function blitIndexed(fb, bitmap, destX, destY, scaleX, scaleY, colorAt) {
  const sx = Math.max(1, scaleX | 0);
  const sy = Math.max(1, scaleY | 0);
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const index = bitmap.pixels[y * bitmap.width + x];
      if (index === TRANSPARENT) continue;
      fb.fillRect(destX + x * sx, destY + y * sy, sx, sy, colorAt(index));
    }
  }
}

/**
 * Copies an RGBA sprite into the framebuffer. Alpha below 16 is skipped.
 * `destW`/`destH` size the blit; sampling is nearest-neighbour so a 100px
 * gun still looks like pixels when stretched onto the 480-wide buffer.
 */
export function blitRgba(fb, sprite, destX, destY, destW, destH) {
  const dw = destW | 0;
  const dh = destH | 0;
  if (dw <= 0 || dh <= 0) return;
  const srcW = sprite.width;
  const srcH = sprite.height;
  const rgba = sprite.rgba;
  if (!(srcW > 0) || !(srcH > 0)) return;

  const data = fb.data;
  const fbW = fb.width;
  const fbH = fb.height;
  const x0 = destX | 0;
  const y0 = destY | 0;

  for (let y = 0; y < dh; y++) {
    const fy = y0 + y;
    if (fy < 0 || fy >= fbH) continue;
    const srcY = Math.min(srcH - 1, ((y * srcH) / dh) | 0);
    for (let x = 0; x < dw; x++) {
      const fx = x0 + x;
      if (fx < 0 || fx >= fbW) continue;
      const srcX = Math.min(srcW - 1, ((x * srcW) / dw) | 0);
      const i = (srcY * srcW + srcX) * 4;
      if (rgba[i + 3] < 16) continue;
      data[fy * fbW + fx] = rgb(rgba[i], rgba[i + 1], rgba[i + 2]);
    }
  }
}

/**
 * Packs a character picture into an indexed bitmap.
 * Unknown characters are transparent.
 */
export function bitmapFromRows(rows, legend) {
  const height = rows.length;
  const width = rows.reduce((w, row) => Math.max(w, row.length), 0);
  const pixels = new Uint8Array(width * height);
  pixels.fill(TRANSPARENT);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === " " || ch === ".") continue;
      const index = legend[ch];
      if (index === undefined) continue;
      pixels[y * width + x] = index;
    }
  }
  return { width, height, pixels };
}
