import { describe, expect, it } from "vitest";
import { fbm, makeRng, makeValueNoise } from "./rng.js";

describe("makeRng", () => {
  it("yields the same stream for the same seed", () => {
    const a = makeRng(1234);
    const b = makeRng(1234);
    const left = [a(), a(), a(), a()];
    const right = [b(), b(), b(), b()];
    expect(left).toEqual(right);
  });

  it("yields a different stream for a different seed", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toEqual(b());
  });

  it("stays inside [0, 1)", () => {
    const rng = makeRng(99);
    for (let i = 0; i < 2000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("makeValueNoise", () => {
  it("stays inside [0, 1]", () => {
    const noise = makeValueNoise(makeRng(7), 64);
    for (let i = 0; i < 500; i++) {
      const v = noise(i * 0.37, i * 0.11);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("tiles across the grid period", () => {
    const noise = makeValueNoise(makeRng(7), 64);
    expect(noise(3.5, 2.25)).toBeCloseTo(noise(67.5, 66.25), 10);
  });

  it("is continuous between neighbouring samples", () => {
    const noise = makeValueNoise(makeRng(7), 64);
    const a = noise(10.5, 10.5);
    const b = noise(10.51, 10.5);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });
});

describe("fbm", () => {
  it("stays inside [0, 1]", () => {
    const noise = makeValueNoise(makeRng(3), 64);
    for (let i = 0; i < 200; i++) {
      const v = fbm(noise, i * 0.3, i * 0.7, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
