// Statistiche e cronaca di una partita, raccolte dagli eventi della simulazione; statistiche per giocatore, tiri e voti.
// Osserva la simulazione (avvolge shoot, passTo, pass, giveBall) senza cambiarne l'esito.

const pair = () => [0, 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class MatchStats {
  constructor(sim) {
    this.sim = sim;
    this.s = { shots: pair(), onTarget: pair(), passOk: pair(), passLost: pair(), poss: pair(), fouls: pair(), yellow: pair(), blue: pair(), red: pair(), corners: pair(), offsides: pair(), saves: pair() };
    this.timeline = [];
    this.shotList = []; // { team, player, x, z, on, goal, min }
    this.ps = sim.players.map(() => ({ goals: 0, own: 0, assists: 0, shots: 0, onTarget: 0, passOk: 0, passLost: 0, recoveries: 0, saves: 0, conceded: 0, fouls: 0, yellow: 0, blue: 0, red: 0 }));
    this.lastPass = null; this.owner = sim.ball.owner; this.shotWait = null; this.dead = false;
    const s = this.s, ps = this.ps;
    const shoot = sim.shoot.bind(sim);
    sim.shoot = (p, ...a) => { // tiro in porta: la traiettoria (senza resistenza) entra tra i pali sotto la traversa (come tools/lib/matches.mjs)
      s.shots[p.team]++; ps[p.id].shots++; const x = p.x, z = p.z;
      const r = shoot(p, ...a), b = sim.ball, gx = sim.dir(p.team) * sim.pitch.hx, t = (gx - b.x) / (b.vx || 1e-9);
      let on = false;
      if (t > 0 && Math.abs(b.z + b.vz * t) < sim.pitch.goalHalf) { const y = b.y + b.vy * t - 4.9 * t * t; if (y > 0 && y < sim.pitch.goalH) { s.onTarget[p.team]++; ps[p.id].onTarget++; on = true; } }
      const shot = { team: p.team, player: p.id, x, z, on, goal: false, sec: sim.matchTime, min: this.minute() };
      this.shotList.push(shot); this.shotWait = on ? shot : null;
      this.onShot?.(p, on);
      return r;
    };
    const kick = sim.kick.bind(sim);
    sim.kick = (p, ...a) => { this.lastKick = { id: p.id, x: p.x, z: p.z, sec: sim.matchTime }; return kick(p, ...a); };
    for (const k of ['setPiece', 'resetPositions']) { // palla consegnata a chi batte: non e' un recupero
      const f = sim[k].bind(sim);
      sim[k] = (...a) => { this.dead = true; try { return f(...a); } finally { this.dead = false; } };
    }
    const give = sim.giveBall.bind(sim);
    sim.giveBall = p => { const prev = this.owner, lp = sim.lastPass, r = give(p); if (sim.ball.owner === p.id) this.onOwner(p, prev, lp); return r; };
  }

  minute() { return Math.min(Math.floor(this.sim.matchTime / 60) + 1, Math.ceil(this.sim.halfLength * 2 / 60)); }

  /** Cambio di possesso: esito del passaggio in corso, parata, recupero. */
  onOwner(p, prevId, lp) {
    const sim = this.sim, ps = this.ps, prev = prevId >= 0 ? sim.players[prevId] : null;
    this.owner = p.id;
    if (this.shotWait && p.gk && p.team !== this.shotWait.team && sim.matchTime - this.shotWait.sec < 2.5) { ps[p.id].saves++; this.s.saves[p.team]++; }
    this.shotWait = null;
    if (lp && lp.id !== p.id) { // esito del passaggio, come gli eventi passOk/passLost della simulazione
      if (lp.team === p.team) { ps[lp.id].passOk++; this.lastPass = { from: lp.id, to: p.id, sec: sim.matchTime }; }
      else ps[lp.id].passLost++;
    }
    if (!this.dead && prev && prev.team !== p.team && !p.gk && sim.state === 'play') ps[p.id].recoveries++; // passaggio intercettato, contrasto vinto o palla vagante
  }

  name(id) { const p = this.sim.players[id]; return p ? p.name ?? `Giocatore ${id + 1}` : ''; }

  push(e) { this.timeline.push({ ...e, sec: this.sim.matchTime, min: this.minute() }); }

  /** Da chiamare dopo ogni passo della simulazione; restituisce le voci nuove della cronaca. */
  step() {
    const sim = this.sim, s = this.s, ps = this.ps, n = this.timeline.length;
    if (sim.state === 'play' && sim.ball.owner >= 0) s.poss[sim.players[sim.ball.owner].team]++;
    for (const e of sim.events) {
      if (e.t === 'passOk') s.passOk[e.team]++;
      else if (e.t === 'passLost') s.passLost[e.team]++;
      else if (e.t === 'goal') {
        const sc = sim.players[e.scorer], own = !!sc && sc.team !== e.team, lp = this.lastPass;
        const assist = !own && lp && lp.to === e.scorer && sim.matchTime - lp.sec < 8 ? lp.from : -1;
        if (sc) { if (own) ps[sc.id].own++; else ps[sc.id].goals++; }
        if (assist >= 0) ps[assist].assists++;
        const gk = sim.players.find(q => q.gk && q.team !== e.team && !q.out); if (gk) ps[gk.id].conceded++;
        const shot = [...this.shotList].reverse().find(x => x.player === e.scorer && sim.matchTime - x.sec < 6);
        const lk = this.lastKick;
        if (shot && !own) { shot.goal = true; shot.on = true; }
        else if (!own && sc) { const at = lk?.id === sc.id ? lk : sc; this.shotList.push({ team: e.team, player: sc.id, x: at.x, z: at.z, on: true, goal: true, sec: sim.matchTime, min: this.minute(), touch: true }); } // gol su passaggio o tocco: sulla mappa, non tra i tiri
        this.shotWait = null; this.lastPass = null;
        this.push({ t: 'goal', team: e.team, player: e.scorer, own, assist, score: [...sim.score] });
      } else if (e.t === 'foul') {
        s.fouls[e.team]++; ps[e.player].fouls++;
        if (e.kind === 'penalty') this.push({ t: 'penalty', team: e.victim, player: e.player });
        if (e.card) { s[e.card][e.team]++; ps[e.player][e.card]++; this.push({ t: e.card, team: e.team, player: e.player, second: e.card === 'red' && sim.players[e.player]?.yellow >= 2 }); }
      } else if (e.t === 'protest') { s.blue[e.team]++; ps[e.player].blue++; this.push({ t: 'blue', team: e.team, player: e.player, protest: true }); }
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
      ['Tiri', ...s.shots], ['Tiri in porta', ...s.onTarget], ['Parate', ...s.saves],
      ['Passaggi riusciti', ...s.passOk], ['Precisione passaggi', acc(0), acc(1), '%'],
      ['Calci d\'angolo', ...s.corners], ['Falli', ...s.fouls], ['Fuorigioco', ...s.offsides],
      ['Ammonizioni', ...s.yellow], ['Azzurri', ...s.blue], ['Espulsioni', ...s.red],
    ];
  }

  /** Voto in pagella (4-10) di un giocatore: base 6, contributi di gol, assist, tiri, passaggi, recuperi, parate, errori e risultato. */
  rating(id) {
    const p = this.sim.players[id], x = this.ps[id], sc = this.sim.score, my = sc[p.team], their = sc[1 - p.team];
    const field = this.sim.players.filter(q => !q.gk), avgRec = field.reduce((a, q) => a + this.ps[q.id].recoveries, 0) / (field.length || 1);
    let v = 6 + (x.goals ? 1 + 0.7 * (x.goals - 1) : 0) - 0.5 * x.own + 0.6 * x.assists + 0.12 * x.onTarget - 0.04 * (x.shots - x.onTarget)
      + clamp(0.02 * (x.passOk - 2.2 * x.passLost), -0.5, 0.5) // a parita' con la media (circa 70% di passaggi riusciti) non cambia il voto
      + (p.gk ? 0 : clamp(0.03 * (x.recoveries - avgRec), -0.4, 0.4))
      - 0.1 * x.fouls - 0.3 * x.yellow - 0.5 * x.blue - 1.5 * x.red + (my > their ? 0.3 : my < their ? -0.3 : 0);
    if (p.gk) v += 0.35 * x.saves - 0.3 * x.conceded + (their === 0 ? 0.5 : 0);
    else if (their === 0 && p.home.x < -this.sim.pitch.hx * 0.3) v += 0.3; // difensore a porta inviolata
    return Math.round(clamp(v, 4, 10) * 2) / 2;
  }

  /** Migliore in campo: voto piu' alto, a parita' piu' gol e assist. */
  best() {
    const ids = this.sim.players.map(p => p.id);
    const key = id => this.rating(id) * 100 + this.ps[id].goals * 3 + this.ps[id].assists * 2 + this.ps[id].saves;
    return ids.reduce((m, id) => key(id) > key(m) ? id : m, ids[0]);
  }
}
