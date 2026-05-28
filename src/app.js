const MAX_CELLS = 24;
const MAX_AUDIO_VOICES = 8;
const TWO_PI = Math.PI * 2;
const GRID_SIZE = 180;

const HARMONIC_MODES = [
  {
    id: "pentatonic-minor",
    name: "Pentatonique mineure",
    mood: "Doux, meditatif",
    degrees: [0, 3, 5, 7, 10],
  },
  {
    id: "lydian",
    name: "Lydien",
    mood: "Lumineux, flottant",
    degrees: [0, 2, 4, 6, 7, 9, 11],
  },
  {
    id: "dorian",
    name: "Dorien",
    mood: "Organique, equilibre",
    degrees: [0, 2, 3, 5, 7, 9, 10],
  },
  {
    id: "natural-minor",
    name: "Mineur naturel",
    mood: "Melancolique, profond",
    degrees: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    id: "harmonic-spectrum",
    name: "Spectre naturel",
    mood: "Electroacoustique",
    spectrum: true,
    ratios: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 5 / 3, 7 / 4, 2],
  },
];

const MODE_PROFILES = {
  calm: {
    targetCells: 9,
    targetEnergy: 0.32,
    speed: 0.55,
    chaos: 0.06,
    division: 0.12,
    death: 1.25,
    collisions: 0.25,
    consonance: 0.92,
    reverb: 0.72,
    lowpass: 6400,
  },
  stable: {
    targetCells: 14,
    targetEnergy: 0.54,
    speed: 0.85,
    chaos: 0.18,
    division: 0.34,
    death: 0.9,
    collisions: 0.46,
    consonance: 0.78,
    reverb: 0.56,
    lowpass: 8800,
  },
  chaos: {
    targetCells: 18,
    targetEnergy: 0.78,
    speed: 1.08,
    chaos: 0.68,
    division: 0.62,
    death: 0.72,
    collisions: 0.9,
    consonance: 0.46,
    reverb: 0.4,
    lowpass: 11200,
  },
  ritual: {
    targetCells: 14,
    targetEnergy: 0.42,
    speed: 0.8,
    chaos: 0.2,
    division: 0.35,
    death: 0.95,
    collisions: 0.72,
    consonance: 0.75,
    reverb: 0.62,
    lowpass: 8200,
  },
};

const CELL_FAMILIES = [
  "drone",
  "granular",
  "pulsing",
  "spectral",
  "unstable",
];

const FAMILY_COLORS = {
  drone: { hue: 207, saturation: 88, lightness: 62 },
  granular: { hue: 156, saturation: 86, lightness: 62 },
  pulsing: { hue: 38, saturation: 94, lightness: 62 },
  spectral: { hue: 265, saturation: 78, lightness: 70 },
  unstable: { hue: 6, saturation: 88, lightness: 62 },
};

const FAMILY_AUDIO_SIGNATURES = {
  drone: { code: "D", wave: "sine", eventRatio: 0.5, attack: 0.035, release: 0.9 },
  granular: { code: "G", wave: "triangle", eventRatio: 2.5, attack: 0.006, release: 0.22 },
  pulsing: { code: "P", wave: "triangle", eventRatio: 1, attack: 0.012, release: 0.42 },
  spectral: { code: "S", wave: "sine", eventRatio: 3, attack: 0.018, release: 0.72 },
  unstable: { code: "X", wave: "sawtooth", eventRatio: 1.5, attack: 0.004, release: 0.18 },
};

const EVENT_LABELS = {
  collision: "TOUCH",
  division: "SPLIT",
  fusion: "FUSE",
  death: "FADE",
};

const RITUAL_DURATION = 480;

const PHASES = [
  { id: "germination", label: "Bionum" },
  { id: "growth", label: "Croissance" },
  { id: "organization", label: "Organisation" },
  { id: "mutation", label: "Mutation" },
  { id: "extinction", label: "Extinction" },
  { id: "rebirth", label: "Renaissance" },
];

const RITUAL_STAGES = [
  {
    id: "ritual-birth",
    start: 0,
    label: "Rituel I - Naissance",
    text: "Naissance: quelques voix profondes sortent du silence.",
    profile: {
      targetCells: 4,
      targetEnergy: 0.18,
      speed: 0.36,
      chaos: 0.03,
      division: 0.04,
      death: 0.45,
      collisions: 0.1,
      consonance: 0.97,
      reverb: 0.82,
      lowpass: 4200,
    },
  },
  {
    id: "ritual-growth",
    start: 0.16,
    label: "Rituel II - Croissance",
    text: "Croissance: la colonie se multiplie en harmonies proches.",
    profile: {
      targetCells: 12,
      targetEnergy: 0.52,
      speed: 0.72,
      chaos: 0.12,
      division: 0.86,
      death: 0.55,
      collisions: 0.34,
      consonance: 0.88,
      reverb: 0.66,
      lowpass: 7200,
    },
  },
  {
    id: "ritual-organism",
    start: 0.36,
    label: "Rituel III - Organisme",
    text: "Organisation: les cellules cherchent un accord commun.",
    profile: {
      targetCells: 16,
      targetEnergy: 0.56,
      speed: 0.82,
      chaos: 0.16,
      division: 0.22,
      death: 0.52,
      collisions: 0.3,
      consonance: 0.92,
      reverb: 0.58,
      lowpass: 8600,
    },
  },
  {
    id: "ritual-mutation",
    start: 0.58,
    label: "Rituel IV - Mutation",
    text: "Mutation: tension, frottements et accidents controles.",
    profile: {
      targetCells: 20,
      targetEnergy: 0.82,
      speed: 1.18,
      chaos: 0.78,
      division: 0.98,
      death: 0.38,
      collisions: 1.15,
      consonance: 0.48,
      reverb: 0.42,
      lowpass: 11200,
    },
  },
  {
    id: "ritual-extinction",
    start: 0.78,
    label: "Rituel V - Extinction",
    text: "Extinction: la matiere se vide, le souffle reste suspendu.",
    profile: {
      targetCells: 3,
      targetEnergy: 0.12,
      speed: 0.24,
      chaos: 0.08,
      division: 0.01,
      death: 4.8,
      collisions: 0.04,
      consonance: 0.95,
      reverb: 0.84,
      lowpass: 3400,
    },
  },
  {
    id: "ritual-rebirth",
    start: 0.92,
    label: "Rituel VI - Renaissance",
    text: "Renaissance: une nouvelle generation revient, plus douce.",
    profile: {
      targetCells: 8,
      targetEnergy: 0.32,
      speed: 0.52,
      chaos: 0.07,
      division: 0.82,
      death: 0.68,
      collisions: 0.16,
      consonance: 0.96,
      reverb: 0.8,
      lowpass: 5600,
    },
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function viewportArea() {
  return Math.max(1, window.innerWidth * window.innerHeight);
}

function qualityProfile() {
  const area = viewportArea();
  const narrow = window.innerWidth < 760;
  return {
    pixelDensity: 1,
    particles: narrow ? 6 : area > 1800000 ? 7 : 8,
    flowLines: 0,
    visualDetail: narrow ? 0.14 : area > 1800000 ? 0.18 : 0.22,
    maxCells: narrow ? 14 : area > 1800000 ? 18 : 20,
    maxVoices: narrow ? 5 : area > 1800000 ? 6 : 7,
    drawParticlesEvery: 5,
    drawConnectionsEvery: 6,
    drawEventsEvery: 2,
    audioSyncEvery: 3,
    label: "Performance max",
  };
}

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class SeededRandom {
  constructor(seed) {
    this.seed = seed || "era";
    this.state = hashSeed(this.seed) || 1;
  }

  next() {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return lerp(min, max, this.next());
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  choice(items) {
    if (!items.length) return undefined;
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  signed(amount = 1) {
    return this.range(-amount, amount);
  }
}

class Recorder {
  constructor() {
    this.isRecording = false;
    this.left = [];
    this.right = [];
    this.sampleRate = 44100;
    this.node = null;
    this.silent = null;
    this.sourceNode = null;
    this.startedAt = 0;
    this.lastBlob = null;
  }

  start(engine) {
    if (!engine.context || this.isRecording) return false;
    const ctx = engine.context;
    this.left = [];
    this.right = [];
    this.sampleRate = ctx.sampleRate;
    this.startedAt = ctx.currentTime;
    this.node = ctx.createScriptProcessor(4096, 2, 2);
    this.silent = ctx.createGain();
    this.silent.gain.value = 0;
    this.node.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      this.left.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      this.right.push(new Float32Array(event.inputBuffer.getChannelData(1)));
    };
    this.sourceNode = engine.outputNode;
    this.sourceNode.connect(this.node);
    this.node.connect(this.silent);
    this.silent.connect(ctx.destination);
    this.isRecording = true;
    return true;
  }

  stop(download = true) {
    if (!this.isRecording) return null;
    this.isRecording = false;
    if (this.sourceNode && this.node) {
      try {
        this.sourceNode.disconnect(this.node);
      } catch (_) {
        // Some browsers throw if the connection has already been released.
      }
    }
    if (this.node) this.node.disconnect();
    if (this.silent) this.silent.disconnect();
    this.node = null;
    this.silent = null;
    this.sourceNode = null;
    const wav = this.encodeWav(this.left, this.right, this.sampleRate);
    this.lastBlob = new Blob([wav], { type: "audio/wav" });
    if (download) {
      downloadBlob(this.lastBlob, `era-${Date.now()}.wav`);
    }
    return this.lastBlob;
  }

  elapsed(context) {
    if (!this.isRecording || !context) return 0;
    return context.currentTime - this.startedAt;
  }

  exportLast() {
    if (this.isRecording) {
      return this.stop(true);
    }
    if (!this.lastBlob) return null;
    downloadBlob(this.lastBlob, `era-${Date.now()}.wav`);
    return this.lastBlob;
  }

  encodeWav(leftBuffers, rightBuffers, sampleRate) {
    const left = this.flatten(leftBuffers);
    const right = this.flatten(rightBuffers);
    const length = left.length + right.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    this.writeString(view, 8, "WAVE");
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, "data");
    view.setUint32(40, length * 2, true);
    let offset = 44;
    for (let i = 0; i < left.length; i += 1) {
      const l = clamp(left[i], -1, 1);
      const r = clamp(right[i], -1, 1);
      view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
      offset += 2;
      view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
      offset += 2;
    }
    return view;
  }

  flatten(buffers) {
    const length = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const result = new Float32Array(length);
    let offset = 0;
    buffers.forEach((buffer) => {
      result.set(buffer, offset);
      offset += buffer.length;
    });
    return result;
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i += 1) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

class VideoRecorder {
  constructor() {
    this.isRecording = false;
    this.recorder = null;
    this.chunks = [];
    this.canvasStream = null;
    this.mimeType = "";
  }

  start(canvas, audio) {
    if (!window.MediaRecorder || !canvas.captureStream) {
      return { ok: false, message: "Video unsupported" };
    }
    this.chunks = [];
    this.canvasStream = canvas.captureStream(30);
    const tracks = [...this.canvasStream.getVideoTracks()];
    if (audio.mediaDestination) {
      tracks.push(...audio.mediaDestination.stream.getAudioTracks());
    }
    const stream = new MediaStream(tracks);
    this.mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
    this.recorder = new MediaRecorder(stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mimeType || "video/webm" });
      downloadBlob(blob, `era-video-${Date.now()}.webm`);
      this.stopCanvasTracks();
    };
    this.recorder.start(250);
    this.isRecording = true;
    return { ok: true };
  }

  stop() {
    if (!this.isRecording || !this.recorder) return;
    this.isRecording = false;
    this.recorder.stop();
    this.recorder = null;
  }

  stopCanvasTracks() {
    if (!this.canvasStream) return;
    this.canvasStream.getVideoTracks().forEach((track) => track.stop());
    this.canvasStream = null;
  }
}

class AudioEngine {
  constructor() {
    this.context = null;
    this.enabled = false;
    this.voiceMap = new Map();
    this.recorder = new Recorder();
    this.masterVolume = 0.72;
    this.outputNode = null;
    this.mediaDestination = null;
    this.noiseBuffer = null;
    this.eventCooldown = 0;
  }

  async start() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.buildGraph();
    }
    if (this.context.state !== "running") {
      await this.context.resume();
    }
    this.enabled = true;
    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(this.masterVolume, now + 1.2);
    return true;
  }

  buildGraph() {
    const ctx = this.context;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.74;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.78;

    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.08;
    this.delay = ctx.createDelay(4);
    this.delay.delayTime.value = 0.42;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.22;

    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.44;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.createImpulse(4.8, 3.2);
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = 0.45;

    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = "highpass";
    this.highpass.frequency.value = 34;
    this.highpass.Q.value = 0.5;

    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = "lowpass";
    this.lowpass.frequency.value = 8200;
    this.lowpass.Q.value = 0.52;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -26;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 4.8;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.22;

    this.saturator = ctx.createWaveShaper();
    this.saturator.curve = this.createSaturationCurve(60);
    this.saturator.oversample = "2x";

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3.2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 18;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.08;

    this.bus.connect(this.dryGain);
    this.dryGain.connect(this.highpass);

    this.bus.connect(this.delaySend);
    this.delaySend.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.wetGain);

    this.bus.connect(this.reverbSend);
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    this.highpass.connect(this.lowpass);
    this.wetGain.connect(this.lowpass);
    this.lowpass.connect(this.compressor);
    this.compressor.connect(this.saturator);
    this.saturator.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    this.mediaDestination = ctx.createMediaStreamDestination();
    this.limiter.connect(this.mediaDestination);
    this.outputNode = this.limiter;
    this.noiseBuffer = this.createNoiseBuffer(2);
  }

  createImpulse(seconds, decay) {
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const tail = 1 - i / length;
        data[i] = (Math.random() * 2 - 1) * tail ** decay * 0.45;
      }
    }
    return impulse;
  }

  createNoiseBuffer(seconds) {
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = lerp(last, Math.random() * 2 - 1, 0.22);
      data[i] = last * 0.42;
    }
    return buffer;
  }

  createSaturationCurve(amount) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  setMasterVolume(value) {
    this.masterVolume = clamp(value, 0, 1);
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(this.masterVolume, now, 0.05);
  }

  updateGlobal(conductor) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const densityDuck = mapRange(conductor.metrics.density, 0.25, 1, 1, 0.56);
    const targetBus = clamp(0.62 * densityDuck, 0.22, 0.78);
    this.bus.gain.setTargetAtTime(targetBus, now, 0.12);
    this.lowpass.frequency.setTargetAtTime(conductor.audio.lowpass, now, 0.18);
    this.reverbSend.gain.setTargetAtTime(conductor.audio.reverb, now, 0.22);
    this.delaySend.gain.setTargetAtTime(conductor.audio.delay, now, 0.18);
    this.delayFeedback.gain.setTargetAtTime(conductor.audio.feedback, now, 0.24);
  }

  syncCells(cells, conductor) {
    if (!this.enabled || !this.context) return;
    const maxVoices = qualityProfile().maxVoices;
    const audible = cells
      .filter((cell) => cell.state !== "dead")
      .sort((a, b) => b.energy * b.size - a.energy * a.size)
      .slice(0, maxVoices);
    const audibleIds = new Set(audible.map((cell) => cell.id));

    audible.forEach((cell) => {
      if (!this.voiceMap.has(cell.id)) {
        this.createVoice(cell);
      }
      this.updateVoice(cell, conductor);
    });

    [...this.voiceMap.keys()].forEach((id) => {
      if (!audibleIds.has(id)) {
        this.releaseVoice(id, 1.8);
      }
    });
  }

  createVoice(cell) {
    if (!this.enabled || this.voiceMap.size >= qualityProfile().maxVoices) return;
    const ctx = this.context;
    const voice = {
      id: cell.id,
      family: cell.family,
      oscillators: [],
      partialGains: [],
      lfos: [],
      startedAt: ctx.currentTime,
      releaseTimer: null,
    };

    voice.filter = ctx.createBiquadFilter();
    voice.filter.type = cell.family === "granular" ? "bandpass" : "lowpass";
    voice.filter.frequency.value = 1200;
    voice.filter.Q.value = cell.family === "unstable" ? 2.2 : 0.8;
    voice.panner = ctx.createStereoPanner();
    voice.gain = ctx.createGain();
    voice.gain.gain.value = 0;
    voice.filter.connect(voice.panner);
    voice.panner.connect(voice.gain);
    voice.gain.connect(this.bus);

    const addOsc = (type, multiplier, gainValue, detune = 0) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = cell.frequency * multiplier;
      osc.detune.value = detune;
      gain.gain.value = gainValue;
      osc.connect(gain);
      gain.connect(voice.filter);
      osc.start();
      voice.oscillators.push({ osc, multiplier });
      voice.partialGains.push(gain);
    };

    if (cell.family === "drone") {
      addOsc("sine", 1, 0.82);
      addOsc("triangle", 2, 0.1 + cell.gene.timbreTilt * 0.05, -4);
    } else if (cell.family === "spectral") {
      addOsc("sine", 1, 0.56);
      addOsc("sine", 2, 0.16, -5);
    } else if (cell.family === "pulsing") {
      addOsc("triangle", 1, 0.66);
      addOsc("sine", 0.5, 0.22 + cell.gene.eventColor * 0.06);
    } else if (cell.family === "unstable") {
      addOsc("sine", 1, 0.48);
      addOsc("sawtooth", 1.005 + cell.gene.timbreTilt * 0.008, 0.04 + cell.gene.eventColor * 0.04, 2);
    } else {
      const noise = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      noiseGain.gain.value = 0.54;
      noise.connect(noiseGain);
      noiseGain.connect(voice.filter);
      noise.start();
      voice.noise = noise;
      voice.noiseGain = noiseGain;
      addOsc("sine", 1, 0.18);
    }

    if (cell.family !== "drone" && cell.family !== "granular") {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = cell.gene.vibratoRate;
      lfoGain.gain.value = cell.frequency * 0.004;
      lfo.connect(lfoGain);
      voice.oscillators.forEach(({ osc }) => lfoGain.connect(osc.frequency));
      lfo.start();
      voice.lfos.push(lfo);
      voice.lfoGain = lfoGain;
    }
    this.voiceMap.set(cell.id, voice);
  }

  updateVoice(cell, conductor) {
    const voice = this.voiceMap.get(cell.id);
    if (!voice) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const ageFragility = clamp(cell.age / cell.gene.lifespan, 0, 1);
    const instability = conductor.chaosLevel * cell.gene.instability + ageFragility * 0.03;
    const bend = 1 + Math.sin(cell.phase * 1.7 + cell.gene.seedPhase) * instability * 0.018;
    const targetFrequency = clamp(cell.frequency * bend, 36, 6800);

    voice.oscillators.forEach(({ osc, multiplier }) => {
      osc.frequency.setTargetAtTime(targetFrequency * multiplier, now, 0.08);
    });

    const yDepth = clamp(cell.y / Math.max(1, window.innerHeight), 0, 1);
    const brightness = clamp(0.12 + cell.energy * 0.82 + cell.speedNorm * 0.24, 0, 1);
    const formant = clamp(cell.gene.formantRatio || 1, 0.7, 3.8);
    const lowpass = lerp(360, 9800, brightness) * lerp(1.18, 0.62, yDepth) * lerp(0.88, 1.22, cell.gene.timbreTilt || 0.5);
    const bandpass = lerp(520, 5200, brightness) * lerp(0.8, 1.18, formant / 3.8);
    const targetFilter = cell.family === "granular" ? bandpass : lowpass;
    voice.filter.frequency.setTargetAtTime(clamp(targetFilter, 180, 11800), now, 0.06);
    voice.filter.Q.setTargetAtTime(lerp(0.45, 3.2, cell.gene.instability * conductor.chaosLevel + cell.gene.eventColor * 0.16), now, 0.08);
    voice.panner.pan.setTargetAtTime(mapRange(cell.x, 0, window.innerWidth, -0.96, 0.96), now, 0.025);

    const familyGain = {
      drone: 0.035,
      granular: 0.022,
      pulsing: 0.027,
      spectral: 0.025,
      unstable: 0.018,
    }[cell.family];
    const pulse = cell.family === "pulsing"
      ? mapRange(Math.sin(cell.phase * cell.gene.pulseRate), -1, 1, 0.18, 1)
      : 1;
    const soloFactor = cell.solo ? 1.85 : cell.organism.soloId && cell.organism.soloId !== cell.id ? 0.18 : 1;
    const dyingFactor = cell.state === "dying" ? clamp(cell.energy * 1.6, 0, 1) : 1;
    const densityDuck = mapRange(conductor.metrics.density, 0, 1, 1.15, 0.42);
    const gain = familyGain
      * (0.25 + cell.energy * 0.85)
      * mapRange(cell.size, 5, 44, 0.7, 1.35)
      * pulse
      * soloFactor
      * dyingFactor
      * densityDuck;
    voice.gain.gain.setTargetAtTime(clamp(gain, 0, 0.072), now, 0.12);
    if (voice.lfoGain) {
      voice.lfoGain.gain.setTargetAtTime(targetFrequency * lerp(0.002, 0.028, cell.modulation), now, 0.2);
    }
    if (voice.noiseGain) {
      const grains = cell.family === "granular" ? lerp(0.08, 0.52, cell.energy) : 0.12;
      voice.noiseGain.gain.setTargetAtTime(grains, now, 0.08);
    }
  }

  releaseVoice(id, seconds = 1.4) {
    const voice = this.voiceMap.get(id);
    if (!voice || !this.context) return;
    this.voiceMap.delete(id);
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0.0001, now + seconds);
    window.setTimeout(() => {
      this.disposeVoice(voice);
    }, seconds * 1000 + 80);
  }

  removeAllVoices() {
    this.voiceMap.forEach((voice) => this.disposeVoice(voice));
    this.voiceMap.clear();
  }

  disposeVoice(voice) {
    voice.oscillators.forEach(({ osc }) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (_) {
        // Oscillators may already be stopped by a browser cleanup pass.
      }
    });
    voice.lfos.forEach((lfo) => {
      try {
        lfo.stop();
        lfo.disconnect();
      } catch (_) {
        // No-op.
      }
    });
    if (voice.noise) {
      try {
        voice.noise.stop();
        voice.noise.disconnect();
      } catch (_) {
        // No-op.
      }
    }
    voice.partialGains.forEach((gain) => {
      try {
        gain.disconnect();
      } catch (_) {
        // No-op.
      }
    });
    [voice.noiseGain, voice.lfoGain, voice.filter, voice.panner, voice.gain].forEach((node) => {
      if (!node) return;
      try {
        node.disconnect();
      } catch (_) {
        // No-op.
      }
    });
  }

  cellPan(cell, spread = 0.96) {
    return mapRange(cell.x, 0, window.innerWidth, -spread, spread);
  }

  cellEventFrequency(cell, ratio = 1) {
    const family = FAMILY_AUDIO_SIGNATURES[cell.family] || FAMILY_AUDIO_SIGNATURES.drone;
    const geneRatio = cell.gene.eventRatio || family.eventRatio;
    return clamp(cell.frequency * ratio * geneRatio, 45, 7600);
  }

  cellPing(cell, intensity = 0.5, type = "collision", delay = 0) {
    if (!this.enabled || !this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime + delay;
    const family = FAMILY_AUDIO_SIGNATURES[cell.family] || FAMILY_AUDIO_SIGNATURES.drone;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const signatureBoost = type === "fusion" ? 1.2 : type === "division" ? 1.08 : 1;
    osc.type = family.wave;
    osc.frequency.setValueAtTime(this.cellEventFrequency(cell, signatureBoost), now);
    if (type === "fusion") {
      osc.frequency.exponentialRampToValueAtTime(clamp(cell.frequency * 0.74, 40, 6200), now + 0.72);
    }
    filter.type = cell.family === "granular" ? "bandpass" : "lowpass";
    filter.frequency.value = clamp(cell.frequency * lerp(4, 18, cell.gene.eventColor || 0.5), 420, 9800);
    filter.Q.value = lerp(0.9, 5.2, cell.gene.timbreTilt || 0.5);
    panner.pan.value = this.cellPan(cell);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(clamp(0.006 + intensity * 0.042, 0.006, 0.055), now + family.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + family.release * lerp(0.55, 1.1, intensity));
    osc.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.bus);
    osc.start(now);
    osc.stop(now + family.release * 1.25 + 0.1);
  }

  collisionEvent(cellA, cellB, force) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    if (now < this.eventCooldown) return;
    this.eventCooldown = now + 0.035;
    const ctx = this.context;
    const pan = mapRange((cellA.x + cellB.x) * 0.5, 0, window.innerWidth, -0.9, 0.9);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    const gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = lerp(0.8, 2.3, clamp(force, 0, 1));
    filter.type = "bandpass";
    filter.frequency.value = lerp(380, 7200, clamp(force, 0, 1));
    filter.Q.value = lerp(1.6, 8, clamp(force, 0, 1));
    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(clamp(0.008 + force * 0.05, 0.008, 0.07), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + lerp(0.08, 0.34, force));
    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.bus);
    source.start(now);
    source.stop(now + 0.45);
    this.cellPing(cellA, force, "collision", 0);
    this.cellPing(cellB, force, "collision", 0.026);
  }

  divisionEvent(parent, child) {
    if (!this.enabled || !this.context) return;
    this.cellPing(parent, 0.45, "division", 0);
    this.cellPing(child, 0.64, "division", 0.08);
    this.bellEvent(child.x, child.frequency, 0.024, 1.25);
  }

  fusionEvent(cellA, cellB, fusedCell) {
    if (!this.enabled || !this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    [cellA, cellB].forEach((cell, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const panner = ctx.createStereoPanner();
      const start = now + index * 0.055;
      osc.type = cell.family === "unstable" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(clamp(cell.frequency, 34, 5200), start);
      osc.frequency.exponentialRampToValueAtTime(clamp(fusedCell.frequency * (index ? 1.005 : 0.995), 34, 5200), start + 1.18);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(clamp(cell.frequency * 12, 600, 10400), start);
      filter.frequency.exponentialRampToValueAtTime(clamp(fusedCell.frequency * 7, 420, 8200), start + 1.4);
      panner.pan.setValueAtTime(this.cellPan(cell, 0.86), start);
      panner.pan.linearRampToValueAtTime(this.cellPan(fusedCell, 0.58), start + 1.15);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.03, start + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.15);
      osc.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
      gain.connect(this.bus);
      osc.start(start);
      osc.stop(start + 2.28);
    });
    this.cellPing(fusedCell, 0.62, "fusion", 0.48);
    this.releaseVoice(cellA.id, 0.9);
    this.releaseVoice(cellB.id, 0.9);
  }

  deathEvent(cell) {
    if (!this.enabled || !this.context) return;
    this.breathEvent(cell.x, cell.frequency * 0.5, 0.018, 1.6);
  }

  bellEvent(x, frequency, amount, duration) {
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = "triangle";
    osc.frequency.value = clamp(frequency * 2, 90, 5200);
    filter.type = "lowpass";
    filter.frequency.value = 4600;
    panner.pan.value = mapRange(x, 0, window.innerWidth, -0.8, 0.8);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amount, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.bus);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  breathEvent(x, frequency, amount, duration) {
    const ctx = this.context;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.55;
    filter.type = "lowpass";
    filter.frequency.value = clamp(frequency * 5, 180, 2800);
    panner.pan.value = mapRange(x, 0, window.innerWidth, -0.75, 0.75);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amount, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.bus);
    source.start(now);
    source.stop(now + duration + 0.1);
  }
}

class Conductor {
  constructor() {
    this.mode = "calm";
    this.phase = PHASES[0];
    this.phaseTime = 0;
    this.ritualTime = 0;
    this.ritualStageIndex = 0;
    this.metrics = {
      density: 0,
      energy: 0,
      dissonance: 0,
      collisions: 0,
    };
    this.controls = { ...MODE_PROFILES.calm };
    this.audio = {
      reverb: 0.44,
      delay: 0.08,
      feedback: 0.22,
      lowpass: 7400,
    };
    this.chaosLevel = 0.05;
    this.lastText = "Respiration initiale.";
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === "ritual") {
      this.ritualTime = 0;
      this.ritualStageIndex = 0;
    }
  }

  update(organism, dt) {
    this.phaseTime += dt;
    if (this.mode === "ritual") {
      this.ritualTime += dt;
      this.ritualStageIndex = this.currentRitualStage().index;
    }
    this.measure(organism);
    const base = this.profileForMode();
    const densityBrake = mapRange(this.metrics.density, 0.45, 0.9, 1, 0.35);
    this.controls = {
      ...base,
      division: base.division * densityBrake,
      death: base.death * mapRange(this.metrics.density, 0.25, 0.95, 0.65, 1.7),
      targetEnergy: lerp(base.targetEnergy, 0.46, this.metrics.dissonance * 0.25),
      consonance: clamp(base.consonance - this.metrics.dissonance * 0.18, 0.28, 0.95),
    };
    this.chaosLevel = clamp(base.chaos + this.metrics.dissonance * 0.26 + this.metrics.collisions * 0.2, 0, 0.92);
    this.audio = {
      reverb: clamp(base.reverb * mapRange(this.metrics.density, 0, 1, 1.18, 0.62), 0.16, 0.8),
      delay: clamp(0.05 + this.chaosLevel * 0.16, 0.04, 0.22),
      feedback: clamp(0.16 + this.chaosLevel * 0.22, 0.12, 0.38),
      lowpass: clamp(base.lowpass * mapRange(this.metrics.dissonance, 0, 1, 1.08, 0.74), 2600, 11800),
    };
    this.choosePhase(organism);
    this.lastText = this.describe();
  }

  profileForMode() {
    if (this.mode !== "ritual") return MODE_PROFILES[this.mode];
    const stage = this.currentRitualStage();
    const nextStage = RITUAL_STAGES[Math.min(stage.index + 1, RITUAL_STAGES.length - 1)];
    const blend = stage.id === nextStage.id ? 0 : smoothstep(mapRange(stage.localProgress, 0.68, 1, 0, 1));
    return this.mixProfiles(stage.profile, nextStage.profile, blend);
  }

  ritualProgress() {
    return (this.ritualTime % RITUAL_DURATION) / RITUAL_DURATION;
  }

  currentRitualStage() {
    const progress = this.ritualProgress();
    let index = 0;
    for (let i = 0; i < RITUAL_STAGES.length; i += 1) {
      if (progress >= RITUAL_STAGES[i].start) index = i;
    }
    const stage = RITUAL_STAGES[index];
    const next = RITUAL_STAGES[index + 1];
    const end = next ? next.start : 1;
    return {
      ...stage,
      index,
      localProgress: mapRange(progress, stage.start, end, 0, 1),
    };
  }

  mixProfiles(a, b, t) {
    const result = {};
    Object.keys(a).forEach((key) => {
      result[key] = lerp(a[key], b[key], t);
    });
    return result;
  }

  measure(organism) {
    const cells = organism.cells.filter((cell) => cell.state !== "dead");
    this.metrics.density = clamp(cells.length / MAX_CELLS, 0, 1);
    this.metrics.energy = cells.length
      ? cells.reduce((sum, cell) => sum + cell.energy, 0) / cells.length
      : 0;
    this.metrics.collisions = lerp(this.metrics.collisions, clamp(organism.recentCollisions / 12, 0, 1), 0.08);
    organism.recentCollisions *= 0.84;

    let dissonance = 0;
    let count = 0;
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < Math.min(cells.length, i + 7); j += 1) {
        const a = cells[i].frequency;
        const b = cells[j].frequency;
        const interval = Math.abs(12 * Math.log2(b / a));
        const pitchClass = Math.round(interval) % 12;
        const consonance = [0, 3, 4, 5, 7, 8, 9].includes(pitchClass) ? 0.18 : [1, 2, 6, 10, 11].includes(pitchClass) ? 0.82 : 0.5;
        dissonance += consonance * mapRange(distance(cells[i], cells[j]), 30, 240, 1, 0.15);
        count += 1;
      }
    }
    this.metrics.dissonance = count ? clamp(dissonance / count, 0, 1) : 0;
  }

  choosePhase(organism) {
    if (this.mode === "ritual") {
      const stage = this.currentRitualStage();
      this.phase = { id: stage.id, label: stage.label };
      return;
    }
    if (organism.cells.length < 12) this.phase = PHASES[0];
    else if (organism.cells.length < 26) this.phase = PHASES[1];
    else if (this.metrics.dissonance < 0.34 && this.metrics.energy < 0.68) this.phase = PHASES[2];
    else if (this.chaosLevel > 0.48) this.phase = PHASES[3];
    else if (this.metrics.energy < 0.18) this.phase = PHASES[4];
    else this.phase = PHASES[2];
  }

  describe() {
    if (this.mode === "ritual") {
      const stage = this.currentRitualStage();
      const elapsed = this.ritualTime % RITUAL_DURATION;
      return `${stage.text} ${formatClock(elapsed)} / ${formatClock(RITUAL_DURATION)}.`;
    }
    if (this.metrics.density > 0.76) return "Densite haute: divisions freinees, filtre adouci.";
    if (this.metrics.dissonance > 0.58) return "Tension detectee: consonance et volume corriges.";
    if (this.phase.id === "mutation") return "Mutation active: accidents courts sous controle.";
    if (this.phase.id === "extinction") return "Extinction lente: les halos respirent puis s'effacent.";
    if (this.metrics.energy < 0.22) return "Quasi-silence fertile: ecoute des respirations.";
    return "Equilibre vivant: la partition reste ouverte.";
  }
}

class Cell {
  constructor(organism, options = {}) {
    this.organism = organism;
    this.id = options.id || `cell-${organism.nextCellId++}`;
    this.x = options.x ?? organism.rng.range(window.innerWidth * 0.25, window.innerWidth * 0.75);
    this.y = options.y ?? organism.rng.range(window.innerHeight * 0.22, window.innerHeight * 0.82);
    this.vx = options.vx ?? organism.rng.signed(0.38);
    this.vy = options.vy ?? organism.rng.signed(0.38);
    this.size = options.size ?? organism.rng.range(7, 24);
    this.mass = options.mass ?? this.size ** 1.25;
    this.energy = options.energy ?? organism.rng.range(0.24, 0.68);
    this.age = options.age ?? 0;
    this.state = options.state || "calm";
    this.family = options.family || organism.rng.choice(CELL_FAMILIES);
    this.hue = options.hue ?? this.initialHue();
    this.saturation = options.saturation ?? organism.rng.range(72, 96);
    this.lightness = options.lightness ?? organism.rng.range(56, 72);
    this.baseDegree = options.baseDegree ?? organism.rng.int(0, 9);
    this.octave = options.octave ?? organism.rng.int(-1, 2);
    this.frequency = options.frequency ?? organism.frequencyForCell(this);
    this.targetFrequency = this.frequency;
    this.modulation = options.modulation ?? organism.rng.range(0.08, 0.42);
    this.memory = options.memory || [];
    this.phase = options.phase ?? organism.rng.range(0, TWO_PI);
    this.alpha = options.alpha ?? 0;
    this.solo = false;
    this.speedNorm = 0;
    this.birthTime = organism.elapsed;
    this.collisionCooldown = 0;
    this.lastEventAt = options.lastEventAt ?? -999;
    this.lastEventType = options.lastEventType || "birth";
    this.eventIntensity = options.eventIntensity ?? 0;
    this.gene = { ...this.createGene(), ...(options.gene || {}) };
  }

  createGene() {
    const rng = this.organism.rng;
    const familyBias = {
      drone: 1.25,
      granular: 0.85,
      pulsing: 1,
      spectral: 1.08,
      unstable: 0.78,
    }[this.family];
    return {
      attraction: rng.range(0.16, 0.72) * familyBias,
      repulsion: rng.range(0.62, 1.35),
      wander: rng.range(0.18, 0.78),
      divisionThreshold: rng.range(0.78, 0.94),
      lifespan: rng.range(180, 520) * familyBias,
      pulseRate: rng.range(0.45, 2.8),
      vibratoRate: rng.range(0.035, 0.19),
      instability: rng.range(0.04, 0.55),
      compatibility: rng.range(0.28, 0.9),
      seedPhase: rng.range(0, TWO_PI),
      formantRatio: rng.range(1.15, 3.4),
      timbreTilt: rng.range(0.12, 0.92),
      eventRatio: rng.choice([0.5, 1, 1.5, 2, 2.5, 3]),
      eventColor: rng.range(0.16, 0.94),
    };
  }

  initialHue() {
    const base = FAMILY_COLORS[this.family] || FAMILY_COLORS.drone;
    return (base.hue + this.organism.rng.signed(16) + 360) % 360;
  }

  update(dt, neighbors) {
    const conductor = this.organism.conductor;
    const controls = conductor.controls;
    this.age += dt;
    this.phase += dt * (0.45 + this.energy * 1.8 + conductor.chaosLevel);
    this.alpha = clamp(this.alpha + dt * 0.18, 0, 1);
    this.frequency = lerp(this.frequency, this.targetFrequency, 0.025);

    if (this.state === "dying") {
      this.energy -= dt * 0.072;
      this.size = Math.max(1.8, this.size - dt * 0.72);
      this.vx *= 0.986;
      this.vy *= 0.986;
      if (this.energy <= 0.012 || this.size <= 2.1) this.state = "dead";
      return;
    }

    const targetEnergy = controls.targetEnergy;
    this.energy += (targetEnergy - this.energy) * dt * 0.018;
    this.energy -= dt * mapRange(this.age, 0, this.gene.lifespan, 0.0006, 0.0042);
    this.energy += this.organism.energyField * dt * 0.02;
    this.energy = clamp(this.energy, 0, 1.08);

    this.applyForces(dt, neighbors);
    this.updateState();

    const oldFreq = this.targetFrequency;
    this.targetFrequency = this.organism.frequencyForCell(this);
    if (Math.abs(Math.log2(this.targetFrequency / oldFreq)) > 0.2) {
      this.targetFrequency = lerp(oldFreq, this.targetFrequency, 0.35);
    }

    if (this.energy > this.gene.divisionThreshold && this.organism.autoEvolution) {
      this.organism.considerDivision(this, dt);
    }
    const oldAge = this.age > this.gene.lifespan;
    const depleted = this.energy < 0.035 && this.age > 20;
    if ((oldAge || depleted) && this.organism.rng.chance(dt * 0.28 * controls.death)) {
      this.die();
    }
  }

  applyForces(dt, neighbors) {
    const organism = this.organism;
    const controls = organism.conductor.controls;
    const t = organism.elapsed;
    let ax = 0;
    let ay = 0;
    const flow = organism.flowAt(this.x, this.y, t + this.gene.seedPhase);
    ax += flow.x * this.gene.wander * 0.06;
    ay += flow.y * this.gene.wander * 0.06;

    neighbors.forEach((other) => {
      if (other === this || other.state === "dead") return;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / d;
      const ny = dy / d;
      const desired = this.size + other.size + 18;
      if (d < desired) {
        const push = ((desired - d) / desired) * this.gene.repulsion * 0.2;
        ax -= nx * push;
        ay -= ny * push;
      } else if (d < 240) {
        const compatibility = organism.harmonicCompatibility(this, other);
        const pull = compatibility * this.gene.attraction * mapRange(d, 45, 240, 0.024, 0.002);
        ax += nx * pull;
        ay += ny * pull;
      }
    });

    const mouse = organism.mouse;
    if (mouse.active) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      if (d < mouse.radius) {
        const influence = (1 - d / mouse.radius) ** 2;
        const sign = mouse.dragging ? 1 : -0.35;
        ax += (dx / d) * influence * 0.18 * sign;
        ay += (dy / d) * influence * 0.18 * sign;
        this.energy = clamp(this.energy + influence * dt * 0.12, 0, 1.08);
        this.modulation = clamp(this.modulation + influence * dt * 0.07, 0, 1);
      }
    }

    const margin = 34 + this.size;
    if (this.x < margin) ax += mapRange(this.x, 0, margin, 0.18, 0);
    if (this.x > window.innerWidth - margin) ax -= mapRange(this.x, window.innerWidth - margin, window.innerWidth, 0, 0.18);
    if (this.y < margin) ay += mapRange(this.y, 0, margin, 0.18, 0);
    if (this.y > window.innerHeight - margin) ay -= mapRange(this.y, window.innerHeight - margin, window.innerHeight, 0, 0.18);

    const chaosKick = organism.conductor.chaosLevel * this.gene.instability;
    ax += Math.sin(t * 1.3 + this.gene.seedPhase * 2.1) * chaosKick * 0.025;
    ay += Math.cos(t * 1.1 + this.gene.seedPhase * 1.7) * chaosKick * 0.025;

    this.vx += ax * dt * 60;
    this.vy += ay * dt * 60;
    const maxSpeed = lerp(0.38, 2.8, this.energy) * controls.speed;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }
    this.vx *= 0.994;
    this.vy *= 0.994;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.x = clamp(this.x, 2, window.innerWidth - 2);
    this.y = clamp(this.y, 2, window.innerHeight - 2);
    this.speedNorm = clamp(speed / 3, 0, 1);
    this.energy += this.speedNorm * dt * 0.008;
  }

  updateState() {
    if (this.energy < 0.12) this.state = "calm";
    else if (this.energy > 0.88) this.state = "unstable";
    else if (this.energy > 0.52) this.state = "active";
    else this.state = "calm";
  }

  draw(p) {
    if (this.state === "dead") return;
    const pulse = Math.sin(this.phase * 1.6) * 0.5 + 0.5;
    const visualSize = this.size * (1 + pulse * 0.08 + this.energy * 0.16);
    const alpha = this.alpha * (this.state === "dying" ? clamp(this.energy * 1.8, 0, 1) : 1);
    const hue = (this.hue + this.energy * 22 + this.age * 0.25) % 360;

    p.push();
    p.noStroke();
    p.fill(hue, this.saturation, clamp(this.lightness + 4, 0, 78), 0.13 * alpha);
    p.circle(this.x, this.y, visualSize * 2.35);
    p.fill(hue, this.saturation, clamp(this.lightness + 8, 0, 82), 0.5 * alpha);
    p.circle(this.x, this.y, visualSize * 1.04);
    p.stroke(hue, 72, 72, 0.34 * alpha);
    p.strokeWeight(0.9);
    p.noFill();
    p.circle(this.x, this.y, visualSize * 1.52);

    p.noStroke();
    p.fill(hue, 74, 76, 0.82 * alpha);
    p.circle(this.x, this.y, Math.max(2.4, visualSize * 0.18));

    if (this.solo) {
      p.stroke(185, 100, 88, 0.75 * alpha);
      p.strokeWeight(1.8);
      p.noFill();
      p.circle(this.x, this.y, visualSize * 3.4);
    }

    this.drawSignature(p, visualSize, hue, alpha);
    p.pop();
  }

  drawSignature(p, visualSize, hue, alpha) {
    const code = FAMILY_AUDIO_SIGNATURES[this.family]?.code || "?";
    const eventAge = this.organism.elapsed - this.lastEventAt;
    const eventPulse = eventAge < 1.25 ? (1 - eventAge / 1.25) * this.eventIntensity : 0;
    if (!this.solo && eventPulse <= 0.03) return;
    p.push();
    p.noFill();
    p.stroke(hue, 100, 82, (0.16 + eventPulse * 0.55) * alpha);
    p.strokeWeight(0.8 + eventPulse * 1.8);
    if (this.family === "drone") {
      p.ellipse(this.x, this.y, visualSize * 2.55, visualSize * 2.1);
    } else if (this.family === "granular") {
      for (let i = 0; i < 4; i += 1) {
        const a = this.phase + i * TWO_PI / 4;
        p.circle(this.x + Math.cos(a) * visualSize * 1.1, this.y + Math.sin(a) * visualSize * 0.9, 2.2 + eventPulse * 3);
      }
    } else if (this.family === "pulsing") {
      p.circle(this.x, this.y, visualSize * (2.05 + Math.sin(this.phase * 2.6) * 0.16));
      p.circle(this.x, this.y, visualSize * 1.18);
    } else if (this.family === "spectral") {
      for (let i = 0; i < 4; i += 1) {
        const a = this.phase * 0.18 + i * TWO_PI / 4;
        p.line(this.x, this.y, this.x + Math.cos(a) * visualSize * 1.65, this.y + Math.sin(a) * visualSize * 1.65);
      }
    } else if (this.family === "unstable") {
      p.beginShape();
      for (let i = 0; i < 6; i += 1) {
        const a = this.phase * 0.45 + i * TWO_PI / 6;
        const r = visualSize * (1.1 + ((i % 2) ? 0.44 : 0.08) + eventPulse * 0.42);
        p.vertex(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
      }
      p.endShape(p.CLOSE);
    }

    if (eventPulse > 0.03 || this.solo) {
      p.noStroke();
      p.fill(hue, 100, 88, (0.58 + eventPulse * 0.34) * alpha);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(8 + eventPulse * 3);
      p.text(code, this.x, this.y - visualSize * 1.9);
    }
    p.pop();
  }

  markEvent(type, intensity = 0.5, at = this.organism.elapsed) {
    this.lastEventAt = at;
    this.lastEventType = type;
    this.eventIntensity = clamp(intensity, 0, 1);
  }

  die() {
    if (this.state === "dying" || this.state === "dead") return;
    this.state = "dying";
    this.markEvent("death", 0.5);
    this.organism.emitEvent("death", [this], { intensity: 0.45 });
    this.organism.audio.deathEvent(this);
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      size: this.size,
      mass: this.mass,
      energy: this.energy,
      age: this.age,
      state: this.state,
      family: this.family,
      hue: this.hue,
      saturation: this.saturation,
      lightness: this.lightness,
      baseDegree: this.baseDegree,
      octave: this.octave,
      frequency: this.frequency,
      modulation: this.modulation,
      memory: this.memory.slice(-12),
      phase: this.phase,
      alpha: this.alpha,
      lastEventAt: this.lastEventAt,
      lastEventType: this.lastEventType,
      eventIntensity: this.eventIntensity,
      gene: this.gene,
    };
  }
}

class Organism {
  constructor(p, audio, ui) {
    this.p = p;
    this.audio = audio;
    this.ui = ui;
    this.seed = "marais-bleu-2049";
    this.rng = new SeededRandom(this.seed);
    this.cells = [];
    this.particles = [];
    this.spatialGrid = new Map();
    this.nextCellId = 1;
    this.mode = "calm";
    this.harmonicIndex = 2;
    this.baseFrequency = 55;
    this.conductor = new Conductor();
    this.elapsed = 0;
    this.frameIndex = 0;
    this.lastAudioFrame = 0;
    this.lastTime = performance.now();
    this.paused = false;
    this.autoEvolution = true;
    this.energyField = 0;
    this.recentCollisions = 0;
    this.events = [];
    this.lastEventText = "Dernier son: respiration initiale";
    this.soloId = null;
    this.soloUntil = 0;
    this.mouse = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
      active: false,
      dragging: false,
      radius: 170,
    };
    this.ritualState = {
      stageId: null,
      nextCueAt: 0,
    };
    this.quality = qualityProfile();
    this.reset(this.seed);
  }

  reset(seed = this.seed, options = {}) {
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.quality = qualityProfile();
    this.nextCellId = 1;
    this.cells = [];
    this.spatialGrid = new Map();
    this.particles = this.createParticles();
    this.elapsed = 0;
    this.frameIndex = 0;
    this.lastAudioFrame = 0;
    this.lastTime = performance.now();
    this.recentCollisions = 0;
    this.energyField = 0;
    this.events = [];
    this.lastEventText = "Dernier son: respiration initiale";
    this.soloId = null;
    this.ritualState = {
      stageId: null,
      nextCueAt: 0,
    };
    this.baseFrequency = [41.2, 48.99, 55, 65.41, 73.42][this.rng.int(0, 4)];
    this.harmonicIndex = options.harmonicIndex ?? this.rng.int(0, HARMONIC_MODES.length - 1);
    this.conductor = new Conductor();
    this.conductor.setMode(options.mode || this.mode || "calm");
    this.mode = this.conductor.mode;
    const ritualBirth = this.mode === "ritual";
    const initialCount = options.initialCount ?? Math.min(this.quality.maxCells, ritualBirth ? 4 : this.mode === "chaos" ? 14 : this.mode === "stable" ? 12 : 9);
    for (let i = 0; i < initialCount; i += 1) {
      this.addCell(undefined, undefined, {
        energy: this.rng.range(ritualBirth ? 0.08 : 0.18, ritualBirth ? 0.28 : 0.58),
        size: this.rng.range(ritualBirth ? 13 : 8, this.mode === "calm" || ritualBirth ? 28 : 22),
        family: ritualBirth ? this.rng.choice(["drone", "spectral", "pulsing"]) : undefined,
        alpha: this.rng.range(ritualBirth ? 0.02 : 0.1, ritualBirth ? 0.32 : 0.8),
      });
    }
    if (ritualBirth) {
      this.autoEvolution = true;
      this.lastEventText = "Dernier son: RITUEL seed remise a zero";
    }
    this.audio.removeAllVoices();
    this.updateHarmonyUi();
    this.updateModeUi();
  }

  update() {
    const now = performance.now();
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = now;
    if (this.paused) {
      this.drawOnly();
      return;
    }
    this.elapsed += dt;
    this.frameIndex += 1;
    this.quality = qualityProfile();
    this.energyField = lerp(this.energyField, 0, 0.016);
    if (this.soloId && this.elapsed > this.soloUntil) {
      this.clearSolo();
    }
    this.conductor.update(this, dt);
    this.audio.updateGlobal(this.conductor);
    this.autoManagePopulation(dt);

    const activeCells = this.cells.filter((cell) => cell.state !== "dead");
    this.buildSpatialIndex(activeCells);
    activeCells.forEach((cell) => cell.update(dt, this.getNearbyCells(cell, 260)));
    this.buildSpatialIndex(activeCells);
    this.handleInteractions(dt, activeCells);
    if (this.mode === "ritual") this.updateRitualNarrative(dt);
    this.cells = this.cells.filter((cell) => cell.state !== "dead");
    if (this.frameIndex - this.lastAudioFrame >= this.quality.audioSyncEvery) {
      this.audio.syncCells(this.cells, this.conductor);
      this.lastAudioFrame = this.frameIndex;
    }
  }

  drawOnly() {
    this.frameIndex += 1;
    this.cells.forEach((cell) => {
      cell.phase += 0.004;
    });
  }

  draw(p) {
    if (this.frameIndex % this.quality.drawParticlesEvery === 0) this.drawParticles(p);
    if (this.quality.flowLines > 0 && this.frameIndex % 8 === 0) this.drawFlowField(p);
    if (this.frameIndex % this.quality.drawConnectionsEvery === 0) this.drawConnections(p);
    if (this.frameIndex % this.quality.drawEventsEvery === 0) this.drawEvents(p);
    this.cells.forEach((cell) => cell.draw(p));
  }

  createParticles() {
    return Array.from({ length: this.quality.particles }, () => ({
      x: this.rng.range(0, window.innerWidth),
      y: this.rng.range(0, window.innerHeight),
      drift: this.rng.range(0.08, 0.42),
      size: this.rng.range(0.8, 2.8),
      hue: this.rng.choice([192, 207, 156, 44, 28, 264]) + this.rng.signed(14),
      phase: this.rng.range(0, TWO_PI),
      depth: this.rng.range(0.25, 1),
    }));
  }

  drawParticles(p) {
    p.push();
    p.noStroke();
    const t = this.elapsed * 0.34;
    this.particles.forEach((particle) => {
      const flow = this.flowAt(particle.x, particle.y, t + particle.phase);
      particle.x = (particle.x + flow.x * particle.drift + window.innerWidth) % window.innerWidth;
      particle.y = (particle.y + flow.y * particle.drift + window.innerHeight) % window.innerHeight;
      const shimmer = 0.16 + (Math.sin(t + particle.phase) * 0.5 + 0.5) * 0.22;
      p.fill(particle.hue, 92, 68, shimmer * particle.depth);
      p.circle(particle.x, particle.y, particle.size);
    });
    p.pop();
  }

  drawFlowField(p) {
    p.push();
    p.noFill();
    const t = this.elapsed * 0.08;
    for (let i = 0; i < this.quality.flowLines; i += 1) {
      const cx = (Math.sin(t + i * 12.989 + hashSeed(this.seed) * 0.00001) * 0.5 + 0.5) * p.width;
      const cy = (Math.cos(t * 1.17 + i * 7.31) * 0.5 + 0.5) * p.height;
      const hue = (190 + i * 18 + this.elapsed * 2) % 360;
      p.stroke(hue, 90, 64, 0.03);
      p.strokeWeight(0.7);
      p.beginShape();
      for (let a = 0; a < TWO_PI * 1.35; a += 0.22) {
        const r = 30 + i * 7 + Math.sin(a * 3 + t * 5) * 18;
        p.curveVertex(cx + Math.cos(a + t) * r * 1.6, cy + Math.sin(a * 0.9 - t) * r);
      }
      p.endShape();
    }
    p.pop();
  }

  drawConnections(p) {
    p.push();
    const seen = new Set();
    this.cells.forEach((a) => {
      this.getNearbyCells(a, 190).forEach((b) => {
        if (a === b || b.state === "dead") return;
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const d = distance(a, b);
        if (d > 190) return;
        const compatibility = this.harmonicCompatibility(a, b);
        const alpha = mapRange(d, 40, 190, 0.18, 0.01) * compatibility;
        p.stroke(lerp(a.hue, b.hue, 0.5), 90, 74, alpha);
        p.strokeWeight(lerp(0.25, 1.4, compatibility));
        p.line(a.x, a.y, b.x, b.y);
      });
    });
    p.pop();
  }

  drawEvents(p) {
    const alive = [];
    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(9);
    p.noFill();
    this.events.forEach((event) => {
      const age = this.elapsed - event.born;
      if (age > event.life) return;
      alive.push(event);
      const t = clamp(age / event.life, 0, 1);
      const alpha = (1 - t) ** 1.45;
      const intensity = event.intensity;
      const [a, b, c] = event.points;
      const hue = event.hue;
      p.strokeWeight(1 + intensity * 3);

      if (event.type === "collision" && a && b) {
        p.stroke(a.hue, 100, 76, alpha * 0.44);
        p.line(a.x, a.y, b.x, b.y);
        [a, b].forEach((point, index) => {
          p.stroke(point.hue, 100, 78, alpha * 0.72);
          p.circle(point.x, point.y, (18 + t * 80 + intensity * 34) * (index ? 0.82 : 1));
        });
        p.noStroke();
        p.fill(hue, 100, 84, alpha * 0.82);
        p.text(event.label, event.x, event.y - 16 - t * 18);
      } else if (event.type === "fusion" && a && b) {
        const radius = 28 + t * 96 + intensity * 40;
        p.stroke(a.hue, 100, 78, alpha * 0.42);
        p.line(a.x, a.y, event.x, event.y);
        p.stroke(b.hue, 100, 78, alpha * 0.42);
        p.line(b.x, b.y, event.x, event.y);
        p.stroke(hue, 92, 82, alpha * 0.72);
        p.circle(event.x, event.y, radius);
        p.beginShape();
        for (let i = 0; i < 14; i += 1) {
          const spin = i / 14;
          const angle = spin * TWO_PI * 2.2 + t * 5;
          const r = radius * spin * 0.55;
          p.curveVertex(event.x + Math.cos(angle) * r, event.y + Math.sin(angle) * r);
        }
        p.endShape();
        if (c) {
          p.stroke(c.hue, 100, 88, alpha * 0.62);
          p.circle(c.x, c.y, 20 + t * 62);
        }
        p.noStroke();
        p.fill(hue, 100, 86, alpha * 0.9);
        p.text(event.label, event.x, event.y - radius * 0.34);
      } else if (event.type === "division" && a && b) {
        const beadX = lerp(a.x, b.x, t);
        const beadY = lerp(a.y, b.y, t);
        p.stroke(a.hue, 100, 76, alpha * 0.34);
        p.line(a.x, a.y, b.x, b.y);
        p.stroke(b.hue, 100, 82, alpha * 0.8);
        p.circle(b.x, b.y, 20 + t * 70);
        p.noStroke();
        p.fill(b.hue, 100, 86, alpha * 0.86);
        p.circle(beadX, beadY, 4 + intensity * 8);
        p.text(event.label, b.x, b.y - 20 - t * 20);
      } else if (event.type === "death" && a) {
        p.stroke(a.hue, 70, 72, alpha * 0.38);
        p.circle(a.x, a.y, 24 + t * 110);
        p.noStroke();
        p.fill(a.hue, 70, 80, alpha * 0.54);
        p.text(event.label, a.x, a.y - 18 - t * 22);
      }
    });
    p.pop();
    this.events = alive.slice(-28);
  }

  buildSpatialIndex(cells = this.cells) {
    this.spatialGrid.clear();
    cells.forEach((cell) => {
      if (cell.state === "dead") return;
      const key = this.gridKeyFor(cell.x, cell.y);
      if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, []);
      this.spatialGrid.get(key).push(cell);
    });
  }

  gridKeyFor(x, y) {
    return `${Math.floor(x / GRID_SIZE)},${Math.floor(y / GRID_SIZE)}`;
  }

  getNearbyCells(cellOrPoint, radius = GRID_SIZE) {
    const cx = Math.floor(cellOrPoint.x / GRID_SIZE);
    const cy = Math.floor(cellOrPoint.y / GRID_SIZE);
    const reach = Math.max(1, Math.ceil(radius / GRID_SIZE));
    const nearby = [];
    for (let gx = cx - reach; gx <= cx + reach; gx += 1) {
      for (let gy = cy - reach; gy <= cy + reach; gy += 1) {
        const bucket = this.spatialGrid.get(`${gx},${gy}`);
        if (bucket) nearby.push(...bucket);
      }
    }
    return nearby;
  }

  flowAt(x, y, t) {
    const nx = x / Math.max(1, window.innerWidth);
    const ny = y / Math.max(1, window.innerHeight);
    const a = Math.sin(nx * 8.2 + t * 0.6) + Math.cos(ny * 7.1 - t * 0.4);
    const b = Math.cos(nx * 6.4 - t * 0.5) - Math.sin(ny * 8.6 + t * 0.3);
    return { x: Math.cos(a + b), y: Math.sin(a - b) };
  }

  addCell(x, y, options = {}) {
    if (this.cells.length >= this.quality.maxCells) return null;
    const cell = new Cell(this, {
      x: x ?? this.rng.range(window.innerWidth * 0.22, window.innerWidth * 0.78),
      y: y ?? this.rng.range(window.innerHeight * 0.18, window.innerHeight * 0.82),
      ...options,
    });
    cell.targetFrequency = this.frequencyForCell(cell);
    this.cells.push(cell);
    return cell;
  }

  eventPoint(cell) {
    if (!cell) return null;
    return {
      id: cell.id,
      x: cell.x,
      y: cell.y,
      hue: cell.hue,
      family: cell.family,
      frequency: cell.frequency,
    };
  }

  emitEvent(type, cells, options = {}) {
    const points = cells.map((cell) => this.eventPoint(cell)).filter(Boolean);
    if (!points.length) return;
    const intensity = clamp(options.force ?? options.intensity ?? 0.5, 0, 1);
    const x = options.x ?? points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const y = options.y ?? points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const hue = options.hue ?? points.reduce((sum, point) => sum + point.hue, 0) / points.length;
    const event = {
      type,
      label: EVENT_LABELS[type] || type.toUpperCase(),
      points,
      x,
      y,
      hue,
      born: this.elapsed,
      life: options.life ?? (type === "fusion" ? 2.4 : type === "division" ? 1.7 : 1.15),
      intensity,
    };
    this.events.push(event);
    if (this.events.length > 28) this.events.shift();
    cells.forEach((cell) => {
      if (cell?.markEvent) cell.markEvent(type, intensity, this.elapsed);
    });
    const ids = points.map((point) => point.id.replace("cell-", "#")).join(" + ");
    this.lastEventText = `Dernier son: ${event.label} ${ids}`;
  }

  autoManagePopulation(dt) {
    if (!this.autoEvolution) return;
    const target = Math.min(this.conductor.controls.targetCells, this.quality.maxCells);
    const shortage = target - this.cells.length;
    const birthRate = this.mode === "ritual" ? 0.2 : 0.1;
    if (shortage > 0 && this.rng.chance(dt * birthRate * shortage)) {
      const edge = this.rng.int(0, 3);
      const x = edge === 0 ? this.rng.range(60, window.innerWidth - 60) : edge === 1 ? -12 : edge === 2 ? window.innerWidth + 12 : this.rng.range(60, window.innerWidth - 60);
      const y = edge === 3 ? window.innerHeight + 12 : edge === 0 ? -12 : this.rng.range(60, window.innerHeight - 60);
      this.addCell(x, y, {
        energy: this.rng.range(this.mode === "ritual" ? 0.08 : 0.12, this.mode === "ritual" ? 0.34 : 0.42),
        size: this.rng.range(6, 16),
        alpha: 0,
      });
    }
    const excess = this.cells.length - target;
    const buffer = this.mode === "ritual" ? 1 : 10;
    const deathRate = this.mode === "ritual" ? dt * 0.11 * Math.max(1, excess) * this.conductor.controls.death : dt * 0.18;
    if (excess > buffer && this.rng.chance(deathRate)) {
      const candidate = this.rng.choice(this.cells.filter((cell) => cell.state !== "dying"));
      if (candidate) candidate.die();
    }
  }

  updateRitualNarrative(dt) {
    const stage = this.conductor.currentRitualStage();
    if (stage.id !== this.ritualState.stageId) {
      this.ritualState.stageId = stage.id;
      this.ritualState.nextCueAt = this.elapsed + 0.35;
      this.enterRitualStage(stage);
    }
    this.applyRitualMotion(stage, dt);
    if (this.elapsed < this.ritualState.nextCueAt) return;
    this.performRitualCue(stage);
  }

  enterRitualStage(stage) {
    this.lastEventText = `Dernier son: ${stage.label}`;
    if (stage.id === "ritual-birth") {
      this.cells.forEach((cell) => {
        cell.energy = clamp(cell.energy * 0.5, 0.04, 0.22);
        cell.modulation *= 0.4;
      });
    } else if (stage.id === "ritual-growth") {
      this.energyField = 0.55;
      this.cells.forEach((cell) => {
        cell.energy = clamp(cell.energy + this.rng.range(0.08, 0.18), 0, 0.72);
      });
    } else if (stage.id === "ritual-mutation") {
      this.energyField = 1;
      for (let i = 0; i < 3; i += 1) {
        this.addRitualCell(stage, { family: this.rng.choice(["unstable", "granular"]), energy: this.rng.range(0.62, 0.92), size: this.rng.range(6, 13) });
      }
    } else if (stage.id === "ritual-extinction") {
      this.cells
        .filter((cell) => cell.state !== "dying")
        .sort((a, b) => b.energy + b.age * 0.002 - (a.energy + a.age * 0.002))
        .slice(0, Math.max(0, this.cells.length - 7))
        .forEach((cell) => cell.die());
    } else if (stage.id === "ritual-rebirth") {
      for (let i = 0; i < 3; i += 1) {
        this.addRitualCell(stage, { family: this.rng.choice(["drone", "spectral", "pulsing"]), energy: this.rng.range(0.16, 0.34), size: this.rng.range(12, 24) });
      }
    }
  }

  applyRitualMotion(stage, dt) {
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.52;
    if (stage.id === "ritual-organism") {
      const radius = Math.min(window.innerWidth, window.innerHeight) * 0.22;
      this.cells.forEach((cell, index) => {
        const angle = index / Math.max(1, this.cells.length) * TWO_PI + this.elapsed * 0.08;
        const tx = cx + Math.cos(angle) * radius;
        const ty = cy + Math.sin(angle) * radius * 0.62;
        cell.vx += (tx - cell.x) * dt * 0.004;
        cell.vy += (ty - cell.y) * dt * 0.004;
        cell.energy = lerp(cell.energy, 0.56, dt * 0.045);
      });
    } else if (stage.id === "ritual-mutation") {
      this.energyField = Math.max(this.energyField, 0.72);
      this.cells.forEach((cell) => {
        cell.modulation = clamp(cell.modulation + dt * 0.09, 0, 1);
      });
    } else if (stage.id === "ritual-extinction") {
      this.cells.forEach((cell) => {
        cell.energy = clamp(cell.energy - dt * 0.026, 0, 1.08);
        cell.vx *= 0.982;
        cell.vy *= 0.982;
      });
    } else if (stage.id === "ritual-birth" || stage.id === "ritual-rebirth") {
      this.cells.forEach((cell) => {
        cell.vx += (cx - cell.x) * dt * 0.0014;
        cell.vy += (cy - cell.y) * dt * 0.0014;
      });
    }
  }

  performRitualCue(stage) {
    const target = Math.min(stage.profile.targetCells, this.quality.maxCells);
    if (stage.id === "ritual-birth" || stage.id === "ritual-rebirth") {
      if (this.cells.length < target) {
        this.addRitualCell(stage, { family: this.rng.choice(["drone", "spectral", "pulsing"]), energy: this.rng.range(0.1, 0.34), size: this.rng.range(11, 25) });
      }
      this.ritualState.nextCueAt = this.elapsed + this.rng.range(7, 11);
      return;
    }
    if (stage.id === "ritual-growth") {
      const parent = this.rng.choice(this.cells.filter((cell) => cell.state !== "dying" && cell.energy > 0.32));
      if (parent && this.cells.length < target) {
        parent.energy = clamp(parent.gene.divisionThreshold + 0.08, 0, 1.04);
        this.divideCell(parent);
      } else if (this.cells.length < target) {
        this.addRitualCell(stage, { family: this.rng.choice(["granular", "pulsing", "spectral"]), energy: this.rng.range(0.36, 0.62), size: this.rng.range(7, 16) });
      }
      this.ritualState.nextCueAt = this.elapsed + this.rng.range(4, 7);
      return;
    }
    if (stage.id === "ritual-organism") {
      const pair = this.compatibleRitualPair();
      if (pair && this.rng.chance(0.45)) this.fuseCells(pair[0], pair[1]);
      this.ritualState.nextCueAt = this.elapsed + this.rng.range(8, 13);
      return;
    }
    if (stage.id === "ritual-mutation") {
      this.cells.forEach((cell) => {
        cell.energy = clamp(cell.energy + this.rng.range(0.03, 0.12), 0, 1.08);
        cell.vx += this.rng.signed(0.65);
        cell.vy += this.rng.signed(0.65);
      });
      if (this.cells.length < target) {
        this.addRitualCell(stage, { family: this.rng.choice(["unstable", "granular"]), energy: this.rng.range(0.58, 0.9), size: this.rng.range(5, 12) });
      }
      this.ritualState.nextCueAt = this.elapsed + this.rng.range(3.2, 5.5);
      return;
    }
    if (stage.id === "ritual-extinction") {
      const living = this.cells.filter((cell) => cell.state !== "dying");
      if (living.length > target) {
        const candidate = living.sort((a, b) => b.age + b.energy * 60 - (a.age + a.energy * 60))[0];
        candidate?.die();
      }
      this.ritualState.nextCueAt = this.elapsed + this.rng.range(4.5, 7);
    }
  }

  addRitualCell(stage, options = {}) {
    const angle = this.rng.range(0, TWO_PI);
    const radius = stage.id === "ritual-mutation"
      ? this.rng.range(80, Math.min(window.innerWidth, window.innerHeight) * 0.44)
      : this.rng.range(12, Math.min(window.innerWidth, window.innerHeight) * 0.18);
    return this.addCell(window.innerWidth * 0.5 + Math.cos(angle) * radius, window.innerHeight * 0.52 + Math.sin(angle) * radius, {
      alpha: 0,
      vx: Math.cos(angle) * this.rng.range(0.05, 0.38),
      vy: Math.sin(angle) * this.rng.range(0.05, 0.38),
      ...options,
    });
  }

  compatibleRitualPair() {
    const living = this.cells.filter((cell) => cell.state !== "dying");
    for (let i = 0; i < living.length; i += 1) {
      for (let j = i + 1; j < living.length; j += 1) {
        if (this.harmonicCompatibility(living[i], living[j]) > 0.86 && distance(living[i], living[j]) < 180) {
          return [living[i], living[j]];
        }
      }
    }
    return null;
  }

  considerDivision(cell, dt) {
    const localDensity = this.getNearbyCells(cell, 140).filter((other) => other !== cell && distance(cell, other) < 120).length;
    if (localDensity > 7) return;
    const probability = dt * 0.18 * this.conductor.controls.division * mapRange(cell.energy, cell.gene.divisionThreshold, 1.08, 0.2, 1);
    if (!this.rng.chance(probability)) return;
    this.divideCell(cell);
  }

  divideCell(parent) {
    if (this.cells.length >= this.quality.maxCells || parent.state === "dying") return null;
    parent.energy *= 0.56;
    parent.size *= 0.92;
    const interval = this.rng.choice([3, 4, 7, 12, 19]);
    const angle = this.rng.range(0, TWO_PI);
    const childHue = (parent.hue + this.rng.signed(18) + 360) % 360;
    const child = this.addCell(
      parent.x + Math.cos(angle) * (parent.size + 12),
      parent.y + Math.sin(angle) * (parent.size + 12),
      {
        vx: parent.vx + Math.cos(angle) * 0.42,
        vy: parent.vy + Math.sin(angle) * 0.42,
        size: Math.max(5, parent.size * this.rng.range(0.56, 0.78)),
        energy: parent.energy * 0.82,
        family: this.rng.chance(0.72) ? parent.family : this.rng.choice(CELL_FAMILIES),
        hue: childHue,
        saturation: parent.saturation,
        lightness: parent.lightness + this.rng.signed(5),
        baseDegree: parent.baseDegree + interval,
        octave: parent.octave + (interval >= 12 ? 1 : 0),
        modulation: clamp(parent.modulation + this.rng.signed(0.12), 0.04, 0.9),
        alpha: 0,
      },
    );
    if (child) {
      child.frequency = parent.frequency * 2 ** (interval / 12);
      child.targetFrequency = this.frequencyForCell(child);
      parent.memory.push({ type: "division", at: this.elapsed, with: child.id });
      this.emitEvent("division", [parent, child], { intensity: 0.66, hue: child.hue });
      this.audio.divisionEvent(parent, child);
    }
    return child;
  }

  handleInteractions(dt, activeCells = this.cells) {
    const seen = new Set();
    for (let i = 0; i < activeCells.length; i += 1) {
      const a = activeCells[i];
      const nearby = this.getNearbyCells(a, 120);
      for (let j = 0; j < nearby.length; j += 1) {
        const b = nearby[j];
        if (a === b) continue;
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (a.state === "dying" || b.state === "dying") continue;
        const d = distance(a, b);
        const minD = (a.size + b.size) * 0.72;
        if (d < minD) {
          this.resolveCollision(a, b, d, dt);
        }
        const canFuse = d < (a.size + b.size) * 0.42
          && a.energy > 0.32
          && b.energy > 0.32
          && this.cells.length > 4
          && this.harmonicCompatibility(a, b) > 0.82
          && this.rng.chance(dt * 0.1 * this.conductor.controls.consonance);
        if (canFuse) {
          this.fuseCells(a, b);
          return;
        }
      }
    }
  }

  resolveCollision(a, b, d, dt) {
    const nx = (b.x - a.x) / Math.max(1, d);
    const ny = (b.y - a.y) / Math.max(1, d);
    const overlap = (a.size + b.size) * 0.72 - d;
    a.x -= nx * overlap * 0.36;
    a.y -= ny * overlap * 0.36;
    b.x += nx * overlap * 0.36;
    b.y += ny * overlap * 0.36;
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const force = clamp(Math.abs(rvx * nx + rvy * ny) * 0.4 + overlap / 60, 0, 1);
    const impulse = force * 0.22 * this.conductor.controls.collisions;
    a.vx -= nx * impulse;
    a.vy -= ny * impulse;
    b.vx += nx * impulse;
    b.vy += ny * impulse;
    a.energy = clamp(a.energy + force * 0.035, 0, 1.08);
    b.energy = clamp(b.energy + force * 0.035, 0, 1.08);
    if (this.elapsed > a.collisionCooldown && this.elapsed > b.collisionCooldown && force > 0.045) {
      a.collisionCooldown = this.elapsed + 0.42;
      b.collisionCooldown = this.elapsed + 0.42;
      a.memory.push({ type: "collision", at: this.elapsed, with: b.id, force });
      b.memory.push({ type: "collision", at: this.elapsed, with: a.id, force });
      this.recentCollisions += force * 2;
      this.emitEvent("collision", [a, b], {
        force,
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5,
        hue: this.mixHue(a.hue, b.hue),
      });
      this.audio.collisionEvent(a, b, force);
    }
    a.modulation = clamp(a.modulation + dt * force * 0.3, 0, 1);
    b.modulation = clamp(b.modulation + dt * force * 0.3, 0, 1);
  }

  fuseCells(a, b) {
    if (a.state === "dying" || b.state === "dying") return null;
    const energy = clamp((a.energy + b.energy) * 0.58, 0.18, 1);
    const fused = this.addCell((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, {
      vx: (a.vx + b.vx) * 0.32,
      vy: (a.vy + b.vy) * 0.32,
      size: clamp(Math.sqrt(a.size ** 2 + b.size ** 2) * 0.95, 10, 48),
      mass: a.mass + b.mass,
      energy,
      family: energy > 0.7 ? "spectral" : a.size > b.size ? a.family : b.family,
      hue: this.mixHue(a.hue, b.hue),
      saturation: (a.saturation + b.saturation) * 0.5,
      lightness: Math.max(a.lightness, b.lightness),
      baseDegree: Math.round((a.baseDegree + b.baseDegree) * 0.5),
      octave: Math.round((a.octave + b.octave) * 0.5),
      modulation: clamp((a.modulation + b.modulation) * 0.5 + 0.18, 0, 1),
      alpha: 0,
    });
    if (fused) {
      fused.frequency = Math.sqrt(a.frequency * b.frequency);
      fused.targetFrequency = this.frequencyForCell(fused);
      fused.state = "active";
      this.emitEvent("fusion", [a, b, fused], {
        intensity: energy,
        x: fused.x,
        y: fused.y,
        hue: fused.hue,
      });
      a.state = "dead";
      b.state = "dead";
      this.audio.fusionEvent(a, b, fused);
    }
    return fused;
  }

  mixHue(a, b) {
    const diff = ((((b - a) % 360) + 540) % 360) - 180;
    return (a + diff * 0.5 + 360) % 360;
  }

  harmonicCompatibility(a, b) {
    const ratio = Math.max(a.frequency, b.frequency) / Math.min(a.frequency, b.frequency);
    const semitone = Math.round(12 * Math.log2(ratio)) % 12;
    if ([0, 7, 5, 12].includes(semitone)) return 0.98;
    if ([3, 4, 8, 9].includes(semitone)) return 0.82;
    if ([2, 10].includes(semitone)) return 0.46;
    if (semitone === 6) return 0.24 + this.conductor.chaosLevel * 0.32;
    return 0.34;
  }

  frequencyForCell(cell) {
    const mode = HARMONIC_MODES[this.harmonicIndex];
    const xRegister = Math.floor(mapRange(cell.x, 0, window.innerWidth, -1, 3));
    const yIndex = Math.floor(mapRange(cell.y, window.innerHeight, 0, 0, 7));
    const energyOctave = cell.energy > 0.82 ? 1 : cell.energy < 0.18 ? -1 : 0;
    if (mode.spectrum) {
      const ratio = mode.ratios[Math.abs(cell.baseDegree + yIndex) % mode.ratios.length];
      const octave = cell.octave + xRegister + energyOctave;
      return clamp(this.baseFrequency * ratio * 2 ** octave, 34, 4800);
    }
    const degree = mode.degrees[Math.abs(cell.baseDegree + yIndex) % mode.degrees.length];
    const octave = cell.octave + xRegister + Math.floor((cell.baseDegree + yIndex) / mode.degrees.length) + energyOctave;
    return clamp(this.baseFrequency * 2 ** ((degree + octave * 12) / 12), 34, 5200);
  }

  setMode(mode) {
    if (mode === "ritual") {
      const seed = this.ui.seedInput.value.trim() || this.seed;
      this.reset(seed, { mode: "ritual", initialCount: 4 });
      return;
    }
    this.mode = mode;
    this.conductor.setMode(mode);
    this.updateModeUi();
    if (mode === "chaos") {
      this.cells.forEach((cell) => {
        cell.energy = clamp(cell.energy + this.rng.range(0.08, 0.28), 0, 1.05);
      });
    }
  }

  mutate() {
    this.cells.forEach((cell) => {
      cell.energy = clamp(cell.energy + this.rng.range(0.04, 0.34), 0, 1.08);
      cell.modulation = clamp(cell.modulation + this.rng.range(0.08, 0.32), 0, 1);
      cell.hue = (cell.hue + this.rng.signed(34) + 360) % 360;
    });
    for (let i = 0; i < 5; i += 1) {
      this.addCell(undefined, undefined, {
        family: this.rng.choice(["granular", "unstable", "spectral"]),
        energy: this.rng.range(0.58, 0.92),
        size: this.rng.range(5, 14),
      });
    }
  }

  setHarmony(index) {
    this.harmonicIndex = (index + HARMONIC_MODES.length) % HARMONIC_MODES.length;
    this.cells.forEach((cell) => {
      cell.targetFrequency = this.frequencyForCell(cell);
    });
    this.updateHarmonyUi();
  }

  findCellAt(x, y, radiusBoost = 8) {
    return [...this.cells]
      .filter((cell) => cell.state !== "dead")
      .sort((a, b) => distance({ x, y }, a) - distance({ x, y }, b))
      .find((cell) => distance({ x, y }, cell) < cell.size * 1.4 + radiusBoost);
  }

  soloCell(cell, seconds = 6) {
    this.clearSolo();
    cell.solo = true;
    this.soloId = cell.id;
    this.soloUntil = this.elapsed + seconds;
  }

  clearSolo() {
    this.cells.forEach((cell) => {
      cell.solo = false;
    });
    this.soloId = null;
    this.soloUntil = 0;
  }

  serialize() {
    return {
      title: "Bionum",
      version: 1,
      seed: this.seed,
      mode: this.mode,
      harmonicIndex: this.harmonicIndex,
      baseFrequency: this.baseFrequency,
      autoEvolution: this.autoEvolution,
      elapsed: this.elapsed,
      cells: this.cells.map((cell) => cell.serialize()),
    };
  }

  loadState(data) {
    this.seed = data.seed || this.seed;
    this.rng = new SeededRandom(this.seed);
    this.cells = [];
    this.spatialGrid = new Map();
    this.quality = qualityProfile();
    this.particles = this.createParticles();
    this.nextCellId = 1;
    this.mode = data.mode || "calm";
    this.harmonicIndex = data.harmonicIndex ?? 2;
    this.baseFrequency = data.baseFrequency || 55;
    this.autoEvolution = data.autoEvolution ?? true;
    this.elapsed = data.elapsed || 0;
    this.conductor = new Conductor();
    this.conductor.setMode(this.mode);
    (data.cells || []).forEach((cellData) => {
      const cell = new Cell(this, cellData);
      const numericId = Number(String(cell.id).replace("cell-", ""));
      if (Number.isFinite(numericId)) this.nextCellId = Math.max(this.nextCellId, numericId + 1);
      cell.organism = this;
      cell.targetFrequency = this.frequencyForCell(cell);
      this.cells.push(cell);
    });
    this.audio.removeAllVoices();
    this.updateModeUi();
    this.updateHarmonyUi();
  }

  resize() {
    const nextQuality = qualityProfile();
    const particleDelta = nextQuality.particles - this.particles.length;
    this.quality = nextQuality;
    if (particleDelta > 0) {
      this.particles.push(...this.createParticles().slice(0, particleDelta));
    } else if (particleDelta < 0) {
      this.particles.length = nextQuality.particles;
    }
    this.cells.forEach((cell) => {
      cell.x = clamp(cell.x, 2, window.innerWidth - 2);
      cell.y = clamp(cell.y, 2, window.innerHeight - 2);
    });
    this.buildSpatialIndex();
  }

  updateModeUi() {
    document.querySelectorAll(".mode-card").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === this.mode);
    });
  }

  updateHarmonyUi() {
    const mode = HARMONIC_MODES[this.harmonicIndex];
    this.ui.harmonyName.textContent = mode.name;
    this.ui.harmonyMood.textContent = mode.mood;
  }
}

class InteractionManager {
  constructor(organism, audio, ui) {
    this.organism = organism;
    this.audio = audio;
    this.ui = ui;
    this.canvas = null;
    this.videoRecorder = new VideoRecorder();
    this.pointer = {
      down: false,
      startX: 0,
      startY: 0,
      startedAt: 0,
      id: null,
    };
    this.bindUi();
    this.bindKeys();
  }

  attachCanvas(canvas) {
    this.canvas = canvas;
    canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    canvas.addEventListener("pointercancel", () => this.onPointerCancel());
    canvas.addEventListener("dblclick", (event) => this.onDoubleClick(event));
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
  }

  bindUi() {
    document.querySelectorAll(".mode-card").forEach((button) => {
      button.addEventListener("click", () => this.organism.setMode(button.dataset.mode));
    });
    this.ui.prevHarmony.addEventListener("click", () => this.organism.setHarmony(this.organism.harmonicIndex - 1));
    this.ui.nextHarmony.addEventListener("click", () => this.organism.setHarmony(this.organism.harmonicIndex + 1));
    this.ui.applySeed.addEventListener("click", () => this.organism.reset(this.ui.seedInput.value.trim() || "era"));
    this.ui.randomSeed.addEventListener("click", () => {
      const fragments = ["marais", "plasma", "lichen", "corail", "brume", "ambre", "abyssal"];
      const seed = `${fragments[Math.floor(Math.random() * fragments.length)]}-${Math.random().toString(16).slice(2, 8)}`;
      this.ui.seedInput.value = seed;
      this.organism.reset(seed);
    });
    this.ui.startAudio.addEventListener("click", async () => {
      await this.audio.start();
      this.ui.startAudio.innerHTML = "<span>✓</span> Audio Running";
    });
    this.ui.recordAudio.addEventListener("click", async () => {
      if (!this.audio.enabled) await this.audio.start();
      if (this.audio.recorder.isRecording) {
        this.audio.recorder.stop(true);
        this.ui.recordAudio.classList.remove("is-recording");
      } else if (this.audio.recorder.start(this.audio)) {
        this.ui.recordAudio.classList.add("is-recording");
      }
    });
    this.ui.exportWav.addEventListener("click", () => {
      const blob = this.audio.recorder.exportLast();
      if (!blob) {
        this.flashText(this.ui.recordTime, "record first");
      }
    });
    this.ui.recordVideo.addEventListener("click", async () => {
      if (this.videoRecorder.isRecording) {
        this.videoRecorder.stop();
        this.ui.recordVideo.textContent = "Record Video";
        this.ui.recordVideo.classList.remove("is-recording");
        return;
      }
      if (!this.audio.enabled) await this.audio.start();
      const result = this.videoRecorder.start(this.canvas, this.audio);
      if (!result.ok) {
        this.flashText(this.ui.recordVideo, result.message);
        return;
      }
      this.ui.recordVideo.textContent = "Stop Video";
      this.ui.recordVideo.classList.add("is-recording");
    });
    this.ui.fullscreenMode.addEventListener("click", () => this.toggleInterfaceVisibility());
    this.ui.saveState.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(this.organism.serialize(), null, 2)], { type: "application/json" });
      downloadBlob(blob, `era-state-${Date.now()}.json`);
    });
    this.ui.loadState.addEventListener("click", () => this.ui.stateFile.click());
    this.ui.stateFile.addEventListener("change", (event) => this.loadStateFile(event));
    this.ui.snapshotPng.addEventListener("click", () => {
      if (window.__eraP5) {
        window.__eraP5.saveCanvas("era-snapshot", "png");
      }
    });
    this.ui.masterVolume.addEventListener("input", () => {
      this.audio.setMasterVolume(Number(this.ui.masterVolume.value));
    });
  }

  bindKeys() {
    window.addEventListener("keydown", (event) => {
      if (event.target.matches("input")) return;
      const key = event.key.toLowerCase();
      if (event.code === "Space") {
        event.preventDefault();
        this.organism.paused = !this.organism.paused;
      } else if (key === "c") this.organism.setMode("calm");
      else if (key === "s") this.organism.setMode("stable");
      else if (key === "x") this.organism.setMode("chaos");
      else if (key === "r") this.organism.reset(this.organism.seed);
      else if (key === "m") this.organism.mutate();
      else if (key === "a") this.organism.autoEvolution = !this.organism.autoEvolution;
      else if (key === "f" || key === "h") this.toggleInterfaceVisibility();
    });
  }

  toggleInterfaceVisibility() {
    document.body.classList.toggle("hide-ui");
    this.ui.fullscreenMode.textContent = "Fullscreen";
    this.organism.resize();
  }

  onPointerDown(event) {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointer = {
      down: true,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      id: event.pointerId,
    };
    this.organism.mouse.active = true;
    this.organism.mouse.dragging = true;
    this.organism.mouse.x = event.clientX;
    this.organism.mouse.y = event.clientY;
    if (event.button === 2) {
      const cell = this.organism.findCellAt(event.clientX, event.clientY, 14);
      if (cell) cell.die();
    }
  }

  onPointerMove(event) {
    this.organism.mouse.x = event.clientX;
    this.organism.mouse.y = event.clientY;
    this.organism.mouse.active = true;
    if (this.pointer.down) {
      this.organism.mouse.dragging = true;
      this.organism.energyField = clamp(this.organism.energyField + 0.006, -0.5, 0.8);
    }
  }

  onPointerUp(event) {
    if (!this.pointer.down || event.pointerId !== this.pointer.id) return;
    const held = performance.now() - this.pointer.startedAt;
    const moved = Math.hypot(event.clientX - this.pointer.startX, event.clientY - this.pointer.startY);
    this.pointer.down = false;
    this.organism.mouse.dragging = false;
    if (event.button !== 0 || moved > 18) return;
    const cell = this.organism.findCellAt(event.clientX, event.clientY, 10);
    if (held > 520) {
      this.organism.addCell(event.clientX, event.clientY, {
        family: "drone",
        size: this.organism.rng.range(26, 42),
        energy: 0.7,
        hue: 210,
        octave: -2,
      });
    } else if (cell) {
      this.organism.soloCell(cell);
    } else {
      this.organism.addCell(event.clientX, event.clientY, {
        size: this.organism.rng.range(6, 15),
        energy: this.organism.rng.range(0.28, 0.68),
        alpha: 0,
      });
    }
  }

  onPointerCancel() {
    this.pointer.down = false;
    this.organism.mouse.dragging = false;
  }

  onDoubleClick(event) {
    const cell = this.organism.findCellAt(event.clientX, event.clientY, 22);
    if (cell) {
      this.organism.divideCell(cell);
    }
  }

  onWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    this.organism.energyField = clamp(this.organism.energyField + delta, -0.75, 1);
    this.organism.cells.forEach((cell) => {
      const d = Math.hypot(cell.x - event.clientX, cell.y - event.clientY);
      if (d < 280) cell.energy = clamp(cell.energy + delta * mapRange(d, 0, 280, 1, 0.1), 0, 1.08);
    });
  }

  loadStateFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        this.ui.seedInput.value = data.seed || this.organism.seed;
        this.organism.loadState(data);
      } catch (error) {
        console.error(error);
        this.flashText(this.ui.conductorText, "State JSON invalide.");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  flashText(element, text) {
    const old = element.textContent;
    element.textContent = text;
    window.setTimeout(() => {
      element.textContent = old;
    }, 1200);
  }
}

function collectUi() {
  return {
    phaseLabel: document.getElementById("phaseLabel"),
    harmonyName: document.getElementById("harmonyName"),
    harmonyMood: document.getElementById("harmonyMood"),
    prevHarmony: document.getElementById("prevHarmony"),
    nextHarmony: document.getElementById("nextHarmony"),
    seedInput: document.getElementById("seedInput"),
    applySeed: document.getElementById("applySeed"),
    randomSeed: document.getElementById("randomSeed"),
    startAudio: document.getElementById("startAudio"),
    recordAudio: document.getElementById("recordAudio"),
    recordTime: document.getElementById("recordTime"),
    exportWav: document.getElementById("exportWav"),
    recordVideo: document.getElementById("recordVideo"),
    fullscreenMode: document.getElementById("fullscreenMode"),
    saveState: document.getElementById("saveState"),
    loadState: document.getElementById("loadState"),
    snapshotPng: document.getElementById("snapshotPng"),
    stateFile: document.getElementById("stateFile"),
    masterVolume: document.getElementById("masterVolume"),
    densityValue: document.getElementById("densityValue"),
    energyValue: document.getElementById("energyValue"),
    dissonanceValue: document.getElementById("dissonanceValue"),
    chaosValue: document.getElementById("chaosValue"),
    densityMeter: document.getElementById("densityMeter"),
    energyMeter: document.getElementById("energyMeter"),
    dissonanceMeter: document.getElementById("dissonanceMeter"),
    chaosMeter: document.getElementById("chaosMeter"),
    conductorText: document.getElementById("conductorText"),
    cellCount: document.getElementById("cellCount"),
    activeVoices: document.getElementById("activeVoices"),
    autoState: document.getElementById("autoState"),
    performanceState: document.getElementById("performanceState"),
    lastEvent: document.getElementById("lastEvent"),
  };
}

function updateUi(organism, audio, ui) {
  const metrics = organism.conductor.metrics;
  const pct = (value) => `${Math.round(clamp(value, 0, 1) * 100)}%`;
  ui.phaseLabel.textContent = organism.conductor.phase.label;
  ui.densityValue.textContent = pct(metrics.density);
  ui.energyValue.textContent = pct(metrics.energy);
  ui.dissonanceValue.textContent = pct(metrics.dissonance);
  ui.chaosValue.textContent = pct(organism.conductor.chaosLevel);
  ui.densityMeter.style.width = pct(metrics.density);
  ui.energyMeter.style.width = pct(metrics.energy);
  ui.dissonanceMeter.style.width = pct(metrics.dissonance);
  ui.chaosMeter.style.width = pct(organism.conductor.chaosLevel);
  ui.conductorText.textContent = organism.conductor.lastText;
  ui.cellCount.textContent = `${organism.cells.length} cellules`;
  ui.activeVoices.textContent = `${audio.voiceMap.size} voix`;
  ui.autoState.textContent = organism.autoEvolution ? "Auto-evolution active" : "Auto-evolution suspendue";
  ui.performanceState.textContent = organism.quality.label;
  ui.lastEvent.textContent = organism.lastEventText;
  const elapsed = audio.recorder.elapsed(audio.context);
  if (audio.recorder.isRecording) {
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const seconds = Math.floor(elapsed % 60).toString().padStart(2, "0");
    ui.recordTime.textContent = `${minutes}:${seconds}`;
  } else if (!audio.recorder.lastBlob) {
    ui.recordTime.textContent = "00:00";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const ui = collectUi();
  const audio = new AudioEngine();
  let organism;
  let interactions;
  let lastUiUpdate = 0;

  const sketch = (p) => {
    p.setup = () => {
      const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent("organism-canvas");
      p.pixelDensity(qualityProfile().pixelDensity);
      p.frameRate(30);
      p.colorMode(p.HSL, 360, 100, 100, 1);
      p.noiseSeed(hashSeed(ui.seedInput.value));
      organism = new Organism(p, audio, ui);
      interactions = new InteractionManager(organism, audio, ui);
      interactions.attachCanvas(canvas.elt);
      window.__eraP5 = p;
      window.__eraOrganism = organism;
      window.__eraAudio = audio;
    };

    p.draw = () => {
      p.background(3, 4, 3, 0.46);
      p.noStroke();
      p.fill(68, 18, 6, 0.022);
      p.rect(0, 0, p.width, p.height);
      organism.update();
      organism.draw(p);
      if (performance.now() - lastUiUpdate > 180) {
        updateUi(organism, audio, ui);
        lastUiUpdate = performance.now();
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      p.pixelDensity(qualityProfile().pixelDensity);
      organism.resize();
    };
  };

  new p5(sketch);
});
