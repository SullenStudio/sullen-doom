import "./style.css";
import { TEXTURE_SLOT, generateTextures, makeEnemySprite } from "./assets/textures.js";
import { createInput, readMoveAxes } from "./core/input.js";
import { parseMap } from "./game/map.js";
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
const TURN = 2.4;
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

let firing = false;
let weapon = "gun";
let phase = "menu";

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
  isPlaying: () => phase === "play",
});
if (phone) input.bindStickPad(document.getElementById("stick"));

let player = { x: 8, y: 8, a: 0 };
let enemies = [];
let hp = 100;
let mag = MAG_SIZE;
let reserve = 40;
let reloading = 0;
let kills = 0;
let cooldown = 0;
let hurt = 0;
let iframes = 0;
let swing = 0;
let last = performance.now();

const INTERNAL_WIDTH = 480;
const MAX_DIST = 32;

const textures = generateTextures(1337);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const enemyBitmap = makeEnemySprite(7);

let presenter = null;
let zbuf = new Float32Array(1);
let lightBoost = 0;

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
  player = { ...parsed.playerStart };
  player.a = parsed.playerStart.angle;
  enemies = parsed.enemySpawns.map((s) => ({ x: s.x, y: s.y, hp: 2, hit: 0 }));
  hp = 100;
  mag = MAG_SIZE;
  reserve = 40;
  reloading = 0;
  kills = 0;
  cooldown = 0;
  hurt = 0;
  iframes = 0;
  swing = 0;
  weapon = "gun";
  firing = false;
  phase = "play";
  overlay.classList.add("hidden");
  syncHud();
}

function syncHud() {
  hpEl.textContent = `HP ${Math.max(0, Math.ceil(hp))}`;
  if (weapon === "stick") {
    ammoEl.textContent = swing > 0 ? "SWING" : "STICK";
  } else {
    ammoEl.textContent =
      reloading > 0 ? "RELOAD" : `AMMO ${mag}/${reserve}`;
  }
  killEl.textContent = `KILLS ${kills}`;
}

function swapWeapon() {
  if (phase !== "play") return;
  weapon = weapon === "gun" ? "stick" : "gun";
  firing = false;
  syncHud();
}

// input.js only knows key codes, not the weapon roster, so it hands over a
// raw 1-based slot number; unknown slots (anything but the two weapons this
// phase has) are ignored. No phase guard: `weapon` is fully reset to "gun"
// by reset() at the start of every play session, so a stray press on the
// menu or death screen leaves nothing to clean up.
function selectWeapon(slot) {
  if (slot === 1) weapon = "gun";
  else if (slot === 2) weapon = "stick";
  else return;
  syncHud();
}

function tryMove(nx, ny) {
  if (!map.isSolidAt(nx, player.y)) player.x = nx;
  if (!map.isSolidAt(player.x, ny)) player.y = ny;
}

function startReload() {
  if (reloading > 0 || reserve <= 0 || mag >= MAG_SIZE || phase !== "play") {
    return;
  }
  reloading = RELOAD_T;
  syncHud();
}

function nearestFoe(maxDist, cone) {
  const dirx = Math.cos(player.a);
  const diry = Math.sin(player.a);
  let best = null;
  let bestD = maxDist;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const vx = e.x - player.x;
    const vy = e.y - player.y;
    const along = vx * dirx + vy * diry;
    if (along < 0.15 || along > bestD) continue;
    if (Math.abs(vx * diry - vy * dirx) > cone) continue;
    if (blocked(player.x, player.y, e.x, e.y)) continue;
    best = e;
    bestD = along;
  }
  return best;
}

function shoot() {
  if (phase !== "play" || cooldown > 0 || reloading > 0) return;
  if (mag <= 0) {
    startReload();
    return;
  }
  mag -= 1;
  lightBoost = 0.35;
  cooldown = 0.16;
  const best = nearestFoe(8, 0.35);
  if (best) {
    best.hp -= 1;
    best.hit = 0.15;
    if (best.hp <= 0) kills += 1;
  }
  if (mag <= 0) startReload();
  syncHud();
}

function melee() {
  if (phase !== "play" || swing > 0) return;
  swing = SWING_T;
  const best = nearestFoe(STICK_RANGE, 0.55);
  if (best) {
    best.hp -= STICK_DMG;
    best.hit = 0.2;
    if (best.hp <= 0) kills += 1;
  }
  syncHud();
}

function attack() {
  if (weapon === "stick") melee();
  else shoot();
}

function update(dt) {
  if (phase !== "play") return;
  cooldown = Math.max(0, cooldown - dt);
  lightBoost = Math.max(0, lightBoost - dt * 4);
  hurt = Math.max(0, hurt - dt);
  iframes = Math.max(0, iframes - dt);
  swing = Math.max(0, swing - dt);
  if (reloading > 0) {
    reloading -= dt;
    if (reloading <= 0) {
      const need = MAG_SIZE - mag;
      const take = Math.min(need, reserve);
      mag += take;
      reserve -= take;
      reloading = 0;
    }
  }

  player.a += input.consumeLook();
  const move = readMoveAxes(input.keys, input.stick);
  const speed = MOVE;
  const fx = Math.cos(player.a);
  const fy = Math.sin(player.a);
  const rx = -fy;
  const ry = fx;
  tryMove(
    player.x + (fx * move.y + rx * move.x) * speed * dt,
    player.y + (fy * move.y + ry * move.x) * speed * dt,
  );
  if (input.firing || firing) attack();

  for (const e of enemies) {
    if (e.hp <= 0) continue;
    e.hit = Math.max(0, e.hit - dt);
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.55) {
      tryEnemyMove(
        e,
        e.x + (dx / dist) * ENEMY_SPEED * dt,
        e.y + (dy / dist) * ENEMY_SPEED * dt,
      );
    } else if (iframes <= 0) {
      hp -= BITE;
      iframes = IFRAMES;
      hurt = 0.35;
      if (hp <= 0) die();
    }
  }
  syncHud();
}

function tryEnemyMove(e, nx, ny) {
  if (!map.isSolidAt(nx, e.y)) e.x = nx;
  if (!map.isSolidAt(e.x, ny)) e.y = ny;
}

function die() {
  phase = "over";
  const best = Math.max(kills, Number(localStorage.getItem(BEST_KEY) || 0));
  localStorage.setItem(BEST_KEY, String(best));
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "YOU DIED";
  overlay.querySelector("p:nth-of-type(2)").textContent =
    `kills ${kills}   best ${best}`;
  playBtn.textContent = "AGAIN";
  if (document.pointerLockElement) document.exitPointerLock();
}

function draw() {
  if (!presenter) return;
  const fb = presenter.fb;
  const camera = makeCamera(player.x, player.y, player.a, FOV);
  const horizon = fb.height >> 1;

  renderFloorCeiling(
    fb,
    camera,
    textures[TEXTURE_SLOT.floor],
    textures[TEXTURE_SLOT.ceiling],
    { shadeTable, paletteSize: PALETTE_SIZE, lightBoost, horizon },
  );

  renderWalls(fb, map, camera, textures, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    maxDist: MAX_DIST,
    lightBoost,
    horizon,
  });

  renderSprites(
    fb,
    camera,
    enemies.filter((e) => e.hp > 0).map((e) => ({
      x: e.x,
      y: e.y,
      hit: e.hit,
      bitmap: enemyBitmap,
    })),
    {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      lightBoost,
      horizon,
      scale: 0.7,
    },
  );

  if (phase === "play") {
    renderWeapon(
      fb,
      { weapon, cooldown, swing, swingTime: SWING_T },
      { shadeTable, paletteSize: PALETTE_SIZE },
    );
    renderCrosshair(fb, shadeTable, PALETTE_SIZE);
  }
  if (hurt > 0) renderFlash(fb, rgb(180, 20, 10), hurt);
  if (iframes > 0 && phase === "play") {
    renderFlash(fb, rgb(255, 255, 255), 0.1 * Math.abs(Math.sin(iframes * 28)));
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

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
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
requestAnimationFrame(loop);
