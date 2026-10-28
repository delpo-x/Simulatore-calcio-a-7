// Grafica 3D low-poly in stile televisivo per l'app: stadio, giocatori animati con maglia e numero, palla, quattro telecamere.
// Legge solo lo stato della simulazione (o di un replay) e non lo modifica.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, setAnisotropy } from './gfx/util.js';
import { buildPlayer, geo } from './gfx/player.js';
import { ballTexture, blobTexture, nameTag, pitchTexture, skyTexture, turfRelief } from './gfx/textures.js';
import { goal, stadium, stepFlags } from './gfx/stadium.js';
import { Weather } from './gfx/weather.js';
import { FrameGovernor, QUALITY } from './gfx/quality.js';
import { PostFX } from './gfx/post.js';
import { grass } from './gfx/grass.js';
import { animateRig, buildRigged, loadRig } from './gfx/rig.js';
import { Particles, TURF, TacticBoard, Trail, _ax, _ip, _iv, rnd } from './gfx/effects.js';

export { contrast } from './gfx/textures.js';

export class TVRenderer {
  /** kits: [{ shirt, shorts, socks, gk }] per squadra; nums: numero di maglia per id del giocatore. */
  constructor(canvas, pitch, { kits, nums, label, weather = 'clear', puddles = [], surface = 'dirt', quality = 'high' } = {}) {
    this.surface = surface; const Q = this.Q = QUALITY[quality] ?? QUALITY.high; this.quality = QUALITY[quality] ? quality : 'high'; this.gov = new FrameGovernor(Q.minScale);
    this.canvas = canvas; this.P = pitch; this.kits = kits; this.nums = nums ?? []; this.label = label;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: Q.aa && !Q.post, powerPreference: 'high-performance' });
    setAnisotropy(r.capabilities.getMaxAnisotropy());
    this.dpr = Math.min(window.devicePixelRatio || 1, Q.dpr); r.setPixelRatio(this.dpr); r.outputColorSpace = THREE.SRGBColorSpace; r.info.autoReset = false;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const scene = this.scene = new THREE.Scene();
    scene.background = skyTexture(); scene.fog = new THREE.Fog(0xc9dcee, 120 + pitch.hx * 2, 320 + pitch.hx * 4);
    const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x40603a, 1.25); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3dd, 1.1); sun.position.set(-30, 60, 25); scene.add(sun);
    sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera; sc.left = -pitch.hx - 6; sc.right = pitch.hx + 6; sc.top = pitch.hz + 6; sc.bottom = -pitch.hz - 6; sc.near = 10; sc.far = 160;
    const relief = turfRelief(); relief.repeat.set(pitch.hx * 2 / 2.5, pitch.hz * 2 / 2.5); relief.wrapS = relief.wrapT = THREE.RepeatWrapping;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(pitch.hx * 2, pitch.hz * 2), new THREE.MeshStandardMaterial({ map: pitchTexture(pitch, surface), roughness: surface === 'dirt' ? 0.95 : 0.85, metalness: 0, roughnessMap: relief, bumpMap: relief, bumpScale: surface === 'dirt' ? 0.6 : 1.4 }));
    pm.rotation.x = -Math.PI / 2; pm.receiveShadow = true; scene.add(pm);
    this.grass = Q.grass && surface !== 'dirt' && weather !== 'snow' ? grass(scene, pitch, pm.material.map, Q.grass, surface === 'grass' ? 0.08 : 0.055) : null;
    this.flags = stadium(pitch, scene).flags;
    this.wx = new Weather(scene, pitch, weather, puddles, { sun, hemi, pitchMat: pm.material, renderer: r, precip: Q.precip }); this.wx.onThunder = () => { this.post?.flash(1.5); this.onThunder?.(); };
    this.post = Q.post ? new PostFX(r, { samples: Q.aa ? 4 : 0, kind: weather }) : null; // con il post l'MSAA sta nel buffer di scena
    if (Q.post) loadRig().then(ok => { if (ok) { this.useRig = true; this.rebuild = true; } }); // giocatori con scheletro dal preset Media in su; fino al caricamento restano quelli low-poly
    if (this.post && scene.background?.isTexture) { const pm = new THREE.PMREMGenerator(r), sky = scene.background.clone(); sky.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pm.fromEquirectangular(sky).texture; scene.environmentIntensity = 0.35; pm.dispose(); } // riflessi del cielo su palla, maglie e pelle
    if (this.post) { const seen = new Set(); scene.traverse(o => { if (o.isMesh && o.geometry.type === 'ConeGeometry' && !seen.has(o.material)) { seen.add(o.material); o.material.opacity *= 0.35; } }); } // coni additivi: in HDR si sommano prima del tone mapping e risultano molto piu' chiari
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
    this.mode = 'tv'; this.camPos = new THREE.Vector3(0, 30, 60); this.camLook = new THREE.Vector3(); this.snap = true; this.lastDir = 1; this.camDir = 1; this.dirT = 0; this.board = new TacticBoard(scene, kits); this.boardData = null; this.ghosts = []; this.entering = new Map(); // lavagna tattica e cambi volanti (uscenti verso la panchina, entranti dalla panchina)
    this.shake = 0; this.rdir = 1; this.rside = 1; // rdir: lato della porta in cui e' entrato il gol, rside: lato da cui la camera del replay guarda
    this.meshes = []; this.showMarker = true; this.w = 0; this.h = 0;
  }

  setCamera(mode) { if (mode !== this.mode) { this.mode = mode; this.blend = 0; } this.cutK = null; }

  /**
   * Stacco di regia sulla camera TV, con taglio netto in entrata e in uscita: { kind: 'player', id, t } primo piano su un giocatore,
   * { kind: 'fondo', dir, t } vista da dietro chi calcia (rigori), che si chiude poco dopo il tiro.
   */
  cut(c) { if (this.mode !== 'tv') return; this.cutK = c; this.snap = true; if (c.dir) this.camDir = this.lastDir = c.dir; }

  resize() {
    const w = this.canvas.clientWidth | 0, h = this.canvas.clientHeight | 0;
    if (!w || !h || (w === this.w && h === this.h)) return;
    this.w = w; this.h = h; this.r.setSize(w, h, false); this.cam.aspect = w / h;
  }

  build(players) {
    for (const m of this.meshes) this.scene.remove(m);
    const capt = [0, 1].map(t => players.find(p => p.team === t && !p.gk)?.id); // capitano: primo giocatore di movimento di ogni squadra
    this.meshes = players.map(p => this.mkMesh(p.team, p.gk, this.nums[p.id] ?? p.id + 1, p.id, capt.includes(p.id)));
  }

  mkMesh(team, gk, num, id, captain = false) {
    const m = (this.useRig ? buildRigged : buildPlayer)(this.kits[team], gk, num, id, this.blobMat, captain); m.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } }); m.userData.blob.visible = false; this.scene.add(m); return m;
  }

  /** Gol: la squadra che ha segnato esulta (solo i giocatori con scheletro); il marcatore un po' piu' a lungo. */
  celebrate(v, team, scorer) { this.meshes.forEach((m, i) => { const u = m.userData; if (u.rig && v.players[i]?.team === team && !v.players[i].gk) { u.celebT = i === scorer ? 4.5 : 3.2; u.scorer = i === scorer; } }); }

  /** Cambio: il giocatore id prende il numero inNum. Con instant = false l'uscente (copia con outNum) corre alla panchina sul lato lontano e l'entrante arriva di corsa dalla stessa zona; la simulazione ha gia' fatto il cambio, qui e' solo scena. */
  substitution(team, id, outNum, inNum, instant = false) {
    const old = this.meshes[id]; if (!old) return;
    const from = { x: old.position.x, z: old.position.z, ry: old.rotation.y }, was = outNum ?? this.nums[id] ?? id + 1;
    this.scene.remove(old); this.nums[id] = inNum ?? id + 1; this.meshes[id] = this.mkMesh(team, false, this.nums[id], id);
    if (instant) return;
    const spot = { x: (team === 0 ? -8 : 8) + ((id % 3) - 1) * 1.3, z: -(this.P.hz + 1.1) }, ghost = this.mkMesh(team, false, was, id);
    ghost.position.set(from.x, 0, from.z); ghost.rotation.y = from.ry;
    this.ghosts.push({ m: ghost, tx: spot.x, tz: spot.z, hold: 0, p: { x: from.x, z: from.z, vx: 0, vz: 0, face: -from.ry, gk: false, tackleT: 0, throwT: 0, pickT: 0, dribT: 0, dribDir: 0, stun: 0 } });
    this.entering.set(id, { t: 0, sx: spot.x, sz: spot.z });
  }

  /** Uscenti: trotto verso la panchina, poi fermi a guardare il campo per un paio di secondi e spariscono. */
  stepGhosts(dt) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i], p = g.p, dx = g.tx - p.x, dz = g.tz - p.z, d = Math.hypot(dx, dz);
      if (d > 0.5) { p.vx = dx / d * 4.4; p.vz = dz / d * 4.4; p.face = Math.atan2(dz, dx); if (dt > 0) { p.x += p.vx * dt; p.z += p.vz * dt; } }
      else { p.vx = p.vz = 0; p.face = Math.PI / 2; g.hold += dt; if (g.hold > 2.5) { this.scene.remove(g.m); this.ghosts.splice(i, 1); continue; } }
      g.m.position.set(p.x, 0, p.z); g.m.rotation.y = -p.face; this.animate(g.m, p, dt);
    }
  }

  /** Animazione procedurale (nessun dato di terzi): andatura camminata/corsa/scatto, conduzione, finta, tiro, colpo di testa, rimessa. */
  animate(m, p, dt, ctx = {}) {
    if (m.userData.rig) return animateRig(m, p, dt, ctx);
    const u = m.userData, sp = Math.hypot(p.vx, p.vz), b = u.body;
    const gait = clamp((sp - 2) / 5.5, 0, 1), dribbling = !!ctx.owns && sp > 1; // 0 = cammina, 1 = scatto
    const heading = sp > 1.5 ? Math.atan2(p.vz, p.vx) : u.heading;
    if (u.heading !== undefined && sp > 2.5 && dt > 0) { // cambio di direzione secco con la palla: finta
      const da = Math.atan2(Math.sin(heading - u.heading), Math.cos(heading - u.heading));
      if (ctx.owns && Math.abs(da) / dt > 3.2 && u.feintT <= 0) { u.feintT = 0.5; u.feintDir = Math.sign(da) || 1; }
    }
    if (p.dribT > 0.45 && u.feintT <= 0 && !u.fk) { u.feintT = 0.5; u.feintDir = p.dribDir || 1; } // finta decisa dalla simulazione
    u.heading = heading;
    const acc = dt > 0 ? (sp - u.prevSp) / dt : 0; u.prevSp = sp;
    u.accLean += (clamp(acc, -6, 8) * 0.018 - u.accLean) * Math.min(1, dt * 6);
    u.feintT = Math.max(0, u.feintT - dt); u.kickT = Math.max(0, u.kickT - dt); u.headT = Math.max(0, u.headT - dt);
    const wx = this.wx, snowy = wx.snowy, cadence = (0.7 + sp * 0.33) * (dribbling ? 1.2 : 1) * (snowy ? 0.88 : 1); // sulla neve passi piu' corti e lenti
    u.phase += dt * Math.PI * 2 * cadence;
    const s = Math.sin(u.phase), c = Math.cos(u.phase), sw = (0.22 + sp * 0.1) * (dribbling ? 0.75 : 1) * (snowy ? 0.8 : 1), bend = sw * (0.5 + gait * 1.4);
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
    if (wx.wet || snowy) { // terreno scivoloso: braccia piu' larghe in corsa, scivolone sulle frenate brusche
      u.slipCd = Math.max(0, (u.slipCd ?? 0) - dt);
      if (sp > 4 && acc < -5 && u.slipCd <= 0 && !(u.slipT > 0)) { u.slipCd = 2.5; if (Math.random() < (snowy ? 0.45 : 0.3)) { u.slipT = 0.6; u.slipDir = Math.random() < 0.5 ? -1 : 1; } }
      if (sp > 3) { a0.rotation.x += 0.16 * gait; a1.rotation.x -= 0.16 * gait; }
      if (wx.kind === 'storm' && sp > 1) lean -= 0.07; // sotto l'acquazzone si corre curvi
    }
    if (sp < 0.3 && !ctx.owns) { // gesti da fermo per il tempo che fa
      const t = (u.idleT + m.id * 0.37) % 8;
      if (wx.wet && t < 1) { const w = Math.sin(Math.PI * t); a1.rotation.z = 2.5 * w; a1.rotation.x = -0.55 * w; } // si asciuga la fronte con la mano
      else if (wx.cold) { a0.rotation.z = a1.rotation.z = 0.85; a0.rotation.x = -0.55; a1.rotation.x = 0.55; drop += Math.abs(Math.sin(u.idleT * 7)) * 0.025; } // braccia strette al petto, saltella sul posto per scaldarsi
    }
    if (u.slipT > 0) { // scivolone: un piede parte, braccia larghe per l'equilibrio, busto che ondeggia di lato
      u.slipT -= dt; const q = 1 - Math.max(0, u.slipT) / 0.6, w = Math.sin(Math.PI * q);
      l0.hip.rotation.z += 0.75 * w; l0.knee.rotation.z *= 1 - w; l1.knee.rotation.z -= 0.45 * w;
      a0.rotation.x = 1.15 * w; a1.rotation.x = -1.15 * w; a0.rotation.z = a1.rotation.z = 0.5 * w;
      b.rotation.x = u.slipDir * 0.28 * w * Math.cos(q * 9); lean += 0.3 * w; drop += 0.1 * w;
    }
    if (ctx.wall) { // in barriera: gambe strette, mani incrociate davanti al corpo; sul calcio salto a gambe unite
      for (const l of u.legs) { l.hip.rotation.z = 0.04; l.knee.rotation.z = -0.06; }
      a0.rotation.z = a1.rotation.z = 0.55; a0.rotation.x = -0.75; a1.rotation.x = 0.75; lean = 0.02; drop = 0;
      if (ctx.wall.kicked && ctx.wall.t < 0.55) { const q = ctx.wall.t / 0.55, j = Math.sin(Math.PI * q); drop = 0.42 * j; for (const l of u.legs) l.knee.rotation.z = -0.5 * j; lean = 0.05 * j; }
    }
    if (dribbling) { const k = Math.max(0, c); l1.hip.rotation.z += k * 0.35; l1.knee.rotation.z *= 0.5; a0.rotation.x = -0.3; a1.rotation.x = 0.3; } // tocchi corti: il piede accompagna la palla
    if (u.feintT > 0) { // finta con passo sopra la palla e peso sul lato opposto
      const q = 1 - u.feintT / 0.5, w = Math.sin(Math.PI * q), d = u.feintDir, over = d > 0 ? l0 : l1;
      b.rotation.x = d * 0.4 * w; b.rotation.y += d * 0.35 * w; drop += 0.07 * w; lean = lean * 0.5 - 0.1 * w;
      over.hip.rotation.z = 0.95 * w; over.knee.rotation.z = -0.6 * w; over.hip.rotation.x = d * 0.55 * Math.sin(Math.PI * q);
    }
    if (u.fk) { // finta del duello 1v1 (vedi duel): body feint, doppio passo, croqueta, veronica
      const f = u.fk; f.t += dt; const q = clamp(f.t / f.dur, 0, 1), w = Math.sin(Math.PI * q), d = f.dir, over = d > 0 ? l0 : l1, other = d > 0 ? l1 : l0;
      if (f.type === 'body') { // spalla e passo falso da un lato, poi via dall'altro
        const a = q < 0.45 ? Math.sin(Math.PI * q / 0.45) : 0, z = q >= 0.45 ? Math.sin(Math.PI * (q - 0.45) / 0.55) : 0;
        b.rotation.x = d * (-0.55 * a + 0.3 * z); other.hip.rotation.x = -d * 0.45 * a; drop += 0.08 * w; lean -= 0.12 * z;
      } else if (f.type === 'stepover') { // la gamba gira attorno al pallone
        over.hip.rotation.z = 0.9 * w; over.hip.rotation.x = d * 0.7 * Math.sin(2 * Math.PI * q); over.knee.rotation.z = -0.7 * w; b.rotation.x = -d * 0.35 * w; drop += 0.06 * w;
      } else if (f.type === 'croqueta') { // interno-interno: la palla passa da un piede all'altro
        (q < 0.5 ? other : over).hip.rotation.x = (q < 0.5 ? -d : d) * 0.4 * w; l0.knee.rotation.z = l1.knee.rotation.z = -0.35 * w; drop += 0.1 * w; lean -= 0.1 * w;
      } else { // veronica: giro completo sopra il pallone
        m.rotation.y -= d * 2 * Math.PI * q * q * (3 - 2 * q); a0.rotation.x = -0.8 * w; a1.rotation.x = 0.8 * w; drop += 0.05 * w; lean += 0.1 * w;
      }
      if (!f.ok && q > 0.55) { lean += 0.25 * Math.sin(Math.PI * (q - 0.55) / 0.45); b.rotation.x -= d * 0.3 * Math.sin(Math.PI * (q - 0.55) / 0.45); } // contrasto perso: spinto via
      if (!f.puff && q > 0.5) { f.puff = true; this.rubber(m.position.x, m.position.z); }
      if (q >= 1) u.fk = null;
    }
    if (u.react) { // difensore nel duello: saltato (sbilanciato, affondo in ritardo) oppure contrasto vinto (affondo deciso)
      const r = u.react; r.t += dt; const q = clamp(r.t / r.dur, 0, 1), w = Math.sin(Math.PI * q), d = r.dir;
      if (r.ok) {
        const lunge = q > 0.25 && q < 0.75 ? Math.sin(Math.PI * (q - 0.25) / 0.5) : 0, leg = d > 0 ? l1 : l0;
        b.rotation.x = d * 0.45 * w; drop += 0.12 * w; leg.hip.rotation.x = d * 0.6 * lunge; leg.hip.rotation.z = 0.7 * lunge; lean = -0.15 * w;
      } else { l1.hip.rotation.z = 1.2 * w; l1.knee.rotation.z = -0.15 * w; lean = -0.4 * w; drop += 0.14 * w; a0.rotation.z = 0.6 * w; }
      if (q >= 1) u.react = null;
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
    if (u.recvT > 0) { // primo controllo: il piede va incontro alla palla e la ammortizza
      u.recvT = Math.max(0, u.recvT - dt); const w = Math.sin(Math.PI * u.recvT / 0.18), l = p.foot === 'SX' ? l0 : l1;
      l.hip.rotation.z += 0.55 * w; l.knee.rotation.z -= 0.35 * w; lean -= 0.06 * w;
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
        const fwd = p.vx * Math.cos(p.face) + p.vz * Math.sin(p.face), lat = -p.vx * Math.sin(p.face) + p.vz * Math.cos(p.face);
        if (!ctx.owns && sp > 0.3 && Math.abs(lat) > Math.abs(fwd)) { // passo laterale: le gambe si aprono e si chiudono a ogni passo, piccolo saltello; niente passo in avanti
          const a = clamp(sp / 2.5, 0.3, 1), st = Math.abs(Math.sin(u.phase * 0.8)), open = (0.08 + 0.32 * st) * a;
          l0.hip.rotation.x = open; l1.hip.rotation.x = -open; l0.hip.rotation.z *= 0.4; l1.hip.rotation.z *= 0.4;
          l0.knee.rotation.z = Math.min(l0.knee.rotation.z, -0.35); l1.knee.rotation.z = Math.min(l1.knee.rotation.z, -0.35);
          drop += st * 0.04 * a; b.rotation.x = -Math.sign(lat) * 0.06 * a; // si inclina appena verso dove va
        }
      }
    }
    if (u.pokeT > 0) { u.pokeT -= dt; const w = Math.sin(Math.PI * (1 - u.pokeT / 0.35)); l1.hip.rotation.z = -0.9 * w; l1.knee.rotation.z = 0; l0.knee.rotation.z = -0.4 * w; lean = 0.15 * w; drop = 0.1 * w; } // contrasto in piedi: gamba tesa sulla palla
    if (u.slideT > 0) { // scivolata: entra di lato a terra, gamba tesa avanti, poi si rialza
      u.slideT -= dt; const q = 1 - Math.max(0, u.slideT) / 0.7, w = Math.min(1, q * 5, (1 - q) * 3.5);
      b.rotation.z = -1.15 * w; b.position.y = -0.35 * w; b.rotation.x = 0; l0.hip.rotation.z = 1.3 * w; l0.knee.rotation.z = 0; l1.hip.rotation.z = 0.4 * w; l1.knee.rotation.z = -1 * w; a0.rotation.x = 0.8 * w; a1.rotation.x = -0.4 * w;
    }
    else if (p.tackleT > 0) { b.rotation.z = -1.15; b.position.y = -0.35; b.rotation.x = 0; } // scivolata
    else { b.rotation.z += (lean - b.rotation.z) * Math.min(1, dt * 14); b.position.y = drop; }
    u.look += ((p.tackleT > 0 || u.diveT > 0 ? 0 : ctx.look ?? 0) - u.look) * Math.min(1, dt * 6); // la testa si stabilizza contro rollio e rimbalzo del busto e segue la palla
    const hy = -b.position.y * 0.5, hp = -b.rotation.z * 0.55;
    u.head.position.y = 1.7 + hy; u.hr.position.y = 1.72 + hy; u.neck.position.y = 1.56 + hy * 0.5;
    u.head.rotation.set(0, u.look, hp); u.hr.rotation.set(0, u.look, 0.25 + hp);
    if (p.stun > 0) b.rotation.x = Math.sin(u.phase * 2) * 0.15;
  }

  /**
   * Duello 1v1 deciso dalla simulazione (evento 'dribble', esito in e.ok): sceglie la finta dell'attaccante dallo spazio e dal Dribbling
   * e la reazione del difensore piu' vicino davanti. Solo scena: l'esito e gli spostamenti restano quelli della simulazione.
   */
  duel(v, e) {
    const p = v.players[e.player], m = this.meshes[e.player]; if (!p || !m) return;
    let q = null, dq = 4; for (const o of v.players) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (o.team !== p.team && !o.gk && !o.out && d < dq) { dq = d; q = o; } }
    const skill = p.attr?.Dribbling ?? 13, r = Math.random(), dir = p.dribDir || 1;
    const type = dq < 1.3 && r < 0.5 ? 'croqueta' : skill >= 15 && r < 0.3 ? 'roulette' : skill >= 12 && r < 0.65 ? 'stepover' : 'body';
    m.userData.fk = { type, t: 0, dur: type === 'roulette' ? 0.45 : type === 'croqueta' ? 0.3 : 0.4, dir, ok: e.ok }; m.userData.feintT = 0;
    if (q) this.meshes[q.id].userData.react = { t: 0, dur: e.ok ? 0.9 : 0.5, dir, ok: e.ok };
    this.onDribble?.(type); return type;
  }

  /** Contrasto deciso dalla simulazione: in corsa, da lontano o da dietro e' una scivolata, altrimenti un intervento in piedi col piede teso. Solo scena. */
  tackle(v, e) {
    const q = v.players[e.player], o = v.players[e.victim], u = this.meshes[e.player]?.userData; if (!q || !o || !u) return;
    const d = Math.hypot(o.x - q.x, o.z - q.z), behind = Math.cos(o.face) * (q.x - o.x) + Math.sin(o.face) * (q.z - o.z) < 0;
    u.slideT = Math.hypot(q.vx, q.vz) > 3.5 || d > 0.9 || behind || Math.random() < (this.wx.wet || this.wx.snowy ? 0.6 : 0.35) ? 0.7 : 0;
    if (!u.slideT) u.pokeT = 0.35;
  }

  /** Gommino nero dell'erba sintetica sollevato sul cambio di direzione. */
  rubber(x, z) {
    if (this.surface !== 'synthetic') { for (let i = 0; i < 4; i++) this.fx.emit(x, 0.06, z, rnd(-0.6, 0.6), rnd(0.2, 0.6), rnd(-0.6, 0.6), { life: rnd(0.4, 0.7), size: 0.22, grow: 2.5, color: this.surface === 'dirt' ? 0xb08a62 : 0x5a7a3e, alpha: 0.35, drag: 2 }); return; } // terra: polvere; erba: zolle d'erba
    for (let i = 0; i < 9; i++) { const a = rnd(0, 6.28), s = rnd(0.5, 1.6); this.fx.emit(x + rnd(-0.15, 0.15), 0.05, z + rnd(-0.15, 0.15), Math.cos(a) * s, rnd(1, 2.4), Math.sin(a) * s, { life: rnd(0.35, 0.6), size: rnd(0.05, 0.08), color: 0x161616, alpha: 0.95, grav: 14, drag: 0.4 }); }
  }

  /**
   * Palla al piede, solo grafica: la simulazione la tiene a distanza fissa davanti al portatore; qui riceve un tocco a ogni ciclo del passo
   * (si stacca e viene ripresa: corta camminando o col dribbling alto, lunga in sprint), alterna destro e sinistro, e davanti a un avversario
   * da fermo resta sul piede forte con il corpo di profilo. Al primo controllo la palla arriva da dove era e viene ammortizzata (~0,18 s).
   * Restituisce la posizione da disegnare; la palla della simulazione non cambia.
   */
  dribbleBall(v, dt) {
    const b = v.ball, o = b.owner >= 0 ? v.players[b.owner] : null, d = this.dv ??= { x: 0, z: 0, recv: 0, hop: 0, owner: -1 };
    const carry = o && !o.gk && !o.out && !(o.throwT > 0) && b.y < 0.5 && this.meshes[o.id];
    let tx = 0, tz = 0, prof = 0;
    if (carry) {
      const u = this.meshes[o.id].userData, sp = Math.hypot(o.vx, o.vz), fx = Math.cos(o.face), fz = Math.sin(o.face), rx = -fz, rz = fx;
      if (d.owner !== o.id) { // primo controllo: continuita' dalla palla disegnata, piede incontro, rimbalzo se arriva forte o alta
        const pb = this.pb, fast = pb && (Math.hypot(pb.vx, pb.vz) > 11 || pb.y > 0.4);
        d.x = this.ball.position.x - b.x; d.z = this.ball.position.z - b.z; d.recv = 0.18; d.hop = fast ? 0.16 : 0; u.recvT = 0.18;
        if (Math.hypot(d.x, d.z) > 2.5) d.x = d.z = 0; // salto lungo (rimessa, primo fotogramma): niente scivolata
      }
      const skill = clamp(((o.attr?.Dribbling ?? 13) - 10) / 10, -0.5, 1), s = ((u.phase / (2 * Math.PI)) % 1 + 1) % 1, foot = o.foot === 'SX' ? -1 : 1;
      let near = 99; for (const q of v.players) if (q.team !== o.team && !q.out) near = Math.min(near, Math.hypot(q.x - o.x, q.z - o.z));
      if (sp < 2 && near < 3.2) { // puntare l'uomo: palla sotto la suola del piede forte, busto di profilo
        tx = -0.12 * fx + 0.14 * foot * rx; tz = -0.12 * fz + 0.14 * foot * rz; prof = 0.55 * foot;
      } else {
        const L = clamp((sp - 1) / 7, 0, 1) * (0.75 - 0.3 * skill), along = L * (Math.sin(Math.PI * s) - 0.35), lat = 0.07 * Math.cos(u.phase / 2) * clamp(sp / 3, 0, 1);
        tx = along * fx + lat * rx; tz = along * fz + lat * rz;
      }
      if (u.fk?.type === 'croqueta') { const c = 0.22 * u.fk.dir * -Math.cos(Math.PI * clamp(u.fk.t / u.fk.dur, 0, 1)); tx += c * rx; tz += c * rz; } // la palla passa da un piede all'altro
    }
    d.owner = carry ? o.id : -1;
    const k = Math.min(1, dt * (d.recv > 0 ? 1 / 0.18 : carry ? 14 : 12)); d.x += (tx - d.x) * k; d.z += (tz - d.z) * k;
    let hy = 0; if (d.recv > 0) { d.recv = Math.max(0, d.recv - dt); hy = d.hop * Math.sin(Math.PI * (1 - d.recv / 0.18)); }
    for (const m of this.meshes) { const u = m.userData, t = carry && m === this.meshes[o.id] ? prof : 0; u.prof = (u.prof ?? 0) + (t - (u.prof ?? 0)) * Math.min(1, dt * 8); if (Math.abs(u.prof) > 0.002) m.rotation.y -= u.prof; }
    return { x: b.x + d.x, y: b.y + hy, z: b.z + d.z };
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
    const c = this.cutK, sp = Math.hypot(b.vx, b.vz);
    if (c) {
      if (c.kind === 'fondo' && sp > 10 && !c.kicked) { c.kicked = true; c.t = Math.min(c.t, 1.6); } // tiro partito: si resta sul volo della palla, poi si torna
      if ((c.t -= dt) <= 0) { this.cutK = null; this.snap = true; }
    }
    const mode = this.cutK?.kind === 'fondo' ? 'fondo' : this.mode, cp = this.cutK?.kind === 'player' ? v.players[this.cutK.id] : null;
    this.shotZ = (this.shotZ ?? 0) + ((owner == null && sp > 12 && Math.sign(b.vx) === Math.sign(b.x) && P.hx - Math.abs(b.x) < 30 ? 1 : 0) - (this.shotZ ?? 0)) * Math.min(1, dt * 3); // tiro in volo verso la porta vicina: la camera TV stringe
    if (cp) { // primo piano: camera a 1,7 m, 5 m davanti al giocatore sul lato della tribuna principale, teleobiettivo sul busto
      const ang = Math.PI / 2 + Math.sin(this.clock * 0.4) * 0.25;
      pos.set(cp.x + Math.cos(ang) * 5, 1.7, cp.z + Math.sin(ang) * 5); look.set(cp.x, 1.35, cp.z); fov = aspect < 0.9 ? 40 : 24;
    } else if (mode === 'tattica') { // drone: vista alta inclinata sull'intero campo; in verticale la lunghezza del campo sale lungo lo schermo
      const port = aspect < 0.9, el = THREE.MathUtils.degToRad(58), t = Math.tan(THREE.MathUtils.degToRad(fov = port ? 55 : 38) / 2);
      const W = (port ? P.hz : P.hx) + 3, H = ((port ? P.hx : P.hz) + 3) * Math.sin(el) + 1, D = Math.max(W / (t * aspect), H / t) * 1.03, cx = port ? 0 : clamp(b.x * 0.12, -3, 3);
      look.set(cx, 0, 0); pos.set(cx - (port ? D * Math.cos(el) : 0), D * Math.sin(el), port ? 0 : D * Math.cos(el));
    } else if (mode === 'fondo') { // asse lungo del campo, dietro la porta di chi attacca: tutta l'azione verso la porta avversaria (rigori, punizioni)
      const d = this.camDir, u = clamp(b.x, -P.hx, P.hx) * d, pu = Math.max(0.5 * u - (0.9 * P.hx + 10), -(P.hx + 4.5)), lu = clamp(u * 0.7 + 8, -P.hx * 0.6, P.hx);
      fov = aspect < 0.9 ? 66 : 36; pos.set(d * pu, 10.5, b.z * 0.35); look.set(d * lu, 0.4, b.z * 0.55);
    } else if (mode === 'replay' && this.rangle === 1) { // replay alto dalla tribuna opposta, largo: si legge tutta l'azione
      const bx = clamp(b.x, -P.hx, P.hx); pos.set(bx * 0.6, 16, -(P.hz + 14)); look.set(bx * 0.8, 0, b.z * 0.5); fov = aspect < 1 ? 60 : 34;
    } else if (mode === 'replay' && this.rangle === 2) { // super slow: segue la palla a bordo campo, ad altezza d'uomo
      const bx = clamp(b.x, -P.hx, P.hx); pos.set(bx - this.rdir * 7, 1.6, this.rside * (P.hz + 2)); look.set(bx, Math.max(0.6, b.y), b.z); fov = aspect < 1 ? 52 : 30;
    } else if (mode === 'replay') { // replay: angolo inverso dietro la linea di porta, basso, con zoom da teleobiettivo sulla palla (la rete resta di lato, non davanti)
      const sx = this.rdir, bx = clamp(b.x, -P.hx, P.hx);
      pos.set(sx * (P.hx + 3.6), 2, this.rside * 7); look.set(bx * 0.9 + sx * P.hx * 0.1, Math.max(0.5, b.y * 0.8), b.z * 0.8);
      fov = clamp(2 * Math.atan(4.5 / Math.max(5, pos.distanceTo(look))) * 180 / Math.PI, 12, 50) * (aspect < 1 ? 1.5 : 1);
    } else {
      const port = aspect < 0.9; // telefono in verticale: inquadratura piu' dall'alto, cosi' il campo riempie lo schermo invece delle tribune
      const ze = this.zoom * this.zoom * (3 - 2 * this.zoom), lead = clamp(this.cv.x * 0.7, -8, 8); // ze: 0 a centrocampo, 1 sulla linea di porta
      const dist = Math.max(port ? 16 : 22, P.hz * (port ? 1.5 : 2.1)) * (1 - 0.14 * ze), hgt = Math.max(12, P.hz * (port ? 2 : 1.15)) * (1 - 0.12 * ze), k = P.hx * (port ? 0.1 : 0.22) * (1 - 0.4 * ze); // piu' vicina e piu' bassa verso la porta
      fov = clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50) / 2) / aspect) * 180 / Math.PI, 24, 64) * (1 - 0.24 * ze) * (1 - 0.12 * this.shotZ); // zoom negli ultimi metri dell'area
      pos.set(clamp(b.x + lead * 0.4, -P.hx + k, P.hx - k), hgt, b.z * 0.3 + dist); look.set(pos.x + lead * 0.3, 0, b.z * 0.45 - 1); // anticipa leggermente la direzione del gioco
    }
    const k = this.snap ? 1 : 1 - Math.exp(-(this.blend < 1 ? 2.2 : 3.2) * dt);
    this.blend = Math.min(1, (this.blend ?? 1) + dt * 1.2); this.snap = false;
    const kt = mode === 'replay' || cp ? Math.max(k, 1 - Math.exp(-12 * dt)) : k; // il replay insegue la palla da vicino: niente ritardo con fov stretto
    this.camPos.lerp(pos, k); this.camLook.lerp(look, kt);
    this.cam.fov += (fov - this.cam.fov) * kt; this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.camPos);
    if (this.shake > 0.002) { // tremolio breve (palo o traversa): ampiezza quadratica che si spegne in ~0,4 s; fermo in pausa
      const a = this.shake * this.shake * 0.4, c = this.clock; this.cam.position.x += Math.sin(c * 83) * a; this.cam.position.y += Math.sin(c * 97 + 1) * a; this.cam.position.z += Math.sin(c * 71 + 2) * a;
      this.shake *= Math.exp(-8 * dt);
    } else this.shake = 0;
    this.cam.lookAt(this.camLook);
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

  /** Palo o traversa colpiti: scintille, tremolio della camera e (per l'app) il suono metallico. */
  woodwork(x, y, z, power, bar) {
    for (let i = 0; i < 10; i++) this.fx.emit(x, y, z, rnd(-2.5, 2.5) * (0.4 + power), rnd(-1.5, 2.5), rnd(-2.5, 2.5) * (0.4 + power), { life: rnd(0.25, 0.5), size: rnd(0.05, 0.09), color: 0xfff4c8, alpha: 1, grav: 9, drag: 0.5 });
    this.shake = Math.max(this.shake, 0.35 + 0.65 * power); this.onWood?.(power, bar);
  }

  /** Effetti del meteo: gocce e schizzi (pioggia, pozze), polvere di neve, fiato che si condensa al freddo. */
  wxStep(v, dt) {
    const wx = this.wx; wx.step(dt); if (dt <= 0) return;
    const b = v.ball, bs = Math.hypot(b.vx, b.vz), grd = b.y < 0.2, inP = grd && wx.inPuddle(b.x, b.z);
    if (inP && !this.ballWet && bs > 1) this.splash(b.x, b.z, Math.min(1, bs / 12), b.vx, b.vz); // palla che entra in una pozza
    this.ballWet = inP;
    if (grd && bs > 3 && Math.random() < dt * 30) { // scia dietro la palla che rotola: spruzzi d'acqua o neve sollevata
      const k = -0.25, o = wx.wet ? { life: rnd(0.3, 0.5), size: rnd(0.04, 0.07), color: 0xd6e2ea, alpha: 0.8, grav: 9, drag: 0.6 } : wx.snowy ? { life: rnd(0.5, 0.8), size: rnd(0.12, 0.2), grow: 2, color: 0xffffff, alpha: 0.55, grav: 1, drag: 2 } : null;
      if (o) this.fx.emit(b.x, 0.08, b.z, b.vx * k + rnd(-0.6, 0.6), rnd(0.6, 1.8), b.vz * k + rnd(-0.6, 0.6), o);
    }
    for (const p of v.players) {
      if (p.out) continue;
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 4 && Math.random() < dt * 5) {
        if (wx.wet && wx.inPuddle(p.x, p.z)) this.splash(p.x, p.z, 0.5, p.vx, p.vz); // corsa dentro la pozza
        else if (wx.wet) this.fx.emit(p.x, 0.05, p.z, -p.vx * 0.1 + rnd(-0.4, 0.4), rnd(0.8, 1.6), -p.vz * 0.1 + rnd(-0.4, 0.4), { life: 0.35, size: 0.05, color: 0xd6e2ea, alpha: 0.75, grav: 9, drag: 0.6 });
        else if (wx.snowy) this.fx.emit(p.x, 0.06, p.z, -p.vx * 0.1, rnd(0.2, 0.6), -p.vz * 0.1, { life: rnd(0.6, 0.9), size: 0.25, grow: 2.2, color: 0xffffff, alpha: 0.45, drag: 2 });
      }
      if (wx.cold && Math.random() < dt * (0.5 + sp * 0.12)) { // fiato: piu' frequente quando si corre
        const f = p.face; this.fx.emit(p.x + Math.cos(f) * 0.25, 1.66, p.z + Math.sin(f) * 0.25, Math.cos(f) * 0.5 + p.vx * 0.5, 0.15, Math.sin(f) * 0.5 + p.vz * 0.5, { life: rnd(0.6, 0.9), size: 0.12, grow: 3, color: 0xf2f5f8, alpha: 0.3, drag: 2.5 });
      }
    }
  }

  /** Schizzo d'acqua da pozza (power 0..1), spinto nella direzione del moto. */
  splash(x, z, power, vx, vz) {
    for (let i = 0; i < 6 + power * 12; i++) { const a = rnd(0, 6.28), s = rnd(0.5, 1.5 + power * 2); this.fx.emit(x, 0.05, z, Math.cos(a) * s + vx * 0.2, rnd(1.5, 2.5 + power * 2.5), Math.sin(a) * s + vz * 0.2, { life: rnd(0.4, 0.7), size: rnd(0.05, 0.09), color: 0xcfdbe4, alpha: 0.85, grav: 11, drag: 0.4 }); }
  }

  /** Effetti legati agli eventi di gioco: rimbalzi, tiri forti, gol, scivolate. dt = 0 (pausa) non emette nulla. */
  fxStep(v, dt) {
    const b = v.ball, pb = this.pb, P = this.P;
    if (dt > 0 && pb && Math.hypot(pb.x - b.x, pb.z - b.z) < 3) {
      if (pb.vy < -2.5 && b.vy >= 0 && b.y < 0.4) this.puff(b.x, b.z, Math.min(1, -pb.vy / 9));
      if (Math.abs(pb.x) <= P.hx && Math.abs(b.x) > P.hx) { // passaggio sulla linea di porta: la fisica non ha urti con i legni, qui si vede e si sente solo se la palla passa a un raggio da palo o traversa
        const s = Math.hypot(b.vx, b.vz), f = (P.hx - Math.abs(pb.x)) / (Math.abs(b.x) - Math.abs(pb.x)), zc = pb.z + (b.z - pb.z) * f, yc = pb.y + (b.y - pb.y) * f;
        if (Math.abs(b.z) < P.goalHalf + 0.3 && b.y < P.goalH + 0.3 && s > 4) { this.netBurst(b); this.onNet?.(Math.min(1, s / 28)); }
        const post = Math.abs(Math.abs(zc) - P.goalHalf) < 0.2 && yc < P.goalH + 0.1, bar = Math.abs(yc - P.goalH) < 0.2 && Math.abs(zc) < P.goalHalf + 0.1;
        if ((post || bar) && s > 6) this.woodwork(Math.sign(b.x) * P.hx, yc, zc, Math.min(1, s / 28), !post);
      }
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
    if (this.rebuild || this.meshes.length !== v.players.length) { this.rebuild = false; this.build(v.players); }
    const bo = v.ball.owner, from = this.prevOwner;
    if (from >= 0 && bo < 0 && v.players[from] && !(v.players[from].throwT > 0)) { // palla appena lasciata dal giocatore: tiro o passaggio
      const sp = Math.hypot(v.ball.vx, v.ball.vz), u = this.meshes[from]?.userData;
      if (u && sp > 3) { u.kickT = 0.3; u.kickLeft = (from + Math.round(sp)) % 3 === 0; u.kickPow = clamp(sp / 22, 0.2, 1); u.kickLoft = v.ball.vy > 2; }
    }
    this.prevOwner = bo;
    stepFlags(this.flags, v, dt);
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
      const ent = this.entering.get(i);
      if (ent) { // subentrato: arriva di corsa dalla panchina al suo posto in ~2,4 s (partenza e arrivo dolci)
        ent.t += dt; const k = clamp(ent.t / 2.4, 0, 1), e = k * k * (3 - 2 * k), dx = p.x - ent.sx, dz = p.z - ent.sz, d = Math.hypot(dx, dz) || 1, sp = Math.min(6, d * 6 * k * (1 - k) / 2.4);
        if (k >= 1) this.entering.delete(i);
        const q = { ...p, x: ent.sx + dx * e, z: ent.sz + dz * e, vx: dx / d * sp, vz: dz / d * sp, face: Math.atan2(dz, dx) };
        m.position.set(q.x, 0, q.z); m.rotation.y = -q.face; this.animate(m, q, dt);
        return;
      }
      m.position.set(p.x, 0, p.z); m.rotation.y = -p.face;
      this.animate(m, p, dt, { owns: v.ball.owner === p.id, alert: p.gk && bd < 30 && opp, near: clamp((24 - bd) / 18, 0, 1), rush: p.gk && bd < 9 && v.ball.owner < 0 && Math.hypot(p.vx, p.vz) > 3.5, look, wall: v.wall?.ids.includes(p.id) ? v.wall : null });
    });
    this.stepGhosts(dt); this.board.update(this.boardData, v);
    const b = v.ball, sp = Math.hypot(b.vx, b.vz), vb = this.dribbleBall(v, dt);
    this.ball.position.set(vb.x, Math.max(0.13, vb.y + 0.02), vb.z);
    const roll = this.spin; // velocita' angolare (rad/s): a terra rotola senza slittare, in volo gira ancora e rallenta
    if (b.y < 0.06 || b.owner >= 0) roll.set(b.vz, 0, -b.vx).multiplyScalar(1 / 0.13);
    else { roll.multiplyScalar(Math.exp(-0.35 * dt)); if (roll.lengthSq() < 36 && sp > 3) roll.set(b.vz, 0, -b.vx).multiplyScalar(0.5 / 0.13); }
    const w = roll.length(); if (w > 45) roll.multiplyScalar(45 / w); // oltre ~7 giri/s a 60 Hz l'occhio vede girare al contrario
    if (dt > 0 && w > 0.01) this.ball.rotateOnWorldAxis(_ax.copy(roll).normalize(), Math.min(w, 45) * dt);
    this.clock += dt; this.fxStep(v, dt); this.wxStep(v, dt);
    for (const g of this.goals) for (const n of g.userData.nets) n.update(dt);
    this.ballBlob.position.set(vb.x + b.y * 0.25, 0.011, vb.z - b.y * 0.15); this.ballBlob.scale.setScalar(clamp(0.45 - b.y * 0.05, 0.15, 0.45));
    const owner = b.owner >= 0 ? v.players[b.owner] : null;
    this.marker.visible = this.showMarker && !!owner && !owner.out;
    if (owner) {
      this.marker.position.set(owner.x, 0.02, owner.z);
      this.arrow.visible = this.marker.visible; this.arrow.position.set(owner.x + Math.cos(owner.face) * 1.1, 0.025, owner.z + Math.sin(owner.face) * 1.1); this.arrow.rotation.z = -owner.face + 0; // l'asse x locale della freccia va in avanti
      const txt = this.label?.(owner.id);
      this.tag.visible = !!txt && this.marker.visible;
      if (txt) { const map = nameTag(txt); if (this.tag.material.map !== map) { this.tag.material.map = map; this.tag.material.needsUpdate = true; } this.tag.position.set(owner.x, 2.5, owner.z); } // needsUpdate solo se cambia la texture: ogni frame ricalcolerebbe il programma
    } else { this.arrow.visible = false; this.tag.visible = false; }
    this.updateCamera(v, dt);
    this.trail.update(b, this.cam.position, dt, this.clock); this.fx.update(dt, this.r.domElement.height * 0.5 * this.cam.projectionMatrix.elements[5]);
    if (this.gov.tick(performance.now())) this.r.setPixelRatio(this.dpr * this.gov.scale); // risoluzione dinamica
    this.grass?.step(dt);
    this.r.info.reset(); // conta tutti i passaggi del frame (autoReset spento)
    if (this.post) this.post.render(this.scene, this.cam); else this.r.render(this.scene, this.cam);
  }

  /** Misure per il pannello prestazioni. */
  stats() { const i = this.r.info.render; return { fps: this.gov.fps, ms: this.gov.ema, calls: i.calls, tris: i.triangles, scale: this.gov.scale, quality: this.Q.name }; }

  dispose() { this.post?.dispose(); this.r.dispose(); }
}

