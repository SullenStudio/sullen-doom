# SULLEN DESCENT — Фаза 2A: ядро боя и обратная связь по попаданию

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить конус автонаведения честной стрельбой лучом по цилиндровым хитбоксам и сделать попадание видимым — кровь, отбрасывание, вспышка, метка на прицеле, тряска камеры.

**Architecture:** Оружие становится строкой в таблице данных, а не веткой в коде. Выстрел бросает настоящий луч: стены считаются тем же DDA, что и рендер, враги — как окружности заданного радиуса; побеждает ближайшее пересечение. Каждое попадание возвращается вызывающему как запись о событии, из которой он делает частицы, отдачу и звук — боевая логика не знает о пикселях.

**Tech Stack:** Vanilla ES-модули, Canvas2D, Vite 6, Vitest.

Спека: `docs/superpowers/specs/2026-09-27-sullen-descent-design.md`, раздел 4.2.
Предыдущая фаза: `docs/superpowers/plans/2026-09-27-phase-1-renderer.md` (завершена).

## Global Constraints

- **Ноль рантайм-зависимостей.** Vitest только в `devDependencies`.
- **Ноль внешних файлов ассетов.** Всё генерируется кодом из сида.
- **Ни одного упоминания `Doom` или `RIP AND TEAR`** вне каталога `docs/`.
- **Идентификаторы, комментарии и сообщения коммитов — на английском.**
- **Автоприцела на десктопе нет.** Луч летит туда, куда смотрит игрок. Доводка на телефоне — предмет фазы 2B, в этой фазе её не добавлять.
- **`render/` не знает о правилах игры, `game/` не знает о пикселях.** Боевые модули возвращают записи о событиях; превращает их в частицы и тряску слой сборки в `main.js`.
- **Vite `base: "./"`** в `vite.config.js` не менять.
- **Ветка** — `sullen-descent`, та же, что и в фазе 1.
- Каждая задача заканчивается коммитом; после неё проходят `npm test` и `npm run build`.

## File Structure

| Файл | Ответственность |
|---|---|
| `src/game/weapons.js` | Таблица данных оружия и выбор по слоту |
| `src/game/hitscan.js` | Пересечение луча со стенами и цилиндрами врагов |
| `src/game/combat.js` | Выстрел и замах поверх таблицы и хитскана; возвращает записи о попаданиях |
| `src/game/particles.js` | Симуляция частиц: спавн, гравитация, затухание, столкновение со стенами |
| `src/render/particles.js` | Отрисовка частиц как точек в мире с проверкой z-буфера |
| `src/render/weaponview.js` | *(правка)* метка попадания на прицеле |
| `src/game/state.js` | *(правка)* поля `shake`, `hitMark`, идентификатор оружия |
| `src/main.js` | *(правка)* сборка: удаление `nearestFoe`/`shoot`/`melee`, подключение новых модулей |

Тесты лежат рядом с исходником: `src/game/weapons.test.js` и так далее.

---

### Task 1: Таблица данных оружия

**Files:**
- Create: `src/game/weapons.js`
- Create: `src/game/weapons.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `AMMO_BULLETS`; `WEAPONS` (объект, ключ — идентификатор); `WEAPON_SLOTS` (массив идентификаторов, индекс+1 = цифровая клавиша); `weaponBySlot(slot)`; `weaponById(id)`; `nextWeaponId(id, step)`.

В этой фазе в таблице два ствола, и форма записи покрывает два вида оружия: ближний бой и хитскан. Дробовик и пулемёт из фазы 2B — это действительно по одной строке.

Гранатомёт и плазма — нет, и утверждать обратное было бы неправдой: по спеке это снарядное оружие, то есть третий вид, которого в перечислении `kind` пока нет. Фаза 2B добавит значение `"projectile"`, поля скорости снаряда и радиуса взрыва и отдельный модуль их полёта. Таблица от этого не разваливается — код стрельбы получит одну новую ветку по виду оружия, а не по конкретному стволу, — но одной строкой это не обойдётся.

- [ ] **Step 1: Написать падающий тест**

`src/game/weapons.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  AMMO_BULLETS,
  WEAPONS,
  WEAPON_SLOTS,
  nextWeaponId,
  weaponById,
  weaponBySlot,
} from "./weapons.js";

describe("WEAPONS", () => {
  it("keys every entry by its own id", () => {
    for (const [key, weapon] of Object.entries(WEAPONS)) {
      expect(weapon.id).toBe(key);
    }
  });

  it("gives every weapon the fields the firing code always reads", () => {
    for (const weapon of Object.values(WEAPONS)) {
      expect(typeof weapon.name).toBe("string");
      expect(weapon.damage).toBeGreaterThan(0);
      expect(weapon.range).toBeGreaterThan(0);
      expect(weapon.cooldown).toBeGreaterThan(0);
      expect(weapon.knockback).toBeGreaterThanOrEqual(0);
      expect(weapon.shake).toBeGreaterThanOrEqual(0);
      expect(weapon.lightBoost).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives melee weapons an arc and a swing time", () => {
    for (const weapon of Object.values(WEAPONS)) {
      if (weapon.kind !== "melee") continue;
      expect(weapon.arc).toBeGreaterThan(0);
      expect(weapon.swingTime).toBeGreaterThan(0);
    }
  });

  it("gives hitscan weapons ammo, a magazine and a pellet count", () => {
    for (const weapon of Object.values(WEAPONS)) {
      if (weapon.kind !== "hitscan") continue;
      expect(typeof weapon.ammo).toBe("string");
      expect(weapon.magSize).toBeGreaterThan(0);
      expect(weapon.reloadTime).toBeGreaterThan(0);
      expect(weapon.pellets).toBeGreaterThanOrEqual(1);
      expect(weapon.spread).toBeGreaterThanOrEqual(0);
    }
  });

  it("only uses kinds the combat code knows", () => {
    for (const weapon of Object.values(WEAPONS)) {
      expect(["melee", "hitscan"]).toContain(weapon.kind);
    }
  });

  it("starts the player on a weapon that never runs out", () => {
    expect(WEAPONS[WEAPON_SLOTS[0]].kind).toBe("melee");
  });
});

describe("WEAPON_SLOTS", () => {
  it("names only weapons that exist", () => {
    for (const id of WEAPON_SLOTS) expect(WEAPONS[id]).toBeDefined();
  });

  it("has no duplicates", () => {
    expect(new Set(WEAPON_SLOTS).size).toBe(WEAPON_SLOTS.length);
  });
});

describe("weaponBySlot", () => {
  it("maps the number keys one-based", () => {
    expect(weaponBySlot(1).id).toBe(WEAPON_SLOTS[0]);
    expect(weaponBySlot(2).id).toBe(WEAPON_SLOTS[1]);
  });

  it("returns null for a slot nobody carries", () => {
    expect(weaponBySlot(0)).toBe(null);
    expect(weaponBySlot(9)).toBe(null);
    expect(weaponBySlot(-1)).toBe(null);
  });
});

describe("weaponById", () => {
  it("finds a known weapon and rejects an unknown one", () => {
    expect(weaponById(WEAPON_SLOTS[0]).id).toBe(WEAPON_SLOTS[0]);
    expect(weaponById("railgun")).toBe(null);
  });

  it("does not mistake an inherited property for a weapon", () => {
    // A plain object literal answers for keys it never declared.
    for (const id of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      expect(weaponById(id)).toBe(null);
    }
  });
});

describe("nextWeaponId", () => {
  it("steps forward and wraps", () => {
    const last = WEAPON_SLOTS[WEAPON_SLOTS.length - 1];
    expect(nextWeaponId(WEAPON_SLOTS[0], 1)).toBe(WEAPON_SLOTS[1]);
    expect(nextWeaponId(last, 1)).toBe(WEAPON_SLOTS[0]);
  });

  it("steps backward and wraps", () => {
    const last = WEAPON_SLOTS[WEAPON_SLOTS.length - 1];
    expect(nextWeaponId(WEAPON_SLOTS[0], -1)).toBe(last);
  });

  it("falls back to the first slot for an unknown id", () => {
    expect(nextWeaponId("railgun", 1)).toBe(WEAPON_SLOTS[0]);
  });
});

describe("ammo", () => {
  it("names the bullet pool the pistol draws from", () => {
    expect(WEAPONS.pistol.ammo).toBe(AMMO_BULLETS);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/game/weapons.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/game/weapons.js`**

```js
// Every weapon is a row in this table rather than a branch in the firing
// code. Phase 2B adds the shotgun, machine gun, launcher and plasma gun as
// four more entries, and the code that fires them does not change.

export const AMMO_BULLETS = "bullets";

export const WEAPONS = {
  pipe: {
    id: "pipe",
    name: "PIPE",
    kind: "melee",
    damage: 2,
    range: 1.45,
    // Half-angle of the swing, in radians. A swing sweeps; it is not a bullet.
    arc: 0.5,
    cooldown: 0.34,
    swingTime: 0.34,
    knockback: 0.22,
    shake: 0.1,
    lightBoost: 0,
  },
  pistol: {
    id: "pistol",
    name: "PISTOL",
    kind: "hitscan",
    damage: 1,
    pellets: 1,
    spread: 0,
    range: 20,
    cooldown: 0.16,
    ammo: AMMO_BULLETS,
    magSize: 8,
    reloadTime: 0.85,
    knockback: 0.14,
    shake: 0.18,
    lightBoost: 0.35,
  },
};

/** Index + 1 is the number key that selects the weapon. */
export const WEAPON_SLOTS = ["pipe", "pistol"];

export function weaponBySlot(slot) {
  const id = WEAPON_SLOTS[slot - 1];
  return id ? WEAPONS[id] : null;
}

export function weaponById(id) {
  // Own properties only. A plain object literal answers for inherited keys,
  // so a bare lookup would hand back Object.prototype.toString for the id
  // "toString" instead of null.
  return Object.hasOwn(WEAPONS, id) ? WEAPONS[id] : null;
}

/** Cycles through the carried weapons; `step` is +1 or -1. */
export function nextWeaponId(id, step) {
  const at = WEAPON_SLOTS.indexOf(id);
  if (at < 0) return WEAPON_SLOTS[0];
  const count = WEAPON_SLOTS.length;
  return WEAPON_SLOTS[(at + step + count) % count];
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/weapons.js src/game/weapons.test.js
git commit -m "feat: describe weapons in a data table"
```

---

### Task 2: Хитскан по стенам и цилиндрам врагов

Закрывает D4 на уровне геометрии: настоящий луч вместо конуса автонаведения.

**Files:**
- Create: `src/game/hitscan.js`
- Create: `src/game/hitscan.test.js`

**Interfaces:**
- Consumes: `castColumn` из `src/render/raycast.js`; `map` из `parseMap`.
- Produces: `ENEMY_RADIUS` (= 0.32); `wallDistance(map, ox, oy, dirX, dirY, maxDist)`; `rayCircle(ox, oy, dirX, dirY, cx, cy, radius)` → `number | null`; `castHitscan(map, ox, oy, dirX, dirY, enemies, maxDist, radius?)` → `{ kind: "enemy" | "wall" | "none", enemy, dist, x, y }`.

**Направление обязано быть единичной длины.** На этом держится вся арифметика: в решении квадратного уравнения коэффициент при `t²` принят равным единице, а дистанция до стены совпадает с параметром луча.

- [ ] **Step 1: Написать падающий тест**

`src/game/hitscan.test.js`:

```js
import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { ENEMY_RADIUS, castHitscan, rayCircle, wallDistance } from "./hitscan.js";

// Open room, walls on the border only. Interior cells 1..7 on both axes.
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

// A room split by a wall down column 4.
const { map: split } = parseMap([
  "#########",
  "#...#...#",
  "#...#...#",
  "#...#...#",
  "#########",
]);

const foe = (x, y, hp = 2) => ({ x, y, hp, hit: 0 });

describe("rayCircle", () => {
  it("returns the near intersection of a circle straight ahead", () => {
    // Circle centred 3 away, radius 0.5: the ray enters at 2.5.
    expect(rayCircle(0, 0, 1, 0, 3, 0, 0.5)).toBeCloseTo(2.5, 10);
  });

  it("misses a circle the ray passes beside", () => {
    expect(rayCircle(0, 0, 1, 0, 3, 2, 0.5)).toBe(null);
  });

  it("misses a circle behind the origin", () => {
    expect(rayCircle(0, 0, 1, 0, -3, 0, 0.5)).toBe(null);
  });

  it("returns the exit point when the origin is inside the circle", () => {
    expect(rayCircle(0, 0, 1, 0, 0, 0, 0.5)).toBeCloseTo(0.5, 10);
  });

  it("grazes a circle touched exactly on its edge", () => {
    const t = rayCircle(0, 0, 1, 0, 3, 0.5, 0.5);
    expect(t).not.toBe(null);
    expect(t).toBeCloseTo(3, 6);
  });

  it("works along an arbitrary direction", () => {
    const k = Math.SQRT1_2;
    expect(rayCircle(0, 0, k, k, 2 * k, 2 * k, 0.5)).toBeCloseTo(1.5, 10);
  });
});

describe("wallDistance", () => {
  it("measures the wall straight ahead", () => {
    expect(wallDistance(map, 4.5, 4.5, 1, 0, 32)).toBeCloseTo(3.5, 10);
  });

  it("measures the wall behind", () => {
    expect(wallDistance(map, 4.5, 4.5, -1, 0, 32)).toBeCloseTo(3.5, 10);
  });

  it("reports maxDist when no wall is within range", () => {
    expect(wallDistance(map, 4.5, 4.5, 1, 0, 1.5)).toBe(1.5);
  });
});

describe("castHitscan", () => {
  it("strikes an enemy standing in the open", () => {
    const e = foe(7.0, 4.5);
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [e], 20);
    expect(shot.kind).toBe("enemy");
    expect(shot.enemy).toBe(e);
    expect(shot.dist).toBeCloseTo(2.5 - ENEMY_RADIUS, 6);
  });

  it("reports the impact point on the enemy's near side", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 4.5)], 20);
    expect(shot.x).toBeCloseTo(7.0 - ENEMY_RADIUS, 6);
    expect(shot.y).toBeCloseTo(4.5, 6);
  });

  it("misses an enemy the ray passes beside", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 6.0)], 20);
    expect(shot.kind).toBe("wall");
  });

  it("does not shoot through a wall", () => {
    // Player left of the partition, enemy right of it.
    const shot = castHitscan(split, 2.5, 2.5, 1, 0, [foe(6.0, 2.5)], 20);
    expect(shot.kind).toBe("wall");
    expect(shot.enemy).toBe(null);
  });

  it("ignores a dead enemy", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 4.5, 0)], 20);
    expect(shot.kind).toBe("wall");
  });

  it("picks the nearer of two enemies on the same line", () => {
    const near = foe(6.0, 4.5);
    const far = foe(7.0, 4.5);
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [far, near], 20);
    expect(shot.enemy).toBe(near);
  });

  it("reports none when nothing is inside maxDist", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(7.0, 4.5)], 0.5);
    expect(shot.kind).toBe("none");
    expect(shot.dist).toBe(0.5);
  });

  it("ignores an enemy further away than the wall behind it", () => {
    const shot = castHitscan(map, 4.5, 4.5, 1, 0, [foe(9.5, 4.5)], 20);
    expect(shot.kind).toBe("wall");
  });

  it("always reports a finite impact point", () => {
    for (const a of [0, 0.7, Math.PI / 2, 2.4, Math.PI, 4.1, 5.9]) {
      const shot = castHitscan(map, 4.5, 4.5, Math.cos(a), Math.sin(a), [], 20);
      expect(Number.isFinite(shot.x)).toBe(true);
      expect(Number.isFinite(shot.y)).toBe(true);
      expect(shot.dist).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/game/hitscan.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/game/hitscan.js`**

```js
import { castColumn } from "../render/raycast.js";

/**
 * Enemies are hit-tested as upright cylinders. The radius is a little under
 * half a cell so two of them can stand side by side without their hitboxes
 * overlapping.
 */
export const ENEMY_RADIUS = 0.32;

/**
 * Distance to the first wall along a ray.
 *
 * Reuses the renderer's wall DDA by handing it a camera whose plane is zero,
 * so screen column 0 IS this ray. Because the direction is unit length, the
 * perpendicular distance the cast returns is the plain distance along the
 * ray — the two only differ when the plane spreads the ray away from the
 * view direction.
 */
export function wallDistance(map, ox, oy, dirX, dirY, maxDist) {
  const camera = { x: ox, y: oy, dirX, dirY, planeX: 0, planeY: 0 };
  const hit = castColumn(map, camera, 0, maxDist);
  return hit.hit ? Math.min(hit.dist, maxDist) : maxDist;
}

/**
 * Nearest positive intersection of a ray with a circle, or null.
 *
 * Solves |origin + t*dir - centre|^2 = radius^2. The coefficient on t^2 is
 * the squared length of the direction, which is 1 because callers pass a
 * unit vector, so the quadratic reduces to t^2 + b*t + c = 0.
 */
export function rayCircle(ox, oy, dirX, dirY, cx, cy, radius) {
  const fx = ox - cx;
  const fy = oy - cy;
  const b = 2 * (fx * dirX + fy * dirY);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  let t = (-b - root) / 2;
  // Standing inside the circle puts the near root behind us; use the exit.
  if (t < 0) t = (-b + root) / 2;
  if (t < 0) return null;
  return t;
}

/**
 * Casts one ray and reports the first thing it strikes. Walls and enemies
 * compete on distance, so an enemy behind cover is never hit.
 */
export function castHitscan(
  map,
  ox,
  oy,
  dirX,
  dirY,
  enemies,
  maxDist,
  radius = ENEMY_RADIUS,
) {
  const wall = wallDistance(map, ox, oy, dirX, dirY, maxDist);
  let best = null;
  let bestT = Math.min(wall, maxDist);

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const t = rayCircle(ox, oy, dirX, dirY, enemy.x, enemy.y, radius);
    if (t === null || t >= bestT) continue;
    bestT = t;
    best = enemy;
  }

  if (best) {
    return {
      kind: "enemy",
      enemy: best,
      dist: bestT,
      x: ox + dirX * bestT,
      y: oy + dirY * bestT,
    };
  }
  if (wall < maxDist) {
    return {
      kind: "wall",
      enemy: null,
      dist: wall,
      x: ox + dirX * wall,
      y: oy + dirY * wall,
    };
  }
  return {
    kind: "none",
    enemy: null,
    dist: maxDist,
    x: ox + dirX * maxDist,
    y: oy + dirY * maxDist,
  };
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/hitscan.js src/game/hitscan.test.js
git commit -m "feat: cast real rays against walls and enemy cylinders"
```

---

### Task 3: Боевая логика и подключение к игре

Здесь автонаведение удаляется окончательно (D4).

**Files:**
- Create: `src/game/combat.js`
- Create: `src/game/combat.test.js`
- Modify: `src/main.js` (удалить `nearestFoe`, `shoot`, `melee`; перевести `attack`, `selectWeapon`, `swapWeapon`, `startReload`, `syncHud` на таблицу оружия)
- Modify: `src/game/state.js` (идентификатор оружия вместо строк `"gun"`/`"stick"`)

**Interfaces:**
- Consumes: `castHitscan`, `ENEMY_RADIUS` из `hitscan.js`; `WEAPONS`, `WEAPON_SLOTS`, `weaponById`, `nextWeaponId` из `weapons.js`.
- Produces: `HIT_FLASH_T` (= 0.22); `fireWeapon(world, weapon, random?)` → `HitRecord[]`; `swingMelee(world, weapon)` → `HitRecord[]`.

`world` это `{ map, enemies, player }`, где `player` имеет `x`, `y`, `a`.
`HitRecord` это `{ kind: "enemy" | "wall", x, y, dirX, dirY, enemy, damage, killed }`.

Записи возвращаются, а не рисуются: `game/` не знает о пикселях. Частицы и тряску из них делает `main.js` в задаче 6.

- [ ] **Step 1: Написать падающий тест**

`src/game/combat.test.js`:

```js
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/game/combat.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/game/combat.js`**

```js
import { castHitscan } from "./hitscan.js";

/** How long a struck enemy renders at full brightness. */
export const HIT_FLASH_T = 0.22;

/** Number of rays a melee swing sweeps across its arc. */
const SWING_RAYS = 5;

function shove(map, enemy, dx, dy) {
  // Same axis-at-a-time rule the walk code uses, so knockback can slide
  // along a wall instead of stopping dead or tunnelling through it.
  if (!map.isSolidAt(enemy.x + dx, enemy.y)) enemy.x += dx;
  if (!map.isSolidAt(enemy.x, enemy.y + dy)) enemy.y += dy;
}

/**
 * Casts one ray and applies its damage. Returns a record of what happened,
 * or null if the ray reached nothing worth reporting.
 *
 * `alreadyHit` lets a multi-ray attack — a melee sweep — damage each enemy
 * at most once.
 */
function resolveRay(world, weapon, angle, alreadyHit) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const shot = castHitscan(
    world.map,
    world.player.x,
    world.player.y,
    dirX,
    dirY,
    world.enemies,
    weapon.range,
  );
  if (shot.kind === "none") return null;
  if (shot.kind === "enemy" && alreadyHit.has(shot.enemy)) return null;

  const record = {
    kind: shot.kind,
    x: shot.x,
    y: shot.y,
    dirX,
    dirY,
    enemy: shot.enemy,
    damage: 0,
    killed: false,
  };

  if (shot.kind === "enemy") {
    alreadyHit.add(shot.enemy);
    shot.enemy.hp -= weapon.damage;
    shot.enemy.hit = HIT_FLASH_T;
    shove(world.map, shot.enemy, dirX * weapon.knockback, dirY * weapon.knockback);
    record.damage = weapon.damage;
    record.killed = shot.enemy.hp <= 0;
  }

  return record;
}

/**
 * Fires a hitscan weapon. One ray per pellet, each jittered within the
 * weapon's spread. `random` is injectable so the spread is testable.
 */
export function fireWeapon(world, weapon, random = Math.random) {
  const hits = [];
  const alreadyHit = new Set();
  const pellets = weapon.pellets ?? 1;
  for (let i = 0; i < pellets; i++) {
    const jitter = weapon.spread ? (random() * 2 - 1) * weapon.spread : 0;
    const record = resolveRay(world, weapon, world.player.a + jitter, alreadyHit);
    if (record) hits.push(record);
  }
  return hits;
}

/**
 * Swings a melee weapon. Several rays spread across the arc, because a swing
 * sweeps an area rather than travelling down a line — but each enemy still
 * takes the damage only once.
 */
export function swingMelee(world, weapon) {
  const hits = [];
  const alreadyHit = new Set();
  for (let i = 0; i < SWING_RAYS; i++) {
    const t = SWING_RAYS === 1 ? 0.5 : i / (SWING_RAYS - 1);
    const angle = world.player.a + (t * 2 - 1) * weapon.arc;
    const record = resolveRay(world, weapon, angle, alreadyHit);
    if (record) hits.push(record);
  }
  return hits;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Переименовать оружие в состоянии**

В `src/game/state.js` начальное оружие становится идентификатором из таблицы. Заменить `weapon: "gun",` на `weapon: "pistol",` в объявлении состояния и `state.weapon = "gun";` на `state.weapon = "pistol";` внутри `reset()`.

- [ ] **Step 6: Перевести `main.js` на таблицу оружия**

Удалить целиком функции `nearestFoe` и `shoot`. Функцию `blocked` тоже удалить: её единственным потребителем был `nearestFoe`. Функция `melee` не удаляется, а заменяется на `quickMelee` ниже — у неё есть живой потребитель, клавиша `F`.

Добавить импорты:

```js
import { fireWeapon, swingMelee } from "./game/combat.js";
import {
  WEAPONS,
  WEAPON_SLOTS,
  nextWeaponId,
  weaponById,
  weaponBySlot,
} from "./game/weapons.js";
```

Удалить константы `MAG_SIZE`, `RELOAD_T`, `SWING_T`, `STICK_RANGE`, `STICK_DMG`: все эти значения теперь живут в таблице.

Ввести доступ к текущему оружию и объект мира:

```js
function currentWeapon() {
  return weaponById(state.weapon) ?? WEAPONS[WEAPON_SLOTS[0]];
}

function world() {
  return { map, enemies: state.enemies, player: state.player };
}
```

Заменить `attack`, `swapWeapon`, `selectWeapon` и `startReload`:

```js
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
  if (state.mag <= 0) {
    startReload();
    return;
  }
  state.mag -= 1;
  state.cooldown = weapon.cooldown;
  state.lightBoost = weapon.lightBoost;
  applyHits(fireWeapon(world(), weapon));
  if (state.mag <= 0) startReload();
  syncHud();
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

function startReload() {
  const weapon = currentWeapon();
  if (weapon.kind !== "hitscan") return;
  if (
    state.reloading > 0 ||
    state.reserve <= 0 ||
    state.mag >= weapon.magSize ||
    state.phase !== "play"
  ) {
    return;
  }
  state.reloading = weapon.reloadTime;
  syncHud();
}
```

**Клавиша `F` остаётся рабочей.** Удаление `melee()` осиротило бы
`onMelee: () => melee()` в конфигурации ввода, и первое нажатие `F` дало бы
`melee is not defined`. Ни тесты, ни сборка этого не увидят: обвязка ввода
в `main.js` не покрыта. Поэтому вместо удаления функция переезжает на
таблицу — быстрый удар трубой независимо от того, что в руках, как и было
в исходной игре:

```js
// The F key swings the pipe whatever is equipped — a panic melee. It shares
// swingWeapon's gate, so it cannot be combined with the attack key to land
// two swings, but it deliberately ignores the equipped weapon's cooldown:
// a spent pistol should never be the thing that stops you hitting something.
function quickMelee() {
  if (state.phase !== "play") return;
  swingWeapon(WEAPONS.pipe);
}
```

и в конфигурации `createInput` остаётся `onMelee: () => quickMelee(),`.

`applyHits` пока считает только убийства; частицы и тряску к нему подключит задача 6:

```js
function applyHits(hits) {
  for (const hit of hits) {
    if (hit.killed) state.kills += 1;
  }
}
```

В `update` перезарядка берёт размер магазина из таблицы — заменить `MAG_SIZE` на `currentWeapon().magSize`, а сам блок обернуть проверкой, что оружие стрелковое:

```js
  if (state.reloading > 0) {
    state.reloading -= dt;
    if (state.reloading <= 0) {
      const weapon = currentWeapon();
      const need = (weapon.magSize ?? 0) - state.mag;
      const take = Math.min(Math.max(0, need), state.reserve);
      state.mag += take;
      state.reserve -= take;
      state.reloading = 0;
    }
  }
```

`syncHud` показывает имя оружия из таблицы:

```js
function syncHud() {
  const weapon = currentWeapon();
  hud.sync({
    hp: `HP ${Math.max(0, Math.ceil(state.hp))}`,
    ammo:
      weapon.kind === "melee"
        ? weapon.name
        : state.reloading > 0
          ? "RELOAD"
          : `${weapon.name} ${state.mag}/${state.reserve}`,
    kills: `KILLS ${state.kills}`,
  });
}
```

В `draw` отрисовка оружия получает идентификатор и время замаха из таблицы:

```js
      { weapon: state.weapon, cooldown: state.cooldown, swing: state.swing, swingTime: currentWeapon().swingTime ?? 0.34 },
```

- [ ] **Step 7: Обновить `weaponview.js` под новые идентификаторы**

В `renderWeapon` условие выбора вида заменить на сравнение с идентификатором ближнего оружия:

```js
export function renderWeapon(fb, view, options) {
  if (view.weapon === "pipe" || view.swing > 0) drawStick(fb, view, options);
  else drawGun(fb, view, options);
}
```

В `src/render/weaponview.test.js` заменить все `weapon: "stick"` на `weapon: "pipe"` и все `weapon: "gun"` на `weapon: "pistol"`.

- [ ] **Step 8: Проверить, что автонаведения больше нет**

Run: `grep -n "nearestFoe\|cone" src/main.js`
Expected: пустой вывод.

- [ ] **Step 9: Проверить в игре**

Run: `npm run dev`
Expected: выстрел мимо врага больше не засчитывается как попадание; чтобы попасть, нужно навести прицел; из палки бьёт по врагу сбоку от прицела, но не дальше своей дистанции; переключение клавишами 1, 2 и Q работает; HUD показывает `PISTOL 8/40` и `PIPE`.

- [ ] **Step 10: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 11: Commit**

```bash
git add src/game/combat.js src/game/combat.test.js src/game/state.js \
  src/main.js src/render/weaponview.js src/render/weaponview.test.js
git commit -m "feat: fire real rays instead of a homing cone"
```

---

### Task 4: Симуляция частиц

**Files:**
- Create: `src/game/particles.js`
- Create: `src/game/particles.test.js`

**Interfaces:**
- Consumes: `map` из `parseMap` (для столкновений).
- Produces: `createParticles(capacity?)` → объект с `capacity`, `items`, `clear()`, `spawnBurst(x, y, z, dirX, dirY, count, options)`, `update(dt, map)`, `activeCount()`.

Частица это `{ x, y, z, vx, vy, vz, life, maxLife, colorIndex }`, где `z` — высота над полом в долях высоты стены: `0` пол, `1` потолок.

Пул фиксированного размера с кольцевым курсором: память не выделяется в кадре, а самый старый след уступает место новому.

- [ ] **Step 1: Написать падающий тест**

`src/game/particles.test.js`:

```js
import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";
import { createParticles } from "./particles.js";

const { map } = parseMap([
  "#####",
  "#...#",
  "#...#",
  "#...#",
  "#####",
]);

// A deterministic stand-in for Math.random so bursts are reproducible.
const seq = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const burst = (p, count, extra = {}) =>
  p.spawnBurst(2.5, 2.5, 0.5, 1, 0, count, {
    colorIndex: 3,
    random: seq([0.5]),
    ...extra,
  });

describe("createParticles", () => {
  it("starts with nothing alive", () => {
    expect(createParticles(16).activeCount()).toBe(0);
  });

  it("allocates its pool up front", () => {
    const p = createParticles(16);
    expect(p.items).toHaveLength(16);
  });

  it("brings exactly the requested count to life", () => {
    const p = createParticles(32);
    burst(p, 8);
    expect(p.activeCount()).toBe(8);
  });

  it("never exceeds its capacity", () => {
    const p = createParticles(8);
    burst(p, 40);
    expect(p.activeCount()).toBeLessThanOrEqual(8);
    expect(p.items).toHaveLength(8);
  });

  it("places new particles at the spawn point", () => {
    const p = createParticles(8);
    burst(p, 4);
    for (const q of p.items.filter((i) => i.life > 0)) {
      expect(q.x).toBeCloseTo(2.5, 6);
      expect(q.y).toBeCloseTo(2.5, 6);
      expect(q.z).toBeCloseTo(0.5, 6);
    }
  });

  it("carries the requested colour", () => {
    const p = createParticles(8);
    burst(p, 4, { colorIndex: 11 });
    for (const q of p.items.filter((i) => i.life > 0)) {
      expect(q.colorIndex).toBe(11);
    }
  });

  it("retires a particle once its life runs out", () => {
    const p = createParticles(8);
    burst(p, 4, { life: 0.1 });
    p.update(0.5, map);
    expect(p.activeCount()).toBe(0);
  });

  it("accelerates particles downward every step", () => {
    // The direct statement of gravity: vertical speed only ever decreases.
    const p = createParticles(8);
    burst(p, 1, { life: 10 });
    const q = p.items.find((i) => i.life > 0);
    let previous = Infinity;
    for (let i = 0; i < 10; i++) {
      p.update(1 / 60, map);
      expect(q.vz).toBeLessThan(previous);
      previous = q.vz;
    }
  });

  it("throws particles up before gravity brings them back down", () => {
    // A burst is thrown upward, so it rises first. With a lift of about 1.2
    // against a gravity of 2.6 the peak arrives near 0.46s and the particle
    // does not return to its launch height until roughly 0.92s — so a test
    // that samples too early sees it still above where it started.
    const p = createParticles(8);
    burst(p, 1, { life: 10 });
    const q = p.items.find((i) => i.life > 0);
    const start = q.z;
    const heights = [];
    for (let i = 0; i < 90; i++) {
      p.update(1 / 60, map);
      heights.push(q.z);
    }
    expect(Math.max(...heights)).toBeGreaterThan(start);
    expect(heights[heights.length - 1]).toBeLessThan(start);
  });

  it("settles particles on the floor instead of sinking through it", () => {
    const p = createParticles(8);
    burst(p, 1, { life: 10 });
    for (let i = 0; i < 400; i++) p.update(1 / 60, map);
    const q = p.items.find((i) => i.life > 0);
    expect(q.z).toBeGreaterThanOrEqual(0);
    expect(q.z).toBeLessThan(0.1);
  });

  it("does not let particles pass through a wall", () => {
    const p = createParticles(8);
    // Fired hard at the east wall from close range.
    p.spawnBurst(3.4, 2.5, 0.5, 1, 0, 6, {
      colorIndex: 3,
      speed: 20,
      spread: 0,
      life: 10,
      random: seq([0.5]),
    });
    for (let i = 0; i < 120; i++) p.update(1 / 60, map);
    for (const q of p.items.filter((i) => i.life > 0)) {
      expect(map.isSolidAt(q.x, q.y)).toBe(false);
    }
  });

  it("damps horizontal motion once a particle is resting on the floor", () => {
    // Drag is behaviour, not tuning: without it a particle slides along the
    // floor forever at its launch speed. The exact value is free to change,
    // so this pins that damping happens, not how much.
    const p = createParticles(8);
    p.spawnBurst(2.5, 2.5, 0.05, 1, 0, 1, {
      colorIndex: 3,
      speed: 1.2,
      spread: 0,
      life: 10,
      lift: 0,
      random: seq([0.5]),
    });
    const q = p.items.find((i) => i.life > 0);
    // Let it reach the floor first; drag only applies once it is resting.
    for (let i = 0; i < 5; i++) p.update(1 / 60, map);
    const resting = Math.abs(q.vx);
    expect(resting).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) p.update(1 / 60, map);
    expect(Math.abs(q.vx)).toBeLessThan(resting * 0.5);
  });

  it("clear() retires everything", () => {
    const p = createParticles(8);
    burst(p, 6);
    p.clear();
    expect(p.activeCount()).toBe(0);
  });

  it("is reproducible for a given random source", () => {
    const run = () => {
      const p = createParticles(8);
      burst(p, 4);
      p.update(1 / 60, map);
      return p.items.map((q) => [q.x, q.y, q.z, q.life]);
    };
    expect(run()).toEqual(run());
  });

  it("spreads a burst around its direction", () => {
    const p = createParticles(8);
    p.spawnBurst(2.5, 2.5, 0.5, 1, 0, 2, {
      colorIndex: 3,
      spread: 1,
      // Four draws per particle: angle, speed, lift, life. The two
      // particles must differ on the first of them.
      random: seq([0, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5]),
    });
    const live = p.items.filter((q) => q.life > 0);
    expect(live[0].vy).not.toBeCloseTo(live[1].vy, 3);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/game/particles.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/game/particles.js`**

```js
/**
 * A fixed pool of short-lived world points: blood from a struck enemy,
 * chips from a wall. Nothing is allocated during a frame — the pool is
 * built once and a ring cursor lets a new burst overwrite the oldest
 * particles rather than growing without bound.
 *
 * `z` is height above the floor in the same units the renderer uses for
 * wall height: 0 is the floor, 1 is the ceiling.
 */

const GRAVITY = 2.6;
/** Height at which a particle stops falling and starts sliding to a halt. */
const REST_Z = 0.02;
const FLOOR_DRAG = 0.4;

export function createParticles(capacity = 192) {
  const items = [];
  for (let i = 0; i < capacity; i++) {
    items.push({
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 1,
      colorIndex: 0,
    });
  }
  let cursor = 0;

  return {
    capacity,
    items,

    clear() {
      for (const q of items) q.life = 0;
    },

    spawnBurst(x, y, z, dirX, dirY, count, options) {
      const {
        colorIndex,
        speed = 2.2,
        spread = 0.8,
        life = 0.5,
        lift = 1.2,
        random = Math.random,
      } = options;
      const base = Math.atan2(dirY, dirX);
      for (let i = 0; i < count; i++) {
        const q = items[cursor];
        cursor = (cursor + 1) % capacity;
        const angle = base + (random() * 2 - 1) * spread;
        const s = speed * (0.4 + random() * 0.6);
        q.x = x;
        q.y = y;
        q.z = z;
        q.vx = Math.cos(angle) * s;
        q.vy = Math.sin(angle) * s;
        q.vz = lift * (0.5 + random());
        q.maxLife = life * (0.6 + random() * 0.8);
        q.life = q.maxLife;
        q.colorIndex = colorIndex;
      }
    },

    update(dt, map) {
      for (const q of items) {
        if (q.life <= 0) continue;
        q.life -= dt;
        if (q.life <= 0) continue;

        q.vz -= GRAVITY * dt;

        // Axis at a time, the same rule the walk code uses, so a particle
        // slides along a wall instead of stopping dead or tunnelling.
        const nx = q.x + q.vx * dt;
        if (map.isSolidAt(nx, q.y)) q.vx = 0;
        else q.x = nx;
        const ny = q.y + q.vy * dt;
        if (map.isSolidAt(q.x, ny)) q.vy = 0;
        else q.y = ny;

        q.z += q.vz * dt;
        if (q.z <= REST_Z) {
          q.z = REST_Z;
          q.vz = 0;
          q.vx *= FLOOR_DRAG;
          q.vy *= FLOOR_DRAG;
        }
      }
    },

    activeCount() {
      let n = 0;
      for (const q of items) if (q.life > 0) n++;
      return n;
    },
  };
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/particles.js src/game/particles.test.js
git commit -m "feat: simulate a pool of short-lived particles"
```

---

### Task 5: Отрисовка частиц

**Files:**
- Create: `src/render/particles.js`
- Create: `src/render/particles.test.js`
- Modify: `src/main.js` (создать пул, обновлять в `update`, рисовать в `draw`, чистить в `reset`)

**Interfaces:**
- Consumes: `projectSprite` из `render/sprites.js`; `lightLevel` из `render/palette.js`; пул из `game/particles.js`.
- Produces: `renderParticles(fb, camera, particles, options)`, где `options` это `{ shadeTable, paletteSize, zbuf, horizon, lightBoost }`.

**Вертикальная проекция.** Стена единичной высоты на дистанции `d` занимает от `horizon - h/(2d)` до `horizon + h/(2d)`. Значит точка на высоте `z` попадает на `horizon + h*(0.5 - z)/d`. Та же формула, что ставит ноги спрайтов на пол, поэтому частицы и спрайты не разъезжаются.

- [ ] **Step 1: Написать падающий тест**

`src/render/particles.test.js`:

```js
import { describe, expect, it } from "vitest";
import { createParticles } from "../game/particles.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderParticles } from "./particles.js";

const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const W = 96;
const H = 60;
const FOV = Math.PI / 3;

function scene(place, wallDepth = Infinity) {
  const fb = createFramebuffer(W, H);
  fb.clear(0);
  const zbuf = new Float32Array(W).fill(wallDepth);
  const particles = createParticles(8);
  place(particles);
  renderParticles(fb, makeCamera(2.5, 2.5, 0, FOV), particles, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    horizon: H >> 1,
    lightBoost: 0,
  });
  return fb;
}

const painted = (fb) => [...fb.data].filter((p) => p !== 0).length;

// Drops one motionless particle at an exact spot by writing the pool directly.
function place(particles, x, y, z) {
  const q = particles.items[0];
  q.x = x; q.y = y; q.z = z;
  q.vx = 0; q.vy = 0; q.vz = 0;
  q.life = 1; q.maxLife = 1; q.colorIndex = 37;
}

describe("renderParticles", () => {
  it("draws a particle in front of the camera", () => {
    const fb = scene((p) => place(p, 5.5, 2.5, 0.5));
    expect(painted(fb)).toBeGreaterThan(0);
  });

  it("draws nothing for a particle behind the camera", () => {
    const fb = scene((p) => place(p, 0.5, 2.5, 0.5));
    expect(painted(fb)).toBe(0);
  });

  it("draws nothing for a dead particle", () => {
    const fb = scene((p) => {
      place(p, 5.5, 2.5, 0.5);
      p.items[0].life = 0;
    });
    expect(painted(fb)).toBe(0);
  });

  it("hides a particle behind a nearer wall", () => {
    const fb = scene((p) => place(p, 5.5, 2.5, 0.5), 1.0);
    expect(painted(fb)).toBe(0);
  });

  it("draws a near particle larger than a far one", () => {
    const near = painted(scene((p) => place(p, 3.2, 2.5, 0.5)));
    const far = painted(scene((p) => place(p, 8.0, 2.5, 0.5)));
    expect(near).toBeGreaterThan(far);
  });

  it("puts a particle at floor height below one at head height", () => {
    const rowOf = (fb) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) if (fb.data[y * W + x] !== 0) return y;
      }
      return -1;
    };
    const high = rowOf(scene((p) => place(p, 5.5, 2.5, 0.9)));
    const low = rowOf(scene((p) => place(p, 5.5, 2.5, 0.05)));
    expect(low).toBeGreaterThan(high);
  });

  it("dims a distant particle", () => {
    const luma = (fb) => {
      for (const p of fb.data) {
        if (p !== 0) return (p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255);
      }
      return 0;
    };
    expect(luma(scene((p) => place(p, 3.2, 2.5, 0.5))))
      .toBeGreaterThan(luma(scene((p) => place(p, 9.0, 2.5, 0.5))));
  });

  it("never writes outside the buffer", () => {
    expect(() => scene((p) => place(p, 2.55, 2.5, 0.5))).not.toThrow();
    expect(() => scene((p) => place(p, 5.5, 2.5, 4))).not.toThrow();
    expect(() => scene((p) => place(p, 5.5, 2.5, -4))).not.toThrow();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/particles.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/particles.js`**

```js
import { lightLevel } from "./palette.js";
import { projectSprite } from "./sprites.js";

/**
 * Particles are points in the world, so they go through the same camera
 * matrix as sprites and are depth-tested against the wall z-buffer.
 *
 * Vertical placement matches the wall projection: a wall of unit height at
 * distance d spans horizon ± h/(2d), so a point at height z lands on
 * horizon + h*(0.5 - z)/d. Sharing that formula is what keeps blood on the
 * floor from floating above it.
 */
export function renderParticles(fb, camera, particles, options) {
  const { shadeTable, paletteSize, zbuf, horizon, lightBoost } = options;
  const { width, height, data } = fb;

  for (const q of particles.items) {
    if (q.life <= 0) continue;
    const p = projectSprite(camera, q.x, q.y);
    if (!p) continue;

    const centreX = Math.round(p.screenX * width);
    if (centreX < 0 || centreX >= width) continue;
    if (p.depth >= zbuf[centreX]) continue;

    const centreY = Math.round(horizon + (height * (0.5 - q.z)) / p.depth);
    const size = Math.max(1, Math.round((height * 0.014) / p.depth));
    const half = size >> 1;

    // Clamp each edge against the unclamped bounds. Deriving the far edge
    // from the already-clamped near edge would pin a particle that is far
    // off-screen to the border instead of dropping it.
    const left = centreX - half;
    const top = centreY - half;
    const x0 = Math.max(0, left);
    const y0 = Math.max(0, top);
    const x1 = Math.min(width, left + size);
    const y1 = Math.min(height, top + size);
    if (x0 >= x1 || y0 >= y1) continue;

    const color = shadeTable[lightLevel(p.depth, 0, lightBoost) * paletteSize + q.colorIndex];
    for (let y = y0; y < y1; y++) {
      const row = y * width;
      for (let x = x0; x < x1; x++) data[row + x] = color;
    }
  }
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Подключить в `main.js`**

Импорты:

```js
import { createParticles } from "./game/particles.js";
import { renderParticles } from "./render/particles.js";
```

Рядом с `enemyBitmap`:

```js
const particles = createParticles(192);
```

В `reset()`, после `state.reset()`:

```js
  particles.clear();
```

В `update`, после обновления врагов:

```js
  particles.update(dt, map);
```

В `draw`, сразу после `renderSprites` и до отрисовки оружия:

```js
  renderParticles(fb, camera, particles, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    horizon,
    lightBoost: state.lightBoost,
  });
```

- [ ] **Step 6: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны. Частицы пока никто не порождает — это делает следующая задача.

- [ ] **Step 7: Commit**

```bash
git add src/render/particles.js src/render/particles.test.js src/main.js
git commit -m "feat: draw world particles with depth testing"
```

---

### Task 6: Обратная связь по попаданию

Собирает всё вместе: кровь, искры, метка на прицеле, усиленная вспышка спрайта.

**Files:**
- Modify: `src/render/weaponview.js` (метка на прицеле)
- Modify: `src/render/weaponview.test.js`
- Modify: `src/game/state.js` (поле `hitMark`)
- Modify: `src/main.js` (`applyHits` порождает частицы и метку)

**Interfaces:**
- Consumes: `spawnBurst` из пула частиц; `ACCENT`, `RAMP` из `render/palette.js`.
- Produces: `renderCrosshair(fb, shadeTable, paletteSize, hitMark)` — четвёртый параметр необязателен и по умолчанию `0`.

- [ ] **Step 1: Написать падающий тест на метку прицела**

Добавить в `src/render/weaponview.test.js`, внутрь блока `describe("renderCrosshair", ...)`:

```js
  it("looks different once a hit lands", () => {
    const calm = blank();
    const struck = blank();
    renderCrosshair(calm, shadeTable, PALETTE_SIZE, 0);
    renderCrosshair(struck, shadeTable, PALETTE_SIZE, 1);
    expect([...calm.data]).not.toEqual([...struck.data]);
  });

  it("paints more of the screen when marking a hit", () => {
    const calm = blank();
    const struck = blank();
    renderCrosshair(calm, shadeTable, PALETTE_SIZE, 0);
    renderCrosshair(struck, shadeTable, PALETTE_SIZE, 1);
    const lit = (fb) => [...fb.data].filter((p) => p !== 0).length;
    expect(lit(struck)).toBeGreaterThan(lit(calm));
  });

  it("stays inside the buffer while marking a hit", () => {
    const fb = createFramebuffer(24, 16);
    fb.clear(0);
    expect(() => renderCrosshair(fb, shadeTable, PALETTE_SIZE, 1)).not.toThrow();
  });

  it("defaults to the calm crosshair when no mark is given", () => {
    const implicit = blank();
    const explicit = blank();
    renderCrosshair(implicit, shadeTable, PALETTE_SIZE);
    renderCrosshair(explicit, shadeTable, PALETTE_SIZE, 0);
    expect([...implicit.data]).toEqual([...explicit.data]);
  });
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test src/render/weaponview.test.js`
Expected: FAIL — прицел пока не принимает четвёртый параметр, поэтому обе картинки совпадают.

- [ ] **Step 3: Реализовать метку на прицеле**

В `src/render/weaponview.js` заменить `renderCrosshair` целиком:

```js
/**
 * The aim point. `hitMark` above zero draws four diagonal ticks around it —
 * the standard, wordless "that landed" signal, and the only feedback the
 * player sees without looking away from where they are aiming.
 */
export function renderCrosshair(fb, shadeTable, paletteSize, hitMark = 0) {
  const { width, height } = fb;
  const cx = width >> 1;
  const cy = height >> 1;
  const arm = Math.max(2, Math.round(height / 24));
  const gap = Math.max(1, Math.round(arm / 3));
  const color = shadeTable[FULL * paletteSize + ACCENT.goldLight];

  fb.fillRect(cx, cy - arm - gap, 1, arm, color);
  fb.fillRect(cx, cy + gap, 1, arm, color);
  fb.fillRect(cx - arm - gap, cy, arm, 1, color);
  fb.fillRect(cx + gap, cy, arm, 1, color);
  fb.fillRect(cx, cy, 1, 1, color);

  if (hitMark <= 0) return;

  // Four ticks stepping outwards diagonally, drawn a pixel at a time so the
  // mark reads as a burst rather than a box.
  const markColor = shadeTable[FULL * paletteSize + ACCENT.blood];
  const reach = Math.max(2, Math.round(arm * 0.9));
  const start = gap + 1;
  for (let i = start; i < start + reach; i++) {
    fb.fillRect(cx - i, cy - i, 1, 1, markColor);
    fb.fillRect(cx + i, cy - i, 1, 1, markColor);
    fb.fillRect(cx - i, cy + i, 1, 1, markColor);
    fb.fillRect(cx + i, cy + i, 1, 1, markColor);
  }
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Добавить `hitMark` в состояние**

В `src/game/state.js` добавить `hitMark: 0,` в объявление состояния рядом с `lightBoost`, и `state.hitMark = 0;` в `reset()`.

- [ ] **Step 6: Порождать частицы и метку по попаданию**

В `src/main.js` расширить импорт палитры до `ACCENT` и `RAMP`, затем заменить `applyHits`:

```js
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
    particles.spawnBurst(hit.x, hit.y, 0.55, hit.dirX, hit.dirY, 9, {
      colorIndex: ACCENT.blood,
      speed: 2.4,
      spread: 0.9,
      life: 0.55,
      lift: 1.4,
    });

    if (hit.killed) {
      state.kills += 1;
      // A death throws far more, and darker.
      particles.spawnBurst(hit.x, hit.y, 0.5, hit.dirX, hit.dirY, 18, {
        colorIndex: ACCENT.bloodDark,
        speed: 3.2,
        spread: 1.6,
        life: 0.8,
        lift: 2.0,
      });
    }
  }
}
```

- [ ] **Step 7: Гасить метку со временем**

В `update`, рядом с затуханием `lightBoost`:

```js
  state.hitMark = Math.max(0, state.hitMark - dt);
```

и в `draw` передать её прицелу:

```js
    renderCrosshair(fb, shadeTable, PALETTE_SIZE, state.hitMark);
```

- [ ] **Step 8: Выбрасывать гильзу при выстреле**

Спека называет гильзу в числе того, из чего складывается отдача. В отличие
от крови она порождается не в точке попадания, а у оружия, и вылетает
вправо от игрока — поэтому живёт в `attack`, а не в `applyHits`.

В `src/main.js` добавить рядом с `applyHits`:

```js
function ejectCasing() {
  const { x, y, a } = state.player;
  // Right-hand vector for this game's convention: forward is (cos, sin).
  const rightX = -Math.sin(a);
  const rightY = Math.cos(a);
  particles.spawnBurst(
    x + rightX * 0.22 + Math.cos(a) * 0.18,
    y + rightY * 0.22 + Math.sin(a) * 0.18,
    0.55,
    rightX,
    rightY,
    1,
    {
      colorIndex: ACCENT.gold,
      speed: 1.1,
      spread: 0.35,
      life: 0.7,
      lift: 1.1,
    },
  );
}
```

и вызывать её в `attack` только для стрелкового оружия, сразу после
`state.mag -= 1;`:

```js
  ejectCasing();
```

- [ ] **Step 9: Проверить в игре**

Run: `npm run dev`
Expected: попадание по врагу даёт брызги крови из точки попадания, они летят от игрока, падают на пол и исчезают; прицел на мгновение обрастает красными засечками; выстрел в стену даёт короткие серые искры; смерть врага даёт заметно больший тёмный выброс; при каждом выстреле из пистолета вправо вылетает жёлтая гильза и падает на пол.

- [ ] **Step 10: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 11: Commit**

```bash
git add src/render/weaponview.js src/render/weaponview.test.js \
  src/game/state.js src/main.js
git commit -m "feat: show damage landing with blood, sparks, a hit mark and a casing"
```

---

### Task 7: Отдача и тряска камеры

**Files:**
- Modify: `src/game/state.js` (поле `shake`)
- Modify: `src/main.js` (затухание, смещение горизонта)
- Create: `src/render/shake.js`
- Create: `src/render/shake.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `shakeOffset(shake, height)` → целое смещение горизонта в пикселях.

**Трясётся мир, а не прицел.** Горизонт смещается для пола, стен, спрайтов и частиц; прицел и оружие остаются на месте. Иначе тряска сбивала бы прицеливание, а в шутере это неприемлемо.

- [ ] **Step 1: Написать падающий тест**

`src/render/shake.test.js`:

```js
import { describe, expect, it } from "vitest";
import { shakeOffset } from "./shake.js";

describe("shakeOffset", () => {
  it("is zero at rest", () => {
    expect(shakeOffset(0, 300)).toBe(0);
  });

  it("is zero for a negative amount", () => {
    expect(shakeOffset(-1, 300)).toBe(0);
  });

  it("returns whole pixels", () => {
    for (let s = 0; s <= 1; s += 0.037) {
      expect(Number.isInteger(shakeOffset(s, 300))).toBe(true);
    }
  });

  it("stays small enough not to reveal the buffer edge", () => {
    for (let s = 0; s <= 1; s += 0.01) {
      expect(Math.abs(shakeOffset(s, 300))).toBeLessThanOrEqual(9);
    }
  });

  it("scales with the buffer height", () => {
    const small = Math.max(...sample(120));
    const large = Math.max(...sample(720));
    expect(large).toBeGreaterThan(small);
  });

  it("changes sign as it decays, so it reads as a shake", () => {
    const seen = new Set(sample(300).map(Math.sign));
    expect(seen.has(1)).toBe(true);
    expect(seen.has(-1)).toBe(true);
  });

  it("settles back to zero as the shake dies away", () => {
    expect(shakeOffset(0.001, 300)).toBe(0);
  });

  it("is deterministic", () => {
    expect(shakeOffset(0.4, 300)).toBe(shakeOffset(0.4, 300));
  });
});

function sample(height) {
  const out = [];
  for (let s = 1; s > 0; s -= 0.01) out.push(shakeOffset(s, height));
  return out;
}
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/shake.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/shake.js`**

```js
/** Peak displacement as a fraction of buffer height. */
const AMPLITUDE = 0.022;
/** How fast the shake oscillates as it decays. Higher is jitterier. */
const FREQUENCY = 47;

/**
 * Vertical displacement of the horizon for a shake of strength `shake`,
 * which callers decay towards zero over time.
 *
 * The oscillation is driven by the decaying strength itself rather than by a
 * separate clock, so a shake always ends exactly where it started and no
 * extra state has to be carried. Only the world is displaced — never the
 * crosshair — because a shooter whose shake moves the aim point is a shooter
 * nobody can aim.
 */
export function shakeOffset(shake, height) {
  if (!(shake > 0)) return 0;
  const amount = Math.min(1, shake);
  return Math.round(Math.sin(amount * FREQUENCY) * amount * height * AMPLITUDE);
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Добавить `shake` в состояние**

В `src/game/state.js` добавить `shake: 0,` рядом с `lightBoost`, и `state.shake = 0;` в `reset()`.

- [ ] **Step 6: Подключить в `main.js`**

Импорт:

```js
import { shakeOffset } from "./render/shake.js";
```

В `attack`, в обеих ветках, сразу после установки `state.cooldown`:

```js
  state.shake = weapon.shake;
```

В `update`, рядом с затуханием `lightBoost`:

```js
  state.shake = Math.max(0, state.shake - dt * 3.5);
```

В `draw` заменить вычисление горизонта:

```js
  const horizon = (fb.height >> 1) + shakeOffset(state.shake, fb.height);
```

Оружие и прицел это смещение не получают: они рисуются от краёв буфера, а не от горизонта, поэтому менять их вызовы не нужно.

- [ ] **Step 7: Проверить, что попадание по игроку тоже трясёт**

В `update`, где игрок получает укус, рядом с `state.hurt = 0.35;`:

```js
      state.shake = Math.max(state.shake, 0.5);
```

- [ ] **Step 8: Проверить в игре**

Run: `npm run dev`
Expected: выстрел из пистолета даёт короткий рывок картинки, удар палкой — слабее, укус врага — заметно сильнее; прицел при этом стоит неподвижно и стрелять по-прежнему точно; после затухания горизонт возвращается ровно на место, без сползания.

- [ ] **Step 9: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 10: Commit**

```bash
git add src/render/shake.js src/render/shake.test.js src/game/state.js src/main.js
git commit -m "feat: shake the world on impact without moving the aim point"
```

---

## Готовность фазы

Фаза 2A закончена, когда всё перечисленное верно:

- [ ] `npm test` зелёный, `npm run build` проходит.
- [ ] `grep -n "nearestFoe" src/main.js` не даёт совпадений: автонаведение удалено (D4).
- [ ] Выстрел мимо врага не наносит урона; чтобы попасть, нужно навести прицел.
- [ ] Выстрел не проходит сквозь стену, за которой стоит враг.
- [ ] Попадание видно тремя независимыми способами: брызги из точки попадания, вспышка спрайта, метка на прицеле.
- [ ] Враг отбрасывается от выстрела, но не проваливается в стену.
- [ ] Каждый выстрел из стрелкового оружия выбрасывает гильзу вправо.
- [ ] Тряска камеры не смещает прицел и после затухания возвращает горизонт на место.
- [ ] Оружие описано таблицей: добавление ствола того же вида не требует правок в коде стрельбы.
- [ ] Удар нельзя удвоить, нажав клавишу удара и клавишу атаки подряд: у обеих одни ворота.
- [ ] Цифровые клавиши: `1` — ближний бой, `2` — пистолет. Это сознательная смена раскладки против прежней (`1` — пистолет, `2` — палка): она соответствует жанровой норме и готовит место под стволы `3`–`6`.
- [ ] Клавиша `F` по-прежнему бьёт трубой независимо от того, что в руках.
- [ ] Частицы не аллоцируются в кадре — пул создан один раз.

Переходит в фазу 2B: остальные четыре ствола, типы боеприпасов, снарядное оружие с уроном по области, синтез звука на WebAudio, подбираемое на карте, слабая доводка прицела на телефоне.
