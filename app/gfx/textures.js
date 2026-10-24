import * as THREE from '../../vendor/three.module.min.js';
import { RULES } from '../../core/sim.js';
import { canvas, clamp, tex } from './util.js';

/** Campo: strisce di taglio con pettinatura e grana dei fili d'erba, poi linee nitide, aree, area piccola, dischetto, archi d'angolo. Risoluzione alta (fino a 4096 px). */
export function pitchTexture(P) {
  const s = clamp(Math.floor(4096 / (P.hx * 2)), 20, 40), W = Math.round(P.hx * 2 * s), H = Math.round(P.hz * 2 * s), cx = W / 2, cz = H / 2;
  const [c, g] = canvas(W, H), n = Math.max(8, Math.round(P.hx * 2 / 5));
  for (let i = 0; i < n; i++) { // ogni fascia ha un lieve gradiente nel senso di taglio: da lontano si legge la direzione del rasaerba
    const x0 = i * W / n, gr = g.createLinearGradient(x0, 0, x0 + W / n, 0), a = i % 2 ? [58, 156, 70] : [50, 142, 62];
    gr.addColorStop(0, `rgb(${a[0] - 4},${a[1] - 6},${a[2] - 4})`); gr.addColorStop(1, `rgb(${a[0] + 4},${a[1] + 6},${a[2] + 4})`);
    g.fillStyle = gr; g.fillRect(x0, 0, W / n + 1, H);
  }
  const img = g.getImageData(0, 0, W, H), d = img.data; // grana: ogni pixel varia, a macchie larghe e a puntini
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < d.length; i += 4) { const v = (rnd() - 0.5) * 16; d[i] += v * 0.6; d[i + 1] += v; d[i + 2] += v * 0.6; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < W * H / 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,200' : '0,40,0'},${0.015 + rnd() * 0.025})`; g.beginPath(); g.ellipse(rnd() * W, rnd() * H, (2 + rnd() * 5) * s / 20, (1.5 + rnd() * 3) * s / 20, rnd() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,0.96)'; g.fillStyle = '#fff'; g.lineWidth = 0.12 * s;
  const R = (x, z, w, h) => g.strokeRect(cx + x * s, cz + z * s, w * s, h * s);
  const dot = (x, z, r = 0.18) => { g.beginPath(); g.arc(cx + x * s, cz + z * s, r * s, 0, 7); g.fill(); };
  R(-P.hx + 0.06, -P.hz + 0.06, P.hx * 2 - 0.12, P.hz * 2 - 0.12);
  g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H); g.stroke();
  g.beginPath(); g.arc(cx, cz, Math.min(9.15, P.hz * 0.3) * s, 0, 7); g.stroke(); dot(0, 0);
  const big = P.hx * 2 >= 90, sd = big ? 5.5 : RULES.smallAreaDepth, sw = Math.min(big ? 18.32 : RULES.smallAreaWidth, P.areaWidth - 2);
  for (const d of [-1, 1]) {
    R(d < 0 ? -P.hx : P.hx - P.areaDepth, -P.areaWidth / 2, P.areaDepth, P.areaWidth);
    R(d < 0 ? -P.hx : P.hx - sd, -sw / 2, sd, sw);
    dot(d * (P.hx - P.penaltySpot), 0);
    for (const e of [-1, 1]) { g.beginPath(); g.arc(cx + d * P.hx * s, cz + e * P.hz * s, 1 * s, 0, 7); g.stroke(); }
  }
  return tex(c);
}

/** Mappa di rilievo e rugosita' dell'erba: fili e grumi in toni chiari (il valore e' una rugosita' tra 0,7 e 1), ripetuta su tutto il campo. */
export function turfRelief() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 256, 256);
  let seed = 777; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 5200; i++) { const v = 170 + rnd() * 85 | 0, x = rnd() * 256, y = rnd() * 256, l = 3 + rnd() * 6, a = -0.5 + rnd(); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 0.8 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke(); }
  for (let i = 0; i < 700; i++) { const v = 150 + rnd() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 0, 7); g.fill(); }
  return tex(c, { repeat: [1, 1], linear: true });
}

/** Rete: maglie a rombo su fondo trasparente (canale alpha, usato con alphaTest). */
export function netTexture() {
  const [c, g] = canvas(64, 64);
  g.clearRect(0, 0, 64, 64); g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'square'; // maglie larghe e linee spesse: a distanza di telecamera una rete fine sparisce
  g.beginPath(); g.moveTo(-8, 32); g.lineTo(32, -8); g.moveTo(32, 72); g.lineTo(72, 32); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(0, 64); g.lineTo(64, 0); g.stroke();
  return tex(c);
}

/** Cartelloni pubblicitari: testo generico ripetuto. */
export function boardTexture(len) {
  const [c, g] = canvas(1024, 64), cols = ['#0d3b66', '#c1121f', '#1b998b', '#f4a261'];
  for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect(i * 256, 0, 256, 64); g.fillStyle = '#fff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['CALCIO A 7', 'SIMULATORE', 'FAIR PLAY', 'IA vs IA'][i], i * 256 + 128, 34); }
  return tex(c, { repeat: [Math.max(1, len / 24), 1] });
}

/** Pubblico: file di spettatori in colori spenti su gradinate scure, con poca variazione. */
export function crowdTexture() {
  const [c, g] = canvas(512, 256), hues = [212, 8, 40, 190, 0], rnd = (() => { let t = 7; return () => (t = (t * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const bg = g.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, '#20252b'); bg.addColorStop(1, '#2c3239');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 16; row++) {
    g.fillStyle = row % 2 ? '#2b3138' : '#272c33'; g.fillRect(0, row * 16 + 12, 512, 4);
    for (let x = 0; x < 512; x += 8) {
      if (rnd() < 0.1) continue;
      const hue = rnd() < 0.55 ? 215 + rnd() * 10 : hues[(rnd() * hues.length) | 0] + rnd() * 14;
      g.fillStyle = `hsl(${hue},${12 + rnd() * 20}%,${26 + rnd() * 20}%)`;
      g.fillRect(x + rnd() * 2, row * 16 + 3 + rnd() * 2, 6, 9);
      g.fillStyle = `hsl(28,${20 + rnd() * 15}%,${38 + rnd() * 18}%)`; g.fillRect(x + 1.5 + rnd(), row * 16 + 1, 3, 3); // testa
    }
  }
  return tex(c, { repeat: [6, 1] });
}

/** Rete metallica: maglie a rombo su fondo trasparente. */
export function fenceTexture() {
  const [c, g] = canvas(32, 32);
  g.strokeStyle = 'rgba(190,198,206,0.95)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(0, 32); g.lineTo(32, 0); g.stroke();
  return tex(c);
}

export function skyTexture() {
  const [c, g] = canvas(4, 256), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5d97cf'); gr.addColorStop(0.65, '#a9cbea'); gr.addColorStop(1, '#e3eef8');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return tex(c);
}

export function blobTexture() {
  const [c, g] = canvas(64, 64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
}

/** Pallone a icosaedro troncato (12 pentagoni neri + 20 esagoni bianchi): ogni texel e' campionato sulla sfera, quindi nessuna distorsione ai poli. */
export function ballTexture() {
  const W = 512, H = 256, [c, g] = canvas(W, H), img = g.createImageData(W, H), phi = (1 + Math.sqrt(5)) / 2, norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const pent = [], hexa = [];
  for (const a of [-1, 1]) for (const b of [-phi, phi]) pent.push(norm([0, a, b]), norm([a, b, 0]), norm([b, 0, a])); // 12 vertici dell'icosaedro
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) hexa.push(norm([a, b, d])); // 8 + 12 centri delle facce
  for (const a of [-1, 1]) for (const b of [-phi, phi]) hexa.push(norm([a / phi, 0, b]), norm([b, a / phi, 0]), norm([0, b, a / phi]));
  const cells = [...pent.map(v => ({ v, pent: true, r: 0.2875 })), ...hexa.map(v => ({ v, pent: false, r: 0.3648 }))]; // raggio inscritto angolare (rad): il confine e' dove i punteggi si eguagliano
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ph = (x + 0.5) / W * Math.PI * 2, th = (y + 0.5) / H * Math.PI, st = Math.sin(th), d = [-Math.cos(ph) * st, Math.cos(th), Math.sin(ph) * st];
    let b1 = 9, b2 = 9, cell = null;
    for (const q of cells) { const s = Math.acos(Math.min(1, d[0] * q.v[0] + d[1] * q.v[1] + d[2] * q.v[2])) - q.r; if (s < b1) { b2 = b1; b1 = s; cell = q; } else if (s < b2) b2 = s; }
    const seam = Math.max(0, 1 - (b2 - b1) / 0.045), e = seam * seam * (3 - 2 * seam), o = (y * W + x) * 4;
    const base = cell.pent ? 26 : 246 - Math.min(30, (b1 + cell.r) * 60); // esagono: leggermente piu' scuro verso il bordo
    const v = base + (150 - base) * e * (cell.pent ? 0.15 : 0.9);
    img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v + (cell.pent ? 0 : 2); img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); return tex(c);
}

export function numberTexture(num, color, outline) {
  const [c, g] = canvas(128, 128);
  g.font = 'bold 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = outline; g.strokeText(String(num), 64, 70); g.fillStyle = color; g.fillText(String(num), 64, 70);
  return tex(c);
}

/** Colore leggibile sopra un altro: bianco o quasi nero. */
export function contrast(hex) {
  const c = new THREE.Color(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.6 ? '#111' : '#fff';
}

/** Colore secondario della maglia: bordini, strisce e fasce (kit.trim, altrimenti una tinta piu' scura o chiara della maglia). */
export function kitTrim(kit, gk) {
  const base = gk ? kit.gk : kit.shirt;
  if (!gk && kit.trim) return kit.trim;
  const c = new THREE.Color(base), l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return '#' + (l > 0.55 ? c.clone().multiplyScalar(0.62) : c.clone().lerp(new THREE.Color(0xffffff), 0.42)).getHexString();
}

const SHIRTS = new Map();
/** Texture della maglia sul busto: tinta unita, strisce verticali, righe orizzontali o fasce, con colletto e orlo (kit.pattern: plain | stripes | hoops | bands). Una per divisa. */
export function shirtTexture(kit, gk) {
  const pat = gk ? 'plain' : kit.pattern || 'plain', base = gk ? kit.gk : kit.shirt, trim = kitTrim(kit, gk), key = `${base}|${trim}|${pat}`;
  if (SHIRTS.has(key)) return SHIRTS.get(key);
  const [c, g] = canvas(256, 128); g.fillStyle = base; g.fillRect(0, 0, 256, 128); g.fillStyle = trim;
  if (pat === 'stripes') { for (let i = 0; i < 8; i++) if (i % 2) g.fillRect(i * 32, 0, 32, 128); }
  else if (pat === 'hoops') { for (let i = 0; i < 6; i++) if (i % 2) g.fillRect(0, 12 + i * 18, 256, 18); }
  else if (pat === 'bands') g.fillRect(0, 50, 256, 26);
  g.fillStyle = trim; g.fillRect(0, 0, 256, 9); g.fillRect(0, 122, 256, 6); // colletto in alto, orlo in basso
  g.fillStyle = 'rgba(0,0,0,0.10)'; for (let i = 0; i < 2; i++) g.fillRect(i * 128, 0, 2, 128); // cuciture laterali
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; SHIRTS.set(key, t); return t;
}

/** Cartellino col nome: sfondo scuro semitrasparente arrotondato, numero a sinistra; una texture per testo. */
const TAGS = new Map();
export function nameTag(text) {
  if (TAGS.has(text)) return TAGS.get(text);
  const [c, g] = canvas(384, 72), r = 22;
  g.fillStyle = 'rgba(10,16,26,0.78)'; g.beginPath(); g.roundRect(4, 4, 376, 64, r); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#fff'; g.font = '600 34px system-ui, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 192, 38, 350);
  const t = tex(c); TAGS.set(text, t); return t;
}
