// Scenari controllati ("micro") per misurare un singolo comportamento del motore.
import { Sim, DT, SCHEMES, pitchFor, layout, AI } from '../../public/core/sim.js';
import { syntheticTeam, pickLineup, readTeam, readPlayer } from '../../public/core/team.js';
import { runMatch } from './matches.mjs';

/** Lancia la palla da ferma con velocità orizzontale e verticale date e ne misura la traiettoria. */
export function launchBall({ speed, lift }) {
  const s = new Sim({ perTeam: 7, seed: 1 });
  s.state = 'play';
  for (const p of s.players) { p.x = 900; p.z = 900; p.kickCd = 99; } // nessuno raccoglie la palla
  const b = s.ball;
  Object.assign(b, { x: 0, y: 0.11, z: 0, vx: speed, vy: lift, vz: 0, owner: -1 });
  const out = { max_height: 0, bounces: 0, first_landing_x: null, first_landing_t: null };
  let t = 0, wasAir = false, landed = false, prevVy = b.vy;
  while (t < 30 && Math.hypot(b.vx, b.vz) > 0.01) {
    s.stepBall(); t += DT;
    out.max_height = Math.max(out.max_height, b.y - 0.11);
    const air = b.y > 0.12;
    if (wasAir && !air && !landed) { landed = true; out.first_landing_x = b.x; out.first_landing_t = t; }
    if (landed && prevVy > 0 && b.vy <= 0 && b.y - 0.11 > 0.3) out.bounces++;
    for (const d of [10, 20, 30, 40]) {
      if (!(`time_at_${d}` in out) && b.x >= d) { out[`time_at_${d}`] = t; out[`speed_at_${d}`] = Math.hypot(b.vx, b.vz); }
    }
    wasAir = air; prevVy = b.vy;
  }
  out.range = b.x; out.stop_time = t; out.decel_to_stop = speed / t;
  return out;
}

/** Velocità orizzontale della palla subito dopo un tiro con la potenza data (0..1). */
export function shotSpeed({ power }) {
  const s = new Sim({ perTeam: 7, seed: 1 });
  s.state = 'play';
  const p = s.players[1];
  Object.assign(p, { x: 20, z: 0 });
  s.shoot(p, 0, power);
  return { speed: Math.hypot(s.ball.vx, s.ball.vz) };
}

/** Un giocatore parte da fermo e corre in sprint in linea retta per 10 secondi. */
export function sprintRun() {
  const s = new Sim({ perTeam: 7, seed: 1, pitch: pitchFor(11) });
  s.state = 'play';
  s.players.forEach((q, i) => { q.x = 900 + i * 3; q.z = 900; });
  const p = s.players[1];
  Object.assign(p, { x: -50, z: 0, vx: 0, vz: 0, face: 0 });
  Object.assign(s.ball, { x: 900, z: 0, owner: -1 });
  const c = { mx: 1, mz: 0, sprint: true }, rows = [], out = {};
  let t = 0, vmax = 0;
  for (let i = 0; i < 10 / DT; i++) {
    s.move(p, c); t += DT; vmax = Math.max(vmax, p.vx);
    rows.push([t, p.vx]);
    if (out.time_40m === undefined && p.x + 50 >= 40) out.time_40m = t;
  }
  out.max_speed = vmax;
  out.time_to_90pct = rows.find(r => r[1] >= 0.9 * vmax)?.[0];
  return out;
}

function isolated(n = 7) {
  const s = new Sim({ perTeam: n, seed: 1, pitch: pitchFor(11) });
  s.state = 'play';
  s.players.forEach((q, i) => { q.x = 900 + i * 3; q.z = 900; });
  Object.assign(s.ball, { x: 900, z: 0, owner: -1 });
  s.form = [0, 0]; // le prove su un singolo comportamento non dipendono dalla forma di giornata
  return s;
}

/** Sprint continuo di 30 s: calo della velocita' finale rispetto allo sprint a serbatoio pieno. */
export function staminaRun(seconds = 30) {
  const s = isolated(), p = s.players[1];
  Object.assign(p, { x: -50, z: 0, vx: 0, vz: 0, face: 0 });
  for (let i = 0; i < seconds / DT; i++) { s.move(p, { mx: 1, mz: 0, sprint: true }); p.x = -50; }
  return { speed_drop: 1 - Math.hypot(p.vx, p.vz) / 8.0, stamina: p.stam };
}

/** Frequenza di successo di un contrasto frontale contro un portatore che cammina. */
export function tackleTrials(n = 10000) {
  const s = isolated(), o = s.players[1], q = s.players[8];
  Object.assign(o, { x: 0, z: 0, vx: 1.5, vz: 0, face: 0 });
  Object.assign(q, { x: 1.0, z: 0, vx: 0, vz: 0, face: Math.PI });
  let ok = 0;
  for (let i = 0; i < n; i++) if (s.rand() < s.tackleChance(q, o)) ok++;
  return { success_rate: ok / n };
}

/** Urto da dietro: stordimento (s) del giocatore colpito, data la velocita' relativa. */
export function collisionTrial({ relSpeed }) {
  const s = isolated(), a = s.players[1], b = s.players[2];
  Object.assign(a, { x: 0, z: 0, vx: relSpeed, vz: 0, face: 0, stun: 0 });
  Object.assign(b, { x: 0.6, z: 0, vx: 0, vz: 0, face: 0, stun: 0 });
  s.separate();
  return { stun_seconds: b.stun, gap: Math.hypot(a.x - b.x, a.z - b.z) };
}

/** Distanza palla-portatore dopo 3 s di sprint. */
export function carryGap() {
  const s = isolated(), p = s.players[1];
  Object.assign(p, { x: -40, z: 0, vx: 0, vz: 0, face: 0 });
  s.giveBall(p);
  for (let i = 0; i < 3 / DT; i++) { s.move(p, { mx: 1, mz: 0, sprint: true }); s.stepBall(); }
  return { gap: Math.hypot(s.ball.x - p.x, s.ball.z - p.z) };
}

/** Disposizione iniziale dei giocatori per un dato numero di giocatori per squadra. */
export function formationLayout(players) {
  let minPair = Infinity, outOfBounds = 0, invalid = 0, perTeam = 0, wrongHalf = 0;
  for (const scheme of SCHEMES[players] ?? []) {
    let s;
    try { s = new Sim({ perTeam: players, seed: 1, schemes: scheme }); } catch { invalid++; continue; }
    const { hx, hz } = s.pitch;
    perTeam = s.players.filter(p => p.team === 0).length;
    s.players.forEach((a, i) => {
      if (Math.abs(a.x) > hx || Math.abs(a.z) > hz) outOfBounds++;
      if (a.team === 0 ? a.x > 0 : a.x < 0) wrongHalf++;
      for (let j = i + 1; j < s.players.length; j++) minPair = Math.min(minPair, Math.hypot(a.x - s.players[j].x, a.z - s.players[j].z));
    });
  }
  return { players_per_team: perTeam, min_pair_distance: minPair, out_of_bounds: outOfBounds, invalid_schemes: invalid, wrong_half: wrongHalf };
}

/** Dimensioni del campo e delle aree. */
export function pitchSize(players) {
  const p = pitchFor(players);
  return { length: p.hx * 2, width: p.hz * 2, goal_width: p.goalHalf * 2, area_depth: p.areaDepth, area_width: p.areaWidth,
    penalty_spot: p.penaltySpot, spot_inside_area: p.penaltySpot < p.areaDepth ? 1 : 0 };
}

/** Somma delle linee dello schema predefinito (deve valere giocatori - 1). */
export function schemeLines(players) {
  return { lines: SCHEMES[players][0].split('-').reduce((a, b) => a + Number(b), 0) };
}

/** Differenza massima tra le posizioni base normalizzate dello stesso schema su due campi diversi. */
export function scaleDiff() {
  const a = layout(7, '2-3-1', pitchFor(7)), b = layout(7, '2-3-1', pitchFor(11));
  const na = pitchFor(7), nb = pitchFor(11);
  let worst = 0;
  a.forEach((p, i) => { worst = Math.max(worst, Math.abs(p.x / (na.hx * 2) - b[i].x / (nb.hx * 2)), Math.abs(p.z / (na.hz * 2) - b[i].z / (nb.hz * 2))); });
  return { max_diff: worst };
}

/** Quota di falli, gialli e rossi su n contrasti a rischio. */
export function foulTrials(n = 400000) {
  const s = new Sim({ perTeam: 7, seed: 1 });
  let fouls = 0, yellow = 0, red = 0, blue = 0;
  for (let i = 0; i < n; i++) { const f = s.foulRoll(); if (f) { fouls++; if (f.card === 'yellow') yellow++; if (f.card === 'red') red++; if (f.card === 'blue') blue++; } }
  return { foul_rate: fouls / n, yellow_rate: yellow / fouls, red_rate: red / fouls, blue_rate: blue / fouls };
}

/** Distanze regolamentari delle riprese da fermo. */
export function setPieceDistances() {
  const out = {};
  const near = (s, x, z) => { const o = s.players.find(p => p.team === 1 && !p.gk); o.x = x; o.z = z; };
  const minOpp = (s, team) => Math.min(...s.players.filter(p => p.team !== team && !p.out).map(p => Math.hypot(p.x - s.ball.x, p.z - s.ball.z)));
  let s = new Sim({ perTeam: 7, seed: 1 });
  near(s, 11, 5); s.setPiece('free', 0, 10, 5); out.wall_distance = minOpp(s, 0);
  s = new Sim({ perTeam: 7, seed: 1 });
  const { hx, hz, penaltySpot, areaDepth, areaWidth } = s.pitch;
  near(s, hx - 1, hz - 1); s.setPiece('corner', 0, hx - 0.3, hz - 0.3); out.corner_distance = minOpp(s, 0);
  s = new Sim({ perTeam: 7, seed: 1 });
  s.players.forEach(p => { if (!p.gk) { p.x = hx - 3; p.z = (p.id % 5 - 2) * 3; } });
  s.setPiece('penalty', 0, hx - penaltySpot, 0);
  out.penalty_distance = hx - s.ball.x;
  const inArea = p => Math.abs(p.x) > hx - areaDepth && Math.sign(p.x) === 1 && Math.abs(p.z) < areaWidth / 2;
  out.penalty_intruders = s.players.filter(p => !p.out && p.id !== s.ball.owner && !(p.gk && p.team === 1) && inArea(p)).length;
  s = new Sim({ perTeam: 7, seed: 1 });
  s.players.forEach(p => { if (p.team === 1 && !p.gk) { p.x = hx - 3; p.z = (p.id % 5 - 2) * 3; } });
  s.setPiece('goalkick', 0, hx - 6, 0);
  out.goalkick_intruders = s.players.filter(p => p.team === 1 && inArea(p)).length;
  return out;
}

/** Partite brevi con 5, 6, 8, 9, 10 e 11 giocatori: devono partire e finire senza errori. */
export function anyPlayerCounts() {
  const s5 = [5, 6, 8, 9, 10, 11].map(n => {
    const x = new Sim({ perTeam: n, seed: 1, halfLength: 60 });
    let finite = true;
    for (let i = 0; i < 600 / DT && x.state !== 'full'; i++) { x.step([null, null]); if (!Number.isFinite(x.ball.x + x.ball.z)) finite = false; }
    return finite && x.state === 'full';
  });
  return { all_ok: s5.every(Boolean) };
}

/** Velocità di simulazione: secondi simulati per secondo reale. */
export function measureSpeed(players, simSeconds = 300) {
  const s = new Sim({ perTeam: players, seed: 1, halfLength: 1e9 });
  const n = Math.round(simSeconds / DT), t0 = performance.now();
  for (let i = 0; i < n; i++) s.step([null, null]);
  const wall = (performance.now() - t0) / 1000;
  return { realtime_factor: simSeconds / wall, steps_per_s: n / wall };
}

/** Distanza di pressing dell'IA (m) per un campo con il numero di giocatori dato: 14 m a 105 m di lunghezza, scalata. */
export function pressingTrigger({ players }) {
  const s = new Sim({ perTeam: players, seed: 1 });
  return { trigger: s.sc(s.tac[0].press) };
}

function lineup(level, over = {}) {
  const t = syntheticTeam('Prova', level);
  for (const pl of t.players) Object.assign(pl.attrs, over);
  return pickLineup(t, SCHEMES[7][0]);
}

/** Sprint su 40 m con la Velocita' data; tempo in secondi. */
function sprint40(speed) {
  const s = new Sim({ perTeam: 7, seed: 1, pitch: pitchFor(11), teams: [lineup(15, { Velocita: speed }), null] });
  s.state = 'play';
  s.players.forEach((q, i) => { q.x = 900 + i * 3; q.z = 900; });
  const p = s.players[1];
  Object.assign(p, { x: -50, z: 0, vx: 0, vz: 0, face: 0 });
  Object.assign(s.ball, { x: 900, z: 0, owner: -1 });
  let t = 0;
  while (p.x + 50 < 40 && t < 20) { s.move(p, { mx: 1, mz: 0, sprint: true }); t += DT; }
  return t;
}

/** Differenza di tempo su 40 m tra Velocita' lenta e veloce (s). */
export function sprintAttr({ fast, slow }) {
  return { time_diff: sprint40(slow) - sprint40(fast) };
}

/** Frequenza d'errore del passaggio (piede forte) con l'attributo Passaggi dato. */
export function passErrorTrials({ passing, n = 10000 }) {
  const s = new Sim({ perTeam: 7, seed: 1, teams: [lineup(15, { Passaggi: passing }), null] });
  const k = s.players[3].k.passErr; let err = 0;
  for (let i = 0; i < n; i++) if (s.rand() < AI.passError * k) err++;
  return { error_rate: err / n };
}

/** Un file squadra con un attributo mancante o fuori scala viene rifiutato con un messaggio che nomina giocatore e attributo. */
export function teamValidation() {
  const t = syntheticTeam('Prova', 15), raw = t.players[2];
  const mk = scouting => ({ name: 'Mario Prova', position: 'Defender', foot: 'DX', scouting });
  const full = {}; for (const k of Object.keys(raw.attrs)) full[k] = 15;
  const msg = f => { try { f(); return ''; } catch (e) { return e.message; } };
  const { Passaggi, ...noPass } = full;
  const m1 = msg(() => readPlayer(mk(noPass))), m2 = msg(() => readPlayer(mk({ ...full, Velocita: 25 })));
  return { rejected: Number(!!m1 && !!m2), names_player: Number(m1.includes('Mario Prova') && m2.includes('Mario Prova')),
    names_attr: Number(m1.includes('Passaggi') && m2.includes('Velocita')), accepted_valid: Number(!msg(() => readPlayer(mk(full)))) };
}

/** Stessa partita due volte con squadre da file: stesso hash. */
export function teamDeterminism() {
  const run = () => runMatch({ players: 7, seed: 4, halfMinutes: 3, teams: [lineup(13), lineup(16)] }).hash;
  return { same_hash: run() === run() };
}

/** Due squadre con tutti gli attributi a 15: differenza relativa dei gol medi. */
export function equalTeams({ games = 60 }) {
  let g0 = 0, g1 = 0;
  for (let i = 0; i < games; i++) { const r = runMatch({ players: 7, seed: 100 + i, teams: [lineup(15), lineup(15)], noForm: true }); g0 += r.goals[0]; g1 += r.goals[1]; }
  return { goal_diff_rel: Math.abs(g0 - g1) / Math.max(1, (g0 + g1) / 2), goals0: g0 / games, goals1: g1 / games };
}

/** Cartellini a squadra ridotta: rosso (resta fuori) e azzurro (rientra dopo blueSeconds di gioco). */
export function sendOffTrial() {
  const mk = () => { const s = new Sim({ perTeam: 7, seed: 1, halfLength: 1e6 }); s.state = 'play'; return s; };
  const live = (s, t) => s.players.filter(p => p.team === t && !p.out).length;
  let s = mk(), q = s.players[3], o = s.players[10];
  s.callFoul(q, o, { card: 'red' }); s.state = 'play';
  const out = { players_on_field: live(s, 0) };
  s = mk(); q = s.players[3]; o = s.players[10];
  s.callFoul(q, o, { card: 'blue' }); s.state = 'play';
  out.blue_on_field = live(s, 0);
  let t = 0, back = null;
  while (t < 400 && back === null) { s.state = 'play'; s.stateT = 0; s.step([null, null]); t += DT; if (live(s, 0) === 7) back = s.matchTime; }
  out.blue_minutes = back === null ? -1 : back / 60;
  return out;
}

function quiet(n = 7) {
  const s = new Sim({ perTeam: n, seed: 1, halfLength: 1e6 });
  s.state = 'play'; s.form = [0, 0];
  s.players.forEach((q, i) => { q.x = 900 + i * 3; q.z = 900; q.kickCd = 99; });
  return s;
}

/** Retropassaggio: un compagno calcia al portiere, che prende la palla con le mani -> punizione indiretta agli avversari. */
export function backPassTrial() {
  const s = quiet(), k = s.players[3], gk = s.players[0];
  Object.assign(k, { x: -10, z: 0 }); Object.assign(gk, { x: -23, z: 0, kickCd: 0 });
  Object.assign(s.ball, { x: -10, z: 0, y: 0.11, owner: -1, vx: 0, vz: 0 });
  s.kick(k, -1, 0, 12, 0);
  let violation = false, taker = -1;
  for (let i = 0; i < 4 / DT; i++) { s.step([null, null]); if (s.events.some(e => e.t === 'backpass')) { violation = true; break; } }
  if (violation) taker = s.players[s.ball.owner]?.team ?? -1;
  return { violation: Number(violation), kick_to_opponents: Number(taker === 1), indirect_active: Number(!!s.indirect) };
}

/** Il portiere prende la palla calciata da un avversario: nessuna infrazione. */
export function opponentPassToKeeper() {
  const s = quiet(), k = s.players[10], gk = s.players[0];
  Object.assign(k, { x: -10, z: 0 }); Object.assign(gk, { x: -23, z: 0, kickCd: 0 });
  Object.assign(s.ball, { x: -10, z: 0, y: 0.11, owner: -1, vx: 0, vz: 0 });
  s.kick(k, -1, 0, 12, 0);
  let violation = false, had = false;
  for (let i = 0; i < 4 / DT; i++) { s.step([null, null]); if (s.events.some(e => e.t === 'backpass')) violation = true; if (s.ball.owner === 0) had = true; }
  return { violation: Number(violation), keeper_has_ball: Number(had) };
}

/** Punizione indiretta: tiro diretto in porta senza secondo tocco -> niente gol; con un secondo tocco -> gol. */
export function indirectKickTrial() {
  const out = {};
  for (const touch of [false, true]) {
    const s = quiet();
    const a = s.players[3], b2 = s.players[4];
    Object.assign(a, { x: 12, z: 0, face: 0 }); Object.assign(b2, { x: 11, z: 3 });
    Object.assign(s.ball, { x: 12, z: 0, y: 0.11, owner: -1, vx: 0, vz: 0 });
    s.indirect = { team: 0, taker: a.id };
    s.kick(a, 1, 0, 25, 0);
    if (touch) { s.indirect = null; } // un secondo giocatore tocca la palla
    for (let i = 0; i < 3 / DT && s.score[0] === 0 && s.state === 'play'; i++) s.step([null, null]);
    out[touch ? 'goal_after_second_touch' : 'goal_direct'] = s.score[0];
  }
  return out;
}
