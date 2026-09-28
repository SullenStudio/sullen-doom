import { describe, expect, it } from "vitest";
import { shakeOffset } from "./shake.js";

describe("shakeOffset", () => {
  it("is zero at rest", () => {
    expect(shakeOffset(0, 300)).toBe(0);
  });

  it("is zero for a negative amount", () => {
    expect(shakeOffset(-1, 300)).toBe(0);
  });

  it("returns whole pixels", () => {
    for (let s = 0; s <= 1; s += 0.037) {
      expect(Number.isInteger(shakeOffset(s, 300))).toBe(true);
    }
  });

  it("stays small enough not to reveal the buffer edge", () => {
    for (let s = 0; s <= 1; s += 0.01) {
      expect(Math.abs(shakeOffset(s, 300))).toBeLessThanOrEqual(9);
    }
  });

  it("scales with the buffer height", () => {
    const small = Math.max(...sample(120));
    const large = Math.max(...sample(720));
    expect(large).toBeGreaterThan(small);
  });

  it("changes sign as it decays, so it reads as a shake", () => {
    const seen = new Set(sample(300).map(Math.sign));
    expect(seen.has(1)).toBe(true);
    expect(seen.has(-1)).toBe(true);
  });

  it("settles back to zero as the shake dies away", () => {
    expect(shakeOffset(0.001, 300)).toBe(0);
  });

  it("is deterministic", () => {
    expect(shakeOffset(0.4, 300)).toBe(shakeOffset(0.4, 300));
  });
});

function sample(height) {
  const out = [];
  for (let s = 1; s > 0; s -= 0.01) out.push(shakeOffset(s, height));
  return out;
}
