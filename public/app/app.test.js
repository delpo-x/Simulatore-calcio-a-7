// Test dei moduli dell'app che non usano il browser: statistiche per giocatore, voti, partita senza grafica.
import assert from 'node:assert/strict';
import { createMatch, playMatch } from './headless.js';
import { MatchStats } from './stats.js';
import { PRESETS } from './teams.js';

const [A, B] = PRESETS;

// le statistiche osservano la partita senza cambiarla
{
  const plain = createMatch(A, B, { seed: 11, half: 4 }).sim;
  while (plain.state !== 'full') plain.step();
  const { sim } = createMatch(A, B, { seed: 11, half: 4 }), st = new MatchStats(sim);
  while (sim.state !== 'full') { sim.step(); st.step(); }
  assert.equal(sim.hash(), plain.hash(), 'MatchStats non cambia la simulazione');
  for (const t of [0, 1]) {
    const mine = sim.players.filter(p => p.team === t).map(p => st.ps[p.id]), sum = k => mine.reduce((a, x) => a + x[k], 0);
    assert.equal(sum('passOk'), st.s.passOk[t], 'passaggi riusciti: giocatori = squadra');
    assert.equal(sum('passLost'), st.s.passLost[t], 'passaggi persi: giocatori = squadra');
    assert.equal(sum('shots'), st.s.shots[t], 'tiri: giocatori = squadra');
    assert.equal(sum('onTarget'), st.s.onTarget[t], 'tiri in porta: giocatori = squadra');
    assert.equal(sum('saves'), st.s.saves[t], 'parate: giocatori = squadra');
    assert.ok(sum('saves') <= st.s.onTarget[1 - t], 'parate non oltre i tiri in porta avversari');
  }
  const goals = st.timeline.filter(e => e.t === 'goal');
  assert.equal(goals.length, sim.score[0] + sim.score[1], 'un evento per gol');
  assert.equal(sim.players.reduce((a, p) => a + st.ps[p.id].goals + st.ps[p.id].own, 0), goals.filter(g => sim.players[g.player]).length, 'gol e autogol attribuiti');
  assert.ok(goals.every(g => g.own || st.shotList.some(s => s.goal && s.team === g.team)), 'ogni gol sulla mappa dei tiri');
  for (const p of sim.players) { const v = st.rating(p.id); assert.ok(v >= 4 && v <= 10 && v * 2 === Math.round(v * 2), `voto valido ${v}`); }
  assert.ok(sim.players.every(p => st.rating(p.id) <= st.rating(st.best())), 'migliore in campo = voto piu\' alto');
}

// riassunto della partita senza grafica, ripetibile
{
  const r = playMatch(A, B, { seed: 7, half: 3 }), r2 = playMatch(A, B, { seed: 7, half: 3 });
  assert.deepEqual(r, r2, 'stesso seme, stesso riassunto');
  assert.equal(r.players.length, 14);
  assert.equal(r.goals.length, r.score[0] + r.score[1]);
  assert.ok(r.players.every(p => p.name && p.num > 0), 'nomi e numeri di maglia');
}

console.log('app tests ok');
