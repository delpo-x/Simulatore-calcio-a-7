// Squadre dell'app: squadre generiche predefinite, squadre personalizzate (salvate nel browser) e file squadra.
import { syntheticTeam, readTeam, pickLineup } from '../core/team.js';

export const PRESETS = [
  { id: 'leoni', name: 'Leoni Rossi', short: 'LEO', kit: { shirt: '#c62828', shorts: '#ffffff', socks: '#c62828', gk: '#2e7d32' }, level: 15, scheme: '2-3-1' },
  { id: 'squali', name: 'Squali Blu', short: 'SQU', kit: { shirt: '#1e5bb8', shorts: '#0d2b5c', socks: '#ffffff', gk: '#f9a825', pattern: 'stripes', trim: '#0d3d8f' }, level: 15, scheme: '3-2-1' },
  { id: 'aquile', name: 'Aquile Verdi', short: 'AQU', kit: { shirt: '#2e8b57', shorts: '#ffffff', socks: '#2e8b57', gk: '#6a1b9a' }, level: 14, scheme: '2-2-2' },
  { id: 'lupi', name: 'Lupi Neri', short: 'LUP', kit: { shirt: '#222222', shorts: '#222222', socks: '#ffffff', gk: '#ef6c00', pattern: 'hoops', trim: '#444444' }, level: 16, scheme: '2-3-1' },
  { id: 'tigri', name: 'Tigri Arancio', short: 'TIG', kit: { shirt: '#f57c00', shorts: '#1a1a1a', socks: '#f57c00', gk: '#00838f', pattern: 'bands', trim: '#1a1a1a' }, level: 13, scheme: '3-1-2' },
  { id: 'falchi', name: 'Falchi Gialli', short: 'FAL', kit: { shirt: '#fdd835', shorts: '#1565c0', socks: '#fdd835', gk: '#c2185b' }, level: 14, scheme: '1-3-2' },
  { id: 'orsi', name: 'Orsi Bianchi', short: 'ORS', kit: { shirt: '#f5f5f5', shorts: '#263238', socks: '#f5f5f5', gk: '#d84315' }, level: 15, scheme: '3-2-1' },
  { id: 'volpi', name: 'Volpi Viola', short: 'VOL', kit: { shirt: '#6a1b9a', shorts: '#ffffff', socks: '#6a1b9a', gk: '#43a047' }, level: 14, scheme: '2-3-1' },
];

const SURNAMES = ['Bianchi', 'Ferri', 'Conti', 'Galli', 'Marini', 'Rinaldi', 'Testa', 'Fontana', 'Moretti', 'Greco', 'Leone', 'Serra', 'Colombo', 'Riva',
  'Sala', 'Gatti', 'Pellegrini', 'Valli', 'Fabbri', 'Bruno', 'Caruso', 'Villa', 'Rizzo', 'Lombardi', 'Barbieri', 'Mancini', 'Longo', 'Martini',
  'Ferraro', 'Giordano', 'Costa', 'Gallo', 'Neri', 'Pace', 'Sorrentino', 'Monti', 'Farina', 'Cattaneo', 'Orlando', 'Grasso', 'Vitale', 'Bellini'];
const INITIALS = 'ABCDEFGLMNPRSTV';

function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Squadra completa (formato di team.js) per una definizione dell'app: file caricato, oppure sintetica con nomi inventati e piccole differenze tra giocatori. */
export function buildTeam(def, perTeam) {
  if (def.file) return readTeam(def.file);
  const t = syntheticTeam(def.name, def.level, perTeam), r = rng(hash(def.name));
  const used = new Set();
  for (const p of t.players) {
    let s; do s = SURNAMES[Math.floor(r() * SURNAMES.length)]; while (used.has(s)); used.add(s); // cognomi diversi nella stessa squadra
    p.name = `${INITIALS[Math.floor(r() * INITIALS.length)]}. ${s}`;
    for (const k in p.attrs) p.attrs[k] = Math.max(1, Math.min(20, p.attrs[k] + Math.round((r() - 0.5) * 2))); // +-1
  }
  return t;
}

const POOLS = { Goalkeeper: [1, 12], Defender: [2, 3, 4, 5, 6, 13, 14], Midfielder: [8, 7, 10, 6, 4, 15, 16], Forward: [9, 11, 10, 7, 17, 18] };

/** Titolari per lo schema e numeri di maglia secondo il ruolo. */
export function lineupFor(def, perTeam, scheme) {
  const lineup = pickLineup(buildTeam(def, perTeam), scheme), used = new Set();
  const lines = scheme.split('-').map(Number), roles = ['Goalkeeper', ...lines.flatMap((c, i) => Array(c).fill(lines.length === 2 ? ['Defender', 'Forward'][i] : ['Defender', 'Midfielder', 'Forward'][i]))];
  lineup.forEach((p, i) => {
    let n = (POOLS[roles[i]] ?? []).find(x => !used.has(x)) ?? 0;
    for (let k = 19; !n; k++) if (!used.has(k)) n = k;
    used.add(n); p.number = n;
  });
  return lineup;
}

const KEY = 'calcio7.squadre';
export function loadCustom() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
export function saveCustom(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* memoria del browser non disponibile */ } }
