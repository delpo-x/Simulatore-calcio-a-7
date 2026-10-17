// Prova di robustezza: molte partite con semi casuali e formati diversi; segnala blocchi, valori non finiti, partite che non finiscono e giocatori fuori campo.
import { Sim, DT } from '../public/core/sim.js';
import { applyParams } from '../public/core/params.js';
import { readFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const games = arg('games', 60), halfMin = arg('half', 25), seed0 = arg('seed', 1);
applyParams(JSON.parse(readFileSync(new URL('../config/params.json', import.meta.url))));
const problems = [], summary = {};
for (const players of [5, 6, 7, 8, 9, 10, 11]) {
  let stuck = 0, n = 0, goals = 0;
  for (let g = 0; g < games; g++) {
    const seed = seed0 + players * 100000 + g, s = new Sim({ perTeam: players, seed, halfLength: halfMin * 60 });
    let steps = 0, idle = 0, lastBall = [s.ball.x, s.ball.z], bad = null;
    const max = Math.ceil(halfMin * 2 * 60 * 3 / DT);
    while (s.state !== 'full' && steps < max && !bad) {
      s.step([null, null]); steps++;
      const b = s.ball;
      if (!Number.isFinite(b.x + b.y + b.z) || s.players.some(p => !Number.isFinite(p.x + p.z + p.vx + p.vz))) bad = 'valore non finito';
      else if (s.players.some(p => !p.out && (Math.abs(p.x) > s.pitch.hx + 3.5 || Math.abs(p.z) > s.pitch.hz + 3.5))) bad = 'giocatore fuori dal campo';
      else if (steps % 60 === 0) { // palla ferma in gioco per troppo tempo
        const moved = Math.hypot(b.x - lastBall[0], b.z - lastBall[1]) > 0.05 || b.owner >= 0 || s.state !== 'play';
        idle = moved ? 0 : idle + 1; lastBall = [b.x, b.z];
        if (idle > 20) bad = 'palla ferma per 20 s';
      }
      if (!bad && s.players.filter(p => p.team === 0 && !p.out).length < 1) bad = 'squadra senza giocatori';
    }
    n++; goals += s.score[0] + s.score[1];
    if (!bad && s.state !== 'full') bad = 'partita non finita';
    if (bad) { stuck++; problems.push({ players, seed, problema: bad, tempo: +s.matchTime.toFixed(1) }); }
  }
  summary[players] = { partite: n, problemi: stuck, gol_medi: +(goals / n).toFixed(2) };
}
console.table(summary);
if (problems.length) { console.log(problems.slice(0, 30)); process.exit(1); }
console.log('Nessun problema.');
