import assert from 'node:assert/strict';
import { Sim, PITCH, DT, pitchFor } from './sim.js';

function run(seed, seconds) {
  const s = new Sim({ perTeam: 7, seed, halfLength: seconds });
  let goals = 0, restarts = 0;
  for (let i = 0; i < seconds * 4 / DT; i++) {
    s.step([null, null]);
    for (const e of s.events) { if (e.t === 'goal') goals++; if (e.t === 'restart') restarts++; }
    const b = s.ball;
    assert.ok(Number.isFinite(b.x + b.y + b.z), 'ball finite');
    for (const p of s.players) assert.ok(Number.isFinite(p.x + p.z) && Math.abs(p.x) < PITCH.hx + 4 && Math.abs(p.z) < PITCH.hz + 4, 'player in bounds');
    if (s.state === 'full') break;
  }
  return { h: s.hash(), goals, restarts, state: s.state, score: s.score };
}

const a = run(1, 120), b = run(1, 120);
assert.equal(a.h, b.h, 'same seed => same state');
assert.notEqual(run(2, 120).h, a.h, 'different seed differs');
assert.equal(a.state, 'full', 'match ends');
const total = [1, 2, 3, 4, 5, 6, 7, 8].map(sd => run(sd, 300)).reduce((n, r) => n + r.goals, 0);
console.log('AI-vs-AI:', JSON.stringify(a), 'goals across 8 seeds:', total);
assert.ok(total > 0, 'goals happen');

// human shoot at goal from the edge of the box scores sometimes / ball moves
const s = new Sim({ seed: 3, pitch: pitchFor(11) });
s.state = 'play';
const p = s.players.find(q => q.team === 0 && !q.gk);
p.x = 36; p.z = 0; p.face = 0; s.giveBall(p); s.active[0] = p.id;
for (let i = 0; i < 40; i++) s.step([32, null]); // hold circle (charge)
s.step([0, null]); // release
assert.ok(s.ball.vx > 10, 'shot kicked towards +x');
// cambio tattico in partita: nuovo modulo e pressing, senza stati non finiti
const t = new Sim({ seed: 5, perTeam: 7, schemes: ['2-3-1', '3-2-1'] });
t.setScheme(0, '3-1-2'); t.setTactics(0, { press: 20, line: 0.35 });
assert.equal(t.schemes[0], '3-1-2'); assert.equal(t.tac[0].press, 20); assert.equal(t.tac[1].press, 14, 'altra squadra invariata');
assert.equal(t.players.filter(q => q.team === 0).map(q => q.home.x).filter(x => Math.abs(x + t.pitch.hx - 0.25 * t.pitch.hx * 2) < 1e-9).length, 3, 'tre difensori');
for (let i = 0; i < 60 * 60; i++) t.step();
for (const q of t.players) assert.ok(Number.isFinite(q.x + q.z), 'giocatore finito dopo cambio tattico');
console.log('sim tests ok');
