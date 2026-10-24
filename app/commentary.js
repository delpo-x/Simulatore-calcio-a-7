// Telecronaca testuale: frasi brevi sugli episodi della partita, ricavate dallo stato e dagli eventi della simulazione.
// Non cambia la simulazione: osserva passaggi, tiri e possesso (le frasi usano Math.random, la partita resta deterministica).

const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const GAP = { low: 20, mid: 8, high: 0 }; // secondi di gioco minimi dall'ultima frase, per priorita'

export class Commentary {
  /** name(id): nome del giocatore; team(t): nome della squadra. */
  constructor(sim, { name, team }) {
    this.sim = sim; this.name = name; this.team = team;
    this.out = []; this.lastLine = -99; this.lastPass = null; this.shot = null; this.owner = sim.ball.owner; this.area = -1; this.state = sim.state;
    const passTo = sim.passTo.bind(sim);
    sim.passTo = (p, q, ...a) => { this.lastPass = { from: p.id, to: q.id, team: p.team, t: sim.matchTime, d: dist(p.x, p.z, q.x, q.z) }; return passTo(p, q, ...a); };
    const shoot = sim.shoot.bind(sim);
    sim.shoot = (p, ...a) => { const r = shoot(p, ...a); this.onShot(p); return r; };
    const give = sim.giveBall.bind(sim);
    sim.giveBall = p => { const prev = this.owner, r = give(p); if (sim.ball.owner === p.id) this.onOwner(p, prev); return r; };
  }

  say(text, prio = 'low', team = -1) {
    const t = this.sim.matchTime;
    if (t - this.lastLine < GAP[prio] || (prio === 'low' && Math.random() < 0.5)) return;
    this.lastLine = t;
    this.out.push({ t: 'cm', text, team, prio, sec: t, min: Math.min(Math.floor(this.sim.clock(t) / 60) + 1, Math.ceil(this.sim.halfLengthClock * 2 / 60)) });
  }

  inArea(p) { const pt = this.sim.pitch, d = this.sim.dir(p.team); return Math.sign(p.x) === d && Math.abs(p.x) > pt.hx - pt.areaDepth && Math.abs(p.z) < pt.areaWidth / 2; }

  onShot(p) {
    const s = this.sim, b = s.ball, pt = s.pitch, gx = s.dir(p.team) * pt.hx, dg = dist(p.x, p.z, gx, 0), t = (gx - b.x) / (b.vx || 1e-9);
    let how = 'wide';
    if (t > 0 && Math.abs(b.z + b.vz * t) < pt.goalHalf) { const y = b.y + b.vy * t - 4.9 * t * t; how = y > 0 && y < pt.goalH ? 'on' : 'high'; }
    const n = this.name(p.id), set = s.setKind?.taker === p.id ? s.setKind.kind : null;
    const start = set === 'penalty' ? pick([`${n} sul dischetto...`, `Rigore: va ${n}...`])
      : set === 'free' ? pick([`Punizione di ${n}...`, `${n} calcia la punizione...`])
      : dg > 15 ? pick([`Ci prova da lontano ${n}...`, `${n} carica il destro dalla distanza...`, `Conclusione dalla lunga distanza di ${n}...`])
      : pick([`${n} calcia!`, `Tiro di ${n}!`, `${n} prova la conclusione!`, `Spazio per ${n}, tiro!`]);
    if (how === 'on') { this.shot = { id: p.id, team: p.team, t: s.matchTime }; this.say(start, 'high', p.team); return; }
    this.shot = null;
    this.say(`${start} ${how === 'high' ? pick(['Alto sopra la traversa.', 'Palla alta.', 'Sopra la traversa.']) : pick(['Fuori di poco!', 'A lato.', 'Sfiora il palo, fuori!', 'Non inquadra la porta.'])}`, 'high', p.team);
  }

  onOwner(p, prevId) {
    const s = this.sim, prev = prevId >= 0 ? s.players[prevId] : null, lp = this.lastPass, n = this.name(p.id);
    this.owner = p.id;
    if (this.shot && p.gk && p.team !== this.shot.team && s.matchTime - this.shot.t < 2.5) {
      this.shot = null; this.say(pick([`Para ${n}!`, `Blocca ${n}.`, `Attento ${n}, presa sicura.`, `Grande intervento di ${n}!`]), 'high', p.team); return;
    }
    if (s.state !== 'play' || !prev) return;
    if (prev.team !== p.team) {
      if (p.gk) return;
      if (lp && lp.team !== p.team && s.matchTime - lp.t < 3) this.say(pick([`Intercetta ${n}.`, `Lettura di ${n}, passaggio intercettato.`, `${n} legge la traiettoria e la prende.`]), 'low', p.team);
      else this.say(pick([`Recupera palla ${n}.`, `${n} vince il contrasto.`, `Palla rubata da ${n}.`]), 'low', p.team);
      return;
    }
    if (lp && lp.to === p.id && lp.team === p.team && s.matchTime - lp.t < 4) {
      const from = this.name(lp.from);
      if (this.inArea(p)) this.say(pick([`${from} serve ${n} in area!`, `Palla in area per ${n}!`, `Imbucata di ${from} per ${n}!`]), 'mid', p.team);
      else if (lp.d > 18) this.say(pick([`Lancio lungo di ${from} per ${n}.`, `${from} cambia gioco, trova ${n}.`, `Verticale di ${from}, la prende ${n}.`]), 'low', p.team);
    }
  }

  /** Da chiamare dopo ogni passo; restituisce le frasi nuove. */
  step() {
    const s = this.sim, ev = s.events;
    if (this.state !== s.state) {
      if (s.state === 'play' && this.state === 'kickoff') this.say(`Si parte! Primo pallone per ${this.team(s.players[s.ball.owner]?.team ?? 0)}.`, 'high');
      else if (s.state === 'play' && this.state === 'half') this.say('Comincia il secondo tempo.', 'high');
      this.state = s.state;
    }
    for (const e of ev) {
      if (e.t === 'foul' && !e.card && e.kind !== 'penalty') this.say(pick([`Fallo di ${this.name(e.player)}: punizione per ${this.team(e.victim)}.`, `Fischia l'arbitro, fallo di ${this.name(e.player)}.`, `Intervento falloso di ${this.name(e.player)}.`]), 'mid', e.victim);
      else if (e.t === 'restart' && e.kind === 'corner') this.say(pick([`Calcio d'angolo per ${this.team(e.team)}.`, `Angolo per ${this.team(e.team)}.`, `Sarà corner per ${this.team(e.team)}.`]), 'mid', e.team);
      else if (e.t === 'backpass') this.say(`Retropassaggio preso con le mani: punizione indiretta per ${this.team(1 - e.team)}.`, 'high', 1 - e.team);
      else if (e.t === 'gkHold') this.say(`Il portiere trattiene troppo il pallone: punizione indiretta per ${this.team(1 - e.team)}.`, 'high', 1 - e.team);
      else if (e.t === 'dangerous') this.say(`Gioco pericoloso di ${this.name(e.player)}: indiretta.`, 'mid', e.team);
      else if (e.t === 'obstruction') this.say(`Ostruzione di ${this.name(e.player)}: indiretta.`, 'mid', e.team);
      else if (e.t === 'blueEnd') this.say(`Finita la sospensione: ${this.team(e.team)} torna al completo.`, 'mid', e.team);
      else if (e.t === 'goal') {
        const lp = this.lastPass, sc = s.players[e.scorer];
        const assist = lp && sc && lp.to === sc.id && lp.team === sc.team && sc.team === e.team && s.matchTime - lp.t < 8 ? this.name(lp.from) : null;
        this.shot = null;
        this.say(assist ? pick([`Assist di ${assist}.`, `Che servizio di ${assist}!`, `Tutto nasce dal passaggio di ${assist}.`]) : pick(['Palla in fondo al sacco!', 'Imprendibile!', 'Niente da fare per il portiere.']), 'high', e.team);
      }
    }
    const ow = s.ball.owner >= 0 ? s.players[s.ball.owner] : null;
    if (ow && !ow.gk && s.state === 'play' && this.inArea(ow)) {
      if (this.area !== ow.id && s.matchTime - (this.areaT ?? -99) > 30) { // al massimo un ingresso in area ogni 30 s
        this.areaT = s.matchTime;
        this.say(pick([`${this.name(ow.id)} entra in area!`, `${this.name(ow.id)} è in area...`, `Attenzione a ${this.name(ow.id)} in area!`]), 'mid', ow.team);
      }
      this.area = ow.id;
    } else this.area = -1;
    const o = this.out; this.out = []; return o;
  }
}
