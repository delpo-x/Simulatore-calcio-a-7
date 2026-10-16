// File squadra e attributi dei giocatori (ticket 09). Attributi 1-20 -> moltiplicatori dei valori base.

/** Attributi che il motore usa davvero, per i giocatori di movimento e per i portieri. */
export const ATTRS_COMMON = ['Velocita', 'Accelerazione', 'Agilita', 'Resistenza'];
export const ATTRS_OUT = [...ATTRS_COMMON, 'Equilibrio', 'IntegritaFisica', 'Contrasti', 'Dribbling', 'Forza', 'Aggressivita',
  'Passaggi', 'VisioneGioco', 'Finalizzazione', 'TiriLontano', 'Concentrazione', 'PrimoTocco'];
export const ATTRS_GK = [...ATTRS_COMMON, 'Riflessi', 'Uscite', 'Posizione', 'Concentrazione'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Scala per velocita': 0,90 a 10, 1,05 a 20. */
export const fScale = a => 0.90 + 0.015 * (clamp(a, 1, 20) - 10);
/** Scala neutra a 15: 0,90 a 10, 1,10 a 20. */
export const nScale = a => 1 + 0.02 * (clamp(a, 1, 20) - 15);

/** Valida un giocatore del file squadra e restituisce { name, position, secondaryPosition, foot, starter, attrs }. */
export function readPlayer(raw, index = 0) {
  const name = raw?.name ?? `giocatore ${index + 1}`;
  const gk = raw?.position === 'Goalkeeper';
  if (!['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].includes(raw?.position)) throw new Error(`Giocatore "${name}": ruolo "${raw?.position}" non valido`);
  if (raw.foot !== undefined && !['DX', 'SX'].includes(raw.foot)) throw new Error(`Giocatore "${name}": piede "${raw.foot}" non valido (DX o SX)`);
  const s = raw.scouting;
  if (!s || typeof s !== 'object') throw new Error(`Giocatore "${name}": manca "scouting"`);
  const attrs = {};
  for (const k of gk ? ATTRS_GK : ATTRS_OUT) {
    if (!(k in s)) throw new Error(`Giocatore "${name}": attributo "${k}" mancante`);
    if (!Number.isFinite(s[k]) || s[k] < 1 || s[k] > 20) throw new Error(`Giocatore "${name}": attributo "${k}" fuori scala (1-20): ${s[k]}`);
    attrs[k] = s[k];
  }
  return { name, position: raw.position, secondaryPosition: raw.secondaryPosition ?? null, foot: raw.foot ?? 'DX', starter: !!raw.starter, attrs };
}

/** Legge un file squadra { name, players: [...] }; ignora i campi non modellati. */
export function readTeam(obj) {
  if (!obj || !Array.isArray(obj.players)) throw new Error('File squadra: manca "players"');
  return { name: obj.name ?? 'Squadra', players: obj.players.map(readPlayer) };
}

/** Sceglie i giocatori per uno schema "d-c-a": un portiere piu' le linee, titolari per primi; ordine = ordine di layout(). */
export function pickLineup(team, scheme) {
  const lines = scheme.split('-').map(Number), names = lines.length === 2 ? ['Defender', 'Forward'] : ['Defender', 'Midfielder', 'Forward'];
  const pool = [...team.players].sort((a, b) => Number(b.starter) - Number(a.starter));
  const take = pred => { const i = pool.findIndex(pred); return i < 0 ? null : pool.splice(i, 1)[0]; };
  const gk = take(p => p.position === 'Goalkeeper');
  if (!gk) throw new Error(`Squadra "${team.name}": nessun portiere`);
  const out = [{ ...gk, offRole: false }];
  lines.forEach((c, li) => { for (let i = 0; i < c; i++) {
    const role = names[li];
    let q = take(p => p.position === role || p.secondaryPosition === role);
    let off = false;
    if (!q) { q = take(p => p.position !== 'Goalkeeper'); off = true; }
    if (!q) throw new Error(`Squadra "${team.name}": giocatori insufficienti per lo schema ${scheme}`);
    out.push({ ...q, offRole: off });
  } });
  return out;
}

/** Squadra sintetica con tutti gli attributi a `level` (esempio e test; nessun giocatore reale). */
export function syntheticTeam(name = 'Squadra', level = 15, perTeam = 7) {
  const roles = ['Goalkeeper', 'Defender', 'Defender', 'Midfielder', 'Midfielder', 'Midfielder', 'Forward'];
  const players = Array.from({ length: Math.max(perTeam, 7) + 3 }, (_, i) => {
    const position = i < 7 ? roles[i] : ['Defender', 'Midfielder', 'Forward'][i % 3];
    const scouting = {};
    for (const k of new Set([...ATTRS_OUT, ...ATTRS_GK])) scouting[k] = level;
    return { name: `Giocatore ${i + 1}`, position, foot: i % 4 === 3 ? 'SX' : 'DX', starter: i < perTeam, scouting };
  });
  return readTeam({ name, players });
}

/** Moltiplicatori derivati dagli attributi. Senza attributi tutti valgono 1 (giocatore neutro, valori base). */
export const NEUTRAL = Object.freeze({ speed: 1, acc: 1, agi: 1, balance: 1, stamina: 1, stun: 1, passErr: 1, shotNear: 1, shotFar: 1, react: 1, press: 1, foul: 1, vision: 1, touch: 1, reach: 1, exit: 1, posErr: 1, rated: false });

export function deriveSkill(pl) {
  const a = pl.attrs, o = pl.position !== 'Goalkeeper';
  const off = pl.offRole ? 1 / 0.95 : 1; // fuori ruolo: i moltiplicatori tecnici si riducono del 5% (errore piu' alto)
  const k = {
    speed: fScale(a.Velocita), acc: fScale(a.Accelerazione), agi: fScale(a.Agilita), stamina: a.Resistenza / 15,
    react: 15 / a.Concentrazione, balance: 1, stun: 1, passErr: 1, shotNear: 1, shotFar: 1, press: 1, foul: 1, vision: 1, touch: 1, reach: 1, exit: 1, posErr: 1, rated: true,
  };
  if (o) Object.assign(k, {
    balance: 15 / a.Equilibrio, stun: 15 / a.IntegritaFisica, passErr: 15 / a.Passaggi * off, shotNear: 15 / a.Finalizzazione * off, shotFar: 15 / a.TiriLontano * off,
    press: nScale(a.Aggressivita), foul: nScale(a.Aggressivita), vision: 1 + 0.03 * (a.VisioneGioco - 15), touch: nScale(a.PrimoTocco),
  });
  else Object.assign(k, { reach: nScale(a.Riflessi), exit: nScale(a.Uscite), posErr: 15 / a.Posizione });
  return k;
}
