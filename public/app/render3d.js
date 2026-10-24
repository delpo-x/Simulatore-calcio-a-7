// Grafica 3D low-poly in stile televisivo per l'app: stadio, giocatori animati con maglia e numero, palla, quattro telecamere.
// Legge solo lo stato della simulazione (o di un replay) e non lo modifica.
import * as THREE from '../vendor/three.module.min.js';
import { RULES } from '../core/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKINS = [0xf1c7a1, 0xe0ac7e, 0xc68a5c, 0x8d5a3b, 0x6b4129];
const HAIRS = [0x2b1d14, 0x4a2f1b, 0x111111, 0x8a6236, 0xc9a35f];

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
let ANISO = 8; // anisotropia massima della scheda, impostata alla creazione del renderer
function tex(c, { repeat, linear } = {}) {
  const t = new THREE.CanvasTexture(c); if (!linear) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** Campo: strisce di taglio con pettinatura e grana dei fili d'erba, poi linee nitide, aree, area piccola, dischetto, archi d'angolo. Risoluzione alta (fino a 4096 px). */
function pitchTexture(P) {
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
function turfRelief() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 256, 256);
  let seed = 777; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 5200; i++) { const v = 170 + rnd() * 85 | 0, x = rnd() * 256, y = rnd() * 256, l = 3 + rnd() * 6, a = -0.5 + rnd(); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 0.8 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke(); }
  for (let i = 0; i < 700; i++) { const v = 150 + rnd() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 0, 7); g.fill(); }
  return tex(c, { repeat: [1, 1], linear: true });
}

/** Rete: maglie a rombo su fondo trasparente (canale alpha, usato con alphaTest). */
function netTexture() {
  const [c, g] = canvas(64, 64);
  g.clearRect(0, 0, 64, 64); g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'square'; // maglie larghe e linee spesse: a distanza di telecamera una rete fine sparisce
  g.beginPath(); g.moveTo(-8, 32); g.lineTo(32, -8); g.moveTo(32, 72); g.lineTo(72, 32); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(0, 64); g.lineTo(64, 0); g.stroke();
  return tex(c);
}

const _nv = new THREE.Vector3(), _nl = new THREE.Vector3();
/** Rete elastica: la griglia di vertici si sposta lungo la normale con onde smorzate che partono dal punto d'impatto; i bordi restano fissati a pali e traversa. */
class NetSim {
  constructor(mesh) {
    this.mesh = mesh; this.hits = []; this.dirty = false;
    const pos = mesh.geometry.attributes.position, w = mesh.geometry.parameters.width / 2, h = mesh.geometry.parameters.height / 2;
    this.base = pos.array.slice(); this.pin = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { const e = Math.min(w - Math.abs(this.base[i * 3]), h - Math.abs(this.base[i * 3 + 1])) / 0.5, t = clamp(e, 0, 1); this.pin[i] = t * t * (3 - 2 * t); }
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3)); mesh.material.vertexColors = true;
  }
  /** point: punto d'impatto nel mondo; vel: velocita' della palla persa nell'urto. */
  hit(point, vel) {
    this.mesh.updateWorldMatrix(true, false);
    _nv.set(0, 0, 1).transformDirection(this.mesh.matrixWorld);
    const l = _nl.copy(point); this.mesh.worldToLocal(l);
    if (Math.abs(l.z) > 0.5) return; // la palla non tocca questo pannello (e' su quello opposto o davanti)
    const a = vel.dot(_nv) * 0.07; if (Math.abs(a) < 0.1) return;
    this.hits.push({ x: l.x, y: l.y, a: clamp(a, -0.9, 0.9), t: 0 }); if (this.hits.length > 4) this.hits.shift();
  }
  update(dt) {
    if (!this.hits.length && !this.dirty) return;
    for (const h of this.hits) h.t += dt;
    this.hits = this.hits.filter(h => h.t < 1.8); this.dirty = this.hits.length > 0;
    const g = this.mesh.geometry, pos = g.attributes.position, col = g.attributes.color, b = this.base, S = 2 * 0.9 * 0.9;
    for (let i = 0; i < pos.count; i++) {
      let z = 0;
      for (const h of this.hits) { const dx = b[i * 3] - h.x, dy = b[i * 3 + 1] - h.y, r2 = dx * dx + dy * dy; z += h.a * Math.exp(-r2 / S) * Math.exp(-2.6 * h.t) * Math.sin(13.8 * h.t + 0.6 - 1.2 * Math.sqrt(r2)); } // gonfia in ~70 ms, rimbalza oltre la posizione di riposo (~2,2 Hz) e si smorza; l'onda parte dal punto d'impatto
      z *= this.pin[i]; pos.array[i * 3 + 2] = z; const c = 1 - Math.min(0.45, Math.abs(z) * 1.1); col.array[i * 3] = col.array[i * 3 + 1] = col.array[i * 3 + 2] = c; // maglie piu' scure dove la rete e' in tensione
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}

function goal(dir, P) {
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3 }), grp = new THREE.Group(), D = Math.min(2.2, P.goalH * 1.0), nets = [];
  const cyl = (len, x, y, z, axis) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 16), white);
    m.castShadow = true;
    if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z); grp.add(m);
  };
  const w = P.goalHalf * 2, h = P.goalH;
  cyl(h, 0, h / 2, -P.goalHalf); cyl(h, 0, h / 2, P.goalHalf); cyl(w, 0, h, 0, 'z');
  cyl(D, dir * D / 2, h, -P.goalHalf, 'x'); cyl(D, dir * D / 2, h, P.goalHalf, 'x'); cyl(w, dir * D, 0.03, 0, 'z');
  const net = (wd, ht, rep) => { const t = netTexture(); t.repeat.set(...rep); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht, Math.max(4, Math.round(wd / 0.25)), Math.max(4, Math.round(ht / 0.25))), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }));
    nets.push(new NetSim(m)); return m; }; // griglia fitta: i vertici si spostano quando la palla colpisce la rete
  const back = net(w, h, [w * 2.5, h * 2.5]); back.rotation.y = Math.PI / 2; back.position.set(dir * D, h / 2, 0); grp.add(back);
  const top = net(D, w, [D * 2.5, w * 2.5]); top.rotation.x = -Math.PI / 2; top.position.set(dir * D / 2, h, 0); grp.add(top);
  for (const e of [-1, 1]) { const side = net(D, h, [D * 2.5, h * 2.5]); side.position.set(dir * D / 2, h / 2, e * P.goalHalf); grp.add(side); }
  grp.position.x = dir * P.hx; grp.userData = { dir, nets };
  return grp;
}

/** Cartelloni pubblicitari: testo generico ripetuto. */
function boardTexture(len) {
  const [c, g] = canvas(1024, 64), cols = ['#0d3b66', '#c1121f', '#1b998b', '#f4a261'];
  for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect(i * 256, 0, 256, 64); g.fillStyle = '#fff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['CALCIO A 7', 'SIMULATORE', 'FAIR PLAY', 'IA vs IA'][i], i * 256 + 128, 34); }
  return tex(c, { repeat: [Math.max(1, len / 24), 1] });
}

/** Pubblico: file di spettatori in colori spenti su gradinate scure, con poca variazione. */
function crowdTexture() {
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

function stadium(P, scene) {
  const W = P.hx * 2, Hz = P.hz * 2, m = Math.max(4, P.hz * 0.25);
  const run = new THREE.Mesh(new THREE.PlaneGeometry(W + m * 2 + 4, Hz + m * 2 + 4), new THREE.MeshLambertMaterial({ color: 0x2e7f36 }));
  run.rotation.x = -Math.PI / 2; run.position.y = -0.01; scene.add(run);
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const g2 = gc.getContext('2d'); g2.fillStyle = '#b4a58d'; g2.fillRect(0, 0, 128, 128); // ghiaia attorno al campo: la palla uscita rallenta
  for (let i = 0; i < 900; i++) { g2.fillStyle = `hsl(${30 + Math.random() * 15} ${10 + Math.random() * 15}% ${45 + Math.random() * 30}%)`; g2.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set((W + 8) / 3, (Hz + 8) / 3); gt.colorSpace = THREE.SRGBColorSpace;
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(W + 8, Hz + 8), new THREE.MeshLambertMaterial({ map: gt }));
  gravel.rotation.x = -Math.PI / 2; gravel.position.y = -0.004; gravel.receiveShadow = true; scene.add(gravel);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, Hz + 4), new THREE.MeshLambertMaterial({ color: 0x2e7f36 })); // 2 m di erba tra le linee e la ghiaia
  strip.rotation.x = -Math.PI / 2; strip.position.y = -0.002; strip.receiveShadow = true; scene.add(strip);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 6 + 300, Hz * 6 + 300), new THREE.MeshLambertMaterial({ color: 0x4d545c }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);
  const board = (len, x, z, ry) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.12), [0, 0, 0, 0, 1, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: boardTexture(len) }) : new THREE.MeshLambertMaterial({ color: 0x20262c })));
    b.position.set(x, 0.45, z); b.rotation.y = ry; scene.add(b);
  };
  board(W + m * 2, 0, -P.hz - m, 0); // lato telecamera senza cartelloni: coprirebbero la linea laterale vicina
  for (const d of [-1, 1]) for (const e of [-1, 1]) board(P.hz - 4, d * (P.hx + m), e * (P.hz / 2 + 2.5), d * Math.PI / 2);
  const crowd = new THREE.MeshLambertMaterial({ map: crowdTexture() }), roof = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
  const stand = (len, depth, x, z, ry) => {
    const g = new THREE.Group(), rise = depth * 0.62, slope = Math.hypot(depth, rise);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(len, slope), crowd); s.rotation.x = -Math.atan2(depth, rise); s.position.set(0, rise / 2, -depth / 2); g.add(s);
    const back = new THREE.Mesh(new THREE.BoxGeometry(len, rise + 3, 0.6), roof); back.position.set(0, (rise + 3) / 2, -depth - 0.3); g.add(back);
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, depth * 0.55), roof); top.position.set(0, rise + 3, -depth * 0.75); g.add(top);
    g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  };
  const depth = Math.max(10, P.hz * 0.8);
  stand(W + m * 2 + 10, depth, 0, -P.hz - m - 1.5, 0);
  for (const d of [-1, 1]) stand(Hz + m * 2, depth * 0.7, d * (P.hx + m + 1.5), 0, -d * Math.PI / 2);
  const pole = new THREE.MeshLambertMaterial({ color: 0x8b939c }), lamp = new THREE.MeshBasicMaterial({ color: 0xfff7d6 });
  const h = Math.max(18, P.hz * 1.4);
  for (const d of [-1, 1]) for (const e of [-1, 1]) {
    const x = d * (P.hx + m + depth * 0.7), z = e * (P.hz + m + (e < 0 ? depth : 4));
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 8), pole); p.position.set(x, h / 2, z); scene.add(p);
    const l = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), lamp); l.position.set(x, h + 1, z); l.lookAt(0, 0, 0); scene.add(l);
    const sp = new THREE.SpotLight(0xfff1d6, 1, 0, 0.75, 0.6, 2); // torre faro: cono largo e morbido sul campo, senza ombre proprie (l'ombra nitida viene dal sole)
    sp.position.set(x, h + 1, z); sp.target.position.set(0, 0, 0); sp.intensity = Math.hypot(x, z, h) ** 2 * 0.55; scene.add(sp, sp.target);
  }
  fence(P, m, scene); benches(P, scene);
}

/** Rete metallica: maglie a rombo su fondo trasparente. */
function fenceTexture() {
  const [c, g] = canvas(32, 32);
  g.strokeStyle = 'rgba(190,198,206,0.95)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(0, 32); g.lineTo(32, 0); g.stroke();
  return tex(c);
}

/** Recinzione perimetrale: bassa lungo il lato della telecamera (non copre il gioco), alta dietro le porte, con paletti. */
function fence(P, m, scene) {
  const post = new THREE.MeshStandardMaterial({ color: 0x2f3a44, roughness: 0.6, metalness: 0.5 });
  const wire = (len, h, x, z, ry) => {
    const t = fenceTexture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 0.5, h / 0.5);
    const m1 = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    m1.position.set(x, h / 2 + 0.05, z); m1.rotation.y = ry; scene.add(m1);
    const n = Math.max(2, Math.round(len / 4)); // paletti e corrimano
    for (let i = 0; i <= n; i++) {
      const o = (i / n - 0.5) * len, px = x + Math.cos(ry) * o, pz = z - Math.sin(ry) * o;
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h + 0.1, 8), post); pm.position.set(px, h / 2 + 0.05, pz); pm.castShadow = true; scene.add(pm);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 8), post); rail.rotation.z = Math.PI / 2; rail.rotation.y = ry; rail.position.set(x, h + 0.1, z); scene.add(rail);
  };
  const fz = P.hz + m + 0.8, fx = P.hx + m + 1.2;
  wire(P.hx * 2 + m * 2 + 2.4, 1.2, 0, fz, 0); // lato telecamera: bassa
  for (const d of [-1, 1]) wire((P.hz + m + 0.8) * 2, 4, d * fx, 0, Math.PI / 2); // dietro le porte: alta
}

/** Panchine a bordo campo (lato opposto alla telecamera): due panche con tettoia trasparente e sedute. */
function benches(P, scene) {
  const seat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.7 }), frame = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.4, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6f2, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  const z = -(P.hz + 2.2);
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(), L = 4.2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.42), seat); b.position.set(0, 0.46, 0.5); g.add(b);
    for (const e of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.06), frame); leg.position.set(e * (L / 2 - 0.2), 0.23, 0.5); g.add(leg); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(L, 0.55, 0.05), seat); back.position.set(0, 0.8, 0.28); g.add(back);
    for (const e of [-1, 1]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), frame); po.position.set(e * (L / 2 + 0.1), 1.15, 0.1); g.add(po); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 0.5, 0.05, 1.3), glass); roof.position.set(0, 2.3, 0.45); roof.rotation.x = 0.08; g.add(roof);
    const back2 = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 1.9, 0.03), glass); back2.position.set(0, 1.2, 0.05); g.add(back2);
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.material !== glass; o.receiveShadow = true; } });
    g.position.set(sx * 8, 0, z); scene.add(g);
  }
}

function skyTexture() {
  const [c, g] = canvas(4, 256), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5d97cf'); gr.addColorStop(0.65, '#a9cbea'); gr.addColorStop(1, '#e3eef8');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return tex(c);
}

function blobTexture() {
  const [c, g] = canvas(64, 64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
}

/** Pallone a icosaedro troncato (12 pentagoni neri + 20 esagoni bianchi): ogni texel e' campionato sulla sfera, quindi nessuna distorsione ai poli. */
function ballTexture() {
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

function numberTexture(num, color, outline) {
  const [c, g] = canvas(128, 128);
  g.font = 'bold 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = outline; g.strokeText(String(num), 64, 70); g.fillStyle = color; g.fillText(String(num), 64, 70);
  return tex(c);
}

/** Colore leggibile sopra un altro: bianco o quasi nero. */
export function contrast(hex) {
  const c = new THREE.Color(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.6 ? '#111' : '#fff';
}

const GEO = {};
function geo() {
  if (GEO.torso) return GEO;
  GEO.torso = new THREE.CylinderGeometry(0.22, 0.17, 0.6, 14); GEO.torso.scale(1, 1, 0.78); // busto piu' largo che profondo
  GEO.neck = new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8); GEO.shoulder = new THREE.SphereGeometry(0.08, 10, 8); GEO.cuff = new THREE.CylinderGeometry(0.062, 0.062, 0.05, 8); GEO.sockTop = new THREE.CylinderGeometry(0.076, 0.072, 0.07, 8);
  GEO.shorts = new THREE.CylinderGeometry(0.18, 0.2, 0.24, 12); GEO.shorts.scale(1, 1, 0.82);
  GEO.thigh = new THREE.CylinderGeometry(0.085, 0.075, 0.42, 6); GEO.thigh.translate(0, -0.21, 0);
  GEO.shin = new THREE.CylinderGeometry(0.07, 0.055, 0.5, 6); GEO.shin.translate(0, -0.25, 0);
  GEO.shoe = new THREE.BoxGeometry(0.24, 0.08, 0.11); GEO.shoe.translate(0.05, 0, 0);
  GEO.arm = new THREE.CylinderGeometry(0.055, 0.045, 0.55, 6); GEO.arm.translate(0, -0.27, 0);
  GEO.hand = new THREE.SphereGeometry(0.055, 6, 5);
  GEO.head = new THREE.SphereGeometry(0.125, 14, 10);
  GEO.hair = new THREE.SphereGeometry(0.132, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  GEO.num = new THREE.PlaneGeometry(0.34, 0.34);
  GEO.blob = new THREE.PlaneGeometry(1.1, 1.1);
  GEO.ring = new THREE.RingGeometry(0.62, 0.74, 28);
  return GEO;
}

/** Colore secondario della maglia: bordini, strisce e fasce (kit.trim, altrimenti una tinta piu' scura o chiara della maglia). */
function kitTrim(kit, gk) {
  const base = gk ? kit.gk : kit.shirt;
  if (!gk && kit.trim) return kit.trim;
  const c = new THREE.Color(base), l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return '#' + (l > 0.55 ? c.clone().multiplyScalar(0.62) : c.clone().lerp(new THREE.Color(0xffffff), 0.42)).getHexString();
}

const SHIRTS = new Map();
/** Texture della maglia sul busto: tinta unita, strisce verticali, righe orizzontali o fasce, con colletto e orlo (kit.pattern: plain | stripes | hoops | bands). Una per divisa. */
function shirtTexture(kit, gk) {
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
function nameTag(text) {
  if (TAGS.has(text)) return TAGS.get(text);
  const [c, g] = canvas(384, 72), r = 22;
  g.fillStyle = 'rgba(10,16,26,0.78)'; g.beginPath(); g.roundRect(4, 4, 376, 64, r); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#fff'; g.font = '600 34px system-ui, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 192, 38, 350);
  const t = tex(c); TAGS.set(text, t); return t;
}

/** Un giocatore low-poly: gambe, braccia, busto, testa; avanti = +x. */
function buildPlayer(kit, gk, num, id, blobMat) {
  const G = geo(), lam = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0 });
  const shirt = lam(gk ? kit.gk : kit.shirt), torsoMat = new THREE.MeshStandardMaterial({ map: shirtTexture(kit, gk), roughness: 0.8, metalness: 0 }), trim = lam(kitTrim(kit, gk)), shorts = lam(gk ? 0x1d1d1d : kit.shorts), socks = lam(gk ? kit.gk : kit.socks);
  const skin = lam(SKINS[(id * 7 + 3) % SKINS.length]), hair = lam(HAIRS[(id * 5 + 1) % HAIRS.length]), shoe = lam(0x111111), glove = lam(gk ? 0xf0f0f0 : SKINS[(id * 7 + 3) % SKINS.length]);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.92, side * 0.1);
    const thigh = new THREE.Mesh(G.thigh, shorts);
    const knee = new THREE.Group(); knee.position.y = -0.42;
    const shin = new THREE.Mesh(G.shin, socks), foot = new THREE.Mesh(G.shoe, shoe), band = new THREE.Mesh(G.sockTop, trim); foot.position.y = -0.5; band.position.y = -0.08;
    knee.add(shin, foot, band); hip.add(thigh, knee); body.add(hip); legs.push({ hip, knee });
    const sh = new THREE.Group(); sh.position.set(0, 1.47, side * 0.25);
    const arm = new THREE.Mesh(G.arm, shirt), hand = new THREE.Mesh(G.hand, glove); hand.position.y = -0.56;
    const sho = new THREE.Mesh(G.shoulder, shirt), cuff = new THREE.Mesh(G.cuff, trim); cuff.position.y = -0.5;
    sh.add(arm, hand, sho, cuff); body.add(sh); arms.push(sh);
  }
  const torso = new THREE.Mesh(G.torso, torsoMat); torso.position.y = 1.23; torso.rotation.y = Math.PI / 2; // la cucitura del disegno resta di lato
  const neck = new THREE.Mesh(G.neck, skin); neck.position.y = 1.56; body.add(neck);
  const pants = new THREE.Mesh(G.shorts, shorts); pants.position.y = 0.95;
  const head = new THREE.Mesh(G.head, skin); head.position.y = 1.7;
  const hr = new THREE.Mesh(G.hair, hair); hr.position.y = 1.72; hr.rotation.z = 0.25;
  const numCol = contrast(gk ? kit.gk : kit.shirt), back = new THREE.Mesh(G.num, new THREE.MeshBasicMaterial({ map: numberTexture(num, numCol, numCol === '#fff' ? '#000' : '#fff'), transparent: true }));
  back.position.set(-0.2, 1.27, 0); back.rotation.y = -Math.PI / 2;
  const front = back.clone(); front.scale.setScalar(0.45); front.position.set(0.2, 1.36, 0.07); front.rotation.y = Math.PI / 2;
  body.add(torso, pants, head, hr, back, front);
  const blob = new THREE.Mesh(G.blob, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; root.add(blob);
  root.userData = { blob, body, legs, arms, head, hr, neck, idleT: id * 1.3, look: 0, diveHigh: false, phase: (id * 1.7) % 6.28, heading: undefined, prevSp: 0, accLean: 0, feintT: 0, feintDir: 1, kickT: 0, kickLeft: false, kickPow: 0.5, kickLoft: false, headT: 0, headCd: 0, diveT: 0, diveCd: 0, diveDir: 1 };
  return root;
}

const TRAIL_T = 0.3;
/** Scia semitrasparente dietro la palla sui tiri forti: nastro rivolto verso la telecamera che svanisce con l'eta' dei campioni. */
class Trail {
  constructor(scene, n = 22) {
    this.n = n; this.pts = []; this.k = 0;
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 8);
    const g = this.g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 4)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.visible = false; scene.add(this.mesh);
  }
  update(b, cam, dt, clock) {
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    this.k += ((b.owner < 0 ? clamp((sp - 15) / 7, 0, 1) : 0) - this.k) * Math.min(1, dt * 12); // compare solo sui tiri di potenza: passaggi e conduzione restano puliti
    if (dt > 0) {
      const last = this.pts[this.pts.length - 1];
      if (last && Math.hypot(last.x - b.x, last.y - b.y, last.z - b.z) > 4) this.pts.length = 0; // ripartenza dal dischetto, replay: nessun nastro attraverso il campo
      this.pts.push({ x: b.x, y: Math.max(0.13, b.y + 0.02), z: b.z, t: clock });
      while (this.pts.length > this.n || (this.pts.length && clock - this.pts[0].t > TRAIL_T)) this.pts.shift();
    }
    const m = this.pts.length; this.mesh.visible = this.k > 0.02 && m > 1;
    if (!this.mesh.visible) return;
    for (let i = 0; i < m; i++) {
      const p = this.pts[i], a = this.pts[Math.max(0, i - 1)], c = this.pts[Math.min(m - 1, i + 1)], age = clamp((clock - p.t) / TRAIL_T, 0, 1);
      const tx = c.x - a.x, ty = c.y - a.y, tz = c.z - a.z, vx = cam.x - p.x, vy = cam.y - p.y, vz = cam.z - p.z;
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx; const l = Math.hypot(sx, sy, sz) || 1, w = (0.01 + 0.062 * (1 - age)) / l; sx *= w; sy *= w; sz *= w;
      const o = i * 6, q = i * 8, al = 0.6 * Math.pow(1 - age, 1.4) * this.k;
      this.pos.set([p.x + sx, p.y + sy, p.z + sz, p.x - sx, p.y - sy, p.z - sz], o); this.col.set([0.96, 0.98, 1, al, 0.96, 0.98, 1, al], q);
    }
    this.g.setDrawRange(0, (m - 1) * 6); this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true;
  }
}

const PART_VS = 'attribute float aSize; attribute vec4 aColor; uniform float uScale; varying vec4 vC;\nvoid main() { vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.1, -mv.z); }';
const PART_FS = 'varying vec4 vC;\nvoid main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.25, r) * vC.a; if (a < 0.01) discard; gl_FragColor = vec4(vC.rgb, a);\n#include <colorspace_fragment>\n}';
const _pc = new THREE.Color();
/** Particelle (polvere, zolle, rete): un solo Points con shader proprio, dimensione e trasparenza per particella; anello di riuso, nessuna allocazione per fotogramma. */
class Particles {
  constructor(scene, n = 260) {
    this.n = n; this.cur = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.size = new Float32Array(n); this.col = new Float32Array(n * 4);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n);
    const g = this.g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    this.uni = { uScale: { value: 600 } };
    this.pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false }));
    this.pts.frustumCulled = false; this.pts.renderOrder = 4; scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, { life = 0.6, size = 0.3, grow = 1, color = 0xffffff, alpha = 0.5, grav = 0, drag = 1.5 } = {}) {
    const i = this.cur; this.cur = (this.cur + 1) % this.n; _pc.set(color);
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.col.set([_pc.r, _pc.g, _pc.b, 0], i * 4);
    this.life[i] = this.max[i] = life; this.s0[i] = size; this.s1[i] = size * grow; this.a0[i] = alpha; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt, uScale) {
    this.uni.uScale.value = uScale;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt; const t = clamp(1 - this.life[i] / this.max[i], 0, 1), o = i * 3, dr = Math.exp(-this.drag[i] * dt);
      this.vel[o + 1] -= this.grav[i] * dt; this.vel[o] *= dr; this.vel[o + 2] *= dr;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      if (this.pos[o + 1] < 0.02 && this.grav[i] > 0) { this.pos[o + 1] = 0.02; this.vel[o + 1] = 0; this.vel[o] *= 0.4; this.vel[o + 2] *= 0.4; } // le zolle si fermano a terra
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t; this.col[i * 4 + 3] = this.a0[i] * Math.min(1, t * 10) * Math.pow(1 - t, 1.3);
    }
    for (const a of ['position', 'aSize', 'aColor']) this.g.attributes[a].needsUpdate = true;
  }
}

const TURF = [0x4c8a3a, 0x3a6b2c, 0x6b5233, 0x5a9a44];
const rnd = (a, b) => a + Math.random() * (b - a), _ax = new THREE.Vector3(), _iv = new THREE.Vector3(), _ip = new THREE.Vector3();
export class TVRenderer {
  /** kits: [{ shirt, shorts, socks, gk }] per squadra; nums: numero di maglia per id del giocatore. */
  constructor(canvas, pitch, { kits, nums, label } = {}) {
    this.canvas = canvas; this.P = pitch; this.kits = kits; this.nums = nums ?? []; this.label = label;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    ANISO = r.capabilities.getMaxAnisotropy();
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = this.scene = new THREE.Scene();
    scene.background = skyTexture(); scene.fog = new THREE.Fog(0xc9dcee, 120 + pitch.hx * 2, 320 + pitch.hx * 4);
    scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x40603a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff3dd, 1.1); sun.position.set(-30, 60, 25); scene.add(sun);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera; sc.left = -pitch.hx - 6; sc.right = pitch.hx + 6; sc.top = pitch.hz + 6; sc.bottom = -pitch.hz - 6; sc.near = 10; sc.far = 160;
    const relief = turfRelief(); relief.repeat.set(pitch.hx * 2 / 2.5, pitch.hz * 2 / 2.5); relief.wrapS = relief.wrapT = THREE.RepeatWrapping;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(pitch.hx * 2, pitch.hz * 2), new THREE.MeshStandardMaterial({ map: pitchTexture(pitch), roughness: 0.85, metalness: 0, roughnessMap: relief, bumpMap: relief, bumpScale: 1.4 }));
    pm.rotation.x = -Math.PI / 2; pm.receiveShadow = true; scene.add(pm);
    stadium(pitch, scene);
    this.goals = [goal(1, pitch), goal(-1, pitch)]; scene.add(...this.goals);
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 18), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45, metalness: 0 }));
    this.trail = new Trail(scene); this.fx = new Particles(scene); this.clock = 0; this.spin = new THREE.Vector3(); this.pb = null; this.cv = { x: 0 }; this.zoom = 0; // scia, particelle, rotolamento libero e inquadratura dinamica
    this.ballBlob = new THREE.Mesh(geo().blob, this.blobMat); this.ballBlob.rotation.x = -Math.PI / 2; this.ballBlob.position.y = 0.011;
    this.ball.castShadow = true; this.ballBlob.visible = false; // ombra vera dal sole
    scene.add(this.ball, this.ballBlob);
    this.marker = new THREE.Mesh(geo().ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.02; scene.add(this.marker);
    const tri = new THREE.Shape(); tri.moveTo(0.34, 0); tri.lineTo(-0.2, 0.3); tri.lineTo(-0.08, 0); tri.lineTo(-0.2, -0.3); tri.closePath(); // freccia di direzione: punta in avanti
    this.arrow = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.arrow.rotation.x = -Math.PI / 2; this.arrow.position.y = 0.025; scene.add(this.arrow);
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); this.tag.scale.set(3, 0.56, 1); this.tag.renderOrder = 10; this.tag.visible = false; scene.add(this.tag);
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
    this.mode = 'tv'; this.camPos = new THREE.Vector3(0, 30, 60); this.camLook = new THREE.Vector3(); this.snap = true; this.lastDir = 1; this.camDir = 1; this.dirT = 0; this.rdir = 1; this.rside = 1; // rdir: lato della porta in cui e' entrato il gol, rside: lato da cui la camera del replay guarda
    this.meshes = []; this.showMarker = true; this.w = 0; this.h = 0;
  }

  setCamera(mode) { if (mode !== this.mode) { this.mode = mode; this.blend = 0; } }

  resize() {
    const w = this.canvas.clientWidth | 0, h = this.canvas.clientHeight | 0;
    if (!w || !h || (w === this.w && h === this.h)) return;
    this.w = w; this.h = h; this.r.setSize(w, h, false); this.cam.aspect = w / h;
  }

  build(players) {
    for (const m of this.meshes) this.scene.remove(m);
    this.meshes = players.map(p => { const m = buildPlayer(this.kits[p.team], p.gk, this.nums[p.id] ?? p.id + 1, p.id, this.blobMat); m.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } }); m.userData.blob.visible = false; this.scene.add(m); return m; });
  }

  /** Animazione procedurale (nessun dato di terzi): andatura camminata/corsa/scatto, conduzione, finta, tiro, colpo di testa, rimessa. */
  animate(m, p, dt, ctx = {}) {
    const u = m.userData, sp = Math.hypot(p.vx, p.vz), b = u.body;
    const gait = clamp((sp - 2) / 5.5, 0, 1), dribbling = !!ctx.owns && sp > 1; // 0 = cammina, 1 = scatto
    const heading = sp > 1.5 ? Math.atan2(p.vz, p.vx) : u.heading;
    if (u.heading !== undefined && sp > 2.5 && dt > 0) { // cambio di direzione secco con la palla: finta
      const da = Math.atan2(Math.sin(heading - u.heading), Math.cos(heading - u.heading));
      if (ctx.owns && Math.abs(da) / dt > 3.2 && u.feintT <= 0) { u.feintT = 0.5; u.feintDir = Math.sign(da) || 1; }
    }
    if (p.dribT > 0.45 && u.feintT <= 0) { u.feintT = 0.5; u.feintDir = p.dribDir || 1; } // finta decisa dalla simulazione
    u.heading = heading;
    const acc = dt > 0 ? (sp - u.prevSp) / dt : 0; u.prevSp = sp;
    u.accLean += (clamp(acc, -6, 8) * 0.018 - u.accLean) * Math.min(1, dt * 6);
    u.feintT = Math.max(0, u.feintT - dt); u.kickT = Math.max(0, u.kickT - dt); u.headT = Math.max(0, u.headT - dt);
    const cadence = (0.7 + sp * 0.33) * (dribbling ? 1.2 : 1);
    u.phase += dt * Math.PI * 2 * cadence;
    const s = Math.sin(u.phase), c = Math.cos(u.phase), sw = (0.22 + sp * 0.1) * (dribbling ? 0.75 : 1), bend = sw * (0.5 + gait * 1.4);
    const [l0, l1] = u.legs, [a0, a1] = u.arms;
    l0.hip.rotation.z = s * sw; l1.hip.rotation.z = -s * sw;
    l0.knee.rotation.z = -Math.max(0, c) * bend; l1.knee.rotation.z = -Math.max(0, -c) * bend; // il ginocchio si piega nella fase di recupero
    a0.rotation.z = -s * sw * (0.7 + gait * 0.5); a1.rotation.z = s * sw * (0.7 + gait * 0.5);
    a0.rotation.x = a1.rotation.x = 0; l0.hip.rotation.x = l1.hip.rotation.x = 0;
    b.rotation.x = 0; b.rotation.y = s * 0.05 + s * gait * 0.14; // torsione del busto: piu' marcata a pieno ritmo
    let lean = -(gait * 0.3 + (dribbling ? 0.05 : 0) + u.accLean), drop = Math.abs(s) * (0.02 + gait * 0.09);
    u.idleT += dt;
    if (sp < 0.3) { // fermo: respiro, peso che passa da una gamba all'altra, braccia che dondolano appena
      const ib = Math.sin(u.idleT * 1.7), is = Math.sin(u.idleT * 0.55);
      l0.hip.rotation.z = is * 0.035; l1.hip.rotation.z = -is * 0.03; l0.knee.rotation.z = -0.03 - Math.max(0, is) * 0.05; l1.knee.rotation.z = -0.03 - Math.max(0, -is) * 0.05;
      a0.rotation.z *= 0.2; a1.rotation.z *= 0.2; a0.rotation.z += 0.05 + ib * 0.03; a1.rotation.z += 0.05 - ib * 0.03;
      b.rotation.y = is * 0.05; lean = is * 0.012; drop = ib * 0.006 - 0.004;
    }
    if (dribbling) { const k = Math.max(0, c); l1.hip.rotation.z += k * 0.35; l1.knee.rotation.z *= 0.5; a0.rotation.x = -0.3; a1.rotation.x = 0.3; } // tocchi corti: il piede accompagna la palla
    if (u.feintT > 0) { // finta con passo sopra la palla e peso sul lato opposto
      const q = 1 - u.feintT / 0.5, w = Math.sin(Math.PI * q), d = u.feintDir, over = d > 0 ? l0 : l1;
      b.rotation.x = d * 0.4 * w; b.rotation.y += d * 0.35 * w; drop += 0.07 * w; lean = lean * 0.5 - 0.1 * w;
      over.hip.rotation.z = 0.95 * w; over.knee.rotation.z = -0.6 * w; over.hip.rotation.x = d * 0.55 * Math.sin(Math.PI * q);
    }
    if (u.kickT > 0) { // tiro o passaggio: rincorsa all'indietro, impatto, accompagnamento
      const q = 1 - u.kickT / 0.3, kl = u.kickLeft ? l0 : l1, pl = u.kickLeft ? l1 : l0, pw = u.kickPow;
      const f = q < 0.4 ? -0.9 * (q / 0.4) : q < 0.65 ? -0.9 + (1.2 + 1.1 * pw) * ((q - 0.4) / 0.25) : 0.3 + 1.1 * pw - 0.5 * ((q - 0.65) / 0.35);
      kl.hip.rotation.z = f; kl.knee.rotation.z = -(q < 0.4 ? 1.3 * (q / 0.4) : q < 0.65 ? 1.3 * (1 - (q - 0.4) / 0.25) : 0.1);
      pl.hip.rotation.z *= 0.3; pl.knee.rotation.z = -0.25;
      a0.rotation.z = u.kickLeft ? 0.7 : -0.7; a1.rotation.z = u.kickLeft ? -0.7 : 0.7; a0.rotation.x = a1.rotation.x = 0;
      lean += u.kickLoft ? 0.25 * Math.sin(Math.PI * q) : -0.12 * Math.sin(Math.PI * q); b.rotation.y = (u.kickLeft ? -1 : 1) * 0.3 * Math.sin(Math.PI * q);
    }
    if (u.headT > 0) { // colpo di testa: stacco, busto indietro poi in avanti
      const q = 1 - u.headT / 0.45; drop = -0.42 * Math.sin(Math.PI * q); lean = q < 0.45 ? 0.35 * (q / 0.45) : 0.35 - 0.7 * ((q - 0.45) / 0.55);
      a0.rotation.z = a1.rotation.z = 1.2 * Math.sin(Math.PI * q); l0.hip.rotation.z = 0.5; l1.hip.rotation.z = -0.3; l1.knee.rotation.z = -0.9; l0.knee.rotation.z = -0.3;
    }
    if (p.throwT > 5) { // rimessa: si china a prendere la palla, la solleva sopra la testa
      const t = p.pickT ?? 0, down = clamp((t - 0.6) / 0.3, 0, 1) * (1 - clamp((t - 0.9) / 0.5, 0, 1)), lift = clamp((t - 0.9) / 0.5, 0, 1);
      if (t >= 0.6) {
        for (const l of u.legs) { l.hip.rotation.z = 1.0 * down; l.knee.rotation.z = -1.7 * down; }
        a0.rotation.z = a1.rotation.z = 0.6 * down + (2.9 - 0.6) * lift * (down > 0 || lift > 0 ? 1 : 0); drop = -0.45 * down; lean = -0.9 * down + 0.3 * lift; b.rotation.y = 0;
      }
    } else if (p.throwT > 0 && p.throwT <= 0.5) { // lancio: braccia dal sopra la testa in avanti
      const q = 1 - p.throwT / 0.5; a0.rotation.z = a1.rotation.z = 2.9 - 2.4 * q; lean = -0.35 * Math.sin(Math.PI * Math.min(1, q * 1.4)); l0.hip.rotation.z = 0.35; l1.hip.rotation.z = -0.3; l0.knee.rotation.z = l1.knee.rotation.z = 0;
    }
    if (p.gk) { // portiere: posizione di attesa con braccia aperte, presa a petto, tuffo
      u.diveT = Math.max(0, u.diveT - dt);
      if (u.diveT > 0) {
        const q = 1 - u.diveT / 0.8, f = q < 0.2 ? q / 0.2 : q < 0.7 ? 1 : (1 - q) / 0.3, d = u.diveDir;
        const hi = u.diveHigh; // palla alta: stacco verticale con braccia in alto; palla bassa: tuffo disteso a terra
        b.rotation.x = d * (hi ? 0.8 : 1.35) * f; b.position.z = d * (hi ? 0.7 : 1.1) * f; drop = (hi ? 0.62 : 0.45) * Math.sin(Math.PI * Math.min(1, q * 1.4)); lean = hi ? 0.2 : 0.1;
        a0.rotation.x = a1.rotation.x = Math.PI * 0.95 * f; a0.rotation.z = a1.rotation.z = 0; l0.hip.rotation.z = 0.3; l1.hip.rotation.z = -0.3; l0.knee.rotation.z = l1.knee.rotation.z = -0.4;
      } else {
        b.position.z = 0;
        if (ctx.owns) { a0.rotation.z = a1.rotation.z = 1.5; a0.rotation.x = -0.45; a1.rotation.x = 0.45; lean = -0.12; } // palla tenuta al petto
        else if (ctx.rush) { lean = -0.34; drop = Math.min(drop, 0) - 0.12; a0.rotation.x = 0.65; a1.rotation.x = -0.65; a0.rotation.z = a1.rotation.z = 0.55; for (const l of u.legs) l.knee.rotation.z -= 0.35; } // uscita bassa: busto in avanti, braccia larghe e basse davanti al corpo
        else if (sp < 3 && !ctx.alert) { a0.rotation.x = 0.12; a1.rotation.x = -0.12; a0.rotation.z = a1.rotation.z = 0.08; lean = -0.04; drop = Math.min(drop, 0); } // palla lontana: braccia lungo i fianchi
        else if (sp < 3) { const n = ctx.near ?? 0.5; a0.rotation.x = 0.35 + 0.8 * n; a1.rotation.x = -(0.35 + 0.8 * n); a0.rotation.z = a1.rotation.z = 0.25 + 0.2 * n; lean = -0.1 - 0.12 * n; drop = Math.min(drop, 0) - 0.04 - 0.1 * n + Math.sin(u.phase * 0.7) * 0.01; for (const l of u.legs) { l.hip.rotation.z = 0.2 + 0.25 * n; l.knee.rotation.z = -(0.35 + 0.5 * n); } } // attesa: piu' la palla e' vicina, piu' si abbassa e allarga le braccia
      }
    }
    if (p.tackleT > 0) { b.rotation.z = -1.15; b.position.y = -0.35; b.rotation.x = 0; } // scivolata
    else { b.rotation.z += (lean - b.rotation.z) * Math.min(1, dt * 14); b.position.y = drop; }
    u.look += ((p.tackleT > 0 || u.diveT > 0 ? 0 : ctx.look ?? 0) - u.look) * Math.min(1, dt * 6); // la testa si stabilizza contro rollio e rimbalzo del busto e segue la palla
    const hy = -b.position.y * 0.5, hp = -b.rotation.z * 0.55;
    u.head.position.y = 1.7 + hy; u.hr.position.y = 1.72 + hy; u.neck.position.y = 1.56 + hy * 0.5;
    u.head.rotation.set(0, u.look, hp); u.hr.rotation.set(0, u.look, 0.25 + hp);
    if (p.stun > 0) b.rotation.x = Math.sin(u.phase * 2) * 0.15;
  }

  updateCamera(v, dt) {
    const P = this.P, b = v.ball, aspect = this.cam.aspect, owner = b.owner >= 0 ? v.players[b.owner] : null;
    if (owner) this.lastDir = owner.team === 0 ? 1 : -1;
    const dg = P.hx - Math.abs(b.x), zt = clamp((P.areaDepth + 3 - dg) / (P.areaDepth + 1), 0, 1); // distanza dalla linea di porta: zoom pieno a 2 m, nullo oltre area + 3 m
    this.zoom = this.snap ? zt : this.zoom + (zt - this.zoom) * Math.min(1, dt * 1.6); this.cv.x += (b.vx - this.cv.x) * Math.min(1, dt * 1.5);
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    let fov = clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(64) / 2) / aspect) * 180 / Math.PI, 28, 78);
    if (this.snap) this.camDir = this.lastDir; // direzione d'attacco della camera di fondo: cambia solo se il possesso resta dall'altra parte per un po'
    else if (this.lastDir !== this.camDir) { if ((this.dirT += dt) > 1.4) { this.camDir = this.lastDir; this.dirT = 0; } } else this.dirT = 0;
    if (this.mode === 'tattica') { // drone: vista alta inclinata sull'intero campo; in verticale la lunghezza del campo sale lungo lo schermo
      const port = aspect < 0.9, el = THREE.MathUtils.degToRad(58), t = Math.tan(THREE.MathUtils.degToRad(fov = port ? 55 : 38) / 2);
      const W = (port ? P.hz : P.hx) + 3, H = ((port ? P.hx : P.hz) + 3) * Math.sin(el) + 1, D = Math.max(W / (t * aspect), H / t) * 1.03, cx = port ? 0 : clamp(b.x * 0.12, -3, 3);
      look.set(cx, 0, 0); pos.set(cx - (port ? D * Math.cos(el) : 0), D * Math.sin(el), port ? 0 : D * Math.cos(el));
    } else if (this.mode === 'fondo') { // asse lungo del campo, dietro la porta di chi attacca: tutta l'azione verso la porta avversaria (rigori, punizioni)
      const d = this.camDir, u = clamp(b.x, -P.hx, P.hx) * d, pu = Math.max(0.5 * u - (0.9 * P.hx + 10), -(P.hx + 4.5)), lu = clamp(u * 0.7 + 8, -P.hx * 0.6, P.hx);
      fov = aspect < 0.9 ? 66 : 36; pos.set(d * pu, 10.5, b.z * 0.35); look.set(d * lu, 0.4, b.z * 0.55);
    } else if (this.mode === 'replay') { // replay: angolo inverso dietro la linea di porta, basso, con zoom da teleobiettivo sulla palla (la rete resta di lato, non davanti)
      const sx = this.rdir, bx = clamp(b.x, -P.hx, P.hx);
      pos.set(sx * (P.hx + 3.6), 2, this.rside * 7); look.set(bx * 0.9 + sx * P.hx * 0.1, Math.max(0.5, b.y * 0.8), b.z * 0.8);
      fov = clamp(2 * Math.atan(4.5 / Math.max(5, pos.distanceTo(look))) * 180 / Math.PI, 12, 50) * (aspect < 1 ? 1.5 : 1);
    } else {
      const port = aspect < 0.9; // telefono in verticale: inquadratura piu' dall'alto, cosi' il campo riempie lo schermo invece delle tribune
      const ze = this.zoom * this.zoom * (3 - 2 * this.zoom), lead = clamp(this.cv.x * 0.45, -5, 5); // ze: 0 a centrocampo, 1 sulla linea di porta
      const dist = Math.max(port ? 16 : 22, P.hz * (port ? 1.5 : 2.1)) * (1 - 0.14 * ze), hgt = Math.max(12, P.hz * (port ? 2 : 1.15)) * (1 - 0.12 * ze), k = P.hx * (port ? 0.1 : 0.22) * (1 - 0.4 * ze); // piu' vicina e piu' bassa verso la porta
      fov = clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50) / 2) / aspect) * 180 / Math.PI, 24, 64) * (1 - 0.24 * ze); // zoom negli ultimi metri dell'area
      pos.set(clamp(b.x + lead * 0.4, -P.hx + k, P.hx - k), hgt, b.z * 0.3 + dist); look.set(pos.x + lead * 0.3, 0, b.z * 0.45 - 1); // anticipa leggermente la direzione del gioco
    }
    const k = this.snap ? 1 : 1 - Math.exp(-(this.blend < 1 ? 2.2 : 3.2) * dt);
    this.blend = Math.min(1, (this.blend ?? 1) + dt * 1.2); this.snap = false;
    const kt = this.mode === 'replay' ? Math.max(k, 1 - Math.exp(-12 * dt)) : k; // il replay insegue la palla da vicino: niente ritardo con fov stretto
    this.camPos.lerp(pos, k); this.camLook.lerp(look, kt);
    this.cam.fov += (fov - this.cam.fov) * kt; this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.camPos); this.cam.lookAt(this.camLook);
  }

  /** Sbuffo di polvere e zolle: rimbalzo della palla (power 0..1). */
  puff(x, z, power) {
    const n = 3 + Math.round(power * 5);
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(0.5, 1.4 + 2 * power); this.fx.emit(x + rnd(-0.1, 0.1), 0.06, z + rnd(-0.1, 0.1), Math.cos(a) * s, rnd(0.3, 0.9 + power), Math.sin(a) * s, { life: rnd(0.5, 0.9), size: rnd(0.22, 0.34), grow: 2.8, color: 0xd9d4b8, alpha: 0.4 }); }
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(0.4, 1.4); this.fx.emit(x, 0.08, z, Math.cos(a) * s, rnd(1.2, 2.6 + 3 * power), Math.sin(a) * s, { life: rnd(0.45, 0.75), size: rnd(0.07, 0.11), color: TURF[i % 4], alpha: 0.95, grav: 14, drag: 0.3 }); }
  }

  /** Palla in rete: scintille bianche e una nuvola leggera che segue la direzione del tiro. */
  netBurst(b) {
    const k = 0.12, e = Math.sign(b.x);
    for (let i = 0; i < 16; i++) this.fx.emit(b.x, Math.max(0.15, b.y), b.z, b.vx * k + rnd(-1.2, 1.2), rnd(-0.2, 1.6), b.vz * k + rnd(-1.2, 1.2), { life: rnd(0.6, 1.1), size: rnd(0.11, 0.18), color: 0xffffff, alpha: 0.9, grav: 1.6, drag: 1.2 });
    for (let i = 0; i < 5; i++) this.fx.emit(b.x + e * 0.3, Math.max(0.3, b.y), b.z, b.vx * 0.05 + rnd(-0.5, 0.5), rnd(0, 0.6), rnd(-0.6, 0.6), { life: rnd(0.7, 1.1), size: 0.5, grow: 2.2, color: 0xeef2f6, alpha: 0.26, drag: 2 });
  }

  /** Effetti legati agli eventi di gioco: rimbalzi, tiri forti, gol, scivolate. dt = 0 (pausa) non emette nulla. */
  fxStep(v, dt) {
    const b = v.ball, pb = this.pb, P = this.P;
    if (dt > 0 && pb && Math.hypot(pb.x - b.x, pb.z - b.z) < 3) {
      if (pb.vy < -2.5 && b.vy >= 0 && b.y < 0.4) this.puff(b.x, b.z, Math.min(1, -pb.vy / 9));
      if (Math.abs(pb.x) <= P.hx && Math.abs(b.x) > P.hx && Math.abs(b.z) < P.goalHalf + 0.3 && b.y < P.goalH + 0.3 && Math.hypot(b.vx, b.vz) > 4) this.netBurst(b);
      if (Math.abs(b.x) > P.hx && Math.abs(b.x) < P.hx + 2.6 && Math.abs(b.z) <= P.goalHalf + 0.05 && b.y <= P.goalH + 0.1) { // palla dentro la porta: ogni inversione di velocita' e' un urto contro un pannello della rete
        for (const [k, ax] of [['vx', 0], ['vy', 1], ['vz', 2]]) {
          if (Math.abs(pb[k]) < 2.5 || pb[k] * b[k] >= 0 || (k === 'vy' && pb.vy < 0)) continue; // il rimbalzo a terra non tocca la rete
          _iv.set(0, 0, 0).setComponent(ax, pb[k]); _ip.set(b.x, b.y, b.z);
          for (const n of this.goals[b.x > 0 ? 0 : 1].userData.nets) n.hit(_ip, _iv);
        }
      }
      if (pb.owner >= 0 && b.owner < 0 && Math.hypot(b.vx, b.vz) > 12) { // tiro forte: zolle sollevate dal piede
        const s = Math.hypot(b.vx, b.vz);
        for (let i = 0; i < 6; i++) this.fx.emit(b.x, 0.08, b.z, b.vx / s * rnd(-0.6, 0.4) + rnd(-1, 1), rnd(1.5, 3.5), b.vz / s * rnd(-0.6, 0.4) + rnd(-1, 1), { life: rnd(0.45, 0.7), size: rnd(0.07, 0.11), color: TURF[i % 4], alpha: 0.95, grav: 14, drag: 0.3 });
      }
    }
    if (dt > 0) for (const p of v.players) if (p.tackleT > 0 && !p.out && Math.random() < dt * 40) { // scivolata: polvere dietro il giocatore
      const s = Math.hypot(p.vx, p.vz) || 1;
      this.fx.emit(p.x + rnd(-0.2, 0.2), 0.08, p.z + rnd(-0.2, 0.2), -p.vx / s * rnd(0.3, 1) + rnd(-0.4, 0.4), rnd(0.3, 0.9), -p.vz / s * rnd(0.3, 1) + rnd(-0.4, 0.4), { life: rnd(0.5, 0.8), size: 0.28, grow: 2.8, color: 0xd9d4b8, alpha: 0.36 });
    }
    this.pb = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, owner: b.owner };
  }

  /** v: { players, ball } (la simulazione stessa o un fotogramma di replay). */
  draw(v, dt) {
    this.resize();
    if (this.meshes.length !== v.players.length) this.build(v.players);
    const bo = v.ball.owner, from = this.prevOwner;
    if (from >= 0 && bo < 0 && v.players[from] && !(v.players[from].throwT > 0)) { // palla appena lasciata dal giocatore: tiro o passaggio
      const sp = Math.hypot(v.ball.vx, v.ball.vz), u = this.meshes[from]?.userData;
      if (u && sp > 3) { u.kickT = 0.3; u.kickLeft = (from + Math.round(sp)) % 3 === 0; u.kickPow = clamp(sp / 22, 0.2, 1); u.kickLoft = v.ball.vy > 2; }
    }
    this.prevOwner = bo;
    v.players.forEach((p, i) => {
      const m = this.meshes[i]; m.visible = !p.out;
      if (p.out) return;
      const u = m.userData; u.headCd = Math.max(0, u.headCd - dt); u.diveCd = Math.max(0, u.diveCd - dt);
      if (p.gk && u.diveT <= 0 && u.diveCd === 0 && v.ball.owner < 0) { // tiro verso il portiere: tuffo dal lato dove passa la palla
        const bx = v.ball.x - p.x, bz = v.ball.z - p.z, sp2 = v.ball.vx ** 2 + v.ball.vz ** 2;
        if (sp2 > 81 && Math.hypot(bx, bz) < 9 && v.ball.y < 2.2 && bx * v.ball.vx + bz * v.ball.vz < 0) {
          const t = -(bx * v.ball.vx + bz * v.ball.vz) / sp2, l = (bx + v.ball.vx * t) * -Math.sin(p.face) + (bz + v.ball.vz * t) * Math.cos(p.face);
          if (Math.abs(l) > 0.5) { u.diveT = 0.8; u.diveDir = Math.sign(l); u.diveHigh = v.ball.y + v.ball.vy * t - 4.9 * t * t > 1.25; } u.diveCd = 2;
        }
      }
      if (!p.gk && u.headCd === 0 && v.ball.owner < 0 && v.ball.y > 1.1 && Math.hypot(v.ball.x - p.x, v.ball.z - p.z) < 0.8) { u.headT = 0.45; u.headCd = 1.5; } // palla alta addosso: colpo di testa
      const bx = v.ball.x - p.x, bz = v.ball.z - p.z, bd = Math.hypot(bx, bz), opp = v.ball.owner < 0 || v.players[v.ball.owner]?.team !== p.team;
      let look = 0; if (bd > 1.2 && bd < 45) { const rel = Math.atan2(bz, bx) - p.face; look = -clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -0.9, 0.9); } // testa verso la palla (rotazione locale opposta all'angolo nel mondo)
      m.position.set(p.x, 0, p.z); m.rotation.y = -p.face;
      this.animate(m, p, dt, { owns: v.ball.owner === p.id, alert: p.gk && bd < 30 && opp, near: clamp((24 - bd) / 18, 0, 1), rush: p.gk && bd < 9 && v.ball.owner < 0 && Math.hypot(p.vx, p.vz) > 3.5, look });
    });
    const b = v.ball, sp = Math.hypot(b.vx, b.vz);
    this.ball.position.set(b.x, Math.max(0.13, b.y + 0.02), b.z);
    const roll = this.spin; // velocita' angolare (rad/s): a terra rotola senza slittare, in volo gira ancora e rallenta
    if (b.y < 0.06 || b.owner >= 0) roll.set(b.vz, 0, -b.vx).multiplyScalar(1 / 0.13);
    else { roll.multiplyScalar(Math.exp(-0.35 * dt)); if (roll.lengthSq() < 36 && sp > 3) roll.set(b.vz, 0, -b.vx).multiplyScalar(0.5 / 0.13); }
    const w = roll.length(); if (w > 45) roll.multiplyScalar(45 / w); // oltre ~7 giri/s a 60 Hz l'occhio vede girare al contrario
    if (dt > 0 && w > 0.01) this.ball.rotateOnWorldAxis(_ax.copy(roll).normalize(), Math.min(w, 45) * dt);
    this.clock += dt; this.fxStep(v, dt);
    for (const g of this.goals) for (const n of g.userData.nets) n.update(dt);
    this.ballBlob.position.set(b.x + b.y * 0.25, 0.011, b.z - b.y * 0.15); this.ballBlob.scale.setScalar(clamp(0.45 - b.y * 0.05, 0.15, 0.45));
    const owner = b.owner >= 0 ? v.players[b.owner] : null;
    this.marker.visible = this.showMarker && !!owner && !owner.out;
    if (owner) {
      this.marker.position.set(owner.x, 0.02, owner.z);
      this.arrow.visible = this.marker.visible; this.arrow.position.set(owner.x + Math.cos(owner.face) * 1.1, 0.025, owner.z + Math.sin(owner.face) * 1.1); this.arrow.rotation.z = -owner.face + 0; // l'asse x locale della freccia va in avanti
      const txt = this.label?.(owner.id);
      this.tag.visible = !!txt && this.marker.visible; if (txt) { this.tag.material.map = nameTag(txt); this.tag.material.needsUpdate = true; this.tag.position.set(owner.x, 2.5, owner.z); }
    } else { this.arrow.visible = false; this.tag.visible = false; }
    this.updateCamera(v, dt);
    this.trail.update(b, this.cam.position, dt, this.clock); this.fx.update(dt, this.r.domElement.height * 0.5 * this.cam.projectionMatrix.elements[5]);
    this.r.render(this.scene, this.cam);
  }

  dispose() { this.r.dispose(); }
}
