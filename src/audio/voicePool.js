import * as Tone from "tone";
import { VOICE_POOL_SIZE } from "../constants.js";

const OSC_TYPES = ["sine", "triangle", "square", "sawtooth"];

export class VoicePool {
  constructor(dryBus, wetBus, count = VOICE_POOL_SIZE) {
    this.voices = [];
    for (let i = 0; i < count; i += 1) {
      const pan = new Tone.Panner(0);
      pan.connect(dryBus);
      pan.connect(wetBus);
      const filter = new Tone.Filter({ frequency: 1200, type: "lowpass", rolloff: -24 }).connect(pan);
      const synth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.28, sustain: 0.72, release: 1.1 }
      }).connect(filter);
      synth.volume.value = Tone.gainToDb(0.0005);
      this.voices.push({ synth, filter, pan, cellId: null });
    }
  }

  score(cell) {
    const m = cell.mapping;
    if (!m) return 0;
    return m.volume * 120 + cell.energy * 8 + cell.size * 0.08 + cell.nearCount * 0.5;
  }

  update(cells) {
    const ranked = [...cells].sort((a, b) => this.score(b) - this.score(a));
    const k = this.voices.length;
    const now = Tone.now();

    for (let i = 0; i < k; i += 1) {
      const voice = this.voices[i];
      const cell = ranked[i];

      if (!cell || !cell.mapping) {
        if (voice.cellId !== null) {
          voice.synth.triggerRelease(now);
        }
        voice.cellId = null;
        continue;
      }

      const m = cell.mapping;
      const t = OSC_TYPES.includes(m.timbre) ? m.timbre : "sine";
      voice.synth.oscillator.type = t;

      if (voice.cellId !== cell.id) {
        if (voice.cellId !== null) voice.synth.triggerRelease(now);
        voice.synth.triggerAttack(m.frequency, now, 0.04);
        voice.cellId = cell.id;
      } else {
        voice.synth.frequency.rampTo(m.frequency, 0.07);
      }

      const db = Tone.gainToDb(Math.max(1e-5, m.volume * 4));
      voice.synth.volume.rampTo(db, 0.08);
      voice.filter.frequency.rampTo(Math.min(12000, m.filterFrequency), 0.1);
      voice.filter.Q.rampTo(Math.min(18, m.resonance * 0.5), 0.12);
      voice.pan.pan.rampTo(m.pan, 0.1);
    }
  }

  dispose() {
    this.voices.forEach((v) => {
      v.synth.dispose();
      v.filter.dispose();
      v.pan.dispose();
    });
  }
}
