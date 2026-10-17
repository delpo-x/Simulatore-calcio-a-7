// Audio sintetizzato con Web Audio (nessun file esterno): pubblico, fischio dell'arbitro, calci, esultanza, "ooh".

const KEY = 'calcio7.audio';

export class MatchAudio {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem(KEY) === 'off'; } catch { this.muted = false; }
  }

  /** Da chiamare in risposta a un gesto dell'utente (i browser bloccano l'audio prima). */
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(c.destination);
      this.noise = this.noiseBuffer(3);
      // pubblico: due strati di rumore filtrato, il volume segue l'intensita' dell'azione
      this.crowd = c.createGain(); this.crowd.gain.value = 0; this.crowd.connect(this.master);
      for (const [type, f, q, g] of [['bandpass', 520, 0.7, 1], ['lowpass', 900, 0.5, 0.6]]) {
        const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = Math.random();
        const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const gn = c.createGain(); gn.gain.value = g; s.connect(fl).connect(gn).connect(this.crowd); s.start();
        if (type === 'bandpass') this.crowdFilter = fl;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  noiseBuffer(secs) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { last = 0.97 * last + 0.03 * (Math.random() * 2 - 1); d[i] = last * 6; } // rumore scuro
    return b;
  }

  get on() { return !!this.ctx && !this.muted; }

  setMuted(m) {
    this.muted = m; try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch { /* niente */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  /** Intensita' del pubblico 0..1 (0 = silenzio, per pausa e menu). */
  setCrowd(x) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.crowd.gain.setTargetAtTime(x <= 0 ? 0 : 0.05 + 0.13 * x, t, 0.6);
    this.crowdFilter.frequency.setTargetAtTime(450 + 450 * x, t, 0.6);
  }

  suspend() { this.ctx?.suspend(); }

  /** Fischio: blasts = numero di colpi, len = durata di ciascuno (s). */
  whistle(blasts = 1, len = 0.28) {
    if (!this.on) return;
    const c = this.ctx; let t = c.currentTime + 0.02;
    for (let i = 0; i < blasts; i++) {
      const o = c.createOscillator(), o2 = c.createOscillator(), trill = c.createOscillator(), tg = c.createGain(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 2950; o2.type = 'sine'; o2.frequency.value = 3010;
      trill.frequency.value = 28; tg.gain.value = 0.35; trill.connect(tg).connect(g.gain); // la pallina dentro il fischietto
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.02); g.gain.setValueAtTime(0.13, t + len - 0.04); g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g); o2.connect(g); g.connect(this.master);
      for (const x of [o, o2, trill]) { x.start(t); x.stop(t + len + 0.02); }
      t += len + 0.12;
    }
  }

  /** Calcio al pallone: tonfo breve, piu' forte con la velocita'. */
  kick(speed) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), v = Math.min(1, speed / 30);
    o.frequency.setValueAtTime(140 + 60 * v, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    g.gain.setValueAtTime(0.12 + 0.25 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.12);
  }

  /** Ondata del pubblico: gol (lunga e forte) o occasione mancata ("ooh", breve). */
  roar(kind = 'goal') {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime, goal = kind === 'goal';
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = goal ? 0.6 : 2.2;
    f.frequency.setValueAtTime(goal ? 500 : 420, t); f.frequency.linearRampToValueAtTime(goal ? 900 : 650, t + (goal ? 1.2 : 0.5)); if (!goal) f.frequency.linearRampToValueAtTime(380, t + 1.1);
    const g = c.createGain(), peak = goal ? 0.75 : 0.32, hold = goal ? 3 : 0.5, rel = goal ? 2.5 : 0.7;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + (goal ? 0.35 : 0.25)); g.gain.setValueAtTime(peak, t + hold); g.gain.linearRampToValueAtTime(0, t + hold + rel);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + hold + rel + 0.1);
  }
}
