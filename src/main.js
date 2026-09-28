import "./style.css";
import { loadGunSprites } from "./assets/gunsprites.js";
import { TEXTURE_SLOT, generateTextures, makeEnemySprite } from "./assets/textures.js";
import { createInput, readMoveAxes } from "./core/input.js";
import { createLoop } from "./core/loop.js";
import { casingSpawn, fireWeapon, swingMelee } from "./game/combat.js";
import { ENEMY_RADIUS } from "./game/hitscan.js";
import { LEVELS, nextLevelIndex } from "./game/levels.js";
import { parseMap } from "./game/map.js";
import { PLAYER_RADIUS, separateBodies, slideMove } from "./game/move.js";
import { createParticles } from "./game/particles.js";
import { createGameState, createHudBinding } from "./game/state.js";
import {
  WEAPONS,
  WEAPON_SLOTS,
  magOf,
  nextWeaponId,
  reserveOf,
  weaponById,
  weaponBySlot,
} from "./game/weapons.js";
import { renderFloorCeiling } from "./render/floors.js";
import { createPresenter } from "./render/framebuffer.js";
import { ACCENT, PALETTE, PALETTE_SIZE, RAMP, SHADE_LEVELS, buildShadeTable, rgb } from "./render/palette.js";
import { renderParticles } from "./render/particles.js";
import { makeCamera } from "./render/raycast.js";
import { shakeOffset } from "./render/shake.js";
import { renderSprites } from "./render/sprites.js";
import { renderWalls } from "./render/walls.js";
import { renderCrosshair, renderFlash, renderWeapon } from "./render/weaponview.js";

let levelIndex = 0;
let parsed = parseMap(LEVELS[0].lines);
let map = parsed.map;
const FOV = Math.PI / 3;
const MOVE = 3.4;
const ENEMY_SPEED = 0.85;
const BITE = 10;
const IFRAMES = 0.65;
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
const hpBlockEl = document.getElementById("hp-block");
const ammoEl = document.getElementById("ammo");
const ammoResEl = document.getElementById("ammo-res");
const weaponLabelEl = document.getElementById("weapon-label");
const levelNameEl = document.getElementById("level-name");
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
const hud = createHudBinding({
  hp: hpEl,
  hpBlock: hpBlockEl,
  ammo: ammoEl,
  ammoRes: ammoResEl,
  weaponLabel: weaponLabelEl,
  levelName: levelNameEl,
  kills: killEl,
});

const input = createInput(canvas, {
  phone,
  stickPx: STICK_PX,
  lookDesktop: LOOK_DESK,
  lookPhone: LOOK_PHONE,
  onAttack: () => attack(),
  onSwap: () => swapWeapon(),
  onReload: () => startReload(),
  onRestart: () => onPlay(),
  onSelectWeapon: (slot) => selectWeapon(slot),
  onMelee: () => quickMelee(),
  isPlaying: () => state.phase === "play",
});
if (phone) input.bindStickPad(document.getElementById("stick"));

const INTERNAL_WIDTH = 480;
const MAX_DIST = 32;

const textures = generateTextures(1337);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const enemyBitmap = makeEnemySprite(7);
const particles = createParticles(192);

let presenter = null;
let zbuf = new Float32Array(1);
let gunSprites = null;
const gunsReady = loadGunSprites()
  .then((sprites) => {
    gunSprites = sprites;
  })
  .catch((err) => {
    console.warn(err);
  });

function currentWeapon() {
  return weaponById(state.weapon) ?? WEAPONS[WEAPON_SLOTS[0]];
}

function world() {
  return { map, enemies: state.enemies, player: state.player };
}

function applyLevel(index, { keepLoadout, hp } = {}) {
  levelIndex = index;
  parsed = parseMap(LEVELS[index].lines);
  map = parsed.map;
  state.enter(parsed, { keepLoadout: !!keepLoadout });
  if (hp != null) state.hp = hp;
  particles.clear();
  firing = false;
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlayTitle.textContent = MENU_TITLE;
  overlaySub.textContent = MENU_SUB;
  playBtn.textContent = MENU_PLAY_LABEL;
}

function showOverlay(title, sub, button) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  playBtn.textContent = button;
  overlay.classList.remove("hidden");
  if (document.pointerLockElement) document.exitPointerLock();
}

function startCampaign() {
  applyLevel(0, { keepLoadout: false });
  hideOverlay();
  syncHud();
}

function onPlay() {
  if (state.phase === "clear") {
    const next = nextLevelIndex(levelIndex, LEVELS.length);
    if (next == null) {
      startCampaign();
      return;
    }
    applyLevel(next, { keepLoadout: true });
    hideOverlay();
    syncHud();
    return;
  }
  if (state.phase === "over") {
    applyLevel(levelIndex, { keepLoadout: true, hp: 100 });
    hideOverlay();
    syncHud();
    return;
  }
  startCampaign();
}

function completeLevel() {
  const next = nextLevelIndex(levelIndex, LEVELS.length);
  if (next == null) {
    state.phase = "win";
    showOverlay("YOU DESCENDED", `kills ${state.kills}`, "AGAIN");
    return;
  }
  state.phase = "clear";
  showOverlay(LEVELS[levelIndex].name, `kills ${state.kills} · map clear`, "NEXT");
}

function syncHud() {
  const weapon = currentWeapon();
  const hp = Math.max(0, Math.ceil(state.hp));
  const reloading = state.reloading > 0 && state.reloadId === weapon.id;
  hud.sync({
    hp: String(hp),
    hpTone: hp <= 20 ? "crit" : hp <= 50 ? "warn" : "ok",
    ammo: weapon.kind === "melee" ? "—" : reloading ? "R" : String(magOf(state.mags, weapon)),
    ammoRes: weapon.kind === "melee" ? weapon.name : String(reserveOf(state.reserves, weapon)),
    weaponLabel: weapon.name,
    levelName: LEVELS[levelIndex].name,
    kills: String(state.kills),
  });
}

function swapWeapon() {
  if (state.phase !== "play") return;
  state.weapon = nextWeaponId(state.weapon, 1);
  firing = false;
  syncHud();
}

function selectWeapon(slot) {
  const weapon = weaponBySlot(slot);
  if (!weapon) return;
  state.weapon = weapon.id;
  syncHud();
}

function tryMove(nx, ny) {
  slideMove(map, state.player, nx, ny, {
    blockers: state.enemies,
    minDist: ENEMY_RADIUS + PLAYER_RADIUS,
  });
}

/**
 * Every swing goes through here, whichever key started it.
 *
 * One gate for one action: `state.swing`. Splitting the melee across two
 * entry points with different gates — the attack key checking the cooldown
 * while the melee key checked the swing — lets a player press both and land
 * two full swings, because neither gate sees what the other set.
 */
function swingWeapon(weapon) {
  if (state.swing > 0) return;
  state.swing = weapon.swingTime;
  state.cooldown = weapon.cooldown;
  state.shake = weapon.shake;
  applyHits(swingMelee(world(), weapon));
  syncHud();
}

function attack() {
  if (state.phase !== "play") return;
  const weapon = currentWeapon();

  if (weapon.kind === "melee") {
    swingWeapon(weapon);
    return;
  }

  if (state.cooldown > 0 || state.reloading > 0) return;
  if (magOf(state.mags, weapon) <= 0) {
    startReload();
    return;
  }
  state.mags[weapon.id] -= 1;
  ejectCasing();
  state.cooldown = weapon.cooldown;
  state.shake = weapon.shake;
  state.lightBoost = weapon.lightBoost;
  const spread = (weapon.spread ?? 0) + (weapon.spreadHeat ?? 0) * state.heat;
  applyHits(fireWeapon(world(), { ...weapon, spread }));
  if (magOf(state.mags, weapon) <= 0) startReload();
  syncHud();
}

const HIT_MARK_T = 0.14;

function applyHits(hits) {
  for (const hit of hits) {
    if (hit.kind === "wall") {
      // Chips off the wall: fewer, paler, and thrown back towards the
      // shooter rather than away.
      particles.spawnBurst(hit.x, hit.y, 0.5, -hit.dirX, -hit.dirY, 4, {
        colorIndex: RAMP.concrete + 4,
        speed: 1.4,
        spread: 1.0,
        life: 0.3,
        lift: 0.8,
      });
      continue;
    }

    state.hitMark = HIT_MARK_T;
    // A low lift is deliberate: at combat range the wall and ceiling behind
    // an enemy are dark reddish-brown, only a few luminance steps from
    // blood's own colour, so a spray that lingers airborne is nearly
    // invisible. Dropping it onto the floor quickly puts it against a much
    // brighter, more neutral surface where it actually reads.
    particles.spawnBurst(hit.x, hit.y, 0.55, hit.dirX, hit.dirY, 14, {
      colorIndex: ACCENT.blood,
      speed: 2.6,
      spread: 1.1,
      life: 0.45,
      lift: 0.35,
    });

    if (hit.killed) {
      state.kills += 1;
      // A death throws far more, and darker. bloodDark is intrinsically low
      // contrast at range — darker than the wall it lands on nearly as
      // often as it's darker than the floor — so this burst leans on sheer
      // count and spread rather than per-particle visibility to read as a
      // bigger event than a normal hit.
      particles.spawnBurst(hit.x, hit.y, 0.5, hit.dirX, hit.dirY, 24, {
        colorIndex: ACCENT.bloodDark,
        speed: 3.6,
        spread: 1.7,
        life: 0.5,
        lift: 0.3,
      });
    }
  }
}

function ejectCasing() {
  const spot = casingSpawn(state.player);
  particles.spawnBurst(spot.x, spot.y, 0.55, spot.dirX, spot.dirY, 1, {
    colorIndex: ACCENT.gold,
    speed: 1.1,
    spread: 0.35,
    life: 0.7,
    lift: 1.1,
  });
}

// The F key swings the pipe whatever is equipped — a panic melee. It shares
// swingWeapon's gate, so it cannot be combined with the attack key to land
// two swings, but it deliberately ignores the equipped weapon's cooldown:
// a spent pistol should never be the thing that stops you hitting something.
function quickMelee() {
  if (state.phase !== "play") return;
  swingWeapon(WEAPONS.pipe);
}

function startReload() {
  const weapon = currentWeapon();
  if (weapon.kind !== "hitscan") return;
  if (
    state.reloading > 0 ||
    reserveOf(state.reserves, weapon) <= 0 ||
    magOf(state.mags, weapon) >= weapon.magSize ||
    state.phase !== "play"
  ) {
    return;
  }
  state.reloading = weapon.reloadTime;
  state.reloadId = weapon.id;
  syncHud();
}

function update(dt) {
  if (state.phase !== "play") return;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.lightBoost = Math.max(0, state.lightBoost - dt * 4);
  state.shake = Math.max(0, state.shake - dt * 3.5);
  state.hitMark = Math.max(0, state.hitMark - dt);
  state.hurt = Math.max(0, state.hurt - dt);
  state.iframes = Math.max(0, state.iframes - dt);
  state.swing = Math.max(0, state.swing - dt);
  if (state.reloading > 0) {
    state.reloading -= dt;
    if (state.reloading <= 0) {
      const weapon = weaponById(state.reloadId) ?? currentWeapon();
      if (weapon.kind === "hitscan") {
        const need = weapon.magSize - magOf(state.mags, weapon);
        const take = Math.min(Math.max(0, need), reserveOf(state.reserves, weapon));
        state.mags[weapon.id] += take;
        state.reserves[weapon.ammo] -= take;
      }
      state.reloading = 0;
      state.reloadId = null;
    }
  }

  const spinning =
    (input.firing || firing) && currentWeapon().id === "chaingun" && state.reloading <= 0;
  state.heat = spinning
    ? Math.min(1, state.heat + dt * 1.4)
    : Math.max(0, state.heat - dt * 2.2);

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
  if (map.isExitAt(state.player.x, state.player.y)) {
    completeLevel();
    return;
  }
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
      state.shake = Math.max(state.shake, 0.5);
      if (state.hp <= 0) die();
    }
  }
  separateBodies(state.enemies, ENEMY_RADIUS * 2);
  particles.update(dt, map);
  syncHud();
}

function tryEnemyMove(e, nx, ny) {
  slideMove(map, e, nx, ny);
}

function die() {
  state.phase = "over";
  const best = Math.max(state.kills, Number(localStorage.getItem(BEST_KEY) || 0));
  localStorage.setItem(BEST_KEY, String(best));
  showOverlay("YOU DIED", `kills ${state.kills}   best ${best}`, "AGAIN");
}

function draw() {
  if (!presenter) return;
  const fb = presenter.fb;
  const camera = makeCamera(state.player.x, state.player.y, state.player.a, FOV);
  const horizon = (fb.height >> 1) + shakeOffset(state.shake, fb.height);

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

  renderParticles(fb, camera, particles, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    horizon,
    lightBoost: state.lightBoost,
  });

  if (state.phase === "play") {
    renderWeapon(
      fb,
      {
        weapon: state.weapon,
        cooldown: state.cooldown,
        swing: state.swing,
        swingTime: currentWeapon().swingTime ?? 0.34,
        reloading: state.reloadId === state.weapon ? state.reloading : 0,
        reloadTime: currentWeapon().reloadTime ?? 1,
      },
      { shadeTable, paletteSize: PALETTE_SIZE, sprites: gunSprites },
    );
    renderCrosshair(fb, shadeTable, PALETTE_SIZE, state.hitMark);
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

playBtn.addEventListener("click", () => onPlay());

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
syncHud();
createLoop({ update, render: draw }).start();
