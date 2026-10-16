// Registratore di partite. Uso:
//   node tools/run-matches.mjs --games 200 --players 7 --seed 1 [--half-minutes 25] [--trace] [--events] [--out reports]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runMatch, summarize } from './lib/matches.mjs';
import './lib/config.mjs'; // applica config/params.json al motore

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const o = { games: 200, players: 7, seed: 1, halfMinutes: 25, trace: false, events: false, out: path.join(ROOT, 'reports') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--games') o.games = Number(argv[++i]);
    else if (a === '--players') o.players = Number(argv[++i]);
    else if (a === '--seed') o.seed = Number(argv[++i]);
    else if (a === '--half-minutes') o.halfMinutes = Number(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--trace') o.trace = true;
    else if (a === '--events') o.events = true;
    else throw new Error(`argomento sconosciuto: ${a}`);
  }
  return o;
}

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);

const o = parseArgs(process.argv.slice(2));
const runs = [];
const t0 = performance.now();
for (let i = 0; i < o.games; i++) runs.push(runMatch({ players: o.players, seed: o.seed + i, halfMinutes: o.halfMinutes, trace: o.trace, events: o.events }));
const wall = (performance.now() - t0) / 1000;

const report = {
  creato: new Date().toISOString(),
  opzioni: { games: o.games, players: o.players, seed: o.seed, halfMinutes: o.halfMinutes },
  impronte: { params: sha(path.join(ROOT, 'config', 'params.json')), sim: sha(path.join(ROOT, 'public', 'core', 'sim.js')) },
  riepilogo: summarize(runs),
  partite: runs,
};
fs.mkdirSync(o.out, { recursive: true });
const file = path.join(o.out, `matches-${o.players}v${o.players}-${Date.now()}.json`);
fs.writeFileSync(file, JSON.stringify(report));

const s = report.riepilogo, f = v => v.mean.toFixed(2);
console.log(`${o.games} partite ${o.players}v${o.players} in ${wall.toFixed(1)} s`);
console.log(`gol totali media ${f(s.goals_total)} (min ${s.goals_total.min}, max ${s.goals_total.max}, dev.std ${s.goals_total.std.toFixed(2)})`);
console.log(`tiri totali media ${f(s.shots_total)}; passaggi totali media ${f(s.passes_total)}`);
console.log(`possesso squadra 0 media ${(s.possession_team0.mean * 100).toFixed(1)}%`);
console.log(`tutte concluse: ${s.finished_all}; valori finiti: ${s.finite_all}`);
console.log(`report: ${path.relative(ROOT, file)}`);
