/**
 * Sonic DNA: accumulate stats over first N seconds → reproducible seed hash + fingerprint.
 */

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashFloatArray(arr, sampleEvery = 8) {
  let s = "";
  for (let i = 0; i < arr.length; i += sampleEvery) {
    s += arr[i].toFixed(2) + ",";
  }
  return fnv1a32(s);
}

/**
 * @param {object} params
 * @param {import('../audio/analyzer.js').Analyzer} params.analyzer
 */
export function createSonicDnaCollector({ windowSec = 12 } = {}) {
  let accFrames = 0;
  let sumBass = 0,
    sumMid = 0,
    sumTreble = 0,
    sumRms = 0,
    sumFlux = 0,
    sumCentroid = 0,
    peakCount = 0;
  let spectrumAgg = null;
  let binCount = 0;
  let closed = false;

  return {
    /**
     * @param {number} t current playback time (sec)
     * @param {import('../audio/analyzer.js').Analyzer} analyzer
     */
    feed(t, analyzer) {
      if (closed) return;
      if (t >= windowSec) {
        closed = true;
        return;
      }
      accFrames++;
      sumBass += analyzer.bass;
      sumMid += analyzer.mid;
      sumTreble += analyzer.treble;
      sumRms += analyzer.rms;
      sumFlux += analyzer.flux;
      sumCentroid += analyzer.centroidHz;
      if (analyzer.peak) peakCount++;

      const spec = analyzer.getSpectrumDb();
      if (spec && spec.length) {
        if (!spectrumAgg || spectrumAgg.length !== spec.length) {
          binCount = spec.length;
          spectrumAgg = new Float32Array(binCount);
        }
        for (let i = 0; i < binCount; i++) spectrumAgg[i] += spec[i];
      }
    },

    isSealed(t) {
      return closed || t >= windowSec;
    },

    /** @returns {object | null} */
    finalize(sampleRate, durationSec) {
      if (accFrames === 0) return null;
      const n = accFrames;
      const elapsed = Math.min(durationSec, windowSec);
      const avg = {
        bass: sumBass / n,
        mid: sumMid / n,
        treble: sumTreble / n,
        rms: sumRms / n,
        flux: sumFlux / n,
        centroidHz: sumCentroid / n,
        peakDensity: peakCount / Math.max(elapsed, 0.05),
      };

      let specFingerprint = 0;
      if (spectrumAgg) {
        for (let i = 0; i < spectrumAgg.length; i++) spectrumAgg[i] /= n;
        specFingerprint = hashFloatArray(spectrumAgg, 16);
      }

      const payload = JSON.stringify({
        sr: Math.round(sampleRate),
        dur: Math.round(durationSec * 1000) / 1000,
        avg,
        specFingerprint,
        windowSec,
      });
      const seed = fnv1a32(payload);
      const hueBase = (seed % 360) / 360;
      const personality = {
        spread: 0.6 + (seed % 1000) / 2500,
        chaos: (seed >>> 8) % 1000 / 1000,
        glow: (seed >>> 16) % 1000 / 1000,
      };

      return {
        seed,
        hueBase,
        personality,
        fingerprint: specFingerprint ^ seed,
        averages: avg,
        spectrumMean: spectrumAgg ? Float32Array.from(spectrumAgg) : null,
        windowSec,
        durationSec,
        sampleRate,
      };
    },
  };
}
