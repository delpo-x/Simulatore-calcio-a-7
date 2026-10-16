import * as THREE from '../vendor/three.module.min.js';
import { PITCH } from './sim.js';

const TEAM_COLORS = [0xd8372f, 0x2f6fd8];

function pitchTexture() {
  const c = document.createElement('canvas'); c.width = 1050; c.height = 680;
  const g = c.getContext('2d'), s = 10; // 10 px per metre
  for (let i = 0; i < 21; i++) { g.fillStyle = i % 2 ? '#2f8f3a' : '#2a8434'; g.fillRect(i * 50, 0, 50, 680); }
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  const R = (x, z, w, h) => g.strokeRect(525 + x * s, 340 + z * s, w * s, h * s);
  R(-52.5, -34, 105, 68);
  g.beginPath(); g.moveTo(525, 0); g.lineTo(525, 680); g.stroke();
  g.beginPath(); g.arc(525, 340, 9.15 * s, 0, 7); g.stroke();
  for (const d of [-1, 1]) {
    R(d < 0 ? -52.5 : 52.5 - 16.5, -20.16, 16.5, 40.32);
    R(d < 0 ? -52.5 : 52.5 - 5.5, -9.16, 5.5, 18.32);
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function goal(dir) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff }), grp = new THREE.Group();
  const post = (z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PITCH.goalH, 8), m); p.position.set(0, PITCH.goalH / 2, z); return p; };
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PITCH.goalHalf * 2, 8), m);
  bar.rotation.x = Math.PI / 2; bar.position.y = PITCH.goalH;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(2.4, PITCH.goalHalf * 2, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  net.rotation.y = Math.PI / 2; net.position.set(dir * 1.2, 1.2, 0); net.scale.y = 1;
  grp.add(post(-PITCH.goalHalf), post(PITCH.goalHalf), bar, net);
  grp.position.x = dir * PITCH.hx;
  return grp;
}

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.setScale(Number(settings.scale) || 1);
    r.shadowMap.enabled = true;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b8e8); scene.fog = new THREE.Fog(0x87b8e8, 90, 220);
    this.cam = new THREE.PerspectiveCamera(38, canvas.width / canvas.height, 0.5, 400);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3b6b3b, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(30, 60, 20); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 });
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 1 }));
    pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshStandardMaterial({ color: 0x24692d }));
    out.rotation.x = -Math.PI / 2; out.position.y = -0.02; scene.add(out);
    scene.add(goal(1), goal(-1));

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    this.ball.castShadow = true; scene.add(this.ball);

    this.meshes = [];
    this.focus = new THREE.Vector3();
    this.build = false;
  }

  setScale(s) { this.r.setPixelRatio(1); this.r.setSize(480 * s, 272 * s, false); }

  buildPlayers(players) {
    const bodyG = new THREE.CapsuleGeometry(0.3, 0.9, 4, 10), headG = new THREE.SphereGeometry(0.17, 12, 10), nose = new THREE.ConeGeometry(0.08, 0.3, 8);
    for (const p of players) {
      const color = p.gk ? 0x38c24a : TEAM_COLORS[p.team];
      const grp = new THREE.Group();
      const body = new THREE.Mesh(bodyG, new THREE.MeshStandardMaterial({ color })); body.position.y = 0.85; body.castShadow = true;
      const head = new THREE.Mesh(headG, new THREE.MeshStandardMaterial({ color: 0xe0b48a })); head.position.y = 1.62; head.castShadow = true;
      const dirMark = new THREE.Mesh(nose, new THREE.MeshStandardMaterial({ color: 0xffffff })); dirMark.rotation.z = -Math.PI / 2; dirMark.position.set(0.3, 1.0, 0);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xffff40, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
      grp.add(body, head, dirMark, ring); grp.userData.ring = ring; grp.userData.body = body;
      this.scene.add(grp); this.meshes.push(grp);
    }
  }

  draw(sim, activeIds, dt) {
    if (!this.meshes.length) this.buildPlayers(sim.players);
    sim.players.forEach((p, i) => {
      const m = this.meshes[i];
      m.position.set(p.x, 0, p.z); m.rotation.y = -p.face;
      m.userData.ring.visible = activeIds.includes(p.id);
      m.userData.body.rotation.z = p.tackleT > 0 ? -0.9 : Math.min(0.25, Math.hypot(p.vx, p.vz) * 0.03);
      m.userData.body.position.y = p.tackleT > 0 ? 0.5 : 0.85;
    });
    const b = sim.ball; this.ball.position.set(b.x, b.y, b.z);
    // broadcast-style camera: side view following the ball, damped
    const k = 1 - Math.exp(-3 * dt);
    this.focus.x += (clamp(b.x, -38, 38) - this.focus.x) * k;
    this.focus.z += (b.z * 0.4 - this.focus.z) * k;
    this.cam.position.set(this.focus.x, 24, this.focus.z + 42);
    this.cam.lookAt(this.focus.x, 0, this.focus.z - 2);
    this.r.render(this.scene, this.cam);
  }

  dispose() { this.r.dispose(); }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
