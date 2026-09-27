import "./style.css";
import { TEXTURE_SLOT, generateTextures, makeEnemySprite } from "./assets/textures.js";
import { createInput, readMoveAxes } from "./core/input.js";
import { createLoop } from "./core/loop.js";
import { parseMap } from "./game/map.js";
import { createGameState, createHudBinding } from "./game/state.js";
import { renderFloorCeiling } from "./render/floors.js";
import { createPresenter } from "./render/framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable, rgb } from "./render/palette.js";
import { makeCamera } from "./render/raycast.js";
import { renderSprites } from "./render/sprites.js";
import { renderWalls } from "./render/walls.js";
import { renderCrosshair, renderFlash, renderWeapon } from "./render/weaponview.js";

const MAP_LINES = [
  "################",
  "#..............#",
  "#..22......22..#",
  "#..............#",
  "##....3333....##",
  "#..............#",
  "#..E........E..#",
  "#......P.......#",
  "#..E........E..#",
  "#..............#",
  "##....3333....##",
  "#..............#",
  "#..55......55..#",
  "#..............#",
  "#......E.......#",
  "################",
];

const parsed = parseMap(MAP_LINES);
const map = parsed.map;
const FOV = Math.PI / 3;
const MAG_SIZE = 8;
const RELOAD_T = 0.85;
const MOVE = 3.4;
const ENEMY_SPEED = 0.85;
const BITE = 10;
const IFRAMES = 0.65;
const SWING_T = 0.34;
const STICK_RANGE = 1.45;
const STICK_DMG = 2;
// Phone look: bigger = faster turn. Try 0.02–0.05.
const LOOK_PHONE = 0.028;
const LOOK_DESK = 0.0045;
// Thumb travel in px to reach full walk. Smaller = snappier.
const STICK_PX = 28;
const BEST_KEY = "sullen-descent-best";

const phone =
  window.matchMedia("(pointer: coarse)").matches ||
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0;
if (phone) document.documentElement.classList.add("phone");

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const playBtn = document.getElementById("btn-play");
const hpEl = document.getElementById("hp");
const ammoEl = document.getElementById("ammo");
const killEl = document.getElementById("kills");

// Captured once at load so reset() can restore the menu after die() has
// overwritten it, without hard-coding wording that lives in index.html.
const overlayTitle = overlay.querySelector("h1");
const overlaySub = overlay.querySelector("p:nth-of-type(2)");
const MENU_TITLE = overlayTitle.textContent;
const MENU_SUB = overlaySub.textContent;
const MENU_PLAY_LABEL = playBtn.textContent;

// Set by the on-screen mobile FIRE button; kept separate from input.firing
// because it is driven by a pointer, not the input module's own state.
let firing = false;

const state = createGameState(parsed);
const hud = createHudBinding({ hp: hpEl, ammo: ammoEl, kills: killEl });

const input = createInput(canvas, {
  phone,
  stickPx: STICK_PX,
  lookDesktop: LOOK_DESK,
  lookPhone: LOOK_PHONE,
  onAttack: () => attack(),
  onSwap: () => swapWeapon(),
  onReload: () => startReload(),
  onRestart: () => reset(),
  onSelectWeapon: (slot) => selectWeapon(slot),
  onMelee: () => melee(),
  isPlaying: () => state.phase === "play",
});
if (phone) input.bindStickPad(document.getElementById("stick"));

const INTERNAL_WIDTH = 480;
const MAX_DIST = 32;

const textures = generateTextures(1337);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const enemyBitmap = makeEnemySprite(7);

let presenter = null;
let zbuf = new Float32Array(1);

function blocked(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.ceil(dist / 0.08));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (map.isSolidAt(ax + dx * t, ay + dy * t)) return true;
  }
  return false;
}

function reset() {
  state.reset();
  firing = false;
  overlayTitle.textContent = MENU_TITLE;
  overlaySub.textContent = MENU_SUB;
  playBtn.textContent = MENU_PLAY_LABEL;
  overlay.classList.add("hidden");
  syncHud();
}

function syncHud() {
  hud.sync({
    hp: `HP ${Math.max(0, Math.ceil(state.hp))}`,
    ammo:
      state.weapon === "stick"
        ? state.swing > 0
          ? "SWING"
          : "STICK"
        : state.reloading > 0
          ? "RELOAD"
          : `AMMO ${state.mag}/${state.reserve}`,
    kills: `KILLS ${state.kills}`,
  });
}

function swapWeapon() {
  if (state.phase !== "play") return;
  state.weapon = state.weapon === "gun" ? "stick" : "gun";
  firing = false;
  syncHud();
}

// input.js only knows key codes, not the weapon roster, so it hands over a
// raw 1-based slot number; unknown slots (anything but the two weapons this
// phase has) are ignored. No phase guard: `state.weapon` is fully reset to
// "gun" by state.reset() at the start of every play session, so a stray
// press on the menu or death screen leaves nothing to clean up.
function selectWeapon(slot) {
  if (slot === 1) state.weapon = "gun";
  else if (slot === 2) state.weapon = "stick";
  else return;
  syncHud();
}

function tryMove(nx, ny) {
  if (!map.isSolidAt(nx, state.player.y)) state.player.x = nx;
  if (!map.isSolidAt(state.player.x, ny)) state.player.y = ny;
}

function startReload() {
  if (
    state.reloading > 0 ||
    state.reserve <= 0 ||
    state.mag >= MAG_SIZE ||
    state.phase !== "play"
  ) {
    return;
  }
  state.reloading = RELOAD_T;
  syncHud();
}

function nearestFoe(maxDist, cone) {
  const dirx = Math.cos(state.player.a);
  const diry = Math.sin(state.player.a);
  let best = null;
  let bestD = maxDist;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const vx = e.x - state.player.x;
    const vy = e.y - state.player.y;
    const along = vx * dirx + vy * diry;
    if (along < 0.15 || along > bestD) continue;
    if (Math.abs(vx * diry - vy * dirx) > cone) continue;
    if (blocked(state.player.x, state.player.y, e.x, e.y)) continue;
    best = e;
    bestD = along;
  }
  return best;
}

function shoot() {
  if (state.phase !== "play" || state.cooldown > 0 || state.reloading > 0) return;
  if (state.mag <= 0) {
    startReload();
    return;
  }
  state.mag -= 1;
  state.lightBoost = 0.35;
  state.cooldown = 0.16;
  const best = nearestFoe(8, 0.35);
  if (best) {
    best.hp -= 1;
    best.hit = 0.15;
    if (best.hp <= 0) state.kills += 1;
  }
  if (state.mag <= 0) startReload();
  syncHud();
}

function melee() {
  if (state.phase !== "play" || state.swing > 0) return;
  state.swing = SWING_T;
  const best = nearestFoe(STICK_RANGE, 0.55);
  if (best) {
    best.hp -= STICK_DMG;
    best.hit = 0.2;
    if (best.hp <= 0) state.kills += 1;
  }
  syncHud();
}

function attack() {
  if (state.weapon === "stick") melee();
  else shoot();
}

function update(dt) {
  if (state.phase !== "play") return;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.lightBoost = Math.max(0, state.lightBoost - dt * 4);
  state.hurt = Math.max(0, state.hurt - dt);
  state.iframes = Math.max(0, state.iframes - dt);
  state.swing = Math.max(0, state.swing - dt);
  if (state.reloading > 0) {
    state.reloading -= dt;
    if (state.reloading <= 0) {
      const need = MAG_SIZE - state.mag;
      const take = Math.min(need, state.reserve);
      state.mag += take;
      state.reserve -= take;
      state.reloading = 0;
    }
  }

  state.player.a += input.consumeLook();
  const move = readMoveAxes(input.keys, input.stick);
  const speed = MOVE;
  const fx = Math.cos(state.player.a);
  const fy = Math.sin(state.player.a);
  const rx = -fy;
  const ry = fx;
  tryMove(
    state.player.x + (fx * move.y + rx * move.x) * speed * dt,
    state.player.y + (fy * move.y + ry * move.x) * speed * dt,
  );
  if (input.firing || firing) attack();

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    e.hit = Math.max(0, e.hit - dt);
    const dx = state.player.x - e.x;
    const dy = state.player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.55) {
      tryEnemyMove(
        e,
        e.x + (dx / dist) * ENEMY_SPEED * dt,
        e.y + (dy / dist) * ENEMY_SPEED * dt,
      );
    } else if (state.iframes <= 0) {
      state.hp -= BITE;
      state.iframes = IFRAMES;
      state.hurt = 0.35;
      if (state.hp <= 0) die();
    }
  }
  syncHud();
}

function tryEnemyMove(e, nx, ny) {
  if (!map.isSolidAt(nx, e.y)) e.x = nx;
  if (!map.isSolidAt(e.x, ny)) e.y = ny;
}

function die() {
  state.phase = "over";
  const best = Math.max(state.kills, Number(localStorage.getItem(BEST_KEY) || 0));
  localStorage.setItem(BEST_KEY, String(best));
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "YOU DIED";
  overlaySub.textContent = `kills ${state.kills}   best ${best}`;
  playBtn.textContent = "AGAIN";
  if (document.pointerLockElement) document.exitPointerLock();
}

function draw() {
  if (!presenter) return;
  const fb = presenter.fb;
  const camera = makeCamera(state.player.x, state.player.y, state.player.a, FOV);
  const horizon = fb.height >> 1;

  renderFloorCeiling(
    fb,
    camera,
    textures[TEXTURE_SLOT.floor],
    textures[TEXTURE_SLOT.ceiling],
    { shadeTable, paletteSize: PALETTE_SIZE, lightBoost: state.lightBoost, horizon },
  );

  renderWalls(fb, map, camera, textures, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    maxDist: MAX_DIST,
    lightBoost: state.lightBoost,
    horizon,
  });

  renderSprites(
    fb,
    camera,
    state.enemies.filter((e) => e.hp > 0).map((e) => ({
      x: e.x,
      y: e.y,
      hit: e.hit,
      bitmap: enemyBitmap,
    })),
    {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      lightBoost: state.lightBoost,
      horizon,
      scale: 0.7,
    },
  );

  if (state.phase === "play") {
    renderWeapon(
      fb,
      { weapon: state.weapon, cooldown: state.cooldown, swing: state.swing, swingTime: SWING_T },
      { shadeTable, paletteSize: PALETTE_SIZE },
    );
    renderCrosshair(fb, shadeTable, PALETTE_SIZE);
  }
  if (state.hurt > 0) renderFlash(fb, rgb(180, 20, 10), state.hurt);
  if (state.iframes > 0 && state.phase === "play") {
    renderFlash(fb, rgb(255, 255, 255), 0.1 * Math.abs(Math.sin(state.iframes * 28)));
  }

  presenter.present(ctx, canvas.width, canvas.height);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  // The canvas can measure zero while layout is still settling (or if an
  // ancestor is hidden). Bail out rather than dividing by zero: that would
  // ask createPresenter for an Infinity-tall buffer and throw.
  if (canvas.width < 1 || canvas.height < 1) return;
  const aspect = canvas.width / canvas.height;
  const internalHeight = Math.min(
    720,
    Math.max(120, Math.round(INTERNAL_WIDTH / aspect)),
  );
  if (
    !presenter ||
    presenter.width !== INTERNAL_WIDTH ||
    presenter.height !== internalHeight
  ) {
    presenter = createPresenter(INTERNAL_WIDTH, internalHeight);
    zbuf = new Float32Array(INTERNAL_WIDTH);
  }
}

playBtn.addEventListener("click", () => reset());

document.getElementById("btn-swap").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  swapWeapon();
});
document.getElementById("btn-fire").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  firing = true;
  attack();
});
document.getElementById("btn-fire").addEventListener("pointerup", () => {
  firing = false;
});
document.getElementById("btn-fire").addEventListener("pointercancel", () => {
  firing = false;
});

resize();
window.addEventListener("resize", resize);
createLoop({ update, render: draw }).start();
