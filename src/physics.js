import { createNoise2D } from "simplex-noise";
import { createRng } from "./rng.js";
import { clamp } from "./cellule.js";

/**
 * @param {string} seed
 */
export function createField(seed) {
  const rng = createRng(`${seed}_noise`);
  return createNoise2D(() => rng.rng());
}

export function sampleFlow(field, t, x, y, scale = 0.0012) {
  const n1 = field(x * scale, y * scale + t * 0.00008);
  const n2 = field(x * scale + 13.7, y * scale - t * 0.00006);
  return { ax: Math.cos(n1 * Math.PI * 2) * 0.4, ay: Math.sin(n2 * Math.PI * 2) * 0.4 };
}

export function applyMouseForce(cell, mouse, width, height, dt, strength = 1) {
  if (!mouse.active) return;
  const dx = cell.x - mouse.x;
  const dy = cell.y - mouse.y;
  const distSq = dx * dx + dy * dy;
  const radius = mouse.down ? 250 : 150;
  if (distSq >= radius * radius) return;
  const dist = Math.sqrt(distSq) || 1;
  const force = (1 - dist / radius) * (mouse.down ? 0.065 : 0.025) * dt * strength;
  cell.vx += (dx / dist) * force;
  cell.vy += (dy / dist) * force;
  cell.energy = clamp(cell.energy + 0.025 * dt * strength, 0, 1.5);
}

export function softBounce(cell, width, height, onBounce) {
  if (cell.x < cell.size) {
    cell.vx *= -0.94;
    cell.x = clamp(cell.x, cell.size, width - cell.size);
    onBounce?.(cell, cell.x, cell.y);
  } else if (cell.x > width - cell.size) {
    cell.vx *= -0.94;
    cell.x = clamp(cell.x, cell.size, width - cell.size);
    onBounce?.(cell, cell.x, cell.y);
  }
  if (cell.y < cell.size) {
    cell.vy *= -0.94;
    cell.y = clamp(cell.y, cell.size, height - cell.size);
    onBounce?.(cell, cell.x, cell.y);
  } else if (cell.y > height - cell.size) {
    cell.vy *= -0.94;
    cell.y = clamp(cell.y, cell.size, height - cell.size);
    onBounce?.(cell, cell.x, cell.y);
  }
}
