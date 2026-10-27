// Partita simulata senza grafica (torneo, test): stessa simulazione e stesse statistiche della partita guardata.
import { Sim, SCHEMES } from '../core/sim.js';
import { MatchStats } from './stats.js';
import { lineupFor } from './teams.js';

/** Simulazione pronta per due definizioni di squadra dell'app (stesso schieramento della partita guardata). */
export function createMatch(home, away, { perTeam = 7, half = 25, seed = 1, weather = 'clear' } = {}) {
  const defs = [home, away], schemes = defs.map(d => SCHEMES[perTeam].includes(d.scheme) ? d.scheme : SCHEMES[perTeam][0]);
  const lineups = defs.map((d, i) => lineupFor(d, perTeam, schemes[i]));
  const sim = new Sim({ perTeam, seed, halfLength: half * 60, schemes, teams: lineups, weather });
  for (const [i, d] of defs.entries()) if (d.tactics) Object.assign(sim.tac[i], d.tactics);
  return { sim, lineups, schemes };
}

/** Riassunto di una partita finita: risultato, marcatori, voti, migliore in campo, statistiche di squadra. */
export function summarize(stats, lineups) {
  const sim = stats.sim, byTeam = [0, 1].map(t => sim.players.filter(p => p.team === t));
  const players = sim.players.map(p => ({ id: p.id, team: p.team, name: stats.name(p.id), num: lineups?.[p.team][byTeam[p.team].indexOf(p)]?.number ?? 0, gk: p.gk, rating: stats.rating(p.id), ...stats.ps[p.id] }));
  players.push(...stats.left.map(x => ({ ...x, num: x.num || lineups?.[x.team][byTeam[x.team].indexOf(sim.players[x.id])]?.number || 0 }))); // chi e' uscito per un cambio
  const goals = stats.timeline.filter(e => e.t === 'goal').map(e => ({ team: e.team, min: e.min, name: stats.name(e.player), own: e.own, assist: e.assist >= 0 ? stats.name(e.assist) : '' }));
  return { score: [...sim.score], goals, players, best: stats.best(), rows: stats.rows(), shots: stats.shotList.map(({ team, x, z, on, goal }) => ({ team, x, z, on, goal })) };
}

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Probabilita' di segnare un rigore della lotteria (modello del progetto, non la fisica della partita): circa 78% con rigorista e portiere medi, meno con un rigorista scarso o un portiere dai buoni riflessi. */
export function penaltyChance(taker, keeper) {
  return Math.max(0.5, Math.min(0.95, 0.78 - 0.15 * (taker.k.penaltyErr - 1) - 0.25 * (keeper.k.reach - 1)));
}

/** Calci di rigore dopo un pareggio a eliminazione diretta: 5 per parte a turno (si chiude appena il risultato e' deciso), poi a oltranza.
 *  Nella simulazione il portiere sul dischetto a 8 m para quasi tutto (i riflessi sono tarati sull'azione), quindi l'esito di ogni rigore viene da penaltyChance. */
export function shootout(home, away, { perTeam = 7, seed = 1 } = {}) {
  const { sim } = createMatch(home, away, { perTeam, seed }), score = [0, 0], kicks = [], rand = rng(seed * 2654435761);
  const order = [0, 1].map(t => sim.players.filter(p => p.team === t && !p.gk).sort((a, b) => a.k.penaltyErr - b.k.penaltyErr || a.id - b.id)); // prima i rigoristi migliori
  const keeper = [0, 1].map(t => sim.players.find(p => p.team === t && p.gk));
  for (let r = 0; r < 40; r++) {
    for (const t of [0, 1]) {
      const p = order[t][r % order[t].length], ch = penaltyChance(p, keeper[1 - t]), x = rand(), goal = x < ch;
      score[t] += goal; kicks.push({ team: t, name: p.name ?? '', goal, how: goal ? 'gol' : x < ch + (1 - ch) * 0.65 ? 'parato' : 'fuori' });
      if (r < 5) { // rigori ancora da tirare nei primi 5: si chiude se una squadra non puo' piu' recuperare
        const left = [4 - r, 4 - r + (t === 0 ? 1 : 0)];
        if (score[0] + left[0] < score[1] || score[1] + left[1] < score[0]) return { score, kicks };
      }
    }
    if (r >= 4 && score[0] !== score[1]) return { score, kicks };
  }
  score[seed % 2]++; // 40 serie in parita' (non succede in pratica): decide il sorteggio
  return { score, kicks };
}

/** Gioca una partita intera senza grafica e ne restituisce il riassunto. */
export function playMatch(home, away, opts = {}) {
  const { sim, lineups } = createMatch(home, away, opts), stats = new MatchStats(sim);
  while (sim.state !== 'full') { sim.step(); stats.step(); }
  return summarize(stats, lineups);
}
