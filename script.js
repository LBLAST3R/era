const canvas = document.getElementById("organism");
const ctx = canvas.getContext("2d");

const audioToggle = document.getElementById("audioToggle");
const seedButton = document.getElementById("seedButton");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const recordButton = document.getElementById("recordButton");
const seedInput = document.getElementById("seedInput");
const cellCount = document.getElementById("cellCount");
const modeName = document.getElementById("modeName");
const audioState = document.getElementById("audioState");
const modeButtons = [...document.querySelectorAll(".mode")];

const TAU = Math.PI * 2;
const MAX_CELLS = 72;
const MIN_CELLS = 3;
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

const modes = {
  calme: {
    start: 8,
    drift: 0.22,
    attraction: 0.004,
    division: 0.986,
    energyGain: 0.024,
    energyLoss: 0.018,
    fusionDistance: 0.82,
    master: 0.32,
    delay: 0.18,
    reverb: 0.38
  },
  stable: {
    start: 18,
    drift: 0.38,
    attraction: 0.007,
    division: 0.972,
    energyGain: 0.04,
    energyLoss: 0.032,
    fusionDistance: 0.92,
    master: 0.38,
    delay: 0.24,
    reverb: 0.28
  },
  chaos: {
    start: 34,
    drift: 0.82,
    attraction: 0.012,
    division: 0.946,
    energyGain: 0.08,
    energyLoss: 0.052,
    fusionDistance: 0.72,
    master: 0.46,
    delay: 0.36,
    reverb: 0.18
  }
};

class Cellule {
  constructor(x, y, size, energy, hue) {
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
    this.isolated = 1;
    this.nearCount = 0;
    this.audio = null;
  }

  attachAudio() {
    if (!audio || this.audio) return;

    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    const pan = audio.ctx.createStereoPanner();
    const filter = audio.ctx.createBiquadFilter();
    const lfo = audio.ctx.createOscillator();
    const lfoGain = audio.ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 160;
    gain.gain.value = 0;
    pan.pan.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 1.4;
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 2;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(pan);
    pan.connect(gain);
    gain.connect(audio.wet);
    gain.connect(audio.dry);

    osc.start();
    lfo.start();
    this.audio = { osc, gain, pan, filter, lfo, lfoGain };
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
    this.phase += dt * (0.0018 + this.energy * 0.000012);

    const wander = settings.drift * dt * 0.012;
    this.vx += Math.cos(this.phase * 1.7) * wander + rand(-wander, wander);
    this.vy += Math.sin(this.phase * 1.3) * wander + rand(-wander, wander);

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
    const maxSpeed = mode === "chaos" ? 4.4 : 2.8;
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

    const pulse = Math.sin(this.phase * 3) * 0.16 + Math.sin(this.age * 0.004) * 0.08;
    this.energy += (settings.energyGain * this.nearCount - settings.energyLoss) * dt * 0.01;
    this.energy += rand(-0.003, 0.004) * dt;
    this.energy = clamp(this.energy, 0, 1.42);
    this.size = clamp(this.baseSize * (0.84 + this.energy * 0.5 + pulse), 4, 42);
    this.hue = (this.hue + (this.nearCount * 0.016 + speed * 0.018) * dt) % 360;

    this.updateAudio(speed);
  }

  updateAudio(speed) {
    if (!audio) return;
    this.attachAudio();
    const now = audio.ctx.currentTime;
    const xNorm = this.x / Math.max(1, width);
    const yNorm = this.y / Math.max(1, height);
    const harmonic = this.nearCount > 0 ? [1, 1.25, 1.5, 2][this.nearCount % 4] : 1;
    const freq = lerp(70, 880, xNorm) * harmonic;
    const volume = clamp((this.size / 48) * (0.05 + this.energy * 0.09), 0, 0.11);
    const pure = clamp(this.isolated, 0, 1);

    this.audio.osc.type = speed > 2.6 ? "sawtooth" : speed > 1.45 ? "triangle" : "sine";
    this.audio.osc.frequency.setTargetAtTime(freq, now, 0.055);
    this.audio.gain.gain.setTargetAtTime(volume, now, 0.08);
    this.audio.pan.pan.setTargetAtTime(xNorm * 2 - 1, now, 0.08);
    this.audio.filter.frequency.setTargetAtTime(lerp(500, 5800, 1 - yNorm) + this.nearCount * 160, now, 0.08);
    this.audio.filter.Q.setTargetAtTime(lerp(0.6, 5.8, pure), now, 0.1);
    this.audio.lfo.frequency.setTargetAtTime(lerp(0.08, 9, clamp(speed / 4, 0, 1)), now, 0.1);
    this.audio.lfoGain.gain.setTargetAtTime(lerp(0.8, 22, clamp(speed / 4, 0, 1)), now, 0.08);
  }

  draw() {
    const speed = Math.hypot(this.vx, this.vy);
    const light = 48 + this.energy * 20 + speed * 5;
    const color = `hsl(${this.hue} 88% ${light}%)`;
    const halo = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 5.8);
    halo.addColorStop(0, `hsla(${this.hue} 95% 65% / ${0.24 + this.energy * 0.2})`);
    halo.addColorStop(0.42, `hsla(${(this.hue + 42) % 360} 88% 58% / 0.12)`);
    halo.addColorStop(1, `hsla(${this.hue} 95% 55% / 0)`);

    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 5.8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + this.energy * 24;
    ctx.beginPath();
    const points = 18;
    for (let i = 0; i <= points; i += 1) {
      const a = (i / points) * TAU;
      const wobble = 1 + Math.sin(a * 3 + this.phase * 5) * 0.08 + Math.cos(a * 5 - this.phase * 4) * 0.05;
      const r = this.size * wobble;
      const x = this.x + Math.cos(a) * r;
      const y = this.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + this.isolated * 0.2})`;
    ctx.beginPath();
    ctx.arc(this.x - this.size * 0.24, this.y - this.size * 0.22, Math.max(1.8, this.size * 0.18), 0, TAU);
    ctx.fill();
  }
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
  mode = selectedMode;
  const count = modes[mode].start;
  for (let i = 0; i < count; i += 1) {
    cells.push(new Cellule(rand(width * 0.16, width * 0.84), rand(height * 0.18, height * 0.82), rand(7, 18), rand(0.32, 0.9), rand(110, 340)));
  }
  updateModeButtons();
}

function step(time) {
  const dt = Math.min(40, time - lastTime);
  lastTime = time;

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
      const near = (a.size + b.size) * 4.8;

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

        if (cells.length > MIN_CELLS && rand(0, 1) < 0.006 * dt) {
          fuseCells(i, j);
          return;
        }
      }
    }
  }
}

function evolve(dt) {
  const settings = modes[mode];

  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const cell = cells[i];
    if (cell.energy > settings.division && cells.length < MAX_CELLS && rand(0, 1) < 0.0025 * dt) {
      divideCell(cell);
    }

    if ((cell.energy < 0.035 && cells.length > MIN_CELLS) || cells.length > MAX_CELLS) {
      cell.stopAudio();
      cells.splice(i, 1);
      addBurst(cell.x, cell.y, cell.hue, 0.28);
    }
  }

  if (cells.length < MIN_CELLS) {
    cells.push(new Cellule(rand(80, width - 80), rand(80, height - 80), rand(8, 16), 0.7, rand(0, 360)));
  }
}

function divideCell(cell) {
  cell.energy *= 0.48;
  cell.baseSize *= 0.86;
  const angle = rand(0, TAU);
  const child = new Cellule(
    cell.x + Math.cos(angle) * cell.size * 1.8,
    cell.y + Math.sin(angle) * cell.size * 1.8,
    clamp(cell.baseSize * rand(0.72, 1.08), 5, 22),
    cell.energy * rand(0.72, 1.04),
    (cell.hue + rand(-32, 44) + 360) % 360
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
    (a.hue + b.hue) / 2
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
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(8, 11, 10, 0.24)");
  gradient.addColorStop(0.45, "rgba(16, 35, 27, 0.1)");
  gradient.addColorStop(1, "rgba(10, 16, 18, 0.2)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 193 + performance.now() * 0.012) % (width + 200)) - 100;
    const y = (Math.sin(i * 99 + performance.now() * 0.0003) * 0.5 + 0.5) * height;
    ctx.fillStyle = `hsla(${(i * 34 + 150) % 360} 80% 62% / 0.018)`;
    ctx.beginPath();
    ctx.arc(x, y, 90 + (i % 4) * 34, 0, TAU);
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
  audio.feedback.gain.setTargetAtTime(mode === "chaos" ? 0.52 : 0.28, now, 0.18);
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
    while (cells.length < modes.chaos.start) {
      cells.push(new Cellule(rand(40, width - 40), rand(40, height - 40), rand(6, 15), rand(0.65, 1.1), rand(0, 360)));
    }
  } else if (mode === "calme") {
    cells.forEach((cell) => {
      cell.energy *= 0.72;
      cell.vx *= 0.62;
      cell.vy *= 0.62;
    });
  }
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  modeName.textContent = mode;
}

function updateReadout() {
  cellCount.textContent = String(cells.length);
}

function addCellFromPointer(event, large = false) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  cells.push(new Cellule(x, y, large ? rand(22, 36) : rand(8, 17), large ? 1.05 : 0.72, rand(0, 360)));
  if (cells.length > MAX_CELLS) {
    const removed = cells.shift();
    removed.stopAudio();
  }
  addBurst(x, y, rand(0, 360), large ? 1 : 0.55);
}

function saveOrganism() {
  const data = {
    seed,
    mode,
    cells: cells.map((cell) => ({
      x: cell.x / width,
      y: cell.y / height,
      vx: cell.vx,
      vy: cell.vy,
      size: cell.baseSize,
      energy: cell.energy,
      hue: cell.hue
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
  cells = data.cells.map((item) => {
    const cell = new Cellule(item.x * width, item.y * height, item.size, item.energy, item.hue);
    cell.vx = item.vx;
    cell.vy = item.vy;
    return cell;
  });
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
