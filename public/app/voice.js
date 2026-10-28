// Telecronaca parlata: legge con la sintesi vocale del browser (voce italiana) le frasi della cronaca e gli episodi chiave.
// Nessun file audio; se il browser non ha voci italiane resta in silenzio. Una frase alla volta: le meno importanti si scartano.

const RANK = { low: 0, mid: 1, high: 2, top: 3 };

export class Voice {
  constructor() {
    this.ss = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null; this.voice = null; this.busy = -1; this.on = true;
    if (!this.ss) return;
    const choose = () => { // preferenza alle voci neurali (Edge: "Online (Natural)"), poi a qualunque voce it-*
      const it = this.ss.getVoices().filter(v => /^it[-_]/i.test(v.lang));
      this.voice = it.find(v => /natural|online|neural/i.test(v.name)) ?? it.find(v => /google/i.test(v.name)) ?? it[0] ?? null;
    };
    choose(); this.ss.addEventListener?.('voiceschanged', choose);
  }

  get ready() { return !!this.ss && !!this.voice && this.on; }

  /** prio: low/mid/high/top. Una frase 'top' (gol) interrompe tutto; le altre parlano solo se la voce e' libera o se sono piu' importanti. */
  say(text, prio = 'low') {
    if (!this.ready || !text) return;
    const r = RANK[prio] ?? 0, speaking = this.ss.speaking || this.ss.pending;
    if (speaking && r <= this.busy && r < 3) return;
    if (speaking) this.ss.cancel();
    const u = new SpeechSynthesisUtterance(text); u.voice = this.voice; u.lang = this.voice.lang;
    u.rate = r >= 3 ? 1.18 : 1.08; u.pitch = r >= 3 ? 1.15 : 1; u.volume = 1;
    u.onend = u.onerror = () => { this.busy = -1; };
    this.busy = r; this.ss.speak(u);
  }

  stop() { this.ss?.cancel(); this.busy = -1; }
}
