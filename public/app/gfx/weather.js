// Meteo della scena: luce e nebbia, campo bagnato o innevato, pozze, pioggia e neve che cadono, lampi.
// La fisica (attrito, pozze che fermano la palla) e' nella simulazione; qui c'e' solo quello che si vede.
import * as THREE from '../../vendor/three.module.min.js';
import { canvas } from './util.js';
import { rnd } from './effects.js';

/** Aspetto per condizione: cielo (null = texture del cielo sereno), nebbia [colore, vicino, lontano] in multipli della lunghezza del campo, luci ed esposizione. */
const LOOK = {
  clear: { sky: null, fog: null, hemi: 1.25, sun: 1.1, exp: 1.05 },
  cloudy: { sky: 0xa9b4bf, fog: [0xa9b4bf, 2.2, 7], hemi: 1.15, sun: 0.45, exp: 1.08 },
  night: { sky: 0x070b16, fog: [0x0a0f1c, 2.6, 8], hemi: 0.32, sun: 0.12, exp: 1.12, flood: 2.2, glow: 0.06 },
  fog: { sky: 0xc4cad0, fog: [0xc4cad0, 0.25, 1.6], hemi: 1.05, sun: 0.35, exp: 1.1, glow: 0.05 },
  rain: { sky: 0x6f7b87, fog: [0x76828e, 1.2, 4.5], hemi: 0.9, sun: 0.3, exp: 1.1, wet: 0.4, drops: 1400, fall: 17, wind: 2 },
  storm: { sky: 0x3d4651, fog: [0x47515c, 0.8, 3.2], hemi: 0.7, sun: 0.15, exp: 1.12, wet: 0.22, drops: 2600, fall: 24, wind: 5, flood: 1.4, glow: 0.045, bolts: true },
  snow: { sky: 0xc9d0d8, fog: [0xd2d8de, 1, 4], hemi: 1.2, sun: 0.4, exp: 1.0, flakes: 2200, fall: 1.3, wind: 0.6 },
};

export class Weather {
  /** ctx: { sun, hemi, pitchMat, renderer } della scena gia' costruita; puddles dalla simulazione. */
  constructor(scene, P, kind, puddles, { sun, hemi, pitchMat, renderer, precip = 1 }) {
    this.kind = LOOK[kind] ? kind : 'clear'; const L = this.L = LOOK[this.kind];
    this.scene = scene; this.P = P; this.hemi = hemi; this.puddles = puddles ?? []; this.flash = 0; this.boltT = rnd(4, 10);
    this.wet = !!L.wet; this.snowy = this.kind === 'snow'; this.cold = this.snowy || this.kind === 'fog' || this.kind === 'night';
    if (L.sky !== null) scene.background = new THREE.Color(L.sky);
    if (L.fog) { const len = P.hx * 2; scene.fog = new THREE.Fog(L.fog[0], len * L.fog[1], len * L.fog[2]); }
    hemi.intensity = this.hemiBase = L.hemi; sun.intensity = L.sun; renderer.toneMappingExposure = L.exp;
    scene.traverse(o => {
      if (o.isSpotLight && L.flood) o.intensity *= L.flood;
      if (o.isMesh && o.geometry.type === 'ConeGeometry' && L.glow) o.material.opacity = L.glow; // coni dei riflettori: piu' visibili nell'aria umida o al buio
    });
    if (L.wet) { pitchMat.roughness = L.wet; pitchMat.color.setScalar(0.82); } // erba bagnata: piu' scura e lucida
    if (this.snowy) this.snowCover(scene, P);
    this.puddleMeshes(scene);
    if (L.drops) this.rain(scene, Math.round(L.drops * precip)); else if (L.flakes) this.snow(scene, Math.round(L.flakes * precip)); // densita' dal preset di qualita'
  }

  /** Velo di neve sul campo: macchie bianche irregolari che lasciano intravedere le linee. */
  snowCover(scene, P) {
    const [c, g] = canvas(1024, 640);
    g.fillStyle = 'rgba(244,247,251,0.6)'; g.fillRect(0, 0, 1024, 640);
    g.filter = 'blur(3px)';
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(90,120,80,0.16)'; g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 640, 6 + Math.random() * 30, 3 + Math.random() * 12, Math.random() * 3, 0, 6.28); g.fill(); } // chiazze dove l'erba spunta
    g.filter = 'none';
    for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`; g.fillRect(Math.random() * 1024, Math.random() * 640, 1.5, 1.5); } // granuli
    const m = new THREE.Mesh(new THREE.PlaneGeometry(P.hx * 2 + 4, P.hz * 2 + 4), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true, roughness: 0.9, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.receiveShadow = true; m.renderOrder = 1; scene.add(m);
  }

  /** Pozze: dischi scuri e specchianti dal bordo irregolare, con i cerchi delle gocce che cadono. */
  puddleMeshes(scene) {
    this.ripples = [];
    if (!this.puddles.length) return;
    const mat = new THREE.MeshStandardMaterial({ color: 0x24313a, roughness: 0.04, metalness: 0.55, transparent: true, opacity: 0.82, depthWrite: false });
    for (const q of this.puddles) {
      const sh = new THREE.Shape();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, r = q.r * (0.9 + 0.12 * Math.sin(a * 3 + q.x) + 0.06 * Math.sin(a * 5 + q.z)); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(r, 0); }
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); m.rotation.x = -Math.PI / 2; m.position.set(q.x, 0.012, q.z); m.renderOrder = 1; scene.add(m);
    }
    const rm = new THREE.MeshBasicMaterial({ color: 0xdfe8ee, transparent: true, depthWrite: false, side: THREE.DoubleSide }), rg = new THREE.RingGeometry(0.85, 1, 20);
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(rg, rm.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m); this.ripples.push({ m, t: rnd(0, 0.6), dur: 1 }); }
  }

  /** Pioggia: segmenti che cadono inclinati dal vento in un volume attorno al campo. */
  rain(scene, n) {
    const P = this.P, pos = new Float32Array(n * 6); this.box = [P.hx + 14, 24, P.hz + 14];
    for (let i = 0; i < n; i++) { pos[i * 6] = rnd(-1, 1) * this.box[0]; pos[i * 6 + 1] = rnd(0, this.box[1]); pos[i * 6 + 2] = rnd(-1, 1) * this.box[2]; }
    this.drops = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.LineBasicMaterial({ color: 0xc8d4de, transparent: true, opacity: this.kind === 'storm' ? 0.5 : 0.38, depthWrite: false }));
    this.drops.frustumCulled = false; scene.add(this.drops); this.place();
  }

  /** Neve: fiocchi rotondi (punti con texture morbida) che scendono lenti e ondeggiano. */
  snow(scene, n) {
    const P = this.P, pos = new Float32Array(n * 3); this.box = [P.hx + 14, 20, P.hz + 14]; this.seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-1, 1) * this.box[0]; pos[i * 3 + 1] = rnd(0, this.box[1]); pos[i * 3 + 2] = rnd(-1, 1) * this.box[2]; this.seeds[i] = rnd(0, 6.28); }
    const [c, g] = canvas(32, 32), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    this.flakes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.32, transparent: true, depthWrite: false, opacity: 0.95 }));
    this.flakes.frustumCulled = false; scene.add(this.flakes); this.t = 0;
  }

  /** Riscrive i segmenti della pioggia dalle teste delle gocce (la coda segue il vento). */
  place() {
    const a = this.drops.geometry.attributes.position.array, L = this.L, len = L.fall * 0.045;
    for (let i = 0; i < a.length; i += 6) { a[i + 3] = a[i] - L.wind * len / L.fall; a[i + 4] = a[i + 1] + len; a[i + 5] = a[i + 2]; }
    this.drops.geometry.attributes.position.needsUpdate = true;
  }

  /** In pausa (dt = 0) tutto resta fermo. onThunder: lampo della pioggia intensa (l'app fa il tuono). */
  step(dt) {
    if (dt <= 0) return;
    const L = this.L, [bx, by, bz] = this.box ?? [0, 0, 0];
    if (this.drops) {
      const a = this.drops.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 6) {
        a[i + 1] -= L.fall * dt; a[i] += L.wind * dt;
        if (a[i + 1] < 0) { a[i + 1] += by; a[i] = rnd(-1, 1) * bx; a[i + 2] = rnd(-1, 1) * bz; }
        if (a[i] > bx) a[i] -= 2 * bx;
      }
      this.place();
    }
    if (this.flakes) {
      const a = this.flakes.geometry.attributes.position.array; this.t += dt;
      for (let i = 0, k = 0; i < a.length; i += 3, k++) {
        const s = this.seeds[k]; a[i + 1] -= L.fall * (0.7 + 0.6 * Math.sin(s * 3.1) ** 2) * dt; a[i] += (L.wind + Math.sin(this.t * 0.9 + s) * 0.6) * dt; a[i + 2] += Math.cos(this.t * 0.7 + s * 1.3) * 0.4 * dt;
        if (a[i + 1] < 0) { a[i + 1] += by; a[i] = rnd(-1, 1) * bx; a[i + 2] = rnd(-1, 1) * bz; }
        if (a[i] > bx) a[i] -= 2 * bx;
      }
      this.flakes.geometry.attributes.position.needsUpdate = true;
    }
    for (const r of this.ripples) { // cerchi sulle pozze: nascono in un punto a caso della pozza, si allargano e svaniscono
      r.t -= dt;
      if (r.t <= 0) { const q = this.puddles[Math.floor(Math.random() * this.puddles.length)], a = rnd(0, 6.28), d = Math.sqrt(Math.random()) * q.r * 0.8; r.m.position.set(q.x + Math.cos(a) * d, 0.016, q.z + Math.sin(a) * d); r.t = r.dur = rnd(0.5, 0.9); r.m.visible = true; }
      const k = 1 - r.t / r.dur; r.m.scale.setScalar(0.04 + k * 0.3); r.m.material.opacity = 0.55 * (1 - k);
    }
    if (L.bolts) {
      this.boltT -= dt;
      if (this.boltT <= 0) { this.flash = 1; this.boltT = rnd(7, 16); this.onThunder?.(); }
      this.flash = Math.max(0, this.flash - dt * 4); this.hemi.intensity = this.hemiBase + this.flash * (Math.sin(this.flash * 40) > -0.3 ? 3 : 0.5); // lampo con un tremolio doppio
    }
  }

  /** Pozza sotto (x, z)? Per gli schizzi della grafica. */
  inPuddle(x, z) { return this.puddles.some(q => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r); }
}
