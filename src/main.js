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
let zbuf = new Float32Array(1);

function wall(x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
  return MAP[cy][cx] === "#";
}

function blocked(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.ceil(dist / 0.08));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (wall(ax + dx * t, ay + dy * t)) return true;
  }
  return false;
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
  if (!wall(nx, player.y)) player.x = nx;
  if (!wall(player.x, ny)) player.y = ny;
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

  const rays = Math.max(80, Math.floor(w / 2));
  if (zbuf.length !== rays) zbuf = new Float32Array(rays);
  zbuf.fill(99);

  for (let i = 0; i < rays; i++) {
    const a = player.a - FOV / 2 + (i / rays) * FOV;
    const { dist, hit, side } = cast(a);
    if (!hit) continue;
    zbuf[i] = dist;
    const colH = Math.min(h, (h * 0.85) / Math.max(0.12, dist));
    const shade = Math.max(28, 190 - dist * 22 - (side ? 30 : 0));
    ctx.fillStyle = `rgb(${shade + 40},${shade * 0.28},${shade * 0.18})`;
    ctx.fillRect((i * w) / rays, (h - colH) / 2, w / rays + 1, colH);
  }

  const sprites = enemies
    .filter((e) => e.hp > 0 && !blocked(player.x, player.y, e.x, e.y))
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
    const cx = w / 2 + (ang / (FOV / 2)) * (w / 2);
    const sy = h / 2 - size * 0.15;
    const left = Math.floor(cx - size * 0.28);
    const right = Math.ceil(cx + size * 0.28);
    ctx.fillStyle = s.e.hit > 0 ? "#fff0c8" : "#7a1c14";
    for (let x = left; x < right; x++) {
      const ray = Math.floor((x / w) * rays);
      if (ray < 0 || ray >= rays || s.dist >= zbuf[ray] - 0.08) continue;
      const t = (x - cx) / (size * 0.28);
      const hh = Math.sqrt(Math.max(0, 1 - t * t)) * size * 0.32;
      ctx.fillRect(x, sy + size * 0.35 - hh, 1, hh * 2);
    }
    const mid = Math.floor((cx / w) * rays);
    if (mid >= 0 && mid < rays && s.dist < zbuf[mid] - 0.08) {
      ctx.fillStyle = "#f2d38a";
      ctx.beginPath();
      ctx.arc(cx - size * 0.08, sy + size * 0.28, size * 0.05, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.08, sy + size * 0.28, size * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWeapon(w, h);

  ctx.fillStyle = "#f0c400";
  ctx.fillRect(w / 2 - 1, h / 2 - 8, 2, 16);
  ctx.fillRect(w / 2 - 8, h / 2 - 1, 16, 2);
  if (hurt > 0) {
    ctx.fillStyle = `rgba(180,20,10,${hurt})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (iframes > 0 && phase === "play") {
    ctx.fillStyle = `rgba(255,255,255,${0.1 * Math.abs(Math.sin(iframes * 28))})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawWeapon(w, h) {
  if (phase !== "play") return;
  ctx.save();
  const showStick = weapon === "stick" || swing > 0;
  if (showStick) {
    const t = swing > 0 ? 1 - swing / SWING_T : 0;
    const lift = swing > 0 ? Math.sin(t * Math.PI) * h * 0.08 : 0;
    ctx.translate(w * 0.7, h * 1.02 - lift);
    ctx.rotate(swing > 0 ? -1.15 + t * 1.85 : -0.42);
    ctx.fillStyle = "#4a2a12";
    ctx.fillRect(-8, -h * 0.5, 16, h * 0.52);
    ctx.fillStyle = "#7a4a22";
    ctx.fillRect(-6, -h * 0.48, 12, h * 0.48);
    ctx.fillStyle = "#2a1608";
    ctx.fillRect(-11, -h * 0.54, 22, 18);
    ctx.fillStyle = "#c8a060";
    ctx.fillRect(-11, -h * 0.54, 22, 5);
  } else {
    const kick = cooldown > 0 ? 10 : 0;
    ctx.translate(w * 0.62, h * 0.98 + kick);
    ctx.fillStyle = "#1a140e";
    ctx.fillRect(-22, -h * 0.1, 28, 48);
    ctx.fillStyle = "#2c2418";
    ctx.fillRect(-6, -h * 0.2, 78, 32);
    ctx.fillStyle = "#3a3224";
    ctx.fillRect(48, -h * 0.24, 54, 18);
    ctx.fillStyle = "#111";
    ctx.fillRect(96, -h * 0.22, 14, 10);
    if (cooldown > 0.08) {
      ctx.fillStyle = "#ffd86a";
      ctx.fillRect(108, -h * 0.24, 22, 12);
    }
  }
  ctx.restore();
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
