// Telecronaca parlata. Se ci sono le clip registrate (assets/commentary, voce del telecronista senza nomi) legge quelle,
// scegliendo a caso tra le varianti di ogni frase; altrimenti usa la sintesi vocale del browser (voce italiana) sul testo completo.
// Una frase alla volta: le meno importanti si scartano, il gol interrompe tutto.

const RANK = { low: 0, mid: 1, high: 2, top: 3 };
const BASE = new URL('../assets/commentary/', import.meta.url);

export class Voice {
  constructor() {
    this.ss = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null; this.voice = null; this.busy = -1; this.on = true;
    this.bank = null; this.audio = null; this.queue = []; this.volume = 1;
    if (typeof fetch === 'function' && typeof Audio !== 'undefined') // indice {chiave: numero di varianti}
      fetch(new URL('index.json', BASE)).then(r => (r.ok ? r.json() : null)).then(j => { if (j && Object.keys(j).length) this.bank = j; }).catch(() => {});
    if (!this.ss) return;
    const choose = () => { // preferenza alle voci neurali (Edge: "Online (Natural)"), poi a qualunque voce it-*
      const it = this.ss.getVoices().filter(v => /^it[-_]/i.test(v.lang));
      this.voice = it.find(v => /natural|online|neural/i.test(v.name)) ?? it.find(v => /google/i.test(v.name)) ?? it[0] ?? null;
    };
    choose(); this.ss.addEventListener?.('voiceschanged', choose);
  }

  get ready() { return this.on && (!!this.bank || (!!this.ss && !!this.voice)); }
  get speaking() { return this.audio ? !this.audio.ended && !this.audio.paused : !!(this.ss && (this.ss.speaking || this.ss.pending)); }

  /** prio: low/mid/high/top; keys: clip da leggere in fila (es. ['goal', 'lead']). Con le clip caricate, una frase senza clip resta muta. */
  say(text, prio = 'low', keys = null) {
    if (!this.ready || !text) return;
    const r = RANK[prio] ?? 0;
    if (this.speaking && r <= this.busy && r < 3) return;
    if (this.bank) {
      const ks = (keys || []).filter(k => this.bank[k]);
      if (!ks.length) return;
      this.stop(); this.busy = r;
      this.queue = ks.map(k => new URL(`${k}_${(Math.random() * this.bank[k]) | 0}.ogg`, BASE).href); this.next(); return;
    }
    this.stop();
    const u = new SpeechSynthesisUtterance(text); u.voice = this.voice; u.lang = this.voice.lang;
    u.rate = r >= 3 ? 1.18 : 1.08; u.pitch = r >= 3 ? 1.15 : 1; u.volume = 1;
    u.onend = u.onerror = () => { this.busy = -1; };
    this.busy = r; this.ss.speak(u);
  }

  next() {
    const src = this.queue.shift();
    if (!src) { this.audio = null; this.busy = -1; return; }
    const a = this.audio = new Audio(src); a.volume = this.volume;
    a.onended = a.onerror = () => { if (this.audio === a) this.next(); };
    a.play().catch(() => { if (this.audio === a) { this.audio = null; this.busy = -1; } });
  }

  stop() {
    this.queue = []; if (this.audio) { const a = this.audio; this.audio = null; a.pause(); }
    this.ss?.cancel(); this.busy = -1;
  }
}
