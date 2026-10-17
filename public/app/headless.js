// Partita simulata senza grafica (torneo, test): stessa simulazione e stesse statistiche della partita guardata.
import { Sim, SCHEMES } from '../core/sim.js';
import { MatchStats } from './stats.js';
import { lineupFor } from './teams.js';

/** Simulazione pronta per due definizioni di squadra dell'app (stesso schieramento della partita guardata). */
export function createMatch(home, away, { perTeam = 7, half = 25, seed = 1 } = {}) {
  const defs = [home, away], schemes = defs.map(d => SCHEMES[perTeam].includes(d.scheme) ? d.scheme : SCHEMES[perTeam][0]);
  const lineups = defs.map((d, i) => lineupFor(d, perTeam, schemes[i]));
  const sim = new Sim({ perTeam, seed, halfLength: half * 60, schemes, teams: lineups });
  for (const [i, d] of defs.entries()) if (d.tactics) Object.assign(sim.tac[i], d.tactics);
  return { sim, lineups, schemes };
}

/** Riassunto di una partita finita: risultato, marcatori, voti, migliore in campo, statistiche di squadra. */
export function summarize(stats, lineups) {
  const sim = stats.sim, byTeam = [0, 1].map(t => sim.players.filter(p => p.team === t));
  const players = sim.players.map(p => ({ id: p.id, team: p.team, name: stats.name(p.id), num: lineups?.[p.team][byTeam[p.team].indexOf(p)]?.number ?? 0, gk: p.gk, rating: stats.rating(p.id), ...stats.ps[p.id] }));
  const goals = stats.timeline.filter(e => e.t === 'goal').map(e => ({ team: e.team, min: e.min, name: stats.name(e.player), own: e.own, assist: e.assist >= 0 ? stats.name(e.assist) : '' }));
  return { score: [...sim.score], goals, players, best: stats.best(), rows: stats.rows(), shots: stats.shotList.map(({ team, x, z, on, goal }) => ({ team, x, z, on, goal })) };
}

/** Gioca una partita intera senza grafica e ne restituisce il riassunto. */
export function playMatch(home, away, opts = {}) {
  const { sim, lineups } = createMatch(home, away, opts), stats = new MatchStats(sim);
  while (sim.state !== 'full') { sim.step(); stats.step(); }
  return summarize(stats, lineups);
}
