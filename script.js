const canvas = document.getElementById("organism");
const ctx = canvas.getContext("2d");

const audioToggle = document.getElementById("audioToggle");
const fullscreenButton = document.getElementById("fullscreenButton");
const seedButton = document.getElementById("seedButton");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const recordButton = document.getElementById("recordButton");
const seedInput = document.getElementById("seedInput");
const cellCount = document.getElementById("cellCount");
const birthCount = document.getElementById("birthCount");
const manualCount = document.getElementById("manualCount");
const generationCount = document.getElementById("generationCount");
const modeName = document.getElementById("modeName");
const storyState = document.getElementById("storyState");
const audioState = document.getElementById("audioState");
const modeButtons = [...document.querySelectorAll(".mode")];

const TAU = Math.PI * 2;
const MAX_CELLS = 260;
const MIN_CELLS = 1;
const AUDIO_CELL_LIMIT = 130;
const STORAGE_KEY = "electro-acoustic-organism";

let width = 0;
let height = 0;
let dpr = 1;
let cells = [];
let bursts = [];
let mode = "calme";
let mouse = { x: 0, y: 0, px: 0, py: 0, down: false, holdStart: 0, active: false };
let lastTime = performance.now();
let rng = mulberry32(Date.now());
let seed = String(Math.floor(Math.random() * 99999999));
let audio = null;
let recorder = null;
let recordedChunks = [];
let immersive = false;
let storyTime = 0;
let nextCellId = 1;
let stats = { totalBorn: 0, manualBorn: 0, maxGeneration: 0 };

const modes = {
  calme: {
    target: 34,
    capacity: 84,
    drift: 0.14,
    attraction: 0.007,
    division: 1.1,
    divisionChance: 0.0014,
    energyGain: 0.018,
    energyLoss: 0.012,
    fusionDistance: 0.95,
    maxSpeed: 1.65,
    scale: [72, 96, 120, 144, 168, 192, 216],
    density: 0.72,
    master: 0.3,
    delay: 0.42,
    reverb: 0.58,
    feedback: 0.24,
    birthTempo: 7200,
    story: "respiration"
  },
  stable: {
    target: 96,
    capacity: 160,
    drift: 0.34,
    attraction: 0.011,
    division: 0.94,
    divisionChance: 0.0032,
    energyGain: 0.04,
    energyLoss: 0.028,
    fusionDistance: 0.82,
    maxSpeed: 2.9,
    scale: [55, 82.5, 110, 137.5, 165, 220, 275],
    density: 1,
    master: 0.38,
    delay: 0.24,
    reverb: 0.34,
    feedback: 0.32,
    birthTempo: 4300,
    story: "organisme"
  },
  chaos: {
    target: 190,
    capacity: 260,
    drift: 1.08,
    attraction: 0.018,
    division: 0.72,
    divisionChance: 0.0075,
    energyGain: 0.08,
    energyLoss: 0.048,
    fusionDistance: 0.58,
    maxSpeed: 5.8,
    scale: [41, 50, 73, 97, 131, 173, 229],
    density: 1.35,
    master: 0.43,
    delay: 0.12,
    reverb: 0.16,
    feedback: 0.58,
    birthTempo: 1800,
    story: "mutation"
  }
};

class Cellule {
  constructor(x, y, size, energy, hue, options = {}) {
    this.id = nextCellId;
    nextCellId += 1;
    this.generation = options.generation || 0;
    this.origin = options.origin || "organisme";
    this.birthAge = 0;
    this.x = x;
    this.y = y;
    const angle = rand(0, TAU);
    const speed = rand(0.18, 1.35);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = size;
    this.baseSize = size;
    this.energy = energy;
    this.hue = hue;
    this.phase = rand(0, TAU);
    this.age = rand(0, 1000);
    this.depth = rand(-1, 1);
    this.hyper = rand(0, TAU);
    this.voice = options.voice || Math.floor(rand(0, 7));
    this.gene = createGenome(size, this.generation);
    this.isolated = 1;
    this.nearCount = 0;
    this.audio = null;
    if (options.count !== false) {
      stats.totalBorn += 1;
      if (this.origin === "manual") stats.manualBorn += 1;
      stats.maxGeneration = Math.max(stats.maxGeneration, this.generation);
    }
  }

  attachAudio() {
    if (!audio || this.audio) return;

    if (this.id % Math.ceil(Math.max(1, cells.length / AUDIO_CELL_LIMIT)) !== 0 && cells.length > AUDIO_CELL_LIMIT) return;

    const osc = audio.ctx.createOscillator();
    const overtone = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    const overtoneGain = audio.ctx.createGain();
    const pan = audio.ctx.createStereoPanner();
    const filter = audio.ctx.createBiquadFilter();
    const shaper = audio.ctx.createWaveShaper();
    const lfo = audio.ctx.createOscillator();
    const lfoGain = audio.ctx.createGain();

    osc.type = "sine";
    overtone.type = "triangle";
    osc.frequency.value = 160;
    overtone.frequency.value = 240;
    gain.gain.value = 0;
    overtoneGain.gain.value = 0.018;
    pan.pan.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 1.4;
    shaper.curve = distortionCurve(10 + this.voice * 9);
    shaper.oversample = "2x";
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 2;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfoGain.connect(overtone.frequency);
    osc.connect(shaper);
    overtone.connect(overtoneGain);
    overtoneGain.connect(shaper);
    shaper.connect(filter);
    filter.connect(pan);
    pan.connect(gain);
    gain.connect(audio.wet);
    gain.connect(audio.dry);

    osc.start();
    overtone.start();
    lfo.start();
    this.audio = { osc, overtone, gain, overtoneGain, pan, filter, shaper, lfo, lfoGain };
  }

  stopAudio() {
    if (!this.audio) return;
    const nodes = this.audio;
    const now = audio ? audio.ctx.currentTime : 0;
    nodes.gain.gain.cancelScheduledValues(now);
    nodes.gain.gain.linearRampToValueAtTime(0, now + 0.08);
    setTimeout(() => {
      try {
        nodes.osc.stop();
        nodes.overtone.stop();
        nodes.lfo.stop();
      } catch (error) {
        return;
      }
    }, 120);
    this.audio = null;
  }

  update(dt) {
    const settings = modes[mode];
    this.age += dt;
    this.birthAge += dt;
    this.hyper += dt * (0.00022 + this.energy * 0.00005 + this.generation * 0.000012);
    this.phase += dt * (0.0018 + this.energy * 0.000012 + this.voice * 0.00002);

    const wander = settings.drift * dt * 0.012;
    const orbit = Math.sin(storyTime * 0.0001 + this.generation) * 0.35;
    this.vx += Math.cos(this.phase * 1.7 + orbit) * wander + rand(-wander, wander);
    this.vy += Math.sin(this.phase * 1.3 - orbit) * wander + rand(-wander, wander);

    if (mouse.active) {
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const distSq = dx * dx + dy * dy;
      const radius = mouse.down ? 250 : 150;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 1;
        const force = (1 - dist / radius) * (mouse.down ? 0.065 : 0.025) * dt;
        this.vx += (dx / dist) * force;
        this.vy += (dy / dist) * force;
        this.energy = clamp(this.energy + 0.025 * dt, 0, 1.35);
      }
    }

    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = settings.maxSpeed;
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx * dt * 0.06;
    this.y += this.vy * dt * 0.06;

    if (this.x < this.size || this.x > width - this.size) {
      this.vx *= -0.94;
      this.x = clamp(this.x, this.size, width - this.size);
      addBurst(this.x, this.y, this.hue, 0.55);
      glitch(this, 0.4);
    }

    if (this.y < this.size || this.y > height - this.size) {
      this.vy *= -0.94;
      this.y = clamp(this.y, this.size, height - this.size);
      addBurst(this.x, this.y, this.hue, 0.55);
      glitch(this, 0.4);
    }

    const pulse = Math.sin(this.phase * 3) * 0.16 + Math.sin(this.age * 0.004) * 0.08 + Math.sin(this.hyper) * 0.06;
    this.energy += (settings.energyGain * this.nearCount - settings.energyLoss) * dt * 0.01;
    if (cells.length < settings.target) this.energy += 0.00042 * dt;
    this.energy += rand(-0.003, 0.004) * dt;
    this.energy = clamp(this.energy, 0, 1.42);
    this.size = clamp(this.baseSize * (0.84 + this.energy * 0.5 + pulse), 3.5, 48);
    this.hue = (this.hue + (this.nearCount * 0.016 + speed * 0.018 + this.generation * 0.002) * dt) % 360;

    this.updateAudio(speed);
  }

  updateAudio(speed) {
    if (!audio) return;
    this.attachAudio();
    const now = audio.ctx.currentTime;
    const settings = modes[mode];
    const xNorm = this.x / Math.max(1, width);
    const yNorm = this.y / Math.max(1, height);
    const scale = settings.scale;
    const note = scale[(this.generation + this.voice + this.nearCount) % scale.length];
    const octave = mode === "chaos" ? 1 + (this.id % 4) * 0.5 : this.id % 5 === 0 ? 2 : 1;
    const bend = lerp(0.92, 1.08, xNorm) + Math.sin(this.hyper) * 0.018;
    const harmonic = this.nearCount > 0 ? [1, 1.2, 1.333, 1.5, 2][this.nearCount % 5] : 1;
    const freq = note * octave * harmonic * bend;
    const crowdMix = clamp(cells.length / Math.max(1, settings.capacity), 0, 1);
    const volume = clamp((this.size / 58) * (0.028 + this.energy * 0.055) * (1 - crowdMix * 0.55), 0, 0.085);
    const pure = clamp(this.isolated, 0, 1);
    const waveBank = mode === "calme" ? ["sine", "triangle"] : mode === "stable" ? ["sine", "triangle", "square"] : ["sawtooth", "triangle", "square", "sine"];
    const wave = waveBank[(this.voice + Math.floor(speed * 2)) % waveBank.length];

    this.audio.osc.type = wave;
    this.audio.overtone.type = this.voice % 2 === 0 ? "triangle" : "sine";
    this.audio.osc.frequency.setTargetAtTime(freq, now, 0.055);
    this.audio.overtone.frequency.setTargetAtTime(freq * (1.5 + (this.voice % 4) * 0.125), now, 0.07);
    this.audio.gain.gain.setTargetAtTime(volume, now, 0.08);
    this.audio.overtoneGain.gain.setTargetAtTime(volume * lerp(0.08, 0.42, clamp(speed / settings.maxSpeed, 0, 1)), now, 0.12);
    this.audio.pan.pan.setTargetAtTime(xNorm * 2 - 1, now, 0.08);
    this.audio.filter.type = pure > 0.64 ? "lowpass" : this.voice % 3 === 0 ? "bandpass" : "highpass";
    this.audio.filter.frequency.setTargetAtTime(lerp(360, mode === "chaos" ? 7600 : 5200, 1 - yNorm) + this.nearCount * 130 + this.generation * 16, now, 0.08);
    this.audio.filter.Q.setTargetAtTime(lerp(0.6, 5.8, pure), now, 0.1);
    this.audio.lfo.frequency.setTargetAtTime(lerp(0.05, mode === "chaos" ? 18 : 7, clamp(speed / settings.maxSpeed, 0, 1)), now, 0.1);
    this.audio.lfoGain.gain.setTargetAtTime(lerp(0.4, mode === "chaos" ? 42 : 18, clamp(speed / settings.maxSpeed, 0, 1)), now, 0.08);
  }

  draw() {
    const speed = Math.hypot(this.vx, this.vy);
    const light = 48 + this.energy * 20 + speed * 5;
    const color = `hsl(${this.hue} 88% ${light}%)`;
    const projection = 1 + Math.sin(this.hyper + this.depth) * 0.18;
    const halo = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 6.8 * projection);
    halo.addColorStop(0, `hsla(${this.hue} 95% 65% / ${0.24 + this.energy * 0.2})`);
    halo.addColorStop(0.42, `hsla(${(this.hue + 42) % 360} 88% 58% / 0.12)`);
    halo.addColorStop(1, `hsla(${this.hue} 95% 55% / 0)`);

    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 5.8, 0, TAU);
    ctx.fill();

    const membrane = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 1.8);
    membrane.addColorStop(0, `hsla(${(this.hue + 24) % 360} 96% 74% / 0.92)`);
    membrane.addColorStop(0.58, `hsla(${this.hue} 88% ${light}% / 0.78)`);
    membrane.addColorStop(1, `hsla(${(this.hue + 130) % 360} 86% 42% / 0.82)`);
    ctx.fillStyle = membrane;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + this.energy * 24;
    ctx.beginPath();
    const points = sampleNurbsMembrane(this, 56);
    points.forEach((point, i) => {
      const x = this.x + point.x;
      const y = this.y + point.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `hsla(${(this.hue + 80) % 360} 94% 78% / ${0.26 + this.energy * 0.18})`;
    ctx.lineWidth = clamp(this.size * 0.08, 0.8, 2.4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `hsla(${(this.hue + 180) % 360} 90% 70% / 0.18)`;
    ctx.lineWidth = 0.75;
    for (let i = 0; i < this.gene.nuclei.length; i += 1) {
      const a = this.gene.nuclei[i] + this.phase * (0.42 + i * 0.05);
      const z = Math.sin(this.hyper + i) * 0.5 + 0.5;
      const r = this.size * (0.18 + z * 0.34);
      const nx = this.x + Math.cos(a) * r * projection;
      const ny = this.y + Math.sin(a * 1.37) * r * 0.76;
      ctx.beginPath();
      ctx.arc(nx, ny, Math.max(1.1, this.size * (0.045 + z * 0.03)), 0, TAU);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + this.isolated * 0.24})`;
    ctx.beginPath();
    ctx.arc(this.x - this.size * 0.2, this.y - this.size * 0.18, Math.max(1.4, this.size * 0.14), 0, TAU);
    ctx.fill();
  }
}

function createGenome(size, generation) {
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

function sampleNurbsMembrane(cell, sampleCount) {
  const controls = cell.gene.controls.map((control, i) => {
    const phase = cell.phase * control.spin + cell.hyper * 0.7 + i * 0.37;
    const fourD = Math.sin(cell.hyper + control.z * 2.4 + i) * 0.32;
    const projection = 1 / (1.35 - fourD * 0.34);
    const angle = control.angle + Math.sin(phase) * 0.16 + cell.gene.twist * 0.08;
    const fold = 1 + Math.sin(phase * control.fold) * 0.1 + Math.cos(cell.hyper + i) * 0.06;
    const radius = cell.size * control.radius * fold * projection;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * (0.82 + Math.sin(cell.depth + cell.hyper) * 0.1),
      w: control.w * (0.86 + projection * 0.18)
    };
  });

  const points = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const u = i / sampleCount;
    points.push(nurbsPoint(u, controls, cell.gene.degree, cell.gene.knots));
  }
  return points;
}

function nurbsPoint(u, controls, degree, knots) {
  let x = 0;
  let y = 0;
  let denominator = 0;
  for (let i = 0; i < controls.length; i += 1) {
    const b = bsplineBasis(i, degree, u, knots) * controls[i].w;
    x += controls[i].x * b;
    y += controls[i].y * b;
    denominator += b;
  }
  if (denominator === 0) return { x: controls[0].x, y: controls[0].y };
  return { x: x / denominator, y: y / denominator };
}

function bsplineBasis(i, degree, u, knots) {
  if (degree === 0) {
    return (knots[i] <= u && u < knots[i + 1]) || (u === 1 && knots[i + 1] === 1) ? 1 : 0;
  }

  const leftDenominator = knots[i + degree] - knots[i];
  const rightDenominator = knots[i + degree + 1] - knots[i + 1];
  const left = leftDenominator === 0 ? 0 : ((u - knots[i]) / leftDenominator) * bsplineBasis(i, degree - 1, u, knots);
  const right = rightDenominator === 0 ? 0 : ((knots[i + degree + 1] - u) / rightDenominator) * bsplineBasis(i + 1, degree - 1, u, knots);
  return left + right;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function init(newSeed = seed, selectedMode = mode) {
  seed = String(newSeed || Date.now());
  seedInput.value = seed;
  rng = mulberry32(hashSeed(seed));
  cells.forEach((cell) => cell.stopAudio());
  cells = [];
  bursts = [];
  storyTime = 0;
  nextCellId = 1;
  stats = { totalBorn: 0, manualBorn: 0, maxGeneration: 0 };
  mode = selectedMode;
  cells.push(new Cellule(width * 0.5, height * 0.5, 22, 1.12, rand(110, 190), { generation: 0, origin: "founder", voice: 0 }));
  addBurst(width * 0.5, height * 0.5, cells[0].hue, 1.2);
  updateModeButtons();
}

function step(time) {
  const dt = Math.min(40, time - lastTime);
  lastTime = time;
  storyTime += dt;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(8, 11, 10, 0.16)";
  ctx.fillRect(0, 0, width, height);

  drawField();
  updateRelations(dt);
  cells.forEach((cell) => cell.update(dt));
  evolve(dt);
  drawConnections();
  cells.forEach((cell) => cell.draw());
  drawBursts(dt);
  drawMouseField();
  updateReadout();
  updateAudioMix();

  requestAnimationFrame(step);
}

function updateRelations(dt) {
  const settings = modes[mode];
  cells.forEach((cell) => {
    cell.nearCount = 0;
    cell.isolated = 1;
  });

  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const a = cells[i];
      const b = cells[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const near = (a.size + b.size) * (mode === "calme" ? 6.2 : mode === "stable" ? 4.7 : 3.25);

      if (dist < near) {
        const strength = (1 - dist / near) * settings.attraction * dt;
        a.vx += (dx / dist) * strength;
        a.vy += (dy / dist) * strength;
        b.vx -= (dx / dist) * strength;
        b.vy -= (dy / dist) * strength;
        a.nearCount += 1;
        b.nearCount += 1;
        a.isolated = Math.min(a.isolated, dist / near);
        b.isolated = Math.min(b.isolated, dist / near);
      }

      const collision = dist < (a.size + b.size) * settings.fusionDistance;
      if (collision) {
        a.energy += 0.012 * dt;
        b.energy += 0.012 * dt;
        addBurst((a.x + b.x) / 2, (a.y + b.y) / 2, (a.hue + b.hue) / 2, 0.45);
        glitch(a, 0.18);
        glitch(b, 0.18);

        if (cells.length > MIN_CELLS && rand(0, 1) < (mode === "chaos" ? 0.0014 : 0.0048) * dt) {
          fuseCells(i, j);
          return;
        }
      }
    }
  }
}

function evolve(dt) {
  const settings = modes[mode];
  const capacity = Math.min(MAX_CELLS, settings.capacity);
  const genesisBoost = cells.length < Math.min(settings.target, 22) ? 1.8 : 1;

  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const cell = cells[i];
    const pressure = cells.length < settings.target ? 1.7 : 0.52;
    const birthWindow = cell.birthAge > 900 + cell.generation * 70;
    if (birthWindow && cell.energy > settings.division && cells.length < capacity && rand(0, 1) < settings.divisionChance * pressure * genesisBoost * dt) {
      divideCell(cell);
    }

    if ((cell.energy < 0.022 && cells.length > MIN_CELLS && storyTime > 12000) || cells.length > capacity) {
      cell.stopAudio();
      cells.splice(i, 1);
      addBurst(cell.x, cell.y, cell.hue, 0.28);
    }
  }

  if (cells.length === 1 && storyTime > settings.birthTempo) {
    cells[0].energy = Math.max(cells[0].energy, settings.division + 0.1);
    divideCell(cells[0]);
  }

  if (cells.length < MIN_CELLS) {
    cells.push(new Cellule(rand(80, width - 80), rand(80, height - 80), rand(8, 16), 0.7, rand(0, 360), { generation: 0, origin: "founder" }));
  }
}

function divideCell(cell) {
  cell.energy *= mode === "chaos" ? 0.62 : 0.5;
  cell.baseSize *= mode === "calme" ? 0.94 : 0.88;
  const angle = rand(0, TAU);
  const child = new Cellule(
    cell.x + Math.cos(angle) * cell.size * 1.8,
    cell.y + Math.sin(angle) * cell.size * 1.8,
    clamp(cell.baseSize * rand(0.72, 1.08), 5, 22),
    cell.energy * rand(0.72, 1.04),
    (cell.hue + rand(mode === "chaos" ? -98 : -32, mode === "chaos" ? 120 : 44) + 360) % 360,
    { generation: cell.generation + 1, origin: "division", voice: (cell.voice + 1 + Math.floor(rand(0, 6))) % 7 }
  );
  child.vx = cell.vx + Math.cos(angle) * rand(0.6, 1.5);
  child.vy = cell.vy + Math.sin(angle) * rand(0.6, 1.5);
  cells.push(child);
  addBurst(cell.x, cell.y, cell.hue, 0.75);
  glitch(cell, 0.5);
}

function fuseCells(i, j) {
  const a = cells[i];
  const b = cells[j];
  const merged = new Cellule(
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    clamp(Math.sqrt(a.size * a.size + b.size * b.size) * 0.82, 7, 34),
    clamp((a.energy + b.energy) * 0.58, 0.2, 1.25),
    (a.hue + b.hue) / 2,
    { generation: Math.max(a.generation, b.generation) + 1, origin: "fusion", voice: (a.voice + b.voice) % 7 }
  );
  merged.vx = (a.vx + b.vx) * 0.5;
  merged.vy = (a.vy + b.vy) * 0.5;
  a.stopAudio();
  b.stopAudio();
  cells.splice(j, 1);
  cells.splice(i, 1, merged);
  addBurst(merged.x, merged.y, merged.hue, 0.9);
  glitch(merged, 0.72);
}

function drawField() {
  const settings = modes[mode];
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (mode === "calme") {
    gradient.addColorStop(0, "rgba(5, 10, 8, 0.3)");
    gradient.addColorStop(0.45, "rgba(18, 45, 31, 0.12)");
    gradient.addColorStop(1, "rgba(5, 9, 10, 0.24)");
  } else if (mode === "stable") {
    gradient.addColorStop(0, "rgba(6, 10, 12, 0.28)");
    gradient.addColorStop(0.45, "rgba(9, 37, 43, 0.14)");
    gradient.addColorStop(1, "rgba(14, 9, 18, 0.18)");
  } else {
    gradient.addColorStop(0, "rgba(12, 6, 9, 0.32)");
    gradient.addColorStop(0.45, "rgba(48, 13, 22, 0.12)");
    gradient.addColorStop(1, "rgba(5, 8, 11, 0.26)");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";
  const streams = mode === "chaos" ? 38 : mode === "stable" ? 24 : 14;
  for (let i = 0; i < streams; i += 1) {
    const speed = mode === "chaos" ? 0.04 : mode === "stable" ? 0.018 : 0.007;
    const x = ((i * 193 + performance.now() * speed) % (width + 240)) - 120;
    const y = (Math.sin(i * 99 + performance.now() * 0.0003 * settings.density) * 0.5 + 0.5) * height;
    ctx.fillStyle = `hsla(${(i * 34 + (mode === "chaos" ? 330 : 150)) % 360} 80% 62% / ${mode === "chaos" ? 0.026 : 0.018})`;
    ctx.beginPath();
    ctx.arc(x, y, 70 + (i % 4) * (mode === "chaos" ? 46 : 34), 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawConnections() {
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const a = cells[i];
      const b = cells[j];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const limit = 150;
      if (dist < limit) {
        const alpha = (1 - dist / limit) * 0.18;
        const hue = (a.hue + b.hue) / 2;
        ctx.strokeStyle = `hsla(${hue} 92% 66% / ${alpha})`;
        ctx.lineWidth = 1 + alpha * 8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function addBurst(x, y, hue, force) {
  bursts.push({ x, y, hue, force, life: 1, radius: 6 + force * 22 });
  if (bursts.length > 80) bursts.shift();
}

function drawBursts(dt) {
  ctx.globalCompositeOperation = "lighter";
  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    const burst = bursts[i];
    burst.life -= dt * 0.0028;
    burst.radius += dt * (0.14 + burst.force * 0.08);
    if (burst.life <= 0) {
      bursts.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = `hsla(${burst.hue} 96% 68% / ${burst.life * 0.34})`;
    ctx.lineWidth = 1 + burst.force * 4;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, burst.radius, 0, TAU);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawMouseField() {
  if (!mouse.active) return;
  const radius = mouse.down ? 250 : 150;
  const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius);
  gradient.addColorStop(0, mouse.down ? "rgba(255, 92, 138, 0.18)" : "rgba(71, 199, 255, 0.12)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, radius, 0, TAU);
  ctx.fill();
}

function glitch(cell, amount) {
  if (!audio || !cell.audio) return;
  const now = audio.ctx.currentTime;
  const burst = audio.ctx.createBufferSource();
  const gain = audio.ctx.createGain();
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 0.045, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  burst.buffer = buffer;
  gain.gain.value = amount * 0.055;
  burst.connect(gain);
  gain.connect(audio.distortion);
  burst.start(now);

  cell.audio.gain.gain.cancelScheduledValues(now);
  cell.audio.gain.gain.setValueAtTime(Math.min(0.14, cell.audio.gain.gain.value + amount * 0.06), now);
  cell.audio.gain.gain.linearRampToValueAtTime(0.02, now + 0.05);
}

async function ensureAudio() {
  if (audio) {
    if (audio.ctx.state === "suspended") await audio.ctx.resume();
    return audio;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const ctxAudio = new AudioContext();
  const master = ctxAudio.createGain();
  const dry = ctxAudio.createGain();
  const wet = ctxAudio.createGain();
  const delay = ctxAudio.createDelay(1.2);
  const feedback = ctxAudio.createGain();
  const convolver = ctxAudio.createConvolver();
  const distortion = ctxAudio.createWaveShaper();
  const destination = ctxAudio.createMediaStreamDestination();

  master.gain.value = modes[mode].master;
  dry.gain.value = 0.74;
  wet.gain.value = 0.42;
  delay.delayTime.value = 0.28;
  feedback.gain.value = 0.34;
  convolver.buffer = impulse(ctxAudio, 2.8, 2.5);
  distortion.curve = distortionCurve(90);
  distortion.oversample = "2x";

  dry.connect(master);
  wet.connect(delay);
  wet.connect(convolver);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(master);
  convolver.connect(master);
  distortion.connect(master);
  master.connect(ctxAudio.destination);
  master.connect(destination);

  audio = { ctx: ctxAudio, master, dry, wet, delay, feedback, convolver, distortion, destination };
  cells.forEach((cell) => cell.attachAudio());
  audioState.textContent = "son actif";
  audioToggle.textContent = "Couper le son";
  return audio;
}

function updateAudioMix() {
  if (!audio) return;
  const settings = modes[mode];
  const now = audio.ctx.currentTime;
  audio.master.gain.setTargetAtTime(settings.master, now, 0.18);
  audio.delay.delayTime.setTargetAtTime(settings.delay, now, 0.22);
  audio.feedback.gain.setTargetAtTime(settings.feedback, now, 0.18);
  audio.wet.gain.setTargetAtTime(settings.reverb, now, 0.24);
}

function impulse(ctxAudio, seconds, decay) {
  const length = ctxAudio.sampleRate * seconds;
  const buffer = ctxAudio.createBuffer(2, length, ctxAudio.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function distortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function setMode(nextMode) {
  mode = nextMode;
  updateModeButtons();
  if (mode === "chaos") {
    cells.forEach((cell) => {
      cell.energy = Math.max(cell.energy, 0.82);
      cell.vx *= 1.55;
      cell.vy *= 1.55;
    });
    while (cells.length < Math.min(18, modes.chaos.target)) {
      const parent = cells[Math.floor(rand(0, cells.length))];
      divideCell(parent);
    }
  } else if (mode === "calme") {
    cells.forEach((cell) => {
      cell.energy *= 0.72;
      cell.vx *= 0.62;
      cell.vy *= 0.62;
    });
  } else {
    cells.forEach((cell, index) => {
      const angle = (index / Math.max(1, cells.length)) * TAU;
      cell.vx += Math.cos(angle) * 0.35;
      cell.vy += Math.sin(angle) * 0.35;
      cell.energy = Math.max(cell.energy, 0.58);
    });
  }
}

function updateModeButtons() {
  document.body.dataset.mode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  modeName.textContent = mode;
}

function updateReadout() {
  cellCount.textContent = String(cells.length);
  birthCount.textContent = String(stats.totalBorn);
  manualCount.textContent = String(stats.manualBorn);
  generationCount.textContent = String(stats.maxGeneration);
  if (cells.length === 1) storyState.textContent = "germe";
  else if (cells.length < 12) storyState.textContent = "naissance";
  else if (cells.length < modes[mode].target * 0.7) storyState.textContent = "croissance";
  else if (mode === "chaos") storyState.textContent = "mutation";
  else if (mode === "calme") storyState.textContent = "respiration";
  else storyState.textContent = "equilibre";
}

async function enterImmersive() {
  immersive = true;
  document.body.classList.add("immersive");
  fullscreenButton.textContent = "Quitter plein ecran";

  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      return;
    }
  }
}

async function exitImmersive() {
  immersive = false;
  document.body.classList.remove("immersive");
  fullscreenButton.textContent = "Plein ecran";

  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch (error) {
      return;
    }
  }
}

function syncFullscreenState() {
  if (!document.fullscreenElement && immersive) {
    immersive = false;
    document.body.classList.remove("immersive");
    fullscreenButton.textContent = "Plein ecran";
  }
}

function addCellFromPointer(event, large = false) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const parentGeneration = cells.length ? cells.reduce((max, cell) => Math.max(max, cell.generation), 0) : 0;
  const cell = new Cellule(x, y, large ? rand(22, 38) : rand(8, 18), large ? 1.12 : 0.82, rand(0, 360), {
    generation: parentGeneration + 1,
    origin: "manual",
    voice: Math.floor(rand(0, 7))
  });
  cells.push(cell);
  cell.attachAudio();
  if (cells.length > Math.min(MAX_CELLS, modes[mode].capacity)) {
    const removed = cells.shift();
    removed.stopAudio();
  }
  addBurst(x, y, rand(0, 360), large ? 1 : 0.55);
}

function saveOrganism() {
  const data = {
    seed,
    mode,
    storyTime,
    stats,
    cells: cells.map((cell) => ({
      id: cell.id,
      x: cell.x / width,
      y: cell.y / height,
      vx: cell.vx,
      vy: cell.vy,
      size: cell.baseSize,
      energy: cell.energy,
      hue: cell.hue,
      generation: cell.generation,
      origin: cell.origin,
      voice: cell.voice
    }))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  saveButton.textContent = "Sauvegarde OK";
  setTimeout(() => {
    saveButton.textContent = "Sauvegarder";
  }, 900);
}

function loadOrganism() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    loadButton.textContent = "Rien a charger";
    setTimeout(() => {
      loadButton.textContent = "Charger";
    }, 900);
    return;
  }

  const data = JSON.parse(saved);
  init(data.seed, data.mode);
  cells.forEach((cell) => cell.stopAudio());
  stats = data.stats || { totalBorn: data.cells.length, manualBorn: 0, maxGeneration: 0 };
  storyTime = data.storyTime || 0;
  cells = data.cells.map((item) => {
    const cell = new Cellule(item.x * width, item.y * height, item.size, item.energy, item.hue, {
      generation: item.generation || 0,
      origin: item.origin || "organisme",
      voice: item.voice || 0,
      count: false
    });
    cell.vx = item.vx;
    cell.vy = item.vy;
    return cell;
  });
  nextCellId = Math.max(...cells.map((cell) => cell.id), 0) + 1;
  stats.maxGeneration = cells.reduce((max, cell) => Math.max(max, cell.generation), stats.maxGeneration || 0);
  cells.forEach((cell) => cell.attachAudio());
}

function startRecording() {
  if (!audio) return;
  recordedChunks = [];
  recorder = new MediaRecorder(audio.destination.stream);
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `organisme-${seed}.webm`;
    link.click();
    URL.revokeObjectURL(url);
  };
  recorder.start();
  recordButton.textContent = "Stop";
}

function stopRecording() {
  if (!recorder) return;
  recorder.stop();
  recorder = null;
  recordButton.textContent = "Enregistrer";
}

function rand(min, max) {
  return rng() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hashSeed(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

window.addEventListener("resize", resize);

canvas.addEventListener("pointermove", (event) => {
  mouse.px = mouse.x;
  mouse.py = mouse.y;
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  mouse.active = true;
});

canvas.addEventListener("pointerdown", async (event) => {
  await ensureAudio();
  mouse.down = true;
  mouse.holdStart = performance.now();
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  mouse.active = true;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointerup", (event) => {
  const held = performance.now() - mouse.holdStart;
  mouse.down = false;
  addCellFromPointer(event, held > 420);
});

canvas.addEventListener("pointerleave", () => {
  mouse.active = false;
  mouse.down = false;
});

audioToggle.addEventListener("click", async () => {
  if (!audio || audio.ctx.state === "suspended") {
    await ensureAudio();
    audioState.textContent = "son actif";
    audioToggle.textContent = "Couper le son";
  } else {
    await audio.ctx.suspend();
    audioState.textContent = "son suspendu";
    audioToggle.textContent = "Reprendre le son";
  }
});

fullscreenButton.addEventListener("click", async () => {
  if (immersive) await exitImmersive();
  else await enterImmersive();
});

document.addEventListener("fullscreenchange", syncFullscreenState);

document.addEventListener("keydown", async (event) => {
  if (event.target instanceof Element && event.target.closest("input, button, textarea, select")) return;
  if (event.key.toLowerCase() === "h") {
    if (immersive) await exitImmersive();
    else await enterImmersive();
  }
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

seedButton.addEventListener("click", () => {
  init(String(Math.floor(Math.random() * 999999999)), mode);
});

seedInput.addEventListener("change", () => {
  init(seedInput.value.trim() || "organisme", mode);
});

saveButton.addEventListener("click", saveOrganism);
loadButton.addEventListener("click", loadOrganism);
recordButton.addEventListener("click", async () => {
  await ensureAudio();
  if (recorder) stopRecording();
  else startRecording();
});

resize();
init(seed, mode);
requestAnimationFrame(step);
