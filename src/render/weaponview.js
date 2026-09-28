import { spriteForView } from "../assets/gunsprites.js";
import { MUZZLE_FLASH, VIEWMODELS } from "../assets/viewmodels.js";
import { blitIndexed, blitRgba } from "./blit.js";
import { ACCENT, SHADE_LEVELS, rgb } from "./palette.js";

const FULL = SHADE_LEVELS - 1;
const MARGIN_BOTTOM_FRAC = 0.05;
const GUN_KICK_FRAC = 0.02;

const LAYOUT = {
  pistol: { widthFrac: 0.3, heightFrac: 0.36, centre: 0.54 },
  shotgun: { widthFrac: 0.44, heightFrac: 0.34, centre: 0.5 },
  chaingun: { widthFrac: 0.4, heightFrac: 0.42, centre: 0.52 },
  pipe: { widthFrac: 0.16, heightFrac: 0.46, anchor: "right" },
};

const SPRITE_LAYOUT = {
  pistol: { widthFrac: 0.4, heightFrac: 0.42, centre: 0.62, hangFrac: 0.7 },
  shotgun: { widthFrac: 0.5, heightFrac: 0.42, centre: 0.55, hangFrac: 0.78 },
  chaingun: { widthFrac: 0.7, heightFrac: 0.38, centre: 0.5, hangFrac: 0.95 },
  pipe: { widthFrac: 0.32, heightFrac: 0.5, anchor: "right", hangFrac: 0.68 },
};

function colorAt(options) {
  return (index) => options.shadeTable[FULL * options.paletteSize + index];
}

function placeWeapon(fb, layout, w, h, view) {
  const { width, height } = fb;
  const marginBottom = Math.round(height * MARGIN_BOTTOM_FRAC);
  if (layout.anchor === "right") {
    const t = view.swing > 0 && view.swingTime > 0 ? 1 - view.swing / view.swingTime : 0;
    const swingPhase = view.swing > 0 ? Math.sin(t * Math.PI) : 0;
    return {
      destX: width - Math.round(width * 0.04) - w - Math.round(swingPhase * width * 0.08),
      destY: height - marginBottom - h - Math.round(swingPhase * height * 0.1),
    };
  }
  const kick = view.cooldown > 0 ? Math.round(height * GUN_KICK_FRAC) : 0;
  return {
    destX: Math.round(width * layout.centre - w / 2),
    destY: height - marginBottom - h + kick,
  };
}

function placeSprite(fb, layout, w, h, view) {
  const { width, height } = fb;
  const hang = layout.hangFrac ?? 0.72;
  const minY = height >> 1;
  if (layout.anchor === "right") {
    const t = view.swing > 0 && view.swingTime > 0 ? 1 - view.swing / view.swingTime : 0;
    const swingPhase = view.swing > 0 ? Math.sin(t * Math.PI) : 0;
    return {
      destX: width - Math.round(width * 0.04) - w - Math.round(swingPhase * width * 0.06),
      destY: Math.max(minY, height - Math.round(h * hang) - Math.round(swingPhase * height * 0.06)),
    };
  }
  const kick = view.cooldown > 0 ? Math.round(height * GUN_KICK_FRAC) : 0;
  return {
    destX: Math.max(0, Math.round(width * layout.centre - w / 2)),
    destY: Math.max(minY, height - Math.round(h * hang) + kick),
  };
}

function fittedSpriteSize(fb, sprite, layout) {
  const maxW = Math.max(1, Math.round(fb.width * layout.widthFrac));
  const maxH = Math.max(1, Math.round(fb.height * layout.heightFrac));
  // Whole-number scale only, and never taller than heightFrac — 2x on a
  // 270-tall buffer swallowed the whole view and hid enemies behind the gun.
  let s = 1;
  while ((s + 1) * sprite.width <= maxW && (s + 1) * sprite.height <= maxH) {
    s++;
  }
  return { w: sprite.width * s, h: sprite.height * s };
}

function drawSpriteView(fb, view, id, sprite) {
  const layout = SPRITE_LAYOUT[id] ?? SPRITE_LAYOUT.pistol;
  const { w, h } = fittedSpriteSize(fb, sprite, layout);
  const { destX, destY } = placeSprite(fb, layout, w, h, view);
  blitRgba(fb, sprite, destX, destY, w, h);
}

function drawViewmodel(fb, view, options, id) {
  const bmp = VIEWMODELS[id];
  const layout = LAYOUT[id];
  const sx = Math.max(1, Math.round((fb.width * layout.widthFrac) / bmp.width));
  const sy = Math.max(1, Math.round((fb.height * layout.heightFrac) / bmp.height));
  const w = bmp.width * sx;
  const h = bmp.height * sy;
  const { destX, destY } = placeWeapon(fb, layout, w, h, view);

  const paint = colorAt(options);
  blitIndexed(fb, bmp, destX, destY, sx, sy, paint);

  const flashCut = id === "chaingun" ? 0.03 : 0.08;
  if (id !== "pipe" && view.cooldown > flashCut) {
    const fw = MUZZLE_FLASH.width * sx;
    blitIndexed(
      fb,
      MUZZLE_FLASH,
      destX + Math.round((w - fw) / 2),
      destY - sy,
      sx,
      sy,
      paint,
    );
  }
}

export function renderWeapon(fb, view, options) {
  const overlay = spriteForView(options.sprites, view);
  if (overlay) {
    drawSpriteView(fb, view, overlay.id, overlay.sprite);
    return;
  }
  if (view.weapon === "pipe" || view.swing > 0) drawViewmodel(fb, view, options, "pipe");
  else if (view.weapon === "shotgun") drawViewmodel(fb, view, options, "shotgun");
  else if (view.weapon === "chaingun") drawViewmodel(fb, view, options, "chaingun");
  else drawViewmodel(fb, view, options, "pistol");
}

/**
 * The aim point. `hitMark` above zero draws four diagonal ticks around it —
 * the standard, wordless "that landed" signal, and the only feedback the
 * player sees without looking away from where they are aiming.
 */
export function renderCrosshair(fb, shadeTable, paletteSize, hitMark = 0) {
  const { width, height } = fb;
  const cx = width >> 1;
  const cy = height >> 1;
  const arm = Math.max(2, Math.round(height / 24));
  const gap = Math.max(1, Math.round(arm / 3));
  const color = shadeTable[FULL * paletteSize + ACCENT.goldLight];

  fb.fillRect(cx, cy - arm - gap, 1, arm, color);
  fb.fillRect(cx, cy + gap, 1, arm, color);
  fb.fillRect(cx - arm - gap, cy, arm, 1, color);
  fb.fillRect(cx + gap, cy, arm, 1, color);
  fb.fillRect(cx, cy, 1, 1, color);

  if (hitMark <= 0) return;

  const markColor = shadeTable[FULL * paletteSize + ACCENT.blood];
  const reach = Math.max(2, Math.round(arm * 0.9));
  const start = gap + 1;
  for (let i = start; i < start + reach; i++) {
    fb.fillRect(cx - i, cy - i, 1, 1, markColor);
    fb.fillRect(cx + i, cy - i, 1, 1, markColor);
    fb.fillRect(cx - i, cy + i, 1, 1, markColor);
    fb.fillRect(cx + i, cy + i, 1, 1, markColor);
  }
}

/** Full-screen tint. Used for damage and for pickups. */
export function renderFlash(fb, color, alpha) {
  let a = alpha;
  if (!(a > 0)) return;
  if (a > 1) a = 1;
  const data = fb.data;
  const sr = color & 255;
  const sg = (color >> 8) & 255;
  const sb = (color >> 16) & 255;
  const inv = 1 - a;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    data[i] = rgb(
      Math.round((d & 255) * inv + sr * a),
      Math.round(((d >> 8) & 255) * inv + sg * a),
      Math.round(((d >> 16) & 255) * inv + sb * a),
    );
  }
}
