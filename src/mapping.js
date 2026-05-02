import { TAU } from "./constants.js";
import { clamp, lerp } from "./cellule.js";
import { getModeConfig } from "./modes.js";

const NOTE_NAMES = ["C", "D", "E", "G", "A", "B", "D+", "E+"];
const VOICE_NAMES = ["vowel", "glass", "metal", "grain", "organ", "string", "fold"];

/**
 * Nudge b's frequency toward consonant interval with a (gentle).
 */
export function nudgeConsonant(fa, fb, amount = 0.12) {
  if (fa < 1e-6) return fb;
  const r = fb / fa;
  let target = r;
  const candidates = [1, 4 / 3, 1.5, 1.25, 2, 0.5, 2 / 3];
  let best = 999;
  for (const c of candidates) {
    const d = Math.abs(Math.log2(r) - Math.log2(c));
    if (d < best) {
      best = d;
      target = c;
    }
  }
  if (best > 0.18) return fb;
  const goal = fa * target;
  return lerp(fb, goal, amount);
}

function modeHueOffset(mode) {
  if (mode === "calme" || mode === "extinction") return 110;
  if (mode === "stable" || mode === "renaissance") return 185;
  if (mode === "chaos") return 320;
  return 185;
}

/**
 * @param {import('./cellule.js').Cellule} cell
 * @param {string} mode
 * @param {object} ctx { width, height, storyTime, cells, temporal, globalEnergy }
 */
export function mapCellToSoundAndLight(cell, speed, mode, ctx) {
  const settings = getModeConfig(mode);
  const { width, height, storyTime, cells, temporal } = ctx;
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
  const noteIndex =
    (cell.noteSeed + cell.generation + cell.nearCount + Math.floor(xNorm * scale.length)) % scale.length;
  const baseNote = scale[noteIndex];
  const octave =
    mode === "calme" || mode === "extinction"
      ? 1 + (cell.generation % 2) * 0.5
      : mode === "stable" || mode === "renaissance"
        ? 1 + (cell.generation % 3) * 0.5
        : 0.5 + (cell.id % 5) * 0.5;
  const chord = [1, 1.125, 1.25, 1.333, 1.5, 1.666, 2][(cell.voice + cell.nearCount) % 7];
  const motionChaos = Math.sin(storyTime * 0.0017 + cell.id * 12.9898 + cell.voice) * cell.motionJitter;
  const horizontalColor = horizontalMotion * (0.018 + cell.motionJitter * 0.018);
  const chaosMod = mode === "chaos" ? 0.028 : 0.012;
  const dopplerBend = 2 ** (verticalMotion * (mode === "chaos" ? 0.42 : 0.24) + depthMotion * 0.09 + motionChaos * 0.06);
  const bend = (lerp(0.985, 1.015, xNorm) + Math.sin(cell.hyper) * chaosMod + horizontalColor) * dopplerBend;
  let frequency = baseNote * octave * chord * bend;
  if (cell.age > 5000) frequency *= lerp(1, 0.92, Math.min(1, (cell.age - 5000) / 20000));
  cell.baseFrequency = frequency;
  const ageNoise = cell.meanRecentCollisions * 0.02;
  const volume = clamp(
    (cell.size / 66) * (0.018 + energyNorm * 0.072) * (1 - density * 0.48) * (0.74 + temporal.soundDensity * 0.52) *
      (1 - isolation * 0.15) * (1 + ageNoise),
    0,
    0.12
  );
  const brightness = clamp(
    0.14 + (1 - yNorm) * 0.38 + speedNorm * 0.24 + proximity * 0.16 + temporal.pointDensity * 0.22,
    0,
    1
  );
  const modulation = clamp(
    speedNorm * 0.54 + proximity * 0.24 + temporal.local * 0.22 + temporal.clusterDensity * 0.18 + (mode === "chaos" ? 0.18 : 0) + cell.instability * 0.2,
    0,
    1.35
  );
  const dimension = clamp(
    Math.sin(cell.hyper + cell.depth + temporal.long * TAU) * 0.5 +
      0.5 +
      energyNorm * 0.22 +
      proximity * 0.16 +
      temporal.macroPressure * 0.28,
    0,
    1.65
  );
  const waveBank =
    mode === "calme" || mode === "extinction"
      ? ["sine", "triangle"]
      : mode === "stable" || mode === "renaissance"
        ? ["sine", "triangle", "square"]
        : ["sawtooth", "triangle", "square", "sine"];

  return {
    noteName: NOTE_NAMES[noteIndex % NOTE_NAMES.length],
    voiceName: VOICE_NAMES[cell.voice % VOICE_NAMES.length],
    frequency,
    volume,
    brightness,
    modulation: clamp(modulation + Math.abs(horizontalMotion) * 0.22 + Math.abs(depthMotion) * 0.12, 0, 1.35),
    dimension,
    hue: (frequency * 0.33 + cell.generation * 22 + cell.voice * 37 + modeHueOffset(mode)) % 360,
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
    filterFrequency:
      lerp(260, mode === "chaos" ? 9200 : 6200, brightness) + cell.generation * 18 + Math.abs(horizontalMotion) * 1800,
    resonance: lerp(0.8, 8.4, isolation) + proximity * 1.8 + Math.abs(depthMotion) * 2.2,
    overtoneRatio: [1.5, 1.666, 1.875, 2, 2.25][(cell.voice + cell.generation) % 5],
    overtoneLevel: lerp(0.1, mode === "chaos" ? 0.66 : 0.44, modulation),
    modulationRate: lerp(0.05, mode === "chaos" ? 24 : 9, modulation),
    modulationDepth: lerp(0.3, mode === "chaos" ? 58 : 24, modulation)
  };
}

export function applyEmergentHarmony(cells, mode, distLimit = 100) {
  const amt = mode === "chaos" ? 0.05 : 0.12;
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const a = cells[i];
      const b = cells[j];
      if (!a.mapping || !b.mapping) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d >= distLimit) continue;
      const fa = a.mapping.frequency;
      const fb = b.mapping.frequency;
      a.mapping.frequency = nudgeConsonant(fb, fa, amt);
      b.mapping.frequency = nudgeConsonant(fa, fb, amt);
    }
  }
}
