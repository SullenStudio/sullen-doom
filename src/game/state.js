import { startingMags, startingReserves } from "./weapons.js";

const START_HP = 100;
const ENEMY_HP = 8;

function spawnEnemies(parsed) {
  return parsed.enemySpawns.map((s) => ({
    x: s.x,
    y: s.y,
    hp: ENEMY_HP,
    hit: 0,
  }));
}

function freshLoadout() {
  return {
    mags: startingMags(),
    reserves: startingReserves(),
  };
}

/**
 * All mutable match state in one place, so `main.js` can go back to being
 * wiring instead of a pile of module-level variables.
 */
export function createGameState(parsed) {
  const loadout = freshLoadout();
  const state = {
    player: {
      x: parsed.playerStart.x,
      y: parsed.playerStart.y,
      a: parsed.playerStart.angle,
    },
    enemies: spawnEnemies(parsed),
    hp: START_HP,
    mags: loadout.mags,
    reserves: loadout.reserves,
    reloading: 0,
    reloadId: null,
    heat: 0,
    kills: 0,
    cooldown: 0,
    hurt: 0,
    iframes: 0,
    swing: 0,
    lightBoost: 0,
    hitMark: 0,
    shake: 0,
    weapon: "pistol",
    phase: "menu",
    reset() {
      const next = freshLoadout();
      state.player = {
        x: parsed.playerStart.x,
        y: parsed.playerStart.y,
        a: parsed.playerStart.angle,
      };
      // Fresh objects every time: reusing them would carry damage across.
      state.enemies = spawnEnemies(parsed);
      state.hp = START_HP;
      state.mags = next.mags;
      state.reserves = next.reserves;
      state.reloading = 0;
      state.reloadId = null;
      state.heat = 0;
      state.kills = 0;
      state.cooldown = 0;
      state.hurt = 0;
      state.iframes = 0;
      state.swing = 0;
      state.lightBoost = 0;
      state.hitMark = 0;
      state.shake = 0;
      state.weapon = "pistol";
      state.phase = "play";
    },
  };

  return state;
}

/**
 * Writes HUD text only when it actually changed. The old code rewrote three
 * DOM nodes sixty times a second to say the same thing.
 */
export function createHudBinding(elements) {
  const shown = { hp: null, ammo: null, kills: null };
  return {
    sync(values) {
      for (const key of ["hp", "ammo", "kills"]) {
        if (shown[key] === values[key]) continue;
        shown[key] = values[key];
        elements[key].textContent = values[key];
      }
    },
  };
}
