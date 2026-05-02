import * as Tone from "tone";
import { getModeConfig } from "../modes.js";

export async function startTone() {
  await Tone.start();
}

export function createMasterBus() {
  const master = new Tone.Gain(0.35).toDestination();
  const dry = new Tone.Gain(0.74).connect(master);
  const wet = new Tone.Gain(0.42);

  const delay = new Tone.FeedbackDelay({
    delayTime: 0.28,
    feedback: 0.34,
    wet: 1
  }).connect(master);

  const reverb = new Tone.Reverb({ decay: 2.5, wet: 1 }).connect(master);
  reverb.generate().catch(() => {});

  wet.connect(delay);
  wet.connect(reverb);

  const distortion = new Tone.Distortion({ distortion: 0.12, oversample: "2x" }).connect(master);

  const ctx = Tone.getContext().rawContext;
  const recorderDest = ctx.createMediaStreamDestination();
  master.connect(recorderDest);

  return {
    master,
    dry,
    wet,
    delay,
    reverb,
    distortion,
    recorderStream: recorderDest.stream,
    dispose() {
      master.dispose();
      dry.dispose();
      wet.dispose();
      delay.dispose();
      reverb.dispose();
      distortion.dispose();
    }
  };
}

export function updateMasterBus(bus, mode, temporal) {
  if (!bus) return;
  const s = getModeConfig(mode);
  bus.master.gain.rampTo(s.master * (0.82 + temporal.macroPressure * 0.28), 0.18);
  bus.delay.delayTime.rampTo(s.delay * (0.74 + temporal.clusterDensity * 0.54), 0.22);
  bus.delay.feedback.rampTo(Math.min(0.62, s.feedback + temporal.soundDensity * 0.06), 0.18);
  bus.reverb.wet.rampTo(s.reverb * (0.72 + temporal.macroPressure * 0.5), 0.24);
}

export function setMuted(muted) {
  Tone.Destination.mute = muted;
}
