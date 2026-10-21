// Registrazione degli ultimi secondi di gioco e replay dei gol.

const FPS = 30, KEEP = 12; // fotogrammi al secondo registrati, secondi tenuti in memoria

function snapshot(sim) {
  return {
    t: sim.matchTime,
    players: sim.players.map(p => ({ id: p.id, team: p.team, gk: p.gk, x: p.x, z: p.z, face: p.face, vx: p.vx, vz: p.vz, tackleT: p.tackleT, throwT: p.throwT, pickT: p.pickT, dribT: p.dribT, dribDir: p.dribDir, stun: p.stun, out: p.out })),
    ball: { x: sim.ball.x, y: sim.ball.y, z: sim.ball.z, vx: sim.ball.vx, vy: sim.ball.vy, vz: sim.ball.vz, owner: sim.ball.owner },
  };
}

const lerp = (a, b, k) => a + (b - a) * k;
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export class Recorder {
  constructor() { this.buf = []; this.n = 0; this.pending = []; this.clips = []; }

  /** Da chiamare a ogni passo della simulazione (60 al secondo). */
  step(sim, newItems) {
    if (this.n++ % (60 / FPS) === 0) { this.buf.push(snapshot(sim)); if (this.buf.length > KEEP * FPS) this.buf.shift(); }
    for (const it of newItems) if (it.t === 'goal') this.pending.push({ item: it, left: 2 * FPS }); // tiene anche 2 s dopo il gol
    for (const p of this.pending) if (--p.left <= 0 && !p.done) {
      p.done = true; const clip = { item: p.item, frames: this.buf.slice(-10 * FPS) };
      this.clips.push(clip); this.onClip?.(clip);
    }
    this.pending = this.pending.filter(p => !p.done);
  }
}

/** Riproduce una clip: frame(dt) restituisce una vista { players, ball } interpolata, o null alla fine. */
export class Player {
  constructor(clip, speed = 0.6) { this.clip = clip; this.i = 0; this.speed = speed; }
  get progress() { return this.i / Math.max(1, this.clip.frames.length - 1); }
  frame(dt) {
    const f = this.clip.frames; if (!f.length) return null;
    this.i += dt * FPS * this.speed;
    if (this.i >= f.length - 1) return null;
    const a = f[Math.floor(this.i)], b = f[Math.floor(this.i) + 1], k = this.i % 1;
    return {
      t: lerp(a.t, b.t, k),
      players: a.players.map((p, j) => { const q = b.players[j]; return { ...p, x: lerp(p.x, q.x, k), z: lerp(p.z, q.z, k), face: lerpAngle(p.face, q.face, k), vx: lerp(p.vx, q.vx, k) * this.speed, vz: lerp(p.vz, q.vz, k) * this.speed }; }),
      ball: { ...a.ball, x: lerp(a.ball.x, b.ball.x, k), y: lerp(a.ball.y, b.ball.y, k), z: lerp(a.ball.z, b.ball.z, k), vx: a.ball.vx * this.speed, vz: a.ball.vz * this.speed },
    };
  }
}
