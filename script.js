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
const mappingState = document.getElementById("mappingState");
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
let entities = [];
let spores = [];
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
let nextGenesisAt = 900;
let nextCellId = 1;
let stats = { totalBorn: 0, manualBorn: 0, maxGeneration: 0 };
let listenerOrbit = 0;
let activeGrains = 0;
let additive = null;
let temporal = {
  local: 0,
  medium: 0,
  long: 0,
  pointDensity: 0.55,
  soundDensity: 0.28,
  clusterDensity: 0.45,
  macroPressure: 0.35,
  grainDebt: 0,
  fps: 60,
  quality: 1
};
const basisCache = new Map();
let lastFrameError = "";

const NOTE_NAMES = ["C", "D", "E", "G", "A", "B", "D+", "E+"];
const VOICE_NAMES = ["vowel", "glass", "metal", "grain", "organ", "string", "fold"];

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
    birthTempo: 3600,
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
    birthTempo: 2300,
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
    birthTempo: 1100,
    story: "mutation"
  }
};

function mapCellToSoundAndLight(cell, speed) {
  const settings = modes[mode];
  const xNorm = cell.x / Math.max(1, width);
  const yNorm = cell.y / Math.max(1, height);
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const dx = cell.x - centerX;
  const dy = cell.y - centerY;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / Math.max(1, width * 0.5);
  const ny = dy / Math.max(1, height * 0.5);
  const radialVelocity = (cell.vx * dx + cell.vy * dy) / dist;
  const verticalMotion = clamp(-cell.vy / settings.maxSpeed, -1, 1);
  const horizontalMotion = clamp(cell.vx / settings.maxSpeed, -1, 1);
  const depthMotion = clamp((radialVelocity + Math.sin(cell.hyper) * 0.8) / settings.maxSpeed, -1, 1);
  const populationDensity = clamp(cells.length / Math.max(1, settings.capacity), 0, 1);
  const density = clamp(populationDensity * 0.68 + temporal.clusterDensity * 0.32, 0, 1);
  const proximity = clamp(cell.nearCount / 8, 0, 1);
  const isolation = clamp(cell.isolated, 0, 1);
  const speedNorm = clamp(speed / settings.maxSpeed, 0, 1);
  const energyNorm = clamp(cell.energy / 1.42, 0, 1);
  const scale = settings.scale;
  const noteIndex = (cell.noteSeed + cell.generation + cell.nearCount + Math.floor(xNorm * scale.length)) % scale.length;
  const baseNote = scale[noteIndex];
  const octave = mode === "calme" ? 1 + (cell.generation % 2) * 0.5 : mode === "stable" ? 1 + (cell.generation % 3) * 0.5 : 0.5 + (cell.id % 5) * 0.5;
  const chord = [1, 1.125, 1.25, 1.333, 1.5, 1.666, 2][(cell.voice + cell.nearCount) % 7];
  const motionChaos = Math.sin(storyTime * 0.0017 + cell.id * 12.9898 + cell.voice) * cell.motionJitter;
  const horizontalColor = horizontalMotion * (0.018 + cell.motionJitter * 0.018);
  const dopplerBend = Math.pow(2, verticalMotion * (mode === "chaos" ? 0.42 : 0.24) + depthMotion * 0.09 + motionChaos * 0.06);
  const bend = (lerp(0.985, 1.015, xNorm) + Math.sin(cell.hyper) * (mode === "chaos" ? 0.028 : 0.012) + horizontalColor) * dopplerBend;
  const frequency = baseNote * octave * chord * bend;
  const volume = clamp((cell.size / 66) * (0.018 + energyNorm * 0.072) * (1 - density * 0.48) * (0.74 + temporal.soundDensity * 0.52), 0, 0.095);
  const brightness = clamp(0.14 + (1 - yNorm) * 0.38 + speedNorm * 0.24 + proximity * 0.16 + temporal.pointDensity * 0.22, 0, 1);
  const modulation = clamp(speedNorm * 0.54 + proximity * 0.24 + temporal.local * 0.22 + temporal.clusterDensity * 0.18 + (mode === "chaos" ? 0.18 : 0), 0, 1);
  const dimension = clamp(Math.sin(cell.hyper + cell.depth + temporal.long * TAU) * 0.5 + 0.5 + energyNorm * 0.22 + proximity * 0.16 + temporal.macroPressure * 0.28, 0, 1.65);
  const waveBank = mode === "calme" ? ["sine", "triangle"] : mode === "stable" ? ["sine", "triangle", "square"] : ["sawtooth", "triangle", "square", "sine"];

  return {
    noteName: NOTE_NAMES[noteIndex % NOTE_NAMES.length],
    voiceName: VOICE_NAMES[cell.voice % VOICE_NAMES.length],
    frequency,
    volume,
    brightness,
    modulation: clamp(modulation + Math.abs(horizontalMotion) * 0.22 + Math.abs(depthMotion) * 0.12, 0, 1.35),
    dimension,
    hue: (frequency * 0.33 + cell.generation * 22 + cell.voice * 37 + modeHueOffset()) % 360,
    chordHue: chord * 88,
    aura: lerp(4.4, 10.5, dimension) + proximity * 2.5,
    opacity: lerp(0.52, 0.95, energyNorm),
    timbre: waveBank[(cell.voice + Math.floor(speedNorm * 5) + cell.nearCount) % waveBank.length],
    pan: xNorm * 2 - 1,
    spatialX: clamp(nx * 7 + horizontalMotion * 2.5, -10, 10),
    spatialY: clamp(-ny * 3 + verticalMotion * 4, -6, 6),
    spatialZ: clamp((Math.sin(cell.hyper + cell.depth) + depthMotion * 1.8) * 5.5, -9, 9),
    doppler: dopplerBend,
    verticalMotion,
    horizontalMotion,
    depthMotion,
    filterType: isolation > 0.64 ? "lowpass" : cell.voice % 3 === 0 ? "bandpass" : "highpass",
    filterFrequency: lerp(260, mode === "chaos" ? 9200 : 6200, brightness) + cell.generation * 18 + Math.abs(horizontalMotion) * 1800,
    resonance: lerp(0.8, 8.4, isolation) + proximity * 1.8 + Math.abs(depthMotion) * 2.2,
    overtoneRatio: [1.5, 1.666, 1.875, 2, 2.25][(cell.voice + cell.generation) % 5],
    overtoneLevel: lerp(0.1, mode === "chaos" ? 0.66 : 0.44, modulation),
    modulationRate: lerp(0.05, mode === "chaos" ? 24 : 9, modulation),
    modulationDepth: lerp(0.3, mode === "chaos" ? 58 : 24, modulation)
  };
}

function modeHueOffset() {
  if (mode === "calme") return 110;
  if (mode === "stable") return 185;
  return 320;
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function hue(value, fallback = 160) {
  const safe = finite(value, fallback) % 360;
  return safe < 0 ? safe + 360 : safe;
}

function setAudioParam(param, value, now, smoothing) {
  if (param && typeof param.setTargetAtTime === "function") {
    param.setTargetAtTime(value, now, smoothing);
  }
}

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
    this.noteSeed = options.noteSeed ?? Math.floor(rand(0, 12));
    this.motionJitter = rand(0.04, 0.24);
    this.motionMemory = { vx: this.vx, vy: this.vy };
    this.gene = createGenome(size, this.generation);
    this.mapping = {
      noteName: "C",
      frequency: 110,
      volume: 0,
      brightness: 0.5,
      modulation: 0,
      dimension: 0,
      aura: 1,
      opacity: 0.7,
      timbre: "sine"
    };
    this.mapping = mapCellToSoundAndLight(this, Math.hypot(this.vx, this.vy));
    this.isolated = 1;
    this.nearCount = 0;
    this.audio = null;
    if (options.count !== false) {
      stats.totalBorn += 1;
      if (this.origin === "manual") stats.manualBorn += 1;
      stats.maxGeneration = Math.max(stats.maxGeneration, this.generation);
      spawnEntity(this, this.origin === "manual" ? 1.55 : 1);
      playBirthChord(this);
    }
  }

  attachAudio() {
    if (!audio || this.audio) return;

    if (this.id % Math.ceil(Math.max(1, cells.length / AUDIO_CELL_LIMIT)) !== 0 && cells.length > AUDIO_CELL_LIMIT) return;

    const osc = audio.ctx.createOscillator();
    const overtone = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    const overtoneGain = audio.ctx.createGain();
    const panner = audio.ctx.createPanner();
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
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 2.2;
    panner.maxDistance = 22;
    panner.rolloffFactor = 1.35;
    panner.coneInnerAngle = 180;
    panner.coneOuterAngle = 280;
    panner.coneOuterGain = 0.22;
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
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(audio.wet);
    gain.connect(audio.dry);

    osc.start();
    overtone.start();
    lfo.start();
    this.audio = { osc, overtone, gain, overtoneGain, panner, filter, shaper, lfo, lfoGain };
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

    const centerDx = this.x - width * 0.5;
    const centerDy = this.y - height * 0.5;
    const centerDist = Math.hypot(centerDx, centerDy) || 1;
    const orbitForce = (0.003 + temporal.local * 0.006 + temporal.macroPressure * 0.002) * dt;
    this.vx += (-centerDy / centerDist) * orbitForce;
    this.vy += (centerDx / centerDist) * orbitForce;

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

    entities.forEach((entity) => {
      const dx = this.x - entity.x;
      const dy = this.y - entity.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < entity.radius) {
        const warp = (1 - dist / entity.radius) * entity.force * dt * 0.0009;
        const tangent = entity.spin;
        this.vx += ((dx / dist) * 0.45 + (-dy / dist) * tangent) * warp;
        this.vy += ((dy / dist) * 0.45 + (dx / dist) * tangent) * warp;
        this.hyper += warp * 0.5;
        this.energy = clamp(this.energy + warp * 0.12, 0, 1.42);
      }
    });

    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = settings.maxSpeed;
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    } else if (speed < 0.12) {
      const wake = this.phase + this.id * 1.618;
      this.vx += Math.cos(wake) * 0.045;
      this.vy += Math.sin(wake) * 0.045;
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
    this.mapping = mapCellToSoundAndLight(this, speed);
    this.motionMemory.vx = lerp(this.motionMemory.vx, this.vx, 0.08);
    this.motionMemory.vy = lerp(this.motionMemory.vy, this.vy, 0.08);
    this.hue = (this.mapping.hue + (this.nearCount * 0.006 + speed * 0.008) * dt) % 360;

    this.updateAudio(speed);
  }

  updateAudio(speed) {
    if (!audio) return;
    this.attachAudio();
    if (!this.audio) return;
    const now = audio.ctx.currentTime;
    const mapping = this.mapping;

    this.audio.osc.type = mapping.timbre;
    this.audio.overtone.type = this.voice % 2 === 0 ? "triangle" : "sine";
    this.audio.osc.frequency.setTargetAtTime(mapping.frequency, now, 0.055);
    this.audio.overtone.frequency.setTargetAtTime(mapping.frequency * mapping.overtoneRatio, now, 0.07);
    this.audio.gain.gain.setTargetAtTime(mapping.volume, now, 0.08);
    this.audio.overtoneGain.gain.setTargetAtTime(mapping.volume * mapping.overtoneLevel, now, 0.12);
    setAudioParam(this.audio.panner.positionX, mapping.spatialX, now, 0.08);
    setAudioParam(this.audio.panner.positionY, mapping.spatialY, now, 0.08);
    setAudioParam(this.audio.panner.positionZ, mapping.spatialZ, now, 0.08);
    setAudioParam(this.audio.panner.orientationX, mapping.horizontalMotion, now, 0.1);
    setAudioParam(this.audio.panner.orientationY, mapping.verticalMotion, now, 0.1);
    setAudioParam(this.audio.panner.orientationZ, -1, now, 0.1);
    this.audio.filter.type = mapping.filterType;
    this.audio.filter.frequency.setTargetAtTime(mapping.filterFrequency, now, 0.08);
    this.audio.filter.Q.setTargetAtTime(mapping.resonance, now, 0.1);
    this.audio.lfo.frequency.setTargetAtTime(mapping.modulationRate, now, 0.1);
    this.audio.lfoGain.gain.setTargetAtTime(mapping.modulationDepth, now, 0.08);
  }

  draw() {
    const speed = Math.hypot(this.vx, this.vy);
    const mapping = this.mapping;
    const light = 42 + mapping.brightness * 34 + speed * 3;
    const baseHue = hue(mapping.hue);
    const color = `hsl(${baseHue} 88% ${finite(light, 58)}%)`;
    const projection = 1 + mapping.dimension * 0.42;
    const x = finite(this.x, width * 0.5);
    const y = finite(this.y, height * 0.5);
    const safeSize = clamp(finite(this.size, 10), 1, 80);
    const haloRadius = clamp(finite(safeSize * mapping.aura * projection, safeSize * 6), 1, Math.max(width, height) * 1.1);
    const membraneRadius = clamp(finite(safeSize * 1.8, 18), 1, 180);
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    halo.addColorStop(0, `hsla(${baseHue} 95% 65% / ${clamp(0.16 + finite(mapping.volume) * 3.4, 0, 0.75)})`);
    halo.addColorStop(0.42, `hsla(${hue(baseHue + finite(mapping.chordHue, 88))} 88% 58% / ${clamp(0.08 + finite(mapping.modulation) * 0.1, 0, 0.38)})`);
    halo.addColorStop(1, `hsla(${baseHue} 95% 55% / 0)`);

    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, clamp(safeSize * 5.8, 1, Math.max(width, height)), 0, TAU);
    ctx.fill();

    const membrane = ctx.createRadialGradient(x, y, 0, x, y, membraneRadius);
    membrane.addColorStop(0, `hsla(${hue(baseHue + 24)} 96% 74% / ${clamp(finite(mapping.opacity, 0.7), 0, 1)})`);
    membrane.addColorStop(0.58, `hsla(${baseHue} 88% ${finite(light, 58)}% / ${clamp(finite(mapping.opacity, 0.7) * 0.82, 0, 1)})`);
    membrane.addColorStop(1, `hsla(${hue(baseHue + 130)} 86% 42% / ${clamp(finite(mapping.opacity, 0.7) * 0.88, 0, 1)})`);
    ctx.fillStyle = membrane;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + this.energy * 24;
    ctx.beginPath();
    const points = sampleNurbsMembrane(this, Math.floor((20 + temporal.pointDensity * 26) * temporal.quality));
    points.forEach((point, i) => {
      const px = x + point.x;
      const py = y + point.y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue(baseHue + 80)} 94% 78% / ${clamp(0.2 + finite(mapping.brightness, 0.5) * 0.26, 0, 0.6)})`;
    ctx.lineWidth = clamp(safeSize * (0.055 + mapping.modulation * 0.045), 0.8, 3.2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `hsla(${hue(baseHue + 44)} 96% 68% / ${clamp(0.07 + finite(mapping.dimension, 0.5) * 0.12, 0, 0.35)})`;
    ctx.lineWidth = 0.75;
    const lattice = Math.min(points.length, Math.floor(5 + temporal.clusterDensity * 12));
    for (let i = 0; i < lattice; i += 1) {
      const a = points[(i * 3) % points.length];
      const b = points[(i * 7 + 5) % points.length];
      ctx.beginPath();
      ctx.moveTo(x + a.x, y + a.y);
      ctx.lineTo(x + b.x, y + b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = `hsla(${hue(baseHue + 180)} 90% 70% / ${clamp(0.12 + finite(mapping.dimension, 0.5) * 0.2, 0, 0.5)})`;
    ctx.lineWidth = 0.75;
    const nucleiCount = Math.min(this.gene.nuclei.length, Math.max(1, Math.floor((1 + temporal.pointDensity * this.gene.nuclei.length) * temporal.quality)));
    for (let i = 0; i < nucleiCount; i += 1) {
      const a = this.gene.nuclei[i] + this.phase * (0.42 + i * 0.05);
      const z = Math.sin(this.hyper + i) * 0.5 + 0.5;
      const r = safeSize * (0.18 + z * 0.34);
      const nx = x + Math.cos(a) * r * projection;
      const ny = y + Math.sin(a * 1.37) * r * 0.76;
      ctx.beginPath();
      ctx.arc(nx, ny, Math.max(1.1, safeSize * (0.045 + z * 0.03)), 0, TAU);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + this.isolated * 0.24})`;
    ctx.beginPath();
    ctx.arc(x - safeSize * 0.2, y - safeSize * 0.18, Math.max(1.4, safeSize * 0.14), 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `hsla(${hue(baseHue + (mapping.horizontalMotion > 0 ? 55 : 260))} 96% 72% / ${clamp(0.08 + Math.abs(finite(mapping.horizontalMotion)) * 0.24, 0, 0.4)})`;
    ctx.lineWidth = clamp(safeSize * 0.035, 0.6, 1.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - this.vx * 18, y - this.vy * 18);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
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
    const mapping = cell.mapping;
    const fourD = Math.sin(cell.hyper + control.z * 2.4 + i) * (0.26 + mapping.dimension * 0.32);
    const projection = 1 / (1.38 - fourD * 0.42);
    const angle = control.angle + Math.sin(phase) * 0.16 + cell.gene.twist * 0.08;
    const fold = 1 + Math.sin(phase * control.fold) * (0.08 + mapping.modulation * 0.1) + Math.cos(cell.hyper + i) * 0.06;
    const radius = cell.size * control.radius * fold * projection;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * (0.82 + Math.sin(cell.depth + cell.hyper) * 0.1),
      w: control.w * (0.86 + projection * 0.18)
    };
  });

  return sampleWeightedNurbs(controls, cell.gene.degree, cell.gene.knots, sampleCount);
}

function sampleWeightedNurbs(controls, degree, knots, sampleCount) {
  const count = Math.max(8, Math.floor(sampleCount));
  const basisSamples = getBasisSamples(controls.length, degree, knots, count);
  const points = [];
  for (let s = 0; s < basisSamples.length; s += 1) {
    const basis = basisSamples[s];
    let x = 0;
    let y = 0;
    let denominator = 0;
    for (let i = 0; i < controls.length; i += 1) {
      const b = basis[i] * controls[i].w;
      x += controls[i].x * b;
      y += controls[i].y * b;
      denominator += b;
    }
    if (denominator === 0) points.push({ x: finite(controls[0].x), y: finite(controls[0].y) });
    else points.push({ x: finite(x / denominator), y: finite(y / denominator) });
  }
  return points;
}

function getBasisSamples(controlCount, degree, knots, sampleCount) {
  const key = `${controlCount}:${degree}:${sampleCount}`;
  if (basisCache.has(key)) return basisCache.get(key);
  const basisSamples = [];
  for (let s = 0; s < sampleCount; s += 1) {
    const u = s / sampleCount;
    const basis = [];
    for (let i = 0; i < controlCount; i += 1) {
      basis.push(bsplineBasis(i, degree, u, knots));
    }
    basisSamples.push(basis);
  }
  if (basisCache.size > 80) basisCache.clear();
  basisCache.set(key, basisSamples);
  return basisSamples;
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
  if (denominator === 0) return { x: finite(controls[0].x), y: finite(controls[0].y) };
  return { x: finite(x / denominator), y: finite(y / denominator) };
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
  entities = [];
  spores = [];
  storyTime = 0;
  nextGenesisAt = 900;
  nextCellId = 1;
  activeGrains = 0;
  additive = null;
  lastFrameError = "";
  temporal = {
    local: 0,
    medium: 0,
    long: 0,
    pointDensity: 0.55,
    soundDensity: 0.28,
    clusterDensity: 0.45,
    macroPressure: 0.35,
    grainDebt: 0,
    fps: 60,
    quality: 1
  };
  stats = { totalBorn: 0, manualBorn: 0, maxGeneration: 0 };
  mode = selectedMode;
  const founderX = width > 760 ? width * 0.68 : width * 0.52;
  const founderY = height > 560 ? height * 0.5 : height * 0.68;
  const founder = new Cellule(founderX, founderY, 24, 1.18, rand(110, 190), { generation: 0, origin: "founder", voice: 0 });
  cells.push(founder);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * TAU + rand(-0.22, 0.22);
    const distance = rand(34, 82);
    const child = new Cellule(
      founderX + Math.cos(angle) * distance,
      founderY + Math.sin(angle) * distance,
      rand(8, 15),
      rand(0.72, 0.98),
      (founder.hue + i * 42 + rand(-16, 16) + 360) % 360,
      { generation: 1, origin: "division", voice: i % 7 }
    );
    child.vx = Math.cos(angle) * rand(0.35, 0.95);
    child.vy = Math.sin(angle) * rand(0.35, 0.95);
    cells.push(child);
  }
  stats.maxGeneration = 1;
  addBurst(founderX, founderY, founder.hue, 1.2);
  spawnEntity(founder, 1.4);
  updateModeButtons();
}

function step(time) {
  try {
    const frameDt = time - lastTime;
    const dt = Math.min(40, frameDt);
    lastTime = time;
    updatePerformance(frameDt);
    storyTime += dt;
    updateTemporalControls(dt);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(8, 11, 10, 0.16)";
    ctx.fillRect(0, 0, width, height);

    drawField();
    updateSpores(dt);
    drawSpores();
    drawEntities(dt);
    updateRelations(dt);
    cells.forEach((cell) => cell.update(dt));
    evolve(dt);
    drawConnections();
    cells.forEach((cell) => cell.draw());
    drawBursts(dt);
    drawMouseField();
    updateReadout();
    updateAudioMix(dt);
  } catch (error) {
    lastFrameError = error instanceof Error ? error.message : String(error);
    temporal.quality = Math.max(0.35, temporal.quality * 0.7);
    console.warn("Frame recovered:", lastFrameError);
  } finally {
    requestAnimationFrame(step);
  }
}

function updatePerformance(frameDt) {
  const instantFps = frameDt > 0 ? 1000 / frameDt : 60;
  temporal.fps = lerp(temporal.fps, clamp(instantFps, 8, 90), 0.06);
  const targetQuality = temporal.fps < 24 ? 0.42 : temporal.fps < 38 ? 0.62 : temporal.fps < 52 ? 0.82 : 1;
  temporal.quality = lerp(temporal.quality, targetQuality, 0.04);
}

function updateTemporalControls(dt) {
  const settings = modes[mode];
  const density = clamp(cells.length / Math.max(1, settings.capacity), 0, 1);
  temporal.local = (temporal.local + dt * (0.0018 + settings.density * 0.00055 + density * 0.0009)) % 1;
  temporal.medium = (temporal.medium + dt * (0.00018 + settings.density * 0.00006 + density * 0.00012)) % 1;
  temporal.long = (temporal.long + dt * (0.000018 + settings.density * 0.000008 + density * 0.000012)) % 1;

  const localPulse = Math.sin(temporal.local * TAU) * 0.5 + 0.5;
  const mediumPulse = Math.sin(temporal.medium * TAU + density * 2.4) * 0.5 + 0.5;
  const longPulse = Math.sin(temporal.long * TAU + cells.length * 0.018) * 0.5 + 0.5;
  const jitter = Math.sin(storyTime * 0.017 + cells.length * 12.17) * 0.5 + 0.5;

  temporal.pointDensity = clamp(0.18 + localPulse * 0.42 + mediumPulse * 0.2 + density * 0.38, 0.08, 1.35);
  temporal.soundDensity = clamp(0.08 + localPulse * 0.34 + mediumPulse * 0.18 + longPulse * 0.2 + density * 0.46 + jitter * 0.08, 0.05, mode === "chaos" ? 1.45 : 1.05);
  temporal.clusterDensity = clamp(0.12 + mediumPulse * 0.58 + density * 0.42, 0.08, 1.25);
  temporal.macroPressure = clamp(0.12 + longPulse * 0.72 + density * 0.25, 0.08, 1.2);
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

  if (storyTime >= nextGenesisAt && cells.length > 0 && cells.length < Math.min(settings.target, capacity)) {
    const parent = cells.reduce((best, cell) => {
      const score = cell.energy + cell.size * 0.012 - cell.generation * 0.006;
      const bestScore = best.energy + best.size * 0.012 - best.generation * 0.006;
      return score > bestScore ? cell : best;
    }, cells[0]);
    parent.energy = Math.max(parent.energy, settings.division + 0.16);
    parent.birthAge = Math.max(parent.birthAge, 1300 + parent.generation * 70);
    divideCell(parent);
    const acceleration = cells.length < 8 ? 0.42 : cells.length < 24 ? 0.7 : 1;
    nextGenesisAt = storyTime + settings.birthTempo * acceleration * rand(0.55, 0.95);
  }

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
    nextGenesisAt = storyTime + settings.birthTempo * 0.5;
  }

  if (cells.length < MIN_CELLS) {
    cells.push(new Cellule(rand(80, width - 80), rand(80, height - 80), rand(8, 16), 0.7, rand(0, 360), { generation: 0, origin: "founder" }));
  }
}

function divideCell(cell) {
  if (cells.length >= Math.min(MAX_CELLS, modes[mode].capacity)) return null;
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
  emitSpores(child, mode === "chaos" ? 90 : mode === "stable" ? 48 : 24, 0.8);
  glitch(cell, 0.5);
  return child;
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
  const streams = Math.floor((mode === "chaos" ? 30 : mode === "stable" ? 20 : 12) * (0.55 + temporal.pointDensity * 0.65) * temporal.quality);
  for (let i = 0; i < streams; i += 1) {
    const speed = mode === "chaos" ? 0.04 : mode === "stable" ? 0.018 : 0.007;
    const x = ((i * 193 + performance.now() * speed) % (width + 240)) - 120;
    const y = (Math.sin(i * 99 + performance.now() * 0.0003 * settings.density) * 0.5 + 0.5) * height;
    ctx.fillStyle = `hsla(${(i * 34 + (mode === "chaos" ? 330 : 150)) % 360} 80% 62% / ${(mode === "chaos" ? 0.022 : 0.014) * (0.7 + temporal.pointDensity)})`;
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
      const limit = 80 + temporal.clusterDensity * 90 * temporal.quality;
      if (dist < limit) {
        const alpha = (1 - dist / limit) * (0.08 + temporal.clusterDensity * 0.18);
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

function emitSpores(cell, amount, force = 1) {
  const settings = modes[mode];
  const cap = mode === "chaos" ? 4200 : mode === "stable" ? 2600 : 1400;
  const count = Math.min(amount, Math.max(0, cap - spores.length));
  const mapping = cell.mapping || mapCellToSoundAndLight(cell, Math.hypot(cell.vx, cell.vy));
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, TAU);
    const shell = Math.pow(rand(0, 1), mode === "chaos" ? 0.38 : 0.62);
    const radius = rand(cell.size * 0.7, cell.size * (mode === "chaos" ? 18 : 10)) * shell;
    const speed = rand(0.08, settings.maxSpeed * 0.72) * force;
    const dimension = rand(-1, 1);
    spores.push({
      x: cell.x + Math.cos(angle) * radius,
      y: cell.y + Math.sin(angle) * radius,
      vx: Math.cos(angle + rand(-0.7, 0.7)) * speed + cell.vx * 0.2,
      vy: Math.sin(angle + rand(-0.7, 0.7)) * speed + cell.vy * 0.2,
      z: dimension,
      w: rand(0.2, 1.8),
      hue: (mapping.hue + rand(-90, 120) + 360) % 360,
      size: rand(0.55, mode === "chaos" ? 2.6 : 1.8) * force,
      life: rand(0.45, mode === "chaos" ? 1.8 : 1.35),
      phase: rand(0, TAU),
      orbit: rand(-1.4, 1.4)
    });
  }
}

function updateSpores(dt) {
  if (cells.length > 0) {
    const emitterRate = (mode === "chaos" ? 18 : mode === "stable" ? 9 : 4) * temporal.pointDensity * temporal.quality;
    if (rand(0, 1) < emitterRate * dt * 0.001) {
      const cell = cells[Math.floor(rand(0, cells.length))];
      emitSpores(cell, mode === "chaos" ? 38 : mode === "stable" ? 18 : 8, 0.7);
    }
  }

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  for (let i = spores.length - 1; i >= 0; i -= 1) {
    const spore = spores[i];
    spore.phase += dt * (0.001 + temporal.local * 0.002);
    spore.life -= dt * (mode === "chaos" ? 0.00024 : 0.00016);
    spore.z += Math.sin(spore.phase + temporal.long * TAU) * dt * 0.00018;
    const dx = spore.x - centerX;
    const dy = spore.y - centerY;
    const dist = Math.hypot(dx, dy) || 1;
    const twist = (0.0008 + temporal.macroPressure * 0.0018) * spore.orbit * dt;
    spore.vx += (-dy / dist) * twist + Math.sin(spore.phase) * 0.006 * dt;
    spore.vy += (dx / dist) * twist + Math.cos(spore.phase * 1.3) * 0.006 * dt;
    const projection = 1 / (1.8 - clamp(spore.z, -1.2, 1.2) * 0.35);
    spore.x += spore.vx * dt * 0.04 * projection;
    spore.y += spore.vy * dt * 0.04 * projection;

    if (spore.life <= 0 || spore.x < -160 || spore.x > width + 160 || spore.y < -160 || spore.y > height + 160) {
      spores.splice(i, 1);
    }
  }
}

function drawSpores() {
  if (spores.length === 0) return;
  const stride = temporal.quality < 0.55 ? 2 : 1;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < spores.length; i += stride) {
    const spore = spores[i];
    const depth = clamp(spore.z, -1.4, 1.4);
    const projection = 1 / (1.8 - depth * 0.35);
    const alpha = clamp(spore.life, 0, 1) * (0.1 + temporal.pointDensity * 0.32);
    ctx.fillStyle = `hsla(${hue(spore.hue)} 96% ${finite(58 + projection * 18, 66)}% / ${alpha})`;
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, spore.size * projection * (0.8 + temporal.macroPressure * 0.7), 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function spawnEntity(cell, intensity = 1) {
  const mapping = cell.mapping || mapCellToSoundAndLight(cell, Math.hypot(cell.vx, cell.vy));
  const radiusLimit = Math.max(160, Math.max(width, height) * 0.74);
  const radius = clamp(finite(cell.size, 12) * (18 + finite(cell.generation, 0) * 1.6) * intensity, 120, radiusLimit);
  const controlCount = 11;
  const controls = [];
  for (let i = 0; i < controlCount; i += 1) {
    const a = (i / controlCount) * TAU;
    controls.push({
      angle: a,
      radius: rand(0.62, 1.28),
      z: rand(-1, 1),
      w: rand(0.5, 1.9),
      spin: rand(-0.8, 0.8),
      fold: rand(0.6, 1.5)
    });
  }
  entities.push({
    x: finite(cell.x, width * 0.5),
    y: finite(cell.y, height * 0.5),
    radius,
    hue: finite(mapping.hue, 160),
    noteName: mapping.noteName,
    frequency: finite(mapping.frequency, 110),
    life: 1,
    age: 0,
    force: finite(intensity * (0.8 + mapping.dimension), intensity),
    spin: rand(-1, 1),
    generation: cell.generation,
    controls,
    knots: makeClampedKnots(controlCount, 3)
  });
  if (entities.length > (mode === "chaos" ? 24 : mode === "stable" ? 18 : 12)) entities.shift();
  emitSpores(cell, Math.floor((mode === "chaos" ? 180 : mode === "stable" ? 96 : 48) * intensity), intensity);
}

function drawEntities(dt) {
  ctx.globalCompositeOperation = "lighter";
  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    entity.age += dt;
    entity.life -= dt * 0.00022;
    entity.radius += dt * (0.012 + entity.force * 0.014 + temporal.macroPressure * 0.02);
    if (entity.life <= 0 || !Number.isFinite(entity.x) || !Number.isFinite(entity.y) || !Number.isFinite(entity.radius)) {
      entities.splice(i, 1);
      continue;
    }

    const radius = clamp(finite(entity.radius, 120), 1, Math.max(width, height) * 1.2);
    const alpha = clamp(finite(entity.life, 0), 0, 1) * 0.18;
    const points = sampleEntityNurbs(entity, Math.floor((28 + temporal.macroPressure * 46) * temporal.quality));
    const glow = ctx.createRadialGradient(entity.x, entity.y, 0, entity.x, entity.y, radius);
    glow.addColorStop(0, `hsla(${entity.hue} 98% 66% / ${alpha * 0.7})`);
    glow.addColorStop(0.5, `hsla(${(entity.hue + 120) % 360} 92% 58% / ${alpha * 0.24})`);
    glow.addColorStop(1, `hsla(${entity.hue} 92% 55% / 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, radius, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      const x = entity.x + point.x;
      const y = entity.y + point.y;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = `hsla(${entity.hue} 96% 72% / ${alpha + 0.08})`;
    ctx.lineWidth = clamp(radius * 0.012, 1.2, 5.5);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${(entity.hue + 180) % 360} 96% 70% / ${alpha * 0.7})`;
    ctx.lineWidth = 0.9;
    const rings = Math.floor((1 + temporal.macroPressure * 4) * temporal.quality);
    for (let ring = 0; ring < rings; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(entity.x, entity.y, radius * (0.16 + ring * 0.14), radius * (0.05 + ring * 0.06), entity.age * 0.0004 + ring, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function sampleEntityNurbs(entity, sampleCount) {
  const controls = entity.controls.map((control, i) => {
    const phase = entity.age * 0.001 * control.spin + i;
    const fourD = Math.sin(entity.age * 0.0012 + control.z * 3 + i) * 0.58 * entity.force;
    const projection = 1 / (1.55 - fourD * 0.34);
    const angle = control.angle + Math.sin(phase) * 0.22 + entity.spin * entity.age * 0.00012;
    const r = finite(entity.radius, 120) * control.radius * finite(projection, 1) * (0.72 + Math.cos(phase * control.fold) * 0.12);
    return {
      x: finite(Math.cos(angle) * r),
      y: finite(Math.sin(angle) * r * (0.62 + finite(projection, 1) * 0.18)),
      w: finite(control.w * projection, 1)
    };
  });

  const points = [];
  for (let i = 0; i < sampleCount; i += 1) {
    points.push(nurbsPoint(i / sampleCount, controls, 3, entity.knots));
  }
  return points;
}

function addBurst(x, y, hue, force) {
  bursts.push({ x, y, hue, force, life: 1, radius: 6 + force * 22 });
  const maxBursts = Math.floor((30 + temporal.pointDensity * 62) * temporal.quality);
  while (bursts.length > maxBursts) bursts.shift();
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
    ctx.strokeStyle = `hsla(${burst.hue} 96% 68% / ${burst.life * (0.18 + temporal.pointDensity * 0.24)})`;
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

function playBirthChord(cell) {
  if (!audio) return;
  const mapping = cell.mapping || mapCellToSoundAndLight(cell, Math.hypot(cell.vx, cell.vy));
  const now = audio.ctx.currentTime;
  const chord = mode === "calme" ? [1, 1.5, 2] : mode === "stable" ? [1, 1.25, 1.5, 2] : [1, 1.125, 1.333, 1.5, 1.875];
  chord.forEach((ratio, index) => {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    const filter = audio.ctx.createBiquadFilter();
    const panner = audio.ctx.createPanner();
    osc.type = index % 2 === 0 ? "triangle" : mode === "chaos" ? "sawtooth" : "sine";
    osc.frequency.value = mapping.frequency * ratio;
    filter.type = "bandpass";
    filter.frequency.value = mapping.filterFrequency * ratio;
    filter.Q.value = 5 + mapping.dimension * 5;
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1.8;
    panner.maxDistance = 24;
    panner.rolloffFactor = 1.1;
    const angle = (index / chord.length) * TAU + mapping.dimension * TAU;
    setAudioParam(panner.positionX, Math.cos(angle) * (3.5 + index), now, 0.01);
    setAudioParam(panner.positionY, mapping.verticalMotion * 4 + Math.sin(angle * 1.7) * 2, now, 0.01);
    setAudioParam(panner.positionZ, Math.sin(angle) * (3.5 + index), now, 0.01);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.035 + mapping.volume * 0.8, now + 0.02 + index * 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45 + index * 0.11);
    osc.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(audio.wet);
    gain.connect(audio.dry);
    osc.start(now + index * 0.025);
    osc.stop(now + 0.7 + index * 0.11);
  });
}

function playBloomChord(group, large) {
  if (!audio || group.length === 0) return;
  const now = audio.ctx.currentTime;
  const chordCells = group.slice(0, large ? 7 : 4);
  chordCells.forEach((cell, index) => {
    const mapping = cell.mapping || mapCellToSoundAndLight(cell, Math.hypot(cell.vx, cell.vy));
    const osc = audio.ctx.createOscillator();
    const overtone = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    const filter = audio.ctx.createBiquadFilter();
    const panner = audio.ctx.createPanner();
    const start = now + index * 0.045;
    const duration = large ? 1.45 + index * 0.08 : 0.8 + index * 0.05;
    const ratio = [1, 1.2, 1.333, 1.5, 1.875, 2, 2.5][index % 7];

    osc.type = index % 3 === 0 ? "sawtooth" : index % 2 === 0 ? "triangle" : "sine";
    overtone.type = "sine";
    osc.frequency.value = mapping.frequency * ratio;
    overtone.frequency.value = mapping.frequency * ratio * 2.01;
    filter.type = index % 2 === 0 ? "bandpass" : "lowpass";
    filter.frequency.value = clamp(mapping.filterFrequency * ratio, 240, 10000);
    filter.Q.value = 3 + index * 0.8;
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1.6;
    panner.maxDistance = 26;
    panner.rolloffFactor = 1.05;
    setAudioParam(panner.positionX, mapping.spatialX + Math.cos(index) * 3, now, 0.01);
    setAudioParam(panner.positionY, mapping.spatialY + Math.sin(index * 1.7) * 2, now, 0.01);
    setAudioParam(panner.positionZ, mapping.spatialZ + Math.sin(index) * 4, now, 0.01);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(large ? 0.045 : 0.026, start + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    overtone.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(audio.wet);
    gain.connect(audio.dry);
    osc.start(start);
    overtone.start(start);
    osc.stop(start + duration + 0.04);
    overtone.stop(start + duration + 0.04);
  });
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
  const listener = ctxAudio.listener;

  master.gain.value = modes[mode].master;
  dry.gain.value = 0.74;
  wet.gain.value = 0.42;
  delay.delayTime.value = 0.28;
  feedback.gain.value = 0.34;
  convolver.buffer = impulse(ctxAudio, 2.8, 2.5);
  distortion.curve = distortionCurve(90);
  distortion.oversample = "2x";
  if (listener.positionX) {
    listener.positionX.value = 0;
    listener.positionY.value = 0;
    listener.positionZ.value = 0;
    listener.forwardX.value = 0;
    listener.forwardY.value = 0;
    listener.forwardZ.value = -1;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  } else if (listener.setPosition) {
    listener.setPosition(0, 0, 0);
    listener.setOrientation(0, 0, -1, 0, 1, 0);
  }

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

  audio = { ctx: ctxAudio, master, dry, wet, delay, feedback, convolver, distortion, destination, listener };
  additive = createAdditiveBank(ctxAudio);
  cells.forEach((cell) => cell.attachAudio());
  audioState.textContent = "son actif";
  audioToggle.textContent = "Couper le son";
  return audio;
}

function updateAudioMix(dt = 16) {
  if (!audio) return;
  const settings = modes[mode];
  const now = audio.ctx.currentTime;
  listenerOrbit += 0.0018 + cells.length * 0.000006;
  const entityPull = entities.reduce((sum, entity) => sum + entity.life * entity.force, 0);
  const forwardX = Math.sin(listenerOrbit) * clamp(entityPull * 0.08, 0, 0.85);
  const forwardZ = -Math.cos(listenerOrbit);
  audio.master.gain.setTargetAtTime(settings.master * (0.82 + temporal.macroPressure * 0.28), now, 0.18);
  audio.delay.delayTime.setTargetAtTime(settings.delay * (0.74 + temporal.clusterDensity * 0.54), now, 0.22);
  audio.feedback.gain.setTargetAtTime(clamp(settings.feedback + temporal.soundDensity * 0.12, 0.08, 0.72), now, 0.18);
  audio.wet.gain.setTargetAtTime(settings.reverb * (0.72 + temporal.macroPressure * 0.5), now, 0.24);
  if (audio.listener.positionX) {
    setAudioParam(audio.listener.forwardX, forwardX, now, 0.3);
    setAudioParam(audio.listener.forwardY, Math.sin(listenerOrbit * 0.7) * 0.18, now, 0.3);
    setAudioParam(audio.listener.forwardZ, forwardZ, now, 0.3);
  } else if (audio.listener.setOrientation) {
    audio.listener.setOrientation(forwardX, 0, forwardZ, 0, 1, 0);
  }
  playTemporalGrains(dt, now);
  updateAdditiveTimbre(now);
}

function createAdditiveBank(ctxAudio) {
  const partials = [];
  const bankGain = ctxAudio.createGain();
  const filter = ctxAudio.createBiquadFilter();
  const panner = ctxAudio.createPanner();

  bankGain.gain.value = 0;
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.8;
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 2;
  panner.maxDistance = 30;
  panner.rolloffFactor = 1.1;

  for (let i = 0; i < 32; i += 1) {
    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    osc.type = "sine";
    osc.frequency.value = 80 + i * 12;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(filter);
    osc.start();
    partials.push({ osc, gain, phase: rand(0, TAU) });
  }

  filter.connect(panner);
  panner.connect(bankGain);
  bankGain.connect(audio ? audio.wet : ctxAudio.destination);
  bankGain.connect(audio ? audio.dry : ctxAudio.destination);
  return { partials, bankGain, filter, panner };
}

function updateAdditiveTimbre(now) {
  if (!audio || !additive || spores.length === 0) return;
  const sampleCount = Math.min(spores.length, mode === "chaos" ? 900 : mode === "stable" ? 560 : 320);
  const stride = Math.max(1, Math.floor(spores.length / sampleCount));
  const bins = additive.partials.map(() => ({ amp: 0, freq: 0, x: 0, y: 0, z: 0 }));
  let total = 0;
  let centroidX = 0;
  let centroidY = 0;
  let centroidZ = 0;
  let brightness = 0;

  for (let i = 0, seen = 0; i < spores.length && seen < sampleCount; i += stride, seen += 1) {
    const spore = spores[i];
    const normX = clamp(spore.x / Math.max(1, width), 0, 1);
    const normY = clamp(spore.y / Math.max(1, height), 0, 1);
    const depth = clamp(spore.z, -1.4, 1.4);
    const binIndex = Math.min(bins.length - 1, Math.floor((normX * 0.55 + normY * 0.25 + (depth + 1.4) * 0.071) * bins.length));
    const amp = clamp(spore.life * spore.size * 0.08, 0, 0.35);
    const freq = 42 + normX * 880 + (1 - normY) * 360 + depth * 110 + (spore.hue % 120);
    bins[binIndex].amp += amp;
    bins[binIndex].freq += freq * amp;
    bins[binIndex].x += (normX * 2 - 1) * amp;
    bins[binIndex].y += (1 - normY * 2) * amp;
    bins[binIndex].z += depth * amp;
    total += amp;
    centroidX += (normX * 2 - 1) * amp;
    centroidY += (1 - normY * 2) * amp;
    centroidZ += depth * amp;
    brightness += freq * amp;
  }

  const masterAmp = clamp(total / Math.max(1, sampleCount) * (mode === "chaos" ? 1.5 : 1.1), 0, 0.16);
  additive.bankGain.gain.setTargetAtTime(masterAmp, now, 0.18);
  additive.filter.frequency.setTargetAtTime(clamp((brightness / Math.max(1, total)) * (0.9 + temporal.soundDensity), 320, 8000), now, 0.22);
  additive.filter.Q.setTargetAtTime(0.7 + temporal.clusterDensity * 5, now, 0.24);
  setAudioParam(additive.panner.positionX, clamp(centroidX / Math.max(0.001, total) * 7, -8, 8), now, 0.18);
  setAudioParam(additive.panner.positionY, clamp(centroidY / Math.max(0.001, total) * 4, -5, 5), now, 0.18);
  setAudioParam(additive.panner.positionZ, clamp(centroidZ / Math.max(0.001, total) * 7, -9, 9), now, 0.18);

  additive.partials.forEach((partial, index) => {
    const bin = bins[index];
    const amp = clamp(bin.amp / Math.max(1, total), 0, 0.12) * temporal.soundDensity;
    const freq = bin.amp > 0 ? bin.freq / bin.amp : 45 + index * 31;
    partial.osc.frequency.setTargetAtTime(clamp(freq, 28, 9000), now, 0.12);
    partial.gain.gain.setTargetAtTime(amp, now, 0.14);
  });
}

function playTemporalGrains(dt, now) {
  if (!audio || cells.length === 0) return;
  if (temporal.fps < 32 || activeGrains > 10) {
    temporal.grainDebt = Math.min(temporal.grainDebt, 0.9);
    return;
  }
  const rate = (mode === "chaos" ? 10 : mode === "stable" ? 7 : 4) * temporal.quality;
  temporal.grainDebt += (dt / 1000) * temporal.soundDensity * rate;
  const grains = Math.min(2, Math.floor(temporal.grainDebt));
  temporal.grainDebt -= grains;

  for (let i = 0; i < grains; i += 1) {
    const cell = cells[Math.floor(rand(0, cells.length))];
    const mapping = cell.mapping || mapCellToSoundAndLight(cell, Math.hypot(cell.vx, cell.vy));
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    const filter = audio.ctx.createBiquadFilter();
    const panner = audio.ctx.createPanner();
    const duration = rand(0.028, mode === "chaos" ? 0.09 : 0.14) * (0.75 + temporal.local);
    const start = now + rand(0.004, 0.06);

    osc.type = mode === "chaos" && rand(0, 1) > 0.45 ? "sawtooth" : rand(0, 1) > 0.6 ? "triangle" : "sine";
    osc.frequency.value = mapping.frequency * [0.5, 1, 1.25, 1.5, 2][Math.floor(rand(0, 5))] * rand(0.985, 1.018);
    filter.type = rand(0, 1) > temporal.clusterDensity ? "bandpass" : "lowpass";
    filter.frequency.value = clamp(mapping.filterFrequency * rand(0.6, 1.6), 180, 10000);
    filter.Q.value = 2 + temporal.pointDensity * 10 + rand(0, 3);
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1.6;
    panner.maxDistance = 24;
    panner.rolloffFactor = 1.2;
    setAudioParam(panner.positionX, mapping.spatialX + rand(-2.4, 2.4), now, 0.01);
    setAudioParam(panner.positionY, mapping.spatialY + rand(-1.6, 1.6), now, 0.01);
    setAudioParam(panner.positionZ, mapping.spatialZ + rand(-3.2, 3.2), now, 0.01);

    const peak = clamp(0.006 + mapping.volume * 0.34 * temporal.soundDensity, 0.003, 0.034);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + duration * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(audio.wet);
    gain.connect(audio.dry);
    osc.start(start);
    osc.stop(start + duration + 0.03);
    activeGrains += 1;
    osc.onended = () => {
      activeGrains = Math.max(0, activeGrains - 1);
    };
  }
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
    cells.forEach((cell) => emitSpores(cell, 120, 1.1));
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
  const lead = cells.length ? cells.reduce((best, cell) => (cell.energy + cell.size * 0.01 > best.energy + best.size * 0.01 ? cell : best), cells[0]) : null;
  mappingState.textContent = lead ? `${lead.mapping.noteName} / ${lead.mapping.voiceName} / q${temporal.quality.toFixed(1)}` : lastFrameError || "silence";
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
  const bloomCount = large ? 9 : 5;
  const born = [];
  const cell = new Cellule(x, y, large ? rand(22, 38) : rand(8, 18), large ? 1.12 : 0.82, rand(0, 360), {
    generation: parentGeneration + 1,
    origin: "manual",
    voice: Math.floor(rand(0, 7))
  });
  cells.push(cell);
  born.push(cell);
  for (let i = 1; i < bloomCount; i += 1) {
    if (cells.length >= Math.min(MAX_CELLS, modes[mode].capacity)) break;
    const angle = (i / bloomCount) * TAU + rand(-0.28, 0.28);
    const distance = rand(large ? 36 : 18, large ? 130 : 74);
    const bloom = new Cellule(
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      rand(large ? 9 : 5, large ? 24 : 14),
      rand(0.56, large ? 1.08 : 0.9),
      (cell.hue + i * rand(24, 64) + 360) % 360,
      { generation: parentGeneration + 1 + (i % 3), origin: "manual", voice: (cell.voice + i) % 7 }
    );
    bloom.vx = Math.cos(angle) * rand(0.6, large ? 2.2 : 1.4);
    bloom.vy = Math.sin(angle) * rand(0.6, large ? 2.2 : 1.4);
    cells.push(bloom);
    born.push(bloom);
  }
  born.forEach((created) => {
    created.attachAudio();
    spawnEntity(created, large ? 0.95 : 0.55);
    emitSpores(created, large ? 240 : 110, large ? 1.2 : 0.85);
  });
  cell.attachAudio();
  if (cells.length > Math.min(MAX_CELLS, modes[mode].capacity)) {
    while (cells.length > Math.min(MAX_CELLS, modes[mode].capacity)) {
      const removed = cells.shift();
      removed.stopAudio();
    }
  }
  addBurst(x, y, cell.hue, large ? 1.5 : 0.9);
  playBloomChord(born, large);
  nextGenesisAt = Math.min(nextGenesisAt, storyTime + 400);
}

function saveOrganism() {
  const data = {
    seed,
    mode,
    storyTime,
    nextGenesisAt,
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
      voice: cell.voice,
      noteSeed: cell.noteSeed,
      motionJitter: cell.motionJitter
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
  nextGenesisAt = data.nextGenesisAt || storyTime + 900;
  spores = [];
  cells = data.cells.map((item) => {
    const cell = new Cellule(item.x * width, item.y * height, item.size, item.energy, item.hue, {
      generation: item.generation || 0,
      origin: item.origin || "organisme",
      voice: item.voice || 0,
      noteSeed: item.noteSeed || 0,
      count: false
    });
    cell.motionJitter = item.motionJitter || cell.motionJitter;
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
  event.preventDefault();
  await ensureAudio();
  mouse.down = true;
  mouse.holdStart = performance.now();
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  mouse.active = true;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  const held = performance.now() - mouse.holdStart;
  mouse.down = false;
  addCellFromPointer(event, held > 420 || event.button === 2);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
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
