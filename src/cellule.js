import { TAU, HISTORY_LEN, BIO } from "./constants.js";

/**
 * @param {import('./rng.js').createRng} rngWrap
 */
export class Cellule {
  constructor(
    id,
    x,
    y,
    size,
    energy,
    hue,
    rngWrap,
    options = {}
  ) {
    this.id = id;
    this.rng = rngWrap;
    const { rand } = rngWrap;

    this.x = x;
    this.y = y;
    this.vx = Math.cos(rand(0, TAU)) * rand(0.18, 1.35);
    this.vy = Math.sin(rand(0, TAU)) * rand(0.18, 1.35);
    this.ax = 0;
    this.ay = 0;

    this.size = size;
    this.baseSize = size;
    this.mass = options.mass ?? size * 0.12 + 0.4;
    this.energy = energy;
    this.hue = hue;

    this.generation = options.generation ?? 0;
    this.origin = options.origin ?? "organisme";
    this.birthAge = 0;
    this.age = rand(0, 1000);
    this.phase = rand(0, TAU);
    this.depth = rand(-1, 1);
    this.hyper = rand(0, TAU);
    this.voice = options.voice ?? Math.floor(rand(0, 7));
    this.noteSeed = options.noteSeed ?? Math.floor(rand(0, 12));
    this.motionJitter = rand(0.04, 0.24);
    this.motionMemory = { vx: this.vx, vy: this.vy };

    this.gene = null;

    this.biologicalState = BIO.ACTIVE;
    this.baseFrequency = 110;
    this.volume = 0;
    this.timbre = "sine";
    this.audioPhase = 0;
    this.instability = 0;

    this.nearCount = 0;
    this.isolated = 1;
    this.collisionCount = options.collisionCount ?? 0;
    this.isolationTime = 0;

    this.mapping = null;

    this._ringPos = 0;
    this.historyPos = new Array(HISTORY_LEN).fill(null).map(() => ({ x, y }));
    this.historyEnergy = new Float32Array(HISTORY_LEN);
    this.historyCollisions = new Uint8Array(HISTORY_LEN);
    this.historyFreq = new Float32Array(HISTORY_LEN);
  }

  pushHistory() {
    const i = this._ringPos;
    this.historyPos[i] = { x: this.x, y: this.y };
    this.historyEnergy[i] = this.energy;
    this.historyCollisions[i] = Math.min(255, this.collisionCount);
    this.historyFreq[i] = this.baseFrequency;
    this._ringPos = (i + 1) % HISTORY_LEN;
  }

  get trailAgeFactor() {
    let sumE = 0;
    for (let k = 0; k < HISTORY_LEN; k += 1) sumE += this.historyEnergy[k];
    return sumE / (HISTORY_LEN * Math.max(0.01, this.energy));
  }

  get meanRecentCollisions() {
    let s = 0;
    for (let k = 0; k < 16; k += 1) s += this.historyCollisions[(this._ringPos - 1 - k + HISTORY_LEN) % HISTORY_LEN];
    return s / 16;
  }
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function hue(value, fallback = 160) {
  const safe = finite(value, fallback) % 360;
  return safe < 0 ? safe + 360 : safe;
}
