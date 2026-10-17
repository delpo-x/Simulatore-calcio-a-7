// Grafica 3D low-poly in stile televisivo per l'app: stadio, giocatori animati con maglia e numero, palla, quattro telecamere.
// Legge solo lo stato della simulazione (o di un replay) e non lo modifica.
import * as THREE from '../vendor/three.module.min.js';
import { RULES } from '../core/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKINS = [0xf1c7a1, 0xe0ac7e, 0xc68a5c, 0x8d5a3b, 0x6b4129];
const HAIRS = [0x2b1d14, 0x4a2f1b, 0x111111, 0x8a6236, 0xc9a35f];

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat } = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** Campo: strisce di taglio, linee, aree, area piccola, dischetto, archi d'angolo. */
function pitchTexture(P) {
  const s = 20, W = Math.round(P.hx * 2 * s), H = Math.round(P.hz * 2 * s), cx = W / 2, cz = H / 2;
  const [c, g] = canvas(W, H), n = Math.max(8, Math.round(P.hx * 2 / 5));
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#3d9c46' : '#36903e'; g.fillRect(i * W / n, 0, W / n + 1, H); }
  for (let i = 0; i < W * H / 220; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,40,0'},0.035)`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = '#fff'; g.lineWidth = 0.12 * s;
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

function netTexture() {
  const [c, g] = canvas(64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.moveTo(0, 0); g.lineTo(0, 64); g.stroke();
  return tex(c);
}

function goal(dir, P) {
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff }), grp = new THREE.Group(), D = Math.min(1.8, P.goalH * 0.75);
  const cyl = (len, x, y, z, axis) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 10), white);
    if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z); grp.add(m);
  };
  const w = P.goalHalf * 2, h = P.goalH;
  cyl(h, 0, h / 2, -P.goalHalf); cyl(h, 0, h / 2, P.goalHalf); cyl(w, 0, h, 0, 'z');
  cyl(D, dir * D / 2, h, -P.goalHalf, 'x'); cyl(D, dir * D / 2, h, P.goalHalf, 'x'); cyl(w, dir * D, 0.03, 0, 'z');
  const net = (wd, ht, rep) => { const t = netTexture(); t.repeat.set(...rep); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false })); };
  const back = net(w, h, [w * 6, h * 6]); back.rotation.y = Math.PI / 2; back.position.set(dir * D, h / 2, 0); grp.add(back);
  const top = net(D, w, [D * 6, w * 6]); top.rotation.x = -Math.PI / 2; top.position.set(dir * D / 2, h, 0); grp.add(top);
  for (const e of [-1, 1]) { const side = net(D, h, [D * 6, h * 6]); side.position.set(dir * D / 2, h / 2, e * P.goalHalf); grp.add(side); }
  grp.position.x = dir * P.hx;
  return grp;
}

/** Cartelloni pubblicitari: testo generico ripetuto. */
function boardTexture(len) {
  const [c, g] = canvas(1024, 64), cols = ['#0d3b66', '#c1121f', '#1b998b', '#f4a261'];
  for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect(i * 256, 0, 256, 64); g.fillStyle = '#fff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['CALCIO A 7', 'SIMULATORE', 'FAIR PLAY', 'IA vs IA'][i], i * 256 + 128, 34); }
  return tex(c, { repeat: [Math.max(1, len / 24), 1] });
}

/** Pubblico: puntini colorati su gradinate scure. */
function crowdTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#2a2f36'; g.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 16; row++) {
    g.fillStyle = row % 2 ? '#353b43' : '#30363d'; g.fillRect(0, row * 16 + 12, 512, 4);
    for (let x = 0; x < 512; x += 8) {
      if (Math.random() < 0.18) continue;
      g.fillStyle = `hsl(${Math.random() * 360},${30 + Math.random() * 50}%,${35 + Math.random() * 40}%)`;
      g.fillRect(x + Math.random() * 2, row * 16 + 3 + Math.random() * 2, 5, 9);
    }
  }
  return tex(c, { repeat: [6, 1] });
}

function stadium(P, scene) {
  const W = P.hx * 2, Hz = P.hz * 2, m = Math.max(4, P.hz * 0.25);
  const run = new THREE.Mesh(new THREE.PlaneGeometry(W + m * 2 + 4, Hz + m * 2 + 4), new THREE.MeshLambertMaterial({ color: 0x2e7f36 }));
  run.rotation.x = -Math.PI / 2; run.position.y = -0.01; scene.add(run);
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

function ballTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#1b1b1b';
  for (let i = 0; i < 12; i++) { const x = (i % 6) * 43 + (i > 5 ? 21 : 0), y = i > 5 ? 90 : 38; g.beginPath();
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 12, y + Math.sin(a) * 12); } g.fill(); }
  return tex(c);
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
  GEO.torso = new THREE.CylinderGeometry(0.21, 0.17, 0.6, 7);
  GEO.shorts = new THREE.CylinderGeometry(0.18, 0.2, 0.24, 7);
  GEO.thigh = new THREE.CylinderGeometry(0.085, 0.075, 0.42, 6); GEO.thigh.translate(0, -0.21, 0);
  GEO.shin = new THREE.CylinderGeometry(0.07, 0.055, 0.5, 6); GEO.shin.translate(0, -0.25, 0);
  GEO.shoe = new THREE.BoxGeometry(0.24, 0.08, 0.11); GEO.shoe.translate(0.05, 0, 0);
  GEO.arm = new THREE.CylinderGeometry(0.055, 0.045, 0.55, 6); GEO.arm.translate(0, -0.27, 0);
  GEO.hand = new THREE.SphereGeometry(0.055, 6, 5);
  GEO.head = new THREE.SphereGeometry(0.13, 10, 8);
  GEO.hair = new THREE.SphereGeometry(0.137, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  GEO.num = new THREE.PlaneGeometry(0.34, 0.34);
  GEO.blob = new THREE.PlaneGeometry(1.1, 1.1);
  GEO.ring = new THREE.RingGeometry(0.62, 0.74, 28);
  return GEO;
}

/** Un giocatore low-poly: gambe, braccia, busto, testa; avanti = +x. */
function buildPlayer(kit, gk, num, id, blobMat) {
  const G = geo(), lam = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const shirt = lam(gk ? kit.gk : kit.shirt), shorts = lam(gk ? 0x1d1d1d : kit.shorts), socks = lam(gk ? kit.gk : kit.socks);
  const skin = lam(SKINS[(id * 7 + 3) % SKINS.length]), hair = lam(HAIRS[(id * 5 + 1) % HAIRS.length]), shoe = lam(0x111111), glove = lam(gk ? 0xf0f0f0 : SKINS[(id * 7 + 3) % SKINS.length]);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.92, side * 0.1);
    const thigh = new THREE.Mesh(G.thigh, shorts);
    const knee = new THREE.Group(); knee.position.y = -0.42;
    const shin = new THREE.Mesh(G.shin, socks), foot = new THREE.Mesh(G.shoe, shoe); foot.position.y = -0.5;
    knee.add(shin, foot); hip.add(thigh, knee); body.add(hip); legs.push({ hip, knee });
    const sh = new THREE.Group(); sh.position.set(0, 1.47, side * 0.25);
    const arm = new THREE.Mesh(G.arm, shirt), hand = new THREE.Mesh(G.hand, glove); hand.position.y = -0.56;
    sh.add(arm, hand); body.add(sh); arms.push(sh);
  }
  const torso = new THREE.Mesh(G.torso, shirt); torso.position.y = 1.23;
  const pants = new THREE.Mesh(G.shorts, shorts); pants.position.y = 0.95;
  const head = new THREE.Mesh(G.head, skin); head.position.y = 1.7;
  const hr = new THREE.Mesh(G.hair, hair); hr.position.y = 1.72; hr.rotation.z = 0.25;
  const numCol = contrast(gk ? kit.gk : kit.shirt), back = new THREE.Mesh(G.num, new THREE.MeshBasicMaterial({ map: numberTexture(num, numCol, numCol === '#fff' ? '#000' : '#fff'), transparent: true }));
  back.position.set(-0.2, 1.27, 0); back.rotation.y = -Math.PI / 2;
  const front = back.clone(); front.scale.setScalar(0.45); front.position.set(0.2, 1.36, 0.07); front.rotation.y = Math.PI / 2;
  body.add(torso, pants, head, hr, back, front);
  const blob = new THREE.Mesh(G.blob, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; root.add(blob);
  root.userData = { body, legs, arms, phase: (id * 1.7) % 6.28 };
  return root;
}

export class TVRenderer {
  /** kits: [{ shirt, shorts, socks, gk }] per squadra; nums: numero di maglia per id del giocatore. */
  constructor(canvas, pitch, { kits, nums } = {}) {
    this.canvas = canvas; this.P = pitch; this.kits = kits; this.nums = nums ?? [];
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = this.scene = new THREE.Scene();
    scene.background = skyTexture(); scene.fog = new THREE.Fog(0xc9dcee, 120 + pitch.hx * 2, 320 + pitch.hx * 4);
    scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x40603a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff3dd, 1.5); sun.position.set(-30, 60, 25); scene.add(sun);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(pitch.hx * 2, pitch.hz * 2), new THREE.MeshLambertMaterial({ map: pitchTexture(pitch) }));
    pm.rotation.x = -Math.PI / 2; scene.add(pm);
    stadium(pitch, scene);
    scene.add(goal(1, pitch), goal(-1, pitch));
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), new THREE.MeshLambertMaterial({ map: ballTexture() }));
    this.ballBlob = new THREE.Mesh(geo().blob, this.blobMat); this.ballBlob.rotation.x = -Math.PI / 2; this.ballBlob.position.y = 0.011;
    scene.add(this.ball, this.ballBlob);
    this.marker = new THREE.Mesh(geo().ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.02; scene.add(this.marker);
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
    this.mode = 'tv'; this.camPos = new THREE.Vector3(0, 30, 60); this.camLook = new THREE.Vector3(); this.snap = true; this.lastDir = 1;
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
    this.meshes = players.map(p => { const m = buildPlayer(this.kits[p.team], p.gk, this.nums[p.id] ?? p.id + 1, p.id, this.blobMat); this.scene.add(m); return m; });
  }

  animate(m, p, dt) {
    const u = m.userData, sp = Math.hypot(p.vx, p.vz), run = clamp(sp / 7, 0, 1);
    u.phase += dt * (3 + sp * 1.6);
    const s = Math.sin(u.phase), sw = 0.15 + run * 0.75;
    u.legs[0].hip.rotation.z = s * sw; u.legs[1].hip.rotation.z = -s * sw;
    u.legs[0].knee.rotation.z = -Math.max(0, -Math.cos(u.phase)) * sw * 1.3; u.legs[1].knee.rotation.z = -Math.max(0, Math.cos(u.phase)) * sw * 1.3;
    u.arms[0].rotation.z = -s * sw * 0.8; u.arms[1].rotation.z = s * sw * 0.8;
    if (sp < 0.3) { for (const l of u.legs) { l.hip.rotation.z *= 0.2; l.knee.rotation.z = 0; } for (const a of u.arms) a.rotation.z *= 0.2; }
    const b = u.body;
    if (p.tackleT > 0) { b.rotation.z = -1.15; b.position.y = -0.35; }
    else { b.rotation.z += (-run * 0.22 - b.rotation.z) * Math.min(1, dt * 10); b.position.y = Math.abs(s) * run * 0.06; }
    b.rotation.x = p.stun > 0 ? Math.sin(u.phase * 2) * 0.15 : 0;
  }

  updateCamera(v, dt) {
    const P = this.P, b = v.ball, aspect = this.cam.aspect, owner = b.owner >= 0 ? v.players[b.owner] : null;
    if (owner) this.lastDir = owner.team === 0 ? 1 : -1;
    const pos = new THREE.Vector3(), look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let fov = clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(64) / 2) / aspect) * 180 / Math.PI, 28, 78);
    if (this.mode === 'alto') {
      const port = aspect < 1, W = (port ? P.hz : P.hx) + 4, H = (port ? P.hx : P.hz) + 4, t = Math.tan(THREE.MathUtils.degToRad(40) / 2);
      fov = 40; pos.set(0, Math.max(H / t, W / (t * aspect)), 0.01); look.set(0, 0, 0); up.set(port ? 1 : 0, 0, port ? 0 : -1);
    } else if (this.mode === 'segui') {
      const d = this.lastDir, bx = clamp(b.x, -P.hx, P.hx);
      pos.set(bx - d * 13, 6.5, b.z * 0.85); look.set(bx + d * 7, 0.5, b.z * 0.9); fov = clamp(fov, 40, 70);
    } else if (this.mode === 'porta') {
      const sx = b.x >= 0 ? 1 : -1;
      pos.set(sx * (P.hx + 9), 7, b.z * 0.3); look.set(b.x * 0.75, 0, b.z * 0.6); fov = clamp(fov, 45, 75);
    } else {
      const port = aspect < 0.9; // telefono in verticale: inquadratura piu' dall'alto, cosi' il campo riempie lo schermo invece delle tribune
      const dist = Math.max(port ? 16 : 22, P.hz * (port ? 1.5 : 2.1)), hgt = Math.max(12, P.hz * (port ? 2 : 1.15)), k = P.hx * (port ? 0.1 : 0.22);
      fov = clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50) / 2) / aspect) * 180 / Math.PI, 24, 64);
      pos.set(clamp(b.x, -P.hx + k, P.hx - k), hgt, b.z * 0.3 + dist); look.set(pos.x, 0, b.z * 0.45 - 1);
    }
    const k = this.snap ? 1 : 1 - Math.exp(-(this.blend < 1 ? 2.2 : 3.2) * dt);
    this.blend = Math.min(1, (this.blend ?? 1) + dt * 1.2); this.snap = false;
    this.camPos.lerp(pos, k); this.camLook.lerp(look, k);
    this.cam.up.lerp(up, this.mode === 'alto' ? 1 : k).normalize();
    this.cam.fov += (fov - this.cam.fov) * k; this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.camPos); this.cam.lookAt(this.camLook);
  }

  /** v: { players, ball } (la simulazione stessa o un fotogramma di replay). */
  draw(v, dt) {
    this.resize();
    if (this.meshes.length !== v.players.length) this.build(v.players);
    v.players.forEach((p, i) => {
      const m = this.meshes[i]; m.visible = !p.out;
      if (p.out) return;
      m.position.set(p.x, 0, p.z); m.rotation.y = -p.face; this.animate(m, p, dt);
    });
    const b = v.ball, sp = Math.hypot(b.vx, b.vz);
    this.ball.position.set(b.x, Math.max(0.13, b.y + 0.02), b.z);
    if (sp > 0.05) { const ax = new THREE.Vector3(b.vz, 0, -b.vx).normalize(); this.ball.rotateOnWorldAxis(ax, -sp * dt / 0.13); }
    this.ballBlob.position.set(b.x + b.y * 0.25, 0.011, b.z - b.y * 0.15); this.ballBlob.scale.setScalar(clamp(0.45 - b.y * 0.05, 0.15, 0.45));
    const owner = b.owner >= 0 ? v.players[b.owner] : null;
    this.marker.visible = this.showMarker && !!owner && !owner.out;
    if (owner) this.marker.position.set(owner.x, 0.02, owner.z);
    this.updateCamera(v, dt);
    this.r.render(this.scene, this.cam);
  }

  dispose() { this.r.dispose(); }
}
