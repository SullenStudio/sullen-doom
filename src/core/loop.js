/**
 * The frame clock. `now`, `schedule` and `cancel` are injected so the timing
 * rules can be tested without a browser.
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
