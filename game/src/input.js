// Neon Bay Heat — keyboard and mouse. WASD/arrows move and drive, the mouse drags
// the camera, E gets in and out of cars, F punches, click shoots, Space is the
// handbrake, P/Esc pauses, M mutes. One-shot presses are queued as flags so the loop
// never misses or double-counts one.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MUTE = 32;
export const ACTION_SHOOT = 64;
export const ACTION_GARAGE = 128; // G: repaint at Marco's Garage ($50)
export const ACTION_TUNING = 256; // T: open the tuning menu at Marco's Garage
export const ACTION_NITRO = 512; // N: burn a nitro charge while driving

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseDX = 0;
  let mouseDY = 0;
  let wheel = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyG') actions |= ACTION_GARAGE;
    else if (event.code === 'KeyT') actions |= ACTION_TUNING;
    else if (event.code === 'KeyN') actions |= ACTION_NITRO;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    mouseDX += event.movementX;
    mouseDY += event.movementY;
  });
  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('click', () => {
    actions |= ACTION_SHOOT; // click fires the pistol; F is the punch
  });
  canvas.addEventListener('wheel', (event) => {
    wheel += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  function any(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    // -1..1 steering, -1..1 throttle (negative = brake/reverse), run held, brake held.
    drive() {
      return {
        steer: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0),
        throttle: (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0),
        run: any(RUN),
        brake: any(BRAKE),
      };
    },
    // On foot: forward/back and strafe, relative to the camera.
    move() {
      return {
        forward: (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0),
        strafe: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0),
        run: any(RUN),
      };
    },
    takeMouseDelta() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    takeWheel() {
      const w = wheel;
      wheel = 0;
      return w;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    isDown(code) {
      return keys.has(code);
    },
  };
}
