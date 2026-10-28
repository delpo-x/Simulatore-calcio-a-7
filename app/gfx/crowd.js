// Pubblico 3D: spettatori low-poly in un'unica InstancedMesh sulle gradinate, animati nel vertex shader (ondeggiano, alzano le braccia e
// saltano quando la loro squadra segna o attacca), e bandiere dei tifosi che sventolano. Solo scena.
import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/addons/utils/BufferGeometryUtils.js';
const rnd = Math.random; // valore uniforme 0..1 (rnd di effects.js vuole un intervallo)

const NEUTRAL = [0x2d3a4f, 0x5b5f66, 0x8a2d2d, 0x2f5d3a, 0xc9c2b0, 0x1f1f24, 0x6a4b8c, 0xd08a2e];

/** Spettatore alto ~1,7 m rivolto verso +z. Attributi: aTint 1 dove prende il colore della maglia, aArm -1/+1 sulle braccia (per alzarle). */
function figure() {
  const part = (g, x, y, z, col, tint, arm) => {
    g.translate(x, y, z); if (g.index) g = g.toNonIndexed(); const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => col[i % 3]), 3));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(new Array(n).fill(tint), 1)); g.setAttribute('aArm', new THREE.Float32BufferAttribute(new Array(n).fill(arm), 1));
    g.deleteAttribute('uv'); return g;
  };
  const dark = [0.16, 0.17, 0.2], white = [1, 1, 1], skin = [0.82, 0.62, 0.48];
  return mergeGeometries([
    part(new THREE.BoxGeometry(0.34, 0.8, 0.22), 0, 0.4, 0, dark, 0, 0),
    part(new THREE.BoxGeometry(0.44, 0.6, 0.26), 0, 1.1, 0, white, 1, 0),
    part(new THREE.IcosahedronGeometry(0.13, 0), 0, 1.55, 0, skin, 0, 0),
    part(new THREE.BoxGeometry(0.1, 0.6, 0.1), -0.27, 1.08, 0, white, 1, -1),
    part(new THREE.BoxGeometry(0.1, 0.6, 0.1), 0.27, 1.08, 0, white, 1, 1),
  ]);
}

/**
 * seats: [{ x, y, z, ry, fan? }] posti nel mondo (ry: rotazione verso il campo; fan 0/1 forza la squadra, per lo staff in panchina);
 * flags: [{ x, y, z, ry }] punti per le bandiere; kits: maglie delle due squadre; fill 0..1 quota di posti occupati.
 * I tifosi di casa stanno verso x < 0, gli ospiti verso x > 0.
 */
export function crowd(scene, seats, flags, kits, fill, hx) {
  const used = seats.filter(s => s.fan != null || rnd() < fill), n = used.length;
  const ex = new THREE.Vector2(), time = { value: 0 }, uEx = { value: ex };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = time; sh.uniforms.uEx = uEx;
    sh.vertexShader = 'uniform float uTime; uniform vec2 uEx; attribute float aTint, aArm, aFan;\n' + sh.vertexShader
      .replace('#include <color_vertex>', 'vColor = vec3(1.0); vColor *= mix(color, color * instanceColor, aTint);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        float ex = aFan < 0.25 ? uEx.x : aFan > 0.75 ? uEx.y : (uEx.x + uEx.y) * 0.4;
        if (abs(aArm) > 0.5) { // braccia: si alzano con l'entusiasmo, qualcuno le agita
          float a = aArm * (ex * (2.2 + 0.6 * ph) * step(0.15, ph) + 0.25 * ex * sin(uTime * 9.0 + ph * 40.0));
          vec2 piv = vec2(aArm * 0.27, 1.38), q = transformed.xy - piv; float c = cos(a), s = sin(a);
          transformed.xy = piv + vec2(c * q.x - s * q.y, s * q.x + c * q.y);
        }
        transformed.x += sin(uTime * 1.3 + ph * 30.0) * 0.025 * position.y;
        transformed.y += ex * max(0.0, sin(uTime * 7.0 + ph * 30.0)) * 0.3 * step(0.35, ph);`);
  };
  const mesh = new THREE.InstancedMesh(figure(), mat, Math.max(1, n)); mesh.count = n;
  const fan = new Float32Array(Math.max(1, n)), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  used.forEach((st, i) => {
    const side = st.x / hx, r = rnd(); // vicino a una porta prevalgono i tifosi di quella parte
    fan[i] = st.fan ?? (side < -0.3 ? (r < 0.8 ? 0 : r < 0.9 ? 1 : 0.5) : side > 0.3 ? (r < 0.8 ? 1 : r < 0.9 ? 0 : 0.5) : r < 0.42 ? 0 : r < 0.72 ? 1 : 0.5);
    const kit = fan[i] === 0 ? kits[0] : fan[i] === 1 ? kits[1] : null;
    c.set(kit ? (st.fan != null || rnd() < 0.82 ? kit.shirt : kit.shorts) : NEUTRAL[(rnd() * NEUTRAL.length) | 0]); c.offsetHSL(0, 0, (rnd() - 0.5) * 0.08); mesh.setColorAt(i, c);
    const sc = 0.9 + rnd() * 0.2; q.setFromAxisAngle(up, st.ry + (rnd() - 0.5) * 0.4);
    mesh.setMatrixAt(i, m.compose(p.set(st.x + (rnd() - 0.5) * 0.15, st.y, st.z + (rnd() - 0.5) * 0.1), q, s.set(sc, sc, sc)));
  });
  mesh.geometry.setAttribute('aFan', new THREE.InstancedBufferAttribute(fan, 1));
  mesh.frustumCulled = false; scene.add(mesh); // una sola draw call; niente ombre (costerebbero una seconda passata di tutte le istanze)

  // bandiere: drappo fisso all'asta che ondeggia piu' forte con l'entusiasmo della sua curva
  const fmats = [0, 1].map(t => {
    const fm = new THREE.MeshLambertMaterial({ color: kits[t].shirt, side: THREE.DoubleSide }), e = `uEx.${'xy'[t]}`;
    fm.onBeforeCompile = sh => { sh.uniforms.uTime = time; sh.uniforms.uEx = uEx; sh.vertexShader = 'uniform float uTime; uniform vec2 uEx;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float k = (position.x + 0.8) / 1.6; transformed.z += sin(uTime * (3.5 + ${e} * 4.0) - position.x * 3.0) * k * (0.1 + 0.25 * ${e});`); };
    return fm;
  }), pole = new THREE.MeshLambertMaterial({ color: 0x3a3f46 }), cloth = new THREE.PlaneGeometry(1.6, 1, 10, 2), stick = new THREE.CylinderGeometry(0.025, 0.025, 2.6, 5);
  for (const f of flags) {
    const g = new THREE.Group(), t = f.x < 0 ? 0 : 1, st = new THREE.Mesh(stick, pole), cl = new THREE.Mesh(cloth, fmats[t]);
    st.position.y = 1.3; cl.position.set(0.8, 2.05, 0); g.add(st, cl); g.position.set(f.x, f.y, f.z); g.rotation.y = f.ry + Math.PI / 2; scene.add(g);
  }

  const cheer = [0, 0];
  return {
    mesh,
    /** Gol della squadra team: la sua curva esplode e resta in piedi qualche secondo. */
    cheer(team, k = 1) { cheer[team] = Math.max(cheer[team], k); },
    /** base[t]: tensione di fondo dei tifosi della squadra t (0..1), per esempio quando la palla e' vicina alla porta. */
    step(dt, base = [0, 0]) {
      time.value += dt;
      for (const t of [0, 1]) cheer[t] = Math.max(0, cheer[t] - dt * 0.14);
      ex.set(Math.max(cheer[0], base[0]), Math.max(cheer[1], base[1]));
    },
  };
}
