import * as THREE from '../../vendor/three.module.min.js';
import { clamp } from './util.js';

const TRAIL_T = 0.3;
/** Scia semitrasparente dietro la palla sui tiri forti: nastro rivolto verso la telecamera che svanisce con l'eta' dei campioni. */
export class Trail {
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
export class Particles {
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

export const TURF = [0x4c8a3a, 0x3a6b2c, 0x6b5233, 0x5a9a44];
export const rnd = (a, b) => a + Math.random() * (b - a), _ax = new THREE.Vector3(), _iv = new THREE.Vector3(), _ip = new THREE.Vector3();
/** Lavagna tattica 3D: linee di reparto traslucide (compattezza) e, per ogni giocatore, un cerchio sul posto della formazione con la freccia dalla posizione reale. Solo disegno: legge i dati, non tocca la simulazione. */
export class TacticBoard {
  constructor(scene, kits) {
    this.kits = kits; this.k = 0; this.t0 = performance.now(); this.max = 96; // segmenti disponibili (quadrilateri a terra)
    this.pos = new Float32Array(this.max * 12); this.col = new Float32Array(this.max * 16);
    const g = new THREE.BufferGeometry(), idx = []; for (let i = 0; i < this.max; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.visible = false; scene.add(this.mesh);
    this.rings = []; this.scene = scene; this.n = 0;
  }

  /** Quadrilatero piatto a terra tra (x1,z1) e (x2,z2), largo w, colore [r,g,b,a]. */
  seg(x1, z1, x2, z2, w, [r, g, b, a]) {
    if (this.n >= this.max) return;
    const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2, o = this.n * 12, c = this.n * 16;
    this.pos.set([x1 + nx, 0.06, z1 + nz, x1 - nx, 0.06, z1 - nz, x2 - nx, 0.06, z2 - nz, x2 + nx, 0.06, z2 + nz], o);
    for (let i = 0; i < 4; i++) this.col.set([r, g, b, a], c + i * 4);
    this.n++;
  }

  /** data: per giocatore { team, gk, out, hx, hz, line } (posto della formazione e reparto); v: vista con le posizioni reali; null = lavagna spenta. */
  update(data, v) {
    const now = performance.now(), rd = Math.min(0.1, (now - this.t0) / 1000); this.t0 = now; // tempo reale: la lavagna compare anche con il gioco in pausa
    this.k += ((data ? 1 : 0) - this.k) * Math.min(1, rd * 9);
    const on = this.k > 0.02; this.mesh.visible = on; for (const r of this.rings) r.visible = false;
    if (!on || !data) return;
    this.n = 0; const col = t => { const c = new THREE.Color(this.kits[t].shirt); return [c.r, c.g, c.b]; };
    while (this.rings.length < data.length) { // cerchio pieno traslucido + anello, colorati con la maglia
      const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }), ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.56, 28), mat), disc = new THREE.Mesh(new THREE.CircleGeometry(0.44, 28), mat.clone());
      disc.material.opacity = 0.16; ring.rotation.x = disc.rotation.x = -Math.PI / 2; ring.position.y = disc.position.y = 0.055; grp.add(disc, ring); grp.renderOrder = 4; this.scene.add(grp); this.rings.push(grp);
    }
    const lines = new Map();
    data.forEach((d, i) => {
      const p = v.players[i], grp = this.rings[i]; if (!p || d.out) return;
      const [r, g, b] = col(d.team); grp.visible = true; grp.position.set(d.hx, 0, d.hz);
      grp.children[0].material.color.setRGB(r, g, b); grp.children[1].material.color.setRGB(r, g, b); grp.children[1].material.opacity = 0.85 * this.k; grp.children[0].material.opacity = 0.16 * this.k;
      if (!d.gk) { const key = `${d.team}:${d.line}`; (lines.get(key) ?? lines.set(key, []).get(key)).push({ x: p.x, z: p.z, t: d.team }); }
      const dx = d.hx - p.x, dz = d.hz - p.z, dist = Math.hypot(dx, dz);
      if (dist > 1.2) { // freccia dal giocatore al suo posto: filo e punta a V
        const ux = dx / dist, uz = dz / dist, tx = d.hx - ux * 0.5, tz = d.hz - uz * 0.5, white = [1, 1, 1, 0.7 * this.k];
        this.seg(p.x, p.z, tx, tz, 0.07, white);
        for (const s of [-1, 1]) { const a = s * 0.5, hxv = ux * Math.cos(a) - uz * Math.sin(a), hzv = ux * Math.sin(a) + uz * Math.cos(a); this.seg(tx, tz, tx - hxv * 0.45, tz - hzv * 0.45, 0.07, white); }
      }
    });
    for (const pts of lines.values()) { // linea di reparto: collega i giocatori del reparto da un lato all'altro
      pts.sort((a, b) => a.z - b.z); const [r, g, b] = col(pts[0].t);
      for (let i = 1; i < pts.length; i++) this.seg(pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z, 0.2, [r, g, b, 0.5 * this.k]);
    }
    for (let i = this.n * 12; i < this.max * 12; i++) this.pos[i] = 0; // quadrilateri inutilizzati: degeneri
    const gm = this.mesh.geometry; gm.attributes.position.needsUpdate = true; gm.attributes.color.needsUpdate = true;
  }
}
