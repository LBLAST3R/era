import { Cellule } from "./cellule.js";
import { createGenome } from "./world.js";
import { createRng } from "./rng.js";
import { STORAGE_KEY } from "./constants.js";

export function serialiseWorld(world) {
  return {
    version: 2,
    seed: world.seed,
    mode: world.mode,
    systemPhase: world.systemPhase,
    storyTime: world.storyTime,
    nextGenesisAt: world.nextGenesisAt,
    nextCellId: world.nextCellId,
    stats: { ...world.stats },
    cells: world.cells.map((cell) => ({
      id: cell.id,
      x: cell.x / Math.max(1, world.width),
      y: cell.y / Math.max(1, world.height),
      vx: cell.vx,
      vy: cell.vy,
      ax: cell.ax,
      ay: cell.ay,
      baseSize: cell.baseSize,
      mass: cell.mass,
      energy: cell.energy,
      hue: cell.hue,
      generation: cell.generation,
      origin: cell.origin,
      voice: cell.voice,
      noteSeed: cell.noteSeed,
      motionJitter: cell.motionJitter,
      collisionCount: cell.collisionCount,
      biologicalState: cell.biologicalState
    }))
  };
}

export function saveToLocalStorage(world) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialiseWorld(world)));
}

export function hydrateWorld(world, data) {
  world.seed = String(data.seed ?? Date.now());
  world.rngWrap = createRng(world.seed);
  world.mode = data.mode ?? "stable";
  world.systemPhase = data.systemPhase ?? "normal";
  world.storyTime = data.storyTime ?? 0;
  world.nextGenesisAt = data.nextGenesisAt ?? 900;
  world.nextCellId = data.nextCellId ?? 1;
  world.stats = data.stats ?? { totalBorn: 0, manualBorn: 0, maxGeneration: 0 };
  world.cells = [];
  world.bursts = [];
  world.spores = [];
  world.entities = [];
  const rand = world.rngWrap.rand.bind(world.rngWrap);
  for (const item of data.cells ?? []) {
    const cell = new Cellule(
      item.id,
      item.x * world.width,
      item.y * world.height,
      item.baseSize ?? 12,
      item.energy ?? 0.8,
      item.hue ?? 180,
      world.rngWrap,
      {
        generation: item.generation ?? 0,
        origin: item.origin ?? "saved",
        voice: item.voice ?? 0,
        noteSeed: item.noteSeed ?? 0,
        collisionCount: item.collisionCount ?? 0
      }
    );
    cell.vx = item.vx ?? cell.vx;
    cell.vy = item.vy ?? cell.vy;
    cell.ax = item.ax ?? 0;
    cell.ay = item.ay ?? 0;
    cell.baseSize = item.baseSize ?? cell.baseSize;
    cell.size = cell.baseSize;
    cell.mass = item.mass ?? cell.mass;
    cell.biologicalState = item.biologicalState ?? cell.biologicalState;
    cell.motionJitter = item.motionJitter ?? cell.motionJitter;
    cell.gene = createGenome(cell.baseSize, cell.generation, rand);
    world.cells.push(cell);
  }
  const maxId = world.cells.reduce((m, c) => Math.max(m, c.id), 0);
  world.nextCellId = Math.max(world.nextCellId, maxId + 1);
}

export function loadFromLocalStorage(world) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  hydrateWorld(world, JSON.parse(raw));
  return true;
}

export function downloadJson(world, filename = "organisme.json") {
  const blob = new Blob([JSON.stringify(serialiseWorld(world), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
