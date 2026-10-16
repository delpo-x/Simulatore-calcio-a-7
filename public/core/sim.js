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
export const FEATURES = new Set();

const BTN = { up: 1, down: 2, left: 4, right: 8, cross: 16, circle: 32, square: 64, triangle: 128, l: 256, r: 512 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Home positions in "attacking +x" coordinates, one goalkeeper + outfield lines. */
function formation(n) {
  const out = n - 1, defs = Math.max(1, Math.round(out * 0.35)), atts = Math.max(1, Math.round(out * 0.25)), mids = out - defs - atts;
  const line = (count, x) => Array.from({ length: count }, (_, i) => ({ x, z: count === 1 ? 0 : (i / (count - 1) - 0.5) * 48 }));
  return [{ x: -48, z: 0, gk: true }, ...line(defs, -30), ...line(mids, -8), ...line(atts, 18)];
}

export class Sim {
  constructor({ perTeam = 7, seed = 1, halfLength = 90 } = {}) {
    this.rand = rng(seed);
    this.time = 0; this.matchTime = 0; this.halfLength = halfLength;
    this.score = [0, 0]; this.state = 'kickoff'; this.stateT = 1.0; this.kickTeam = 0; this.events = [];
    this.humans = [null, null]; // per team: input bits provider index, or null for AI
    this.prev = [0, 0]; this.charge = [0, 0]; this.active = [0, 0];
    this.players = [];
    const form = formation(perTeam);
    for (let team = 0; team < 2; team++) form.forEach((f, i) => this.players.push({
      id: this.players.length, team, gk: !!f.gk, home: f, x: 0, z: 0, vx: 0, vz: 0, face: team === 0 ? 0 : Math.PI,
      kickCd: 0, tackleT: 0, stun: 0, aiT: 0,
    }));
    this.ball = { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1 };
    this.resetPositions(0);
  }

  dir(team) { return team === 0 ? 1 : -1; }
  homePos(p) { const d = this.dir(p.team); return { x: p.home.x * d, z: p.home.z * d }; }

  resetPositions(kickTeam) {
    for (const p of this.players) {
      const h = this.homePos(p);
      p.x = h.x * (p.gk ? 1 : 0.9); p.z = h.z; p.vx = p.vz = 0; p.face = p.team === 0 ? 0 : Math.PI; p.kickCd = 0; p.tackleT = 0;
    }
    const b = this.ball; Object.assign(b, { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0, owner: -1 });
    // kicking team's most advanced outfielder starts on the ball
    const kicker = this.players.filter(p => p.team === kickTeam && !p.gk).sort((a, c) => (c.home.x - a.home.x))[0];
    kicker.x = -this.dir(kickTeam) * 0.8; kicker.z = 0; this.giveBall(kicker);
  }

  giveBall(p) { this.ball.owner = p.id; this.ball.last = p.id; p.kickCd = 0; }

  /** inputs: array(2) of button bitmasks (or null = AI) for team 0 and team 1. */
  step(inputs = [null, null]) {
    const ev = this.events = [];
    this.time += DT;
    if (this.state === 'full') return;
    if (this.state !== 'play') {
      this.stateT -= DT;
      if (this.stateT <= 0) { if (this.state === 'goal') this.resetPositions(this.kickTeam); this.state = 'play'; }
    } else {
      this.matchTime += DT;
      if (this.matchTime >= this.halfLength * 2) { this.state = 'full'; ev.push({ t: 'full' }); return; }
    }
    const frozen = this.state === 'goal';
    for (let t = 0; t < 2; t++) this.pickActive(t);
    for (const p of this.players) {
      p.kickCd = Math.max(0, p.kickCd - DT); p.tackleT = Math.max(0, p.tackleT - DT); p.stun = Math.max(0, p.stun - DT);
      const human = this.active[p.team] === p.id && inputs[p.team] != null;
      let c = frozen ? { mx: 0, mz: 0, sprint: false } : human ? this.humanControl(p, inputs[p.team]) : this.aiControl(p);
      this.move(p, c);
    }
    this.separate();
    this.stepBall();
    for (let t = 0; t < 2; t++) this.prev[t] = inputs[t] ?? 0;
    this.rules();
  }

  // ---- control selection ----
  pickActive(team) {
    const b = this.ball, mine = this.players.filter(p => p.team === team && !p.gk);
    const owner = b.owner >= 0 ? this.players[b.owner] : null;
    if (owner && owner.team === team && !owner.gk) { this.active[team] = owner.id; return; }
    const cur = this.players[this.active[team]];
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
    b.owner = -1; b.vx = dx / l * speed; b.vz = dz / l * speed; b.vy = lift; b.last = p.id; p.kickCd = 0.4;
    b.x = p.x + dx / l * 0.7; b.z = p.z + dz / l * 0.7; b.y = Math.max(b.y, 0.15);
  }

  pass(p, aim, directed) {
    let best = null, bestScore = -1e9;
    for (const q of this.players) {
      if (q.team !== p.team || q.id === p.id) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < 3) continue;
      const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - aim), Math.cos(Math.atan2(dz, dx) - aim)));
      if (directed && ang > 1.0) continue;
      const score = -ang * 20 - d * 0.3 + (q.gk ? -30 : 0);
      if (score > bestScore) { bestScore = score; best = q; }
    }
    if (!best) return this.kick(p, Math.cos(aim), Math.sin(aim), 14, 0);
    const d = dist(p.x, p.z, best.x, best.z), sp = clamp(7 + d * 0.8, 9, 24), t = d / sp;
    this.kick(p, best.x + best.vx * t * 0.8 - p.x, best.z + best.vz * t * 0.8 - p.z, sp, 0);
  }

  shoot(p, aim, power) {
    const gx = this.dir(p.team) * PITCH.hx, onGoal = Math.abs(Math.atan2(0 - p.z, gx - p.x) - aim) < 0.5;
    const tz = onGoal ? clamp((this.rand() - 0.5) * 2 * (PITCH.goalHalf - 0.5), -3, 3) : null;
    const dx = onGoal ? gx - p.x : Math.cos(aim), dz = onGoal ? tz - p.z : Math.sin(aim);
    this.kick(p, dx, dz, 14 + power * 18, 1 + power * 3.2);
  }

  // ---- AI ----
  aiControl(p) {
    const b = this.ball, d = this.dir(p.team), owner = b.owner >= 0 ? this.players[b.owner] : null;
    const has = b.owner === p.id, teamHas = owner && owner.team === p.team;
    if (p.gk) return this.aiKeeper(p, has);
    if (has) return this.aiCarrier(p);
    const mates = this.players.filter(q => q.team === p.team && !q.gk);
    const nearest = mates.reduce((m, q) => dist(q.x, q.z, b.x, b.z) < dist(m.x, m.z, b.x, b.z) ? q : m);
    if (!teamHas && nearest.id === p.id) {
      const tx = b.x + b.vx * 0.3, tz = b.z + b.vz * 0.3;
      if (owner && dist(p.x, p.z, owner.x, owner.z) < 1.6 && p.kickCd === 0 && p.tackleT === 0 && this.rand() < 0.03) p.tackleT = 0.35;
      return this.toward(p, tx, tz, true);
    }
    const h = this.homePos(p), push = teamHas ? 10 : 0;
    return this.toward(p, clamp(h.x + d * push + b.x * 0.4, -PITCH.hx + 4, PITCH.hx - 4), h.z + b.z * 0.3, false);
  }

  aiKeeper(p, has) {
    const b = this.ball, d = this.dir(p.team), gx = -d * (PITCH.hx - 1.5);
    if (has) {
      p.aiT += DT;
      if (p.aiT > 0.6) { p.aiT = 0; const t = this.players.find(q => q.team === p.team && !q.gk && Math.abs(q.x - p.x) > 20); if (t) this.kick(p, t.x - p.x, t.z - p.z, 20, 2); else this.kick(p, d, 0, 20, 2); }
      return { mx: 0, mz: 0, sprint: false };
    }
    const owner = b.owner >= 0 ? this.players[b.owner] : null;
    const danger = Math.abs(b.x - gx) < 9 && (!owner || owner.team !== p.team);
    if (danger && b.owner < 0 && dist(p.x, p.z, b.x, b.z) < 7) return this.toward(p, b.x, b.z, true);
    return this.toward(p, gx + d * clamp(Math.abs(b.x - gx) * 0.1, 0, 3), clamp(b.z * 0.4, -PITCH.goalHalf, PITCH.goalHalf), false);
  }

  aiCarrier(p) {
    const d = this.dir(p.team), gx = d * PITCH.hx, dg = dist(p.x, p.z, gx, 0);
    p.aiT += DT;
    const pressed = this.players.some(q => q.team !== p.team && dist(q.x, q.z, p.x, p.z) < 3);
    if (p.aiT > 0.4) {
      if (dg < 22 && this.rand() < 0.004) { this.shoot(p, Math.atan2(-p.z, gx - p.x), 0.6 + this.rand() * 0.4); p.aiT = 0; return { mx: 0, mz: 0, sprint: false }; }
      if (pressed && this.rand() < 0.02) { this.pass(p, Math.atan2(-p.z, d), false); p.aiT = 0; return { mx: 0, mz: 0, sprint: false }; }
    }
    // dribble towards goal, veering away from the nearest opponent
    let tx = gx, tz = clamp(p.z * 0.5, -10, 10);
    for (const q of this.players) if (q.team !== p.team && dist(q.x, q.z, p.x, p.z) < 6) tz += (p.z - q.z) * 1.5;
    return this.toward(p, tx, clamp(tz, -PITCH.hz + 3, PITCH.hz - 3), true);
  }

  toward(p, tx, tz, sprint) {
    const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
    if (l < 0.6) return { mx: 0, mz: 0, sprint: false };
    return { mx: dx / l, mz: dz / l, sprint };
  }

  // ---- physics ----
  move(p, c) {
    const max = p.stun > 0 ? 1.5 : p.tackleT > 0 ? 9.5 : c.sprint ? 8.2 : 6.2;
    let tx = c.mx * max, tz = c.mz * max;
    if (p.tackleT > 0 && !c.mx && !c.mz) { tx = Math.cos(p.face) * max; tz = Math.sin(p.face) * max; }
    const k = Math.min(1, (this.ball.owner === p.id ? 6 : 9) * DT);
    p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
    p.x = clamp(p.x + p.vx * DT, -PITCH.hx - 3, PITCH.hx + 3); p.z = clamp(p.z + p.vz * DT, -PITCH.hz - 3, PITCH.hz + 3);
    if (Math.hypot(p.vx, p.vz) > 0.8) { const a = Math.atan2(p.vz, p.vx); let da = Math.atan2(Math.sin(a - p.face), Math.cos(a - p.face)); p.face += clamp(da, -12 * DT, 12 * DT); }
  }

  separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < 0.8) { const push = (0.8 - d) / 2 / d; a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push; }
    }
  }

  stepBall() {
    const b = this.ball, ps = this.players;
    if (b.owner >= 0) {
      const o = ps[b.owner];
      // tackle: opponent in reach with an active tackle takes the ball
      for (const q of ps) if (q.team !== o.team && q.tackleT > 0 && dist(q.x, q.z, o.x, o.z) < 1.3 && q.kickCd === 0) {
        o.stun = 0.5; o.kickCd = 0.4; b.owner = -1; this.giveBall(q); q.tackleT = 0; break;
      }
    }
    if (b.owner >= 0) {
      const o = ps[b.owner];
      b.x = o.x + Math.cos(o.face) * 0.6; b.z = o.z + Math.sin(o.face) * 0.6; b.y = 0.11;
      b.vx = o.vx; b.vz = o.vz; b.vy = 0; b.last = o.id;
      return;
    }
    b.vy -= 9.8 * DT;
    const air = b.y > 0.12;
    const drag = air ? 0.15 : 0.9;
    const f = Math.max(0, 1 - drag * DT);
    b.vx *= f; b.vz *= f;
    if (!air) { const s = Math.hypot(b.vx, b.vz), dec = 1.5 * DT; if (s <= dec) b.vx = b.vz = 0; else { b.vx -= b.vx / s * dec; b.vz -= b.vz / s * dec; } }
    b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
    if (b.y < 0.11) { b.y = 0.11; b.vy = Math.abs(b.vy) > 1.5 ? -b.vy * 0.6 : 0; }
    // pickup
    const sp = Math.hypot(b.vx, b.vz);
    if (b.y < (sp > 16 ? 2.4 : 1.1)) {
      let best = null, bd = 99;
      for (const p of ps) {
        const reach = p.gk ? 1.7 : 0.9, d = dist(p.x, p.z, b.x, b.z);
        if (sp >= (p.gk ? 30 : 16) || d > reach || d >= bd || p.kickCd > 0 || p.stun > 0) continue;
        best = p; bd = d;
      }
      if (best) { b.vx = b.vy = b.vz = 0; this.giveBall(best); }
    }
  }

  // ---- rules ----
  rules() {
    if (this.state !== 'play') return;
    const b = this.ball;
    if (Math.abs(b.x) > PITCH.hx) {
      if (Math.abs(b.z) < PITCH.goalHalf && b.y < PITCH.goalH) {
        const team = b.x > 0 ? 0 : 1;
        this.score[team]++; this.state = 'goal'; this.stateT = 2.5; this.kickTeam = 1 - team; this.events.push({ t: 'goal', team });
        return;
      }
      this.restart(b.x > 0 ? 1 : -1, 0);
    } else if (Math.abs(b.z) > PITCH.hz) this.restart(0, b.z > 0 ? 1 : -1);
  }

  /** Out of play: the team that did not touch last gets the ball at the nearest legal spot. */
  restart(sx, sz) {
    const b = this.ball, last = this.players[b.last]?.team ?? 0, team = 1 - last;
    let x = clamp(b.x, -PITCH.hx + 1, PITCH.hx - 1), z = clamp(b.z, -PITCH.hz + 1, PITCH.hz - 1);
    if (sx) { x = sx * (PITCH.hx - 6); z = 0; }
    const taker = this.players.filter(p => p.team === team && !p.gk).reduce((m, p) => dist(p.x, p.z, x, z) < dist(m.x, m.z, x, z) ? p : m);
    taker.x = x; taker.z = z; Object.assign(b, { x, z, vx: 0, vz: 0, vy: 0, y: 0.11 });
    this.giveBall(taker); this.events.push({ t: 'restart', team });
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
