import { describe, expect, it } from "vitest";
import { equippedViewId, pickGunPose, spriteForView } from "./gunsprites.js";

const REST = { cooldown: 0, swing: 0, swingTime: 0.34, reloading: 0, reloadTime: 1.1 };

describe("equippedViewId", () => {
  it("shows the pick whenever a swing is in flight", () => {
    expect(equippedViewId({ ...REST, weapon: "pistol", swing: 0.2 })).toBe("pipe");
    expect(equippedViewId({ ...REST, weapon: "pipe" })).toBe("pipe");
    expect(equippedViewId({ ...REST, weapon: "shotgun" })).toBe("shotgun");
  });
});

describe("pickGunPose", () => {
  it("idles the pistol when nothing is happening", () => {
    expect(pickGunPose("pistol", REST)).toBe("idle");
  });

  it("fires the pistol while cooldown is running", () => {
    expect(pickGunPose("pistol", { ...REST, cooldown: 0.1 })).toBe("fire");
  });

  it("cycles the pick through a swing", () => {
    expect(pickGunPose("pipe", { ...REST, swing: 0.34, swingTime: 0.34 })).toBe("swing0");
    expect(pickGunPose("pipe", { ...REST, swing: 0.17, swingTime: 0.34 })).toBe("swing1");
    expect(pickGunPose("pipe", { ...REST, swing: 0.05, swingTime: 0.34 })).toBe("swing2");
    expect(pickGunPose("pipe", { ...REST, swing: 0, swingTime: 0.34 })).toBe("idle");
  });

  it("plays shotgun reload frames while reloading", () => {
    expect(pickGunPose("shotgun", { ...REST, reloading: 1.1, reloadTime: 1.1 })).toBe("reload0");
    expect(pickGunPose("shotgun", { ...REST, reloading: 0.5, reloadTime: 1.1 })).toBe("reload1");
    expect(pickGunPose("shotgun", { ...REST, reloading: 0.1, reloadTime: 1.1 })).toBe("reload2");
  });

  it("shows the shotgun muzzle while the blast cooldown is still hot", () => {
    expect(pickGunPose("shotgun", { ...REST, cooldown: 0.5 })).toBe("fire");
    expect(pickGunPose("shotgun", { ...REST, cooldown: 0.1 })).toBe("idle");
  });

  it("prefers reload over the fire pose", () => {
    expect(
      pickGunPose("shotgun", { ...REST, cooldown: 0.5, reloading: 0.8, reloadTime: 1.1 }),
    ).toBe("reload0");
  });
});

describe("spriteForView", () => {
  const pistolIdle = { width: 1, height: 1, rgba: new Uint8ClampedArray([1, 0, 0, 255]) };
  const pistolFire = { width: 1, height: 1, rgba: new Uint8ClampedArray([2, 0, 0, 255]) };
  const sprites = { pistol: { idle: pistolIdle, fire: pistolFire } };

  it("returns null when sprites have not loaded", () => {
    expect(spriteForView(null, { ...REST, weapon: "pistol" })).toBe(null);
  });

  it("picks the fire sprite while the pistol cooldown is running", () => {
    const got = spriteForView(sprites, { ...REST, weapon: "pistol", cooldown: 0.12 });
    expect(got.id).toBe("pistol");
    expect(got.sprite).toBe(pistolFire);
  });

  it("falls back to idle if a pose is missing", () => {
    const got = spriteForView(
      { pistol: { idle: pistolIdle } },
      { ...REST, weapon: "pistol", cooldown: 0.12 },
    );
    expect(got.sprite).toBe(pistolIdle);
  });
});
