import * as Tone from "tone";
import { World } from "./world.js";
import { mountSketch } from "./sketch.js";
import { createMasterBus, startTone, updateMasterBus, setMuted } from "./audio/masterBus.js";
import { VoicePool } from "./audio/voicePool.js";
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  downloadJson
} from "./stateExport.js";
import { MAX_CELLS } from "./constants.js";
import { getModeConfig } from "./modes.js";

const root = document.getElementById("p5-root");
const audioToggle = document.getElementById("audioToggle");
const fullscreenButton = document.getElementById("fullscreenButton");
const seedButton = document.getElementById("seedButton");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const recordButton = document.getElementById("recordButton");
const seedInput = document.getElementById("seedInput");
const cellCount = document.getElementById("cellCount");
const birthCount = document.getElementById("birthCount");
const manualCount = document.getElementById("manualCount");
const generationCount = document.getElementById("generationCount");
const mappingState = document.getElementById("mappingState");
const modeName = document.getElementById("modeName");
const storyState = document.getElementById("storyState");
const audioState = document.getElementById("audioState");
const modeButtons = [...document.querySelectorAll(".mode")];

const world = new World();
world.resize(window.innerWidth, window.innerHeight);
world.init(seedInput?.value || String(Math.floor(Math.random() * 99999999)), "calme");
if (seedInput) seedInput.value = world.seed;

let bus = null;
let voices = null;
let muted = false;
let immersive = false;
let recorder = null;
let recordedChunks = [];

async function ensureAudio() {
  await startTone();
  if (!bus) {
    bus = createMasterBus();
    voices = new VoicePool(bus.dry, bus.wet);
  }
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
  audioState.textContent = "son actif";
  audioToggle.textContent = "Couper le son";
}

function audioSync(w) {
  if (!bus || !voices || muted) return;
  updateMasterBus(bus, w.mode, w.temporal);
  voices.update(w.cells);
}

mountSketch(world, audioSync, root);

function updateReadout() {
  cellCount.textContent = String(world.cells.length);
  birthCount.textContent = String(world.stats.totalBorn);
  manualCount.textContent = String(world.stats.manualBorn);
  generationCount.textContent = String(world.stats.maxGeneration);
  const lead = world.cells.length
    ? world.cells.reduce(
        (best, cell) => (cell.energy + cell.size * 0.01 > best.energy + best.size * 0.01 ? cell : best),
        world.cells[0]
      )
    : null;
  mappingState.textContent = lead && lead.mapping
    ? `${lead.mapping.noteName} / ${lead.mapping.voiceName} / q${world.temporal.quality.toFixed(1)}`
    : "silence";
  if (world.cells.length === 1) storyState.textContent = "germe";
  else if (world.cells.length < 12) storyState.textContent = "naissance";
  else if (world.cells.length < getModeConfig(world.mode).target * 0.7) storyState.textContent = "croissance";
  else if (world.mode === "chaos") storyState.textContent = "mutation";
  else if (world.mode === "calme") storyState.textContent = "respiration";
  else storyState.textContent = "equilibre";
  modeName.textContent = world.mode;
}

setInterval(updateReadout, 120);

function setModeButtons() {
  document.body.dataset.mode = world.mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === world.mode);
  });
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    world.setMode(button.dataset.mode);
    setModeButtons();
  });
});

audioToggle.addEventListener("click", async () => {
  if (!bus) {
    await ensureAudio();
    muted = false;
    setMuted(false);
    return;
  }
  muted = !muted;
  setMuted(muted);
  audioState.textContent = muted ? "muet" : "son actif";
  audioToggle.textContent = muted ? "Reprendre le son" : "Couper le son";
});

seedButton.addEventListener("click", () => {
  world.init(String(Math.floor(Math.random() * 999999999)), world.mode);
  if (seedInput) seedInput.value = world.seed;
  setModeButtons();
});

seedInput.addEventListener("change", () => {
  world.init(seedInput.value.trim() || "organisme", world.mode);
  setModeButtons();
});

saveButton.addEventListener("click", () => {
  saveToLocalStorage(world);
  saveButton.textContent = "Sauvegarde OK";
  setTimeout(() => {
    saveButton.textContent = "Sauvegarder";
  }, 900);
});

loadButton.addEventListener("click", () => {
  if (!loadFromLocalStorage(world)) {
    loadButton.textContent = "Rien a charger";
    setTimeout(() => {
      loadButton.textContent = "Charger";
    }, 900);
    return;
  }
  if (seedInput) seedInput.value = world.seed;
  setModeButtons();
});

recordButton.addEventListener("click", async () => {
  await ensureAudio();
  if (recorder) {
    recorder.stop();
    recorder = null;
    recordButton.textContent = "Enregistrer";
    return;
  }
  if (!bus?.recorderStream) return;
  recordedChunks = [];
  recorder = new MediaRecorder(bus.recorderStream);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `organisme-${world.seed}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };
  recorder.start();
  recordButton.textContent = "Stop";
});

async function enterImmersive() {
  immersive = true;
  document.body.classList.add("immersive");
  fullscreenButton.textContent = "Quitter plein ecran";
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* ignore */
    }
  }
}

async function exitImmersive() {
  immersive = false;
  document.body.classList.remove("immersive");
  fullscreenButton.textContent = "Plein ecran";
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }
}

fullscreenButton.addEventListener("click", async () => {
  if (immersive) await exitImmersive();
  else await enterImmersive();
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && immersive) {
    immersive = false;
    document.body.classList.remove("immersive");
    fullscreenButton.textContent = "Plein ecran";
  }
});

document.addEventListener(
  "keydown",
  async (e) => {
    if (e.target instanceof Element && e.target.closest("input, button, textarea, select")) return;
    const k = e.key.toLowerCase();
    if (k === "h") {
      if (immersive) await exitImmersive();
      else await enterImmersive();
      return;
    }
    if (k === "c") {
      world.setMode("calme");
      setModeButtons();
    } else if (k === "s") {
      world.setMode("stable");
      setModeButtons();
    } else if (k === "x") {
      world.setMode("chaos");
      setModeButtons();
    } else if (k === "r") {
      world.init(seedInput?.value?.trim() || String(Math.floor(Math.random() * 999999999)), world.mode);
      if (seedInput) seedInput.value = world.seed;
      setModeButtons();
    } else if (k === "m") {
      muted = !muted;
      setMuted(muted);
      audioState.textContent = muted ? "muet (M)" : "son actif";
      audioToggle.textContent = muted ? "Reprendre le son" : "Couper le son";
    } else if (k === "p") {
      const c = document.querySelector("#p5-root canvas");
      if (c && "toBlob" in c) {
        c.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `organisme-${world.seed}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      }
    } else if (k === "e") {
      downloadJson(world);
    }
  },
  { passive: true }
);

let pointerDownTime = 0;
let pointerDownPos = { x: 0, y: 0 };

root.addEventListener(
  "pointerdown",
  async (e) => {
    e.preventDefault();
    pointerDownTime = performance.now();
    pointerDownPos = { x: e.clientX, y: e.clientY };
    const rect = root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    await ensureAudio();
    if (e.button === 0) {
      world.addManualCluster(x, y, false);
    } else if (e.button === 2) {
      world.addManualCluster(x, y, true);
    }
  },
  { passive: false }
);

root.addEventListener(
  "pointerup",
  async (e) => {
    const held = performance.now() - pointerDownTime;
    const rect = root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (held > 420 && e.button === 0) {
      await ensureAudio();
      world.addManualCluster(x, y, true);
    }
  },
  { passive: true }
);

root.addEventListener("contextmenu", (e) => e.preventDefault());

root.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const cap = getModeConfig(world.mode).capacity;
    if (e.deltaY < 0 && world.cells.length < Math.min(MAX_CELLS, cap)) {
      world.spawnCell(
        world.rngWrap.rand(40, world.width - 40),
        world.rngWrap.rand(40, world.height - 40),
        world.rngWrap.rand(6, 14),
        world.rngWrap.rand(0.5, 0.95),
        world.rngWrap.rand(0, 360),
        { generation: 0, origin: "wheel", voice: Math.floor(world.rngWrap.rand(0, 7)) }
      );
    }
  },
  { passive: false }
);

setModeButtons();
