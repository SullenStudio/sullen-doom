import { ACCENT, RAMP } from "../render/palette.js";
import { bitmapFromRows } from "../render/blit.js";

const L = {
  h: RAMP.flesh + 2, // hands
  H: RAMP.flesh + 4,
  r: RAMP.rust + 1,
  c: RAMP.concrete + 1,
  C: RAMP.concrete + 3,
  w: RAMP.bone + 1,
  W: RAMP.bone + 3,
  k: RAMP.rust + 0,
  g: ACCENT.gold,
  G: ACCENT.goldLight,
  m: RAMP.concrete + 0,
};

const PISTOL_ROWS = [
  ".......mm.......",
  "......mCCm......",
  ".....mCCCCm.....",
  "....ccCCCCcc....",
  "...ccCCCCCCcc...",
  "...cCCccccCCc...",
  "..hhCCccccCChh..",
  ".hHhhcccccchHhh.",
  ".hHHhhhhhhhhHHh.",
  "..hHhhhhhhhHh..",
];

const SHOTGUN_ROWS = [
  "....mmmmmmmm....",
  "...mCCCCCCCCm...",
  "..wCCCCCCCCCCw..",
  ".wwCCCCCCCCCCww.",
  ".wCCCrrrrrrCCCw.",
  "hhCCCrrrrrrCCChh",
  "hHhhCCCCCCCChhHh",
  ".hHHhhhhhhhhHHh.",
  "..hHhhhhhhhhHh..",
];

const CHAINGUN_ROWS = [
  "...mm....mm...",
  "..mCCm..mCCm..",
  "..mCCmmmmCCm..",
  ".ccCCCCCCCCCc.",
  ".cCCCCCCCCCCc.",
  "hhCCCCCCCCCChh",
  "hHhhkkkkkkhhHh",
  ".hHHhhhhhhHHh.",
  "..hHhhhhhhHh..",
];

const PIPE_ROWS = [
  "....WW....",
  "...WccW...",
  "...WccW...",
  "...rCCr...",
  "...rCCr...",
  "...rCCr...",
  "...rCCr...",
  "...rCCr...",
  "..hhCChh..",
  ".hHhhhhHh.",
  "..hHhhHh..",
];

const FLASH_ROWS = [
  "...gGGg...",
  "..gGGGGG..",
  "...GGGG...",
];

export const VIEWMODELS = {
  pistol: bitmapFromRows(PISTOL_ROWS, L),
  shotgun: bitmapFromRows(SHOTGUN_ROWS, L),
  chaingun: bitmapFromRows(CHAINGUN_ROWS, L),
  pipe: bitmapFromRows(PIPE_ROWS, L),
};

export const MUZZLE_FLASH = bitmapFromRows(FLASH_ROWS, L);
