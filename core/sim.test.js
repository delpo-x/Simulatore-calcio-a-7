import assert from 'node:assert/strict';
import { Sim, PITCH, DT, pitchFor, AI } from './sim.js';

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
// meteo: la pioggia fa scorrere di piu' la palla, la neve molto meno, una pozza la ferma; sereno = nessuna pozza
{
  const roll = (weather, puddle) => {
    const s = new Sim({ seed: 2, weather }), b = s.ball; s.puddles = puddle ? [{ x: -7, z: 0, r: 1 }] : [];
    Object.assign(b, { x: -10, z: 0, y: 0.11, vx: 10, vy: 0, vz: 0, owner: -1 });
    s.state = 'play'; for (const p of s.players) { p.x = 0; p.z = 40; } // nessuno tocca la palla
    for (let i = 0; i < 2000 && (b.vx || b.vz); i++) s.stepBall();
    return b.x + 10;
  };
  const dry = roll('clear'), wet = roll('rain'), snow = roll('snow'), pud = roll('storm', true);
  assert.ok(wet > dry * 1.2, `pioggia: la palla va piu' lontano (${wet.toFixed(1)} contro ${dry.toFixed(1)} m)`);
  assert.ok(snow < dry * 0.5, `neve: la palla si ferma prima (${snow.toFixed(1)} m)`);
  assert.ok(pud < 4.5, `pozza: la palla si pianta dentro (${pud.toFixed(1)} m)`);
  const rollOn = surface => { const s = new Sim({ seed: 2, surface }), b = s.ball; s.state = 'play'; for (const p of s.players) { p.x = 0; p.z = 40; } Object.assign(b, { x: -10, z: 0, y: 0.11, vx: 10, vy: 0, vz: 0, owner: -1 }); for (let i = 0; i < 2000 && (b.vx || b.vz); i++) s.stepBall(); return b.x + 10; };
  const dirt = rollOn('dirt'), syn = rollOn('synthetic'), grass = rollOn('grass');
  assert.ok(dirt > syn && syn > grass, `manto: terra ${dirt.toFixed(1)} > sintetico ${syn.toFixed(1)} > erba ${grass.toFixed(1)} m`);
  { // ghiaia: una palla rasoterra che esce veloce si ferma entro pochi decimetri dalla ghiaia
    const s = new Sim({ seed: 2 }), b = s.ball; s.state = 'play'; for (const p of s.players) { p.x = 0; p.z = -40; }
    Object.assign(b, { x: 0, z: s.pitch.hz + 2.1, y: 0.11, vx: 0, vy: 0, vz: 15, owner: -1 }); for (let i = 0; i < 60; i++) s.stepBall();
    assert.ok(Math.hypot(b.vx, b.vz) < 0.5 && b.z < s.pitch.hz + 3, `ghiaia: palla ferma (z ${b.z.toFixed(2)}, v ${Math.hypot(b.vx, b.vz).toFixed(2)})`);
  }
  assert.equal(new Sim({ seed: 2 }).puddles.length, 0);
  assert.ok(new Sim({ seed: 2, weather: 'storm' }).puddles.length >= 5, 'pozze con la pioggia intensa');
  assert.equal(new Sim({ seed: 2, weather: 'boh' }).weather, 'clear', 'meteo sconosciuto = sereno');
}
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
assert.equal(t.schemes[0], '3-1-2'); assert.equal(t.tac[0].press, 20); assert.equal(t.tac[1].press, AI.pressTrigger, 'altra squadra invariata');
assert.equal(t.players.filter(q => q.team === 0).map(q => q.home.x).filter(x => Math.abs(x + t.pitch.hx - 0.25 * t.pitch.hx * 2) < 1e-9).length, 3, 'tre difensori');
for (let i = 0; i < 60 * 60; i++) t.step();
for (const q of t.players) assert.ok(Number.isFinite(q.x + q.z), 'giocatore finito dopo cambio tattico');

// controllo dello spazio: le due mappe sono complementari e ogni squadra domina vicino ai propri giocatori
const m = new Sim({ perTeam: 7, seed: 3 }), m0 = m.spaceMap(0), m1 = m.spaceMap(1);
for (let i = 0; i < m0.length; i++) assert.ok(Math.abs(m0[i] + m1[i] - 1) < 1e-6, 'controllo complementare');
const own = m.players.find(q => q.team === 0 && !q.gk);
assert.ok(m.control(0, own.x, own.z, m.arrival(0, own.x, own.z)) > 0.5, 'spazio sotto i piedi di un giocatore e\' della sua squadra');
assert.equal(m.spaceMap(0), m0, 'mappa ricalcolata al piu\' una volta per passo');
console.log('sim tests ok');
