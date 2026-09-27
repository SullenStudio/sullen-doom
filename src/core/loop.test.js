import { describe, expect, it } from "vitest";
import { createLoop } from "./loop.js";

function harness(frames) {
  let time = 0;
  let queued = null;
  const steps = [];
  const loop = createLoop({
    update: (dt) => steps.push(dt),
    render: () => {},
    maxStep: 0.05,
    now: () => time,
    schedule: (cb) => {
      queued = cb;
      return 1;
    },
    cancel: () => {
      queued = null;
    },
  });
  loop.start();
  for (const advance of frames) {
    time += advance * 1000;
    queued?.(time);
  }
  return { steps, loop, isQueued: () => queued !== null };
}

describe("createLoop", () => {
  it("reports the elapsed time of each frame", () => {
    const { steps } = harness([0.016, 0.016, 0.02]);
    expect(steps.length).toBe(3);
    expect(steps[0]).toBeCloseTo(0.016, 6);
    expect(steps[2]).toBeCloseTo(0.02, 6);
  });

  it("clamps a long frame so a background tab cannot teleport the player", () => {
    const { steps } = harness([5]);
    expect(steps[0]).toBe(0.05);
  });

  it("never reports a negative step", () => {
    const { steps } = harness([0, 0]);
    for (const dt of steps) expect(dt).toBeGreaterThanOrEqual(0);
  });

  it("stops scheduling after stop", () => {
    const h = harness([0.016]);
    h.loop.stop();
    expect(h.isQueued()).toBe(false);
  });

  it("ignores a second start", () => {
    const h = harness([0.016, 0.016]);
    h.loop.start();
    expect(h.steps.length).toBe(2);
  });
});
