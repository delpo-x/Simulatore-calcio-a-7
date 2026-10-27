import * as THREE from '../../vendor/three.module.min.js';
import { canvas, clamp } from './util.js';
import { boardTexture, crowdTexture, fenceTexture, netTexture } from './textures.js';

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

export function goal(dir, P) {
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

export function stadium(P, scene) {
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
    floodGlow(scene, new THREE.Vector3(x, h + 1, z));
  }
  fence(P, m, scene); benches(P, scene);
  return { flags: cornerFlags(P, scene) };
}

let GLOW = null;
/** Alone dei riflettori: cono semitrasparente additivo verso il campo (sfumato in punta e alla base) e bagliore sul faro. */
function floodGlow(scene, from) {
  GLOW ??= (() => {
    const [c, g] = canvas(4, 128), gr = g.createLinearGradient(0, 0, 0, 128); // v = 1 alla punta del cono (il faro), 0 alla base
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const cone = new THREE.CanvasTexture(c);
    const [f, h] = canvas(64, 64), rg = h.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,248,225,1)'); rg.addColorStop(0.25, 'rgba(255,240,200,0.55)'); rg.addColorStop(1, 'rgba(255,240,200,0)'); h.fillStyle = rg; h.fillRect(0, 0, 64, 64);
    return { cone: new THREE.MeshBasicMaterial({ color: 0xfff1d6, alphaMap: cone, transparent: true, opacity: 0.025, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      flare: new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(f), color: 0xfff6dc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }) };
  })();
  const to = new THREE.Vector3(from.x * 0.25, 0, from.z * 0.25), dir = from.clone().sub(to), len = dir.length();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(len * 0.32, len, 24, 1, true), GLOW.cone); // punta del cono (+y) sul faro
  cone.position.copy(to).addScaledVector(dir, 0.5); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); cone.renderOrder = 2; scene.add(cone);
  const fl = new THREE.Sprite(GLOW.flare); fl.position.copy(from); fl.scale.set(3.5, 3.5, 1); fl.renderOrder = 2; scene.add(fl);
}

/** Bandierine d'angolo flessibili: asta che oscilla (molla smorzata) se la palla o un giocatore la tocca. */
function cornerFlags(P, scene) {
  const pole = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), cloth = new THREE.MeshStandardMaterial({ color: 0xff3b1f, roughness: 0.8, side: THREE.DoubleSide });
  const flags = [];
  for (const d of [-1, 1]) for (const e of [-1, 1]) {
    const g = new THREE.Group(), stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.5, 6), pole), flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), cloth);
    stick.position.y = 0.75; flag.position.set(-d * 0.2, 1.34, 0); stick.castShadow = flag.castShadow = true; g.add(stick, flag);
    g.position.set(d * P.hx, 0, e * P.hz); scene.add(g); flags.push({ g, x: d * P.hx, z: e * P.hz, ax: 0, az: 0, vx: 0, vz: 0, t: Math.random() * 6 });
  }
  return flags;
}

/** Fisica delle bandierine: urto da palla (veloce) o giocatore entro 0,5 m, poi molla smorzata; il drappo sventola appena. */
export function stepFlags(flags, v, dt) {
  if (!flags || dt <= 0) return;
  for (const f of flags) {
    const hit = (x, z, vx, vz, r, k) => { const dx = f.x - x, dz = f.z - z; if (dx * dx + dz * dz < r * r) { f.vx += vx * k; f.vz += vz * k; } };
    hit(v.ball.x, v.ball.z, v.ball.vx || 0, v.ball.vz || 0, 0.45, 0.25);
    for (const p of v.players) if (!p.out) hit(p.x, p.z, p.vx || 0, p.vz || 0, 0.5, 0.15);
    f.vx += (-40 * f.ax - 3 * f.vx) * dt; f.vz += (-40 * f.az - 3 * f.vz) * dt; f.ax = clamp(f.ax + f.vx * dt, -0.6, 0.6); f.az = clamp(f.az + f.vz * dt, -0.6, 0.6);
    f.t += dt; f.g.rotation.z = -f.ax; f.g.rotation.x = f.az; f.g.children[1].rotation.y = Math.sin(f.t * 3) * 0.15;
  }
}

/** Recinzione perimetrale: bassa lungo il lato della telecamera (non copre il gioco), alta dietro le porte, con paletti. */
function fence(P, m, scene) {
  const post = new THREE.MeshStandardMaterial({ color: 0x2f3a44, roughness: 0.6, metalness: 0.5 });
  const wire = (len, h, x, z, ry) => {
    const t = fenceTexture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 0.5, h / 0.5);
    const m1 = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    m1.position.set(x, h / 2 + 0.05, z); m1.rotation.y = ry; scene.add(m1);
    const n = Math.max(2, Math.round(len / 4)), posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, h + 0.1, 8), post, n + 1), at = new THREE.Matrix4(); // paletti (una sola draw call) e corrimano
    for (let i = 0; i <= n; i++) {
      const o = (i / n - 0.5) * len;
      posts.setMatrixAt(i, at.makeTranslation(x + Math.cos(ry) * o, h / 2 + 0.05, z - Math.sin(ry) * o));
    }
    posts.castShadow = true; scene.add(posts);
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
