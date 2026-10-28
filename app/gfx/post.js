// Post-processing televisivo: la scena va in un buffer HDR (con MSAA), poi bloom a bassa risoluzione, color grading per meteo, vignettatura,
// tone mapping ACES e conversione sRGB in un unico passaggio finale. Senza dipendenze dagli esempi di Three.js.
import * as THREE from '../../vendor/three.module.min.js';

/** Grading per condizione: sat saturazione, con contrasto, tint moltiplicatore RGB, bloom forza, thr soglia di luminanza, vig vignettatura. */
const GRADE = {
  clear: { sat: 1.08, con: 1.04, tint: [1.02, 1.0, 0.97], bloom: 0.25, thr: 1.5, vig: 0.28 },
  cloudy: { sat: 0.94, con: 1.03, tint: [0.98, 1.0, 1.03], bloom: 0.2, thr: 1.4, vig: 0.3 },
  night: { sat: 1.0, con: 1.06, tint: [0.95, 0.98, 1.06], bloom: 0.45, thr: 1.3, vig: 0.42 },
  fog: { sat: 0.85, con: 0.96, tint: [1.0, 1.0, 1.02], bloom: 0.3, thr: 1.2, vig: 0.24 },
  rain: { sat: 0.88, con: 1.05, tint: [0.96, 1.0, 1.05], bloom: 0.3, thr: 1.3, vig: 0.34 },
  storm: { sat: 0.8, con: 1.06, tint: [0.93, 0.98, 1.08], bloom: 0.35, thr: 1.2, vig: 0.42 },
  snow: { sat: 0.92, con: 1.02, tint: [0.98, 1.0, 1.04], bloom: 0.2, thr: 1.6, vig: 0.26 },
};

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/** Soglia morbida sulla luminanza e riduzione a 1/4 con 4 campioni. */
const BRIGHT = `uniform sampler2D tSrc; uniform vec2 texel; uniform float thr; varying vec2 vUv;
  vec3 pick(vec2 o) { vec3 c = texture2D(tSrc, vUv + o * texel).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return c * smoothstep(thr, thr * 1.6, l); }
  void main() { gl_FragColor = vec4((pick(vec2(-1.0)) + pick(vec2(1.0, -1.0)) + pick(vec2(-1.0, 1.0)) + pick(vec2(1.0))) * 0.25, 1.0); }`;

/** Sfocatura gaussiana separabile a 9 campioni (pesi lineari: 5 letture). */
const BLUR = `uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
  void main() { vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
    c += (texture2D(tSrc, vUv + dir * 1.385).rgb + texture2D(tSrc, vUv - dir * 1.385).rgb) * 0.316;
    c += (texture2D(tSrc, vUv + dir * 3.231).rgb + texture2D(tSrc, vUv - dir * 3.231).rgb) * 0.070;
    gl_FragColor = vec4(c, 1.0); }`;

/** Scia di movimento del rallenty: il fotogramma nuovo si mescola con l'accumulo dei precedenti. */
const ACC = `uniform sampler2D tSrc; uniform sampler2D tPrev; uniform float k; varying vec2 vUv;
  void main() { gl_FragColor = vec4(mix(texture2D(tSrc, vUv).rgb, texture2D(tPrev, vUv).rgb, k), 1.0); }`;

const FINAL = `uniform sampler2D tSrc; uniform sampler2D tBloom; uniform float bloom, sat, con, vig, aspect; uniform vec3 tint; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb + texture2D(tBloom, vUv).rgb * bloom;
    c *= tint;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, sat), 0.0);
    c = pow(c / 0.18, vec3(con)) * 0.18; // contrasto attorno al grigio medio, in lineare
    vec2 d = (vUv - 0.5) * vec2(aspect, 1.0); c *= 1.0 - vig * smoothstep(0.35, 1.05, length(d));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class PostFX {
  /** samples: campioni MSAA del buffer di scena; kind: condizione meteo per il grading. */
  constructor(renderer, { samples = 4, kind = 'clear', bloomScale = 1 } = {}) {
    this.r = renderer; this.g = GRADE[kind] ?? GRADE.clear; this.bloomScale = bloomScale; this.size = new THREE.Vector2();
    const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
    this.scene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
    this.a = new THREE.WebGLRenderTarget(1, 1, hdr); this.b = new THREE.WebGLRenderTarget(1, 1, hdr);
    this.h = [new THREE.WebGLRenderTarget(1, 1, hdr), new THREE.WebGLRenderTarget(1, 1, hdr)]; this.trail = 0; this.fresh = true; // accumulo a piena risoluzione per la scia (solo con trail > 0)
    const mat = (frag, u) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false, toneMapped: false });
    this.mBright = mat(BRIGHT, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: this.g.thr } });
    this.mAcc = mat(ACC, { tSrc: { value: null }, tPrev: { value: null }, k: { value: 0 } });
    this.mBlur = mat(BLUR, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mFinal = mat(FINAL, { tSrc: { value: this.scene.texture }, tBloom: { value: this.a.texture }, bloom: { value: this.g.bloom * bloomScale }, sat: { value: this.g.sat }, con: { value: this.g.con }, vig: { value: this.g.vig }, tint: { value: new THREE.Vector3(...this.g.tint) }, aspect: { value: 1 } });
    this.mFinal.toneMapped = true; // include ACES ed esposizione del renderer
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** Lampo del temporale: un picco breve di bloom che rientra da solo. */
  flash(k) { this.mFinal.uniforms.bloom.value = this.g.bloom * this.bloomScale * (1 + k); }

  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.quad, this.ortho); }

  render(scene, cam) {
    const r = this.r; r.getDrawingBufferSize(this.size); const w = this.size.x, h = this.size.y;
    if (w !== this.scene.width || h !== this.scene.height) {
      this.scene.setSize(w, h); for (const t of this.h) t.setSize(w, h); this.fresh = true; const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2); this.a.setSize(qw, qh); this.b.setSize(qw, qh);
      this.mBright.uniforms.texel.value.set(1 / w, 1 / h); this.mFinal.uniforms.aspect.value = w / h;
    }
    r.setRenderTarget(this.scene); r.render(scene, cam);
    let src = this.scene.texture;
    if (this.trail > 0) { // ping-pong: si scrive in w leggendo l'accumulo precedente r0; al primo fotogramma niente storia
      const [w0, r0] = this.h, au = this.mAcc.uniforms; au.tSrc.value = src; au.tPrev.value = r0.texture; au.k.value = this.fresh ? 0 : this.trail;
      this.pass(this.mAcc, w0); this.h = [r0, w0]; src = w0.texture; this.fresh = false;
    } else this.fresh = true;
    this.mFinal.uniforms.tSrc.value = src;
    const u = this.mBlur.uniforms, qw = this.a.width, qh = this.a.height;
    this.mBright.uniforms.tSrc.value = src; this.pass(this.mBright, this.a);
    for (let i = 1; i <= 2; i++) { // due giri a raggio crescente: alone largo a costo basso
      u.tSrc.value = this.a.texture; u.dir.value.set(i / qw, 0); this.pass(this.mBlur, this.b);
      u.tSrc.value = this.b.texture; u.dir.value.set(0, i / qh); this.pass(this.mBlur, this.a);
    }
    const base = this.g.bloom * this.bloomScale, bu = this.mFinal.uniforms.bloom; bu.value += (base - bu.value) * 0.15;
    this.pass(this.mFinal, null);
  }

  dispose() { for (const t of [this.scene, this.a, this.b, ...this.h]) t.dispose(); for (const m of [this.mBright, this.mBlur, this.mAcc, this.mFinal]) m.dispose(); }
}
