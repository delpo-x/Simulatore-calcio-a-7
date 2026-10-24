// Tornei dell'app: campionato (andata, o andata e ritorno) e coppa a eliminazione diretta tra squadre salvate.
// Solo dati e regole (nessun DOM): il torneo e' un oggetto JSON salvato nel browser.

export const FORMATS = { league: 'Campionato (solo andata)', league2: 'Campionato (andata e ritorno)', cup: 'Coppa a eliminazione diretta' };
export const MIN_TEAMS = 3, MAX_TEAMS = 8;

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clone = o => JSON.parse(JSON.stringify(o));

/** Giornate del girone all'italiana (metodo del cerchio): con un numero dispari di squadre una riposa a ogni giornata. Casa e trasferta alternate. */
export function roundRobin(n, double = false) {
  const ids = [...Array(n).keys()]; if (n % 2) ids.push(-1); // -1 = riposo
  const m = ids.length, rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const a = ids[i], b = ids[m - 1 - i];
      if (a < 0 || b < 0) continue;
      pairs.push(i === 0 ? (r % 2 ? [b, a] : [a, b]) : (i % 2 ? [b, a] : [a, b]));
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()); // ruota tutti tranne il primo
  }
  return double ? rounds.concat(rounds.map(rd => rd.map(([a, b]) => [b, a]))) : rounds;
}

const cupRoundName = matches => ({ 1: 'Finale', 2: 'Semifinali', 4: 'Quarti di finale', 8: 'Ottavi di finale' })[matches] ?? `Turno da ${matches * 2}`;

/** Nuovo torneo. teams: definizioni di squadra dell'app (copiate: cambiarle dopo non tocca il torneo). */
export function createTournament({ name, format = 'league', teams, perTeam = 7, half = 25, seed = 1 }) {
  if (!FORMATS[format]) throw new Error(`formato sconosciuto: ${format}`);
  if (teams.length < MIN_TEAMS || teams.length > MAX_TEAMS) throw new Error(`servono da ${MIN_TEAMS} a ${MAX_TEAMS} squadre`);
  const T = { v: 1, id: `t-${seed.toString(36)}-${teams.length}`, name: name?.trim() || FORMATS[format], format, perTeam, half, seed, teams: clone(teams), rounds: [], n: 0 };
  if (format === 'cup') {
    const r = rng(seed), order = [...teams.keys()];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } // sorteggio
    cupRound(T, order);
  } else roundRobin(teams.length, format === 'league2').forEach((rd, i) => T.rounds.push({ name: `${i + 1}ª giornata`, matches: rd.map(([home, away]) => newMatch(T, home, away)) }));
  return T;
}

function newMatch(T, home, away) { return { id: T.n++, home, away, res: null }; }

/** Turno di coppa con le squadre ancora in gara: se non sono una potenza di 2, le prime del sorteggio passano il turno senza giocare. */
function cupRound(T, alive) {
  let size = 1; while (size < alive.length) size *= 2;
  const byes = size - alive.length, playing = alive.slice(byes), matches = [];
  for (let i = 0; i < playing.length; i += 2) matches.push(newMatch(T, playing[i], playing[i + 1]));
  T.rounds.push({ name: cupRoundName(size / 2), matches, byes: alive.slice(0, byes) });
}

export const allMatches = T => T.rounds.flatMap(r => r.matches);
export const roundDone = rd => rd.matches.every(m => m.res);
/** Prima partita da giocare (nell'ordine del calendario), o null a torneo finito. */
export const nextMatch = T => allMatches(T).find(m => !m.res) ?? null;
export const roundOf = (T, m) => T.rounds.findIndex(r => r.matches.includes(m));
export const findMatch = (T, id) => allMatches(T).find(m => m.id === id) ?? null;
/** Seme della partita: dipende dal torneo e dalla partita, cosi' guardarla o simularla da' lo stesso risultato. */
export const matchSeed = (T, m) => 1 + ((T.seed * 7919 + m.id * 104729 + 12345) >>> 0) % 999999999;

/** Vincitore della partita (lato 0 = casa, 1 = trasferta), anche ai rigori; -1 = pareggio senza rigori. */
export function winnerSide(res) {
  const [a, b] = res.so ? res.so.score : res.score;
  return a > b ? 0 : b > a ? 1 : -1;
}

/** Riassunto compatto da salvare nel torneo (headless.summarize + rigori). */
export function compactResult(sum, so = null) {
  return {
    score: sum.score, so: so ? { score: so.score, kicks: so.kicks } : null,
    goals: sum.goals.map(g => ({ side: g.team, name: g.name, min: g.min, own: !!g.own })),
    best: { side: sum.players[sum.best].team, name: sum.players[sum.best].name, rating: sum.players[sum.best].rating },
    players: sum.players.map(p => [p.team, p.name, p.rating, p.goals, p.assists]),
    shots: [0, 1].map(t => sum.rows.find(r => r[0] === 'Tiri')?.[1 + t] ?? 0),
  };
}

/** Registra il risultato; in coppa, finito il turno, prepara il successivo. Restituisce il torneo. */
export function record(T, id, res) {
  const m = findMatch(T, id);
  if (!m) throw new Error(`partita ${id} non trovata`);
  if (T.format === 'cup' && winnerSide(res) < 0) throw new Error('in coppa serve un vincitore (rigori)');
  m.res = res;
  if (T.format === 'cup') {
    const last = T.rounds.at(-1);
    if (roundDone(last) && last.matches.length + last.byes.length > 1) cupRound(T, [...last.byes, ...last.matches.map(x => winnerSide(x.res) ? x.away : x.home)]);
  }
  return T;
}

export const isOver = T => !nextMatch(T);
export const needsShootout = (T, score) => T.format === 'cup' && score[0] === score[1];

/** Classifica: 3 punti a vittoria, 1 a pareggio; a parita' differenza reti, gol fatti, poi nome. */
export function standings(T) {
  const rows = T.teams.map((t, i) => ({ team: i, name: t.name, P: 0, V: 0, N: 0, S: 0, GF: 0, GS: 0, DR: 0, Pt: 0, form: [] }));
  for (const m of allMatches(T)) {
    if (!m.res) continue;
    const [a, b] = m.res.score, h = rows[m.home], w = rows[m.away];
    h.P++; w.P++; h.GF += a; h.GS += b; w.GF += b; w.GS += a;
    if (a > b) { h.V++; w.S++; h.form.push('V'); w.form.push('S'); } else if (a < b) { w.V++; h.S++; w.form.push('V'); h.form.push('S'); } else { h.N++; w.N++; h.form.push('N'); w.form.push('N'); }
  }
  for (const r of rows) { r.DR = r.GF - r.GS; r.Pt = 3 * r.V + r.N; r.form = r.form.slice(-5); }
  return rows.sort((x, y) => y.Pt - x.Pt || y.DR - x.DR || y.GF - x.GF || x.name.localeCompare(y.name));
}

/** Classifica marcatori (autogol esclusi). */
export function scorers(T) {
  const map = new Map();
  for (const m of allMatches(T)) for (const g of m.res?.goals ?? []) {
    if (g.own) continue;
    const team = g.side ? m.away : m.home, k = `${team}|${g.name}`;
    map.set(k, { team, name: g.name, goals: (map.get(k)?.goals ?? 0) + 1 });
  }
  return [...map.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

/** Media voto per giocatore, con almeno meta' delle partite giocate dalla sua squadra. */
export function ratingTable(T) {
  const map = new Map(), played = T.teams.map(() => 0);
  for (const m of allMatches(T)) {
    if (!m.res) continue;
    played[m.home]++; played[m.away]++;
    for (const [side, name, rating, goals, assists] of m.res.players) {
      const team = side ? m.away : m.home, k = `${team}|${name}`, o = map.get(k) ?? { team, name, sum: 0, n: 0, goals: 0, assists: 0, best: 0 };
      o.sum += rating; o.n++; o.goals += goals; o.assists += assists; map.set(k, o);
    }
    const b = m.res.best, k = `${b.side ? m.away : m.home}|${b.name}`; if (map.has(k)) map.get(k).best++;
  }
  return [...map.values()].filter(o => o.n >= Math.ceil(played[o.team] / 2)).map(o => ({ ...o, avg: o.sum / o.n }))
    .sort((a, b) => b.avg - a.avg || b.goals - a.goals || a.name.localeCompare(b.name));
}

/** Squadra vincitrice (indice) a torneo finito, altrimenti -1. */
export function champion(T) {
  if (!isOver(T)) return -1;
  if (T.format !== 'cup') return standings(T)[0].team;
  const f = T.rounds.at(-1).matches[0];
  return f ? (winnerSide(f.res) ? f.away : f.home) : T.rounds.at(-1).byes[0];
}

/** Squadre ancora in gara in coppa. */
export function alive(T) {
  if (T.format !== 'cup') return T.teams.map((_, i) => i);
  const last = T.rounds.at(-1);
  return [...last.byes, ...last.matches.flatMap(m => m.res ? [winnerSide(m.res) ? m.away : m.home] : [m.home, m.away])];
}
