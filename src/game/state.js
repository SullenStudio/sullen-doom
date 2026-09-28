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

function combatIdle(state) {
  state.reloading = 0;
  state.reloadId = null;
  state.heat = 0;
  state.cooldown = 0;
  state.hurt = 0;
  state.iframes = 0;
  state.swing = 0;
  state.lightBoost = 0;
  state.hitMark = 0;
  state.shake = 0;
}

/**
 * All mutable match state in one place, so `main.js` can go back to being
 * wiring instead of a pile of module-level variables.
 */
export function createGameState(parsed) {
  const home = parsed;
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
    enter(next, { keepLoadout = false } = {}) {
      state.player = {
        x: next.playerStart.x,
        y: next.playerStart.y,
        a: next.playerStart.angle,
      };
      state.enemies = spawnEnemies(next);
      combatIdle(state);
      if (!keepLoadout) {
        const pack = freshLoadout();
        state.hp = START_HP;
        state.mags = pack.mags;
        state.reserves = pack.reserves;
        state.kills = 0;
        state.weapon = "pistol";
      }
      state.phase = "play";
    },
    reset() {
      state.enter(home, { keepLoadout: false });
    },
  };

  return state;
}

/**
 * Writes HUD text only when it actually changed. The old code rewrote three
 * DOM nodes sixty times a second to say the same thing.
 */
export function createHudBinding(elements) {
  const shown = {};
  return {
    sync(values) {
      if (elements.hpBlock && "hpTone" in values) {
        if (shown.hpTone !== values.hpTone) {
          shown.hpTone = values.hpTone;
          elements.hpBlock.dataset.tone = values.hpTone;
        }
      }
      for (const key of Object.keys(elements)) {
        if (key === "hpBlock") continue;
        if (!(key in values)) continue;
        if (shown[key] === values[key]) continue;
        shown[key] = values[key];
        elements[key].textContent = values[key];
      }
    },
  };
}
