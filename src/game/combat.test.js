import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { WEAPONS } from "./weapons.js";
import { HIT_FLASH_T, fireWeapon, swingMelee } from "./combat.js";

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
