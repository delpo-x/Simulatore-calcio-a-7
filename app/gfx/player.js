import * as THREE from '../../vendor/three.module.min.js';
import { contrast, kitTrim, numberTexture, shirtTexture } from './textures.js';

export const SKINS = [0xf1c7a1, 0xe0ac7e, 0xc68a5c, 0x8d5a3b, 0x6b4129];
export const HAIRS = [0x2b1d14, 0x4a2f1b, 0x111111, 0x8a6236, 0xc9a35f];

const GEO = {};
export function geo() {
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

const MATS = new Map(), FUSED = new Map();
/** Materiale opaco condiviso per colore (tra tutti i giocatori): meno stati da cambiare a ogni draw call. */
function lambert(c) { const k = new THREE.Color(c).getHex(); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color: k, roughness: 0.82, metalness: 0 })); return MATS.get(k); }
/** Materiale per le parti fuse: il colore sta nei vertici. */
const FUSED_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
/** Fonde parti rigide (solo traslate) in una geometria sola con il colore nei vertici: una draw call, anche nel passaggio delle ombre. parts: [geometria, colore, x, y, z]; una per combinazione di colori. */
function fuse(parts) {
  const key = parts.map(([g, c, x = 0, y = 0, z = 0]) => `${g.uuid}${new THREE.Color(c).getHex()}${x},${y},${z}`).join('|');
  if (FUSED.has(key)) return FUSED.get(key);
  let nv = 0, ni = 0; for (const [g] of parts) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint16Array(ni), c = new THREE.Color();
  let vo = 0, io = 0;
  for (const [g, color, x = 0, y = 0, z = 0] of parts) {
    const p = g.attributes.position, n = g.attributes.normal; c.set(color);
    for (let i = 0; i < p.count; i++) { const o = (vo + i) * 3; pos[o] = p.getX(i) + x; pos[o + 1] = p.getY(i) + y; pos[o + 2] = p.getZ(i) + z; nor[o] = n.getX(i); nor[o + 1] = n.getY(i); nor[o + 2] = n.getZ(i); col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; }
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
    vo += p.count; io += g.index.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  FUSED.set(key, out); return out;
}

/** Un giocatore low-poly: gambe, braccia, busto, testa; avanti = +x. Stinco, scarpa e fascia sono una mesh sola, come braccio, mano, spalla e polsino. */
export const BOOTS = [0x111111, 0xf4f4f4, 0xff5a1f, 0x2fd4ff, 0xd7ff3a, 0xff2d8a, 0xffc21a, 0x111111];

/** captain = fascia gialla sul braccio sinistro. Altezza e corporatura variano con l'id (il portiere un po' piu' alto). */
export function buildPlayer(kit, gk, num, id, blobMat, captain = false) {
  const G = geo(), torsoMat = new THREE.MeshStandardMaterial({ map: shirtTexture(kit, gk), roughness: 0.8, metalness: 0 });
  const shirtC = gk ? kit.gk : kit.shirt, trimC = kitTrim(kit, gk), skinC = SKINS[(id * 7 + 3) % SKINS.length], gloveC = gk ? 0xf0f0f0 : skinC;
  const shorts = lambert(gk ? 0x1d1d1d : kit.shorts), skin = lambert(skinC), hair = lambert(HAIRS[(id * 5 + 1) % HAIRS.length]);
  const lower = fuse([[G.shin, gk ? kit.gk : kit.socks], [G.shoe, BOOTS[(id * 3 + 2) % BOOTS.length], 0, -0.5, 0], [G.sockTop, trimC, 0, -0.08, 0]]);
  const sleeve = fuse([[G.arm, shirtC], [G.hand, gloveC, 0, -0.56, 0], [G.shoulder, shirtC], [G.cuff, trimC, 0, -0.5, 0]]);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.92, side * 0.1);
    const thigh = new THREE.Mesh(G.thigh, shorts);
    const knee = new THREE.Group(); knee.position.y = -0.42;
    knee.add(new THREE.Mesh(lower, FUSED_MAT)); hip.add(thigh, knee); body.add(hip); legs.push({ hip, knee });
    const sh = new THREE.Group(); sh.position.set(0, 1.47, side * 0.25);
    sh.add(new THREE.Mesh(sleeve, FUSED_MAT)); body.add(sh); arms.push(sh);
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
  if (captain) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10, 1, true), lambert(0xffd400)); band.position.y = -0.17; band.material.side = THREE.DoubleSide; arms[0].add(band); }
  const hs = (gk ? 1.05 : 0.95) + ((id * 37) % 11) / 100, ws = 0.93 + ((id * 53) % 15) / 100; body.scale.set(ws, hs, ws);
  const blob = new THREE.Mesh(G.blob, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; root.add(blob);
  root.userData = { blob, body, legs, arms, head, hr, neck, idleT: id * 1.3, look: 0, diveHigh: false, phase: (id * 1.7) % 6.28, heading: undefined, prevSp: 0, accLean: 0, feintT: 0, feintDir: 1, kickT: 0, kickLeft: false, kickPow: 0.5, kickLoft: false, headT: 0, headCd: 0, diveT: 0, diveCd: 0, diveDir: 1 };
  return root;
}
