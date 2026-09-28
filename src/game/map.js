// A level is authored as an array of equal-length strings so it can be read
// and edited by eye. Digits 1-5 pick a wall texture; '#' is shorthand for
// the first one.

const WALL_DIGITS = "12345";
const PLAYER_MARK = "P";
const ENEMY_MARK = "E";
const EXIT_MARK = "X";

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
    isExitAt(x, y) {
      return at(Math.floor(x), Math.floor(y)) === EXIT_MARK;
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
  const exits = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = lines[y][x];
      if (isWallChar(ch)) continue;
      if (!fallback) fallback = { x: x + 0.5, y: y + 0.5, angle: 0 };
      if (ch === PLAYER_MARK) playerStart = { x: x + 0.5, y: y + 0.5, angle: 0 };
      if (ch === ENEMY_MARK) enemySpawns.push({ x: x + 0.5, y: y + 0.5 });
      if (ch === EXIT_MARK) exits.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  if (!playerStart) playerStart = fallback;
  if (!playerStart) throw new Error("map has no open cell to start in");

  return { map, playerStart, enemySpawns, exits };
}
