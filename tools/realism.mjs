// Pagella di realismo. Uso: node tools/realism.mjs [--games N] [--seed S] [--half M]
// Ogni lancio riparte da zero: semi nuovi (da orologio, salvo --seed), nessuna cache, tutti i cancelli rivalutati.
// Esce con 1 se un cancello fallisce. Soglie: ipotesi di lavoro (calcio a 7, 2x25 min), non dati ufficiali CSI ne' di PES 6.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sim, DT, SCHEMES, AI, RULES } from '../public/core/sim.js';
import { syntheticTeam, pickLineup } from '../public/core/team.js';
import { applyParams } from '../public/core/params.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
applyParams(JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'params.json'), 'utf8')));
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'targets.json'), 'utf8'));
const sj = process.argv.indexOf('--set'); // prove senza salvare: --set '{"AI":{"forceShot":6},"RULES":{}}'
if (sj > 0) { const o = JSON.parse(process.argv[sj + 1]); Object.assign(AI, o.AI ?? {}); Object.assign(RULES, o.RULES ?? {}); }
const fast = process.argv.includes('--fast'); // salta cancelli D ed E (solo per la taratura; la pagella ufficiale non li salta)
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const games = arg('games', 40), half = arg('half', 25), seed0 = arg('seed', Date.now() % 1e6);
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };

/** Una partita con tutte le misure di realismo raccolte tick per tick. */
function play(seed, teams) {
  const s = new Sim({ perTeam: 7, seed, halfLength: half * 60, teams });
  const L = s.pitch.hx * 2, W = s.pitch.hz * 2;
  const m = { shotDist: [], passLen: [], spells: [], thirds: [0, 0, 0], restarts: {}, goalsHalf: [0, 0], maxPlayerSpeed: 0, maxBallSpeed: 0,
    teleports: 0, outside: 0, width: [], depth: [], lineGap: [], touches: 0, shots: 0, onTarget: 0, passOk: 0, passLost: 0, fouls: 0, cards: { yellow: 0, blue: 0, red: 0 },
    own: [0, 0], stuck: 0, ticks: 0 };
  const shoot = s.shoot.bind(s), passTo = s.passTo.bind(s);
  s.shoot = (p, ...a) => { const r = shoot(p, ...a); m.shotDist.push(Math.abs(p.x - s.dir(p.team) * s.pitch.hx)); m.shots++; return r; };
  s.passTo = (p, q, ...a) => { m.passLen.push(Math.hypot(p.x - q.x, p.z - q.z)); return passTo(p, q, ...a); };
  const prev = s.players.map(p => [p.x, p.z]);
  let spellTeam = -1, spellT = 0, idle = 0, last = [s.ball.x, s.ball.z];
  const max = Math.ceil(half * 2 * 60 * 3 / DT);
  let steps = 0;
  while (s.state !== 'full' && steps < max) {
    s.step([null, null]); steps++;
    const b = s.ball, active = s.state === 'play';
    m.maxBallSpeed = Math.max(m.maxBallSpeed, Math.hypot(b.vx, b.vz, b.vy ?? 0));
    const reset = s.events.some(e => e.t === 'restart' || e.t === 'goal' || e.t === 'blueEnd');
    let jumps = 0;
    s.players.forEach((p, i) => {
      if (!p.out) {
        m.maxPlayerSpeed = Math.max(m.maxPlayerSpeed, Math.hypot(p.vx, p.vz));
        if (Math.hypot(p.x - prev[i][0], p.z - prev[i][1]) > 1.0 && s.state === 'play' && !reset) jumps++;
        if (Math.abs(p.x) > s.pitch.hx + 3.5 || Math.abs(p.z) > s.pitch.hz + 3.5) m.outside++;
      }
      prev[i] = [p.x, p.z];
    });
    if (jumps && jumps < 4) m.teleports += jumps; // salti di squadra intera = riposizionamento (intervallo, dopo un gol)
    for (const e of s.events) {
      if (e.t === 'passOk') m.passOk++; else if (e.t === 'passLost') m.passLost++;
      else if (e.t === 'restart') m.restarts[e.kind] = (m.restarts[e.kind] || 0) + 1;
      else if (e.t === 'goal') m.goalsHalf[s.matchTime > half * 60 ? 1 : 0]++;
      else if (e.t === 'protest') m.cards.blue++;
      else if (e.t === 'foul') { m.fouls++; if (e.card) m.cards[e.card]++; }
    }
    if (!active) { spellTeam = -1; continue; }
    m.ticks++;
    m.thirds[Math.min(2, Math.floor((b.x + s.pitch.hx) / L * 3))]++;
    const owner = b.owner >= 0 ? s.players[b.owner].team : -1;
    if (owner >= 0) m.own[owner]++;
    if (owner >= 0) { if (owner === spellTeam) spellT += DT; else { if (spellTeam >= 0) m.spells.push(spellT); spellTeam = owner; spellT = 0; } }
    if (steps % 60 === 0) {
      for (const t of [0, 1]) {
        const f = s.players.filter(p => p.team === t && !p.gk && !p.out);
        if (f.length < 3) continue;
        const xs = f.map(p => p.x), zs = f.map(p => p.z);
        m.depth.push((Math.max(...xs) - Math.min(...xs)) / L); m.width.push((Math.max(...zs) - Math.min(...zs)) / W);
      }
      const moved = Math.hypot(b.x - last[0], b.z - last[1]) > 0.05 || b.owner >= 0;
      idle = moved ? 0 : idle + 1; last = [b.x, b.z]; if (idle > 20) { m.stuck++; idle = 0; }
    }
  }
  m.finished = s.state === 'full'; m.score = [...s.score]; m.hash = s.hash(); m.L = L; m.W = W;
  return m;
}

const gates = [];
const gate = (id, value, lo, hi, note = '') => gates.push({ id, value, lo, hi, ok: Number.isFinite(value) && value >= lo && value <= hi, note });
const runs = Array.from({ length: games }, (_, i) => play(seed0 + i));
if (process.argv.includes('--dump')) console.log(runs.map(r => [r.own.join('/'), r.teleports, r.score.join('-')].join(' ')).join(String.fromCharCode(10)));

// A. Statistiche di partita (dati del girone)
const col = f => runs.map(f);
gate('A.gol_totali', mean(col(r => r.score[0] + r.score[1])), ...T.gol_totali);
gate('A.tiri_totali', mean(col(r => r.shots)), ...T.tiri_totali);
gate('A.precisione_passaggi', mean(col(r => r.passOk / ((r.passOk + r.passLost) || 1))), ...T.precisione_passaggi);
gate('A.possesso_varianza', std(col(r => r.own[0] / ((r.own[0] + r.own[1]) || 1))), 0.04, 0.12, 'dev.std del possesso di una squadra');
gate('A.possesso_medio', mean(col(r => r.own[0] / ((r.own[0] + r.own[1]) || 1))), ...T.possesso_squadra);
gate('A.falli', mean(col(r => r.fouls)), ...T.falli_totali);
gate('A.gialli', mean(col(r => r.cards.yellow)), ...T.gialli_per_partita);

// B. Fisica e cinematica credibili
gate('B.velocita_max_giocatore_m/s', Math.max(...col(r => r.maxPlayerSpeed)), 5, 9.5, 'sprint umano 7-9 m/s');
gate('B.velocita_max_palla_m/s', Math.max(...col(r => r.maxBallSpeed)), 15, 38, 'tiro forte ~30 m/s');
gate('B.teletrasporti', runs.reduce((a, r) => a + r.teleports, 0), 0, 0);
gate('B.fuori_campo', runs.reduce((a, r) => a + r.outside, 0), 0, 0);
gate('B.palla_ferma', runs.reduce((a, r) => a + r.stuck, 0), 0, 0);
gate('B.partite_concluse', col(r => r.finished).every(Boolean) ? 1 : 0, 1, 1);

// C. Gioco: forma, ritmo, zone, azioni
const all = f => runs.flatMap(f);
gate('C.larghezza_squadra', mean(all(r => r.width)), 0.45, 0.85, 'quota larghezza campo occupata dai 6 di movimento');
gate('C.profondita_squadra', mean(all(r => r.depth)), 0.25, 0.60, 'quota lunghezza campo');
gate('C.durata_possesso_s', mean(all(r => r.spells)), 3, 14, 'durata media di un possesso');
gate('C.possesso_lungo_p90_s', pct(all(r => r.spells), 0.9), 8, 40);
gate('C.lunghezza_passaggio_m', mean(all(r => r.passLen)), 7, 16);
gate('C.lanci_lunghi_quota', all(r => r.passLen).filter(d => d > 25).length / (all(r => r.passLen).length || 1), 0.01, 0.15, 'passaggi > 25 m');
gate('C.distanza_tiro_m', mean(all(r => r.shotDist)), 7, 14, 'in 11v11 ~18 m, scalato su 50 m');
gate('C.tiri_da_fuori_quota', all(r => r.shotDist).filter(d => d > 16).length / (all(r => r.shotDist).length || 1), 0.03, 0.3, 'tiri > 16 m (~33 m in 11v11: rari)');
const thirds = [0, 1, 2].map(i => runs.reduce((a, r) => a + r.thirds[i], 0) / runs.reduce((a, r) => a + r.ticks, 1));
gate('C.terzo_centrale', thirds[1], 0.28, 0.45, 'palla nel terzo centrale');
gate('C.terzi_laterali_equilibrio', Math.abs(thirds[0] - thirds[2]), 0, 0.10, 'simmetria tra i due lati; soglia ~2 errori standard del rumore di forma con 40 partite (possesso medio squadra 0 = 0,501 +-0,009 su 80 partite)');
gate('C.calci_angolo', mean(col(r => r.restarts.corner || 0)), 2, 10);
gate('C.rimesse_laterali', mean(col(r => r.restarts.throwin || 0)), 8, 40);
gate('C.rinvii_portiere', mean(col(r => r.restarts.goalkick || 0)), 4, 25);
gate('C.gol_secondo_tempo_quota', runs.reduce((a, r) => a + r.goalsHalf[1], 0) / (runs.reduce((a, r) => a + r.goalsHalf[0] + r.goalsHalf[1], 0) || 1), 0.4, 0.62);

// D. Coerenza di forza: squadra migliore vince di piu', nessun vantaggio di lato
const duel = (a, b, n) => { let w = 0, d = 0; for (let i = 0; i < n; i++) { const m = play(seed0 + 500000 + i, [pickLineup(syntheticTeam('A', a), SCHEMES[7][0]), pickLineup(syntheticTeam('B', b), SCHEMES[7][0])]); if (m.score[0] > m.score[1]) w++; else if (m.score[0] === m.score[1]) d++; } return (w + d / 2) / n; };
const n = Math.max(20, Math.round(games / 2));
if (!fast) {
gate('D.forte_vs_debole_18_12', duel(18, 12, n), 0.7, 1);
gate('D.medio_vs_debole_15_12', duel(15, 12, n), 0.55, 0.9);
gate('D.pari_livello_15_15', duel(15, 15, n), 0.35, 0.65, 'nessun vantaggio sistematico di lato');

// E. Riproducibilita'
gate('E.determinismo', play(7).hash === play(7).hash ? 1 : 0, 1, 1);
}

const pass = gates.filter(g => g.ok).length;
const f = v => (typeof v === 'number' ? +v.toPrecision(4) : v);
const md = [`# Pagella di realismo`, '', `seme ${seed0}, ${games} partite 7v7 (${half}+${half} min). Cancelli superati: ${pass}/${gates.length}.`, '',
  '| esito | cancello | valore | atteso | nota |', '|---|---|---|---|---|',
  ...gates.map(g => `| ${g.ok ? 'ok' : 'FALLITO'} | ${g.id} | ${f(g.value)} | ${g.lo}..${g.hi} | ${g.note} |`)].join('\n');
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'realism.md'), md + '\n');
for (const g of gates.filter(g => !g.ok)) console.log(`FALLITO ${g.id}  ${f(g.value)}  atteso ${g.lo}..${g.hi}  ${g.note}`);
console.log(`\nrealismo: ${pass}/${gates.length} cancelli (seme ${seed0})  -> reports/realism.md`);
process.exit(pass === gates.length ? 0 : 1);
