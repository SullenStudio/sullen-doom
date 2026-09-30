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
    onPrevWeapon,
    onNextWeapon,
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
    if (e.code === "KeyQ") onPrevWeapon();
    if (e.code === "KeyE") onNextWeapon();
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
