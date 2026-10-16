// Taratura: node tools/sweep.mjs <partite> '<[{"chiave":valore},...]>' (le chiavi di AI/MOVE/RULES restano impostate tra le configurazioni).
import { AI, MOVE, RULES } from '../public/core/sim.js';
import './lib/config.mjs';
import { runMatch, summarize } from './lib/matches.mjs';
const games = Number(process.argv[2] || 5);
for (const c of JSON.parse(process.argv[3] || '[{}]')) {
  for (const [k, v] of Object.entries(c)) { for (const o of [AI, MOVE, RULES]) if (k in o) o[k] = v; }
  const s = summarize(Array.from({ length: games }, (_, i) => runMatch({ players: 7, seed: 1 + i })));
  const m = x => x.mean.toFixed(2);
  console.log(JSON.stringify(c), 'gol', m(s.goals_total), 'tiri', m(s.shots_total), 'porta', m(s.shots_on_target_total), 'pass', m(s.pass_accuracy), 'poss', m(s.possession_team0), 'falli', m(s.fouls));
}
