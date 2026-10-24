// Core contract. A real core is an ES module whose default export is a class with:
//   constructor(host)  host = { canvas, settings, input, online, files, log, commentary }
//   async start()      begin emulation/rendering
//   stop()
// The shell never bundles a game. DemoCore below exercises input, saves and online relay.
export class DemoCore {
  constructor(host) {
    this.h = host;
    this.pos = [[60, 60], [420, 60], [60, 210], [420, 210]];
    this.raf = 0;
    this.onPacket = e => {
      const { from, data } = e.detail;
      if (data.length >= 4) { const v = new DataView(data.buffer, data.byteOffset, data.byteLength); this.pos[from] = [v.getInt16(0), v.getInt16(2)]; }
    };
  }

  async start() {
    const { canvas, input, online, log } = this.h;
    const ctx = canvas.getContext('2d');
    online.addEventListener('packet', this.onPacket);
    log(`demo core started (commentary=${this.h.commentary}, renderer=${this.h.settings.renderer})`);
    const minGap = 1000 / Number(this.h.settings.fps);
    let last = 0;
    const frame = t => {
      this.raf = requestAnimationFrame(frame);
      if (t - last < minGap - 1) return;
      last = t;
      const me = Math.max(0, online.slot);
      const s = input.state(0);
      const p = this.pos[me];
      p[0] = Math.max(8, Math.min(472, p[0] + ((s & 8 ? 1 : 0) - (s & 4 ? 1 : 0)) * 3));
      p[1] = Math.max(8, Math.min(264, p[1] + ((s & 2 ? 1 : 0) - (s & 1 ? 1 : 0)) * 3));
      const pkt = new DataView(new ArrayBuffer(4)); pkt.setInt16(0, p[0]); pkt.setInt16(2, p[1]);
      online.send(pkt.buffer);

      ctx.fillStyle = '#0c3a1a'; ctx.fillRect(0, 0, 480, 272);
      ctx.strokeStyle = '#fff6'; ctx.strokeRect(4, 4, 472, 264);
      this.pos.forEach(([x, y], i) => {
        ctx.fillStyle = ['#e33', '#3ae', '#ee3', '#e3e'][i];
        ctx.beginPath(); ctx.arc(x, y, i === me ? 9 : 7, 0, 7); ctx.fill();
      });
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
      ctx.fillText(`demo core · slot ${me} · buttons 0x${s.toString(16)}`, 10, 16);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.h.online.removeEventListener('packet', this.onPacket);
  }
}
