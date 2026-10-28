// Giocatori con scheletro: manichino CC0 di Quaternius (assets/player.glb) colorato col kit per osso dominante, animazioni di corsa
// fuse per velocita' e sincronizzate in fase, piu' sovrapposizioni procedurali sulle ossa (calcio, scivolata, tuffo). Solo scena.
import * as THREE from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../../vendor/addons/utils/SkeletonUtils.js';
import { contrast, numberTexture } from './textures.js';
import { BOOTS, HAIRS, SKINS, geo } from './player.js';
import { clamp } from './util.js';

let SRC = null, LOAD = null;
/** Carica il modello una volta sola; si risolve con true se il modello e' pronto. */
export function loadRig(url = new URL('../../assets/player.glb', import.meta.url).href) {
  LOAD ??= new Promise(res => new GLTFLoader().load(url, g => { SRC = prepare(g); res(true); }, undefined, () => res(false)));
  return LOAD;
}
export const rigReady = () => !!SRC;

/** Regione del kit per osso: 0 pelle, 1 maglia, 2 pantaloncini, 3 calzettoni, 4 scarpe, 5 avambraccio, 6 mani. */
const REGION = n => /^(Head|neck)/.test(n) ? 0 : /^(pelvis|thigh)/.test(n) ? 2 : /^calf/.test(n) ? 3 : /^(foot|ball)/.test(n) ? 4 : /^lowerarm/.test(n) ? 5 : /^(hand|index|middle|ring|pinky|thumb)/.test(n) ? 6 : 1;
const LOCO = [['Idle_Loop', 0], ['Walk_Loop', 1.5], ['Jog_Fwd_Loop', 3.6], ['Sprint_Loop', 6.8]]; // clip e velocita' (m/s) a cui il passo non scivola

function prepare(g) {
  const root = g.scene;
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const geo = o.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, bones = o.skeleton.bones, reg = new Float32Array(si.count);
    for (let i = 0; i < si.count; i++) { let best = 0, w = -1; for (let k = 0; k < 4; k++) { const wk = sw.getComponent(i, k); if (wk > w) { w = wk; best = si.getComponent(i, k); } } reg[i] = REGION(bones[best].name); }
    geo.setAttribute('region', new THREE.BufferAttribute(reg, 1));
  });
  root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(root);
  return { root, clips: g.animations, height: box.max.y - box.min.y, minY: box.min.y };
}

function kitMaterial(cols) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 }), u = { value: cols };
  m.onBeforeCompile = sh => {
    sh.uniforms.uKit = u;
    sh.vertexShader = 'attribute float region; varying float vR;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vR = region;');
    sh.fragmentShader = 'uniform vec3 uKit[7]; varying float vR;\n' + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( uKit[int(vR + 0.5)], opacity );');
  };
  m.customProgramCacheKey = () => 'kit-rig';
  return m;
}

/** Come buildPlayer: avanti = +x, userData con gli stessi campi usati dalla regia (kickT, slideT, diveT, ...). */
export function buildRigged(kit, gk, num, id, blobMat, captain = false) {
  const S = SRC, model = SkeletonUtils.clone(S.root), root = new THREE.Group(), inner = new THREE.Group();
  const hs = (gk ? 1.05 : 0.95) + ((id * 37) % 11) / 100, ws = 0.93 + ((id * 53) % 15) / 100, k = 1.8 / S.height;
  inner.rotation.order = 'YXZ'; inner.rotation.y = Math.PI / 2; inner.scale.set(k * ws, k * hs, k * ws); inner.position.y = inner.userData.y = -S.minY * k * hs; inner.add(model); root.add(inner);
  const c = x => new THREE.Color(x), skinC = SKINS[(id * 7 + 3) % SKINS.length], shirt = gk ? kit.gk : kit.shirt;
  const cols = [c(skinC), c(shirt), c(gk ? 0x1d1d1d : kit.shorts), c(gk ? kit.gk : kit.socks), c(BOOTS[(id * 3 + 2) % BOOTS.length]), c(gk ? shirt : skinC), c(gk ? 0xf0f0f0 : skinC)];
  const mat = kitMaterial(cols), bones = {};
  model.traverse(o => { if (o.isSkinnedMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } if (o.isBone) bones[o.name] = o; });
  const mixer = new THREE.AnimationMixer(model), act = {};
  for (const cl of S.clips) { const a = act[cl.name] = mixer.clipAction(cl); a.play(); a.setEffectiveWeight(0); }
  act.Death01.setLoop(THREE.LoopOnce, 1); act.Death01.clampWhenFinished = true;
  const numCol = contrast(shirt), back = new THREE.Mesh(geo().num, new THREE.MeshBasicMaterial({ map: numberTexture(num, numCol, numCol === '#fff' ? '#000' : '#fff'), transparent: true, depthWrite: false }));
  back.scale.setScalar(0.9); root.add(back);
  let band = null;
  if (captain) { band = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd400, side: THREE.DoubleSide })); root.add(band); }
  const bald = (id * 11) % 9 === 0, hair = bald ? null : new THREE.Mesh(new THREE.SphereGeometry(0.118 * ws, 14, 8, 0, Math.PI * 2, 0, Math.PI * (0.4 + ((id * 13) % 5) * 0.03)), new THREE.MeshStandardMaterial({ color: HAIRS[(id * 5 + 1) % HAIRS.length], roughness: 0.9 })); // calotta di capelli, lunghezza variabile; qualcuno rasato
  if (hair) { hair.castShadow = true; root.add(hair); }
  const blob = new THREE.Mesh(geo().blob, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.visible = false; root.add(blob);
  root.userData = { rig: true, blob, inner, bones, mixer, act, back, band, hair, celebT: 0, scorer: false, phase: ((id * 1.7) % 6.28) / 6.28, heading: undefined, prevSp: 0, lean: 0, feintT: 0, feintDir: 1, kickT: 0, kickLeft: false, kickPow: 0.5, kickLoft: false, headT: 0, headCd: 0, diveT: 0, diveCd: 0, diveDir: 1, diveHigh: false, slideT: 0, pokeT: 0, stunW: 0, look: 0 };
  return root;
}

const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _pi = new THREE.Quaternion(), _f = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
/** Ruota un osso attorno a un asse nel mondo (dopo il mixer), mantenendo la gerarchia. */
function turn(bone, axis, ang) {
  if (!bone || !ang) return;
  bone.parent.getWorldQuaternion(_p); _pi.copy(_p).invert(); _q.setFromAxisAngle(axis, ang);
  bone.quaternion.premultiply(_pi.multiply(_q).multiply(_p)); bone.updateMatrixWorld(true);
}

/** Equivalente rigged di TVRenderer.animate: m gruppo, p giocatore della vista, ctx come per i giocatori low-poly. */
export function animateRig(m, p, dt, ctx = {}) {
  const u = m.userData, A = u.act, sp = Math.hypot(p.vx, p.vz);
  for (const k of ['feintT', 'kickT', 'headT', 'diveT', 'slideT', 'pokeT', 'celebT']) u[k] = Math.max(0, u[k] - dt);
  // locomozione: pesi a triangolo tra le velocita' di riferimento, tutte le clip allineate alla stessa fase del passo
  const W = LOCO.map(([, v], i) => { const lo = LOCO[i - 1]?.[1], hi = LOCO[i + 1]?.[1]; return sp <= v ? (lo == null ? 1 : clamp((sp - lo) / (v - lo), 0, 1)) : (hi == null ? 1 : clamp((hi - sp) / (hi - v), 0, 1)); });
  let rate = 0, wsum = 0;
  LOCO.forEach(([n, v], i) => { const d = A[n].getClip().duration; rate += W[i] * (v ? sp / v : 1) / d; wsum += W[i]; });
  u.phase = (u.phase + dt * rate / Math.max(1e-3, wsum)) % 1;
  const stun = p.stun > 0; u.stunW += ((stun ? 1 : 0) - u.stunW) * Math.min(1, dt * 8);
  if (stun && !u.wasStun) A.Death01.reset().play(); u.wasStun = stun;
  u.celW = (u.celW ?? 0) + ((u.celebT > 0 && sp < 2.5 ? 1 : 0) - (u.celW ?? 0)) * Math.min(1, dt * 4); // esultanza: balla quando rallenta, poi torna a correre
  const crouch = p.gk && ctx.alert && sp < 1.2 ? 1 : 0, head = u.headT > 0 ? 1 : 0, free = 1 - Math.max(u.stunW, head, u.celW);
  LOCO.forEach(([n], i) => { const a = A[n]; a.time = u.phase * a.getClip().duration; a.setEffectiveTimeScale(0); a.setEffectiveWeight(W[i] * free * (i === 0 ? 1 - crouch : 1)); });
  A.Crouch_Idle_Loop.setEffectiveTimeScale(1).setEffectiveWeight(crouch * W[0] * free);
  A.Death01.setEffectiveTimeScale(1.4).setEffectiveWeight(u.stunW);
  A.Jump_Loop.setEffectiveTimeScale(1).setEffectiveWeight(head * (1 - u.stunW));
  A.Dance_Loop.setEffectiveTimeScale(u.scorer ? 1.2 : 1).setEffectiveWeight(u.celW * (1 - u.stunW) * (1 - head));
  u.mixer.update(dt);
  // corpo: inclinazione in curva e in accelerazione, tuffo del portiere, scivolata
  const heading = sp > 1.5 ? Math.atan2(p.vz, p.vx) : u.heading, turnRate = u.heading != null && heading != null && dt > 0 ? Math.atan2(Math.sin(heading - u.heading), Math.cos(heading - u.heading)) / dt : 0; u.heading = heading;
  const acc = dt > 0 ? (sp - u.prevSp) / dt : 0; u.prevSp = sp; u.lean += (clamp(acc * 0.02, -0.12, 0.15) - u.lean) * Math.min(1, dt * 6);
  const I = u.inner, baseY = I.userData.y, bank = clamp(turnRate * sp * 0.012, -0.35, 0.35);
  I.rotation.set(0, Math.PI / 2, 0); I.position.set(0, baseY, 0);
  if (u.diveT > 0) { // tuffo: tutto il corpo ruota di lato e si alza, poi atterra
    const t = 1 - u.diveT / 0.8, arc = Math.sin(Math.min(1, t * 1.3) * Math.PI);
    I.rotation.z = u.diveDir * Math.min(1, t * 2.2) * 1.35; I.position.z = u.diveDir * Math.min(1, t * 1.6) * 1.1; I.position.y = baseY + arc * (u.diveHigh ? 0.9 : 0.3);
  } else if (u.slideT > 0) { // scivolata: bacino giu' e busto indietro
    const t = 1 - u.slideT / 0.7, k = Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (t > 0.8 ? (1 - t) / 0.2 : 1);
    I.rotation.x = -k * 1.05; I.position.y = baseY - k * 0.55;
  } else { I.rotation.x = u.lean; I.rotation.z = bank; } // ordine YXZ: x e' il beccheggio e z il rollio attorno agli assi del modello
  m.updateMatrixWorld(true);
  m.getWorldQuaternion(_q); _f.set(1, 0, 0).applyQuaternion(_q); _s.set(0, 0, 1).applyQuaternion(_q);
  const B = u.bones, L = u.kickLeft ? '_l' : '_r';
  if (u.kickT > 0) { // calcio: caricamento indietro, poi gamba tesa avanti e accompagnamento
    const t = 1 - u.kickT / 0.3, pw = 0.6 + u.kickPow * 0.6, sw = t < 0.35 ? -0.8 * t / 0.35 : -0.8 + 2.3 * Math.min(1, (t - 0.35) / 0.45);
    turn(B['thigh' + L], _s, -sw * pw); turn(B['calf' + L], _s, (t < 0.5 ? Math.sin(t / 0.5 * Math.PI * 0.5) : 1 - (t - 0.5) / 0.5) * 1.1 * pw);
    turn(B.spine_01, _s, 0.15 * pw);
  } else if (u.pokeT > 0) turn(B.thigh_r, _s, -Math.sin((1 - u.pokeT / 0.35) * Math.PI) * 1.1);
  if (u.slideT > 0) turn(B.thigh_r, _s, -1.2 * Math.min(1, (1 - u.slideT / 0.7) * 3));
  if (u.diveT > 0) for (const s of ['_l', '_r']) turn(B['upperarm' + s], _f, -u.diveDir * 1.8);
  if (ctx.look && B.Head) turn(B.Head, UP, ctx.look * 0.6);
  // numero sulla schiena e fascia del capitano seguono le ossa
  const sp3 = B.spine_03 ?? B.spine_02;
  if (sp3) { sp3.getWorldPosition(_v); m.worldToLocal(_v); u.back.position.set(_v.x - 0.17, _v.y - 0.05, _v.z); u.back.rotation.set(0, -Math.PI / 2, 0); }
  if (u.hair && B.Head) { B.Head.getWorldPosition(_v); m.worldToLocal(_v); u.hair.position.set(_v.x - 0.01, _v.y + 0.09, _v.z); }
  if (u.band && B.upperarm_l) { B.upperarm_l.getWorldPosition(_v); m.worldToLocal(_v); u.band.position.set(_v.x, _v.y - 0.12, _v.z); }
}
