import { AudioEngine } from "./audio/audioEngine.js";
import { Analyzer } from "./audio/analyzer.js";
import { createSonicDnaCollector } from "./audio/sonicDna.js";
import { World } from "./sim/world.js";
import { CanvasScene } from "./render/canvasScene.js";
import { WebGLLayer } from "./render/webglLayer.js";

const audio = new AudioEngine();
const analyzer = new Analyzer(audio);

const screenWelcome = document.getElementById("screen-welcome");
const screenExp = document.getElementById("screen-experience");
const screenEnd = document.getElementById("screen-end");
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("view"));
const canvasGl = /** @type {HTMLCanvasElement} */ (document.getElementById("view-gl"));

let world = new World({ width: innerWidth, height: innerHeight });
const scene = new CanvasScene(canvas);
const glLayer = new WebGLLayer(canvasGl);

let dnaCollector = createSonicDnaCollector({ windowSec: 12 });
/** @type {ReturnType<ReturnType<typeof createSonicDnaCollector>["finalize"]> | null} */
let sonicDnaResult = null;

let pendingPlay = false;
let lastFrame = performance.now();
let fileLabel = "—";

const hudFilename = document.getElementById("hud-filename");
const hudTime = document.getElementById("hud-time");
const hudDuration = document.getElementById("hud-duration");
const barBass = document.getElementById("bar-bass");
const barMid = document.getElementById("bar-mid");
const barTreble = document.getElementById("bar-treble");
const hudCells = document.getElementById("hud-cells");
const hudState = document.getElementById("hud-state");
const hudFps = document.getElementById("hud-fps");
const endDna = document.getElementById("end-dna");

function formatTime(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function pct(x) {
  return `${Math.min(100, Math.max(0, x * 100)).toFixed(0)}%`;
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  canvas.width = w;
  canvas.height = h;
  canvasGl.width = w;
  canvasGl.height = h;
  world.resize(w, h);
}

window.addEventListener("resize", resize);

function finalizeDnaIfNeeded() {
  if (sonicDnaResult || !audio.buffer) return;
  sonicDnaResult = dnaCollector.finalize(audio.sampleRate, audio.duration);
  if (sonicDnaResult) world.applyDna(sonicDnaResult);
}

function showEndOverlay() {
  finalizeDnaIfNeeded();
  screenEnd.classList.remove("hidden");
  if (sonicDnaResult && endDna) {
    endDna.textContent = `seed=${sonicDnaResult.seed} · hue=${(sonicDnaResult.hueBase * 360).toFixed(0)}° · fingerprint=${sonicDnaResult.fingerprint} · peak density≈${sonicDnaResult.averages.peakDensity.toFixed(2)}/s`;
  }
}

audio.onEnded = () => {
  finalizeDnaIfNeeded();
  world.beginExtinction();
  showEndOverlay();
};

document.getElementById("file-audio")?.addEventListener("change", async (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const file = input.files?.[0];
  if (!file) return;

  audio.pause();
  const buf = await file.arrayBuffer();
  audio.ensureContext();
  await audio.decode(buf);
  analyzer.attach();

  fileLabel = file.name;
  if (hudFilename) hudFilename.textContent = fileLabel;
  if (hudDuration) hudDuration.textContent = formatTime(audio.duration);

  dnaCollector = createSonicDnaCollector({ windowSec: 12 });
  sonicDnaResult = null;
  world = new World({ width: innerWidth, height: innerHeight });
  world.resize(innerWidth, innerHeight);

  screenWelcome?.classList.add("hidden");
  screenExp?.classList.remove("hidden");
  screenEnd?.classList.add("hidden");
  screenExp?.setAttribute("aria-hidden", "false");

  pendingPlay = true;
  resize();
});

async function resumeAndMaybePlay() {
  const ctx = audio.ensureContext();
  try {
    await ctx.resume();
  } catch (_) {}
  if (pendingPlay && audio.buffer) {
    audio.play(0);
    pendingPlay = false;
  }
}

window.addEventListener(
  "pointerdown",
  () => {
    resumeAndMaybePlay();
  },
  true,
);

function canvasCoords(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width;
  const sy = canvas.height / r.height;
  return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy };
}

canvas.addEventListener("pointermove", (e) => {
  const { x, y } = canvasCoords(e.clientX, e.clientY);
  world.setMouse(x, y, e.buttons > 0);
});

canvas.addEventListener("pointerdown", (e) => {
  resumeAndMaybePlay();
  const { x, y } = canvasCoords(e.clientX, e.clientY);
  world.setMouse(x, y, true);
});

canvas.addEventListener("pointerup", (e) => {
  const { x, y } = canvasCoords(e.clientX, e.clientY);
  world.setMouse(x, y, false);
});

window.addEventListener("keydown", (e) => {
  if (screenExp?.classList.contains("hidden")) return;
  const k = e.key.toLowerCase();
  if (k === "c") world.calm();
  if (k === "x") world.chaos();
  if (k === "m") world.mutation();
  if (k === "r") world.resetPositions();
  if (k === "s") {
    e.preventDefault();
    exportCompositePng();
  }
});

function exportCompositePng() {
  const w = canvas.width;
  const h = canvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return;
  octx.drawImage(canvas, 0, 0);
  if (glLayer.enabled) {
    octx.globalCompositeOperation = "lighter";
    octx.drawImage(canvasGl, 0, 0);
    octx.globalCompositeOperation = "source-over";
  }
  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sonic-genesis.png";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function exportDnaJson() {
  finalizeDnaIfNeeded();
  const payload = {
    version: 1,
    fileName: fileLabel,
    durationSec: audio.duration,
    dna: sonicDnaResult,
    organismState: world.state,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sonic-genesis-dna.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("btn-export-png")?.addEventListener("click", exportCompositePng);
document.getElementById("btn-export-json")?.addEventListener("click", exportDnaJson);
document.getElementById("btn-new")?.addEventListener("click", () => {
  screenEnd?.classList.add("hidden");
  screenExp?.classList.add("hidden");
  screenWelcome?.classList.remove("hidden");
  screenExp?.setAttribute("aria-hidden", "true");
  const fi = /** @type {HTMLInputElement | null} */ (document.getElementById("file-audio"));
  if (fi) fi.value = "";
  audio.pause();
  pendingPlay = false;
});

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.12);
  lastFrame = now;

  const ctx = audio.context;
  const running = ctx?.state === "running";
  if (running && audio.playing && audio.buffer) {
    analyzer.update(dt);
    const t = audio.currentTime;
    dnaCollector.feed(t, analyzer);
    if (dnaCollector.isSealed(t)) finalizeDnaIfNeeded();
    world.update(analyzer, dt);
  } else if (world.freeze) {
    world.update(analyzer, dt);
  }

  scene.updateFps(dt);
  scene.draw(world, analyzer);
  if (glLayer.enabled) {
    glLayer.render(canvas.width, canvas.height, world, Math.min(1, analyzer.energy * 1.2));
  }

  if (hudTime) hudTime.textContent = formatTime(audio.currentTime);
  if (barBass) barBass.style.setProperty("--p", pct(analyzer.bass * 4));
  if (barMid) barMid.style.setProperty("--p", pct(analyzer.mid * 4));
  if (barTreble) barTreble.style.setProperty("--p", pct(analyzer.treble * 4));
  if (hudCells) hudCells.textContent = String(world.cells.length);
  if (hudState) hudState.textContent = world.state;
  if (hudFps) hudFps.textContent = String(Math.round(scene.fpsEma));

  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);
