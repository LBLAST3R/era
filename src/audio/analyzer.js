/**
 * One frame of spectral + time-domain analysis. Single FFT buffer read per frame (+ time domain for RMS).
 */

function hzToBin(hz, sampleRate, fftSize) {
  return Math.round((hz * fftSize) / sampleRate);
}

export class Analyzer {
  constructor(audioEngine) {
    this.engine = audioEngine;
    this.analyser = null;
    this.freqBuffer = null;
    this.timeBuffer = null;
    this.sampleRate = 48000;
    this.fftSize = 2048;
    this.binCount = 1024;

    /** Hz band edges */
    this.bassMax = 250;
    this.midMax = 4000;

    this.rms = 0;
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.centroidHz = 0;
    this.flux = 0;
    this.energy = 0;
    this.prevEnergy = 0;
    this.isSilent = true;
    this.peak = false;
    this.kick = false;
    this.beatIntervalSec = 0.5;
    this._lastPeakTime = 0;
    this._peakTimes = [];
    this._prevSpectrum = null;
  }

  attach() {
    this.analyser = this.engine.getAnalyser();
    if (!this.analyser) return;
    this.fftSize = this.analyser.fftSize;
    this.binCount = this.fftSize / 2;
    this.freqBuffer = new Float32Array(this.binCount);
    this.timeBuffer = new Float32Array(this.fftSize);
    this.sampleRate = this.engine.sampleRate;
    this._prevSpectrum = new Float32Array(this.binCount);
  }

  /**
   * Call once per animation frame.
   * @param {number} dt seconds since last frame (approx)
   */
  update(dt) {
    if (!this.analyser || !this.freqBuffer) {
      this.attach();
      if (!this.analyser) return;
    }

    this.analyser.getFloatFrequencyData(this.freqBuffer);
    this.analyser.getFloatTimeDomainData(this.timeBuffer);

    const sr = this.sampleRate;
    const n = this.binCount;
    const nyquist = sr / 2;
    const binWidth = nyquist / n;

    let flux = 0;
    for (let i = 0; i < n; i++) {
      const d = this.freqBuffer[i] - this._prevSpectrum[i];
      if (d > 0) flux += d * d;
    }
    this.flux = Math.sqrt(flux / n);
    this._prevSpectrum.set(this.freqBuffer);

    let bassSum = 0,
      midSum = 0,
      trebleSum = 0;
    let bassW = 0,
      midW = 0,
      trebleW = 0;
    let weightedSum = 0,
      magSum = 0;

    const iBassEnd = hzToBin(this.bassMax, sr, this.fftSize);
    const iMidEnd = hzToBin(this.midMax, sr, this.fftSize);

    for (let i = 0; i < n; i++) {
      const db = this.freqBuffer[i];
      const lin = Math.pow(10, db / 20);
      const hz = (i + 0.5) * binWidth;

      if (i < iBassEnd) {
        bassSum += lin;
        bassW++;
      } else if (i < iMidEnd) {
        midSum += lin;
        midW++;
      } else {
        trebleSum += lin;
        trebleW++;
      }
      weightedSum += hz * lin;
      magSum += lin;
    }

    this.bass = bassW > 0 ? bassSum / bassW : 0;
    this.mid = midW > 0 ? midSum / midW : 0;
    this.treble = trebleW > 0 ? trebleSum / trebleW : 0;

    this.centroidHz = magSum > 1e-8 ? weightedSum / magSum : 1000;

    let sumSq = 0;
    for (let i = 0; i < this.timeBuffer.length; i++) {
      const x = this.timeBuffer[i];
      sumSq += x * x;
    }
    this.rms = Math.sqrt(sumSq / this.timeBuffer.length);

    this.prevEnergy = this.energy;
    this.energy = this.bass * 0.45 + this.mid * 0.35 + this.treble * 0.2 + this.rms * 2;

    const silentThresh = 0.012;
    this.isSilent = this.rms < silentThresh && this.energy < 0.08;

    const dEnergy = (this.energy - this.prevEnergy) / Math.max(dt, 1 / 240);
    const peakThresh = 0.35;
    this.peak = dEnergy > peakThresh && this.energy > 0.15;
    this.kick = this.peak && this.bass > this.mid * 0.85 && this.bass > 0.08;

    const now = performance.now() / 1000;
    if (this.peak) {
      this._peakTimes.push(now);
      if (this._peakTimes.length > 16) this._peakTimes.shift();
      if (this._peakTimes.length >= 2) {
        const gaps = [];
        for (let i = 1; i < this._peakTimes.length; i++) {
          gaps.push(this._peakTimes[i] - this._peakTimes[i - 1]);
        }
        gaps.sort((a, b) => a - b);
        this.beatIntervalSec = gaps[Math.floor(gaps.length / 2)] || 0.5;
        this.beatIntervalSec = Math.min(2, Math.max(0.25, this.beatIntervalSec));
      }
      this._lastPeakTime = now;
    }
  }

  /** Raw frequency magnitudes (linear, from last getFloatFrequencyData as dB — re-copy for DNA) */
  getSpectrumDb() {
    return this.freqBuffer;
  }
}
