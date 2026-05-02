/**
 * 2D canvas scene: core, cells, trails, links (LOD), adaptive quality from FPS.
 */

const COLORS = {
  mere: [80, 220, 200],
  tissu: [120, 160, 255],
  lumiere: [255, 220, 120],
  impulsion: [255, 90, 160],
  fantome: [180, 200, 255],
};

export class CanvasScene {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d", { alpha: false }));
    this.fpsEma = 60;
    this.quality = 1;
  }

  /**
   * @param {number} dt
   */
  updateFps(dt) {
    const instFps = 1 / Math.max(dt, 1e-4);
    this.fpsEma = this.fpsEma * 0.95 + instFps * 0.05;
    if (this.fpsEma < 35) this.quality = 0.4;
    else if (this.fpsEma < 50) this.quality = 0.65;
    else this.quality = 1;
  }

  /**
   * @param {import('../sim/world.js').World} world
   * @param {import('../audio/analyzer.js').Analyzer} analyzer
   */
  draw(world, analyzer) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const q = this.quality;

    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#03060c");
    g.addColorStop(0.5, "#071018");
    g.addColorStop(1, "#040810");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const nx = world.nucleus.x;
    const ny = world.nucleus.y;
    const nr = world.nucleus.r * (1 + world.nucleus.pulse * 0.15);
    const hue = (world.nucleus.hue % 1) * 360;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr * 3.5);
    glow.addColorStop(0, `hsla(${hue},85%,55%,0.45)`);
    glow.addColorStop(0.4, `hsla(${(hue + 40) % 360},70%,45%,0.12)`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(nx, ny, nr * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = `hsla(${hue},60%,70%,0.15)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(nx, ny, nr, 0, Math.PI * 2);
    ctx.stroke();

    const cells = world.cells;
    const maxTrail = Math.floor(8 + 16 * q);

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const col = COLORS[c.type] ?? [200, 200, 200];
      const alpha = Math.max(0.15, c.life);

      const tr = c.trail;
      const step = Math.max(1, Math.floor((32 - maxTrail) / 10));
      ctx.save();
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.08 * alpha * q})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (let j = 0; j < tr.length; j += step) {
        const p = tr[j];
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.55 * alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.35 * alpha})`;
      ctx.stroke();
    }

    if (q > 0.5 && cells.length < 500) {
      const linkDist = 100 + analyzer.mid * 40;
      ctx.strokeStyle = `rgba(180,220,255,${0.06 * q})`;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < cells.length; i++) {
        const a = cells[i];
        let best = -1;
        let bestD = linkDist;
        for (const ni of world.spatial.neighbors(a)) {
          const b = cells[ni];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < bestD) {
            bestD = d;
            best = ni;
          }
        }
        if (best >= 0) {
          const b = cells[best];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    if (world.freeze) {
      ctx.fillStyle = `rgba(2,4,8,${0.35 + world.extinctionAlpha * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
