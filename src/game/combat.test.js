import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { WEAPONS } from "./weapons.js";
import { HIT_FLASH_T, casingSpawn, fireWeapon, swingMelee } from "./combat.js";
import { makeCamera } from "../render/raycast.js";
import { projectSprite } from "../render/sprites.js";

const { map } = parseMap([
  "#########",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#.......#",
  "#########",
]);

const foe = (x, y, hp = 10) => ({ x, y, hp, hit: 0 });
const world = (enemies, a = 0) => ({
  map,
  enemies,
  player: { x: 4.5, y: 4.5, a },
});

// A single open cell, walls tight on every side (max distance to any wall
// from its centre is half a diagonal, ~0.71) — used below so a melee swing's
// short range (1.45) is guaranteed to hit a wall no matter which way it
// points, at any base angle.
const { map: tightMap } = parseMap(["###", "#.#", "###"]);
const tightWorld = (a) => ({ map: tightMap, enemies: [], player: { x: 1.5, y: 1.5, a } });

describe("fireWeapon", () => {
  it("damages an enemy the player is aiming at", () => {
    const e = foe(7, 4.5);
    const hits = fireWeapon(world([e]), WEAPONS.pistol);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("enemy");
    expect(hits[0].enemy).toBe(e);
    expect(e.hp).toBe(10 - WEAPONS.pistol.damage);
  });

  it("misses an enemy the player is not aiming at", () => {
    const e = foe(7, 4.5);
    const hits = fireWeapon(world([e], Math.PI), WEAPONS.pistol);
    expect(hits[0].kind).toBe("wall");
    expect(e.hp).toBe(10);
  });

  it("reports a wall hit with an impact point", () => {
    const hits = fireWeapon(world([]), WEAPONS.pistol);
    expect(hits[0].kind).toBe("wall");
    expect(hits[0].x).toBeCloseTo(8, 6);
  });

  it("sets the hit flash on a damaged enemy", () => {
    const e = foe(7, 4.5);
    fireWeapon(world([e]), WEAPONS.pistol);
    expect(e.hit).toBe(HIT_FLASH_T);
  });

  it("knocks the enemy away along the shot", () => {
    const e = foe(7, 4.5);
    fireWeapon(world([e]), WEAPONS.pistol);
    expect(e.x).toBeGreaterThan(7);
    expect(e.y).toBeCloseTo(4.5, 6);
  });

  it("does not knock an enemy through a wall", () => {
    // Close enough to the east wall that the knockback would cross into it.
    const e = foe(7.95, 4.5);
    fireWeapon(world([e]), WEAPONS.pistol);
    expect(map.isSolidAt(e.x, e.y)).toBe(false);
  });

  it("flags a kill when the shot takes the last health", () => {
    const e = foe(7, 4.5, WEAPONS.pistol.damage);
    const hits = fireWeapon(world([e]), WEAPONS.pistol);
    expect(hits[0].killed).toBe(true);
  });

  it("does not flag a kill on a survivable hit", () => {
    const hits = fireWeapon(world([foe(7, 4.5, 99)]), WEAPONS.pistol);
    expect(hits[0].killed).toBe(false);
  });

  it("fires one record per pellet", () => {
    const shotgun = { ...WEAPONS.pistol, pellets: 5, spread: 0.08 };
    const hits = fireWeapon(world([]), shotgun, () => 0.5);
    expect(hits).toHaveLength(5);
  });

  it("spreads pellets around the aim, not all to one side", () => {
    const shotgun = { ...WEAPONS.pistol, pellets: 2, spread: 0.2 };
    const values = [0, 1];
    let i = 0;
    const hits = fireWeapon(world([]), shotgun, () => values[i++]);
    // random() 0 maps to -spread, 1 maps to +spread: the impacts straddle.
    expect(hits[0].y).toBeLessThan(hits[1].y);
  });

  it("is deterministic for a given random source", () => {
    const shotgun = { ...WEAPONS.pistol, pellets: 4, spread: 0.1 };
    const run = () => fireWeapon(world([]), shotgun, () => 0.25).map((h) => h.y);
    expect(run()).toEqual(run());
  });
});

describe("swingMelee", () => {
  it("hits an enemy inside the arc and within reach", () => {
    const e = foe(5.6, 4.5);
    const hits = swingMelee(world([e]), WEAPONS.pipe);
    expect(hits).toHaveLength(1);
    expect(e.hp).toBe(10 - WEAPONS.pipe.damage);
  });

  it("cannot reach an enemy beyond its range", () => {
    const e = foe(7.5, 4.5);
    const hits = swingMelee(world([e]), WEAPONS.pipe);
    expect(hits.filter((h) => h.kind === "enemy")).toHaveLength(0);
    expect(e.hp).toBe(10);
  });

  it("damages an enemy only once even though the arc casts several rays", () => {
    const e = foe(5.4, 4.5);
    swingMelee(world([e]), WEAPONS.pipe);
    expect(e.hp).toBe(10 - WEAPONS.pipe.damage);
  });

  it("reaches an enemy off to the side of the aim, unlike a bullet", () => {
    const e = foe(5.3, 4.9);
    const hits = swingMelee(world([e]), WEAPONS.pipe);
    expect(hits.some((h) => h.enemy === e)).toBe(true);
  });

  it("ignores an enemy behind the player", () => {
    const e = foe(3.4, 4.5);
    swingMelee(world([e]), WEAPONS.pipe);
    expect(e.hp).toBe(10);
  });

  // Nothing above rules out an implementation that stops sweeping after its
  // first hit — every prior test used a single enemy, so "return early once
  // something is hit" would still pass all of them. Two separate enemies
  // standing inside the same arc, each within range, must both take damage.
  it("damages two separate enemies standing inside the same swing", () => {
    const a = foe(5.6, 4.5);
    const b = foe(5.3, 4.9);
    const hits = swingMelee(world([a, b]), WEAPONS.pipe);
    expect(a.hp).toBe(10 - WEAPONS.pipe.damage);
    expect(b.hp).toBe(10 - WEAPONS.pipe.damage);
    expect(hits.filter((h) => h.kind === "enemy" && h.enemy === a)).toHaveLength(1);
    expect(hits.filter((h) => h.kind === "enemy" && h.enemy === b)).toHaveLength(1);
  });
});

// Review found that src/main.js used to give the melee swing two entry
// points with two different gates: attack()'s melee branch checked
// state.cooldown, quickMelee() (the standing F-key panic melee) checked
// state.swing. Neither wrote what the other read, so pressing both in the
// same instant landed two full swings. The fix collapses both callers onto
// one function, swingWeapon(weapon), whose only gate is state.swing.
//
// src/main.js has no automated coverage of its own (it runs DOM setup at
// import time and this project has no stubbed-DOM test harness — seeing
// that gap was exactly what let the original bug go unnoticed by `npm
// test`). So this reproduces swingWeapon's body verbatim against the real
// swingMelee from this module, rather than exercising src/main.js directly.
// That is a real limitation: if src/main.js's swingWeapon ever diverges from
// what is copied below, this test stops proving anything about the actual
// game and nothing here would notice. Keep the two in sync by eye until
// src/main.js has real coverage of its own.
describe("swingWeapon's shared gate (mirrors src/main.js, see caveat above)", () => {
  function makeSwingWeapon(state, enemies) {
    const w = world(enemies);
    return function swingWeapon(weapon) {
      if (state.swing > 0) return;
      state.swing = weapon.swingTime;
      state.cooldown = weapon.cooldown;
      const hits = swingMelee(w, weapon);
      for (const hit of hits) {
        if (hit.killed) state.kills = (state.kills ?? 0) + 1;
      }
      return hits;
    };
  }

  it("F then the attack key lands exactly one swing's damage", () => {
    const e = foe(5.6, 4.5);
    const state = { swing: 0, cooldown: 0 };
    const swingWeapon = makeSwingWeapon(state, [e]);
    swingWeapon(WEAPONS.pipe); // F: quickMelee always swings the pipe
    swingWeapon(WEAPONS.pipe); // attack key, pipe equipped
    expect(e.hp).toBe(10 - WEAPONS.pipe.damage);
  });

  it("the attack key then F also lands exactly one swing's damage", () => {
    const e = foe(5.6, 4.5);
    const state = { swing: 0, cooldown: 0 };
    const swingWeapon = makeSwingWeapon(state, [e]);
    swingWeapon(WEAPONS.pipe); // attack key, pipe equipped
    swingWeapon(WEAPONS.pipe); // F
    expect(e.hp).toBe(10 - WEAPONS.pipe.damage);
  });

  it("F still swings while the equipped weapon's cooldown is running (panic melee)", () => {
    const e = foe(5.6, 4.5);
    // Simulates the pistol having just fired: its cooldown is nonzero, but
    // that must never be what blocks quickMelee — only state.swing does.
    const state = { swing: 0, cooldown: 999 };
    const swingWeapon = makeSwingWeapon(state, [e]);
    swingWeapon(WEAPONS.pipe);
    expect(e.hp).toBe(10 - WEAPONS.pipe.damage);
  });
});

// `castHitscan` requires a unit direction vector and deliberately does not
// check: feeding it a direction of length 2 has been shown to return a
// confident, well-formed "enemy" hit whose impact point sits well off the
// enemy's actual surface, with no error and no NaN — silently wrong
// geometry. combat.js is the only caller, and it satisfies the invariant by
// construction, building every direction from Math.cos/Math.sin of an
// angle. These tests pin that down: a HitRecord echoes back the exact
// dirX/dirY that were handed to castHitscan (see resolveRay), so asserting
// on the returned records is equivalent to asserting on what the hitscan
// module received, without needing to spy on castHitscan itself.
describe("direction vectors handed to the hitscan", () => {
  const ANGLES = [0, 0.3, 1, 1.5, Math.PI, -0.7, -2.4, 4.2, 7.1];

  it("are unit length for every pellet of a multi-pellet weapon, across a spread of angles", () => {
    const shotgun = { ...WEAPONS.pistol, pellets: 7, spread: 0.4 };
    // Cycles through several values so pellets land at different jittered
    // angles rather than all coinciding at the aim.
    const values = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];
    for (const a of ANGLES) {
      let i = 0;
      const random = () => values[i++ % values.length];
      const hits = fireWeapon(world([], a), shotgun, random);
      expect(hits.length).toBe(7);
      for (const hit of hits) {
        expect(Math.hypot(hit.dirX, hit.dirY)).toBeCloseTo(1, 12);
      }
    }
  });

  it("are unit length across every ray of a melee swing's arc, across a spread of angles", () => {
    for (const a of ANGLES) {
      const hits = swingMelee(tightWorld(a), WEAPONS.pipe);
      // The tight room guarantees every ray in the arc reaches a wall.
      expect(hits.length).toBeGreaterThan(0);
      for (const hit of hits) {
        expect(Math.hypot(hit.dirX, hit.dirY)).toBeCloseTo(1, 12);
      }
    }
  });
});

describe("casingSpawn", () => {
  it("lands inside the view cone at every heading", () => {
    // The offset is rotation-invariant by construction, so a failure here
    // means the ratio itself drifted out of the frustum — the exact defect
    // this guards against.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const player = { x: 4.5, y: 4.5, a };
      const spot = casingSpawn(player);
      const projected = projectSprite(
        makeCamera(player.x, player.y, a, Math.PI / 3),
        spot.x,
        spot.y,
      );
      expect(projected).not.toBe(null);
      expect(projected.screenX).toBeGreaterThan(0);
      expect(projected.screenX).toBeLessThan(1);
    }
  });

  it("ejects to the player's right, not the left", () => {
    const player = { x: 4.5, y: 4.5, a: 0 };
    const spot = casingSpawn(player);
    // Facing +x, the player's right is +y in this game's convention.
    expect(spot.y).toBeGreaterThan(player.y);
    expect(spot.dirY).toBeGreaterThan(0);
  });

  it("puts the spawn point in front of the player", () => {
    const player = { x: 4.5, y: 4.5, a: 0 };
    expect(casingSpawn(player).x).toBeGreaterThan(player.x);
  });
});
