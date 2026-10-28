import * as THREE from '../../vendor/three.module.min.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let ANISO = 8; // anisotropia massima della scheda, impostata alla creazione del renderer
export function setAnisotropy(v) { ANISO = v; }
export function tex(c, { repeat, linear } = {}) {
  const t = new THREE.CanvasTexture(c); if (!linear) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
