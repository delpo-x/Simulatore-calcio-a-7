// Prototipo del ticket "Modello di palla": stampa le traiettorie prodotte dai parametri attuali
// di public/core/sim.js, senza grafica. Esecuzione: node wayfinder/prototypes/ball-trajectories.mjs
import { Sim, DT } from '../../public/core/sim.js';

function launch({ speed, lift }) {
  const s = new Sim({ perTeam: 7, seed: 1 });
  s.state = 'play';
  for (const p of s.players) { p.x = 900; p.z = 900; p.kickCd = 99; } // nessuno raccoglie la palla
  const b = s.ball;
  Object.assign(b, { x: 0, y: 0.11, z: 0, vx: speed, vy: lift, vz: 0, owner: -1 });
  let t = 0, maxY = 0, bounces = 0, firstLanding = null, wasAir = false, prevVy = b.vy;
  const checkpoints = {};
  while (t < 30 && Math.hypot(b.vx, b.vz) > 0.01) {
    s.stepBall(); t += DT;
    if (b.y > maxY) maxY = b.y;
    const air = b.y > 0.12;
    if (wasAir && !air && firstLanding === null) firstLanding = { t, x: b.x };
    if (prevVy < 0 && b.vy > 0) bounces++;
    wasAir = air; prevVy = b.vy;
    for (const d of [10, 20, 30, 40]) if (!(d in checkpoints) && b.x >= d) checkpoints[d] = { t, v: Math.hypot(b.vx, b.vz) };
  }
  return { range: b.x, stopTime: t, maxHeight: maxY - 0.11, bounces, firstLanding, checkpoints };
}

const f = (v, n = 2) => (v == null ? '-' : v.toFixed(n));
const cases = [
  ['Passaggio rasoterra breve (v0 = 15 m/s)', { speed: 15, lift: 0 }],
  ['Passaggio rasoterra 20 m (v0 = 23 m/s, formula del motore)', { speed: 23, lift: 0 }],
  ['Passaggio rasoterra massimo (v0 = 24 m/s)', { speed: 24, lift: 0 }],
  ['Palla che rotola (v0 = 10 m/s)', { speed: 10, lift: 0 }],
  ['Passaggio alto (v0 = 20 m/s, vy = 7 m/s)', { speed: 20, lift: 7 }],
  ['Rinvio lungo del portiere (v0 = 20 m/s, vy = 2 m/s)', { speed: 20, lift: 2 }],
  ['Tiro debole (v0 = 14 m/s, vy = 1 m/s)', { speed: 14, lift: 1 }],
  ['Tiro pieno (v0 = 32 m/s, vy = 4,2 m/s)', { speed: 32, lift: 4.2 }],
];

for (const [name, params] of cases) {
  const r = launch(params);
  const cp = Object.entries(r.checkpoints).map(([d, c]) => `${d} m: ${f(c.t)} s a ${f(c.v, 1)} m/s`).join(' | ') || 'non raggiunge 10 m';
  console.log(`\n${name}\n  gittata ${f(r.range, 1)} m, ferma dopo ${f(r.stopTime, 1)} s, altezza massima ${f(r.maxHeight)} m, rimbalzi ${r.bounces}, primo contatto col suolo ${r.firstLanding ? f(r.firstLanding.x, 1) + ' m a ' + f(r.firstLanding.t) + ' s' : 'mai'}\n  ${cp}`);
}

console.log(`\nParametri attuali in sim.js: gravità 9.8, resistenza in aria 0.15/s, resistenza a terra 0.9/s più decelerazione costante 1.5 m/s², rimbalzo 0.6, passo ${DT.toFixed(4)} s.`);
