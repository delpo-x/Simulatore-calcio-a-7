// Keyboard/gamepad/touch -> PSP-style button bitmask, per player (up to 4).
export const BUTTONS = ['up', 'down', 'left', 'right', 'cross', 'circle', 'square', 'triangle', 'l', 'r', 'select', 'start'];
const bit = Object.fromEntries(BUTTONS.map((b, i) => [b, 1 << i]));
const KEY = 'shell-keymap';

const DEFAULT_KEYS = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  cross: 'KeyX', circle: 'KeyC', square: 'KeyZ', triangle: 'KeyS',
  l: 'KeyQ', r: 'KeyW', select: 'ShiftRight', start: 'Enter',
};
// Standard gamepad layout indices.
const PAD = { cross: 0, circle: 1, square: 2, triangle: 3, l: 4, r: 5, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = [0, 0, 0, 0];
    this.maps = this.#load();
    addEventListener('keydown', e => { if (!e.target.matches?.('input,textarea,select')) { this.keys.add(e.code); if (this.#bound(e.code)) e.preventDefault(); } });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.listening = null;
  }

  #bound(code) { return this.maps.some(m => Object.values(m).includes(code)); }

  #load() {
    try { const m = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(m) && m.length === 4) return m; } catch {}
    return [{ ...DEFAULT_KEYS }, {}, {}, {}];
  }
  persist() { try { localStorage.setItem(KEY, JSON.stringify(this.maps)); } catch {} }
  autoConfigure(player) { this.maps[player] = player === 0 ? { ...DEFAULT_KEYS } : {}; this.persist(); }
  exportMaps() { return JSON.stringify(this.maps, null, 2); }
  importMaps(text) {
    const m = JSON.parse(text);
    if (!Array.isArray(m) || m.length !== 4 || m.some(x => typeof x !== 'object' || !x)) throw new Error('bad mapping file');
    this.maps = m; this.persist();
  }

  setTouch(player, button, down) {
    this.touch[player] = down ? this.touch[player] | bit[button] : this.touch[player] & ~bit[button];
  }

  /** Bitmask for player p. Player 0 also reads first gamepad when it exists; player n reads pad n. */
  state(p) {
    let s = this.touch[p];
    const map = this.maps[p];
    for (const b of BUTTONS) if (map[b] && this.keys.has(map[b])) s |= bit[b];
    const pad = navigator.getGamepads?.()[p];
    if (pad) {
      for (const b of BUTTONS) if (pad.buttons[PAD[b]]?.pressed) s |= bit[b];
      if (pad.axes[0] < -0.5) s |= bit.left; if (pad.axes[0] > 0.5) s |= bit.right;
      if (pad.axes[1] < -0.5) s |= bit.up; if (pad.axes[1] > 0.5) s |= bit.down;
    }
    return s;
  }
}
export { bit };
