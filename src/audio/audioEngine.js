/**
 * Web Audio: decode, play, single AnalyserNode (one FFT read per frame in analyzer).
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.source = null;
    this.gain = null;
    this.analyser = null;
    this._startTime = 0;
    this._pauseAt = 0;
    this._playing = false;
    this._onEnded = null;
  }

  get context() {
    return this.ctx;
  }

  get sampleRate() {
    return this.buffer?.sampleRate ?? 48000;
  }

  get duration() {
    return this.buffer?.duration ?? 0;
  }

  get currentTime() {
    if (!this.ctx) return 0;
    if (!this._playing) return this._pauseAt;
    return this.ctx.currentTime - this._startTime;
  }

  get playing() {
    return this._playing;
  }

  /**
   * @param {() => void} fn
   */
  set onEnded(fn) {
    this._onEnded = fn;
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.65;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.gain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return this.ctx;
  }

  /**
   * @param {ArrayBuffer} arrayBuffer
   */
  async decode(arrayBuffer) {
    const ac = this.ensureContext();
    this.buffer = await ac.decodeAudioData(arrayBuffer.slice(0));
    return this.buffer;
  }

  stopSource() {
    if (this.source) {
      try {
        this.source.stop();
      } catch (_) {}
      this.source.disconnect();
      this.source = null;
    }
  }

  play(fromSec = 0) {
    const ac = this.ensureContext();
    if (!this.buffer) return;
    this.stopSource();
    const src = ac.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain);
    const offset = Math.max(0, Math.min(fromSec, this.duration - 0.01));
    this._startTime = ac.currentTime - offset;
    this._pauseAt = offset;
    this._playing = true;
    src.onended = () => {
      if (this.source === src) {
        this._playing = false;
        this._pauseAt = this.duration;
        this.source = null;
        if (this._onEnded) this._onEnded();
      }
    };
    src.start(0, offset);
    this.source = src;
  }

  pause() {
    if (!this.ctx || !this.buffer) return;
    const t = this.currentTime;
    this.stopSource();
    this._playing = false;
    this._pauseAt = t;
  }

  seek(sec) {
    const wasPlaying = this._playing;
    if (wasPlaying) this.pause();
    this._pauseAt = Math.max(0, Math.min(sec, this.duration));
    if (wasPlaying) this.play(this._pauseAt);
  }

  /**
   * @returns {AnalyserNode | null}
   */
  getAnalyser() {
    return this.analyser;
  }
}
