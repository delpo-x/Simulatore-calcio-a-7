// Fili d'erba in instancing sopra la texture del campo: ciuffi di tre lame, colore preso dal pixel della texture sotto (strisce del
// rasaerba e linee bianche restano leggibili), oscillazione al vento nel vertex shader. Solo scena.
import * as THREE from '../../vendor/three.module.min.js';
import { rnd } from './effects.js';

/** Ciuffo: tre lame triangolari a 120 gradi, alte h, colore piu' scuro alla base. */
function tuft(h) {
  const pos = [], col = [], w = 0.012;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094, c = Math.cos(a) * w, s = Math.sin(a) * w, lean = 0.02 * (i - 1);
    pos.push(-c, 0, -s, c, 0, s, lean, h * (0.8 + i * 0.12), lean * 0.5);
    col.push(0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 1.15, 1.15, 1.15);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 27 }, (_, i) => (i % 3 === 1 ? 1 : 0)), 3)); // normali verso l'alto: le lame si illuminano come il prato
  return g;
}

/** count ciuffi sul campo P; tex: CanvasTexture del campo; h altezza (m). Restituisce { mesh, step(dt) }. */
export function grass(scene, P, tex, count, h = 0.07) {
  const img = tex.image, W = img.width, H = img.height, px = img.getContext('2d').getImageData(0, 0, W, H).data;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const time = { value: 0 };
  mat.onBeforeCompile = sh => { // vento: la punta si sposta, la base resta ferma; fase dalla posizione dell'istanza
    sh.uniforms.uTime = time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]); float sway = sin(uTime * 1.7 + wp.x * 0.35 + wp.y * 0.2) * 0.5 + sin(uTime * 3.1 + wp.x * 1.3) * 0.2;
      transformed.xz += vec2(0.018, 0.008) * sway * (position.y / ${h.toFixed(3)});`);
  };
  const mesh = new THREE.InstancedMesh(tuft(h), mat, count); mesh.receiveShadow = true; mesh.frustumCulled = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 2 - 1) * P.hx, z = (rnd() * 2 - 1) * P.hz;
    const ix = Math.min(W - 1, ((x + P.hx) / (2 * P.hx) * W) | 0), iz = Math.min(H - 1, ((z + P.hz) / (2 * P.hz) * H) | 0), k = (iz * W + ix) * 4;
    c.setRGB(px[k] / 255, px[k + 1] / 255, px[k + 2] / 255, THREE.SRGBColorSpace); mesh.setColorAt(i, c);
    q.setFromAxisAngle(up, rnd() * 6.283); const sc = 0.7 + rnd() * 0.6; s.set(sc, sc, sc);
    mesh.setMatrixAt(i, m.compose(p.set(x, 0, z), q, s));
  }
  scene.add(mesh);
  return { mesh, step(dt) { time.value += dt; } };
}
