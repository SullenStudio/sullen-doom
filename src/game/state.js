const START_HP = 100;
const START_MAG = 8;
const START_RESERVE = 40;
const ENEMY_HP = 2;

function spawnEnemies(parsed) {
  return parsed.enemySpawns.map((s) => ({
    x: s.x,
    y: s.y,
    hp: ENEMY_HP,
    hit: 0,
  }));
}

/**
 * All mutable match state in one place, so `main.js` can go back to being
 * wiring instead of a pile of module-level variables.
 */
export function createGameState(parsed) {
  const state = {
    player: {
      x: parsed.playerStart.x,
      y: parsed.playerStart.y,
      a: parsed.playerStart.angle,
    },
    enemies: spawnEnemies(parsed),
    hp: START_HP,
    mag: START_MAG,
    reserve: START_RESERVE,
    reloading: 0,
    kills: 0,
    cooldown: 0,
    hurt: 0,
    iframes: 0,
    swing: 0,
    lightBoost: 0,
    weapon: "pistol",
    phase: "menu",
    reset() {
      state.player = {
        x: parsed.playerStart.x,
        y: parsed.playerStart.y,
        a: parsed.playerStart.angle,
      };
      // Fresh objects every time: reusing them would carry damage across.
      state.enemies = spawnEnemies(parsed);
      state.hp = START_HP;
      state.mag = START_MAG;
      state.reserve = START_RESERVE;
      state.reloading = 0;
      state.kills = 0;
      state.cooldown = 0;
      state.hurt = 0;
      state.iframes = 0;
      state.swing = 0;
      state.lightBoost = 0;
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
