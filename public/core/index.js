// Football core: fixed-step simulation + 3D renderer. Implements the shell's core contract.
import { Sim, DT } from './sim.js';
import { Renderer } from './render.js';

export default class FootballCore {
  constructor(host) { this.h = host; this.raf = 0; }

  async start() {
    const { canvas, settings, input, log } = this.h;
    const sim = this.sim = new Sim({ perTeam: 7, seed: (Math.random() * 2 ** 32) >>> 0, halfLength: 90 });
    const rend = this.rend = new Renderer(canvas, settings);
    const hud = this.hud = document.createElement('div');
    Object.assign(hud.style, { position: 'absolute', top: '6px', left: '0', right: '0', textAlign: 'center', color: '#fff', font: 'bold 16px system-ui', textShadow: '0 1px 3px #000', pointerEvents: 'none' });
    canvas.parentElement.append(hud);

    const second = !!navigator.getGamepads?.()[1];
    log(`football core: ${sim.players.length} players, 2nd human=${second}, renderer=webgl2`);
    const step = 1 / Number(settings.fps === '60' ? 60 : 60);
    let acc = 0, last = performance.now();
    const frame = now => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
      while (acc >= DT) {
        sim.step([input.state(0), second ? input.state(1) : null]);
        acc -= DT;
        for (const e of sim.events) if (e.t === 'goal') log(`gol squadra ${e.team + 1}  ${sim.score[0]}-${sim.score[1]}`);
      }
      rend.draw(sim, [sim.active[0], ...(second ? [sim.active[1]] : [])], dt);
      const t = Math.floor(sim.matchTime), mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
      hud.textContent = `${sim.score[0]} - ${sim.score[1]}   ${mm}:${ss}${sim.state === 'goal' ? '   GOL!' : sim.state === 'full' ? '   FINE' : ''}`;
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() { cancelAnimationFrame(this.raf); this.rend?.dispose(); this.hud?.remove(); }
}
