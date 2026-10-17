// Statistiche e cronaca di una partita, raccolte dagli eventi della simulazione.

const pair = () => [0, 0];

export class MatchStats {
  constructor(sim) {
    this.sim = sim;
    this.s = { shots: pair(), onTarget: pair(), passOk: pair(), passLost: pair(), poss: pair(), fouls: pair(), yellow: pair(), blue: pair(), red: pair(), corners: pair(), offsides: pair() };
    this.timeline = [];
    const shoot = sim.shoot.bind(sim), s = this.s;
    sim.shoot = (p, ...a) => { // tiro in porta: la traiettoria (senza resistenza) entra tra i pali sotto la traversa (come tools/lib/matches.mjs)
      s.shots[p.team]++; const r = shoot(p, ...a), b = sim.ball, gx = sim.dir(p.team) * sim.pitch.hx, t = (gx - b.x) / (b.vx || 1e-9);
      let on = false;
      if (t > 0 && Math.abs(b.z + b.vz * t) < sim.pitch.goalHalf) { const y = b.y + b.vy * t - 4.9 * t * t; if (y > 0 && y < sim.pitch.goalH) { s.onTarget[p.team]++; on = true; } }
      this.onShot?.(p, on);
      return r;
    };
  }

  name(id) { const p = this.sim.players[id]; return p ? p.name ?? `Giocatore ${id + 1}` : ''; }

  push(e) { const t = this.sim.matchTime; this.timeline.push({ ...e, sec: t, min: Math.min(Math.floor(t / 60) + 1, Math.ceil(this.sim.halfLength * 2 / 60)) }); }

  /** Da chiamare dopo ogni passo della simulazione; restituisce le voci nuove della cronaca. */
  step() {
    const sim = this.sim, s = this.s, n = this.timeline.length;
    if (sim.state === 'play' && sim.ball.owner >= 0) s.poss[sim.players[sim.ball.owner].team]++;
    for (const e of sim.events) {
      if (e.t === 'passOk') s.passOk[e.team]++;
      else if (e.t === 'passLost') s.passLost[e.team]++;
      else if (e.t === 'goal') {
        const sc = sim.players[e.scorer], own = !!sc && sc.team !== e.team;
        this.push({ t: 'goal', team: e.team, player: e.scorer, own, score: [...sim.score] });
      } else if (e.t === 'foul') {
        s.fouls[e.team]++;
        if (e.kind === 'penalty') this.push({ t: 'penalty', team: e.victim, player: e.player });
        if (e.card) { s[e.card][e.team]++; this.push({ t: e.card, team: e.team, player: e.player, second: e.card === 'red' && sim.players[e.player]?.yellow >= 2 }); }
      } else if (e.t === 'protest') { s.blue[e.team]++; this.push({ t: 'blue', team: e.team, player: e.player, protest: true }); }
      else if (e.t === 'restart' && e.kind === 'corner') s.corners[e.team]++;
      else if (e.t === 'offside') { s.offsides[e.team]++; this.push({ t: 'offside', team: e.team, player: e.player }); }
      else if (e.t === 'half') this.push({ t: 'half', score: [...sim.score] });
      else if (e.t === 'full') this.push({ t: 'full', score: [...sim.score] });
    }
    return this.timeline.slice(n);
  }

  /** Righe per il pannello: [etichetta, valore squadra 0, valore squadra 1, formato]. */
  rows() {
    const s = this.s, tot = s.poss[0] + s.poss[1] || 1, acc = t => { const n = s.passOk[t] + s.passLost[t]; return n ? Math.round(100 * s.passOk[t] / n) : 0; };
    return [
      ['Possesso', Math.round(100 * s.poss[0] / tot), 100 - Math.round(100 * s.poss[0] / tot), '%'],
      ['Tiri', ...s.shots], ['Tiri in porta', ...s.onTarget],
      ['Passaggi riusciti', ...s.passOk], ['Precisione passaggi', acc(0), acc(1), '%'],
      ['Calci d\'angolo', ...s.corners], ['Falli', ...s.fouls], ['Fuorigioco', ...s.offsides],
      ['Ammonizioni', ...s.yellow], ['Azzurri', ...s.blue], ['Espulsioni', ...s.red],
    ];
  }
}
