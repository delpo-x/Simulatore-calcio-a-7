// Scenari controllati ("micro") per misurare un singolo comportamento del motore.
import { Sim, DT } from '../../public/core/sim.js';

/** Lancia la palla da ferma con velocità orizzontale e verticale date e ne misura la traiettoria. */
export function launchBall({ speed, lift }) {
  const s = new Sim({ perTeam: 7, seed: 1 });
  s.state = 'play';
  for (const p of s.players) { p.x = 900; p.z = 900; p.kickCd = 99; } // nessuno raccoglie la palla
  const b = s.ball;
  Object.assign(b, { x: 0, y: 0.11, z: 0, vx: speed, vy: lift, vz: 0, owner: -1 });
  const out = { max_height: 0, bounces: 0, first_landing_x: null, first_landing_t: null };
  let t = 0, wasAir = false, landed = false, prevVy = b.vy;
  while (t < 30 && Math.hypot(b.vx, b.vz) > 0.01) {
    s.stepBall(); t += DT;
    out.max_height = Math.max(out.max_height, b.y - 0.11);
    const air = b.y > 0.12;
    if (wasAir && !air && !landed) { landed = true; out.first_landing_x = b.x; out.first_landing_t = t; }
    if (landed && prevVy > 0 && b.vy <= 0 && b.y - 0.11 > 0.3) out.bounces++;
    for (const d of [10, 20, 30, 40]) {
      if (!(`time_at_${d}` in out) && b.x >= d) { out[`time_at_${d}`] = t; out[`speed_at_${d}`] = Math.hypot(b.vx, b.vz); }
    }
    wasAir = air; prevVy = b.vy;
  }
  out.range = b.x; out.stop_time = t; out.decel_to_stop = speed / t;
  return out;
}

/** Velocità orizzontale della palla subito dopo un tiro con la potenza data (0..1). */
export function shotSpeed({ power }) {
  const s = new Sim({ perTeam: 7, seed: 1 });
  s.state = 'play';
  const p = s.players[1];
  Object.assign(p, { x: 20, z: 0 });
  s.shoot(p, 0, power);
  return { speed: Math.hypot(s.ball.vx, s.ball.vz) };
}

/** Un giocatore parte da fermo e corre in sprint in linea retta per 10 secondi. */
export function sprintRun() {
  const s = new Sim({ perTeam: 7, seed: 1 });
  s.state = 'play';
  s.players.forEach((q, i) => { q.x = 900 + i * 3; q.z = 900; });
  const p = s.players[1];
  Object.assign(p, { x: -50, z: 0, vx: 0, vz: 0, face: 0 });
  Object.assign(s.ball, { x: 900, z: 0, owner: -1 });
  const c = { mx: 1, mz: 0, sprint: true }, rows = [], out = {};
  let t = 0, vmax = 0;
  for (let i = 0; i < 10 / DT; i++) {
    s.move(p, c); t += DT; vmax = Math.max(vmax, p.vx);
    rows.push([t, p.vx]);
    if (out.time_40m === undefined && p.x + 50 >= 40) out.time_40m = t;
  }
  out.max_speed = vmax;
  out.time_to_90pct = rows.find(r => r[1] >= 0.9 * vmax)?.[0];
  return out;
}

/** Disposizione iniziale dei giocatori per un dato numero di giocatori per squadra. */
export function formationLayout(players) {
  const s = new Sim({ perTeam: players, seed: 1 });
  const hx = 52.5, hz = 34;
  let minPair = Infinity, outOfBounds = 0;
  s.players.forEach((a, i) => {
    if (Math.abs(a.x) > hx || Math.abs(a.z) > hz) outOfBounds++;
    for (let j = i + 1; j < s.players.length; j++) minPair = Math.min(minPair, Math.hypot(a.x - s.players[j].x, a.z - s.players[j].z));
  });
  return { players_per_team: s.players.filter(p => p.team === 0).length, min_pair_distance: minPair, out_of_bounds: outOfBounds };
}

/** Velocità di simulazione: secondi simulati per secondo reale. */
export function measureSpeed(players, simSeconds = 300) {
  const s = new Sim({ perTeam: players, seed: 1, halfLength: 1e9 });
  const n = Math.round(simSeconds / DT), t0 = performance.now();
  for (let i = 0; i < n; i++) s.step([null, null]);
  const wall = (performance.now() - t0) / 1000;
  return { realtime_factor: simSeconds / wall, steps_per_s: n / wall };
}
