// Preset di qualita' grafica e governatore del frame: misura il tempo per frame e regola la risoluzione interna per restare nel budget.

/**
 * dpr: tetto del pixel ratio; aa: antialiasing del canvas (solo alla creazione); shadow: lato della shadow map, soft: ombre morbide (PCFSoft);
 * precip: densita' di pioggia e neve; minScale: risoluzione minima della scala dinamica.
 */
export const QUALITY = {
  low: { name: 'Bassa', dpr: 1, aa: false, shadow: 1024, soft: false, precip: 0.35, minScale: 0.5 },
  medium: { name: 'Media', dpr: 1.25, aa: true, shadow: 1024, soft: true, precip: 0.6, minScale: 0.6 },
  high: { name: 'Alta', dpr: 1.5, aa: true, shadow: 2048, soft: true, precip: 1, minScale: 0.7 },
  ultra: { name: 'Ultra', dpr: 2, aa: true, shadow: 4096, soft: true, precip: 1.3, minScale: 0.8 },
};

/** Preset iniziale per 'auto': dalla GPU dichiarata e dai core, prudente (il governatore poi scende se serve). */
export function autoQuality() {
  try {
    const g = document.createElement('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'), gpu = (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '') || '';
    if (/RTX|RX [67]\d{3}|Apple M[2-9]|Radeon Pro/i.test(gpu)) return 'ultra';
    if (/GTX 1[06-9]|GTX 16|RX 5\d{3}|Apple M1|Iris Xe/i.test(gpu)) return 'high';
    if (/Intel|GT 10|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(gpu) || (navigator.hardwareConcurrency ?? 8) <= 4) return 'low';
  } catch { /* niente */ }
  return 'medium';
}

/**
 * Risoluzione dinamica: media esponenziale del tempo tra due frame; ogni mezzo secondo, oltre il budget scende del 10%, molto sotto risale del 5%.
 * I frame piu' lunghi di 100 ms (scheda nascosta, pausa del browser) non contano.
 */
export class FrameGovernor {
  constructor(minScale, budgetMs = 1000 / 60) { this.min = minScale; this.budget = budgetMs; this.scale = 1; this.ema = budgetMs; this.last = 0; this.acc = 0; this.frames = 0; this.fps = 60; this.fpsAcc = 0; this.on = true; }

  /** Da chiamare una volta per frame; restituisce true se la scala e' cambiata. */
  tick(now) {
    const ms = this.last ? now - this.last : this.budget; this.last = now;
    if (ms > 100) return false;
    this.ema += (ms - this.ema) * 0.1; this.acc += ms; this.frames++; this.fpsAcc += ms;
    if (this.fpsAcc >= 500) { this.fps = this.frames * 1000 / this.fpsAcc; this.frames = 0; this.fpsAcc = 0; }
    if (!this.on || this.acc < 500) return false;
    this.acc = 0;
    const was = this.scale;
    if (this.ema > this.budget * 1.12) this.scale = Math.max(this.min, this.scale - 0.1);
    else if (this.ema < this.budget * 0.8) this.scale = Math.min(1, this.scale + 0.05);
    return this.scale !== was;
  }
}
