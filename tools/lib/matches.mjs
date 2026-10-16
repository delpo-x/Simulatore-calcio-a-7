// Esecuzione di partite IA contro IA senza grafica, con raccolta di statistiche.
import { Sim, DT } from '../../public/core/sim.js';

/** Gioca una partita intera e ne restituisce le statistiche (e, a richiesta, eventi e traccia a 10 Hz). */
export function runMatch({ players = 7, seed = 1, halfMinutes = 25, trace = false, events = false } = {}) {
  const sim = new Sim({ perTeam: players, seed, halfLength: halfMinutes * 60 });
  const shots = [0, 0], passes = [0, 0], poss = [0, 0];
  const shoot = sim.shoot.bind(sim), pass = sim.pass.bind(sim);
  sim.shoot = (p, ...a) => { shots[p.team]++; return shoot(p, ...a); };
  sim.pass = (p, ...a) => { passes[p.team]++; return pass(p, ...a); };
  const passTo = sim.passTo.bind(sim);
  sim.passTo = (p, ...a) => { passes[p.team]++; return passTo(p, ...a); };

  const maxSteps = Math.ceil((halfMinutes * 2 * 60 * 3) / DT); // margine per le pause dopo i gol
  const log = [], tr = [];
  let passOk = 0, passLost = 0, fouls = 0;
  let steps = 0, finite = true;
  const t0 = performance.now();
  while (sim.state !== 'full' && steps < maxSteps) {
    sim.step([null, null]); steps++;
    const b = sim.ball;
    if (!Number.isFinite(b.x + b.y + b.z)) finite = false;
    if (b.owner >= 0) poss[sim.players[b.owner].team]++;
    for (const e of sim.events) { if (e.t === 'passOk') passOk++; else if (e.t === 'passLost') passLost++; else if (e.t === 'foul') fouls++; }
    if (events) for (const e of sim.events) log.push({ time: +(steps * DT).toFixed(2), ...e });
    if (trace && steps % 6 === 0) {
      tr.push([+(steps * DT).toFixed(1), +b.x.toFixed(2), +b.z.toFixed(2), +b.y.toFixed(2),
        ...sim.players.flatMap(p => [+p.x.toFixed(2), +p.z.toFixed(2)])]);
    }
  }
  const owned = poss[0] + poss[1] || 1;
  return {
    seed, players, finished: sim.state === 'full', finite,
    simSeconds: +(steps * DT).toFixed(1), wallMs: Math.round(performance.now() - t0),
    goals: [...sim.score], shots, passes, passOk, passLost, fouls,
    passAccuracy: passOk / ((passOk + passLost) || 1),
    possession: [poss[0] / owned, poss[1] / owned],
    hash: sim.hash(),
    ...(events ? { events: log } : {}), ...(trace ? { trace: tr } : {}),
  };
}

const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };

export function stats(values) {
  return { mean: mean(values), min: Math.min(...values), max: Math.max(...values), std: std(values) };
}

/** Riepilogo su più partite. */
export function summarize(runs) {
  const col = f => runs.map(f);
  return {
    games: runs.length,
    goals_total: stats(col(r => r.goals[0] + r.goals[1])),
    shots_total: stats(col(r => r.shots[0] + r.shots[1])),
    passes_total: stats(col(r => r.passes[0] + r.passes[1])),
    pass_accuracy: stats(col(r => r.passAccuracy)),
    fouls: stats(col(r => r.fouls)),
    possession_team0: stats(col(r => r.possession[0])),
    possession_team1: stats(col(r => r.possession[1])),
    finished_all: runs.every(r => r.finished),
    finite_all: runs.every(r => r.finite),
  };
}
