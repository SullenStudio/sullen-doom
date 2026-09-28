import { describe, expect, it } from "vitest";
import { createParticles } from "../game/particles.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderParticles } from "./particles.js";

const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const W = 96;
const H = 60;
const FOV = Math.PI / 3;

// Most checks only care where a pixel lands, so they use a small buffer.
// Anything measuring SIZE has to use something close to the real one: at
// 60 pixels tall the size formula rounds every plausible distance down to a
// single pixel, and a test comparing one pixel against one pixel measures
// the rounding, not the renderer.
function scene(place, wallDepth = Infinity, w = W, h = H) {
  const fb = createFramebuffer(w, h);
  fb.clear(0);
  const zbuf = new Float32Array(w).fill(wallDepth);
  const particles = createParticles(8);
  place(particles);
  renderParticles(fb, makeCamera(2.5, 2.5, 0, FOV), particles, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    horizon: h >> 1,
    lightBoost: 0,
  });
  return fb;
}

// The internal buffer the game actually renders into.
const GAME_W = 480;
const GAME_H = 300;

const painted = (fb) => [...fb.data].filter((p) => p !== 0).length;

// Drops one motionless particle at an exact spot by writing the pool directly.
function place(particles, x, y, z) {
  const q = particles.items[0];
  q.x = x; q.y = y; q.z = z;
  q.vx = 0; q.vy = 0; q.vz = 0;
  q.life = 1; q.maxLife = 1; q.colorIndex = 37;
}

describe("renderParticles", () => {
  it("draws a particle in front of the camera", () => {
    const fb = scene((p) => place(p, 5.5, 2.5, 0.5));
    expect(painted(fb)).toBeGreaterThan(0);
  });

  it("draws nothing for a particle behind the camera", () => {
    const fb = scene((p) => place(p, 0.5, 2.5, 0.5));
    expect(painted(fb)).toBe(0);
  });

  it("draws nothing for a dead particle", () => {
    const fb = scene((p) => {
      place(p, 5.5, 2.5, 0.5);
      p.items[0].life = 0;
    });
    expect(painted(fb)).toBe(0);
  });

  it("hides a particle behind a nearer wall", () => {
    const fb = scene((p) => place(p, 5.5, 2.5, 0.5), 1.0);
    expect(painted(fb)).toBe(0);
  });

  it("draws a near particle larger than a far one", () => {
    // At the game's own resolution, not the small one: see the note on
    // scene(). A near particle is several pixels across, a far one is a dot.
    const near = painted(
      scene((p) => place(p, 3.2, 2.5, 0.5), Infinity, GAME_W, GAME_H),
    );
    const far = painted(
      scene((p) => place(p, 8.0, 2.5, 0.5), Infinity, GAME_W, GAME_H),
    );
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(1);
  });

  it("puts a particle at floor height below one at head height", () => {
    const rowOf = (fb) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) if (fb.data[y * W + x] !== 0) return y;
      }
      return -1;
    };
    const high = rowOf(scene((p) => place(p, 5.5, 2.5, 0.9)));
    const low = rowOf(scene((p) => place(p, 5.5, 2.5, 0.05)));
    expect(low).toBeGreaterThan(high);
  });

  it("dims a distant particle", () => {
    const luma = (fb) => {
      for (const p of fb.data) {
        if (p !== 0) return (p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255);
      }
      return 0;
    };
    expect(luma(scene((p) => place(p, 3.2, 2.5, 0.5))))
      .toBeGreaterThan(luma(scene((p) => place(p, 9.0, 2.5, 0.5))));
  });

  it("clips a particle at a wall edge instead of drawing it whole", () => {
    // A near wall covering only the left half of the screen. A particle
    // straddling the edge must lose exactly the covered columns.
    const fb = createFramebuffer(GAME_W, GAME_H);
    fb.clear(0);
    const zbuf = new Float32Array(GAME_W).fill(100);
    const middle = GAME_W >> 1;
    for (let x = 0; x < middle; x++) zbuf[x] = 0.5;
    const particles = createParticles(8);
    place(particles, 3.2, 2.5, 0.5);
    renderParticles(fb, makeCamera(2.5, 2.5, 0, FOV), particles, {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      horizon: GAME_H >> 1,
      lightBoost: 0,
    });
    let left = 0;
    let right = 0;
    for (let y = 0; y < GAME_H; y++) {
      for (let x = 0; x < GAME_W; x++) {
        if (fb.data[y * GAME_W + x] === 0) continue;
        if (x < middle) left++;
        else right++;
      }
    }
    expect(left).toBe(0);
    expect(right).toBeGreaterThan(0);
  });

  it("puts a floor-height particle exactly where a wall meets the floor", () => {
    // Particles and sprites must share one vertical projection. If the two
    // drift apart, blood floats above the ground or sinks into it, and the
    // cause is invisible until someone measures it.
    const depth = 3;
    const fb = scene(
      (p) => place(p, 2.5 + depth, 2.5, 0),
      Infinity,
      GAME_W,
      GAME_H,
    );
    const expected = (GAME_H >> 1) + Math.round(GAME_H / (2 * depth));
    let row = -1;
    for (let y = 0; y < GAME_H && row < 0; y++) {
      for (let x = 0; x < GAME_W; x++) {
        if (fb.data[y * GAME_W + x] !== 0) {
          row = y;
          break;
        }
      }
    }
    expect(row).toBe(expected);
  });

  it("never writes outside the buffer", () => {
    expect(() => scene((p) => place(p, 2.55, 2.5, 0.5))).not.toThrow();
    expect(() => scene((p) => place(p, 5.5, 2.5, 4))).not.toThrow();
    expect(() => scene((p) => place(p, 5.5, 2.5, -4))).not.toThrow();
  });
});
