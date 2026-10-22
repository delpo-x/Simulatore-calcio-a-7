// Deterministic football simulation. No DOM, no rendering, no randomness except the seeded rng.
// Units: metres, seconds. x = pitch length (team 0 attacks +x), z = pitch width, y = up.
export const PITCH = { hx: 52.5, hz: 34, goalHalf: 3.66, goalH: 2.44 };
export const DT = 1 / 60;

/**
 * Funzionalità supportate dal motore. Il banco di prova (tools/game-tests.mjs) salta i test che
 * richiedono una funzionalità assente; ogni sessione della roadmap aggiunge qui le sue.
 * Esempi attesi: 'stamina', 'tackleProbability', 'collisionStun', 'fouls', 'setPieces',
 * 'schemes', 'configurablePitch', 'attributes'.
 */
export const FEATURES = new Set(['stamina', 'tackleProbability', 'collisionStun', 'configurablePitch', 'schemes', 'fouls', 'setPieces', 'aiScaling', 'attributes', 'cardsDuration', 'backPass', 'indirectKick', 'gkHold', 'obstruction', 'dangerousPlay', 'offside']);

/** Movimento e possesso (ticket 04; specchio di config/params.json, sezione "movimento"). */
export const MOVE = {
  run: 4.5, sprint: 8.0, tau: 0.6,              // m/s, m/s, s (costante di accelerazione)
  turnRate0: 8, turnRateMax: 3, turnLoss: 0.3,  // rad/s da fermo, rad/s a velocita' massima, perdita sopra 90 gradi
  sprintSeconds: 25, recoverSeconds: 40, lowStaminaLoss: 0.15,
  ballGap: 0.5, ballGapPerSpeed: 0.08,          // distanza palla = 0,5 m + 0,08 s * velocita'
  tackleRadius: 1.3, tackleBase: 0.4408,
  minGap: 0.8, stunSpeed: 6, stunSeconds: 0.3,
  carryFactor: 0.85,                            // con la palla si scatta all'85% (parametro di taratura, non nel ticket 04)
};

/** IA di squadra (ticket 07; specchio di config/params.json, sezione "ia"). Distanze di riferimento a 105 m, poi scalate. */
export const AI = {
  hz: 10, reaction: 0.1, passError: 0.02, risk: 0.6,
  pressTrigger: 16, secondPress: 12, mateGap: 12, minScaled: 3, refLength: 105,
  shootRange: 48, shootEager: 0.58, shotAngle: 1, shotAnglePerM: 0.5, longBall: 0.002, longMin: 30, tackleEager: 0.0438, markWeight: 0.7, containDist: 5, forceShot: 2, laneWidth: 1.6, shotMargin: 0.5976, shotFarPost: 0.768, tackleDist: 1.6, sprintFree: 12, defenderLimit: -0.1,
  passSpeed0: 7, passBase: 0.59, passPressed: 0.05, passMin: 0.451, pressedDist: 3.7531, pressedErrMul: 6, decisionNoise: 1, formSpread: 0.15, throwDelay: 1.4, dribbleEager: 0.02, dribbleDist: 2.4, dribbleBase: 0.5, edgePenalty: 0.3, throwMiss: 0.3, parryCorner: 1, parryExtra: 0.95, blockProb: 0.5, blockCorner: 1, width: 1.35, formSpeed: 0, formTackle: 1,
  attackDepth: 10.1654, blockDepth: 0.6769, keeperReach: 1.2, keeperStand: 3, keeperError: 0.5, keeperExit: 9, keeperLong: 0.4, tackleFoul: 0.6817, passSlip: 0.84, shieldSeconds: 0.3,
};

/** Passo della partita: secondi di gioco effettivo per secondo di cronometro (1 = tempo reale). Il cronometro mostrato scorre piu' veloce del gioco, come nei giochi di calcio commerciali. */
export const MATCH = { pace: 0.1 };

/** Fisica della palla (ticket 02; specchio di config/params.json, sezione "palla"). */
export const BALL = {
  airDrag: 0.15,     // 1/s, resistenza in volo
  rollDecel: 1.725,    // m/s², attrito di rotolamento (palla lenta: 1-2 m/s²)
  rollQuad: 0.012765,  // 1/m, resistenza a terra ~v²: un passaggio da 18 m/s copre 20 m in ~1,3 s
  restitution: 0.5,  // rimbalzo: un lob fa al massimo un rimbalzo significativo
};

const BTN = { up: 1, down: 2, left: 4, right: 8, cross: 16, circle: 32, square: 64, triangle: 128, l: 256, r: 512 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Campo, porta e aree per numero di giocatori per squadra (ticket 08). Metri. */
export function pitchFor(n) {
  const [length, width, goal] = n <= 5 ? [35, 20, 3] : n <= 7 ? [50, 30, 6] : n <= 9 ? [65, 45, 6] : [105, 68, 7.32];
  const big = n >= 10;
  return {
    hx: length / 2, hz: width / 2, goalHalf: goal / 2, goalH: big ? 2.44 : 2,
    areaDepth: big ? 16.5 : 10 * length / 50, areaWidth: big ? 40.32 : 20 * width / 30,
    penaltySpot: big ? 11 : 8 * length / 50,
  };
}

/** Schemi a tre linee (difensori-centrocampisti-attaccanti, portiere escluso); il primo e' il predefinito (ticket 08). */
export const SCHEMES = {
  5: ['1-2-1', '2-2', '1-1-2', '2-1-1'],
  6: ['2-2-1', '2-1-2', '1-3-1', '3-1-1'],
  7: ['2-3-1', '3-2-1', '2-2-2', '3-1-2', '1-3-2', '1-4-1'],
  8: ['3-3-1', '3-2-2', '2-4-1', '2-3-2'],
  9: ['3-3-2', '3-4-1', '2-4-2', '4-3-1'],
  10: ['4-3-2', '4-4-1', '3-4-2'], // estensione: il ticket non elenca il 10
  11: ['4-4-2', '4-3-3', '3-5-2'],
};

/** Posizioni base in coordinate "si attacca verso +x": portiere piu' linee, relative alle dimensioni del campo. */
export function layout(n, scheme, pitch) {
  const lines = scheme.split('-').map(Number);
  if (lines.reduce((a, b) => a + b, 0) !== n - 1) throw new Error(`schema ${scheme} non valido per ${n} giocatori`);
  const L = pitch.hx * 2, W = pitch.hz * 2, fr = lines.length === 2 ? [0.3, 0.65] : [0.25, 0.5, 0.75];
  const out = [{ x: -pitch.hx + 0.04 * L, z: 0, gk: true }];
  lines.forEach((c, li) => { for (let i = 0; i < c; i++) out.push({ x: -pitch.hx + fr[li] * L, z: c === 1 ? 0 : (i / (c - 1) - 0.5) * 0.7 * W }); });
  return out;
}

/** Regole (ticket 06; specchio di config/params.json, sezione "regole"). */
export const RULES = {
  foulProb: 0.37, areaCaution: 0.35, yellowShare: 0.125, redShare: 0.01, blueShare: 0.015, protestShare: 0.015, blueSeconds: 300, gkHoldSeconds: 6, obstructRate: 0.015, dangerRate: 0.25, dangerDist: 1.2, offside: 1, smallAreaDepth: 6, smallAreaWidth: 12,
  minPlayers: 5, goalAreaDepth: 5, wallDistance: 6, cornerDistance: 5.5, kickoffDistance: 6,
};

import { NEUTRAL, deriveSkill } from './team.js';

export class Sim {
  /** Secondi di cronometro (quelli mostrati) corrispondenti al tempo di gioco `t` (default: ora). */
  clock(t = this.matchTime) { return t / this.pace; }

  /** `teams`: per squadra, null (giocatori neutri) oppure l'esito di pickLineup() (ticket 09). */
  constructor({ perTeam = 7, seed = 1, halfLength = 90, pace, schemes, pitch, tactics, teams = [null, null] } = {}) {
    this.rand = rng(seed);
    this.time = 0; this.matchTime = 0;
    this.pace = pace ?? MATCH.pace; this.halfLengthClock = halfLength; this.halfLength = halfLength * this.pace; // halfLength: durata di un tempo sul cronometro; internamente si gioca this.halfLength secondi
    this.score = [0, 0]; this.state = 'kickoff'; this.stateT = 1.0; this.kickTeam = 0; this.events = [];
    this.humans = [null, null]; // per team: input bits provider index, or null for AI
    this.prev = [0, 0]; this.charge = [0, 0]; this.active = [0, 0];
    this.players = [];
    this.pitch = pitch ?? pitchFor(perTeam);
    this.sentOff = [0, 0]; this.indirect = null; this.offsideMark = null; this.tickN = 0;
    this.tac = [0, 1].map(() => ({ line: 0.25, width: AI.width, tempo: 1.0, press: AI.pressTrigger, ...tactics }));
    this.possTeam = 0; this.possT = 0; this.lastPass = null;
    this.form = [0, 1].map(() => (this.rand() - 0.5) * 2 * AI.formSpread); // forma di giornata: sposta la probabilita' di vincere i contrasti
    const names = Array.isArray(schemes) ? schemes : [schemes, schemes];
    this.schemes = names.map(s => s ?? SCHEMES[perTeam]?.[0] ?? SCHEMES[11][0]);
    for (let team = 0; team < 2; team++) layout(perTeam, this.schemes[team], this.pitch).forEach(f => this.players.push({
      id: this.players.length, team, gk: !!f.gk, home: f, x: 0, z: 0, vx: 0, vz: 0, face: team === 0 ? 0 : Math.PI,
      kickCd: 0, tackleT: 0, throwT: 0, pickT: 0, dribT: 0, dribDir: 1, stun: 0, aiT: this.players.length % 6 / 60, plan: null, yellow: 0, out: false, k: NEUTRAL, attr: null, foot: 'DX',
    }));
    teams.forEach((lineup, team) => lineup?.forEach((pl, i) => {
      const p = this.players.filter(q => q.team === team)[i];
      p.k = deriveSkill(pl); p.attr = pl.attrs; p.foot = pl.foot; p.name = pl.name;
      p.posOff = [(this.rand() - 0.5) * 2 * p.k.placeErr, (this.rand() - 0.5) * 2 * p.k.placeErr]; // errore fisso di posizionamento (m)
    }));
    this.ball = { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1 };
    this.resetPositions(0);
  }

  dir(team) { return team === 0 ? 1 : -1; }
  /** Cambia il modulo di una squadra durante la partita: i giocatori prendono i nuovi posti nell'ordine (portiere, difesa, centrocampo, attacco). */
  setScheme(team, scheme) {
    const mine = this.players.filter(p => p.team === team), lay = layout(mine.length, scheme, this.pitch);
    mine.forEach((p, i) => { p.home = lay[i]; });
    this.schemes[team] = scheme;
  }
  setTactics(team, o) { Object.assign(this.tac[team], o); }
  homePos(p) { const d = this.dir(p.team); return { x: p.home.x * d, z: p.home.z * d }; }

  resetPositions(kickTeam) {
    const live = this.players.filter(p => !p.out);
    for (const p of live) {
      const h = this.homePos(p), d = this.dir(p.team);
      p.x = h.x; p.z = h.z; p.vx = p.vz = 0; p.face = p.team === 0 ? 0 : Math.PI; p.kickCd = 0; p.tackleT = 0;
      if (d * p.x > -1) p.x = -d; // tutti nella propria meta' campo
    }
    const b = this.ball; Object.assign(b, { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0, owner: -1 });
    // kicking team's most advanced outfielder starts on the ball
    const kicker = live.filter(p => p.team === kickTeam && !p.gk).sort((a, c) => (c.home.x - a.home.x))[0];
    kicker.x = -this.dir(kickTeam) * 0.8; kicker.z = 0; this.giveBall(kicker);
    this.setKind = { kind: 'kickoff', taker: kicker.id }; // chi batte passa la palla a un compagno (aiCarrier)
    // distanze minime tra giocatori (2 m), poi avversari a 6 m dal pallone
    for (let pass = 0; pass < 3; pass++) for (const p of live) {
      if (p === kicker) continue;
      for (const q of live) if (q !== p && dist(p.x, p.z, q.x, q.z) < 2) p.z = clamp(q.z + (p.z >= q.z ? 2.05 : -2.05), -this.pitch.hz + 0.5, this.pitch.hz - 0.5);
    }
    for (const p of live) {
      if (p.team === kickTeam) continue;
      const d = this.dir(p.team), R = RULES.kickoffDistance;
      if (dist(p.x, p.z, 0, 0) < R) p.x = -d * Math.sqrt(Math.max(0, R * R - p.z * p.z));
    }
  }

  /** Fuorigioco nell'area piccola (dato del progetto): chi e' nell'area piccola avversaria quando un compagno calcia, e tocca per primo la palla, e' in fuorigioco. Esenti angolo, rinvio e rimessa. */
  markOffside(p) {
    this.offsideMark = null;
    const k = this.setKind;
    if (!RULES.offside || (k?.taker === p.id && (k.kind === 'corner' || k.kind === 'goalkick' || k.kind === 'throwin'))) return;
    const pt = this.pitch, d = this.dir(p.team);
    const ids = this.players.filter(q => q.team === p.team && q.id !== p.id && !q.gk && !q.out && Math.sign(q.x) === d && Math.abs(q.x) > pt.hx - RULES.smallAreaDepth && Math.abs(q.z) < RULES.smallAreaWidth / 2).map(q => q.id);
    if (ids.length) this.offsideMark = { team: p.team, ids };
  }

  giveBall(p) {
    const om = this.offsideMark;
    if (om) {
      this.offsideMark = null;
      if (this.state === 'play' && p.team === om.team && om.ids.includes(p.id)) return this.callOffside(p);
    }
    const lp = this.lastPass;
    if (lp) { this.lastPass = null; if (p.id !== lp.id) this.events.push({ t: p.team === lp.team ? 'passOk' : 'passLost', team: lp.team }); }
    this.ball.owner = p.id; this.ball.last = p.id; this.ball.kicker = -1; p.kickCd = 0;
    if (this.setKind && p.id !== this.setKind.taker) this.setKind = null;
    if (this.indirect && p.id !== this.indirect.taker) this.indirect = null; // secondo tocco: la punizione indiretta e' valida
  }

  /** inputs: array(2) of button bitmasks (or null = AI) for team 0 and team 1. */
  /** Giocatori in ordine alternato a ogni passo: chi viene aggiornato per secondo vede le posizioni gia' aggiornate, e un ordine fisso favorirebbe sempre una squadra. */
  ordered() { return this.tickN & 1 ? [...this.players].reverse() : this.players; }

  step(inputs = [null, null]) {
    const ev = this.events = [];
    this.time += DT; this.tickN++;
    if (this.state === 'full') return;
    if (this.state !== 'play') {
      this.stateT -= DT;
      if (this.stateT <= 0) {
        if (this.state === 'goal') this.resetPositions(this.kickTeam);
        if (this.state === 'half') { this.indirect = null; this.setKind = null; this.offsideMark = null; this.resetPositions(1); } // secondo tempo: batte la squadra che non ha battuto l'inizio
        this.state = 'play';
      }
    } else {
      this.matchTime += DT;
      if (this.matchTime >= this.halfLength * 2) { this.state = 'full'; ev.push({ t: 'full' }); return; }
      if (!this.halfDone && this.matchTime >= this.halfLength) { this.halfDone = true; this.state = 'half'; this.stateT = 3; ev.push({ t: 'half' }); return; }
    }
    const frozen = this.state === 'goal' || this.state === 'half';
    const ow = this.ball.owner >= 0 ? this.players[this.ball.owner] : null;
    if (ow && ow.team !== this.possTeam) { this.possTeam = ow.team; this.possT = 0; } else this.possT += DT;
    for (let t = 0; t < 2; t++) this.pickActive(t);
    for (const p of this.ordered()) {
      if (p.out) continue;
      p.kickCd = Math.max(0, p.kickCd - DT); p.tackleT = Math.max(0, p.tackleT - DT); p.throwT = Math.max(0, p.throwT - DT); p.dribT = Math.max(0, p.dribT - DT); p.stun = Math.max(0, p.stun - DT); if (p.shieldT) p.shieldT = Math.max(0, p.shieldT - DT);
      const human = this.active[p.team] === p.id && inputs[p.team] != null;
      let c = frozen ? { mx: 0, mz: 0, sprint: false } : this.state === 'dead' ? (p.id === this.dead?.taker ? this.deadControl(p) : this.toward(p, this.homePos(p).x, this.homePos(p).z, false)) : human ? this.humanControl(p, inputs[p.team]) : this.aiControl(p);
      this.move(p, c);
    }
    for (const p of this.players) if (p.blueUntil && this.matchTime >= p.blueUntil && this.state === 'play') { // fine sospensione
      p.blueUntil = 0; p.out = false; const h = this.homePos(p); p.x = h.x; p.z = Math.sign(h.z || 1) * this.pitch.hz; p.vx = p.vz = 0; this.events.push({ t: 'blueEnd', team: p.team });
    }
    this.separate();
    this.stepBall();
    for (let t = 0; t < 2; t++) this.prev[t] = inputs[t] ?? 0;
    this.rules();
  }

  // ---- control selection ----
  pickActive(team) {
    const b = this.ball, mine = this.players.filter(p => p.team === team && !p.gk && !p.out);
    const owner = b.owner >= 0 ? this.players[b.owner] : null;
    if (owner && owner.team === team && !owner.gk) { this.active[team] = owner.id; return; }
    const cur = this.players[this.active[team]];
    if (!mine.length) return;
    let best = mine[0];
    for (const p of mine) if (dist(p.x, p.z, b.x, b.z) < dist(best.x, best.z, b.x, b.z)) best = p;
    if (!cur || cur.team !== team || cur.gk || dist(cur.x, cur.z, b.x, b.z) > dist(best.x, best.z, b.x, b.z) + 2.5) this.active[team] = best.id;
  }

  humanControl(p, bits) {
    const team = p.team, edge = bits & ~this.prev[team], b = this.ball;
    const mx = ((bits & BTN.right ? 1 : 0) - (bits & BTN.left ? 1 : 0)), mz = ((bits & BTN.down ? 1 : 0) - (bits & BTN.up ? 1 : 0));
    const len = Math.hypot(mx, mz) || 1;
    const aim = mx || mz ? Math.atan2(mz, mx) : p.face;
    const has = b.owner === p.id;
    if (has) {
      if (edge & BTN.cross) this.pass(p, aim, !!(mx || mz));
      if (bits & BTN.circle) this.charge[team] = Math.min(1, this.charge[team] + DT / 0.8);
      else if (this.charge[team] > 0) { this.shoot(p, aim, this.charge[team]); this.charge[team] = 0; }
    } else {
      this.charge[team] = 0;
      if (edge & BTN.square && p.tackleT === 0) p.tackleT = 0.35;
    }
    return { mx: mx / len, mz: mz / len, sprint: !!(bits & BTN.r) };
  }

  // ---- actions ----
  kick(p, dx, dz, speed, lift) {
    const b = this.ball, l = Math.hypot(dx, dz) || 1;
    this.markOffside(p);
    this.lastPass = null; b.shot = false; b.kicker = p.id; b.toGk = this.aimedAtKeeper(p, dx / l, dz / l); b.kickDist = Math.abs(p.x - this.dir(p.team) * this.pitch.hx); b.owner = -1; b.vx = dx / l * speed; b.vz = dz / l * speed; b.vy = lift; b.last = p.id; p.kickCd = 0.4;
    b.x = p.x + dx / l * 0.7; b.z = p.z + dz / l * 0.7; b.y = Math.max(b.y, 0.15);
  }

  pass(p, aim, directed) {
    let best = null, bestScore = -1e9;
    for (const q of this.players) {
      if (q.out) continue;
      if (q.team !== p.team || q.id === p.id) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < 3) continue;
      const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - aim), Math.cos(Math.atan2(dz, dx) - aim)));
      if (directed && ang > 1.0) continue;
      const score = -ang * 20 - d * 0.3 + (q.gk ? -30 : 0);
      if (score > bestScore) { bestScore = score; best = q; }
    }
    if (!best) return this.kick(p, Math.cos(aim), Math.sin(aim), 14, 0);
    const d = dist(p.x, p.z, best.x, best.z), sp = clamp(8 + d * 0.5, 10, 24), t = d / sp;
    this.kick(p, best.x + best.vx * t * 0.8 - p.x, best.z + best.vz * t * 0.8 - p.z, sp, 0);
    this.lastPass = { team: p.team, id: p.id };
  }

  /** Con raw=true la mira non viene corretta verso la porta (tiro dell'IA, con errore di mira). */
  /** La palla e' calciata verso il portiere della stessa squadra (a meno di 2,5 m dalla traiettoria, entro 30 m). */
  aimedAtKeeper(p, ux, uz) {
    const g = this.players.find(q => q.gk && q.team === p.team && !q.out);
    if (!g || p.gk) return false;
    const gx = g.x - p.x, gz = g.z - p.z, along = gx * ux + gz * uz, perp = Math.abs(gx * uz - gz * ux);
    return along > 0 && along < 30 && perp < 2.5;
  }

  shoot(p, aim, power, raw = false) {
    const gx = this.dir(p.team) * this.pitch.hx, onGoal = !raw && Math.abs(Math.atan2(0 - p.z, gx - p.x) - aim) < 0.5;
    const tz = onGoal ? clamp((this.rand() - 0.5) * 2 * (this.pitch.goalHalf - 0.5), -3, 3) : null;
    const dx = onGoal ? gx - p.x : Math.cos(aim), dz = onGoal ? tz - p.z : Math.sin(aim);
    this.kick(p, dx, dz, 22 + power * 10, 1 + power * 3.2); this.ball.shot = true;
  }

  // ---- AI ----
  /** Distanza dell'IA scalata sulla lunghezza del campo (riferimento 105 m), con un minimo di 3 m (ticket 08). */
  sc(d) { return Math.max(AI.minScaled, d * this.pitch.hx * 2 / AI.refLength); }

  /** Moltiplicatore d'errore: i giocatori con attributi usano il piede debole nel 30% dei casi (errore x1,5). */
  errMul(p, m) { return p.attr && this.rand() < 0.3 && p.foot ? m * 1.5 : m; }

  /** Decisioni a 10 Hz; tra una decisione e l'altra il giocatore insegue l'ultimo obiettivo scelto. */
  aiControl(p) {
    p.aiT += DT;
    if (!p.plan || p.aiT >= p.k.react / AI.hz) { p.aiT = 0; p.plan = this.aiDecide(p); }
    return this.toward(p, p.plan.tx, p.plan.tz, p.plan.sprint);
  }

  aiDecide(p) {
    const owner = this.ball.owner >= 0 ? this.players[this.ball.owner] : null;
    if (p.gk) return this.aiKeeper(p, owner);
    if (owner === p) return this.aiCarrier(p);
    if (owner && owner.team === p.team) return this.aiSupport(p, owner);
    return this.aiDefend(p, owner);
  }

  /** Dista dai compagni almeno mateGap (scalato): spinta di allontanamento da sommare all'obiettivo. */
  spread(p, tx, tz) {
    const gap = this.sc(AI.mateGap);
    for (const q of this.players) {
      if (q === p || q.team !== p.team || q.out || q.gk) continue;
      const dd = dist(p.x, p.z, q.x, q.z);
      if (dd < gap && dd > 0.01) { tx += (p.x - q.x) / dd * (gap - dd); tz += (p.z - q.z) / dd * (gap - dd); }
    }
    return [tx, tz];
  }

  /** Fase di possesso, giocatore senza palla: appoggio vicino al portatore, gli altri in ampiezza e profondita'. */
  aiSupport(p, carrier) {
    const d = this.dir(p.team), t = this.tac[p.team], pt = this.pitch, L = pt.hx * 2, h = this.homePos(p);
    const mates = this.players.filter(q => q.team === p.team && !q.gk && !q.out && q !== carrier);
    const near = mates.reduce((m, q) => dist(q.x, q.z, carrier.x, carrier.z) < dist(m.x, m.z, carrier.x, carrier.z) ? q : m, mates[0]);
    const counter = this.possTeam === p.team && this.possT < 1.5; // transizione: palla appena recuperata
    let tx, tz;
    if (near === p) { tx = carrier.x + d * this.sc(8); tz = carrier.z + (carrier.z > 0 ? -1 : 1) * this.sc(8); }
    else {
      tx = h.x + d * (this.sc(10) * p.k.offBall + (t.line - 0.25) * L) + (carrier.x - h.x) * 0.3 + (counter && h.x * d > 0 ? d * this.sc(8) : 0);
      tz = h.z * t.width + (carrier.z - h.z) * 0.2;
    }
    if (h.x * d < -0.1 * L) tx = d * Math.min(d * tx, AI.defenderLimit * L); // i difensori non oltrepassano la meta' campo
    [tx, tz] = this.spread(p, tx, tz);
    if (p.posOff) { tx += p.posOff[0]; tz += p.posOff[1]; }
    const lim = pt.hx - this.sc(AI.attackDepth); // gli attaccanti non si piazzano sulla linea di porta
    return { tx: clamp(tx, d > 0 ? -pt.hx + 2 : -lim, d > 0 ? lim : pt.hx - 2), tz: clamp(tz, -pt.hz + 2, pt.hz - 2), sprint: counter };
  }

  /** Chi della squadra arriva prima sulla traiettoria della palla calciata (esclude chi ha appena calciato): { p, x, z, sprint }. */
  interceptor(team) {
    const c = this.icCache ??= [null, null];
    if (c[team] && c[team].tick === this.tickN) return c[team].r; // una volta per passo e squadra
    const r = this.interceptorCalc(team); c[team] = { tick: this.tickN, r }; return r;
  }

  interceptorCalc(team) {
    const b = this.ball, pt = this.pitch; let best = null;
    for (const q of this.players) {
      if (q.team !== team || q.gk || q.out || q.kickCd > 0 || q.stun > 0) continue;
      for (let t = 0.2; t <= 1.8; t += 0.2) {
        const f = t * (1 - 0.18 * t), x = clamp(b.x + b.vx * f, -pt.hx + 0.5, pt.hx - 0.5), z = clamp(b.z + b.vz * f, -pt.hz + 0.5, pt.hz - 0.5), slack = dist(q.x, q.z, x, z) - 7 * t;
        if (!best || slack < best.slack) best = { p: q, x, z, slack, sprint: slack > -2 };
        if (slack <= 0) break; // raggiunge la palla a questo istante: inutile guardare piu' avanti
      }
    }
    return best;
  }

  /** Dove la palla puo' essere raggiunta: a terra dov'e'; in volo il punto di atterraggio (resistenza dell'aria compresa). */
  ballSpot() {
    const b = this.ball;
    if (b.owner < 0 && (b.y > 0.6 || b.vy > 1.5)) {
      const t = (b.vy + Math.sqrt(b.vy * b.vy + 19.6 * Math.max(0, b.y - 0.11))) / 9.8, f = 1 - 0.075 * t;
      return { x: clamp(b.x + b.vx * t * f, -this.pitch.hx + 0.5, this.pitch.hx - 0.5), z: clamp(b.z + b.vz * t * f, -this.pitch.hz + 0.5, this.pitch.hz - 0.5), air: true };
    }
    return { x: b.x, z: b.z, air: false };
  }

  /** Fase di non possesso: pressing del piu' vicino, copertura del secondo, gli altri in blocco. */
  aiDefend(p, owner) {
    const d = this.dir(p.team), t = this.tac[p.team], pt = this.pitch, L = pt.hx * 2, b = this.ball, h = this.homePos(p);
    const mates = this.players.filter(q => q.team === p.team && !q.gk && !q.out);
    const spot = this.ballSpot(); // palla alta (lancio lungo): si va dove atterrera
    if (!owner && !spot.air && b.kicker >= 0) { const ic = this.interceptor(p.team); if (ic && ic.p === p) return { tx: ic.x, tz: ic.z, sprint: ic.sprint }; } // palla calciata a terra: va a prenderla chi ci arriva prima, il destinatario del passaggio compreso
    const ranked = [...mates].sort((a, c) => dist(a.x, a.z, spot.x, spot.z) - dist(c.x, c.z, spot.x, spot.z) || a.id - c.id);
    const rank = ranked.indexOf(p), db = dist(p.x, p.z, spot.x, spot.z);
    if (owner && owner.gk) { // portiere in possesso: gli avversari restano fuori dall'area finche' non rilancia
      const lim = d * (pt.hx - pt.areaDepth - 1), tx = d > 0 ? Math.min(p.x, lim) : Math.max(p.x, lim);
      return { tx, tz: p.z, sprint: Math.abs(p.x - lim) > 3 && (d > 0 ? p.x > lim : p.x < lim) };
    }
    const hold = this.setKind?.kind === 'throwin' && owner?.id === this.setKind.taker; // rimessa in corso: nessuno aggredisce chi la batte
    const lost = this.possTeam !== p.team && this.possT < 1.5; // transizione: palla appena persa
    const trig = this.sc(t.press) * p.k.press * (lost ? 1.4 : 1) * (owner ? 1 : 1.6);
    if (!hold && owner && db < AI.tackleDist && p.kickCd === 0 && p.tackleT === 0 && this.rand() < AI.tackleEager) p.tackleT = 0.35; // chiunque sia a tiro contrasta
    if (!hold && rank === 0 && db < trig) {
      const lead = spot.air ? 0 : clamp(db / MOVE.sprint, 0, 1.2); // intercetta il punto dove sara' la palla
      return { tx: spot.x + b.vx * lead, tz: spot.z + b.vz * lead, sprint: true };
    }
    if (!hold && rank === 1 && owner && db < this.sc(AI.secondPress)) {
      const gx = -d * pt.hx, dx = gx - b.x, dz = -b.z, l = Math.hypot(dx, dz) || 1, c = this.sc(3);
      return { tx: b.x + dx / l * c, tz: b.z + dz / l * c, sprint: true };
    }
    const top = mates.reduce((m, q) => q.home.x > m.home.x ? q : m, mates[0]);
    let tx, tz;
    const deepest = mates.filter(q => q !== top && ranked.indexOf(q) > 0).sort((a, c) => a.home.x - c.home.x || a.id - c.id)[0];
    if (!hold && owner && p === deepest) { // ultimo difensore: si mette tra il portatore e la porta e lo contiene
      const gx = -d * pt.hx, dx = gx - owner.x, dz = -owner.z, l = Math.hypot(dx, dz) || 1, m = Math.min(this.sc(AI.containDist), l);
      if (dist(p.x, p.z, owner.x, owner.z) < AI.tackleDist && p.kickCd === 0 && p.tackleT === 0 && this.rand() < AI.tackleEager) p.tackleT = 0.35;
      return { tx: owner.x + dx / l * m, tz: owner.z + dz / l * m, sprint: true };
    }
    if (p === top) { tx = h.x * 0.6; tz = h.z; } // un attaccante resta alto per il contropiede
    else {
      tx = h.x + d * (t.line - 0.25 - AI.blockDepth) * L + (b.x - h.x) * 0.35;
      tz = h.z * t.width + (b.z - h.z) * 0.3;
      // marcatura a zona: ogni difensore libero si mette tra un avversario pericoloso e la propria porta
      const gx = -d * pt.hx, cover = mates.filter(q => q !== top && ranked.indexOf(q) > 1).sort((a, c) => a.home.x - c.home.x || a.id - c.id);
      const threats = this.players.filter(q => q.team !== p.team && !q.gk && !q.out && q !== owner)
        .sort((a, c) => Math.abs(a.x - gx) - Math.abs(c.x - gx) || a.id - c.id);
      const opp = threats[cover.indexOf(p)];
      if (opp) {
        const dx = gx - opp.x, dz = -opp.z, l = Math.hypot(dx, dz) || 1, m = this.sc(3);
        tx = tx * (1 - AI.markWeight) + (opp.x + dx / l * m) * AI.markWeight; tz = tz * (1 - AI.markWeight) + (opp.z + dz / l * m) * AI.markWeight;
      }
    }
    [tx, tz] = this.spread(p, tx, tz);
    if (p.posOff) { tx += p.posOff[0]; tz += p.posOff[1]; }
    return { tx: clamp(tx, -pt.hx + 2, pt.hx - 2), tz: clamp(tz, -pt.hz + 2, pt.hz - 2), sprint: dist(p.x, p.z, tx, tz) > this.sc(15) };
  }

  /** Portatore: tiro, passaggio o conduzione, scelti con probabilita' per decisione. */
  aiCarrier(p) {
    const d = this.dir(p.team), pt = this.pitch, t = this.tac[p.team], gx = d * pt.hx, dg = dist(p.x, p.z, gx, 0);
    const opps = this.players.filter(q => q.team !== p.team && !q.out);
    const po = Math.min(...opps.map(q => dist(q.x, q.z, p.x, p.z)));
    const hold = { tx: p.x, tz: p.z, sprint: false }, range = this.sc(AI.shootRange);
    if (this.setKind?.kind === 'kickoff' && this.setKind.taker === p.id) { // calcio d'inizio: palla a un compagno, non una corsa verso la porta
      const mates = this.players.filter(q => q.team === p.team && q !== p && !q.gk && !q.out);
      const q = this.bestPass(p) ?? mates.reduce((m, q) => !m || dist(q.x, q.z, p.x, p.z) < dist(m.x, m.z, p.x, p.z) ? q : m, null);
      if (q) { this.passTo(p, q, false); return hold; }
    }
    if (this.setKind?.kind === 'throwin' && this.setKind.taker === p.id) { // rimessa laterale: si lancia con le mani a un compagno, mai in porta ne' in conduzione
      p.vx = p.vz = 0;
      if ((this.setKind.t ?? 0) >= AI.throwDelay) this.throwIn(p);
      return hold;
    }
    if (!this.setKind && this.state === 'play' && p.kickCd === 0 && this.rand() < AI.dribbleEager) { // dribbling: salta l'avversario davanti; esito da Dribbling contro Contrasti
      const q = opps.filter(o => !o.gk && !o.shieldT && dist(o.x, o.z, p.x, p.z) < this.sc(AI.dribbleDist) && (o.x - p.x) * d > 0).sort((a, c) => dist(a.x, a.z, p.x, p.z) - dist(c.x, c.z, p.x, p.z))[0];
      if (q) {
        const win = this.rand() < clamp(AI.dribbleBase + (p.attr && q.attr ? 0.02 * ((p.attr.Dribbling ?? 13) - (q.attr.Contrasti ?? 14)) : 0), 0.15, 0.85), side = q.z > p.z ? -1 : 1;
        this.events.push({ t: 'dribble', team: p.team, player: p.id, ok: win });
        p.dribT = 0.5; p.dribDir = side;
        if (win) { q.stun = 0.7; p.vx += Math.cos(p.face) * 1.2; p.vz += Math.sin(p.face) * 1.2 + side * 0.6; } // avversario saltato: perde l'attimo, il portatore scatta via
        else { p.stun = 0.4; p.kickCd = 0.4; this.ball.owner = -1; this.giveBall(q); q.shieldT = AI.shieldSeconds; return hold; } // palla persa
      }
    }
    const close = dg < this.sc(AI.forceShot), lane = this.laneClear(p, gx);
    if (dg < range && !this.indirect && ((close && this.rand() < (lane ? 0.5 : 0.08)) || (lane && this.rand() < AI.shootEager * (1 - dg / range)))) {
      this.aimShot(p);
      return hold;
    }
    const best = this.bestPass(p), pressed = po < AI.pressedDist, L = pt.hx * 2;
    if (!pressed && !close && AI.longBall > 0 && this.rand() < AI.longBall) { // lancio lungo: palla alta verso un compagno avanzato e libero
      const q = this.bestLong(p);
      if (q) { this.lobTo(p, q, this.rand() < AI.passError * 3 * this.errMul(p, p.k.passErr)); return hold; }
    }
    if (best && this.rand() < (AI.passBase * t.tempo + (pressed ? AI.passPressed : 0))) {
      this.passTo(p, best, this.rand() < AI.passSlip * clamp(p.k.passErr, 0.5, 1.15) + AI.passError * this.errMul(p, p.k.passErr) * (pressed ? AI.pressedErrMul : 1) * (1 - 2 * this.form[p.team])); // sotto pressione si sbaglia di piu'
      return hold;
    }
    if (pressed && !best && d * p.x < -L * 0.2 && this.rand() < 0.03) { // spalle alla porta e senza appoggi: si spazza lungo
      const q = this.bestLong(p, true);
      if (q) { this.lobTo(p, q, this.rand() < 0.4); return hold; }
    }
    let tz = clamp(p.z * 0.5, -pt.hz * 0.3, pt.hz * 0.3);
    for (const q of opps) if (dist(q.x, q.z, p.x, p.z) < 6) tz += (p.z - q.z) * 1.5;
    return { tx: gx - d * this.sc(3), tz: clamp(tz, -pt.hz + 3, pt.hz - 3), sprint: po > this.sc(AI.sprintFree) }; // scatta solo con spazio libero davanti
  }

  /** Tiro dell'IA: mira a un palo (di solito quello lontano dal portiere), un po' dentro; con l'errore di mira una parte dei tiri esce. */
  aimShot(p) {
    const pt = this.pitch, gx = this.dir(p.team) * pt.hx, dg = dist(p.x, p.z, gx, 0), opps = this.players.filter(q => q.team !== p.team && !q.out);
    const err = (this.rand() - 0.5) * 2 * (AI.shotAngle + AI.shotAnglePerM * dg) * this.errMul(p, (this.setKind?.taker === p.id && this.setKind.kind === 'penalty' ? p.k.penaltyErr : this.setKind?.taker === p.id && this.setKind.kind === 'free' ? p.k.freeKickErr : dg < this.sc(16) ? p.k.shotNear : p.k.shotFar)) * Math.PI / 180;
    const g = opps.find(q => q.gk), away = g ? (g.z > 0 ? -1 : 1) : 1, side = this.rand() < AI.shotFarPost ? away : -away;
    const tz = side * Math.max(0, pt.goalHalf - AI.shotMargin);
    this.shoot(p, Math.atan2(tz - p.z, gx - p.x) + err, 0.6 + this.rand() * 0.4, true);
  }

  /** Compagno a cui lanciare lungo: avanzato di almeno longMin della lunghezza, a 14-34 m (scalati), con spazio libero attorno; con 'any' anche senza spazio. */
  bestLong(p, any = false) {
    const d = this.dir(p.team), L = this.pitch.hx * 2, opps = this.players.filter(q => q.team !== p.team && !q.out && !q.gk);
    let best = null, bs = -1e9;
    for (const q of this.players) {
      if (q.team !== p.team || q === p || q.out || q.gk) continue;
      const dd = dist(p.x, p.z, q.x, q.z), gain = (q.x - p.x) * d;
      if (dd < this.sc(AI.longMin) || dd > L * 0.7 || gain < L * 0.2) continue;
      const open = Math.min(12, ...opps.map(o => dist(o.x, o.z, q.x, q.z)));
      if (!any && open < this.sc(7)) continue;
      const s = open * 0.5 + gain / L * 8 - Math.abs(q.z) * 0.05 + (this.rand() - 0.5) * 2;
      if (s > bs) { bs = s; best = q; }
    }
    return best;
  }

  /** Lancio lungo: palla alta che atterra vicino al compagno (tempo di volo 1,2-2,2 s, come il lob tarato nei test della palla); con 'miss' la mira e' lontana. */
  /** Rimessa laterale: lancio a due mani da sopra la testa verso il compagno piu' libero e vicino (6-16 m scalati). */
  throwIn(p) {
    const mates = this.players.filter(q => q.team === p.team && q !== p && !q.gk && !q.out);
    const opps = this.players.filter(q => q.team !== p.team && !q.out);
    let q = null, bs = -1e9;
    for (const m of mates) {
      const d = dist(p.x, p.z, m.x, m.z);
      if (d < this.sc(5) || d > this.sc(18)) continue;
      const open = Math.min(8, ...opps.map(o => dist(o.x, o.z, m.x, m.z)));
      const sc = open - d * 0.25 + this.dir(p.team) * (m.x - p.x) * 0.05 + this.rand() * 0.5;
      if (sc > bs) { bs = sc; q = m; }
    }
    if (!q) q = mates.reduce((m, c) => !m || dist(c.x, c.z, p.x, p.z) < dist(m.x, m.z, p.x, p.z) ? c : m, null);
    if (!q) return;
    const D0 = dist(p.x, p.z, q.x, q.z), T = clamp(D0 / 9, 0.7, 1.7), pt = this.pitch;
    const px = clamp(q.x + q.vx * T * 0.6, -pt.hx + 1, pt.hx - 1), pz = clamp(q.z + q.vz * T * 0.6, -pt.hz + 1, pt.hz - 1);
    let dx = px - p.x, dz = pz - p.z;
    if (this.rand() < AI.throwMiss * clamp(p.k.passErr, 0.5, 1.5)) { const a = Math.atan2(dz, dx) + (this.rand() - 0.5) * 1.0, l = Math.hypot(dx, dz); dx = Math.cos(a) * l; dz = Math.sin(a) * l; } // lancio impreciso
    const D = Math.hypot(dx, dz) || 1;
    p.face = Math.atan2(dz, dx);
    this.kick(p, dx, dz, D / T / (1 - 0.075 * T), (4.9 * T * T - 2.0) / T);
    this.ball.x = p.x + dx / D * 0.3; this.ball.z = clamp(p.z + dz / D * 0.3, -pt.hz + 0.05, pt.hz - 0.05); this.ball.y = 2.0; // parte da sopra la linea, mai gia' fuori
    p.pickT = 0; this.lastPass = null; p.throwT = 0.5; // la rimessa non entra nelle statistiche dei passaggi p.shieldT = 0;
    this.setKind = null; this.events.push({ t: 'throwin', team: p.team, player: p.id });
  }

  lobTo(p, q, miss) {
    const pt = this.pitch, D0 = dist(p.x, p.z, q.x, q.z), T = clamp(D0 / 11, 1.2, 2.2);
    let px = clamp(q.x + q.vx * T * 0.7, -pt.hx + 1, pt.hx - 1), pz = clamp(q.z + q.vz * T * 0.7, -pt.hz + 1, pt.hz - 1);
    let dx = px - p.x, dz = pz - p.z;
    if (miss) { const a = Math.atan2(dz, dx) + (this.rand() - 0.5) * 0.7, l = Math.hypot(dx, dz) * (0.8 + this.rand() * 0.5); dx = Math.cos(a) * l; dz = Math.sin(a) * l; }
    const D = Math.hypot(dx, dz);
    this.kick(p, dx, dz, D / T / (1 - 0.075 * T), 4.9 * T);
    this.lastPass = { team: p.team, id: p.id };
  }

  /** Nessun avversario (portiere escluso) vicino alla linea di tiro verso la porta. */
  laneClear(p, gx) {
    const dx = gx - p.x, dz = -p.z, l2 = dx * dx + dz * dz || 1;
    for (const o of this.players) {
      if (o.team === p.team || o.gk || o.out) continue;
      const t = ((o.x - p.x) * dx + (o.z - p.z) * dz) / l2;
      if (t > 0 && t < 1 && dist(o.x, o.z, p.x + dx * t, p.z + dz * t) < AI.laneWidth) return false;
    }
    return true;
  }

  /** Miglior compagno da servire: avanzamento, spazio libero attorno e corsia libera, meno la distanza. */
  bestPass(p) {
    const d = this.dir(p.team), L = this.pitch.hx * 2;
    const opps = this.players.filter(q => q.team !== p.team && !q.out);
    let best = null, bestScore = AI.passMin;
    for (const q of this.players) {
      if (q.team !== p.team || q === p || q.out) continue;
      const dd = dist(p.x, p.z, q.x, q.z);
      if (dd < 3 || q.gk) continue; // mai al portiere con i piedi del compagno: sarebbe retropassaggio
      let open = 8, lane = 6;
      for (const o of opps) {
        open = Math.min(open, dist(o.x, o.z, q.x, q.z));
        const t = clamp(((o.x - p.x) * (q.x - p.x) + (o.z - p.z) * (q.z - p.z)) / (dd * dd), 0, 1);
        lane = Math.min(lane, dist(o.x, o.z, p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t));
      }
      if (lane < 1.5) continue;
      const g = this.players.find(r => r.gk && r.team === p.team && !r.out);
      if (g && dist(g.x, g.z, q.x, q.z) < 4) continue; // compagno attaccato al portiere: il portiere prenderebbe la palla con le mani
      if (g) { const tt = clamp(((g.x - p.x) * (q.x - p.x) + (g.z - p.z) * (q.z - p.z)) / (dd * dd), 0, 1); if (dist(g.x, g.z, p.x + (q.x - p.x) * tt, p.z + (q.z - p.z) * tt) < 2.5) continue; } // mai attraverso il proprio portiere
      const score = (this.rand() - 0.5) * 2 * p.k.decNoise * AI.decisionNoise + ((q.x - p.x) * d / L) * 2 * AI.risk * p.k.vision + open / 8 * 0.5 + lane / 6 * 0.5 - dd / L * 0.5 + (q.gk ? -1 : 0) - (Math.abs(q.z) > this.pitch.hz - 2.5 ? AI.edgePenalty : 0); // compagno sulla linea laterale: passaggio piu' rischioso (palla fuori)
      if (score > bestScore) { bestScore = score; best = q; }
    }
    return best;
  }

  /** Passaggio mirato a un compagno; con 'miss' la direzione sbaglia. */
  passTo(p, q, miss) {
    const dd = dist(p.x, p.z, q.x, q.z), sp = clamp(AI.passSpeed0 + dd * 0.45, AI.passSpeed0 + 1.5, 20), t = dd / sp;
    let dx = q.x + q.vx * t * 0.8 - p.x, dz = q.z + q.vz * t * 0.8 - p.z;
    if (miss) { const a = Math.atan2(dz, dx) + (this.rand() - 0.5) * 1.2, l = Math.hypot(dx, dz); dx = Math.cos(a) * l; dz = Math.sin(a) * l; }
    this.kick(p, dx, dz, sp, 0);
    this.lastPass = { team: p.team, id: p.id };
  }

  /** Portiere: bisettrice a 1,5-3 m dalla linea, intercetto dei tiri, uscita sulle palle libere vicine, rinvio al compagno piu' libero. */
  aiKeeper(p, owner) {
    const b = this.ball, d = this.dir(p.team), pt = this.pitch, goalX = -d * pt.hx;
    if (owner === p) {
      p.holdT = (p.holdT || 0) + 1 / AI.hz;
      if (p.holdT > 0.6) {
        p.holdT = 0;
        const opps = this.players.filter(q => q.team !== p.team && !q.out);
        let pick = null, pv = -1e9;
        for (const q of this.players) {
          if (q.team !== p.team || q.gk || q.out) continue;
          const open = Math.min(8, ...opps.map(o => dist(o.x, o.z, q.x, q.z))) - dist(p.x, p.z, q.x, q.z) * 0.15; // compagno libero e vicino
          if (open > pv) { pv = open; pick = q; }
        }
        const far = this.rand() < AI.keeperLong ? this.bestLong(p) : null; // rilancio lungo su un attaccante libero
        if (far) this.lobTo(p, far, this.rand() < AI.passError * 3 * this.errMul(p, p.k.passErr));
        else if (pick) this.passTo(p, pick, this.rand() < AI.passError * this.errMul(p, p.k.passErr)); else this.kick(p, d, 0, 20, 2);
      }
      return { tx: p.x, tz: p.z, sprint: false };
    }
    p.holdT = 0;
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 8 && b.vx * (goalX - b.x) > 0) {
      const zi = b.z + b.vz * ((goalX - b.x) / b.vx);
      if (Math.abs(zi) < pt.goalHalf + 1.5) return { tx: goalX + d, tz: clamp(zi + (this.rand() - 0.5) * 2 * AI.keeperError * p.k.posErr, -pt.goalHalf, pt.goalHalf), sprint: true };
    }
    const db = dist(p.x, p.z, b.x, b.z);
    if (!owner && db < this.sc(AI.keeperExit) * p.k.exit) {
      const rival = this.players.some(q => q.team !== p.team && !q.out && dist(q.x, q.z, b.x, b.z) < db);
      if (!rival) return { tx: b.x, tz: b.z, sprint: true };
    }
    const dgx = Math.abs(b.x - goalX), stand = clamp(1.5 + (1 - clamp(dgx / this.sc(40), 0, 1)) * (AI.keeperStand - 1.5), 1.5, AI.keeperStand);
    return { tx: goalX + d * stand, tz: clamp(b.z * stand / Math.max(dgx, stand), -pt.goalHalf + 0.3, pt.goalHalf - 0.3), sprint: false };
  }

  toward(p, tx, tz, sprint) {
    const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
    if (l < 0.6) return { mx: 0, mz: 0, sprint: false };
    const k = sprint ? 1 : Math.min(1, l / 3); // senza scatto si rallenta all'arrivo: un giocatore a posto cammina, non corre sul posto
    return { mx: dx / l * k, mz: dz / l * k, sprint };
  }

  // ---- physics ----
  move(p, c) {
    if (p.stam === undefined) p.stam = 1;
    const sprinting = c.sprint && (c.mx || c.mz) && p.stun <= 0;
    const kk = p.k, fm = 1 + this.form[p.team] * AI.formSpeed; // forma di giornata
    if (sprinting) p.stam = Math.max(0, p.stam - DT / (MOVE.sprintSeconds * kk.stamina));
    else if (Math.hypot(p.vx, p.vz) < MOVE.run * kk.speed + 0.5) p.stam = Math.min(1, p.stam + DT * kk.stamina / MOVE.recoverSeconds);
    const top = MOVE.sprint * kk.speed * fm * (1 - MOVE.lowStaminaLoss * (1 - p.stam)) * (this.ball.owner === p.id ? MOVE.carryFactor : 1);
    const max = p.stun > 0 ? 1.5 : p.tackleT > 0 ? 9.5 : sprinting ? top : MOVE.run * kk.speed * fm;
    let tx = c.mx * max, tz = c.mz * max;
    if (p.tackleT > 0 && !c.mx && !c.mz) { tx = Math.cos(p.face) * max; tz = Math.sin(p.face) * max; }
    // virata oltre 90 gradi: si perde velocita; la sterzata e' piu lenta ad alta velocita
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > 1 && (tx || tz) && p.vx * tx + p.vz * tz < 0) { tx *= 1 - MOVE.turnLoss * kk.balance; tz *= 1 - MOVE.turnLoss * kk.balance; }
    const k = 1 - Math.exp(-DT * kk.acc / MOVE.tau);
    p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
    p.x = clamp(p.x + p.vx * DT, -this.pitch.hx - 3, this.pitch.hx + 3); p.z = clamp(p.z + p.vz * DT, -this.pitch.hz - 3, this.pitch.hz + 3);
    if (Math.hypot(p.vx, p.vz) > 0.8) {
      const a = Math.atan2(p.vz, p.vx), da = Math.atan2(Math.sin(a - p.face), Math.cos(a - p.face));
      const rate = MOVE.turnRate0 - (MOVE.turnRate0 - MOVE.turnRateMax) * clamp(sp / MOVE.sprint, 0, 1);
      const rateA = rate * kk.agi;
      p.face += clamp(da, -rateA * DT, rateA * DT);
    }
  }

  /** Esito di un contrasto di q su o: base 55%, piu' alto di lato o da dietro, piu' basso se o sprinta. */
  tackleChance(q, o) {
    const front = this.tackleFront(q, o);
    let c = MOVE.tackleBase + (front < 0.3 ? (front < -0.3 ? 0.2 : 0.1) : 0);
    if (Math.hypot(o.vx, o.vz) > MOVE.run + 0.5) c -= 0.1;
    if (q.attr?.Contrasti && o.attr?.Dribbling) c += 0.015 * (q.attr.Contrasti - 14) - 0.015 * (o.attr.Dribbling - 13) + 0.005 * (q.attr.Forza - o.attr.Forza);
    c += (this.form[q.team] - this.form[o.team]) * AI.formTackle;
    return clamp(c, 0.05, 0.95);
  }

  separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (a.out || b.out) continue;
      if (this.state === 'play' && a.team !== b.team && this.indirectInfraction(a, b, d)) return;
      if (d > 0 && d < MOVE.minGap) {
        // urto forte: stordisce per 0,3 s chi viene colpito da dietro (l'altro e' dietro di lui)
        if (Math.hypot(a.vx - b.vx, a.vz - b.vz) > MOVE.stunSpeed) {
          if (a.stun <= 0 && dx * Math.cos(a.face) + dz * Math.sin(a.face) < 0) a.stun = MOVE.stunSeconds * a.k.stun;
          if (b.stun <= 0 && -dx * Math.cos(b.face) - dz * Math.sin(b.face) < 0) b.stun = MOVE.stunSeconds * b.k.stun;
        }
        const push = (MOVE.minGap - d) / 2 / d; a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
      }
    }
  }

  /** Infrazioni da indiretta tra avversari a contatto (regole a 11): gioco pericoloso (si avvicina al portiere in possesso) e ostruzione (ostacola senza giocare la palla). Vero se fischiata. */
  indirectInfraction(a, b, d) {
    const bl = this.ball, pt = this.pitch, owner = bl.owner >= 0 ? this.players[bl.owner] : null;
    const gk = owner?.gk ? owner : null, other = gk ? (a === gk ? b : b === gk ? a : null) : null;
    if (gk && other && d < RULES.dangerDist && this.rand() < RULES.dangerRate * DT) { // gioco pericoloso: avvicinarsi al portiere che ha la palla
      this.events.push({ t: 'dangerous', team: other.team, player: other.id });
      bl.owner = -1; bl.kicker = -1; bl.vx = bl.vy = bl.vz = 0;
      this.deadBall('indirect', gk.team, clamp(gk.x, -pt.hx + 1, pt.hx - 1), clamp(gk.z, -pt.hz + 1, pt.hz - 1));
      return true;
    }
    if (owner || d >= MOVE.minGap || a.gk || b.gk) return false;
    const da = dist(a.x, a.z, bl.x, bl.z), db = dist(b.x, b.z, bl.x, bl.z);
    if (Math.min(da, db) < 1.5 || Math.max(da, db) > 12) return false; // uno dei due gioca la palla, oppure la palla e' lontana
    if (this.rand() >= RULES.obstructRate * DT) return false;
    const foul = da < db ? a : b, victim = foul === a ? b : a; // ostruisce chi sta tra la palla e l'avversario
    this.events.push({ t: 'obstruction', team: foul.team, player: foul.id });
    this.deadBall('indirect', victim.team, clamp(victim.x, -pt.hx + 1, pt.hx - 1), clamp(victim.z, -pt.hz + 1, pt.hz - 1));
    return true;
  }

  stepBall() {
    const b = this.ball, ps = this.players;
    if (b.owner >= 0) {
      const o = ps[b.owner];
      // tackle: opponent in reach with an active tackle takes the ball (al portiere in possesso non si puo' togliere la palla)
      for (const q of ps) if (!o.gk && !o.shieldT && !q.out && q.team !== o.team && q.tackleT > 0 && dist(q.x, q.z, o.x, o.z) < MOVE.tackleRadius && q.kickCd === 0) {
        q.tackleT = 0; q.kickCd = 0.4; // un solo tentativo per contrasto
        const won = this.rand() < this.tackleChance(q, o);
        const foul = (!won || this.tackleFront(q, o) < -0.3) && this.rand() < AI.tackleFoul ? this.foulRoll(q) : null; // solo una parte dei contrasti a rischio e' fallo (con piu' duelli, i falli restano circa 8 a partita) // contrasto da dietro o fallito
        if (foul) this.callFoul(q, o, foul);
        else if (won) { o.stun = 0.5; o.kickCd = 0.4; b.owner = -1; this.giveBall(q); q.shieldT = AI.shieldSeconds; } // chi ha appena vinto la palla non puo' essere contrastato subito
        break;
      }
    }
    if (b.owner >= 0) {
      const o = ps[b.owner];
      const gap = MOVE.ballGap + MOVE.ballGapPerSpeed * Math.hypot(o.vx, o.vz);
      const thrower = this.setKind?.kind === 'throwin' && this.setKind.taker === o.id;
      if (thrower) { // rimessa: il battitore arriva dal fuori campo, si china sulla palla ferma sulla linea, la solleva sopra la testa
        const k = this.setKind, t = k.t = (k.t ?? 0) + DT, side = Math.sign(k.z), walk = Math.max(0, 1 - t / 0.6), lift = clamp((t - 0.9) / 0.5, 0, 1);
        o.x = k.x; o.z = k.z + side * 2.4 * walk; o.vx = 0; o.vz = walk > 0 ? -side * 4 : 0; o.pickT = t;
        const hx = o.x + Math.cos(o.face) * 0.1, hz = o.z + Math.sin(o.face) * 0.1, gz = side * this.pitch.hz;
        b.x = k.x + (hx - k.x) * lift; b.z = gz + (hz - gz) * lift; b.y = 0.11 + 1.89 * lift; b.vx = b.vz = b.vy = 0; b.last = o.id;
        for (const q of ps) { const dq = dist(q.x, q.z, k.x, k.z); if (q.team !== o.team && !q.out && dq < 2 && dq > 1e-6) { const m = Math.min(2 - dq, 0.05) / dq; q.x += (q.x - k.x) * m; q.z += (q.z - k.z) * m; } } // gli avversari vengono spinti piano fuori dai 2 m dal punto della rimessa
        return;
      }
      b.x = o.x + Math.cos(o.face) * (thrower ? 0.1 : gap); b.z = o.z + Math.sin(o.face) * (thrower ? 0.1 : gap); b.y = thrower ? 2.0 : 0.11; // rimessa: palla sopra la testa, tenuta con le mani
      b.vx = o.vx; b.vz = o.vz; b.vy = 0; b.last = o.id;
      return;
    }
    b.vy -= 9.8 * DT;
    const air = b.y > 0.12;
    if (air) { const f = Math.max(0, 1 - BALL.airDrag * DT); b.vx *= f; b.vz *= f; }
    if (!air) { const s = Math.hypot(b.vx, b.vz), dec = (BALL.rollDecel + BALL.rollQuad * s * s) * DT; if (s <= dec) b.vx = b.vz = 0; else { b.vx -= b.vx / s * dec; b.vz -= b.vz / s * dec; } }
    b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
    if (b.y < 0.11) { b.y = 0.11; if (Math.abs(b.vy) > 1.5) { b.vy = -b.vy * BALL.restitution; b.vx *= 0.9; b.vz *= 0.9; } else b.vy = 0; } // ogni rimbalzo sull'erba toglie velocita' orizzontale
    const hx = this.pitch.hx, hz = this.pitch.hz;
    if (Math.abs(b.x) > hx || Math.abs(b.z) > hz) { // fuori dal campo c'e' la ghiaia: la palla rallenta di colpo e non va oltre 2,5 m
      const f = Math.max(0, 1 - (b.y < 0.2 ? 7 : 0.5) * DT); b.vx *= f; b.vz *= f;
      if (Math.abs(b.x) > hx + 2.5) { b.x = Math.sign(b.x) * (hx + 2.5); b.vx = 0; } if (Math.abs(b.z) > hz + 2.5) { b.z = Math.sign(b.z) * (hz + 2.5); b.vz = 0; }
    }
    if (this.state === 'goal') { // gol segnato: la palla resta nella rete (profondita' come nel disegno 3D), non la attraversa
      const D = Math.min(2.2, this.pitch.goalH), pt = this.pitch, sx = Math.sign(b.x);
      if (Math.abs(b.x) > hx + D) { b.x = sx * (hx + D); b.vx = -b.vx * 0.15; }
      if (Math.abs(b.z) > pt.goalHalf) { b.z = Math.sign(b.z) * pt.goalHalf; b.vz = -b.vz * 0.15; }
      if (b.y > pt.goalH) { b.y = pt.goalH; b.vy = -Math.abs(b.vy) * 0.1; }
      if (Math.abs(b.x) > hx) { b.vx *= 0.92; b.vz *= 0.92; }
    }
    if (this.state === 'dead') return;
    const sp = Math.hypot(b.vx, b.vz);
    // tiro ribattuto da un difensore in linea di tiro: spesso in angolo
    if (b.shot && sp >= 14 && b.y < 1.8 && b.kicker >= 0 && AI.blockProb > 0) {
      const st = this.players[b.kicker].team;
      for (const p of ps) {
        if (p.gk || p.out || p.team === st || p.stun > 0 || dist(p.x, p.z, b.x, b.z) > 0.7) continue;
        b.shot = false;
        if (this.rand() < AI.blockProb) {
          b.last = p.id;
          if (this.rand() < AI.blockCorner) { b.vx = this.dir(st) * sp * 0.3; b.vz = (b.z >= 0 ? 1 : -1) * sp * 0.3; } else { const a = this.rand() * Math.PI * 2; b.vx = Math.cos(a) * sp * 0.3; b.vz = Math.sin(a) * sp * 0.3; }
          b.vy = 0; return;
        }
        break;
      }
    }
    // pickup
    if (b.y < (sp > 16 ? 2.4 : 1.1)) {
      let best = null, bd = 99;
      for (const p of ps) {
        const reach = p.gk ? AI.keeperReach * p.k.reach * (b.kickDist < this.sc(10) ? p.k.oneOnOne : 1) : 0.9 * p.k.touch, d = dist(p.x, p.z, b.x, b.z);
        if (sp >= (p.gk ? 40 : 16) || d > reach || d >= bd || p.kickCd > 0 || p.stun > 0 || p.out) continue;
        if (p.gk && sp > 2 && b.kicker >= 0 && this.players[b.kicker].team === p.team && b.vx * (p.x - b.x) + b.vz * (p.z - b.z) <= 0) continue; // la palla calciata da un compagno e che si allontana non e' un passaggio al portiere
        best = p; bd = d;
      }
      if (best && best.gk && this.backPass(best)) return;
      if (best && best.gk && sp > 12 && this.rand() > best.k.hold - AI.parryExtra) { // respinta invece di presa
        b.last = best.id;
        if (this.rand() < AI.parryCorner) { // deviata in angolo: la palla esce dal fondo, calcio d'angolo
          b.vx = Math.sign(best.x) * sp * 0.25; b.vz = (b.z >= 0 ? 1 : -1) * sp * 0.35; b.vy = 0;
        } else {
          const a = Math.atan2(b.z - best.z, b.x - best.x) + (this.rand() - 0.5) * 1.2;
          b.vx = Math.cos(a) * sp * 0.4; b.vz = Math.sin(a) * sp * 0.4;
        }
        best.kickCd = 0.4; return;
      }
      if (best) { b.vx = b.vy = b.vz = 0; this.giveBall(best); }
    }
  }

  // ---- rules ----
  rules() {
    if (this.state !== 'play') return;
    const b = this.ball, holder = b.owner >= 0 ? this.players[b.owner] : null;
    if (holder?.gk) { // portiere che trattiene la palla troppo a lungo -> punizione indiretta agli avversari
      this.gkHoldT = this.gkHoldId === holder.id ? this.gkHoldT + DT : 0; this.gkHoldId = holder.id;
      if (this.gkHoldT > RULES.gkHoldSeconds) {
        const pt = this.pitch; this.gkHoldT = 0; this.gkHoldId = -1;
        this.events.push({ t: 'gkHold', team: holder.team });
        b.owner = -1; b.kicker = -1; b.vx = b.vy = b.vz = 0;
        this.deadBall('indirect', 1 - holder.team, Math.sign(holder.x) * Math.min(Math.abs(holder.x), pt.hx - RULES.goalAreaDepth), clamp(holder.z, -pt.hz + 1, pt.hz - 1));
        return;
      }
    } else this.gkHoldId = -1;
    if (this.setKind?.kind === 'throwin' && b.owner === this.setKind.taker) return; // chi batte la rimessa sta fuori dalla linea con la palla in mano
    if (Math.abs(b.x) > this.pitch.hx) {
      if (Math.abs(b.z) < this.pitch.goalHalf && b.y < this.pitch.goalH && !this.indirect) {
        const team = b.x > 0 ? 0 : 1;
        this.score[team]++; this.state = 'goal'; this.stateT = 2.5; this.kickTeam = 1 - team; this.events.push({ t: 'goal', team, scorer: b.last });
        return;
      }
      this.restart(b.x > 0 ? 1 : -1, 0);
    } else if (Math.abs(b.z) > this.pitch.hz) this.restart(0, b.z > 0 ? 1 : -1);
  }

  /** Retropassaggio (regolamento a 11, ipotesi per il girone): il portiere prende con le mani una palla calciata volontariamente da un compagno -> punizione indiretta. */
  callOffside(p) {
    const pt = this.pitch, b = this.ball;
    this.events.push({ t: 'offside', team: p.team, player: p.id });
    this.lastPass = null; b.owner = -1; b.kicker = -1; b.vx = b.vy = b.vz = 0;
    this.deadBall('indirect', 1 - p.team, clamp(p.x, -pt.hx + 1, pt.hx - 1), clamp(p.z, -pt.hz + 1, pt.hz - 1));
  }

  backPass(gk) {
    const b = this.ball, k = b.kicker >= 0 ? this.players[b.kicker] : null;
    if (!k || k.team !== gk.team || k.gk || !b.toGk || this.state !== 'play') return false;
    const pt = this.pitch;
    this.events.push({ t: 'backpass', team: gk.team });
    b.kicker = -1; b.owner = -1; b.vx = b.vy = b.vz = 0;
    this.deadBall('indirect', 1 - gk.team, Math.sign(gk.x) * Math.min(Math.abs(gk.x), pt.hx - RULES.goalAreaDepth), clamp(gk.z, -pt.hz + 1, pt.hz - 1));
    return true;
  }

  /** Palla uscita: rimessa laterale, rinvio dal fondo o calcio d'angolo secondo chi l'ha toccata per ultimo. */
  restart(sx, sz) {
    const b = this.ball, pt = this.pitch, lastTeam = this.players[b.last]?.team ?? 0;
    if (sx) {
      const attackers = sx > 0 ? 0 : 1; // la squadra che attacca quella linea di fondo
      if (lastTeam === attackers) return this.deadBall('goalkick', 1 - attackers, sx * (pt.hx - 6), 0);
      return this.deadBall('corner', attackers, sx * (pt.hx - 0.3), (b.z >= 0 ? 1 : -1) * (pt.hz - 0.3));
    }
    return this.deadBall('throwin', 1 - lastTeam, clamp(b.x, -pt.hx + 1, pt.hx - 1), sz * (pt.hz + 0.45)); // chi batte sta fuori dalla linea laterale
  }

  /** Palla ferma da recuperare: il battitore piu' vicino va a prendere la palla (anche fuori, sulla ghiaia), la raccoglie e la porta al punto di ripresa. Il cronometro di gioco e' fermo. */
  deadBall(kind, team, x, z) {
    if (kind === 'penalty') return this.setPiece(kind, team, x, z);
    const lp = this.lastPass; // palla uscita: l'ultimo passaggio si chiude qui (ripresa della stessa squadra = riuscito, altrimenti perso)
    if (lp && kind !== 'free' && kind !== 'indirect') { this.lastPass = null; this.events.push({ t: team === lp.team ? 'passOk' : 'passLost', team: lp.team, player: lp.id }); }
    const b = this.ball, own = this.players.filter(p => p.team === team && !p.out), pool = kind === 'goalkick' ? own.filter(p => p.gk) : own.filter(p => !p.gk);
    const taker = pool.reduce((m, p) => dist(p.x, p.z, b.x, b.z) < dist(m.x, m.z, b.x, b.z) ? p : m);
    if (b.owner >= 0) { b.owner = -1; b.vx = b.vy = b.vz = 0; }
    this.offsideMark = null; this.setKind = null; this.indirect = kind === 'indirect' ? { team, taker: taker.id } : null; this.lastPass = null;
    this.dead = { kind, team, x, z, taker: taker.id, phase: 'fetch', t: 0, pt: 0 }; this.state = 'dead'; this.stateT = 1e9;
  }

  /** Controllo del battitore durante la palla ferma: raggiunge la palla, si china, la porta al punto di ripresa. */
  deadControl(p) {
    const d = this.dead, b = this.ball, still = { mx: 0, mz: 0, sprint: false };
    d.t += DT; p.pickT = 0;
    if (d.phase === 'fetch') {
      if (dist(p.x, p.z, b.x, b.z) < 0.7 || d.t > 6) { d.phase = 'pick'; d.pt = 0; b.vx = b.vz = 0; } else return this.toward(p, b.x + b.vx * 0.3, b.z + b.vz * 0.3, dist(p.x, p.z, b.x, b.z) > 3);
    }
    if (d.phase === 'pick') {
      d.pt += DT; p.throwT = 9; p.pickT = 0.6 + Math.min(d.pt, 0.3);
      if (d.pt >= 0.3) { p.throwT = 0; p.pickT = 0; d.phase = 'carry'; b.vx = b.vz = b.vy = 0; this.giveBall(p); this.setKind = null; } else return still;
    }
    if (dist(p.x, p.z, d.x, d.z) < 0.8 || d.t > 9) { this.dead = null; this.state = 'play'; this.setPiece(d.kind, d.team, d.x, d.z, p.id); return still; }
    return this.toward(p, d.x, d.z, dist(p.x, p.z, d.x, d.z) > 3);
  }

  /** Riprese da fermo: rimessa, rinvio, angolo, punizione e rigore, con le distanze regolamentari. */
  setPiece(kind, team, x, z, takerId) {
    const b = this.ball, pt = this.pitch;
    this.offsideMark = null;
    const own = this.players.filter(p => p.team === team && !p.out);
    const pool = kind === 'goalkick' ? own.filter(p => p.gk) : own.filter(p => !p.gk);
    const taker = takerId != null ? this.players[takerId] : pool.reduce((m, p) => dist(p.x, p.z, x, z) < dist(m.x, m.z, x, z) ? p : m);
    taker.x = x; taker.z = z; taker.vx = taker.vz = 0;
    // il battitore guarda verso il campo, altrimenti la palla esce subito di nuovo
    taker.face = kind === 'throwin' ? (z > 0 ? -Math.PI / 2 : Math.PI / 2)
      : kind === 'corner' ? Math.atan2(-z, -x)
      : kind === 'goalkick' ? (team === 0 ? 0 : Math.PI)
      : Math.atan2(-z, this.dir(team) * pt.hx - x);
    Object.assign(b, { x, z, vx: 0, vz: 0, vy: 0, y: 0.11 });
    this.giveBall(taker);
    this.indirect = kind === 'indirect' ? { team, taker: taker.id } : null;
    this.setKind = { kind, taker: taker.id, x, z, t: kind === 'throwin' ? 1.0 : 0 }; // rimessa: il battitore arriva gia' con la palla in mano, resta da sollevarla
    if (kind === 'throwin') { taker.throwT = 9; taker.shieldT = 9; taker.aiT = 1; this.throwWait = 0; this.indirect = { team, taker: taker.id }; } // la rimessa non vale come gol diretto; chi la batte non si contrasta
    const R = kind === 'free' || kind === 'indirect' ? RULES.wallDistance : kind === 'corner' ? RULES.cornerDistance : kind === 'throwin' ? 2 : 0, end = Math.sign(x);
    for (const p of this.players) {
      if (p === taker || p.out) continue;
      if (R && p.team !== team) this.keepAway(p, x, z, R);
      const barred = kind === 'penalty' ? !(p.gk && p.team !== team) : kind === 'goalkick' && p.team !== team;
      if (barred && Math.abs(p.x) > pt.hx - pt.areaDepth && Math.sign(p.x) === end && Math.abs(p.z) < pt.areaWidth / 2) p.x = end * (pt.hx - pt.areaDepth - 1);
    }
    this.events.push({ t: 'restart', team, kind });
  }

  keepAway(p, x, z, R) {
    const d = dist(p.x, p.z, x, z);
    if (d >= R) return;
    const ux = d > 1e-6 ? (p.x - x) / d : -this.dir(p.team), uz = d > 1e-6 ? (p.z - z) / d : 0;
    const pt = this.pitch; // la spinta non deve portare il giocatore fuori dal campo (angolo vicino alla linea di fondo)
    p.x = clamp(x + ux * R, -pt.hx + 0.5, pt.hx - 0.5); p.z = clamp(z + uz * R, -pt.hz + 0.5, pt.hz - 0.5);
  }

  /** Esito del rischio di fallo su un contrasto: null, oppure { card: null | 'yellow' | 'red' }. */
  /** Esito di un contrasto a rischio commesso da q: fallo (piu' probabile se aggressivo) ed eventuale cartellino; l'azzurro e' per proteste o reazione. */
  foulRoll(q) {
    const pt = this.pitch, inOwnArea = q && q.x * this.dir(q.team) < -(pt.hx - pt.areaDepth) && Math.abs(q.z) < pt.areaWidth / 2; // in area i difensori stanno attenti: un rigore costa troppo
    if (this.rand() >= RULES.foulProb * (q ? q.k.foul : 1) * (inOwnArea ? RULES.areaCaution : 1)) return null;
    const r = this.rand(), R = RULES;
    return { card: r < R.redShare ? 'red' : r < R.redShare + R.yellowShare ? 'yellow' : r < R.redShare + R.yellowShare + R.blueShare ? 'blue' : null };
  }

  tackleFront(q, o) {
    const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1;
    return (dx * Math.cos(o.face) + dz * Math.sin(o.face)) / l; // 1 = q davanti a o, -1 = dietro
  }

  /** q commette fallo su o: sanzione e ripresa (punizione, o rigore se nella propria area). */
  callFoul(q, o, foul) {
    const pt = this.pitch, d = this.dir(o.team);
    let card = foul.card;
    if (card === 'yellow' && ++q.yellow >= 2) card = 'red'; // seconda ammonizione
    const full = this.players.filter(r => r.team === q.team && !r.out).length > RULES.minPlayers;
    if (card === 'blue' && full) this.suspend(q);
    if (card === 'red' && full) this.sendOff(q); // sotto il minimo la partita sarebbe sospesa: nessuna altra espulsione (ipotesi)
    const penalty = Math.abs(o.x) > pt.hx - pt.areaDepth && Math.sign(o.x) === d && Math.abs(o.z) < pt.areaWidth / 2;
    this.events.push({ t: 'foul', team: q.team, player: q.id, victim: o.team, card, kind: penalty ? 'penalty' : 'free' });
    if (full && card !== 'red' && this.rand() < RULES.protestShare) { // proteste: azzurro a un compagno di q, senza fallo
      const mates = this.players.filter(r => r.team === q.team && !r.out && !r.gk && !r.blueUntil);
      if (mates.length) { const m = mates[Math.floor(this.rand() * mates.length)]; this.suspend(m); this.events.push({ t: 'protest', team: m.team, player: m.id }); }
    }
    if (penalty) this.setPiece('penalty', o.team, d * (pt.hx - pt.penaltySpot), 0);
    else this.deadBall('free', o.team, clamp(o.x, -pt.hx + 1, pt.hx - 1), clamp(o.z, -pt.hz + 1, pt.hz - 1));
  }

  /** Cartellino azzurro: fuori per RULES.blueSeconds di gioco, poi rientra dalla linea laterale. */
  suspend(p) {
    this.sendOff(p); this.sentOff[p.team]--; this.suspended = (this.suspended ?? 0) + 1;
    p.blueUntil = this.matchTime + RULES.blueSeconds * this.pace;
  }

  sendOff(p) {
    p.out = true; this.sentOff[p.team]++;
    if (this.ball.owner === p.id) this.ball.owner = -1;
    p.x = 0; p.z = this.pitch.hz + 4; p.vx = p.vz = 0; p.tackleT = 0;
  }

  /** Cheap state digest for determinism / netcode checks. */
  hash() {
    let h = 2166136261;
    const mix = v => { h = Math.imul(h ^ Math.round(v * 1000), 16777619) >>> 0; };
    for (const p of this.players) { mix(p.x); mix(p.z); }
    const b = this.ball; mix(b.x); mix(b.y); mix(b.z); mix(this.score[0] * 7 + this.score[1]);
    return h;
  }
}
