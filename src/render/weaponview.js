import { ACCENT, RAMP, SHADE_LEVELS, rgb } from "./palette.js";

// First-person weapon art, drawn straight into the pixel buffer so it
// matches the chunky resolution of the world instead of sitting on top of it
// as smooth vector shapes. Phase 2 replaces these blocks with real sprites.
//
// Geometry is expressed as fractions of a bounding box anchored to the
// bottom-right of the screen (with a margin), not as fixed pixel offsets.
// The internal buffer is always 480 wide but its height varies with the
// window's aspect ratio (see resize() in main.js), so any layout that mixes
// width-scaled and height-scaled offsets breaks at some aspect ratio. Every
// part below is placed in the same box, so it scales uniformly.

const FULL = SHADE_LEVELS - 1;

// Margin kept clear around the weapon so nothing — including the muzzle
// flash at its largest — ever touches the screen edge.
const MARGIN_X_FRAC = 0.04;
const MARGIN_BOTTOM_FRAC = 0.05;

function shade(options, index) {
  return options.shadeTable[FULL * options.paletteSize + index];
}

/**
 * Maps a part's fractional coordinates within a bounding box to pixel
 * coordinates. `x0/x1` run left-to-right across the box (0..1); `y0/y1` run
 * bottom-to-top from the box's baseline (0 = baseline, 1 = top of box).
 */
function boxRect(originX, baseY, boxW, boxH, x0, y0, x1, y1) {
  const px = Math.round(originX + x0 * boxW);
  const py = Math.round(baseY - y1 * boxH);
  const pw = Math.round((x1 - x0) * boxW);
  const ph = Math.round((y1 - y0) * boxH);
  return [px, py, pw, ph];
}

// Gun bounding box: about a third of the screen width, anchored right of
// centre, low enough that even the muzzle flash stays under the horizon.
const GUN_WIDTH_FRAC = 0.3;
const GUN_HEIGHT_FRAC = 0.5;
const GUN_KICK_FRAC = 0.02;

function drawGun(fb, view, options) {
  const { width, height } = fb;
  const marginX = width * MARGIN_X_FRAC;
  const marginBottom = height * MARGIN_BOTTOM_FRAC;
  const boxW = width * GUN_WIDTH_FRAC;
  const boxH = height * GUN_HEIGHT_FRAC;
  const kick = view.cooldown > 0 ? height * GUN_KICK_FRAC : 0;

  const originX = width - marginX - boxW;
  const baseY = height - marginBottom + kick;

  const part = (x0, y0, x1, y1, colorIndex) => {
    const [px, py, pw, ph] = boxRect(originX, baseY, boxW, boxH, x0, y0, x1, y1);
    fb.fillRect(px, py, pw, ph, shade(options, colorIndex));
  };

  // Grip, receiver, barrel and muzzle cap all overlap their neighbour so the
  // silhouette reads as one connected object instead of floating blocks.
  part(0.02, 0.0, 0.26, 0.42, RAMP.rust + 1); // grip
  part(0.1, 0.3, 0.64, 0.56, RAMP.concrete + 2); // receiver
  part(0.56, 0.4, 0.86, 0.6, RAMP.concrete + 3); // barrel
  part(0.82, 0.38, 0.96, 0.62, RAMP.concrete + 0); // muzzle cap

  if (view.cooldown > 0.08) {
    part(0.88, 0.28, 1.0, 0.7, ACCENT.goldLight); // muzzle flash burst
    part(0.9, 0.4, 0.99, 0.6, ACCENT.gold); // bright core
  }
}

// Stick bounding box: narrower than the gun, anchored the same way, but
// taller since the melee weapon is held more upright.
const STICK_WIDTH_FRAC = 0.16;
const STICK_HEIGHT_FRAC = 0.46;
const STICK_SLIDE_FRAC = 0.08;
const STICK_LIFT_FRAC = 0.1;

function drawStick(fb, view, options) {
  const { width, height } = fb;
  const marginX = width * MARGIN_X_FRAC;
  const marginBottom = height * MARGIN_BOTTOM_FRAC;
  const boxW = width * STICK_WIDTH_FRAC;
  const boxH = height * STICK_HEIGHT_FRAC;

  const t = view.swing > 0 ? 1 - view.swing / view.swingTime : 0;
  const swingPhase = view.swing > 0 ? Math.sin(t * Math.PI) : 0;
  const slide = swingPhase * width * STICK_SLIDE_FRAC;
  const lift = swingPhase * height * STICK_LIFT_FRAC;

  const originX = width - marginX - boxW - slide;
  const baseY = height - marginBottom - lift;

  const part = (x0, y0, x1, y1, colorIndex) => {
    const [px, py, pw, ph] = boxRect(originX, baseY, boxW, boxH, x0, y0, x1, y1);
    fb.fillRect(px, py, pw, ph, shade(options, colorIndex));
  };

  // Shaft (two overlapping strips for a lit/shadowed edge), then a knotted
  // head overlapping the top of the shaft.
  part(0.3, 0.0, 0.62, 0.82, RAMP.rust + 0);
  part(0.38, 0.04, 0.54, 0.8, RAMP.rust + 2);
  part(0.06, 0.78, 0.96, 1.0, RAMP.concrete + 1);
  part(0.06, 0.94, 0.96, 1.0, RAMP.bone + 3);
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
