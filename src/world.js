import { TAU, MAX_CELLS, MIN_CELLS, BIO } from "./constants.js";
import { Cellule, clamp, lerp } from "./cellule.js";
import { getModeConfig, MODES } from "./modes.js";
import { createRng } from "./rng.js";
import { createField, sampleFlow, applyMouseForce, softBounce } from "./physics.js";
import { mapCellToSoundAndLight, applyEmergentHarmony } from "./mapping.js";

function makeClampedKnots(count, degree) {
  const knots = [];
  const inner = count - degree;
  for (let i = 0; i < count + degree + 1; i += 1) {
    if (i <= degree) knots.push(0);
    else if (i >= count) knots.push(1);
    else knots.push((i - degree) / inner);
  }
  return knots;
}

export function createGenome(size, generation, rand) {
  const controlCount = 9 + Math.floor(rand(0, 5));
  const controls = [];
  for (let i = 0; i < controlCount; i += 1) {
    const a = (i / controlCount) * TAU;
    const family = 1 + Math.sin(generation * 0.9 + i * 1.7) * 0.12;
    controls.push({
      angle: a,
      radius: rand(0.72, 1.28) * family,
      z: rand(-1, 1),
      w: rand(0.62, 1.58),
      spin: rand(-0.65, 0.65),
      fold: rand(0.75, 1.28)
    });
  }
  return {
    degree: 3,
    controls,
    knots: makeClampedKnots(controlCount, 3),
    twist: rand(-1.2, 1.2),
    nuclei: Array.from({ length: 3 + Math.floor(rand(0, 5)) }, () => rand(0, TAU)),
    membraneNoise: rand(0.8, 1.9),
    sizeSeed: size
  };
}

export class World {
  constructor() {
    this.width = 800;
    this.height = 600;
    this.seed = String(Date.now());
    this.rngWrap = createRng(this.seed);
    this.noiseField = createField(this.seed);
    this.cells = [];
    this.bursts = [];
    this.spores = [];
    this.entities = [];
    this.mode = "calme";
    this.systemPhase = "normal";
    this.extinctionTimer = 0;
    this.renaissanceTimer = 0;
    this.storyTime = 0;
    this.nextGenesisAt = 900;
    this.nextCellId = 1;
    this.stats = { totalBorn: 0, manualBorn: 0, maxGeneration: 0 };
    this.temporal = {
      local: 0,
      medium: 0,
      long: 0,
      pointDensity: 0.55,
      soundDensity: 0.28,
      clusterDensity: 0.45,
      macroPressure: 0.35,
      fps: 60,
      quality: 1
    };
    this.mouse = { x: 0, y: 0, down: false, active: false };
    this.lastManualCreation = { time: -Infinity, x: -9999, y: -9999 };
  }

  get settings() {
    return getModeConfig(this.mode);
  }

  init(seed, modeName = this.mode) {
    this.seed = String(seed ?? Date.now());
    this.rngWrap = createRng(this.seed);
    this.noiseField = createField(this.seed);
    const { rand } = this.rngWrap;
    this.mode = modeName;
    this.systemPhase = "normal";
    this.extinctionTimer = 0;
    this.cells = [];
    this.bursts = [];
    this.spores = [];
    this.entities = [];
    this.storyTime = 0;
    this.nextGenesisAt = 900;
    this.nextCellId = 1;
    this.stats = { totalBorn: 0, manualBorn: 0, maxGeneration: 0 };
    this.temporal = {
      local: 0,
      medium: 0,
      long: 0,
      pointDensity: 0.55,
      soundDensity: 0.28,
      clusterDensity: 0.45,
      macroPressure: 0.35,
      fps: 60,
      quality: 1
    };

    const founderX = this.width > 760 ? this.width * 0.68 : this.width * 0.52;
    const founderY = this.height > 560 ? this.height * 0.5 : this.height * 0.68;
    const founder = this.spawnCell(founderX, founderY, 24, 1.18, rand(110, 190), {
      generation: 0,
      origin: "founder",
      voice: 0,
      count: true
    });
    founder.gene = createGenome(founder.size, 0, rand);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * TAU + rand(-0.22, 0.22);
      const distance = rand(34, 82);
      const child = this.spawnCell(
        founderX + Math.cos(angle) * distance,
        founderY + Math.sin(angle) * distance,
        rand(8, 15),
        rand(0.72, 0.98),
        (founder.hue + i * 42 + rand(-16, 16) + 360) % 360,
        { generation: 1, origin: "division", voice: i % 7, count: true }
      );
      child.vx = Math.cos(angle) * rand(0.35, 0.95);
      child.vy = Math.sin(angle) * rand(0.35, 0.95);
      child.gene = createGenome(child.size, 1, rand);
    }
    this.stats.maxGeneration = 1;
    this.addBurst(founderX, founderY, founder.hue, 1.2);
  }

  spawnCell(x, y, size, energy, hue, options = {}) {
    const id = this.nextCellId;
    this.nextCellId += 1;
    const cell = new Cellule(id, x, y, size, energy, hue, this.rngWrap, options);
    const { rand } = this.rngWrap;
    if (!cell.gene) cell.gene = createGenome(size, cell.generation, rand);
    if (options.count !== false) {
      this.stats.totalBorn += 1;
      if (cell.origin === "manual") this.stats.manualBorn += 1;
      this.stats.maxGeneration = Math.max(this.stats.maxGeneration, cell.generation);
    }
    if (options.push !== false) {
      this.cells.push(cell);
    }
    return cell;
  }

  get globalEnergy() {
    if (this.cells.length === 0) return 0;
    return this.cells.reduce((s, c) => s + c.energy, 0);
  }

  updateTemporal(dt) {
    const settings = this.settings;
    const density = clamp(this.cells.length / Math.max(1, settings.capacity), 0, 1);
    this.temporal.local = (this.temporal.local + dt * (0.0018 + settings.density * 0.00055 + density * 0.0009)) % 1;
    this.temporal.medium = (this.temporal.medium + dt * (0.00018 + settings.density * 0.00006 + density * 0.00012)) % 1;
    this.temporal.long = (this.temporal.long + dt * (0.000018 + settings.density * 0.000008 + density * 0.000012)) % 1;
    const localPulse = Math.sin(this.temporal.local * TAU) * 0.5 + 0.5;
    const mediumPulse = Math.sin(this.temporal.medium * TAU + density * 2.4) * 0.5 + 0.5;
    const longPulse = Math.sin(this.temporal.long * TAU + this.cells.length * 0.018) * 0.5 + 0.5;
    const jitter = Math.sin(this.storyTime * 0.017 + this.cells.length * 12.17) * 0.5 + 0.5;
    this.temporal.pointDensity = clamp(0.18 + localPulse * 0.42 + mediumPulse * 0.2 + density * 0.38, 0.08, 1.35);
    this.temporal.soundDensity = clamp(
      0.08 + localPulse * 0.34 + mediumPulse * 0.18 + longPulse * 0.2 + density * 0.46 + jitter * 0.08,
      0.05,
      this.mode === "chaos" ? 1.45 : 1.05
    );
    this.temporal.clusterDensity = clamp(0.12 + mediumPulse * 0.58 + density * 0.42, 0.08, 1.25);
    this.temporal.macroPressure = clamp(0.12 + longPulse * 0.72 + density * 0.25, 0.08, 1.2);
  }

  updateSystemPhase(dt) {
    const ge = this.globalEnergy;
    const n = this.cells.length;
    if (this.systemPhase === "normal" && ge < 8 && n > 3 && this.storyTime > 8000 && this.mode !== "renaissance") {
      this.systemPhase = "extinction";
      this.extinctionTimer = 3000;
      this.mode = "extinction";
    }
    if (this.systemPhase === "extinction") {
      this.extinctionTimer -= dt;
      if (this.extinctionTimer <= 0 || n < 4) {
        this.systemPhase = "renaissance";
        this.renaissanceTimer = 4000;
        this.mode = "renaissance";
        for (let k = 0; k < 3; k += 1) {
          const x = this.rngWrap.rand(80, this.width - 80);
          const y = this.rngWrap.rand(80, this.height - 80);
          const c = this.spawnCell(x, y, this.rngWrap.rand(12, 22), 0.95, this.rngWrap.rand(160, 280), {
            generation: 0,
            origin: "renaissance",
            voice: k,
            count: true
          });
          c.gene = createGenome(c.size, 0, this.rngWrap.rand.bind(this.rngWrap));
        }
      }
    } else if (this.systemPhase === "renaissance") {
      this.renaissanceTimer -= dt;
      if (this.renaissanceTimer <= 0) {
        this.systemPhase = "normal";
        this.mode = "stable";
      }
    }
  }

  step(dt, frameDt) {
    this.storyTime += dt;
    this.updatePerformance(frameDt);
    this.updateTemporal(dt);
    this.updateSystemPhase(dt);

    const settings = this.settings;
    const flowT = this.storyTime;

    this.updateSpores(dt);
    this.updateRelations(dt);

    for (const cell of this.cells) {
      cell.age += dt;
      cell.birthAge += dt;
      cell.hyper += dt * (0.00022 + cell.energy * 0.00005 + cell.generation * 0.000012);
      cell.phase += dt * (0.0018 + cell.energy * 0.000012 + cell.voice * 0.00002);

      const flow = sampleFlow(this.noiseField, flowT, cell.x, cell.y);
      const wander = settings.drift * dt * 0.012;
      cell.vx += flow.ax * wander * 2.2 + Math.cos(cell.phase * 1.7) * wander + this.rngWrap.rand(-wander, wander);
      cell.vy += flow.ay * wander * 2.2 + Math.sin(cell.phase * 1.3) * wander + this.rngWrap.rand(-wander, wander);

      const centerDx = cell.x - this.width * 0.5;
      const centerDy = cell.y - this.height * 0.5;
      const centerDist = Math.hypot(centerDx, centerDy) || 1;
      const orbitForce = (0.003 + this.temporal.local * 0.006 + this.temporal.macroPressure * 0.002) * dt;
      cell.vx += (-centerDy / centerDist) * orbitForce;
      cell.vy += (centerDx / centerDist) * orbitForce;

      applyMouseForce(cell, this.mouse, this.width, this.height, dt);

      for (const entity of this.entities) {
        const dx = cell.x - entity.x;
        const dy = cell.y - entity.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < entity.radius) {
          const warp = (1 - dist / entity.radius) * entity.force * dt * 0.0009;
          const tangent = entity.spin;
          cell.vx += ((dx / dist) * 0.45 + (-dy / dist) * tangent) * warp;
          cell.vy += ((dy / dist) * 0.45 + (dx / dist) * tangent) * warp;
          cell.hyper += warp * 0.5;
          cell.energy = clamp(cell.energy + warp * 0.12, 0, 1.42);
        }
      }

      const speed = Math.hypot(cell.vx, cell.vy);
      const maxSpeed = settings.maxSpeed;
      if (speed > maxSpeed) {
        cell.vx = (cell.vx / speed) * maxSpeed;
        cell.vy = (cell.vy / speed) * maxSpeed;
      } else if (speed < 0.12) {
        const wake = cell.phase + cell.id * 1.618;
        cell.vx += Math.cos(wake) * 0.045;
        cell.vy += Math.sin(wake) * 0.045;
      }

      cell.x += cell.vx * dt * 0.06;
      cell.y += cell.vy * dt * 0.06;

      softBounce(cell, this.width, this.height, (c, bx, by) => {
        this.addBurst(bx, by, c.hue, 0.55);
      });

      const pulse = Math.sin(cell.phase * 3) * 0.16 + Math.sin(cell.age * 0.004) * 0.08 + Math.sin(cell.hyper) * 0.06;
      cell.energy += (settings.energyGain * cell.nearCount - settings.energyLoss) * dt * 0.01;
      if (this.cells.length < settings.target) cell.energy += 0.00042 * dt;
      cell.energy += this.rngWrap.rand(-0.003, 0.004) * dt;
      cell.energy = clamp(cell.energy, 0, 1.42);
      cell.size = clamp(cell.baseSize * (0.84 + cell.energy * 0.5 + pulse), 3.5, 48);

      const spd = Math.hypot(cell.vx, cell.vy);
      cell.instability = clamp(spd / settings.maxSpeed + cell.nearCount * 0.04 + cell.collisionCount * 0.002, 0, 2);

      if (cell.nearCount === 0) cell.isolationTime += dt;
      else cell.isolationTime = 0;

      const ctxMap = {
        width: this.width,
        height: this.height,
        storyTime: this.storyTime,
        cells: this.cells,
        temporal: this.temporal,
        globalEnergy: this.globalEnergy
      };
      cell.mapping = mapCellToSoundAndLight(cell, spd, this.mode, ctxMap);
      cell.motionMemory.vx = lerp(cell.motionMemory.vx, cell.vx, 0.08);
      cell.motionMemory.vy = lerp(cell.motionMemory.vy, cell.vy, 0.08);
      cell.hue = (cell.mapping.hue + (cell.nearCount * 0.006 + spd * 0.008) * dt) % 360;

      cell.pushHistory();
    }

    applyEmergentHarmony(this.cells, this.mode, 95);

    this.evolve(dt);
    this.updateBursts(dt);
  }

  updatePerformance(frameDt) {
    const instantFps = frameDt > 0 ? 1000 / frameDt : 60;
    this.temporal.fps = lerp(this.temporal.fps, clamp(instantFps, 8, 90), 0.06);
    const targetQuality = this.temporal.fps < 24 ? 0.42 : this.temporal.fps < 38 ? 0.62 : this.temporal.fps < 52 ? 0.82 : 1;
    this.temporal.quality = lerp(this.temporal.quality, targetQuality, 0.04);
  }

  updateRelations(dt) {
    const settings = this.settings;
    const nearMult = settings.nearMult ?? 4.7;
    this.cells.forEach((cell) => {
      cell.nearCount = 0;
      cell.isolated = 1;
    });

    for (let i = 0; i < this.cells.length; i += 1) {
      for (let j = i + 1; j < this.cells.length; j += 1) {
        const a = this.cells[i];
        const b = this.cells[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const near = (a.size + b.size) * nearMult;

        if (dist < near) {
          const strength = (1 - dist / near) * settings.attraction * dt;
          if (dist > (a.size + b.size) * 1.2) {
            a.vx += (dx / dist) * strength;
            a.vy += (dy / dist) * strength;
            b.vx -= (dx / dist) * strength;
            b.vy -= (dy / dist) * strength;
          } else {
            const rep = settings.repulsion * dt * (1 - dist / ((a.size + b.size) * 1.2));
            a.vx -= (dx / dist) * rep;
            a.vy -= (dy / dist) * rep;
            b.vx += (dx / dist) * rep;
            b.vy += (dy / dist) * rep;
          }
          a.nearCount += 1;
          b.nearCount += 1;
          a.isolated = Math.min(a.isolated, dist / near);
          b.isolated = Math.min(b.isolated, dist / near);
        }

        const collision = dist < (a.size + b.size) * settings.fusionDistance;
        if (collision) {
          a.energy += 0.012 * dt;
          b.energy += 0.012 * dt;
          a.collisionCount += 1;
          b.collisionCount += 1;
          this.addBurst((a.x + b.x) / 2, (a.y + b.y) / 2, (a.hue + b.hue) / 2, 0.45);

          if (this.cells.length > MIN_CELLS && this.rngWrap.rand(0, 1) < (this.mode === "chaos" ? 0.0014 : 0.0048) * dt) {
            this.fuseCells(i, j);
            return;
          }
        }
      }
    }
  }

  evolve(dt) {
    const settings = this.settings;
    const capacity = Math.min(MAX_CELLS, settings.capacity);
    const genesisBoost = this.cells.length < Math.min(settings.target, 22) ? 1.8 : 1;

    if (this.storyTime >= this.nextGenesisAt && this.cells.length > 0 && this.cells.length < Math.min(settings.target, capacity)) {
      const parent = this.cells.reduce((best, cell) => {
        const score = cell.energy + cell.size * 0.012 - cell.generation * 0.006;
        const bestScore = best.energy + best.size * 0.012 - best.generation * 0.006;
        return score > bestScore ? cell : best;
      }, this.cells[0]);
      parent.energy = Math.max(parent.energy, settings.division + 0.16);
      parent.birthAge = Math.max(parent.birthAge, 1300 + parent.generation * 70);
      this.divideCell(parent);
      const acceleration = this.cells.length < 8 ? 0.42 : this.cells.length < 24 ? 0.7 : 1;
      this.nextGenesisAt = this.storyTime + settings.birthTempo * acceleration * this.rngWrap.rand(0.55, 0.95);
    }

    for (let i = this.cells.length - 1; i >= 0; i -= 1) {
      const cell = this.cells[i];
      const pressure = this.cells.length < settings.target ? 1.7 : 0.52;
      const birthWindow = cell.birthAge > 900 + cell.generation * 70;
      if (birthWindow && cell.energy > settings.division && this.cells.length < capacity && this.rngWrap.rand(0, 1) < settings.divisionChance * pressure * genesisBoost * dt) {
        this.divideCell(cell);
      }

      const deathEnergy = this.mode === "extinction" ? 0.05 : 0.022;
      if ((cell.energy < deathEnergy && this.cells.length > MIN_CELLS && this.storyTime > 12000) || this.cells.length > capacity) {
        cell.biologicalState = BIO.DYING;
        this.cells.splice(i, 1);
        this.addBurst(cell.x, cell.y, cell.hue, 0.28);
      }
    }

    if (this.cells.length === 1 && this.storyTime > settings.birthTempo) {
      this.cells[0].energy = Math.max(this.cells[0].energy, settings.division + 0.1);
      this.divideCell(this.cells[0]);
      this.nextGenesisAt = this.storyTime + settings.birthTempo * 0.5;
    }

    if (this.cells.length < MIN_CELLS) {
      const c = this.spawnCell(
        this.rngWrap.rand(80, this.width - 80),
        this.rngWrap.rand(80, this.height - 80),
        this.rngWrap.rand(8, 16),
        0.7,
        this.rngWrap.rand(0, 360),
        { generation: 0, origin: "founder", count: true }
      );
      c.gene = createGenome(c.size, 0, this.rngWrap.rand.bind(this.rngWrap));
    }
  }

  divideCell(cell) {
    if (this.cells.length >= Math.min(MAX_CELLS, this.settings.capacity)) return null;
    const settings = this.settings;
    cell.energy *= this.mode === "chaos" ? 0.62 : 0.5;
    cell.baseSize *= this.mode === "calme" ? 0.94 : 0.88;
    cell.biologicalState = BIO.DIVIDED;
    const angle = this.rngWrap.rand(0, TAU);
    const child = this.spawnCell(
      cell.x + Math.cos(angle) * cell.size * 1.8,
      cell.y + Math.sin(angle) * cell.size * 1.8,
      clamp(cell.baseSize * this.rngWrap.rand(0.72, 1.08), 5, 22),
      cell.energy * this.rngWrap.rand(0.72, 1.04),
      (cell.hue + this.rngWrap.rand(this.mode === "chaos" ? -98 : -32, this.mode === "chaos" ? 120 : 44) + 360) % 360,
      {
        generation: cell.generation + 1,
        origin: "division",
        voice: (cell.voice + 1 + Math.floor(this.rngWrap.rand(0, 6))) % 7,
        count: true
      }
    );
    child.vx = cell.vx + Math.cos(angle) * this.rngWrap.rand(0.6, 1.5);
    child.vy = cell.vy + Math.sin(angle) * this.rngWrap.rand(0.6, 1.5);
    child.gene = createGenome(child.size, child.generation, this.rngWrap.rand.bind(this.rngWrap));
    this.addBurst(cell.x, cell.y, cell.hue, 0.75);
    this.emitSpores(child, this.mode === "chaos" ? 90 : this.mode === "stable" ? 48 : 24, 0.8);
    return child;
  }

  fuseCells(i, j) {
    const a = this.cells[i];
    const b = this.cells[j];
    const merged = this.spawnCell(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      clamp(Math.sqrt(a.size * a.size + b.size * b.size) * 0.82, 7, 34),
      clamp((a.energy + b.energy) * 0.58, 0.2, 1.25),
      (a.hue + b.hue) / 2,
      { generation: Math.max(a.generation, b.generation) + 1, origin: "fusion", voice: (a.voice + b.voice) % 7, count: false, push: false }
    );
    merged.vx = (a.vx + b.vx) * 0.5;
    merged.vy = (a.vy + b.vy) * 0.5;
    merged.biologicalState = BIO.FUSED;
    merged.gene = createGenome(merged.size, merged.generation, this.rngWrap.rand.bind(this.rngWrap));
    const hi = Math.max(i, j);
    const lo = Math.min(i, j);
    this.cells.splice(hi, 1);
    this.cells.splice(lo, 1);
    this.cells.push(merged);
    this.addBurst(merged.x, merged.y, merged.hue, 0.9);
    return merged;
  }

  addBurst(x, y, hue, force) {
    this.bursts.push({ x, y, hue, force, life: 1, radius: 6 + force * 22 });
    const maxBursts = Math.floor((30 + this.temporal.pointDensity * 62) * this.temporal.quality);
    while (this.bursts.length > maxBursts) this.bursts.shift();
  }

  updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const burst = this.bursts[i];
      burst.life -= dt * 0.0028;
      burst.radius += dt * (0.14 + burst.force * 0.08);
      if (burst.life <= 0) this.bursts.splice(i, 1);
    }
  }

  emitSpores(cell, amount, force = 1) {
    const settings = this.settings;
    const cap = this.mode === "chaos" ? 4200 : this.mode === "stable" ? 2600 : 1400;
    const count = Math.min(amount, Math.max(0, cap - this.spores.length));
    const mapping = cell.mapping;
    for (let i = 0; i < count; i += 1) {
      const angle = this.rngWrap.rand(0, TAU);
      const shell = Math.pow(this.rngWrap.rand(0, 1), this.mode === "chaos" ? 0.38 : 0.62);
      const radius = this.rngWrap.rand(cell.size * 0.7, cell.size * (this.mode === "chaos" ? 18 : 10)) * shell;
      const speed = this.rngWrap.rand(0.08, settings.maxSpeed * 0.72) * force;
      const dimension = this.rngWrap.rand(-1, 1);
      this.spores.push({
        x: cell.x + Math.cos(angle) * radius,
        y: cell.y + Math.sin(angle) * radius,
        vx: Math.cos(angle + this.rngWrap.rand(-0.7, 0.7)) * speed + cell.vx * 0.2,
        vy: Math.sin(angle + this.rngWrap.rand(-0.7, 0.7)) * speed + cell.vy * 0.2,
        z: dimension,
        w: this.rngWrap.rand(0.2, 1.8),
        hue: (mapping.hue + this.rngWrap.rand(-90, 120) + 360) % 360,
        size: this.rngWrap.rand(0.55, this.mode === "chaos" ? 2.6 : 1.8) * force,
        life: this.rngWrap.rand(0.45, this.mode === "chaos" ? 1.8 : 1.35),
        phase: this.rngWrap.rand(0, TAU),
        orbit: this.rngWrap.rand(-1.4, 1.4)
      });
    }
  }

  updateSpores(dt) {
    if (this.cells.length > 0) {
      const emitterRate = (this.mode === "chaos" ? 18 : this.mode === "stable" ? 9 : 4) * this.temporal.pointDensity * this.temporal.quality;
      if (this.rngWrap.rand(0, 1) < emitterRate * dt * 0.001) {
        const cell = this.cells[Math.floor(this.rngWrap.rand(0, this.cells.length))];
        this.emitSpores(cell, this.mode === "chaos" ? 38 : this.mode === "stable" ? 18 : 8, 0.7);
      }
    }
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    for (let i = this.spores.length - 1; i >= 0; i -= 1) {
      const spore = this.spores[i];
      spore.phase += dt * (0.001 + this.temporal.local * 0.002);
      spore.life -= dt * (this.mode === "chaos" ? 0.00024 : 0.00016);
      spore.z += Math.sin(spore.phase + this.temporal.long * TAU) * dt * 0.00018;
      const dx = spore.x - centerX;
      const dy = spore.y - centerY;
      const dist = Math.hypot(dx, dy) || 1;
      const twist = (0.0008 + this.temporal.macroPressure * 0.0018) * spore.orbit * dt;
      spore.vx += (-dy / dist) * twist + Math.sin(spore.phase) * 0.006 * dt;
      spore.vy += (dx / dist) * twist + Math.cos(spore.phase * 1.3) * 0.006 * dt;
      const projection = 1 / (1.8 - clamp(spore.z, -1.2, 1.2) * 0.35);
      spore.x += spore.vx * dt * 0.04 * projection;
      spore.y += spore.vy * dt * 0.04 * projection;
      if (spore.life <= 0 || spore.x < -160 || spore.x > this.width + 160 || spore.y < -160 || spore.y > this.height + 160) {
        this.spores.splice(i, 1);
      }
    }
  }

  setMode(next) {
    if (!MODES[next]) return;
    this.mode = next;
    const settings = this.settings;
    if (next === "chaos") {
      this.cells.forEach((cell) => {
        cell.energy = Math.max(cell.energy, 0.82);
        cell.vx *= 1.55;
        cell.vy *= 1.55;
      });
      while (this.cells.length < Math.min(18, settings.target)) {
        const parent = this.cells[Math.floor(this.rngWrap.rand(0, this.cells.length))];
        this.divideCell(parent);
      }
      this.cells.forEach((cell) => this.emitSpores(cell, 120, 1.1));
    } else if (next === "calme" || next === "extinction") {
      this.cells.forEach((cell) => {
        cell.energy *= 0.72;
        cell.vx *= 0.62;
        cell.vy *= 0.62;
      });
    } else if (next === "stable" || next === "renaissance") {
      this.cells.forEach((cell, index) => {
        const angle = (index / Math.max(1, this.cells.length)) * TAU;
        cell.vx += Math.cos(angle) * 0.35;
        cell.vy += Math.sin(angle) * 0.35;
        cell.energy = Math.max(cell.energy, 0.58);
      });
    }
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  addManualCluster(px, py, large) {
    const { rand } = this.rngWrap;
    const cap = Math.min(MAX_CELLS, this.settings.capacity);
    const now = performance.now();
    if (now - this.lastManualCreation.time < 260) {
      const d = Math.hypot(px - this.lastManualCreation.x, py - this.lastManualCreation.y);
      if (d < 12) return;
    }
    this.lastManualCreation = { time: now, x: px, y: py };

    const parentGeneration = this.cells.length
      ? this.cells.reduce((max, cell) => Math.max(max, cell.generation), 0)
      : 0;
    const bloomCount = large ? 9 : 5;
    const cell = this.spawnCell(px, py, large ? rand(22, 38) : rand(8, 18), large ? 1.12 : 0.82, rand(0, 360), {
      generation: parentGeneration + 1,
      origin: "manual",
      voice: Math.floor(rand(0, 7))
    });
    for (let i = 1; i < bloomCount; i += 1) {
      if (this.cells.length >= cap) break;
      const angle = (i / bloomCount) * TAU + rand(-0.28, 0.28);
      const distance = rand(large ? 36 : 18, large ? 130 : 74);
      this.spawnCell(
        px + Math.cos(angle) * distance,
        py + Math.sin(angle) * distance,
        rand(large ? 9 : 5, large ? 24 : 14),
        rand(0.56, large ? 1.08 : 0.9),
        (cell.hue + i * rand(24, 64) + 360) % 360,
        { generation: parentGeneration + 1 + (i % 3), origin: "manual", voice: (cell.voice + i) % 7 }
      );
    }
    while (this.cells.length > cap) {
      this.cells.shift();
    }
    this.addBurst(px, py, cell.hue, large ? 1.5 : 0.9);
    this.nextGenesisAt = Math.min(this.nextGenesisAt, this.storyTime + 400);
    return cell;
  }
}