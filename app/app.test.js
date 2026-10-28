// Test dei moduli dell'app che non usano il browser: statistiche per giocatore, voti, partita senza grafica.
import assert from 'node:assert/strict';
import { createMatch, playMatch, shootout } from './headless.js';
import { MatchStats } from './stats.js';
import { PRESETS } from './teams.js';
import { roundRobin, createTournament, nextMatch, record, champion, alive, allMatches, standings, scorers, ratingTable, matchSeed, compactResult, needsShootout } from './tournament.js';

const [A, B] = PRESETS;

// le statistiche osservano la partita senza cambiarla
{
  const plain = createMatch(A, B, { seed: 11, half: 4 }).sim;
  while (plain.state !== 'full') plain.step();
  const { sim } = createMatch(A, B, { seed: 11, half: 4 }), st = new MatchStats(sim);
  while (sim.state !== 'full') { sim.step(); st.step(); }
  assert.equal(sim.hash(), plain.hash(), 'MatchStats non cambia la simulazione');
  for (const t of [0, 1]) {
    const mine = [...sim.players.filter(p => p.team === t).map(p => st.ps[p.id]), ...st.left.filter(x => x.team === t)], sum = k => mine.reduce((a, x) => a + x[k], 0);
    assert.equal(sum('passOk'), st.s.passOk[t], 'passaggi riusciti: giocatori = squadra');
    assert.equal(sum('passLost'), st.s.passLost[t], 'passaggi persi: giocatori = squadra');
    assert.equal(sum('shots'), st.s.shots[t], 'tiri: giocatori = squadra');
    assert.equal(sum('onTarget'), st.s.onTarget[t], 'tiri in porta: giocatori = squadra');
    assert.equal(sum('saves'), st.s.saves[t], 'parate: giocatori = squadra');
    assert.ok(sum('saves') <= st.s.onTarget[1 - t], 'parate non oltre i tiri in porta avversari');
  }
  const goals = st.timeline.filter(e => e.t === 'goal');
  assert.equal(goals.length, sim.score[0] + sim.score[1], 'un evento per gol');
  assert.equal([...sim.players.map(p => st.ps[p.id]), ...st.left].reduce((a, x) => a + x.goals + x.own, 0), goals.filter(g => sim.players[g.player]).length, 'gol e autogol attribuiti');
  assert.ok(goals.every(g => g.own || st.shotList.some(s => s.goal && s.team === g.team)), 'ogni gol sulla mappa dei tiri');
  for (const p of sim.players) { const v = st.rating(p.id); assert.ok(v >= 4 && v <= 10 && v * 2 === Math.round(v * 2), `voto valido ${v}`); }
  assert.ok(sim.players.every(p => st.rating(p.id) <= st.rating(st.best())), 'migliore in campo = voto piu\' alto');
}

// riassunto della partita senza grafica, ripetibile
{
  const r = playMatch(A, B, { seed: 7, half: 3 }), r2 = playMatch(A, B, { seed: 7, half: 3 });
  assert.deepEqual(r, r2, 'stesso seme, stesso riassunto');
  assert.ok(r.players.length >= 14 && r.players.length <= 14 + 6, 'in campo e sostituiti');
  assert.equal(r.goals.length, r.score[0] + r.score[1]);
  assert.ok(r.players.every(p => p.name && p.num > 0), 'nomi e numeri di maglia');
}

// calendario del girone all'italiana: ogni coppia una volta (due con il ritorno), nessuna squadra due volte nella stessa giornata, casa e trasferta bilanciate
for (const n of [3, 4, 5, 6, 7, 8]) for (const double of [false, true]) {
  const rounds = roundRobin(n, double), seen = new Map(), home = Array(n).fill(0);
  assert.equal(rounds.length, (n % 2 ? n : n - 1) * (double ? 2 : 1), `giornate n=${n}`);
  for (const rd of rounds) {
    const ids = rd.flat(); assert.equal(new Set(ids).size, ids.length, 'una partita per squadra a giornata');
    assert.equal(rd.length, Math.floor(n / 2));
    for (const [a, b] of rd) { const k = [a, b].sort().join('-'); seen.set(k, (seen.get(k) ?? 0) + 1); home[a]++; }
  }
  assert.equal(seen.size, n * (n - 1) / 2, 'tutte le coppie');
  assert.ok([...seen.values()].every(v => v === (double ? 2 : 1)), 'ogni coppia il giusto numero di volte');
  const games = (n - 1) * (double ? 2 : 1);
  assert.ok(home.every(h => Math.abs(h - games / 2) <= 1), `casa bilanciata n=${n} ${home}`);
}

// coppa: con 3-8 squadre arriva sempre a una finale e a un vincitore; i pareggi richiedono i rigori
{
  const fake = (score, so) => ({ score, so, goals: [], best: { side: 0, name: 'X', rating: 6 }, players: [], shots: [0, 0] });
  for (let n = 3; n <= 8; n++) {
    const T = createTournament({ format: 'cup', teams: PRESETS.slice(0, n), seed: n });
    let m, k = 0;
    while ((m = nextMatch(T))) {
      if (k === 0) assert.throws(() => record(T, m.id, fake([1, 1], null)), /rigori/);
      record(T, m.id, k++ % 3 ? fake([2, 1], null) : fake([0, 0], { score: [3, 4], kicks: [] }));
    }
    assert.equal(k, n - 1, `coppa a ${n}: ${n - 1} partite`);
    assert.equal(T.rounds.at(-1).name, 'Finale');
    assert.ok(champion(T) >= 0 && champion(T) < n);
    assert.equal(alive(T).length, 1);
  }
}

// campionato giocato davvero (tempi brevi): classifica coerente, marcatori, seme della partita
{
  const T = createTournament({ name: 'Prova', format: 'league', teams: PRESETS.slice(0, 3), half: 2, seed: 9 });
  assert.equal(allMatches(T).length, 3);
  let m;
  while ((m = nextMatch(T))) {
    const opts = { perTeam: T.perTeam, half: T.half, seed: matchSeed(T, m) }, sum = playMatch(T.teams[m.home], T.teams[m.away], opts);
    record(T, m.id, compactResult(sum, needsShootout(T, sum.score) ? shootout(T.teams[m.home], T.teams[m.away], opts) : null));
  }
  const st = standings(T), goals = allMatches(T).reduce((a, x) => a + x.res.score[0] + x.res.score[1], 0);
  assert.equal(st.reduce((a, r) => a + r.P, 0), 6);
  assert.equal(st.reduce((a, r) => a + r.GF, 0), goals);
  assert.equal(st.reduce((a, r) => a + r.DR, 0), 0);
  assert.ok(st.every((r, i) => i === 0 || r.Pt <= st[i - 1].Pt), 'ordinata per punti');
  assert.equal(scorers(T).reduce((a, s) => a + s.goals, 0), allMatches(T).reduce((a, x) => a + x.res.goals.filter(g => !g.own).length, 0));
  assert.ok(ratingTable(T).length > 0);
  assert.equal(champion(T), st[0].team);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(T))), JSON.stringify(T), 'salvabile in JSON');
  assert.notEqual(matchSeed(T, allMatches(T)[0]), matchSeed(T, allMatches(T)[1]));
}

// lotteria dei rigori: equilibrata e ripetibile
{
  let w = 0, k = 0, g = 0;
  for (let s = 1; s <= 200; s++) { const r = shootout(A, B, { seed: s }); w += r.score[0] > r.score[1]; k += r.kicks.length; g += r.kicks.filter(x => x.goal).length; assert.notEqual(r.score[0], r.score[1]); }
  assert.ok(w > 70 && w < 130, `vittorie della squadra che tira per prima ${w}/200`);
  assert.ok(g / k > 0.65 && g / k < 0.9, `rigori segnati ${(g / k).toFixed(2)}`);
  assert.deepEqual(shootout(A, B, { seed: 3 }), shootout(A, B, { seed: 3 }));
}

// audio sintetizzato: con un AudioContext finto si controlla che i suoni si costruiscano, rispettino il mute e che l'ondata del pubblico decada
{
  const made = [], param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => { const n = { connect: x => x, start() {}, stop() {}, frequency: param(), gain: param(), Q: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; made.push(n); return n; };
  class Ctx {
    constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createBuffer(ch, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    resume() {} suspend() {}
  }
  for (const k of ['createGain', 'createOscillator', 'createBiquadFilter', 'createBufferSource', 'createDynamicsCompressor']) Ctx.prototype[k] = node;
  globalThis.window = { AudioContext: Ctx };
  const { SoundEngine } = await import('./audio.js'), e = new SoundEngine();
  e.start();
  const noise = e.noise.getChannelData(0), rms = Math.sqrt(noise.reduce((a, x) => a + x * x, 0) / noise.length);
  assert.ok(noise.every(Number.isFinite) && rms > 0.05 && rms < 0.6, `rumore rosa ${rms.toFixed(3)}`);
  const sounds = [() => e.whistle(3), () => e.kick(25), () => e.clang(0.9, true), () => e.clang(0.4, false), () => e.net(0.6), () => e.touch(), () => e.thunder(),() => e.roar('goal'), () => e.roar('ooh'), () => e.roar('boo'), () => e.tackle()];
  for (const s of sounds) { const n = made.length; s(); assert.ok(made.length > n, 'ogni suono crea i suoi nodi'); }
  e.setCrowd(0.5); e.swell(1, 5); assert.equal(e.boost, 1);
  e.setMuted(true);
  const n = made.length; for (const s of sounds) s(); assert.equal(made.length, n, 'in muto non nasce nessun suono');
  delete globalThis.window;
}

// scheda Panchina: barra Stamina (verde riposato, rosso esausto), panchinari, cambi e testo sicuro
{
  const { benchPanel, staminaColor } = await import('./views.js');
  assert.equal(staminaColor(1), 'hsl(120 72% 42%)');
  assert.equal(staminaColor(0), 'hsl(0 72% 42%)');
  assert.equal(staminaColor(5), staminaColor(1), 'oltre il massimo = pieno');
  assert.equal(staminaColor(-1), staminaColor(0), 'sotto lo zero = vuoto');
  const look = { bg: '#c33', fg: '#fff' };
  const html = benchPanel({ head: 'Rossi', color: '#c33', subs: 1, maxSubs: 3, starters: [{ num: 1, name: 'A <b>', role: 'POR', stam: 0.5, ...look }, { num: 9, name: 'B', role: 'ATT', stam: 0, out: true, ...look }], bench: [{ num: 12, name: 'C', role: 'CEN', ...look }] });
  assert.ok(html.includes('cambi 1/3') && html.includes('width:50%') && html.includes('width:0%'), 'barre in percentuale');
  assert.ok(html.includes('A &lt;b&gt;') && !html.includes('A <b>'), 'nomi con escape');
  assert.equal((html.match(/<li/g) ?? []).length, 3, 'titolari + panchinari');
  assert.ok(html.includes('class="out"') && html.includes('class="bench"'));
  assert.ok(benchPanel({ head: 'X', color: '#000', subs: 3, maxSubs: 3, starters: [], bench: [] }).includes('nessuno in panchina'));
}

console.log('app tests ok');
