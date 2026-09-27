import "./style.css";
import { TEXTURE_SLOT, generateTextures, makeEnemySprite } from "./assets/textures.js";
import { parseMap } from "./game/map.js";
import { renderFloorCeiling } from "./render/floors.js";
import { createPresenter } from "./render/framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./render/palette.js";
import { makeCamera } from "./render/raycast.js";
import { renderSprites } from "./render/sprites.js";
import { renderWalls } from "./render/walls.js";

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
const MOVE = 2.8;
const MOVE_PHONE = 7.4;
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

const keys = new Set();
const stick = { x: 0, y: 0 };
const pointers = new Map();
let firing = false;
let weapon = "gun";
let phase = "menu";

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

function analog() {
  let mx = 0;
  let my = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) my += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) my -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  mx += stick.x;
  my += -stick.y;
  const raw = Math.hypot(mx, my);
  if (raw < 0.04) return { x: 0, y: 0 };
  const mag = Math.min(1, (raw - 0.02) / 0.98);
  const boost = phone ? 0.85 + 0.15 * mag : mag;
  return { x: (mx / raw) * boost, y: (my / raw) * boost };
}

function update(dt) {
  if (phase !== "play") return;
  cooldown = Math.max(0, cooldown - dt);
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

  const move = analog();
  const speed = phone ? MOVE_PHONE : MOVE;
  const fx = Math.cos(player.a);
  const fy = Math.sin(player.a);
  const rx = -fy;
  const ry = fx;
  tryMove(
    player.x + (fx * move.y + rx * move.x) * speed * dt,
    player.y + (fy * move.y + ry * move.x) * speed * dt,
  );
  if (firing) attack();

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

function setStickFromPoint(clientX, clientY, origin) {
  const dx = (clientX - origin.x) / STICK_PX;
  const dy = (clientY - origin.y) / STICK_PX;
  const l = Math.hypot(dx, dy) || 1;
  const cap = Math.min(1.15, l);
  stick.x = (dx / l) * cap;
  stick.y = (dy / l) * cap;
}

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyR") startReload();
  if (e.code === "KeyQ" || e.code === "KeyE") swapWeapon();
  if (e.code === "Digit1") {
    weapon = "gun";
    syncHud();
  }
  if (e.code === "Digit2") {
    weapon = "stick";
    syncHud();
  }
  if (e.code === "KeyF") melee();
  if (e.code === "Space") {
    e.preventDefault();
    if (phase === "play") attack();
  }
  if ((e.code === "Enter" || e.code === "Space") && phase !== "play") reset();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

canvas.addEventListener("pointerdown", (e) => {
  if (phase !== "play") return;
  canvas.setPointerCapture(e.pointerId);
  const left = e.clientX < window.innerWidth * 0.42;
  if (phone && left) {
    pointers.set(e.pointerId, { kind: "move", x: e.clientX, y: e.clientY });
    setStickFromPoint(e.clientX, e.clientY, { x: e.clientX, y: e.clientY });
    return;
  }
  pointers.set(e.pointerId, { kind: "look", x: e.clientX, y: e.clientY });
  if (!phone) attack();
});
canvas.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (p.kind === "look") {
    const sens = phone ? LOOK_PHONE : LOOK_DESK;
    player.a += (e.clientX - p.x) * sens;
    p.x = e.clientX;
    p.y = e.clientY;
    return;
  }
  setStickFromPoint(e.clientX, e.clientY, p);
});
function endPointer(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (p?.kind === "move") {
    stick.x = 0;
    stick.y = 0;
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

playBtn.addEventListener("click", () => reset());

const stickEl = document.getElementById("stick");
function setStickPad(e) {
  const r = stickEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  setStickFromPoint(e.clientX, e.clientY, { x: cx, y: cy });
}
stickEl.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  stickEl.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { kind: "move", x: e.clientX, y: e.clientY });
  setStickPad(e);
});
stickEl.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  setStickPad(e);
});
const clearStick = (e) => {
  pointers.delete(e.pointerId);
  stick.x = 0;
  stick.y = 0;
};
stickEl.addEventListener("pointerup", clearStick);
stickEl.addEventListener("pointercancel", clearStick);

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
