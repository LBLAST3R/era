import * as Tone from "tone";
import { getModeConfig } from "../modes.js";

/**
 * Short gestural cues for division, fusion, collisions — keeps CPU bounded.
 */
export class AudioEvents {
  constructor(dryBus, wetBus, distortionBus) {
    this.dry = dryBus;
    this.wet = wetBus;
    this.distortion = distortionBus;
  }

  playBirth(mapping, mode) {
    const s = getModeConfig(mode);
    const chord =
      mode === "calme" || mode === "extinction"
        ? [1, 1.5, 2]
        : mode === "chaos"
          ? [1, 1.125, 1.333, 1.5, 1.875]
          : [1, 1.25, 1.5, 2];
    const now = Tone.now();
    chord.forEach((ratio, index) => {
      const synth = new Tone.Synth({
        oscillator: { type: index % 2 === 0 ? "triangle" : "sine" },
        envelope: { attack: 0.01, decay: 0.35, sustain: 0.2, release: 0.6 }
      });
      const filter = new Tone.Filter({ frequency: mapping.filterFrequency * ratio, Q: 4, type: "bandpass" });
      const pan = new Tone.Panner(Math.sin(index) * 0.6);
      const gain = new Tone.Gain(0);
      synth.chain(filter, pan, gain, this.dry);
      gain.connect(this.wet);
      synth.triggerAttackRelease(mapping.frequency * ratio, 0.45 + index * 0.08, now + index * 0.02, 0.04);
      gain.gain.rampTo(0.08 + mapping.volume * 2, 0.02);
      setTimeout(() => {
        synth.dispose();
        filter.dispose();
        pan.dispose();
        gain.dispose();
      }, 1200);
    });
  }

  playFusion(mapping) {
    const noise = new Tone.Noise("pink").start();
    const filter = new Tone.Filter({ frequency: mapping.filterFrequency, Q: 6, type: "bandpass" });
    const gain = new Tone.Gain(0);
    noise.chain(filter, gain, this.distortion);
    gain.connect(this.wet);
    const now = Tone.now();
    gain.gain.rampTo(0.06, 0.02);
    filter.frequency.rampTo(mapping.filterFrequency * 2.2, 0.15);
    gain.gain.rampTo(0.0001, 0.35);
    noise.stop(now + 0.4);
    setTimeout(() => {
      noise.dispose();
      filter.dispose();
      gain.dispose();
    }, 800);
  }

  playCollision(mapping, amount = 0.4) {
    const noise = new Tone.Noise("brown").start();
    const f = new Tone.Filter(800, "lowpass");
    const g = new Tone.Gain(amount * 0.08);
    noise.chain(f, g, this.distortion);
    const now = Tone.now();
    g.gain.rampTo(amount * 0.08, 0.01);
    g.gain.rampTo(0.0001, 0.06);
    noise.stop(now + 0.08);
    setTimeout(() => {
      noise.dispose();
      f.dispose();
      g.dispose();
    }, 400);
  }
}
