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
