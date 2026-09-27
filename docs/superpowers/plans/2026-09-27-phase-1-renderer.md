# SULLEN DESCENT — Фаза 1: рендер и переименование

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить плоский рейкастер на текстурированный пиксельный рендер с процедурными ассетами, починить проекцию спрайтов, добавить pointer lock и разбить `main.js` на модули — не сломав играбельность.

**Architecture:** Рисуем не в экранный канвас, а в `Uint32Array` размером 480×H. Лучи бросаем через DDA в формулировке с камерной плоскостью, поэтому стены, пол и спрайты проецируются одной и той же матрицей. Свет — чтение из предпосчитанной таблицы «цвет × 32 уровня яркости». Готовый буфер растягивается на экран одним `drawImage` без сглаживания.

**Tech Stack:** Vanilla ES-модули, Canvas2D, Vite 6, Vitest (только для разработки).

Спека: `docs/superpowers/specs/2026-09-27-sullen-descent-design.md`

## Global Constraints

- **Ноль рантайм-зависимостей.** Vitest добавляется строго в `devDependencies`. Никаких игровых библиотек.
- **Ноль внешних файлов ассетов.** Все текстуры, спрайты и звуки генерируются кодом при старте.
- **Ни одного упоминания `Doom` или `RIP AND TEAR`** в коде, разметке, документации, именах пакетов и ключах `localStorage`.
- **Идентификаторы, комментарии и сообщения коммитов — на английском**, как в существующих коммитах репозитория.
- **Порядок байтов.** Пакуем цвет как `0xAABBGGRR` (little-endian). Это допущение действует для всех целевых платформ и должно быть отмечено комментарием в `render/palette.js`.
- **Целевое внутреннее разрешение** — ширина 480, высота выводится из соотношения сторон окна.
- **Vite `base: "./"`** в `vite.config.js` не менять: от него зависит деплой на GitHub Pages.
- **Ветка** — `sullen-descent`. `main` не трогаем: с него деплоится CI.
- Каждая задача заканчивается коммитом, и после неё должен проходить `npm run build`.
- `npm test` обязателен начиная с задачи 2 — раньше скрипта тестов в проекте просто нет. Задача 1 проверяется сборкой и поиском по тексту.

## File Structure

| Файл | Ответственность |
|---|---|
| `src/core/rng.js` | Детерминированный ГПСЧ и значение-шум для процедурных ассетов |
| `src/core/input.js` | Клавиатура, мышь с pointer lock, тач-стики |
| `src/core/loop.js` | Игровой цикл с фиксированным шагом |
| `src/render/palette.js` | Палитра, таблица уровней света, упаковка цвета |
| `src/render/framebuffer.js` | Пиксельный буфер и его вывод на канвас |
| `src/render/raycast.js` | DDA: один луч → дистанция, сторона, координата текстуры |
| `src/render/walls.js` | Отрисовка текстурированных колонн стен, заполнение z-буфера |
| `src/render/floors.js` | Построчная развёртка пола и потолка |
| `src/render/sprites.js` | Билборды по камерной матрице с проверкой z-буфера |
| `src/render/weaponview.js` | Оружие от первого лица в пиксельном буфере |
| `src/assets/textures.js` | Генерация текстур 64×64 и плейсхолдер-спрайта врага |
| `src/game/map.js` | Разбор текстовой карты, запросы к сетке |
| `src/game/state.js` | Состояние партии, вынесенное из глобальных переменных |
| `src/main.js` | Только сборка модулей и запуск |

Тесты лежат рядом с исходником: `src/core/rng.test.js` и так далее.

---

### Task 1: Переименование в SULLEN DESCENT

Закрывает юридический риск из раздела 2.2 спеки. Зависимостей нет, поэтому идёт первой.

**Files:**
- Modify: `index.html:10`, `index.html:22`, `index.html:24`, `index.html:26`
- Modify: `README.md:1-6`
- Modify: `package.json:2`
- Modify: `src/main.js:41`

- [ ] **Step 1: Заменить брендинг в `index.html`**

Строка 10:

```html
    <title>SULLEN DESCENT — Sullen Studio</title>
```

Строка 22:

```html
        <h1>SULLEN DESCENT</h1>
```

Строка 24:

```html
        <button type="button" id="btn-play">DESCEND</button>
```

Строка 26 (подсказка по управлению — добавляем упоминание мыши, pointer lock появится в задаче 12):

```html
        <p class="hint">WASD · mouse · click/space fire · Q swap · F stick · R reload</p>
```

- [ ] **Step 2: Переписать `README.md`**

```markdown
# SULLEN DESCENT — Sullen Studio

A cramped corridor shooter. First-person raycaster, procedural art,
no external assets.

**Play:** https://sullenstudio.github.io/sullen-descent/

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | move |
| mouse | look |
| click / space | fire |
| Phone | left stick + FIRE, drag the view to look |

Best kill count is stored in `localStorage`.

```bash
npm install
npm run dev
```
```

- [ ] **Step 3: Переименовать пакет**

В `package.json` строка 2:

```json
  "name": "sullen-descent",
```

- [ ] **Step 4: Переименовать ключ localStorage**

В `src/main.js` строка 41:

```js
const BEST_KEY = "sullen-descent-best";
```

- [ ] **Step 5: Пересобрать lock-файл**

Имя пакета продублировано в `package-lock.json` в двух местах.

Run: `npm install`
Expected: `package-lock.json` обновлён, поле `name` равно `sullen-descent`.

- [ ] **Step 6: Проверить, что упоминаний не осталось**

Run:

```bash
grep -rniE "doom|rip and tear" --include="*.js" --include="*.html" \
  --include="*.json" --include="*.md" --include="*.css" --include="*.yml" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=docs
```

Expected: пустой вывод. Каталог `docs/` исключён намеренно — спека описывает сам отказ от названия и обязана его упоминать.

- [ ] **Step 7: Проверить сборку**

Run: `npm run build`
Expected: сборка успешна.

- [ ] **Step 8: Commit**

```bash
git add index.html README.md package.json package-lock.json src/main.js
git commit -m "chore: rename the project to Sullen Descent"
```

> После слияния в `main` репозиторий на GitHub и URL на Pages нужно переименовать вручную — CI это не сделает.

---

### Task 2: Vitest и детерминированный ГПСЧ

**Files:**
- Create: `src/core/rng.js`
- Create: `src/core/rng.test.js`
- Modify: `package.json` (devDependencies, scripts)
- Modify: `vite.config.js`
- Modify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: ничего.
- Produces: `makeRng(seed) -> () => number` в `[0, 1)`; `makeValueNoise(rng, size) -> (x, y) => number` в `[0, 1]`; `fbm(noise, x, y, octaves) -> number` в `[0, 1]`.

- [ ] **Step 1: Установить Vitest**

Run: `npm install -D vitest@^3`
Expected: `vitest` появился в `devDependencies`.

- [ ] **Step 2: Добавить скрипты в `package.json`**

В блок `scripts`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Настроить окружение тестов**

`vite.config.js` целиком:

```js
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
```

Окружение `node`, а не `jsdom`: все тестируемые модули спроектированы так, чтобы не требовать DOM. Всё, что трогает канвас, изолировано в функциях, которые тесты не вызывают.

- [ ] **Step 4: Написать падающий тест**

`src/core/rng.test.js`:

```js
import { describe, expect, it } from "vitest";
import { fbm, makeRng, makeValueNoise } from "./rng.js";

describe("makeRng", () => {
  it("yields the same stream for the same seed", () => {
    const a = makeRng(1234);
    const b = makeRng(1234);
    const left = [a(), a(), a(), a()];
    const right = [b(), b(), b(), b()];
    expect(left).toEqual(right);
  });

  it("yields a different stream for a different seed", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toEqual(b());
  });

  it("stays inside [0, 1)", () => {
    const rng = makeRng(99);
    for (let i = 0; i < 2000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("makeValueNoise", () => {
  it("stays inside [0, 1]", () => {
    const noise = makeValueNoise(makeRng(7), 64);
    for (let i = 0; i < 500; i++) {
      const v = noise(i * 0.37, i * 0.11);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("tiles across the grid period", () => {
    const noise = makeValueNoise(makeRng(7), 64);
    expect(noise(3.5, 2.25)).toBeCloseTo(noise(67.5, 66.25), 10);
  });

  it("is continuous between neighbouring samples", () => {
    const noise = makeValueNoise(makeRng(7), 64);
    const a = noise(10.5, 10.5);
    const b = noise(10.51, 10.5);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });
});

describe("fbm", () => {
  it("stays inside [0, 1]", () => {
    const noise = makeValueNoise(makeRng(3), 64);
    for (let i = 0; i < 200; i++) {
      const v = fbm(noise, i * 0.3, i * 0.7, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 5: Убедиться, что тест падает**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./rng.js"`.

- [ ] **Step 6: Реализовать `src/core/rng.js`**

```js
// Deterministic pseudo-randomness for procedural assets. Every generated
// texture and sprite must be reproducible from a seed, so nothing here may
// call Math.random.

/** mulberry32: small, fast, good enough for art generation. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * Value noise on a `size` x `size` lattice. Wrapping the lattice makes the
 * result tileable with period `size`, which is what lets a 64x64 texture
 * repeat across a wall without a visible seam.
 */
export function makeValueNoise(rng, size = 64) {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();

  const at = (cx, cy) => {
    const x = ((cx % size) + size) % size;
    const y = ((cy % size) + size) % size;
    return grid[y * size + x];
  };

  return function noise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smoothstep(x - x0);
    const fy = smoothstep(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  };
}

/** Stacked octaves. Gives texture detail at more than one scale. */
export function fbm(noise, x, y, octaves = 4) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}
```

- [ ] **Step 7: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS, 7 тестов.

- [ ] **Step 8: Добавить тесты в CI**

В `.github/workflows/pages.yml`, в задании `build`, между `npm ci` и `npm run build`:

```yaml
      - run: npm test
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.js \
  src/core/rng.js src/core/rng.test.js .github/workflows/pages.yml
git commit -m "test: add vitest and a seeded rng with value noise"
```

---

### Task 3: Палитра и таблица уровней света

**Files:**
- Create: `src/render/palette.js`
- Create: `src/render/palette.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `rgb(r, g, b) -> number` (упакованный `0xAABBGGRR`); `PALETTE: Uint32Array`; `PALETTE_SIZE: number`; `SHADE_LEVELS = 32`; `RAMP` (индексы начала шести шкал затенения); `ACCENT` (именованные сигнальные цвета); `RAMP_SIZE = 6`; `TRANSPARENT = 255`; `buildShadeTable(palette, levels) -> Uint32Array` длиной `palette.length * levels`, где цвет лежит по индексу `level * palette.length + colorIndex`; `lightLevel(dist, side, boost) -> number` целое в `[0, SHADE_LEVELS - 1]`.

`RAMP` и `ACCENT` разделены намеренно. `RAMP` — шкалы, упорядоченные от тёмного к светлому, по которым текстуры выбирают оттенок. `ACCENT` — отдельные сигнальные цвета (кровь, латунь, плазма), между которыми нет отношения «темнее-светлее»; смешивать их в одну шкалу значило бы врать о её смысле.

- [ ] **Step 1: Написать падающий тест**

`src/render/palette.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  ACCENT,
  PALETTE,
  PALETTE_SIZE,
  RAMP,
  RAMP_SIZE,
  SHADE_LEVELS,
  buildShadeTable,
  lightLevel,
  rgb,
} from "./palette.js";

describe("rgb", () => {
  it("packs as 0xAABBGGRR with opaque alpha", () => {
    expect(rgb(255, 0, 0)).toBe(0xff0000ff >>> 0);
    expect(rgb(0, 255, 0)).toBe(0xff00ff00 >>> 0);
    expect(rgb(0, 0, 255)).toBe(0xffff0000 >>> 0);
  });
});

describe("PALETTE", () => {
  it("holds every ramp at full size", () => {
    expect(PALETTE_SIZE).toBe(PALETTE.length);
    for (const start of Object.values(RAMP)) {
      expect(start + RAMP_SIZE).toBeLessThanOrEqual(PALETTE_SIZE);
    }
  });

  it("leaves 255 free as the transparent sentinel", () => {
    expect(PALETTE_SIZE).toBeLessThan(255);
  });

  it("orders every shading ramp from dark to light", () => {
    // Texture generators pick a step inside a ramp to mean "lighter" or
    // "darker". If a ramp is not monotonic that meaning silently breaks.
    const luma = (c) => {
      const r = c & 255;
      const g = (c >> 8) & 255;
      const b = (c >> 16) & 255;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    for (const start of Object.values(RAMP)) {
      for (let i = 1; i < RAMP_SIZE; i++) {
        expect(luma(PALETTE[start + i])).toBeGreaterThan(
          luma(PALETTE[start + i - 1]),
        );
      }
    }
  });

  it("keeps every accent inside the palette and outside the ramps", () => {
    const rampEnd = Math.max(...Object.values(RAMP)) + RAMP_SIZE;
    for (const index of Object.values(ACCENT)) {
      expect(index).toBeGreaterThanOrEqual(rampEnd);
      expect(index).toBeLessThan(PALETTE_SIZE);
    }
  });
});

describe("buildShadeTable", () => {
  const table = buildShadeTable(PALETTE, SHADE_LEVELS);

  it("has one entry per colour per level", () => {
    expect(table.length).toBe(PALETTE_SIZE * SHADE_LEVELS);
  });

  it("returns the untouched colour at the brightest level", () => {
    const top = (SHADE_LEVELS - 1) * PALETTE_SIZE;
    for (let i = 0; i < PALETTE_SIZE; i++) {
      expect(table[top + i]).toBe(PALETTE[i]);
    }
  });

  it("returns black at the darkest level", () => {
    for (let i = 0; i < PALETTE_SIZE; i++) {
      expect(table[i]).toBe(rgb(0, 0, 0));
    }
  });

  it("never gets darker as the level rises", () => {
    const index = RAMP.brick + 3;
    let previous = -1;
    for (let l = 0; l < SHADE_LEVELS; l++) {
      const value = table[l * PALETTE_SIZE + index] & 255;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("lightLevel", () => {
  it("is brightest right in front of the camera", () => {
    expect(lightLevel(0, 0, 0)).toBe(SHADE_LEVELS - 1);
  });

  it("falls off with distance", () => {
    expect(lightLevel(8, 0, 0)).toBeLessThan(lightLevel(2, 0, 0));
  });

  it("darkens side walls so corners stay readable", () => {
    expect(lightLevel(4, 1, 0)).toBeLessThan(lightLevel(4, 0, 0));
  });

  it("brightens under a muzzle flash", () => {
    expect(lightLevel(6, 0, 0.5)).toBeGreaterThan(lightLevel(6, 0, 0));
  });

  it("stays in range for absurd inputs", () => {
    expect(lightLevel(1e6, 1, 0)).toBe(0);
    expect(lightLevel(0, 0, 10)).toBe(SHADE_LEVELS - 1);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/palette.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/palette.js`**

```js
// The renderer writes packed 32-bit pixels straight into the buffer that
// backs an ImageData. Byte order there is R,G,B,A, so on a little-endian
// machine the correct packing is 0xAABBGGRR. Every platform this ships to
// is little-endian; if that ever stops being true, this is the one place
// that has to change.

export const SHADE_LEVELS = 32;
export const RAMP_SIZE = 6;

/** Palette index reserved to mean "draw nothing here". */
export const TRANSPARENT = 255;

export function rgb(r, g, b) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Six-step ramps, dark to light. Textures pick a ramp and a step; the
// shade table then supplies the lighting.
const BASE = [
  // concrete
  [58, 56, 54], [74, 71, 68], [92, 88, 84],
  [110, 105, 99], [128, 122, 115], [146, 140, 132],
  // brick
  [58, 26, 20], [78, 34, 26], [98, 44, 32],
  [120, 56, 40], [142, 70, 50], [164, 88, 64],
  // rust
  [64, 34, 14], [88, 48, 18], [112, 64, 24],
  [136, 84, 32], [158, 104, 44], [180, 128, 60],
  // flesh
  [72, 26, 30], [98, 38, 42], [124, 52, 56],
  [150, 70, 72], [176, 94, 94], [200, 124, 120],
  // tech
  [22, 38, 42], [30, 54, 60], [40, 72, 80],
  [52, 92, 100], [66, 114, 122], [84, 138, 146],
  // bone
  [86, 80, 66], [112, 105, 88], [138, 130, 110],
  [164, 156, 134], [192, 184, 160], [220, 212, 190],
  // signal colours, not a ramp: see ACCENT below
  [120, 10, 8], [168, 20, 14], [214, 168, 40],
  [250, 214, 90], [96, 190, 224], [180, 240, 255],
];

/** Start index of each six-step shading ramp, ordered dark to light. */
export const RAMP = {
  concrete: 0,
  brick: 6,
  rust: 12,
  flesh: 18,
  tech: 24,
  bone: 30,
};

/**
 * Signal colours. These are deliberately not a ramp: plasma is not "a
 * lighter gold", and pretending otherwise would let a texture generator ask
 * for a brighter step and get a different hue instead.
 */
export const ACCENT = {
  bloodDark: 36,
  blood: 37,
  gold: 38,
  goldLight: 39,
  plasma: 40,
  plasmaLight: 41,
};

export const PALETTE = new Uint32Array(BASE.map(([r, g, b]) => rgb(r, g, b)));
export const PALETTE_SIZE = PALETTE.length;

/**
 * Precomputes every colour at every light level once, so shading a pixel at
 * runtime is an array read instead of three multiplications.
 */
export function buildShadeTable(palette, levels = SHADE_LEVELS) {
  const table = new Uint32Array(palette.length * levels);
  for (let level = 0; level < levels; level++) {
    const factor = level / (levels - 1);
    const row = level * palette.length;
    for (let i = 0; i < palette.length; i++) {
      const c = palette[i];
      table[row + i] = rgb(
        Math.round((c & 255) * factor),
        Math.round(((c >> 8) & 255) * factor),
        Math.round(((c >> 16) & 255) * factor),
      );
    }
  }
  return table;
}

const FALLOFF = 0.16;
const SIDE_DIM = 0.78;

/**
 * Light level for a surface `dist` away. `side` of 1 marks a wall face
 * perpendicular to the other axis and gets dimmed, which is what makes
 * corners legible. `boost` is additive light from muzzle flashes.
 */
export function lightFalloff(dist, side = 0, boost = 0) {
  const base = 1 / (1 + Math.max(0, dist) * FALLOFF);
  return base * (side ? SIDE_DIM : 1) + boost;
}

export function lightLevel(dist, side = 0, boost = 0) {
  const t = lightFalloff(dist, side, boost);
  const level = Math.round(t * (SHADE_LEVELS - 1));
  if (level < 0) return 0;
  if (level > SHADE_LEVELS - 1) return SHADE_LEVELS - 1;
  return level;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/palette.js src/render/palette.test.js
git commit -m "feat: add the palette and its precomputed light table"
```

---

### Task 4: Пиксельный буфер

**Files:**
- Create: `src/render/framebuffer.js`
- Create: `src/render/framebuffer.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `createFramebuffer(width, height, buffer?) -> { width, height, data: Uint32Array, clear(color), fillRect(x, y, w, h, color), verticalLine(x, y0, y1, color) }`; `createPresenter(width, height) -> { fb, present(targetCtx, dstWidth, dstHeight) }`.

`createPresenter` — единственная функция модуля, которой нужен DOM. Тесты её не вызывают, поэтому окружение `node` подходит.

- [ ] **Step 1: Написать падающий тест**

`src/render/framebuffer.test.js`:

```js
import { describe, expect, it } from "vitest";
import { createFramebuffer } from "./framebuffer.js";
import { rgb } from "./palette.js";

const RED = rgb(255, 0, 0);
const BLUE = rgb(0, 0, 255);

describe("createFramebuffer", () => {
  it("allocates one 32-bit pixel per cell", () => {
    const fb = createFramebuffer(8, 4);
    expect(fb.data.length).toBe(32);
    expect(fb.width).toBe(8);
    expect(fb.height).toBe(4);
  });

  it("can wrap a caller-supplied buffer", () => {
    const buffer = new ArrayBuffer(8 * 4 * 4);
    const fb = createFramebuffer(8, 4, buffer);
    fb.clear(RED);
    expect(new Uint32Array(buffer)[0]).toBe(RED);
  });

  it("clears every pixel", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(RED);
    expect([...fb.data].every((p) => p === RED)).toBe(true);
  });
});

describe("fillRect", () => {
  it("fills exactly the requested box", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.fillRect(1, 1, 2, 2, RED);
    expect(fb.data[0]).toBe(0);
    expect(fb.data[5]).toBe(RED);
    expect(fb.data[6]).toBe(RED);
    expect(fb.data[9]).toBe(RED);
    expect(fb.data[10]).toBe(RED);
    expect(fb.data[15]).toBe(0);
  });

  it("clips against every edge instead of wrapping", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.fillRect(-2, -2, 3, 3, RED);
    expect(fb.data[0]).toBe(RED);
    expect(fb.data[1]).toBe(0);
    expect(fb.data[4]).toBe(0);
  });

  it("ignores a box that is fully outside", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(BLUE);
    fb.fillRect(10, 10, 4, 4, RED);
    fb.fillRect(-10, 0, 4, 4, RED);
    expect([...fb.data].every((p) => p === BLUE)).toBe(true);
  });

  it("ignores a box with no area", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(BLUE);
    fb.fillRect(1, 1, 0, 5, RED);
    fb.fillRect(1, 1, 5, -3, RED);
    expect([...fb.data].every((p) => p === BLUE)).toBe(true);
  });
});

describe("verticalLine", () => {
  it("fills from y0 up to but not including y1", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.verticalLine(2, 1, 3, RED);
    expect(fb.data[2]).toBe(0);
    expect(fb.data[6]).toBe(RED);
    expect(fb.data[10]).toBe(RED);
    expect(fb.data[14]).toBe(0);
  });

  it("clips vertically and rejects out-of-range columns", () => {
    const fb = createFramebuffer(4, 4);
    fb.clear(0);
    fb.verticalLine(0, -5, 99, RED);
    fb.verticalLine(9, 0, 4, BLUE);
    expect(fb.data[0]).toBe(RED);
    expect(fb.data[12]).toBe(RED);
    expect([...fb.data].includes(BLUE)).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/framebuffer.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/framebuffer.js`**

```js
/**
 * A plain 32-bit pixel buffer. Everything the renderer draws lands here
 * first; the buffer is scaled onto the visible canvas once per frame. That
 * indirection is what gives us cheap texturing, per-pixel light and honest
 * chunky pixels.
 *
 * Pass `buffer` to wrap memory that already exists — the presenter uses
 * that to draw straight into an ImageData with no copy.
 */
export function createFramebuffer(width, height, buffer) {
  const data = buffer
    ? new Uint32Array(buffer)
    : new Uint32Array(width * height);

  return {
    width,
    height,
    data,

    clear(color) {
      data.fill(color >>> 0);
    },

    fillRect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      const x0 = Math.max(0, x | 0);
      const y0 = Math.max(0, y | 0);
      const x1 = Math.min(width, (x | 0) + (w | 0));
      const y1 = Math.min(height, (y | 0) + (h | 0));
      if (x0 >= x1 || y0 >= y1) return;
      const value = color >>> 0;
      for (let row = y0; row < y1; row++) {
        data.fill(value, row * width + x0, row * width + x1);
      }
    },

    verticalLine(x, y0, y1, color) {
      const column = x | 0;
      if (column < 0 || column >= width) return;
      const start = Math.max(0, y0 | 0);
      const end = Math.min(height, y1 | 0);
      const value = color >>> 0;
      for (let y = start; y < end; y++) {
        data[y * width + column] = value;
      }
    },
  };
}

/**
 * Owns the offscreen canvas the buffer is blitted through. Separated from
 * createFramebuffer so the drawing code above stays testable without a DOM.
 */
export function createPresenter(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  const fb = createFramebuffer(width, height, imageData.data.buffer);

  return {
    fb,
    width,
    height,
    present(targetCtx, dstWidth, dstHeight) {
      ctx.putImageData(imageData, 0, 0);
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(canvas, 0, 0, dstWidth, dstHeight);
    },
  };
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/framebuffer.js src/render/framebuffer.test.js
git commit -m "feat: add the pixel framebuffer and its canvas presenter"
```

---

### Task 5: Модуль карты

**Files:**
- Create: `src/game/map.js`
- Create: `src/game/map.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `parseMap(lines) -> { map, playerStart: {x, y, angle}, enemySpawns: [{x, y}] }`; у `map` есть `cols`, `rows`, `at(cx, cy)`, `isSolid(cx, cy)`, `isSolidAt(x, y)`, `textureAt(cx, cy)`.

Легенда фазы 1: `#` — стена с текстурой 0; `1`–`5` — стена с текстурами 0–4; `.` — пол; `P` — старт игрока; `E` — спавн врага. Двери и ключи появятся в фазе 4.

- [ ] **Step 1: Написать падающий тест**

`src/game/map.test.js`:

```js
import { describe, expect, it } from "vitest";
import { parseMap } from "./map.js";

const LINES = [
  "#####",
  "#.P.#",
  "#.E24",
  "#...#",
  "#####",
];

describe("parseMap", () => {
  it("reads the grid size", () => {
    const { map } = parseMap(LINES);
    expect(map.cols).toBe(5);
    expect(map.rows).toBe(5);
  });

  it("rejects a ragged grid", () => {
    expect(() => parseMap(["###", "##"])).toThrow(/rectangular/i);
  });

  it("rejects an empty grid", () => {
    expect(() => parseMap([])).toThrow(/empty/i);
  });

  it("treats walls and digits as solid, floor markers as open", () => {
    const { map } = parseMap(LINES);
    expect(map.isSolid(0, 0)).toBe(true);
    expect(map.isSolid(4, 2)).toBe(true);
    expect(map.isSolid(3, 2)).toBe(true);
    expect(map.isSolid(1, 1)).toBe(false);
    expect(map.isSolid(2, 1)).toBe(false);
    expect(map.isSolid(2, 2)).toBe(false);
  });

  it("treats everything outside the grid as solid", () => {
    const { map } = parseMap(LINES);
    expect(map.isSolid(-1, 0)).toBe(true);
    expect(map.isSolid(0, -1)).toBe(true);
    expect(map.isSolid(5, 0)).toBe(true);
    expect(map.isSolid(0, 5)).toBe(true);
  });

  it("accepts float coordinates through isSolidAt", () => {
    const { map } = parseMap(LINES);
    expect(map.isSolidAt(1.9, 1.1)).toBe(false);
    expect(map.isSolidAt(0.5, 0.5)).toBe(true);
    expect(map.isSolidAt(-0.1, 1.5)).toBe(true);
  });

  it("maps wall digits onto texture slots", () => {
    const { map } = parseMap(LINES);
    expect(map.textureAt(0, 0)).toBe(0);
    expect(map.textureAt(3, 2)).toBe(1);
    expect(map.textureAt(4, 2)).toBe(3);
  });

  it("puts the player in the middle of their cell", () => {
    const { playerStart } = parseMap(LINES);
    expect(playerStart.x).toBe(2.5);
    expect(playerStart.y).toBe(1.5);
    expect(playerStart.angle).toBe(0);
  });

  it("falls back to the first open cell when there is no P", () => {
    const { playerStart } = parseMap(["###", "#.#", "###"]);
    expect(playerStart.x).toBe(1.5);
    expect(playerStart.y).toBe(1.5);
  });

  it("collects enemy spawns at cell centres", () => {
    const { enemySpawns } = parseMap(LINES);
    expect(enemySpawns).toEqual([{ x: 2.5, y: 2.5 }]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/game/map.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/game/map.js`**

```js
// A level is authored as an array of equal-length strings so it can be read
// and edited by eye. Digits 1-5 pick a wall texture; '#' is shorthand for
// the first one.

const WALL_DIGITS = "12345";
const PLAYER_MARK = "P";
const ENEMY_MARK = "E";

function isWallChar(ch) {
  return ch === "#" || WALL_DIGITS.includes(ch);
}

export function parseMap(lines) {
  if (!lines || lines.length === 0) throw new Error("map is empty");
  const rows = lines.length;
  const cols = lines[0].length;
  if (cols === 0) throw new Error("map is empty");
  for (const line of lines) {
    if (line.length !== cols) {
      throw new Error("map must be rectangular: every row needs equal length");
    }
  }

  const at = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return "#";
    return lines[cy][cx];
  };

  const map = {
    cols,
    rows,
    at,
    isSolid(cx, cy) {
      return isWallChar(at(cx, cy));
    },
    isSolidAt(x, y) {
      return isWallChar(at(Math.floor(x), Math.floor(y)));
    },
    textureAt(cx, cy) {
      const ch = at(cx, cy);
      const slot = WALL_DIGITS.indexOf(ch);
      return slot < 0 ? 0 : slot;
    },
  };

  let playerStart = null;
  let fallback = null;
  const enemySpawns = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = lines[y][x];
      if (isWallChar(ch)) continue;
      if (!fallback) fallback = { x: x + 0.5, y: y + 0.5, angle: 0 };
      if (ch === PLAYER_MARK) playerStart = { x: x + 0.5, y: y + 0.5, angle: 0 };
      if (ch === ENEMY_MARK) enemySpawns.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  if (!playerStart) playerStart = fallback;
  if (!playerStart) throw new Error("map has no open cell to start in");

  return { map, playerStart, enemySpawns };
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/map.js src/game/map.test.js
git commit -m "feat: parse levels through a dedicated map module"
```

---

### Task 6: DDA-рейкаст

Закрывает дефект D1 и создаёт камерную матрицу, на которой в задаче 10 чинится D2.

**Files:**
- Create: `src/render/raycast.js`
- Create: `src/render/raycast.test.js`

**Interfaces:**
- Consumes: `map` из `parseMap`.
- Produces: `makeCamera(x, y, angle, fov) -> { x, y, angle, dirX, dirY, planeX, planeY }`; `castColumn(map, camera, cameraX, maxDist) -> { hit, dist, side, texU, mapX, mapY, rayDirX, rayDirY }`.

`cameraX` идёт от `-1` (левый край экрана) до `+1` (правый). `dist` — перпендикулярная дистанция: именно она, а не евклидова, убирает рыбий глаз.

- [ ] **Step 1: Написать падающий тест**

`src/render/raycast.test.js`:

```js
import { describe, expect, it } from "vitest";
import { parseMap } from "../game/map.js";
import { castColumn, makeCamera } from "./raycast.js";

const FOV = Math.PI / 3;
// A 5x5 box with a single pillar at (3, 1).
const { map } = parseMap([
  "#####",
  "#..3#",
  "#...#",
  "#...#",
  "#####",
]);

describe("makeCamera", () => {
  it("points the direction vector along the angle", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    expect(cam.dirX).toBeCloseTo(1, 10);
    expect(cam.dirY).toBeCloseTo(0, 10);
  });

  it("puts the plane to the camera's right, scaled by half the fov", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    expect(cam.planeX).toBeCloseTo(0, 10);
    expect(cam.planeY).toBeCloseTo(Math.tan(FOV / 2), 10);
  });

  it("keeps the plane perpendicular to the direction at any angle", () => {
    const cam = makeCamera(1, 1, 0.9, FOV);
    expect(cam.dirX * cam.planeX + cam.dirY * cam.planeY).toBeCloseTo(0, 10);
  });
});

describe("castColumn", () => {
  it("measures a straight shot down +x", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
    expect(hit.dist).toBeCloseTo(1.5, 10);
    expect(hit.side).toBe(0);
    expect(hit.mapX).toBe(4);
    expect(hit.mapY).toBe(2);
  });

  it("measures a straight shot down +y and reports the other side", () => {
    const cam = makeCamera(2.5, 2.5, Math.PI / 2, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
    expect(hit.dist).toBeCloseTo(1.5, 10);
    expect(hit.side).toBe(1);
    expect(hit.mapY).toBe(4);
  });

  it("measures a straight shot down -x", () => {
    const cam = makeCamera(2.5, 2.5, Math.PI, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.dist).toBeCloseTo(1.5, 10);
    expect(hit.mapX).toBe(0);
  });

  it("reports perpendicular distance, not euclidean", () => {
    // An off-centre column is farther away in a straight line, but the
    // perpendicular distance to a flat wall ahead must stay 1.5.
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const hit = castColumn(map, cam, 0.5, 32);
    expect(hit.dist).toBeCloseTo(1.5, 10);
  });

  it("finds the nearest surface, stopping at the pillar", () => {
    const cam = makeCamera(3.5, 3.5, -Math.PI / 2, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.mapY).toBe(1);
    expect(hit.dist).toBeCloseTo(1.5, 10);
  });

  it("returns a texture coordinate inside [0, 1)", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    for (let i = -10; i <= 10; i++) {
      const hit = castColumn(map, cam, i / 10, 32);
      expect(hit.texU).toBeGreaterThanOrEqual(0);
      expect(hit.texU).toBeLessThan(1);
    }
  });

  it("walks the texture coordinate monotonically across a flat wall", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const left = castColumn(map, cam, -0.4, 32);
    const right = castColumn(map, cam, 0.4, 32);
    expect(left.mapX).toBe(4);
    expect(right.mapX).toBe(4);
    expect(right.texU).toBeGreaterThan(left.texU);
  });

  it("reports a miss when the wall is beyond maxDist", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const hit = castColumn(map, cam, 0, 0.5);
    expect(hit.hit).toBe(false);
  });

  it("does not loop forever when the camera stands inside a wall", () => {
    const cam = makeCamera(0.5, 0.5, 0.3, FOV);
    const hit = castColumn(map, cam, 0, 32);
    expect(hit.hit).toBe(true);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/raycast.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/raycast.js`**

```js
/**
 * Digital differential analyser. Steps from grid line to grid line instead
 * of crawling along the ray in tiny increments, so a cast costs about twenty
 * iterations and — crucially — lands on an exact surface point, which is
 * what makes texturing possible at all.
 *
 * The camera carries a direction vector and a plane vector to its right.
 * A screen column maps to `cameraX` in [-1, 1] and the ray is
 * `dir + plane * cameraX`. Walls, floors and sprites all share this frame,
 * which is what keeps them aligned with each other.
 */
/**
 * Smallest distance the cast will report. Callers divide a wall height by
 * this value, so it must never reach zero.
 */
const MIN_DIST = 0.01;

export function makeCamera(x, y, angle, fov) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const half = Math.tan(fov / 2);
  // Right-hand vector for this game's convention: forward is (cos, sin) and
  // strafe-right is (-sin, cos).
  return {
    x,
    y,
    angle,
    dirX,
    dirY,
    planeX: -dirY * half,
    planeY: dirX * half,
  };
}

export function castColumn(map, camera, cameraX, maxDist = 32) {
  const rayDirX = camera.dirX + camera.planeX * cameraX;
  const rayDirY = camera.dirY + camera.planeY * cameraX;

  let mapX = Math.floor(camera.x);
  let mapY = Math.floor(camera.y);

  const deltaX = Math.abs(rayDirX) < 1e-9 ? Infinity : Math.abs(1 / rayDirX);
  const deltaY = Math.abs(rayDirY) < 1e-9 ? Infinity : Math.abs(1 / rayDirY);

  let stepX;
  let stepY;
  let sideDistX;
  let sideDistY;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (camera.x - mapX) * deltaX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - camera.x) * deltaX;
  }
  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (camera.y - mapY) * deltaY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - camera.y) * deltaY;
  }

  // Standing inside a wall would otherwise let the ray escape the level.
  if (map.isSolid(mapX, mapY)) {
    return {
      hit: true, dist: MIN_DIST, side: 0, texU: 0, mapX, mapY, rayDirX, rayDirY,
    };
  }

  // maxDist is tested before each step, so the final crossing may land
  // slightly beyond it: the returned dist is not hard-bounded by maxDist.
  // Anything sizing a table by maxDist must clamp its own index.
  let side = 0;
  let travelled = 0;
  let hit = false;
  while (travelled < maxDist) {
    if (sideDistX < sideDistY) {
      travelled = sideDistX;
      sideDistX += deltaX;
      mapX += stepX;
      side = 0;
    } else {
      travelled = sideDistY;
      sideDistY += deltaY;
      mapY += stepY;
      side = 1;
    }
    if (map.isSolid(mapX, mapY)) {
      hit = true;
      break;
    }
  }

  if (!hit) {
    return {
      hit: false, dist: maxDist, side, texU: 0, mapX, mapY, rayDirX, rayDirY,
    };
  }

  // Perpendicular distance to the face just crossed. The (1 - step) / 2 term
  // selects which edge of the cell the ray entered through.
  //
  // This can come out as exactly 0 when the camera sits on an integer
  // coordinate flush against a solid cell, and grazing hits land within a
  // rounding error of 0. The inside-a-wall guard above already avoids
  // returning 0; apply the same floor here so no caller can divide by it.
  const raw = side === 0
    ? (mapX - camera.x + (1 - stepX) / 2) / rayDirX
    : (mapY - camera.y + (1 - stepY) / 2) / rayDirY;
  const dist = raw < MIN_DIST ? MIN_DIST : raw;

  let texU = side === 0
    ? camera.y + dist * rayDirY
    : camera.x + dist * rayDirX;
  texU -= Math.floor(texU);
  // Mirror two of the four facings so texture U always grows left to right
  // as seen by the player, instead of flipping when you walk around a wall.
  //
  // Which two depends on the handedness of the camera plane. This game's
  // plane is (-dirY, dirX); published raycaster references commonly use the
  // opposite sign, (dirY, -dirX), and their mirroring condition is therefore
  // the inverse of this one. Copying theirs verbatim reverses every texture.
  if ((side === 0 && rayDirX < 0) || (side === 1 && rayDirY > 0)) {
    texU = 1 - texU;
  }
  if (texU >= 1) texU = 0.999999;

  return { hit: true, dist, side, texU, mapX, mapY, rayDirX, rayDirY };
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/raycast.js src/render/raycast.test.js
git commit -m "feat: replace the stepped ray with a DDA cast"
```

---

### Task 7: Процедурные текстуры

**Files:**
- Create: `src/assets/textures.js`
- Create: `src/assets/textures.test.js`

**Interfaces:**
- Consumes: `makeRng`, `makeValueNoise`, `fbm` из `core/rng.js`; `ACCENT`, `RAMP`, `RAMP_SIZE`, `TRANSPARENT` из `render/palette.js`.
- Produces: `TEX_SIZE = 64`; `NOISE_LATTICE = 8`; `generateTextures(seed) -> Texture[]` длиной 7, где `Texture` это `{ size, pixels: Uint8Array }` из индексов палитры; `TEXTURE_SLOT` — объект с именами слотов; `makeEnemySprite(seed) -> { width, height, pixels }` с `TRANSPARENT` в пустых пикселях.

Порядок слотов фиксирован: `0` кирпич, `1` ржавый металл, `2` бетон, `3` плоть, `4` техпанель, `5` пол, `6` потолок. Цифры `1`–`5` в карте выбирают слоты `0`–`4`; пол и потолок доступны только по имени.

**Как обеспечивается бесшовность.** Решётка шума замыкается с периодом `NOISE_LATTICE`. Значит, выборка обязана идти с частотой `NOISE_LATTICE / TEX_SIZE`: тогда 64 текселя покрывают ровно один период решётки и правый край тайла стыкуется с левым. Октавы `fbm` удваивают частоту, то есть покрывают 2, 4 и 8 периодов — тоже целое число, поэтому бесшовность сохраняется на каждой октаве. Любая другая частота выборки даст видимый шов, и это единственное, что здесь легко сломать.

Структурные детали (кладка, панели, швы плитки) обязаны иметь период, нацело делящий `TEX_SIZE`. Постоянное смещение выборки шума на бесшовность не влияет — окно просто сдвигается, оставаясь целым числом периодов.

- [ ] **Step 1: Написать падающий тест**

`src/assets/textures.test.js`:

```js
import { describe, expect, it } from "vitest";
import { PALETTE_SIZE, TRANSPARENT } from "../render/palette.js";
import {
  NOISE_LATTICE,
  TEXTURE_SLOT,
  TEX_SIZE,
  generateTextures,
  makeEnemySprite,
} from "./textures.js";

describe("generateTextures", () => {
  const textures = generateTextures(1337);

  it("produces one texture per named slot", () => {
    expect(textures.length).toBe(Object.keys(TEXTURE_SLOT).length);
  });

  it("produces square tiles of TEX_SIZE", () => {
    for (const tex of textures) {
      expect(tex.size).toBe(TEX_SIZE);
      expect(tex.pixels.length).toBe(TEX_SIZE * TEX_SIZE);
    }
  });

  it("only emits indices that exist in the palette", () => {
    for (const tex of textures) {
      for (const index of tex.pixels) {
        expect(index).toBeLessThan(PALETTE_SIZE);
      }
    }
  });

  it("is reproducible from a seed", () => {
    const again = generateTextures(1337);
    for (let i = 0; i < textures.length; i++) {
      expect([...again[i].pixels]).toEqual([...textures[i].pixels]);
    }
  });

  it("gives different seeds different output", () => {
    const other = generateTextures(4242);
    const a = textures[TEXTURE_SLOT.concrete].pixels;
    const b = other[TEXTURE_SLOT.concrete].pixels;
    expect([...a]).not.toEqual([...b]);
  });

  it("uses more than one shade per tile, so nothing renders flat", () => {
    for (const tex of textures) {
      expect(new Set(tex.pixels).size).toBeGreaterThan(2);
    }
  });

  it("keeps the noise lattice a whole divisor of the tile", () => {
    // This is the invariant that makes tiles seamless: sampling at
    // NOISE_LATTICE / TEX_SIZE covers exactly one wrapping period across the
    // tile. Comparing edge pixels directly would be wrong — a brick course
    // legitimately puts mortar at the seam — so guard the rule instead.
    expect(TEX_SIZE % NOISE_LATTICE).toBe(0);
  });
});

describe("makeEnemySprite", () => {
  const sprite = makeEnemySprite(7);

  it("is taller than it is wide", () => {
    expect(sprite.height).toBeGreaterThan(sprite.width);
    expect(sprite.pixels.length).toBe(sprite.width * sprite.height);
  });

  it("leaves the corners transparent", () => {
    expect(sprite.pixels[0]).toBe(TRANSPARENT);
    expect(sprite.pixels[sprite.width - 1]).toBe(TRANSPARENT);
  });

  it("has solid pixels in the middle", () => {
    const mid = Math.floor(sprite.height / 2) * sprite.width
      + Math.floor(sprite.width / 2);
    expect(sprite.pixels[mid]).not.toBe(TRANSPARENT);
  });

  it("only emits palette indices or the transparent sentinel", () => {
    for (const index of sprite.pixels) {
      expect(index === TRANSPARENT || index < PALETTE_SIZE).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/assets/textures.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/assets/textures.js`**

```js
import { fbm, makeRng, makeValueNoise } from "../core/rng.js";
import { ACCENT, RAMP, RAMP_SIZE, TRANSPARENT } from "../render/palette.js";

// Every surface in the game is generated here at boot. Nothing is loaded
// from disk: it keeps the build tiny, the startup instant, and the origin of
// every pixel unambiguous.

export const TEX_SIZE = 64;

/**
 * Period at which the noise lattice wraps. Sampling at exactly
 * NOISE_LATTICE / TEX_SIZE puts one whole period across a tile, which is
 * what makes the tile seamless. Every frequency below is an INTEGER multiple
 * of STEP_UV for that reason — a fractional multiplier produces a visible
 * seam down every wall.
 */
export const NOISE_LATTICE = 8;
const STEP_UV = NOISE_LATTICE / TEX_SIZE;

export const TEXTURE_SLOT = {
  brick: 0,
  metal: 1,
  concrete: 2,
  flesh: 3,
  tech: 4,
  floor: 5,
  ceiling: 6,
};

/** Picks a step inside a six-colour ramp from a 0..1 value. */
function step(ramp, t) {
  let s = Math.floor(t * RAMP_SIZE);
  if (s < 0) s = 0;
  if (s > RAMP_SIZE - 1) s = RAMP_SIZE - 1;
  return ramp + s;
}

function blank() {
  return new Uint8Array(TEX_SIZE * TEX_SIZE);
}

function brick(rng) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  // Both periods divide TEX_SIZE, so the courses continue across the seam.
  const BRICK_H = 16;
  const BRICK_W = 32;
  const MORTAR = 2;
  for (let y = 0; y < TEX_SIZE; y++) {
    const row = Math.floor(y / BRICK_H);
    const offset = (row % 2) * (BRICK_W / 2);
    for (let x = 0; x < TEX_SIZE; x++) {
      const lx = (x + offset) % BRICK_W;
      const ly = y % BRICK_H;
      const grain = fbm(noise, x * STEP_UV * 2, y * STEP_UV * 2, 3);
      if (ly < MORTAR || lx < MORTAR) {
        px[y * TEX_SIZE + x] = step(RAMP.concrete, 0.2 + grain * 0.25);
      } else {
        // Darken towards the bottom of each brick so the courses read.
        const shadow = (ly - MORTAR) / (BRICK_H - MORTAR);
        px[y * TEX_SIZE + x] = step(
          RAMP.brick,
          0.75 - shadow * 0.35 + (grain - 0.5) * 0.4,
        );
      }
    }
  }
  return px;
}

function metal(rng) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Four periods across, one down: stretched noise reads as brushing.
      const brushed = fbm(noise, x * STEP_UV * 4, y * STEP_UV, 3);
      const rot = fbm(noise, x * STEP_UV + 20, y * STEP_UV + 20, 2);
      const plate = y % 32 < 2 || x % 32 < 2 ? -0.25 : 0;
      const ramp = rot > 0.58 ? RAMP.rust : RAMP.concrete;
      px[y * TEX_SIZE + x] = step(ramp, 0.35 + brushed * 0.5 + plate);
    }
  }
  return px;
}

function concrete(rng) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const grain = fbm(noise, x * STEP_UV * 3, y * STEP_UV * 3, 4);
      const crack = fbm(noise, x * STEP_UV + 7, y * STEP_UV + 7, 2);
      const dark = crack > 0.46 && crack < 0.5 ? -0.3 : 0;
      px[y * TEX_SIZE + x] = step(RAMP.concrete, 0.3 + grain * 0.5 + dark);
    }
  }
  return px;
}

function flesh(rng) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const lumpy = fbm(noise, x * STEP_UV, y * STEP_UV, 3);
      const veins = fbm(noise, x * STEP_UV * 2 + 11, y * STEP_UV * 2 + 11, 2);
      const vein = veins > 0.62 ? 0.3 : 0;
      px[y * TEX_SIZE + x] = step(RAMP.flesh, 0.25 + lumpy * 0.55 + vein);
    }
  }
  return px;
}

function tech(rng) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const grain = fbm(noise, x * STEP_UV * 4, y * STEP_UV * 4, 2);
      const inPanel = x % 16 > 1 && y % 16 > 1;
      if (!inPanel) {
        px[y * TEX_SIZE + x] = step(RAMP.tech, 0.15 + grain * 0.2);
      } else if (x % 16 === 8 && y % 16 > 4 && y % 16 < 12) {
        // A lit strip on each panel gives the corridor something to glint.
        px[y * TEX_SIZE + x] = ACCENT.plasma;
      } else {
        px[y * TEX_SIZE + x] = step(RAMP.tech, 0.45 + grain * 0.4);
      }
    }
  }
  return px;
}

function floorTile(rng) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const grain = fbm(noise, x * STEP_UV * 2, y * STEP_UV * 2, 4);
      const grout = x % 16 < 1 || y % 16 < 1 ? -0.3 : 0;
      px[y * TEX_SIZE + x] = step(RAMP.concrete, 0.22 + grain * 0.45 + grout);
    }
  }
  return px;
}

function ceilingTile(rng) {
  const noise = makeValueNoise(rng, NOISE_LATTICE);
  const px = blank();
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const grain = fbm(noise, x * STEP_UV * 2, y * STEP_UV * 2, 3);
      px[y * TEX_SIZE + x] = step(RAMP.rust, 0.12 + grain * 0.3);
    }
  }
  return px;
}

export function generateTextures(seed = 1337) {
  // Each generator gets its own stream so adding one later does not reshuffle
  // the others.
  const builders = [brick, metal, concrete, flesh, tech, floorTile, ceilingTile];
  return builders.map((build, i) => ({
    size: TEX_SIZE,
    pixels: build(makeRng(seed + i * 7919)),
  }));
}

const SPRITE_W = 32;
const SPRITE_H = 48;

/**
 * Placeholder enemy until phase 3 brings the real constructive generator.
 * A shaded blob with eyes: crude, but it proves the sprite pipeline and it
 * already shades and depth-sorts like the real thing will.
 */
export function makeEnemySprite(seed = 7) {
  const rng = makeRng(seed);
  // A sprite never tiles, so its noise frequency is unconstrained.
  const noise = makeValueNoise(rng, 16);
  const px = new Uint8Array(SPRITE_W * SPRITE_H).fill(TRANSPARENT);
  const cx = SPRITE_W / 2;
  for (let y = 0; y < SPRITE_H; y++) {
    // Narrow at the head, widest at the belly, tapering to the feet.
    const t = y / (SPRITE_H - 1);
    const width = SPRITE_W * (0.22 + 0.26 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    for (let x = 0; x < SPRITE_W; x++) {
      const dx = (x - cx) / width;
      if (Math.abs(dx) > 1) continue;
      const round = Math.sqrt(1 - dx * dx);
      const grain = fbm(noise, x * 0.3, y * 0.3, 2);
      px[y * SPRITE_W + x] = step(RAMP.flesh, 0.2 + round * 0.5 + grain * 0.25);
    }
  }
  // Eyes.
  const eyeY = Math.floor(SPRITE_H * 0.2);
  for (const ex of [cx - 4, cx + 3]) {
    for (let y = eyeY; y < eyeY + 3; y++) {
      for (let x = Math.floor(ex); x < Math.floor(ex) + 2; x++) {
        px[y * SPRITE_W + x] = ACCENT.goldLight;
      }
    }
  }
  return { width: SPRITE_W, height: SPRITE_H, pixels: px };
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/assets/textures.js src/assets/textures.test.js
git commit -m "feat: generate wall textures and a placeholder enemy sprite"
```

---

### Task 8: Текстурированные стены и перевод игры на буфер

Первая задача с видимым результатом. Закрывает D3 и часть D12.

**Files:**
- Create: `src/render/walls.js`
- Create: `src/render/walls.test.js`
- Modify: `src/main.js` (заменить `cast`, `draw`, `resize`; убрать отрисовку стен на ctx)

**Interfaces:**
- Consumes: `castColumn` из `render/raycast.js`; `lightLevel` из `render/palette.js`; `map`, `textures`.
- Produces: `renderWalls(fb, map, camera, textures, options) -> void`, где `options` это `{ shadeTable, paletteSize, zbuf: Float32Array, maxDist, lightBoost, horizon }`. Заполняет `zbuf[x]` перпендикулярной дистанцией колонки (`Infinity`, если промах) — из него в задаче 10 берут глубину спрайты.

- [ ] **Step 1: Написать падающий тест**

`src/render/walls.test.js`:

```js
import { describe, expect, it } from "vitest";
import { parseMap } from "../game/map.js";
import { generateTextures } from "../assets/textures.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderWalls } from "./walls.js";

const FOV = Math.PI / 3;
const textures = generateTextures(1);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);

const { map } = parseMap([
  "#######",
  "#.....#",
  "#.....#",
  "#.....#",
  "#######",
]);

function render(camera, width = 64, height = 40) {
  const fb = createFramebuffer(width, height);
  fb.clear(0);
  const zbuf = new Float32Array(width);
  renderWalls(fb, map, camera, textures, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    maxDist: 32,
    lightBoost: 0,
    horizon: height >> 1,
  });
  return { fb, zbuf, width, height };
}

describe("renderWalls", () => {
  it("fills the z-buffer with perpendicular distances", () => {
    const { zbuf, width } = render(makeCamera(3.5, 2.5, 0, FOV));
    expect(zbuf.length).toBe(width);
    for (const d of zbuf) {
      expect(d).toBeGreaterThan(0);
      expect(Number.isFinite(d)).toBe(true);
    }
  });

  it("draws a nearer wall taller than a farther one", () => {
    const heightAt = (camX) => {
      const { fb, width, height } = render(makeCamera(camX, 2.5, 0, FOV));
      const column = width >> 1;
      let count = 0;
      for (let y = 0; y < height; y++) {
        if (fb.data[y * width + column] !== 0) count++;
      }
      return count;
    };
    expect(heightAt(5.0)).toBeGreaterThan(heightAt(1.5));
  });

  it("centres the wall on the horizon", () => {
    const { fb, width, height } = render(makeCamera(3.5, 2.5, 0, FOV));
    const column = width >> 1;
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      if (fb.data[y * width + column] !== 0) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    const centre = (top + bottom) / 2;
    expect(Math.abs(centre - height / 2)).toBeLessThanOrEqual(1);
  });

  it("leaves nothing above and below an almost-distant wall", () => {
    const { fb, width } = render(makeCamera(1.2, 2.5, 0, FOV));
    const column = width >> 1;
    expect(fb.data[column]).toBe(0);
  });

  it("darkens a wall as it recedes", () => {
    const brightness = (camX) => {
      const { fb, width, height } = render(makeCamera(camX, 2.5, 0, FOV));
      const pixel = fb.data[(height >> 1) * width + (width >> 1)];
      return (pixel & 255) + ((pixel >> 8) & 255) + ((pixel >> 16) & 255);
    };
    expect(brightness(5.6)).toBeGreaterThan(brightness(1.2));
  });

  it("writes something into every column of a closed room", () => {
    const { fb, width, height } = render(makeCamera(3.5, 2.5, 0.4, FOV));
    for (let x = 0; x < width; x++) {
      expect(fb.data[(height >> 1) * width + x]).not.toBe(0);
    }
  });

  it("survives a camera standing in a wall without throwing", () => {
    expect(() => render(makeCamera(0.5, 0.5, 0, FOV))).not.toThrow();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/walls.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/walls.js`**

```js
import { lightLevel } from "./palette.js";
import { castColumn } from "./raycast.js";

/**
 * Draws one textured column per screen pixel and records its depth.
 *
 * Call this after the floor pass: walls overwrite the floor where they
 * stand, which is cheaper than working out the exact floor span first.
 */
export function renderWalls(fb, map, camera, textures, options) {
  const { shadeTable, paletteSize, zbuf, maxDist, lightBoost, horizon } = options;
  const { width, height, data } = fb;

  for (let x = 0; x < width; x++) {
    const cameraX = (2 * x) / width - 1;
    const ray = castColumn(map, camera, cameraX, maxDist);
    if (!ray.hit) {
      zbuf[x] = Infinity;
      continue;
    }
    zbuf[x] = ray.dist;

    const lineHeight = Math.round(height / ray.dist);
    const top = horizon - (lineHeight >> 1);
    const bottom = top + lineHeight;

    const tex = textures[map.textureAt(ray.mapX, ray.mapY)];
    const texSize = tex.size;
    let texX = Math.floor(ray.texU * texSize);
    if (texX >= texSize) texX = texSize - 1;

    const shadeBase = lightLevel(ray.dist, ray.side, lightBoost) * paletteSize;
    const texStep = texSize / lineHeight;

    const yStart = top < 0 ? 0 : top;
    const yEnd = bottom > height ? height : bottom;
    // Skipping the clipped-off top of a tall column keeps the texture
    // anchored: without this the texture would slide as the player walks
    // into a wall.
    let texPos = (yStart - top) * texStep;
    let index = yStart * width + x;

    for (let y = yStart; y < yEnd; y++) {
      let texY = texPos | 0;
      if (texY >= texSize) texY = texSize - 1;
      texPos += texStep;
      data[index] = shadeTable[shadeBase + tex.pixels[texY * texSize + texX]];
      index += width;
    }
  }
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Перевести `main.js` на буфер**

Удалить функцию `cast` (`src/main.js:291-311`) целиком: её заменил `castColumn`.

Добавить импорты в начало `src/main.js`:

```js
import { generateTextures, TEXTURE_SLOT } from "./assets/textures.js";
import { parseMap } from "./game/map.js";
import { createPresenter } from "./render/framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./render/palette.js";
import { makeCamera } from "./render/raycast.js";
import { renderWalls } from "./render/walls.js";
```

Заменить константы карты (`src/main.js:3-23`) на использование модуля:

```js
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
```

Функция `wall(x, y)` (`src/main.js:78-83`) заменяется на `map.isSolidAt(x, y)` во всех вызовах: в `blocked`, `tryMove`, `tryEnemyMove`.

Функция `reset` (`src/main.js:97-121`) больше не сканирует сетку сама:

```js
function reset() {
  player = { ...parsed.playerStart };
  player.a = parsed.playerStart.angle;
  enemies = parsed.enemySpawns.map((s) => ({ x: s.x, y: s.y, hp: 2, hit: 0 }));
  hp = 100;
  ...
}
```

Добавить состояние рендера и функцию изменения размера:

```js
const INTERNAL_WIDTH = 480;
const MAX_DIST = 32;

const textures = generateTextures(1337);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);

let presenter = null;
let zbuf = new Float32Array(1);
let lightBoost = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  // A canvas can measure zero while the layout settles or while an ancestor
  // is hidden. Dividing by that aspect ratio would ask for a buffer of
  // infinite height, which throws. Wait for a real size instead.
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
```

Заменить тело `draw` (`src/main.js:313-386`). На этом шаге пол и потолок остаются заливкой — их заменит задача 9, спрайты и оружие временно не рисуются и вернутся в задачах 10 и 11:

```js
function draw() {
  const fb = presenter.fb;
  const camera = makeCamera(player.x, player.y, player.a, FOV);
  const horizon = fb.height >> 1;

  fb.fillRect(0, 0, fb.width, horizon, shadeTable[6 * PALETTE_SIZE + 12]);
  fb.fillRect(0, horizon, fb.width, fb.height - horizon,
    shadeTable[6 * PALETTE_SIZE + 0]);

  renderWalls(fb, map, camera, textures, {
    shadeTable,
    paletteSize: PALETTE_SIZE,
    zbuf,
    maxDist: MAX_DIST,
    lightBoost,
    horizon,
  });

  presenter.present(ctx, canvas.width, canvas.height);
}
```

Константа `TEXTURE_SLOT` пока не используется в `main.js` — импорт добавится в задаче 9. Пока её не импортировать.

- [ ] **Step 6: Проверить в браузере**

Run: `npm run dev`
Expected: стены текстурированы и темнеют с расстоянием; картинка заметно пикселизована; движение и столкновения работают как раньше. Врагов и оружия временно не видно — это ожидаемо, их возвращают задачи 10 и 11.

- [ ] **Step 7: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 8: Commit**

```bash
git add src/render/walls.js src/render/walls.test.js src/main.js
git commit -m "feat: render textured walls through the pixel framebuffer"
```

---

### Task 9: Каст пола и потолка

**Files:**
- Create: `src/render/floors.js`
- Create: `src/render/floors.test.js`
- Modify: `src/main.js` (в `draw` заменить две заливки)

**Interfaces:**
- Consumes: `lightLevel` из `render/palette.js`.
- Produces: `renderFloorCeiling(fb, camera, floorTex, ceilingTex, options) -> void`, где `options` это `{ shadeTable, paletteSize, lightBoost, horizon }`. Заполняет весь буфер; вызывается **до** `renderWalls`.

- [ ] **Step 1: Написать падающий тест**

`src/render/floors.test.js`:

```js
import { describe, expect, it } from "vitest";
import { TEXTURE_SLOT, generateTextures } from "../assets/textures.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderFloorCeiling } from "./floors.js";

const FOV = Math.PI / 3;
const textures = generateTextures(1);
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const WIDTH = 64;
const HEIGHT = 40;

function render(camera) {
  const fb = createFramebuffer(WIDTH, HEIGHT);
  fb.clear(0);
  renderFloorCeiling(
    fb,
    camera,
    textures[TEXTURE_SLOT.floor],
    textures[TEXTURE_SLOT.ceiling],
    {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      lightBoost: 0,
      horizon: HEIGHT >> 1,
    },
  );
  return fb;
}

const luma = (p) => (p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255);

// A single pixel's brightness also depends on which texel it landed on, so
// comparisons average a whole row. That isolates the lighting from the
// texture detail and keeps the test from flapping on a seed change.
const rowLuma = (fb, y) => {
  let sum = 0;
  for (let x = 0; x < WIDTH; x++) sum += luma(fb.data[y * WIDTH + x]);
  return sum / WIDTH;
};

// Warmth separates the two surfaces: the floor is grey concrete, the ceiling
// is rust, which carries far more red than blue.
const warmth = (fb, y) => {
  let sum = 0;
  for (let x = 0; x < WIDTH; x++) {
    const p = fb.data[y * WIDTH + x];
    sum += (p & 255) - ((p >> 16) & 255);
  }
  return sum / WIDTH;
};

describe("renderFloorCeiling", () => {
  it("leaves no row of the buffer untouched", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    for (let y = 0; y < HEIGHT; y++) {
      expect(fb.data[y * WIDTH + (WIDTH >> 1)]).not.toBe(0);
    }
  });

  it("brightens towards the bottom of the screen, which is nearest", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    expect(rowLuma(fb, HEIGHT - 1)).toBeGreaterThan(
      rowLuma(fb, (HEIGHT >> 1) + 2),
    );
  });

  it("draws the ceiling with a different surface than the floor", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    const floorRow = (HEIGHT >> 1) + 6;
    const ceilingRow = HEIGHT - floorRow - 1;
    expect(warmth(fb, ceilingRow)).toBeGreaterThan(warmth(fb, floorRow));
  });

  it("changes what it draws when the camera moves", () => {
    const a = render(makeCamera(2.5, 2.5, 0, FOV));
    const b = render(makeCamera(2.9, 2.5, 0, FOV));
    expect([...a.data]).not.toEqual([...b.data]);
  });

  it("does not throw at negative world coordinates", () => {
    expect(() => render(makeCamera(-3.25, -1.75, 2.1, FOV))).not.toThrow();
  });

  it("never divides by zero on the horizon row", () => {
    const fb = render(makeCamera(2.5, 2.5, 0, FOV));
    for (const pixel of fb.data) {
      expect(Number.isFinite(pixel)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/floors.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/floors.js`**

```js
import { lightLevel } from "./palette.js";

/**
 * Horizontal texture mapping for the floor and ceiling.
 *
 * Every screen row below the horizon corresponds to one constant distance
 * from the camera, so the texture coordinate can be stepped linearly across
 * the row. One row of work replaces one ray per pixel. The ceiling is the
 * same row mirrored about the horizon.
 *
 * Runs before the wall pass and covers the whole buffer; walls then paint
 * over it.
 */
export function renderFloorCeiling(fb, camera, floorTex, ceilingTex, options) {
  const { shadeTable, paletteSize, lightBoost, horizon } = options;
  const { width, height, data } = fb;

  // Rays through the left and right edges of the screen.
  const rayDirX0 = camera.dirX - camera.planeX;
  const rayDirY0 = camera.dirY - camera.planeY;
  const rayDirX1 = camera.dirX + camera.planeX;
  const rayDirY1 = camera.dirY + camera.planeY;

  const floorSize = floorTex.size;
  const ceilSize = ceilingTex.size;
  const floorMask = floorSize - 1;
  const ceilMask = ceilSize - 1;
  // Textures are power-of-two so wrapping is a bitwise AND. Guard the
  // assumption rather than silently drawing garbage.
  if ((floorSize & floorMask) !== 0 || (ceilSize & ceilMask) !== 0) {
    throw new Error("floor and ceiling textures must be power-of-two sized");
  }

  const eyeHeight = 0.5 * height;

  // Start everything in the dark. The loop below cannot reach the horizon
  // row (its distance is infinite) nor the row mirroring it, and leaving
  // those as uninitialised zero would punch two transparent lines across
  // the screen.
  data.fill(shadeTable[0]);

  for (let y = horizon + 1; y < height; y++) {
    const rowDist = eyeHeight / (y - horizon);

    const stepX = (rowDist * (rayDirX1 - rayDirX0)) / width;
    const stepY = (rowDist * (rayDirY1 - rayDirY0)) / width;
    let worldX = camera.x + rowDist * rayDirX0;
    let worldY = camera.y + rowDist * rayDirY0;

    const shadeBase = lightLevel(rowDist, 0, lightBoost) * paletteSize;
    const floorRow = y * width;
    const ceilRow = (height - y - 1) * width;

    for (let x = 0; x < width; x++) {
      const fx = Math.floor(worldX * floorSize) & floorMask;
      const fy = Math.floor(worldY * floorSize) & floorMask;
      const cx = Math.floor(worldX * ceilSize) & ceilMask;
      const cy = Math.floor(worldY * ceilSize) & ceilMask;

      data[floorRow + x] =
        shadeTable[shadeBase + floorTex.pixels[fy * floorSize + fx]];
      data[ceilRow + x] =
        shadeTable[shadeBase + ceilingTex.pixels[cy * ceilSize + cx]];

      worldX += stepX;
      worldY += stepY;
    }
  }
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Подключить в `main.js`**

Расширить импорты:

```js
import { renderFloorCeiling } from "./render/floors.js";
```

и добавить `TEXTURE_SLOT` в уже существующий импорт из `./assets/textures.js`.

В `draw` заменить две заливки `fb.fillRect(...)` на:

```js
  renderFloorCeiling(
    fb,
    camera,
    textures[TEXTURE_SLOT.floor],
    textures[TEXTURE_SLOT.ceiling],
    { shadeTable, paletteSize: PALETTE_SIZE, lightBoost, horizon },
  );
```

- [ ] **Step 6: Проверить в браузере**

Run: `npm run dev`
Expected: под ногами и над головой видна текстура, уходящая в темноту; при движении она правильно скользит и не «плывёт» относительно стен.

- [ ] **Step 7: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 8: Commit**

```bash
git add src/render/floors.js src/render/floors.test.js src/main.js
git commit -m "feat: texture-map the floor and ceiling"
```

---

### Task 10: Спрайты по камерной матрице

Закрывает D2 — рассинхрон проекции спрайтов и стен.

**Files:**
- Create: `src/render/sprites.js`
- Create: `src/render/sprites.test.js`
- Modify: `src/main.js` (в `draw` вернуть отрисовку врагов)

**Interfaces:**
- Consumes: `lightLevel`, `TRANSPARENT` из `render/palette.js`.
- Produces: `projectSprite(camera, worldX, worldY) -> { depth, screenX } | null` (`null`, если позади камеры); `renderSprites(fb, camera, sprites, options) -> void`, где `sprites` это массив `{ x, y, bitmap, hit }`, а `options` это `{ shadeTable, paletteSize, zbuf, lightBoost, horizon, scale }`.

`screenX` возвращается в нормализованном виде `[0, 1]` — доля ширины экрана, чтобы функция не зависела от разрешения и легко тестировалась.

- [ ] **Step 1: Написать падающий тест**

`src/render/sprites.test.js`:

```js
import { describe, expect, it } from "vitest";
import { makeEnemySprite } from "../assets/textures.js";
import { parseMap } from "../game/map.js";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable } from "./palette.js";
import { makeCamera } from "./raycast.js";
import { renderWalls } from "./walls.js";
import { projectSprite, renderSprites } from "./sprites.js";
import { generateTextures } from "../assets/textures.js";

const FOV = Math.PI / 3;
const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const bitmap = makeEnemySprite(7);
const WIDTH = 96;
const HEIGHT = 60;

describe("projectSprite", () => {
  it("puts a sprite straight ahead in the middle of the screen", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const p = projectSprite(cam, 5.5, 2.5);
    expect(p.screenX).toBeCloseTo(0.5, 6);
    expect(p.depth).toBeCloseTo(3, 6);
  });

  it("rejects anything behind the camera", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    expect(projectSprite(cam, 0.5, 2.5)).toBe(null);
  });

  it("puts a sprite on the fov edge at the screen edge", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const depth = 3;
    const offset = depth * Math.tan(FOV / 2);
    expect(projectSprite(cam, 2.5 + depth, 2.5 + offset).screenX)
      .toBeCloseTo(1, 6);
    expect(projectSprite(cam, 2.5 + depth, 2.5 - offset).screenX)
      .toBeCloseTo(0, 6);
  });

  it("agrees with the wall projection at the screen edge", () => {
    // This is the bug the old renderer had: sprites used a linear angle
    // mapping while walls used a tangent one, so they drifted apart towards
    // the edges. Both must now agree to the pixel.
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const depth = 4;
    for (const cameraX of [-0.9, -0.5, 0, 0.5, 0.9]) {
      // A point sitting exactly on the ray for this screen column.
      const rayX = cam.dirX + cam.planeX * cameraX;
      const rayY = cam.dirY + cam.planeY * cameraX;
      const p = projectSprite(cam, cam.x + rayX * depth, cam.y + rayY * depth);
      expect(p.screenX).toBeCloseTo((cameraX + 1) / 2, 6);
    }
  });

  it("keeps depth independent of horizontal offset", () => {
    const cam = makeCamera(2.5, 2.5, 0, FOV);
    const straight = projectSprite(cam, 5.5, 2.5);
    const offset = projectSprite(cam, 5.5, 3.5);
    expect(offset.depth).toBeCloseTo(straight.depth, 6);
  });
});

describe("renderSprites", () => {
  const { map } = parseMap([
    "#########",
    "#.......#",
    "#.......#",
    "#.......#",
    "#########",
  ]);
  const textures = generateTextures(1);

  function scene(sprites, camera) {
    const fb = createFramebuffer(WIDTH, HEIGHT);
    fb.clear(0);
    const zbuf = new Float32Array(WIDTH);
    renderWalls(fb, map, camera, textures, {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      maxDist: 32,
      lightBoost: 0,
      horizon: HEIGHT >> 1,
    });
    const before = Uint32Array.from(fb.data);
    renderSprites(fb, camera, sprites, {
      shadeTable,
      paletteSize: PALETTE_SIZE,
      zbuf,
      lightBoost: 0,
      horizon: HEIGHT >> 1,
      scale: 0.7,
    });
    return { fb, before };
  }

  const changedColumns = (fb, before) => {
    const cols = new Set();
    for (let i = 0; i < fb.data.length; i++) {
      if (fb.data[i] !== before[i]) cols.add(i % WIDTH);
    }
    return cols;
  };

  it("draws a visible sprite near the middle of the screen", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const { fb, before } = scene([{ x: 5.0, y: 2.5, bitmap, hit: 0 }], cam);
    const cols = changedColumns(fb, before);
    expect(cols.size).toBeGreaterThan(0);
    const centre = [...cols].reduce((a, b) => a + b, 0) / cols.size;
    expect(Math.abs(centre - WIDTH / 2)).toBeLessThan(4);
  });

  it("draws nothing for a sprite behind the camera", () => {
    const cam = makeCamera(5.0, 2.5, 0, FOV);
    const { fb, before } = scene([{ x: 2.0, y: 2.5, bitmap, hit: 0 }], cam);
    expect(changedColumns(fb, before).size).toBe(0);
  });

  it("hides a sprite standing behind a wall", () => {
    const { map: walled } = parseMap([
      "#########",
      "#...#...#",
      "#...#...#",
      "#...#...#",
      "#########",
    ]);
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const fb = createFramebuffer(WIDTH, HEIGHT);
    fb.clear(0);
    const zbuf = new Float32Array(WIDTH);
    renderWalls(fb, walled, cam, textures, {
      shadeTable, paletteSize: PALETTE_SIZE, zbuf,
      maxDist: 32, lightBoost: 0, horizon: HEIGHT >> 1,
    });
    const before = Uint32Array.from(fb.data);
    renderSprites(fb, cam, [{ x: 6.5, y: 2.5, bitmap, hit: 0 }], {
      shadeTable, paletteSize: PALETTE_SIZE, zbuf,
      lightBoost: 0, horizon: HEIGHT >> 1, scale: 0.7,
    });
    expect(changedColumns(fb, before).size).toBe(0);
  });

  it("draws a near sprite wider than a far one", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const near = scene([{ x: 3.2, y: 2.5, bitmap, hit: 0 }], cam);
    const far = scene([{ x: 6.5, y: 2.5, bitmap, hit: 0 }], cam);
    expect(changedColumns(near.fb, near.before).size)
      .toBeGreaterThan(changedColumns(far.fb, far.before).size);
  });

  it("draws the nearer of two overlapping sprites on top", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const both = scene(
      [
        { x: 6.5, y: 2.5, bitmap, hit: 0 },
        { x: 3.2, y: 2.5, bitmap, hit: 0 },
      ],
      cam,
    );
    const onlyNear = scene([{ x: 3.2, y: 2.5, bitmap, hit: 0 }], cam);
    const centre = (HEIGHT >> 1) * WIDTH + (WIDTH >> 1);
    expect(both.fb.data[centre]).toBe(onlyNear.fb.data[centre]);
  });

  it("flashes a sprite that was just hit", () => {
    const cam = makeCamera(2.0, 2.5, 0, FOV);
    const calm = scene([{ x: 4.0, y: 2.5, bitmap, hit: 0 }], cam);
    const struck = scene([{ x: 4.0, y: 2.5, bitmap, hit: 0.2 }], cam);
    expect([...calm.fb.data]).not.toEqual([...struck.fb.data]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/sprites.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/sprites.js`**

```js
import { SHADE_LEVELS, TRANSPARENT, lightLevel } from "./palette.js";

/**
 * Transforms a world point into camera space using the inverse of the
 * [plane | dir] matrix.
 *
 * The old renderer projected sprites by raw angle while projecting walls
 * through a tangent, so the two drifted apart towards the screen edges and
 * an enemy pressed against a wall appeared to float off it. Sharing this
 * matrix with the wall cast is what keeps them locked together.
 *
 * Returns `screenX` as a fraction of screen width so the maths stays
 * resolution independent.
 */
export function projectSprite(camera, worldX, worldY) {
  const relX = worldX - camera.x;
  const relY = worldY - camera.y;
  const det = camera.planeX * camera.dirY - camera.dirX * camera.planeY;
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;

  const transformX = invDet * (camera.dirY * relX - camera.dirX * relY);
  const depth = invDet * (-camera.planeY * relX + camera.planeX * relY);
  if (depth <= 1e-4) return null;

  return { depth, screenX: 0.5 * (1 + transformX / depth) };
}

export function renderSprites(fb, camera, sprites, options) {
  const { shadeTable, paletteSize, zbuf, lightBoost, horizon, scale } = options;
  const { width, height, data } = fb;

  // Far to near: the depth test against zbuf handles walls, but sprites
  // overlapping each other are resolved by paint order.
  const visible = [];
  for (const sprite of sprites) {
    const p = projectSprite(camera, sprite.x, sprite.y);
    if (p) visible.push({ sprite, depth: p.depth, screenX: p.screenX });
  }
  visible.sort((a, b) => b.depth - a.depth);

  for (const { sprite, depth, screenX } of visible) {
    const bitmap = sprite.bitmap;
    const drawH = Math.round((height / depth) * scale);
    if (drawH <= 0) continue;
    const drawW = Math.round(drawH * (bitmap.width / bitmap.height));
    if (drawW <= 0) continue;

    const centreX = Math.round(screenX * width);
    // Feet sit on the horizon line pushed down by half a wall height, which
    // is where the floor meets a unit-tall wall at this depth.
    const bottom = horizon + Math.round(height / (2 * depth));
    const top = bottom - drawH;

    const left = centreX - (drawW >> 1);
    const xStart = Math.max(0, left);
    const xEnd = Math.min(width, left + drawW);
    const yStart = Math.max(0, top);
    const yEnd = Math.min(height, bottom);

    const flash = sprite.hit > 0;
    const level = flash
      ? SHADE_LEVELS - 1
      : lightLevel(depth, 0, lightBoost);
    const shadeBase = level * paletteSize;

    for (let x = xStart; x < xEnd; x++) {
      if (depth >= zbuf[x]) continue;
      const texX = Math.min(
        bitmap.width - 1,
        Math.floor(((x - left) * bitmap.width) / drawW),
      );
      for (let y = yStart; y < yEnd; y++) {
        const texY = Math.min(
          bitmap.height - 1,
          Math.floor(((y - top) * bitmap.height) / drawH),
        );
        const index = bitmap.pixels[texY * bitmap.width + texX];
        if (index === TRANSPARENT) continue;
        data[y * width + x] = shadeTable[shadeBase + index];
      }
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
import { renderSprites } from "./render/sprites.js";
```

и добавить `makeEnemySprite` в существующий импорт из `./assets/textures.js`.

Рядом с `textures`:

```js
const enemyBitmap = makeEnemySprite(7);
```

В `draw`, после `renderWalls`:

```js
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
```

Старый блок отрисовки спрайтов (`src/main.js:336-371` в исходной нумерации) уже удалён вместе с телом `draw` в задаче 8. Функция `blocked` остаётся: ей продолжает пользоваться боевая логика. Проверку `!blocked(...)` при отборе спрайтов убираем — её работу теперь делает z-буфер, и делает точнее.

- [ ] **Step 6: Проверить в браузере**

Run: `npm run dev`
Expected: враги видны, затеняются с расстоянием, корректно скрываются за углами и **не смещаются относительно стен при повороте камеры**, в том числе у самых краёв экрана.

- [ ] **Step 7: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 8: Commit**

```bash
git add src/render/sprites.js src/render/sprites.test.js src/main.js
git commit -m "fix: project sprites with the camera matrix used by walls"
```

---

### Task 11: Оружие в пиксельном буфере

**Files:**
- Create: `src/render/weaponview.js`
- Create: `src/render/weaponview.test.js`
- Modify: `src/main.js` (удалить `drawWeapon`, вызвать модуль, вернуть прицел и вспышки)

**Interfaces:**
- Consumes: `PALETTE`, `RAMP`, `SHADE_LEVELS` из `render/palette.js`.
- Produces: `renderWeapon(fb, view, options) -> void`, где `view` это `{ weapon: "gun" | "stick", cooldown, swing, swingTime }`, а `options` это `{ shadeTable, paletteSize }`; `renderCrosshair(fb, shadeTable, paletteSize)`; `renderFlash(fb, color, alpha)`.

- [ ] **Step 1: Написать падающий тест**

`src/render/weaponview.test.js`:

```js
import { describe, expect, it } from "vitest";
import { createFramebuffer } from "./framebuffer.js";
import { PALETTE, PALETTE_SIZE, SHADE_LEVELS, buildShadeTable, rgb } from "./palette.js";
import { renderCrosshair, renderFlash, renderWeapon } from "./weaponview.js";

const shadeTable = buildShadeTable(PALETTE, SHADE_LEVELS);
const WIDTH = 96;
const HEIGHT = 60;
const OPTS = { shadeTable, paletteSize: PALETTE_SIZE };

function blank() {
  const fb = createFramebuffer(WIDTH, HEIGHT);
  fb.clear(0);
  return fb;
}

const painted = (fb) => [...fb.data].filter((p) => p !== 0).length;

describe("renderWeapon", () => {
  it("draws the gun in the lower half of the screen", () => {
    const fb = blank();
    renderWeapon(fb, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    let topHalf = 0;
    for (let y = 0; y < HEIGHT >> 1; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (fb.data[y * WIDTH + x] !== 0) topHalf++;
      }
    }
    expect(painted(fb)).toBeGreaterThan(0);
    expect(topHalf).toBe(0);
  });

  it("draws the stick differently from the gun", () => {
    const gun = blank();
    const stick = blank();
    renderWeapon(gun, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    renderWeapon(stick, { weapon: "stick", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    expect([...gun.data]).not.toEqual([...stick.data]);
  });

  it("kicks the gun when it has just fired", () => {
    const calm = blank();
    const fired = blank();
    renderWeapon(calm, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS);
    renderWeapon(fired, { weapon: "gun", cooldown: 0.12, swing: 0, swingTime: 0.34 }, OPTS);
    expect([...calm.data]).not.toEqual([...fired.data]);
  });

  it("moves the stick through its swing", () => {
    const start = blank();
    const mid = blank();
    renderWeapon(start, { weapon: "stick", cooldown: 0, swing: 0.34, swingTime: 0.34 }, OPTS);
    renderWeapon(mid, { weapon: "stick", cooldown: 0, swing: 0.17, swingTime: 0.34 }, OPTS);
    expect([...start.data]).not.toEqual([...mid.data]);
  });

  it("stays inside the buffer at any size", () => {
    const small = createFramebuffer(16, 12);
    small.clear(0);
    expect(() =>
      renderWeapon(small, { weapon: "gun", cooldown: 0, swing: 0, swingTime: 0.34 }, OPTS),
    ).not.toThrow();
  });
});

describe("renderCrosshair", () => {
  it("marks the exact centre of the screen", () => {
    const fb = blank();
    renderCrosshair(fb, shadeTable, PALETTE_SIZE);
    expect(fb.data[(HEIGHT >> 1) * WIDTH + (WIDTH >> 1)]).not.toBe(0);
  });
});

describe("renderFlash", () => {
  it("does nothing at zero strength", () => {
    const fb = blank();
    renderFlash(fb, rgb(255, 0, 0), 0);
    expect(painted(fb)).toBe(0);
  });

  it("tints the whole screen at full strength", () => {
    const fb = blank();
    renderFlash(fb, rgb(255, 0, 0), 1);
    expect(painted(fb)).toBe(WIDTH * HEIGHT);
  });

  it("blends partially in between", () => {
    const half = blank();
    const full = blank();
    renderFlash(half, rgb(255, 0, 0), 0.5);
    renderFlash(full, rgb(255, 0, 0), 1);
    expect(half.data[0]).not.toBe(full.data[0]);
    expect(half.data[0]).not.toBe(0);
  });

  it("clamps strengths outside [0, 1]", () => {
    const fb = blank();
    expect(() => renderFlash(fb, rgb(255, 0, 0), 5)).not.toThrow();
    expect(() => renderFlash(fb, rgb(255, 0, 0), -5)).not.toThrow();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/render/weaponview.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/render/weaponview.js`**

```js
import { ACCENT, RAMP, SHADE_LEVELS, rgb } from "./palette.js";

// First-person weapon art, drawn straight into the pixel buffer so it
// matches the chunky resolution of the world instead of sitting on top of it
// as smooth vector shapes. Phase 2 replaces these blocks with real sprites.

const FULL = SHADE_LEVELS - 1;

function shade(options, index) {
  return options.shadeTable[FULL * options.paletteSize + index];
}

function drawGun(fb, view, options) {
  const { width, height } = fb;
  const kick = view.cooldown > 0 ? Math.round(height * 0.03) : 0;
  const unit = Math.max(1, Math.round(height / 60));
  const baseX = Math.round(width * 0.58);
  const baseY = height - Math.round(height * 0.02) + kick;

  // Grip, receiver, barrel, muzzle.
  fb.fillRect(baseX - 9 * unit, baseY - 14 * unit, 10 * unit, 16 * unit,
    shade(options, RAMP.rust + 1));
  fb.fillRect(baseX - 3 * unit, baseY - 20 * unit, 26 * unit, 10 * unit,
    shade(options, RAMP.concrete + 2));
  fb.fillRect(baseX + 14 * unit, baseY - 24 * unit, 18 * unit, 6 * unit,
    shade(options, RAMP.concrete + 3));
  fb.fillRect(baseX + 32 * unit, baseY - 23 * unit, 5 * unit, 4 * unit,
    shade(options, RAMP.concrete + 0));

  if (view.cooldown > 0.08) {
    fb.fillRect(baseX + 37 * unit, baseY - 25 * unit, 7 * unit, 7 * unit,
      shade(options, ACCENT.goldLight));
    fb.fillRect(baseX + 44 * unit, baseY - 24 * unit, 4 * unit, 5 * unit,
      shade(options, ACCENT.gold));
  }
}

function drawStick(fb, view, options) {
  const { width, height } = fb;
  const t = view.swing > 0 ? 1 - view.swing / view.swingTime : 0;
  const lift = view.swing > 0 ? Math.sin(t * Math.PI) * height * 0.12 : 0;
  const slide = view.swing > 0 ? Math.sin(t * Math.PI) * width * 0.08 : 0;
  const unit = Math.max(1, Math.round(height / 60));

  const x = Math.round(width * 0.66 - slide);
  const y = Math.round(height - lift);
  const shaftH = Math.round(height * 0.5);

  fb.fillRect(x - 4 * unit, y - shaftH, 8 * unit, shaftH,
    shade(options, RAMP.rust + 0));
  fb.fillRect(x - 2 * unit, y - shaftH + unit, 4 * unit, shaftH - unit,
    shade(options, RAMP.rust + 2));
  fb.fillRect(x - 7 * unit, y - shaftH - 5 * unit, 14 * unit, 7 * unit,
    shade(options, RAMP.concrete + 1));
  fb.fillRect(x - 7 * unit, y - shaftH - 5 * unit, 14 * unit, 2 * unit,
    shade(options, RAMP.bone + 3));
}

export function renderWeapon(fb, view, options) {
  if (view.weapon === "stick" || view.swing > 0) drawStick(fb, view, options);
  else drawGun(fb, view, options);
}

export function renderCrosshair(fb, shadeTable, paletteSize) {
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
}

/** Full-screen tint. Used for damage and for pickups. */
export function renderFlash(fb, color, alpha) {
  let a = alpha;
  if (!(a > 0)) return;
  if (a > 1) a = 1;
  const data = fb.data;
  const sr = color & 255;
  const sg = (color >> 8) & 255;
  const sb = (color >> 16) & 255;
  const inv = 1 - a;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    data[i] = rgb(
      Math.round((d & 255) * inv + sr * a),
      Math.round(((d >> 8) & 255) * inv + sg * a),
      Math.round(((d >> 16) & 255) * inv + sb * a),
    );
  }
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Подключить в `main.js`**

Удалить функцию `drawWeapon` (`src/main.js:388-422` в исходной нумерации) целиком.

Импорты:

```js
import { renderCrosshair, renderFlash, renderWeapon } from "./render/weaponview.js";
import { rgb } from "./render/palette.js";
```

`rgb` добавить в существующий импорт из `./render/palette.js`, а не отдельной строкой.

В конце `draw`, перед `presenter.present(...)`:

```js
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
```

Вспышка от выстрела подключается к освещению мира: в `update`, рядом с уменьшением `cooldown`, добавить

```js
  lightBoost = Math.max(0, lightBoost - dt * 4);
```

а в `shoot`, после `mag -= 1`:

```js
  lightBoost = 0.35;
```

- [ ] **Step 6: Проверить в браузере**

Run: `npm run dev`
Expected: оружие нарисовано тем же крупным пикселем, что и мир; при выстреле ствол подбрасывает, появляется дульная вспышка **и стены вокруг на мгновение светлеют**; прицел и красная вспышка урона на месте.

- [ ] **Step 7: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 8: Commit**

```bash
git add src/render/weaponview.js src/render/weaponview.test.js src/main.js
git commit -m "feat: draw the weapon, crosshair and flashes in the framebuffer"
```

---

### Task 12: Ввод с pointer lock

Закрывает D10 и D7.

**Files:**
- Create: `src/core/input.js`
- Create: `src/core/input.test.js`
- Modify: `src/main.js` (удалить обработчики указателя и `analog`, `setStickFromPoint`, `setStickPad`)
- Modify: `index.html:26` (подсказка)

**Interfaces:**
- Consumes: ничего.
- Produces: `readMoveAxes(keys, stick) -> { x, y }` — нормализованный вектор движения, где `y` вперёд, `x` вправо; `createInput(canvas, config) -> Input`.

`config` это `{ phone, stickPx, lookDesktop, lookPhone, onAttack, onSwap, onReload, onRestart, onSelectWeapon, onMelee, isPlaying }`.

`onSelectWeapon(n)` получает номер нажатой цифровой клавиши, начиная с единицы. Обрабатывать её осмысленность — дело вызывающего: в этой фазе стволов два, во второй их станет шесть, и модуль ввода не должен об этом знать.
`Input` это `{ keys: Set<string>, stick: {x, y}, firing: boolean, locked: boolean, consumeLook(): number, requestLock(): void, destroy(): void }`.

`consumeLook()` возвращает накопленный поворот в радианах и обнуляет счётчик. Так поворот не зависит от частоты событий мыши.

- [ ] **Step 1: Написать падающий тест**

`src/core/input.test.js`:

```js
import { describe, expect, it } from "vitest";
import { readMoveAxes } from "./input.js";

const noStick = { x: 0, y: 0 };

describe("readMoveAxes", () => {
  it("is still with no input", () => {
    expect(readMoveAxes(new Set(), noStick)).toEqual({ x: 0, y: 0 });
  });

  it("walks forward on W and on ArrowUp", () => {
    expect(readMoveAxes(new Set(["KeyW"]), noStick).y).toBeCloseTo(1, 6);
    expect(readMoveAxes(new Set(["ArrowUp"]), noStick).y).toBeCloseTo(1, 6);
  });

  it("walks back on S", () => {
    expect(readMoveAxes(new Set(["KeyS"]), noStick).y).toBeCloseTo(-1, 6);
  });

  it("strafes right on D and left on A", () => {
    expect(readMoveAxes(new Set(["KeyD"]), noStick).x).toBeCloseTo(1, 6);
    expect(readMoveAxes(new Set(["KeyA"]), noStick).x).toBeCloseTo(-1, 6);
  });

  it("cancels opposing keys", () => {
    expect(readMoveAxes(new Set(["KeyW", "KeyS"]), noStick)).toEqual({ x: 0, y: 0 });
  });

  it("normalises diagonals so they are not faster", () => {
    const diagonal = readMoveAxes(new Set(["KeyW", "KeyD"]), noStick);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6);
  });

  it("reads the analogue stick, with screen-down meaning backwards", () => {
    const axes = readMoveAxes(new Set(), { x: 0, y: 1 });
    expect(axes.y).toBeCloseTo(-1, 6);
  });

  it("honours a partly pushed stick", () => {
    const axes = readMoveAxes(new Set(), { x: 0, y: -0.5 });
    expect(axes.y).toBeCloseTo(0.5, 6);
  });

  it("ignores stick noise below the dead zone", () => {
    expect(readMoveAxes(new Set(), { x: 0.01, y: 0.01 })).toEqual({ x: 0, y: 0 });
  });

  it("never exceeds unit length, even with keys and stick together", () => {
    const axes = readMoveAxes(new Set(["KeyW", "KeyD"]), { x: 1, y: -1 });
    expect(Math.hypot(axes.x, axes.y)).toBeLessThanOrEqual(1.0001);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test src/core/input.test.js`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `src/core/input.js`**

```js
const DEAD_ZONE = 0.04;

/**
 * Collapses the keyboard and the touch stick into one movement vector:
 * `y` forward, `x` right, length at most 1.
 *
 * Kept pure and separate from event wiring so the movement rules — dead
 * zone, diagonal normalisation, opposing keys — can be tested without a DOM.
 */
export function readMoveAxes(keys, stick) {
  let x = 0;
  let y = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  x += stick.x;
  // Screen y grows downwards; pushing the stick up must walk forward.
  y -= stick.y;

  const length = Math.hypot(x, y);
  if (length < DEAD_ZONE) return { x: 0, y: 0 };
  const scale = Math.min(1, length) / length;
  return { x: x * scale, y: y * scale };
}

export function createInput(canvas, config) {
  const {
    phone,
    stickPx,
    lookDesktop,
    lookPhone,
    onAttack,
    onSwap,
    onReload,
    onRestart,
    onSelectWeapon,
    onMelee,
    isPlaying,
  } = config;

  const keys = new Set();
  const stick = { x: 0, y: 0 };
  const pointers = new Map();
  const state = {
    keys,
    stick,
    firing: false,
    locked: false,
    consumeLook,
    requestLock,
    destroy,
  };

  let lookAccum = 0;
  const padCleanup = [];
  // Pointer lock is granted asynchronously, so a click can never observe its
  // own result. Drag-to-look stays available only once a request has
  // actually been refused.
  let lockUnavailable = !canvas.requestPointerLock;

  function consumeLook() {
    const value = lookAccum;
    lookAccum = 0;
    return value;
  }

  function requestLock() {
    if (phone || state.locked || lockUnavailable) return;
    const result = canvas.requestPointerLock?.();
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        lockUnavailable = true;
      });
    }
  }

  function setStickFromPoint(clientX, clientY, origin) {
    const dx = (clientX - origin.x) / stickPx;
    const dy = (clientY - origin.y) / stickPx;
    const length = Math.hypot(dx, dy) || 1;
    const capped = Math.min(1, length);
    stick.x = (dx / length) * capped;
    stick.y = (dy / length) * capped;
  }

  function onKeyDown(e) {
    keys.add(e.code);
    if (e.code === "KeyR") onReload();
    if (e.code === "KeyQ" || e.code === "KeyE") onSwap();
    if (e.code === "KeyF") onMelee();
    // Digit1..Digit9 select a weapon directly. Which numbers are valid is the
    // caller's business, not this module's.
    if (e.code.startsWith("Digit")) {
      const slot = Number(e.code.slice(5));
      if (slot >= 1) onSelectWeapon(slot);
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (isPlaying()) onAttack();
    }
    if ((e.code === "Enter" || e.code === "Space") && !isPlaying()) onRestart();
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onLockChange() {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) state.firing = false;
  }

  function onMouseMove(e) {
    if (!state.locked) return;
    lookAccum += e.movementX * lookDesktop;
  }

  function onMouseDown(e) {
    if (!state.locked || e.button !== 0) return;
    state.firing = true;
    onAttack();
  }

  function onMouseUp(e) {
    if (e.button === 0) state.firing = false;
  }

  function onPointerDown(e) {
    if (!isPlaying()) return;
    if (!phone) {
      if (state.locked) return; // the mouse handlers own the locked case
      requestLock();
      if (!lockUnavailable) return; // first click only grabs the cursor
      // Lock was refused earlier: fall back to dragging so the game stays
      // playable rather than becoming impossible to aim.
      pointers.set(e.pointerId, { kind: "look", x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      state.firing = true;
      onAttack();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    if (e.clientX < window.innerWidth * 0.42) {
      pointers.set(e.pointerId, { kind: "move", x: e.clientX, y: e.clientY });
      setStickFromPoint(e.clientX, e.clientY, { x: e.clientX, y: e.clientY });
      return;
    }
    pointers.set(e.pointerId, { kind: "look", x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.kind === "look") {
      lookAccum += (e.clientX - p.x) * (phone ? lookPhone : lookDesktop);
      p.x = e.clientX;
      p.y = e.clientY;
      return;
    }
    setStickFromPoint(e.clientX, e.clientY, p);
  }

  function onPointerEnd(e) {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (p?.kind === "move") {
      stick.x = 0;
      stick.y = 0;
    }
    if (p?.kind === "look" && !phone) state.firing = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  document.addEventListener("pointerlockchange", onLockChange);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerEnd);
  canvas.addEventListener("pointercancel", onPointerEnd);

  function destroy() {
    // Listeners attached by bindStickPad live on another element, so they are
    // collected here rather than being unreachable from this function.
    for (const undo of padCleanup) undo();
    padCleanup.length = 0;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("pointerlockchange", onLockChange);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerEnd);
    canvas.removeEventListener("pointercancel", onPointerEnd);
  }

  /** Bind the on-screen stick pad. Phone only. */
  state.bindStickPad = function bindStickPad(element) {
    const on = (type, handler) => {
      element.addEventListener(type, handler);
      padCleanup.push(() => element.removeEventListener(type, handler));
    };
    const fromPad = (e) => {
      const r = element.getBoundingClientRect();
      setStickFromPoint(e.clientX, e.clientY, {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      });
    };
    on("pointerdown", (e) => {
      e.stopPropagation();
      element.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { kind: "move", x: e.clientX, y: e.clientY });
      fromPad(e);
    });
    on("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      fromPad(e);
    });
    const clear = (e) => {
      pointers.delete(e.pointerId);
      stick.x = 0;
      stick.y = 0;
    };
    on("pointerup", clear);
    on("pointercancel", clear);
  };

  return state;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Подключить в `main.js`**

Удалить из `main.js`: `analog` (`:208-222`), `setStickFromPoint` (`:438-445`), все обработчики `keydown` / `keyup` / `pointerdown` / `pointermove` / `pointerup` / `pointercancel`, `setStickPad` и блок привязки `stickEl` (`:447-528`). Обработчики кнопок `btn-swap` и `btn-fire` остаются на месте.

Свести скорость к одной константе (D7): удалить `MOVE_PHONE`, оставить

```js
const MOVE = 3.4;
```

Импорт и создание:

```js
import { createInput, readMoveAxes } from "./core/input.js";

const input = createInput(canvas, {
  phone,
  stickPx: STICK_PX,
  lookDesktop: LOOK_DESK,
  lookPhone: LOOK_PHONE,
  onAttack: () => attack(),
  onSwap: () => swapWeapon(),
  onReload: () => startReload(),
  onRestart: () => reset(),
  onMelee: () => melee(),
  onSelectWeapon: (slot) => {
    if (slot === 1) weapon = "gun";
    else if (slot === 2) weapon = "stick";
    else return;
    syncHud();
  },
  isPlaying: () => phase === "play",
});
if (phone) input.bindStickPad(document.getElementById("stick"));
```

В `update` заменить чтение управления:

```js
  player.a += input.consumeLook();
  const move = readMoveAxes(input.keys, input.stick);
  const speed = MOVE;
  ...
  if (input.firing || firing) attack();
```

`firing` остаётся отдельным флагом, потому что его выставляет мобильная кнопка FIRE.

Отпускать захват при смерти — в `die()` добавить:

```js
  if (document.pointerLockElement) document.exitPointerLock();
```

- [ ] **Step 6: Обновить подсказку в `index.html`**

Строка 26:

```html
        <p class="hint">WASD move · mouse look · click fire · 1/2 or Q swap · F melee · R reload · Esc frees cursor</p>
```

- [ ] **Step 7: Проверить в браузере**

Run: `npm run dev`
Expected: клик по экрану захватывает курсор, мышь поворачивает камеру без перетаскивания, `Esc` отпускает курсор; на телефоне стик и кнопки работают как раньше, скорость передвижения совпадает с десктопной.

- [ ] **Step 8: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 9: Commit**

```bash
git add src/core/input.js src/core/input.test.js src/main.js index.html
git commit -m "feat: take input through a module with pointer lock"
```

---

### Task 13: Игровой цикл, состояние и разгрузка HUD

Закрывает D8 и завершает D12.

**Files:**
- Create: `src/core/loop.js`
- Create: `src/core/loop.test.js`
- Create: `src/game/state.js`
- Create: `src/game/state.test.js`
- Modify: `src/main.js`
- Modify: `README.md` (раздел про разработку)

**Interfaces:**
- Consumes: ничего.
- Produces: `createLoop({ update, render, maxStep, now, schedule }) -> { start(), stop() }`; `createHudBinding(elements) -> { sync(values) }`, где `values` это `{ hp, ammo, kills }`, а `sync` пишет в DOM только изменившиеся поля; `createGameState(parsed) -> state`.

`now` и `schedule` — точки внедрения, чтобы цикл тестировался без `requestAnimationFrame`.

- [ ] **Step 1: Написать падающий тест для цикла**

`src/core/loop.test.js`:

```js
import { describe, expect, it } from "vitest";
import { createLoop } from "./loop.js";

function harness(frames) {
  let time = 0;
  let queued = null;
  const steps = [];
  const loop = createLoop({
    update: (dt) => steps.push(dt),
    render: () => {},
    maxStep: 0.05,
    now: () => time,
    schedule: (cb) => {
      queued = cb;
      return 1;
    },
    cancel: () => {
      queued = null;
    },
  });
  loop.start();
  for (const advance of frames) {
    time += advance * 1000;
    queued?.(time);
  }
  return { steps, loop, isQueued: () => queued !== null };
}

describe("createLoop", () => {
  it("reports the elapsed time of each frame", () => {
    const { steps } = harness([0.016, 0.016, 0.02]);
    expect(steps.length).toBe(3);
    expect(steps[0]).toBeCloseTo(0.016, 6);
    expect(steps[2]).toBeCloseTo(0.02, 6);
  });

  it("clamps a long frame so a background tab cannot teleport the player", () => {
    const { steps } = harness([5]);
    expect(steps[0]).toBe(0.05);
  });

  it("never reports a negative step", () => {
    const { steps } = harness([0, 0]);
    for (const dt of steps) expect(dt).toBeGreaterThanOrEqual(0);
  });

  it("stops scheduling after stop", () => {
    const h = harness([0.016]);
    h.loop.stop();
    expect(h.isQueued()).toBe(false);
  });

  it("ignores a second start", () => {
    const h = harness([0.016, 0.016]);
    h.loop.start();
    expect(h.steps.length).toBe(2);
  });
});
```

- [ ] **Step 2: Написать падающий тест для состояния и HUD**

`src/game/state.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import { parseMap } from "./map.js";
import { createGameState, createHudBinding } from "./state.js";

const parsed = parseMap([
  "#####",
  "#.E.#",
  "#.P.#",
  "#.E.#",
  "#####",
]);

describe("createGameState", () => {
  it("starts the player where the map says", () => {
    const s = createGameState(parsed);
    expect(s.player.x).toBe(2.5);
    expect(s.player.y).toBe(2.5);
  });

  it("spawns one enemy per marker", () => {
    const s = createGameState(parsed);
    expect(s.enemies.length).toBe(2);
    expect(s.enemies.every((e) => e.hp > 0)).toBe(true);
  });

  it("starts loaded and unhurt", () => {
    const s = createGameState(parsed);
    expect(s.hp).toBe(100);
    expect(s.kills).toBe(0);
    expect(s.phase).toBe("menu");
  });

  it("gives every reset a fresh enemy list", () => {
    const s = createGameState(parsed);
    s.enemies[0].hp = 0;
    s.reset();
    expect(s.enemies.every((e) => e.hp > 0)).toBe(true);
    expect(s.phase).toBe("play");
  });

  it("does not share enemy objects between resets", () => {
    const s = createGameState(parsed);
    const first = s.enemies[0];
    s.reset();
    expect(s.enemies[0]).not.toBe(first);
  });
});

describe("createHudBinding", () => {
  const makeElements = () => ({
    hp: { textContent: "" },
    ammo: { textContent: "" },
    kills: { textContent: "" },
  });

  it("writes every field on the first sync", () => {
    const el = makeElements();
    createHudBinding(el).sync({ hp: "HP 100", ammo: "AMMO 8/40", kills: "KILLS 0" });
    expect(el.hp.textContent).toBe("HP 100");
    expect(el.ammo.textContent).toBe("AMMO 8/40");
    expect(el.kills.textContent).toBe("KILLS 0");
  });

  it("does not touch the DOM when nothing changed", () => {
    const el = makeElements();
    const binding = createHudBinding(el);
    const values = { hp: "HP 100", ammo: "AMMO 8/40", kills: "KILLS 0" };
    binding.sync(values);
    const spy = vi.fn();
    Object.defineProperty(el.hp, "textContent", { set: spy, get: () => "HP 100" });
    binding.sync(values);
    expect(spy).not.toHaveBeenCalled();
  });

  it("writes only the field that changed", () => {
    const el = makeElements();
    const binding = createHudBinding(el);
    binding.sync({ hp: "HP 100", ammo: "AMMO 8/40", kills: "KILLS 0" });
    binding.sync({ hp: "HP 90", ammo: "AMMO 8/40", kills: "KILLS 0" });
    expect(el.hp.textContent).toBe("HP 90");
    expect(el.ammo.textContent).toBe("AMMO 8/40");
  });
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npm test src/core/loop.test.js src/game/state.test.js`
Expected: FAIL — оба модуля не найдены.

- [ ] **Step 4: Реализовать `src/core/loop.js`**

```js
/**
 * The frame clock. `now` and `schedule` are injected so the timing rules can
 * be tested without a browser.
 *
 * A frame is clamped: coming back to a backgrounded tab must not hand the
 * simulation a five-second step and teleport everyone through a wall.
 */
export function createLoop({
  update,
  render,
  maxStep = 0.05,
  now = () => performance.now(),
  schedule = (cb) => requestAnimationFrame(cb),
  cancel = (handle) => cancelAnimationFrame(handle),
}) {
  let handle = 0;
  let running = false;
  let last = 0;

  function frame(timestamp) {
    if (!running) return;
    const seconds = (timestamp - last) / 1000;
    last = timestamp;
    const dt = Math.max(0, Math.min(maxStep, seconds));
    update(dt);
    render(dt);
    handle = schedule(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = now();
      handle = schedule(frame);
    },
    stop() {
      running = false;
      cancel(handle);
    },
  };
}
```

- [ ] **Step 5: Реализовать `src/game/state.js`**

```js
const START_HP = 100;
const START_MAG = 8;
const START_RESERVE = 40;
const ENEMY_HP = 2;

/**
 * All mutable match state in one place, so `main.js` can go back to being
 * wiring instead of a pile of module-level variables.
 */
export function createGameState(parsed) {
  const state = {
    player: { x: 0, y: 0, a: 0 },
    enemies: [],
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
    weapon: "gun",
    phase: "menu",
    reset() {
      state.player = {
        x: parsed.playerStart.x,
        y: parsed.playerStart.y,
        a: parsed.playerStart.angle,
      };
      // Fresh objects every time: reusing them would carry damage across.
      state.enemies = parsed.enemySpawns.map((s) => ({
        x: s.x,
        y: s.y,
        hp: ENEMY_HP,
        hit: 0,
      }));
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
      state.weapon = "gun";
      state.phase = "play";
    },
  };

  state.player = {
    x: parsed.playerStart.x,
    y: parsed.playerStart.y,
    a: parsed.playerStart.angle,
  };
  state.enemies = parsed.enemySpawns.map((s) => ({
    x: s.x,
    y: s.y,
    hp: ENEMY_HP,
    hit: 0,
  }));

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
```

- [ ] **Step 6: Убедиться, что тесты проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Подключить в `main.js`**

Заменить блок глобальных переменных (`src/main.js:64-76` в исходной нумерации) на состояние из модуля:

```js
import { createLoop } from "./core/loop.js";
import { createGameState, createHudBinding } from "./game/state.js";

const state = createGameState(parsed);
const hud = createHudBinding({ hp: hpEl, ammo: ammoEl, kills: killEl });
```

Все обращения к `player`, `enemies`, `hp`, `mag`, `reserve`, `reloading`, `kills`, `cooldown`, `hurt`, `iframes`, `swing`, `weapon`, `phase`, `lightBoost` переводятся на `state.*`. Локальная функция `reset()` заменяется на

```js
function reset() {
  state.reset();
  overlay.classList.add("hidden");
  syncHud();
}
```

`syncHud` собирает строки и отдаёт их привязке:

```js
function syncHud() {
  hud.sync({
    hp: `HP ${Math.max(0, Math.ceil(state.hp))}`,
    ammo: state.weapon === "stick"
      ? (state.swing > 0 ? "SWING" : "STICK")
      : (state.reloading > 0 ? "RELOAD" : `AMMO ${state.mag}/${state.reserve}`),
    kills: `KILLS ${state.kills}`,
  });
}
```

Заменить хвост файла (`src/main.js:548-550` в исходной нумерации) на цикл из модуля:

```js
resize();
window.addEventListener("resize", resize);
createLoop({ update, render: draw }).start();
```

Убрать функцию `loop` и переменную `last`: их работу делает `createLoop`.

Починить восстановление текста оверлея. Сейчас `die()` переписывает `h1` и второй `<p>` (`src/main.js:285-288`), а `reset()` их не возвращает, поэтому меню навсегда остаётся надписью «YOU DIED». Сохранить исходный текст при загрузке и восстанавливать в `reset()`:

```js
const overlayTitle = overlay.querySelector("h1");
const overlaySub = overlay.querySelector("p:nth-of-type(2)");
const MENU_TITLE = overlayTitle.textContent;
const MENU_SUB = overlaySub.textContent;
```

и в `reset()` перед скрытием оверлея:

```js
  overlayTitle.textContent = MENU_TITLE;
  overlaySub.textContent = MENU_SUB;
  playBtn.textContent = "DESCEND";
```

- [ ] **Step 8: Обновить README**

Добавить в конец `README.md`:

```markdown
## Development

```bash
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # production build into dist/
```

The renderer draws into a 480-pixel-wide buffer and scales it up, so the
game looks the same on every display. All art is generated from a seed at
startup; there are no asset files.
```

- [ ] **Step 9: Проверить в браузере**

Run: `npm run dev`
Expected: игра ведёт себя как прежде; после смерти и рестарта заголовок оверлея снова показывает меню, а не «YOU DIED».

- [ ] **Step 10: Проверить, что ничего не сломано**

Run: `npm test && npm run build`
Expected: обе команды успешны.

- [ ] **Step 11: Commit**

```bash
git add src/core/loop.js src/core/loop.test.js \
  src/game/state.js src/game/state.test.js src/main.js README.md
git commit -m "refactor: extract the loop, match state and hud binding"
```

---

## Готовность фазы

Фаза 1 закончена, когда всё перечисленное верно:

- [ ] `npm test` зелёный, `npm run build` проходит.
- [ ] Поиск `doom|rip and tear` вне `docs/` не даёт совпадений.
- [ ] Стены, пол и потолок текстурированы и темнеют с расстоянием.
- [ ] Враг, прижатый к стене у края экрана, не смещается относительно неё при повороте камеры.
- [ ] Клик захватывает курсор, мышь поворачивает камеру без перетаскивания.
- [ ] Скорость передвижения на телефоне и на десктопе одинакова.
- [ ] `src/main.js` не содержит ни внутренностей рендера, ни разбора событий ввода — только сборку модулей и правила игры. Ориентир: короче 340 строк против исходных 550.
- [ ] После смерти и рестарта оверлей снова показывает текст меню.

Не закрываются в этой фазе и переходят дальше: D4 и D9 — в фазу 2, D5 и D6 — в фазу 3, D11 — в фазу 4.
