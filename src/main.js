import "./style.css";

const MAP = [
  "################",
  "#..............#",
  "#..##......##..#",
  "#..............#",
  "##....####....##",
  "#..............#",
  "#..E........E..#",
  "#......P.......#",
  "#..E........E..#",
  "#..............#",
  "##....####....##",
  "#..............#",
  "#..##......##..#",
  "#..............#",
  "#......E.......#",
  "################",
];

const COLS = MAP[0].length;
const ROWS = MAP.length;
const CELL = 1;
const FOV = Math.PI / 3;
const MOVE = 2.6;
const TURN = 2.4;
const ENEMY_SPEED = 0.85;
const BEST_KEY = "sullen-doom-best";

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
const look = { dx: 0 };
const stick = { x: 0, y: 0, active: false };
let firing = false;
let phase = "menu";

let player = { x: 8, y: 8, a: 0 };
let enemies = [];
let hp = 100;
let ammo = 40;
let kills = 0;
let cooldown = 0;
let hurt = 0;
let last = performance.now();

function wall(x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
  return MAP[cy][cx] === "#";
}

function reset() {
  player = { x: 8, y: 8, a: 0 };
  enemies = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = MAP[y][x];
      if (ch === "P") player = { x: x + 0.5, y: y + 0.5, a: 0 };
      if (ch === "E") enemies.push({ x: x + 0.5, y: y + 0.5, hp: 2, hit: 0 });
    }
  }
  hp = 100;
  ammo = 40;
  kills = 0;
  cooldown = 0;
  hurt = 0;
  phase = "play";
  overlay.classList.add("hidden");
  syncHud();
}

function syncHud() {
  hpEl.textContent = `HP ${Math.max(0, Math.ceil(hp))}`;
  ammoEl.textContent = `AMMO ${ammo}`;
  killEl.textContent = `KILLS ${kills}`;
}

function tryMove(nx, ny) {
  if (!wall(nx, player.y)) player.x = nx;
  if (!wall(player.x, ny)) player.y = ny;
}

function shoot() {
  if (phase !== "play" || cooldown > 0 || ammo <= 0) return;
  ammo -= 1;
  cooldown = 0.18;
  const dirx = Math.cos(player.a);
  const diry = Math.sin(player.a);
  let best = null;
  let bestD = 8;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const vx = e.x - player.x;
    const vy = e.y - player.y;
    const d = Math.hypot(vx, vy);
    const along = vx * dirx + vy * diry;
    if (along < 0.2 || along > bestD) continue;
    const cross = Math.abs(vx * diry - vy * dirx);
    if (cross > 0.35) continue;
    best = e;
    bestD = along;
  }
  if (best) {
    best.hp -= 1;
    best.hit = 0.15;
    if (best.hp <= 0) kills += 1;
  }
  syncHud();
}

function update(dt) {
  if (phase !== "play") return;
  cooldown = Math.max(0, cooldown - dt);
  hurt = Math.max(0, hurt - dt);

  let mx = 0;
  let my = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) my += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) my -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  mx += stick.x;
  my += -stick.y;
  const len = Math.hypot(mx, my) || 1;
  const fx = Math.cos(player.a);
  const fy = Math.sin(player.a);
  const rx = -fy;
  const ry = fx;
  tryMove(
    player.x + ((fx * my + rx * mx) / len) * MOVE * dt,
    player.y + ((fy * my + ry * mx) / len) * MOVE * dt,
  );
  player.a += look.dx * TURN * dt;
  look.dx *= 0.4;
  if (firing) shoot();

  for (const e of enemies) {
    if (e.hp <= 0) continue;
    e.hit = Math.max(0, e.hit - dt);
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.55) {
      tryEnemyMove(e, e.x + (dx / dist) * ENEMY_SPEED * dt, e.y + (dy / dist) * ENEMY_SPEED * dt);
    } else {
      hp -= 18 * dt;
      hurt = 0.2;
      if (hp <= 0) die();
    }
  }
  syncHud();
}

function tryEnemyMove(e, nx, ny) {
  if (!wall(nx, e.y)) e.x = nx;
  if (!wall(e.x, ny)) e.y = ny;
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

function cast(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  let dist = 0;
  let hit = 0;
  let side = 0;
  const step = 0.02;
  while (dist < 14) {
    dist += step;
    const x = player.x + cos * dist;
    const y = player.y + sin * dist;
    if (wall(x, y)) {
      hit = 1;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      side = Math.min(fx, 1 - fx) < Math.min(fy, 1 - fy) ? 1 : 0;
      break;
    }
  }
  return { dist: dist * Math.cos(angle - player.a), hit, side };
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#3a1410";
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = "#1a0c08";
  ctx.fillRect(0, h / 2, w, h / 2);

  const rays = Math.floor(w / 2);
  for (let i = 0; i < rays; i++) {
    const a = player.a - FOV / 2 + (i / rays) * FOV;
    const { dist, hit, side } = cast(a);
    if (!hit) continue;
    const colH = Math.min(h, (h * 0.85) / Math.max(0.12, dist));
    const shade = Math.max(28, 190 - dist * 22 - (side ? 30 : 0));
    ctx.fillStyle = `rgb(${shade + 40},${shade * 0.28},${shade * 0.18})`;
    ctx.fillRect((i * w) / rays, (h - colH) / 2, w / rays + 1, colH);
  }

  const sprites = enemies
    .filter((e) => e.hp > 0)
    .map((e) => {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      return { e, dist: Math.hypot(dx, dy), dx, dy };
    })
    .sort((a, b) => b.dist - a.dist);

  for (const s of sprites) {
    let ang = Math.atan2(s.dy, s.dx) - player.a;
    while (ang > Math.PI) ang -= Math.PI * 2;
    while (ang < -Math.PI) ang += Math.PI * 2;
    if (Math.abs(ang) > FOV) continue;
    const size = Math.min(h, (h * 0.7) / Math.max(0.2, s.dist));
    const sx = w / 2 + (ang / (FOV / 2)) * (w / 2) - size / 2;
    const sy = h / 2 - size * 0.15;
    ctx.fillStyle = s.e.hit > 0 ? "#fff0c8" : "#7a1c14";
    ctx.beginPath();
    ctx.ellipse(sx + size / 2, sy + size * 0.35, size * 0.28, size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2d38a";
    ctx.beginPath();
    ctx.arc(sx + size * 0.38, sy + size * 0.28, size * 0.05, 0, Math.PI * 2);
    ctx.arc(sx + size * 0.62, sy + size * 0.28, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#f0c400";
  ctx.fillRect(w / 2 - 1, h / 2 - 8, 2, 16);
  ctx.fillRect(w / 2 - 8, h / 2 - 1, 16, 2);
  if (hurt > 0) {
    ctx.fillStyle = `rgba(180,20,10,${hurt})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space") {
    e.preventDefault();
    if (phase === "play") shoot();
  }
  if ((e.code === "Enter" || e.code === "Space") && phase !== "play") reset();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

canvas.addEventListener("pointerdown", (e) => {
  if (phase !== "play") return;
  canvas.setPointerCapture(e.pointerId);
  look._x = e.clientX;
  if (!phone) shoot();
});
canvas.addEventListener("pointermove", (e) => {
  if (look._x == null) return;
  look.dx += (e.clientX - look._x) * 0.012;
  look._x = e.clientX;
});
canvas.addEventListener("pointerup", () => {
  look._x = null;
});

playBtn.addEventListener("click", () => reset());

const stickEl = document.getElementById("stick");
function setStick(e) {
  const r = stickEl.getBoundingClientRect();
  stick.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  stick.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  const l = Math.hypot(stick.x, stick.y) || 1;
  stick.x /= Math.max(1, l);
  stick.y /= Math.max(1, l);
}
stickEl.addEventListener("pointerdown", (e) => {
  stick.active = true;
  stickEl.setPointerCapture(e.pointerId);
  setStick(e);
});
stickEl.addEventListener("pointermove", (e) => {
  if (stick.active) setStick(e);
});
const clearStick = () => {
  stick.active = false;
  stick.x = 0;
  stick.y = 0;
};
stickEl.addEventListener("pointerup", clearStick);
stickEl.addEventListener("pointercancel", clearStick);

document.getElementById("btn-fire").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  firing = true;
  shoot();
});
document.getElementById("btn-fire").addEventListener("pointerup", () => {
  firing = false;
});

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(loop);
void CELL;
