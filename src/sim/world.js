import { Cellule } from "./cellule.js";
import { SpatialGrid } from "./spatial.js";

/** @typedef {'Dormance' | 'Eveil' | 'Symbiose' | 'Climax' | 'Extinction'} OrganState */

const MAX_CELLS = 900;
const SPAWN_PER_FRAME = 6;
const CLIMax_BURST = 14;

export class World {
  /**
   * @param {object} [o]
   * @param {number} [o.width]
   * @param {number} [o.height]
   */
  constructor(o = {}) {
    this.width = o.width ?? 800;
    this.height = o.height ?? 600;
    /** @type {Cellule[]} */
    this.cells = [];
    this.spatial = new SpatialGrid(80, this.width, this.height);
    /** @type {OrganState} */
    this.state = "Dormance";
    this.stateTime = 0;
    this.nucleus = {
      x: this.width / 2,
      y: this.height / 2,
      r: 42,
      pulse: 0,
      hue: 0.52,
    };
    /** @type {{ type: string, count: number }[]} */
    this._spawnQueue = [];
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;
    this.mouseDown = false;
    this.mutationBias = 0;
    this.climaxCooldown = 0;
    this.extinctionAlpha = 0;
    this._energyHist = [];
    this._silenceTime = 0;
    this.freeze = false;
    /** @type {number|null} */
    this.seedHue = null;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.nucleus.x = w / 2;
    this.nucleus.y = h / 2;
    this.spatial = new SpatialGrid(80, w, h);
  }

  /**
   * @param {object} dna
   */
  applyDna(dna) {
    if (!dna) return;
    this.seedHue = dna.hueBase ?? null;
    const p = dna.personality ?? {};
    this._persSpread = p.spread ?? 0.7;
    this._persChaos = p.chaos ?? 0.5;
    this._persGlow = p.glow ?? 0.5;
  }

  /**
   * @param {import('../audio/analyzer.js').Analyzer} analyzer
   * @param {number} dt
   */
  update(analyzer, dt) {
    if (this.freeze) {
      this.extinctionAlpha = Math.min(1, this.extinctionAlpha + dt * 0.4);
      return;
    }

    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;
    const e = analyzer.energy;
    this._energyHist.push(e);
    if (this._energyHist.length > 120) this._energyHist.shift();
    const sorted = [...this._energyHist].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0.5;
    const climaxing = e > p90 && e > 0.35;

    if (analyzer.isSilent) {
      this._silenceTime += dt;
    } else {
      this._silenceTime = 0;
    }

    this._updateState(e, analyzer, dt);

    const spread = (this._persSpread ?? 0.7) * 180;
    const bassR = 28 + analyzer.bass * 120;
    this.nucleus.r = bassR * 0.5 + (this.nucleus.r * 0.5);
    this.nucleus.hue =
      (this.seedHue ?? 0.5) * 0.3 +
      Math.min(4000, analyzer.centroidHz) / 8000 +
      this.mutationBias * 0.05;
    this.nucleus.pulse *= 0.88;
    if (analyzer.kick) this.nucleus.pulse = 1;

    const field = {
      ax: (this.mouseX - cx) * 0.00002 * (this.mouseDown ? 2 : 0.5),
      ay: (this.mouseY - cy) * 0.00002 * (this.mouseDown ? 2 : 0.5),
    };

    this._enqueueSpawns(analyzer, climaxing);

    let spawns = 0;
    while (this._spawnQueue.length && spawns < SPAWN_PER_FRAME && this.cells.length < MAX_CELLS) {
      const job = this._spawnQueue.shift();
      for (let j = 0; j < job.count; j++) {
        this._spawnOne(job.type, cx, cy, spread, analyzer);
        spawns++;
        if (this.cells.length >= MAX_CELLS) break;
      }
    }

    this.spatial.clear();
    for (let i = 0; i < this.cells.length; i++) {
      this.spatial.insert(this.cells[i], i);
    }

    for (let i = this.cells.length - 1; i >= 0; i--) {
      const c = this.cells[i];
      const dx = c.x - cx;
      const dy = c.y - cy;
      const dist = Math.hypot(dx, dy) + 1e-6;
      const pull = (0.15 + e * 0.25) * (1 + (this._persChaos ?? 0.5) * 0.2);
      c.vx += (-dx / dist) * pull * dt * 0.08;
      c.vy += (-dy / dist) * pull * dt * 0.08;

      for (const ni of this.spatial.neighbors(c)) {
        if (ni === i) continue;
        const o = this.cells[ni];
        const ox = c.x - o.x;
        const oy = c.y - o.y;
        const d = Math.hypot(ox, oy) + 1e-6;
        if (d < (c.r + o.r) * 2.5) {
          const rep = 0.4 / d;
          c.vx += (ox / d) * rep * dt;
          c.vy += (oy / d) * rep * dt;
        }
      }

      c.step(dt, field);
      if (c.life <= 0 || c.x < -50 || c.x > w + 50 || c.y < -50 || c.y > h + 50) {
        this.cells.splice(i, 1);
      }
    }

    if (climaxing && this.climaxCooldown <= 0) {
      this.climaxCooldown = 0.25;
      const n = Math.min(CLIMax_BURST, MAX_CELLS - this.cells.length);
      for (let k = 0; k < n; k++) {
        this._spawnOne("lumiere", cx, cy, spread * 1.2, analyzer);
      }
    }
    this.climaxCooldown = Math.max(0, this.climaxCooldown - dt);
  }

  /**
   * @param {number} e
   * @param {import('../audio/analyzer.js').Analyzer} analyzer
   * @param {number} dt
   */
  _updateState(e, analyzer, dt) {
    this.stateTime += dt;
    if (this.state === "Dormance" && e > 0.12) {
      this.state = "Eveil";
      this.stateTime = 0;
    } else if (this.state === "Eveil" && e > 0.22) {
      this.state = "Symbiose";
      this.stateTime = 0;
    } else if (this.state === "Symbiose" && e > 0.4 && analyzer.flux > 0.2) {
      this.state = "Climax";
      this.stateTime = 0;
    } else if (this.state === "Climax" && this._silenceTime > 2) {
      this.state = "Symbiose";
    }
  }

  /**
   * @param {import('../audio/analyzer.js').Analyzer} analyzer
   * @param {boolean} climaxing
   */
  _enqueueSpawns(analyzer, climaxing) {
    if (analyzer.kick) {
      this._spawnQueue.push({ type: "impulsion", count: 3 + (climaxing ? 2 : 0) });
      this._spawnQueue.push({ type: "tissu", count: 2 });
    }
    if (analyzer.peak && !analyzer.kick) {
      this._spawnQueue.push({ type: "lumiere", count: 2 });
    }
    if (this.cells.length < 40 && !analyzer.isSilent) {
      this._spawnQueue.push({ type: "mere", count: 1 });
    }
    if (Math.random() < analyzer.treble * 0.08) {
      this._spawnQueue.push({ type: "fantome", count: 1 });
    }
  }

  /**
   * @param {string} type
   * @param {number} cx
   * @param {number} cy
   * @param {number} spread
   * @param {import('../audio/analyzer.js').Analyzer} analyzer
   */
  _spawnOne(type, cx, cy, spread, analyzer) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * spread * (0.5 + analyzer.bass);
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const sp = 0.3 + Math.random() * 0.5;
    const c = new Cellule({
      x,
      y,
      type,
      vx: (Math.random() - 0.5) * sp * 0.2,
      vy: (Math.random() - 0.5) * sp * 0.2,
      life: 0.7 + Math.random() * 0.5,
    });
    c.r *= 0.85 + (this._persGlow ?? 0.5) * 0.3;
    this.cells.push(c);
  }

  setMouse(x, y, down) {
    this.mouseX = x;
    this.mouseY = y;
    this.mouseDown = down;
  }

  /** Calm: pull toward order */
  calm() {
    this.mutationBias *= 0.5;
    for (const c of this.cells) {
      c.vx *= 0.5;
      c.vy *= 0.5;
    }
  }

  /** Chaos: random kicks */
  chaos() {
    this.mutationBias += 0.2;
    for (const c of this.cells) {
      c.vx += (Math.random() - 0.5) * 1.2;
      c.vy += (Math.random() - 0.5) * 1.2;
    }
  }

  /** Mutation: type swap on a few cells */
  mutation() {
    const types = /** @type {const} */ (["mere", "tissu", "lumiere", "impulsion", "fantome"]);
    for (let k = 0; k < 5; k++) {
      if (this.cells.length === 0) break;
      const c = this.cells[(Math.random() * this.cells.length) | 0];
      c.type = types[(Math.random() * types.length) | 0];
      c.r = c.radiusForType(c.type);
    }
  }

  resetPositions() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    for (const c of this.cells) {
      const ang = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 100;
      c.x = cx + Math.cos(ang) * d;
      c.y = cy + Math.sin(ang) * d;
    }
  }

  beginExtinction() {
    this.state = "Extinction";
    this.freeze = true;
  }
}
