import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { createParticles } from "./particles.js";

const { map } = parseMap([
  "#####",
  "#...#",
  "#...#",
  "#...#",
  "#####",
]);

// A deterministic stand-in for Math.random so bursts are reproducible.
const seq = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const burst = (p, count, extra = {}) =>
  p.spawnBurst(2.5, 2.5, 0.5, 1, 0, count, {
    colorIndex: 3,
    random: seq([0.5]),
    ...extra,
  });

describe("createParticles", () => {
  it("starts with nothing alive", () => {
    expect(createParticles(16).activeCount()).toBe(0);
  });

  it("allocates its pool up front", () => {
    const p = createParticles(16);
    expect(p.items).toHaveLength(16);
  });

  it("brings exactly the requested count to life", () => {
    const p = createParticles(32);
    burst(p, 8);
    expect(p.activeCount()).toBe(8);
  });

  it("never exceeds its capacity", () => {
    const p = createParticles(8);
    burst(p, 40);
    expect(p.activeCount()).toBeLessThanOrEqual(8);
    expect(p.items).toHaveLength(8);
  });

  it("places new particles at the spawn point", () => {
    const p = createParticles(8);
    burst(p, 4);
    for (const q of p.items.filter((i) => i.life > 0)) {
      expect(q.x).toBeCloseTo(2.5, 6);
      expect(q.y).toBeCloseTo(2.5, 6);
      expect(q.z).toBeCloseTo(0.5, 6);
    }
  });

  it("carries the requested colour", () => {
    const p = createParticles(8);
    burst(p, 4, { colorIndex: 11 });
    for (const q of p.items.filter((i) => i.life > 0)) {
      expect(q.colorIndex).toBe(11);
    }
  });

  it("retires a particle once its life runs out", () => {
    const p = createParticles(8);
    burst(p, 4, { life: 0.1 });
    p.update(0.5, map);
    expect(p.activeCount()).toBe(0);
  });

  it("accelerates particles downward every step", () => {
    // The direct statement of gravity: vertical speed only ever decreases.
    const p = createParticles(8);
    burst(p, 1, { life: 10 });
    const q = p.items.find((i) => i.life > 0);
    let previous = Infinity;
    for (let i = 0; i < 10; i++) {
      p.update(1 / 60, map);
      expect(q.vz).toBeLessThan(previous);
      previous = q.vz;
    }
  });

  it("throws particles up before gravity brings them back down", () => {
    // A burst is thrown upward, so it rises first. With a lift of about 1.2
    // against a gravity of 2.6 the peak arrives near 0.46s and the particle
    // does not return to its launch height until roughly 0.92s — so a test
    // that samples too early sees it still above where it started.
    const p = createParticles(8);
    burst(p, 1, { life: 10 });
    const q = p.items.find((i) => i.life > 0);
    const start = q.z;
    const heights = [];
    for (let i = 0; i < 90; i++) {
      p.update(1 / 60, map);
      heights.push(q.z);
    }
    expect(Math.max(...heights)).toBeGreaterThan(start);
    expect(heights[heights.length - 1]).toBeLessThan(start);
  });

  it("settles particles on the floor instead of sinking through it", () => {
    const p = createParticles(8);
    burst(p, 1, { life: 10 });
    for (let i = 0; i < 400; i++) p.update(1 / 60, map);
    const q = p.items.find((i) => i.life > 0);
    expect(q.z).toBeGreaterThanOrEqual(0);
    expect(q.z).toBeLessThan(0.1);
  });

  it("does not let particles pass through a wall", () => {
    const p = createParticles(8);
    // Fired hard at the east wall from close range.
    p.spawnBurst(3.4, 2.5, 0.5, 1, 0, 6, {
      colorIndex: 3,
      speed: 20,
      spread: 0,
      life: 10,
      random: seq([0.5]),
    });
    for (let i = 0; i < 120; i++) p.update(1 / 60, map);
    for (const q of p.items.filter((i) => i.life > 0)) {
      expect(map.isSolidAt(q.x, q.y)).toBe(false);
    }
  });

  it("clear() retires everything", () => {
    const p = createParticles(8);
    burst(p, 6);
    p.clear();
    expect(p.activeCount()).toBe(0);
  });

  it("is reproducible for a given random source", () => {
    const run = () => {
      const p = createParticles(8);
      burst(p, 4);
      p.update(1 / 60, map);
      return p.items.map((q) => [q.x, q.y, q.z, q.life]);
    };
    expect(run()).toEqual(run());
  });

  it("spreads a burst around its direction", () => {
    const p = createParticles(8);
    p.spawnBurst(2.5, 2.5, 0.5, 1, 0, 2, {
      colorIndex: 3,
      spread: 1,
      // Four draws per particle: angle, speed, lift, life. The two
      // particles must differ on the first of them.
      random: seq([0, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5]),
    });
    const live = p.items.filter((q) => q.life > 0);
    expect(live[0].vy).not.toBeCloseTo(live[1].vy, 3);
  });
});
