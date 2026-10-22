// Test di gioco dichiarativi. Uso: node tools/game-tests.mjs [--full] [--games N] [--only testo]
// Legge tests/game/*.json; scrive reports/test-game.json e .md. Esce con 1 solo se un test "error" fallisce.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES } from '../public/core/sim.js';
import { runMatch, summarize } from './lib/matches.mjs';
import { configSync } from './lib/config.mjs';
import { pitchSize, schemeLines, scaleDiff, foulTrials, setPieceDistances, anyPlayerCounts, staminaRun, tackleTrials, collisionTrial, carryGap, launchBall, shotSpeed, sprintRun, formationLayout, measureSpeed, pressingTrigger, sprintAttr, passErrorTrials, levelMatches, teamValidation, teamDeterminism, equalTeams, sendOffTrial, backPassTrial, gkHoldTrial, offsideTrial, kickoffTrial, turnTrial, indirectInfractionTrial, opponentPassToKeeper, indirectKickTrial, skillFormula, throwInTrial } from './lib/micro.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const full = args.includes('--full');
const gi = args.indexOf('--games');
const games = gi >= 0 ? Number(args[gi + 1]) : full ? 200 : 20;
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1] : null;

const targets = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'targets.json'), 'utf8'));
const dir = path.join(ROOT, 'tests', 'game');
const tests = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  .sort((a, b) => (b.subsystem === 'prestazioni') - (a.subsystem === 'prestazioni')); // la velocita' si misura a motore "freddo", prima delle partite

const scenarios = {
  launchBall: a => launchBall(a),
  shotSpeed: a => shotSpeed(a),
  sprintRun: () => sprintRun(),
  staminaRun: () => staminaRun(),
  tackleTrials: () => tackleTrials(),
  collisionTrial: a => collisionTrial(a),
  carryGap: () => carryGap(),
  formationLayout: a => formationLayout(a.players),
  pitchSize: a => pitchSize(a.players),
  schemeLines: a => schemeLines(a.players),
  scaleDiff: () => scaleDiff(),
  foulTrials: () => foulTrials(),
  setPieceDistances: () => setPieceDistances(),
  anyPlayerCounts: () => anyPlayerCounts(),
  configSync: () => configSync(),
  sendOffTrial: () => sendOffTrial(),
  backPassTrial: () => backPassTrial(),
  gkHoldTrial: () => gkHoldTrial(),
  offsideTrial: () => offsideTrial(),
  kickoffTrial: () => kickoffTrial(),
  turnTrial: () => turnTrial(),
  indirectInfractionTrial: () => indirectInfractionTrial(),
  opponentPassToKeeper: () => opponentPassToKeeper(),
  indirectKickTrial: () => indirectKickTrial(),
  skillFormula: a => skillFormula(a),
  throwInTrial: () => throwInTrial(),
  pressingTrigger: a => pressingTrigger(a),
  sprintAttr: a => sprintAttr(a),
  passErrorTrials: a => passErrorTrials(a),
  levelMatches: a => levelMatches(a),
  teamValidation: () => teamValidation(),
  teamDeterminism: () => teamDeterminism(),
  equalTeams: a => equalTeams(a),
  measureSpeed: a => measureSpeed(a.players, a.simSeconds),
  matches: a => {
    const n = a.games ?? games;
    return summarize(Array.from({ length: n }, (_, i) => runMatch({ players: a.players ?? 7, seed: 1 + i, halfMinutes: a.halfMinutes ?? 25 })));
  },
  determinism: a => {
    const x = runMatch({ players: a.players ?? 7, seed: 7, halfMinutes: 5 }), y = runMatch({ players: a.players ?? 7, seed: 7, halfMinutes: 5 });
    return { same_hash: x.hash === y.hash };
  },
};
const cache = new Map();
const scenario = s => {
  const key = JSON.stringify(s);
  if (!cache.has(key)) cache.set(key, scenarios[s.type](s.args ?? {}));
  return cache.get(key);
};
const get = (obj, p) => p.split('.').reduce((o, k) => o?.[k], obj);

function check(t, value) {
  const e = t.expect;
  if (typeof e.value === 'boolean') return { ok: value === e.value, want: String(e.value) };
  if (e.fromTarget) {
    const [lo, hi] = targets[e.fromTarget];
    return { ok: value >= lo && value <= hi, want: `${lo}..${hi} (bersaglio)` };
  }
  if (e.value !== undefined) {
    const tol = e.tol ?? 0.03, abs = e.abs;
    const lim = abs !== undefined ? abs : Math.abs(e.value) * tol;
    return { ok: Math.abs(value - e.value) <= lim, want: `${e.value} ±${+lim.toFixed(4)}` };
  }
  const lo = e.min ?? -Infinity, hi = e.max ?? Infinity;
  return { ok: value >= lo && value <= hi, want: `${lo === -Infinity ? '' : lo}..${hi === Infinity ? '' : hi}` };
}

const results = [];
for (const t of tests) {
  if (only && !`${t.id} ${t.subsystem}`.includes(only)) continue;
  const missing = (t.requires ?? []).filter(f => !FEATURES.has(f));
  if (missing.length) { results.push({ ...pick(t), status: 'salta', note: `manca ${missing.join(', ')}` }); continue; }
  let value;
  try { value = get(scenario(t.scenario), t.metric); } catch (err) { results.push({ ...pick(t), status: 'errore', note: String(err) }); continue; }
  const bad = typeof value === 'number' ? !Number.isFinite(value) : value === undefined;
  const r = bad ? { ok: false, want: '?' } : check(t, value);
  const soft = t.severity === 'warn' || (process.env.CI && t.subsystem === 'prestazioni') /* la velocita' dipende dalla macchina */ || (t.expect.fromTarget && targets.provvisorio) || t.provisional;
  results.push({ ...pick(t), status: r.ok ? 'ok' : soft ? 'avviso' : 'errore', value, want: r.want });
}
function pick(t) { return { id: t.id, subsystem: t.subsystem, ticket: t.ticket, metric: t.metric }; }

const count = s => results.filter(r => r.status === s).length;
const fmt = v => (typeof v === 'number' ? +v.toPrecision(4) : v);
const md = ['# Test di gioco', '', `Partite per test macro: ${games}${full ? ' (completo)' : ''}. Funzionalità attive: ${[...FEATURES].join(', ') || 'nessuna'}.`, '',
  `ok ${count('ok')} · avvisi ${count('avviso')} · errori ${count('errore')} · saltati ${count('salta')}`, '',
  '| stato | id | misura | valore | atteso |', '|---|---|---|---|---|',
  ...results.map(r => `| ${r.status} | ${r.id} | ${r.metric} | ${fmt(r.value) ?? ''} | ${r.want ?? r.note ?? ''} |`)].join('\n');
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'test-game.json'), JSON.stringify({ creato: new Date().toISOString(), games, results }, null, 1));
fs.writeFileSync(path.join(ROOT, 'reports', 'test-game.md'), md + '\n');

for (const r of results) {
  if (r.status === 'ok') continue;
  console.log(`${r.status.padEnd(7)} ${r.id}  ${r.metric}  ${fmt(r.value) ?? ''}  atteso ${r.want ?? r.note}`);
}
console.log(`\nok ${count('ok')} · avvisi ${count('avviso')} · errori ${count('errore')} · saltati ${count('salta')}  (reports/test-game.md)`);
process.exit(count('errore') ? 1 : 0);
