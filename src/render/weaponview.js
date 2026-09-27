import { ACCENT, RAMP, SHADE_LEVELS, rgb } from "./palette.js";

// First-person weapon art, drawn straight into the pixel buffer so it
// matches the chunky resolution of the world instead of sitting on top of it
// as smooth vector shapes. Phase 2 replaces these blocks with real sprites.

const FULL = SHADE_LEVELS - 1;

function shade(options, index) {
  return options.shadeTable[FULL * options.paletteSize + index];
}

function drawGun(fb, view, options) {
  const { width, height } = fb;
  const kick = view.cooldown > 0 ? Math.round(height * 0.03) : 0;
  const unit = Math.max(1, Math.round(height / 60));
  const baseX = Math.round(width * 0.58);
  const baseY = height - Math.round(height * 0.02) + kick;

  // Grip, receiver, barrel, muzzle.
  fb.fillRect(baseX - 9 * unit, baseY - 14 * unit, 10 * unit, 16 * unit,
    shade(options, RAMP.rust + 1));
  fb.fillRect(baseX - 3 * unit, baseY - 20 * unit, 26 * unit, 10 * unit,
    shade(options, RAMP.concrete + 2));
  fb.fillRect(baseX + 14 * unit, baseY - 24 * unit, 18 * unit, 6 * unit,
    shade(options, RAMP.concrete + 3));
  fb.fillRect(baseX + 32 * unit, baseY - 23 * unit, 5 * unit, 4 * unit,
    shade(options, RAMP.concrete + 0));

  if (view.cooldown > 0.08) {
    fb.fillRect(baseX + 37 * unit, baseY - 25 * unit, 7 * unit, 7 * unit,
      shade(options, ACCENT.goldLight));
    fb.fillRect(baseX + 44 * unit, baseY - 24 * unit, 4 * unit, 5 * unit,
      shade(options, ACCENT.gold));
  }
}

function drawStick(fb, view, options) {
  const { width, height } = fb;
  const t = view.swing > 0 ? 1 - view.swing / view.swingTime : 0;
  const lift = view.swing > 0 ? Math.sin(t * Math.PI) * height * 0.12 : 0;
  const slide = view.swing > 0 ? Math.sin(t * Math.PI) * width * 0.08 : 0;
  const unit = Math.max(1, Math.round(height / 60));

  const x = Math.round(width * 0.66 - slide);
  const y = Math.round(height - lift);
  const shaftH = Math.round(height * 0.5);

  fb.fillRect(x - 4 * unit, y - shaftH, 8 * unit, shaftH,
    shade(options, RAMP.rust + 0));
  fb.fillRect(x - 2 * unit, y - shaftH + unit, 4 * unit, shaftH - unit,
    shade(options, RAMP.rust + 2));
  fb.fillRect(x - 7 * unit, y - shaftH - 5 * unit, 14 * unit, 7 * unit,
    shade(options, RAMP.concrete + 1));
  fb.fillRect(x - 7 * unit, y - shaftH - 5 * unit, 14 * unit, 2 * unit,
    shade(options, RAMP.bone + 3));
}

export function renderWeapon(fb, view, options) {
  if (view.weapon === "stick" || view.swing > 0) drawStick(fb, view, options);
  else drawGun(fb, view, options);
}

export function renderCrosshair(fb, shadeTable, paletteSize) {
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
  // The four arms leave a gap around the centre by design; mark the exact
  // centre pixel too so aim always has a precise point of reference.
  fb.fillRect(cx, cy, 1, 1, color);
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
