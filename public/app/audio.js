// SoundEngine: audio sintetizzato con Web Audio (nessun file esterno): pubblico, fischio dell'arbitro, calci, pali, rete, esultanza, "ooh".

const KEY = 'calcio7.audio';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class SoundEngine {
  constructor() {
    this.ctx = null; this.level = 0; this.boost = 0; this.boostT = 0; this.boostLen = 1;
    try { this.muted = localStorage.getItem(KEY) === 'off'; } catch { this.muted = false; }
  }

  /** Da chiamare in risposta a un gesto dell'utente (i browser bloccano l'audio prima). */
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.003; lim.release.value = 0.2; // limitatore: boato, fischio e calci insieme non saturano
      this.master.connect(lim).connect(c.destination);
      this.noise = this.pinkNoise(4);
      // pubblico: due strati di rumore rosa filtrato, il volume segue l'intensita' dell'azione e un lento respiro lo rende vivo
      this.crowd = c.createGain(); this.crowd.gain.value = 0; this.crowd.connect(this.master);
      for (const [type, f, q, g] of [['bandpass', 520, 0.7, 1], ['lowpass', 900, 0.5, 0.6]]) {
        const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = Math.random();
        const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const gn = c.createGain(); gn.gain.value = g; s.connect(fl).connect(gn).connect(this.crowd); s.start();
        if (type === 'bandpass') this.crowdFilter = fl;
      }
      const lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = 0.27; depth.gain.value = 0.012; lfo.connect(depth).connect(this.crowd.gain); lfo.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Rumore rosa (filtro di Paul Kellet): piu' naturale del bianco per un pubblico lontano. */
  pinkNoise(secs) {
    const c = this.ctx, n = Math.round(c.sampleRate * secs), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.17; b6 = w * 0.115926;
    }
    return b;
  }

  /** Raffica di rumore filtrato che decade: base di schiocchi, urti e fruscii. */
  burst(t, type, freq, q, peak, len) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 2); s.stop(t + len + 0.02);
  }

  get on() { return !!this.ctx && !this.muted; }

  setMuted(m) {
    this.muted = m; try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch { /* niente */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  /** Intensita' del pubblico 0..1 (0 = silenzio, per pausa e menu); un'ondata (swell) vi si somma e decade. */
  setCrowd(x) {
    this.level = x; if (!this.ctx) return;
    const t = this.ctx.currentTime, k = this.boost ? clamp(1 - (t - this.boostT) / this.boostLen, 0, 1) : 0, y = clamp(x + k * this.boost, 0, 1.6);
    this.crowd.gain.setTargetAtTime(x <= 0 ? 0 : 0.05 + 0.13 * y, t, k > 0.5 ? 0.2 : 0.6);
    this.crowdFilter.frequency.setTargetAtTime(450 + 450 * y, t, k > 0.5 ? 0.2 : 0.6); // il filtro si apre: piu' acuti, piu' presenza
  }

  /** Ondata del pubblico: sale in fretta e rientra in `secs` secondi (gol, occasione pericolosa). */
  swell(amount = 1, secs = 5) {
    if (!this.ctx) return;
    this.boost = amount; this.boostT = this.ctx.currentTime; this.boostLen = secs; this.setCrowd(this.level);
  }

  suspend() { this.ctx?.suspend(); }

  /** Fischio: blasts = numero di colpi, len = durata di ciascuno (s). Singolo a inizio e falli, doppio a fine primo tempo, triplo a fine partita. */
  whistle(blasts = 1, len = 0.28) {
    if (!this.on) return;
    const c = this.ctx; let t = c.currentTime + 0.02;
    for (let i = 0; i < blasts; i++) {
      const base = 2850 + Math.random() * 250, o = c.createOscillator(), o2 = c.createOscillator(), trill = c.createOscillator(), tg = c.createGain(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = base; o2.type = 'sine'; o2.frequency.value = base + 60;
      trill.frequency.value = 26 + Math.random() * 6; tg.gain.value = 0.35; trill.connect(tg).connect(g.gain); // la pallina dentro il fischietto
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.02); g.gain.setValueAtTime(0.13, t + len - 0.04); g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g); o2.connect(g); g.connect(this.master);
      for (const x of [o, o2, trill]) { x.start(t); x.stop(t + len + 0.02); }
      t += len + 0.12;
    }
  }

  /** Calcio al pallone: tonfo con il tono che scende da 150 a 40 Hz e schiocco del cuoio; volume e brillantezza crescono con la velocita'. */
  kick(speed) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), v = clamp(speed / 30, 0, 1);
    o.frequency.setValueAtTime(150 + 40 * v, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(0.1 + 0.28 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.13);
    this.burst(t, 'bandpass', 900 + 1800 * v, 0.9, 0.03 + 0.2 * v, 0.04 + 0.03 * v);
  }

  /** Palo o traversa: tubo d'acciaio che suona con parziali inarmonici (1, 2,76, 5,4, 8,93) e un colpo secco; power 0..1. */
  clang(power = 0.7, bar = false) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime, v = clamp(power, 0.2, 1), base = bar ? 430 : 560;
    for (const [r, a, d] of [[1, 1, 0.9], [2.76, 0.7, 0.55], [5.4, 0.45, 0.32], [8.93, 0.3, 0.18]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = base * r * (1 + (Math.random() - 0.5) * 0.012);
      g.gain.setValueAtTime(0.16 * v * a, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + d + 0.02);
    }
    this.burst(t, 'highpass', 2200, 0.7, 0.2 * v, 0.035);
  }

  /** Doppio tocco rapido della finta: due colpetti smorzati a ~90 ms. */
  touch() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    for (const [d, f] of [[0, 1300], [0.09, 1050]]) this.burst(t + d, 'bandpass', f, 1.2, 0.07, 0.03);
  }

  /** Fruscio continuo della pioggia (rumore filtrato in loop): 'rain' leggero, 'storm' forte, altro = silenzio. */
  weather(kind) {
    if (!this.ctx) return;
    const c = this.ctx, lvl = kind === 'storm' ? 0.16 : kind === 'rain' ? 0.08 : 0;
    if (!this.rainG && lvl) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = this.noise; s.loop = true; f.type = 'highpass'; f.frequency.value = 1400; f.Q.value = 0.4;
      this.rainG = c.createGain(); this.rainG.gain.value = 0; s.connect(f).connect(this.rainG).connect(this.master); s.start();
    }
    this.rainG?.gain.setTargetAtTime(lvl, c.currentTime, 0.8);
  }

  /** Tuono lontano: rombo basso che arriva poco dopo il lampo e rotola per qualche secondo. */
  thunder() {
    if (!this.on) return;
    const t = this.ctx.currentTime + 0.4 + Math.random() * 0.8;
    this.burst(t, 'lowpass', 160, 0.7, 0.55, 3.2); this.burst(t + 0.25, 'lowpass', 90, 0.6, 0.4, 2.6);
  }

  /** Palla in rete: fruscio breve della rete che si gonfia. */
  net(power = 0.7) {
    if (!this.on) return;
    const t = this.ctx.currentTime, v = clamp(power, 0.2, 1);
    this.burst(t, 'highpass', 1800, 0.5, 0.05 + 0.12 * v, 0.3);
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
