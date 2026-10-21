// Ricerca dei parametri per il profilo "FIFA 10" (cifre dell'utente): hill-climbing con semi comuni.
// Uso: node tools/tune.mjs [--iters 40] [--games 36] [--seed 5000] [--start '{"AI":{...},"MATCH":{...},"RULES":{...}}']
// Scrive i migliori valori in reports/tune.json; non modifica sim.js ne' params.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import os from 'node:os';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

if (process.env.TUNE_WORKER) {
  const { Sim, DT, AI, RULES, MATCH, MOVE } = await import('../public/core/sim.js');
  const { applyParams } = await import('../public/core/params.js');
  applyParams(JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'params.json'), 'utf8')));
  process.on('message', ({ id, set, seeds }) => {
    Object.assign(AI, set.AI ?? {}); Object.assign(RULES, set.RULES ?? {}); Object.assign(MATCH, set.MATCH ?? {}); Object.assign(MOVE, set.MOVE ?? {});
    const out = [];
    for (const seed of seeds) {
      const s = new Sim({ perTeam: 7, seed, halfLength: 25 * 60 });
      const m = { shots: 0, on: 0, goals: 0, passOk: 0, passLost: 0, corners: 0, fouls: 0, spells: [], mid: 0, ticks: 0 };
      const shoot = s.shoot.bind(s);
      s.shoot = (p, ...a) => {
        const r = shoot(p, ...a), b = s.ball, gx = s.dir(p.team) * s.pitch.hx; m.shots++;
        const t = (gx - b.x) / (b.vx || 1e-9);
        if (t > 0 && Math.abs(b.z + b.vz * t) < s.pitch.goalHalf) { const y = b.y + b.vy * t - 4.9 * t * t; if (y > 0 && y < s.pitch.goalH) m.on++; }
        return r;
      };
      let spellTeam = -1, spellT = 0, steps = 0;
      const max = Math.ceil(25 * 2 * 60 * 3 / DT);
      while (s.state !== 'full' && steps < max) {
        s.step([null, null]); steps++;
        for (const e of s.events) {
          if (e.t === 'passOk') m.passOk++; else if (e.t === 'passLost') m.passLost++;
          else if (e.t === 'restart' && e.kind === 'corner') m.corners++;
          else if (e.t === 'foul') m.fouls++;
        }
        if (s.state !== 'play') { spellTeam = -1; continue; }
        m.ticks++; if (Math.abs(s.ball.x) < s.pitch.hx / 3) m.mid++;
        const owner = s.ball.owner >= 0 ? s.players[s.ball.owner].team : -1;
        if (owner >= 0) { if (owner === spellTeam) spellT += DT; else { if (spellTeam >= 0) m.spells.push(spellT); spellTeam = owner; spellT = 0; } }
      }
      m.goals = s.score[0] + s.score[1];
      out.push({ ...m, mid: m.mid / (m.ticks || 1), spells: m.spells.reduce((a, b) => a + b, 0) / (m.spells.length || 1) });
    }
    process.send({ id, out });
  });
} else {
  const cores = Math.max(2, Math.min(os.cpus().length - 2, 10));
  const workers = Array.from({ length: cores }, () => fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, TUNE_WORKER: '1' } }));
  const pending = new Map(); let nid = 0;
  for (const w of workers) w.on('message', ({ id, out }) => { const r = pending.get(id); pending.delete(id); r(out); });
  const evalSet = async (set, seeds) => {
    const chunks = workers.map(() => []); seeds.forEach((s, i) => chunks[i % cores].push(s));
    const res = await Promise.all(workers.map((w, i) => chunks[i].length ? new Promise(r => { const id = nid++; pending.set(id, r); w.send({ id, set, seeds: chunks[i] }); }) : []));
    const all = res.flat(), mean = f => all.reduce((a, r) => a + f(r), 0) / all.length;
    return { shots: mean(r => r.shots), on: mean(r => r.on), goals: mean(r => r.goals), passes: mean(r => r.passOk + r.passLost), acc: mean(r => r.passOk / ((r.passOk + r.passLost) || 1)), poss: mean(r => r.spells), mid: mean(r => r.mid), corners: mean(r => r.corners), fouls: mean(r => r.fouls) };
  };
  // obiettivo (cifre dell'utente) e tolleranza
  const TGT = { shots: [20, 2], on: [12, 0.8], goals: [5, 0.5], passes: [120, 40], poss: [1.5, 100], corners: [10, 1.2], fouls: [6, 0.8], acc: [0.70, 0.02], mid: [0.34, 0.03] };
  const loss = m => Object.entries(TGT).reduce((a, [k, [t, tol]]) => a + ((m[k] - t) / tol) ** 2, 0);
  // parametri: [gruppo, chiave, min, max, passo relativo]
  const SPACE = [['AI', 'tackleEager', 0.004, 0.5, 0.3], ['AI', 'tackleFoul', 0.15, 1, 0.2], ['RULES', 'foulProb', 0.03, 0.6, 0.25],
    ['AI', 'shootEager', 0.01, 0.8, 0.25], ['AI', 'shotAnglePerM', 0.5, 5, 0.25], ['AI', 'passBase', 0.015, 0.8, 0.25], ['AI', 'parryExtra', 0, 0.7, 0.25],
    ['AI', 'blockProb', 0, 0.9, 0.3], ['AI', 'passSlip', 0.1, 0.8, 0.2], ['AI', 'forceShot', 2, 8, 0.2], ['AI', 'pressTrigger', 6, 16, 0.2], ['AI', 'shotAngle', 1, 8, 0.25], ['MOVE', 'tackleBase', 0.08, 0.6, 0.2], ['AI', 'shieldSeconds', 0.3, 3, 0.25], ['AI', 'passMin', 0.0, 0.6, 0.25], ['AI', 'risk', 0.1, 0.9, 0.25], ['AI', 'passPressed', 0.05, 0.9, 0.25], ['AI', 'mateGap', 4, 12, 0.2], ['AI', 'passError', 0.02, 0.2, 0.25], ['AI', 'attackDepth', 6, 24, 0.2], ['AI', 'blockDepth', 0.3, 1.5, 0.2], ['AI', 'shotMargin', 0.1, 1.2, 0.25], ['AI', 'shotFarPost', 0.3, 1, 0.2]];
  const cur = JSON.parse(arg('start', '{}')); for (const g of ['MATCH', 'AI', 'RULES', 'MOVE']) cur[g] = { ...(cur[g] ?? {}) }; cur.MATCH.pace = 0.1; // partita di 5 minuti reali = 50 sul cronometro
  const { AI, RULES, MATCH, MOVE } = await import('../public/core/sim.js');
  const { applyParams } = await import('../public/core/params.js');
  applyParams(JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'params.json'), 'utf8')));
  const live = { AI, RULES, MATCH, MOVE };
  for (const [g, k] of SPACE) cur[g][k] ??= live[g][k];
  const iters = Number(arg('iters', 40)), games = Number(arg('games', 36)), seed0 = Number(arg('seed', 5000));
  const seeds = Array.from({ length: games }, (_, i) => seed0 + i);
  let best = await evalSet(cur, seeds), bestL = loss(best);
  console.log('start', JSON.stringify(cur), JSON.stringify(best), bestL.toFixed(2));
  for (let it = 0; it < iters; it++) {
    const cand = JSON.parse(JSON.stringify(cur));
    const n = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const [g, k, lo, hi, st] = SPACE[Math.floor(Math.random() * SPACE.length)];
      const span = (hi - lo) * st, v = cand[g][k] + (Math.random() - 0.5) * 2 * span;
      cand[g][k] = Math.min(hi, Math.max(lo, +v.toFixed(4)));
    }
    const m = await evalSet(cand, seeds), l = loss(m), better = l < bestL;
    if (better) { bestL = l; best = m; for (const g of ['MATCH', 'AI', 'RULES', 'MOVE']) Object.assign(cur[g], cand[g]); fs.writeFileSync(path.join(ROOT, 'reports', 'tune.json'), JSON.stringify({ params: cur, metrics: best, loss: bestL }, null, 1)); }
    console.log(it, l.toFixed(2), better ? 'MIGLIORE' : '', JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(2)]))));
  }
  console.log('FINE', JSON.stringify(cur), JSON.stringify(best), bestL.toFixed(2));
  workers.forEach(w => w.kill());
}
