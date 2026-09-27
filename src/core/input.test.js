import { describe, expect, it } from "vitest";
import { readMoveAxes } from "./input.js";

const noStick = { x: 0, y: 0 };

describe("readMoveAxes", () => {
  it("is still with no input", () => {
    expect(readMoveAxes(new Set(), noStick)).toEqual({ x: 0, y: 0 });
  });

  it("walks forward on W and on ArrowUp", () => {
    expect(readMoveAxes(new Set(["KeyW"]), noStick).y).toBeCloseTo(1, 6);
    expect(readMoveAxes(new Set(["ArrowUp"]), noStick).y).toBeCloseTo(1, 6);
  });

  it("walks back on S", () => {
    expect(readMoveAxes(new Set(["KeyS"]), noStick).y).toBeCloseTo(-1, 6);
  });

  it("strafes right on D and left on A", () => {
    expect(readMoveAxes(new Set(["KeyD"]), noStick).x).toBeCloseTo(1, 6);
    expect(readMoveAxes(new Set(["KeyA"]), noStick).x).toBeCloseTo(-1, 6);
  });

  it("cancels opposing keys", () => {
    expect(readMoveAxes(new Set(["KeyW", "KeyS"]), noStick)).toEqual({ x: 0, y: 0 });
  });

  it("normalises diagonals so they are not faster", () => {
    const diagonal = readMoveAxes(new Set(["KeyW", "KeyD"]), noStick);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6);
  });

  it("reads the analogue stick, with screen-down meaning backwards", () => {
    const axes = readMoveAxes(new Set(), { x: 0, y: 1 });
    expect(axes.y).toBeCloseTo(-1, 6);
  });

  it("honours a partly pushed stick", () => {
    const axes = readMoveAxes(new Set(), { x: 0, y: -0.5 });
    expect(axes.y).toBeCloseTo(0.5, 6);
  });

  it("ignores stick noise below the dead zone", () => {
    expect(readMoveAxes(new Set(), { x: 0.01, y: 0.01 })).toEqual({ x: 0, y: 0 });
  });

  it("never exceeds unit length, even with keys and stick together", () => {
    const axes = readMoveAxes(new Set(["KeyW", "KeyD"]), { x: 1, y: -1 });
    expect(Math.hypot(axes.x, axes.y)).toBeLessThanOrEqual(1.0001);
  });
});
