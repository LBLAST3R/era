import p5 from "p5";
import { hue, finite, clamp } from "./cellule.js";
import { sampleNurbsMembrane } from "./nurbs.js";

function drawField(p, world) {
  const mode = world.mode;
  const temporal = world.temporal;
  const w = p.width;
  const h = p.height;
  p.noStroke();
  p.fill(5, 10, 8, 50);
  p.rect(0, 0, w, h);

  p.blendMode(p.ADD);
  const streams = Math.floor(
    (mode === "chaos" ? 30 : mode === "stable" ? 20 : 12) * (0.55 + temporal.pointDensity * 0.65) * temporal.quality
  );
  for (let i = 0; i < streams; i += 1) {
    const speed = mode === "chaos" ? 0.04 : mode === "stable" ? 0.018 : 0.007;
    const x = ((i * 193 + performance.now() * speed) % (w + 240)) - 120;
    const y = (Math.sin(i * 99 + performance.now() * 0.0003) * 0.5 + 0.5) * h;
    const hh = (i * 34 + (mode === "chaos" ? 330 : 150)) % 360;
    const op = ((mode === "chaos" ? 22 : 14) * (0.7 + temporal.pointDensity)) / 100;
    p.fill(`hsla(${hh}, 80%, 62%, ${op})`);
    p.circle(x, y, 140 + (i % 4) * (mode === "chaos" ? 46 : 34));
  }
  p.blendMode(p.BLEND);

  p.fill(8, 11, 10, 40);
  p.rect(0, 0, w, h);
}

function drawConnections(p, world) {
  const temporal = world.temporal;
  const cells = world.cells;
  const limit = 80 + temporal.clusterDensity * 90 * temporal.quality;
  p.blendMode(p.ADD);
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const a = cells[i];
      const b = cells[j];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist < limit) {
        const alpha = (1 - dist / limit) * (0.08 + temporal.clusterDensity * 0.18);
        const hu = (a.hue + b.hue) / 2;
        p.stroke(`hsla(${hu}, 92%, 66%, ${alpha})`);
        p.strokeWeight(1 + alpha * 8);
        p.line(a.x, a.y, b.x, b.y);
      }
    }
  }
  p.blendMode(p.BLEND);
}

function drawCell(p, cell, temporal) {
  const mapping = cell.mapping;
  if (!mapping || !cell.gene) return;
  const speed = Math.hypot(cell.vx, cell.vy);
  const light = 42 + mapping.brightness * 34 + speed * 3;
  const baseHue = hue(mapping.hue);
  const x = finite(cell.x, p.width * 0.5);
  const y = finite(cell.y, p.height * 0.5);
  const safeSize = clamp(finite(cell.size, 10), 1, 80);
  const projection = 1 + mapping.dimension * 0.42;
  const haloRadius = clamp(finite(safeSize * mapping.aura * projection, safeSize * 6), 1, Math.max(p.width, p.height) * 1.1);
  const membraneRadius = clamp(finite(safeSize * 1.8, 18), 1, 180);

  p.noStroke();
  const halo = p.drawingContext.createRadialGradient(x, y, 0, x, y, haloRadius);
  halo.addColorStop(0, `hsla(${baseHue}, 95%, 65%, ${clamp(0.16 + finite(mapping.volume) * 3.4, 0, 0.75)})`);
  halo.addColorStop(0.42, `hsla(${hue(baseHue + finite(mapping.chordHue, 88))}, 88%, 58%, ${clamp(0.08 + finite(mapping.modulation) * 0.1, 0, 0.38)})`);
  halo.addColorStop(1, `hsla(${baseHue}, 95%, 55%, 0)`);
  p.drawingContext.fillStyle = halo;
  p.circle(x, y, Math.min(safeSize * 11.6, Math.max(p.width, p.height)));

  const membrane = p.drawingContext.createRadialGradient(x, y, 0, x, y, membraneRadius);
  membrane.addColorStop(0, `hsla(${hue(baseHue + 24)}, 96%, 74%, ${clamp(finite(mapping.opacity, 0.7), 0, 1)})`);
  membrane.addColorStop(0.58, `hsla(${baseHue}, 88%, ${finite(light, 58)}%, ${clamp(finite(mapping.opacity, 0.7) * 0.82, 0, 1)})`);
  membrane.addColorStop(1, `hsla(${hue(baseHue + 130)}, 86%, 42%, ${clamp(finite(mapping.opacity, 0.7) * 0.88, 0, 1)})`);

  const points = sampleNurbsMembrane(cell, Math.floor((20 + temporal.pointDensity * 26) * temporal.quality), temporal);
  p.drawingContext.fillStyle = membrane;
  p.drawingContext.shadowColor = `hsl(${baseHue}, 88%, 55%)`;
  p.drawingContext.shadowBlur = 18 + cell.energy * 24;
  p.beginShape();
  points.forEach((pt) => {
    p.vertex(x + pt.x, y + pt.y);
  });
  p.endShape(p.CLOSE);
  p.drawingContext.shadowBlur = 0;

  p.stroke(
    `hsla(${hue(baseHue + 80)}, 94%, 78%, ${clamp(0.2 + finite(mapping.brightness, 0.5) * 0.26, 0, 0.6)})`
  );
  p.strokeWeight(clamp(safeSize * (0.055 + mapping.modulation * 0.045), 0.8, 3.2));
  p.noFill();
  p.beginShape();
  points.forEach((pt) => p.vertex(x + pt.x, y + pt.y));
  p.endShape(p.CLOSE);

  p.blendMode(p.ADD);
  p.stroke(`hsla(${hue(baseHue + 44)}, 96%, 68%, ${clamp(0.07 + finite(mapping.dimension, 0.5) * 0.12, 0, 0.35)})`);
  p.strokeWeight(0.75);
  const lattice = Math.min(points.length, Math.floor(5 + temporal.clusterDensity * 12));
  for (let i = 0; i < lattice; i += 1) {
    const a = points[(i * 3) % points.length];
    const b = points[(i * 7 + 5) % points.length];
    p.line(x + a.x, y + a.y, x + b.x, y + b.y);
  }

  p.stroke(`hsla(${hue(baseHue + 180)}, 90%, 70%, ${clamp(0.12 + finite(mapping.dimension, 0.5) * 0.2, 0, 0.5)})`);
  const nucleiCount = Math.min(cell.gene.nuclei.length, Math.max(1, Math.floor((1 + temporal.pointDensity * cell.gene.nuclei.length) * temporal.quality)));
  for (let i = 0; i < nucleiCount; i += 1) {
    const a = cell.gene.nuclei[i] + cell.phase * (0.42 + i * 0.05);
    const z = Math.sin(cell.hyper + i) * 0.5 + 0.5;
    const r = safeSize * (0.18 + z * 0.34);
    const nx = x + Math.cos(a) * r * projection;
    const ny = y + Math.sin(a * 1.37) * r * 0.76;
    p.circle(nx, ny, Math.max(1.1, safeSize * (0.045 + z * 0.03)));
  }
  p.blendMode(p.BLEND);

  p.fill(255, 255, 255, (0.16 + cell.isolated * 0.24) * 255);
  p.noStroke();
  p.circle(x - safeSize * 0.2, y - safeSize * 0.18, Math.max(1.4, safeSize * 0.14));

  p.blendMode(p.ADD);
  p.stroke(
    `hsla(${hue(baseHue + (mapping.horizontalMotion > 0 ? 55 : 260))}, 96%, 72%, ${clamp(
      0.08 + Math.abs(finite(mapping.horizontalMotion)) * 0.24,
      0,
      0.4
    )})`
  );
  p.strokeWeight(clamp(safeSize * 0.035, 0.6, 1.8));
  p.line(x, y, x - cell.vx * 18, y - cell.vy * 18);
  p.blendMode(p.BLEND);
}

function drawTrail(p, cell) {
  p.strokeWeight(2);
  p.noFill();
  p.blendMode(p.ADD);
  const hist = cell.historyPos;
  const idx = cell._ringPos;
  for (let k = 1; k < Math.min(24, hist.length); k += 1) {
    const a = hist[(idx - k + hist.length) % hist.length];
    const b = hist[(idx - k - 1 + hist.length) % hist.length];
    if (!a || !b) continue;
    const alpha = ((1 - k / 24) * 80) / 255;
    p.stroke(`hsla(${hue(cell.mapping?.hue ?? cell.hue)}, 70%, 70%, ${alpha})`);
    p.line(a.x, a.y, b.x, b.y);
  }
  p.blendMode(p.BLEND);
}

function drawBursts(p, world) {
  p.blendMode(p.ADD);
  for (const burst of world.bursts) {
    p.noFill();
    p.stroke(`hsla(${burst.hue}, 96%, 68%, ${burst.life * (0.18 + world.temporal.pointDensity * 0.24)})`);
    p.strokeWeight(1 + burst.force * 4);
    p.circle(burst.x, burst.y, burst.radius * 2);
  }
  p.blendMode(p.BLEND);
}

function drawSpores(p, world) {
  const temporal = world.temporal;
  const stride = temporal.quality < 0.55 ? 2 : 1;
  p.blendMode(p.ADD);
  for (let i = 0; i < world.spores.length; i += stride) {
    const spore = world.spores[i];
    const depth = clamp(spore.z, -1.4, 1.4);
    const projection = 1 / (1.8 - depth * 0.35);
    const alpha = clamp(spore.life, 0, 1) * (0.1 + temporal.pointDensity * 0.32);
    p.fill(`hsla(${hue(spore.hue)}, 96%, ${58 + projection * 18}%, ${alpha})`);
    p.noStroke();
    p.circle(spore.x, spore.y, spore.size * projection * (0.8 + temporal.macroPressure * 0.7) * 2);
  }
  p.blendMode(p.BLEND);
}

function drawMouse(p, mouse) {
  if (!mouse.active) return;
  const radius = mouse.down ? 250 : 150;
  const g = p.drawingContext.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius);
  g.addColorStop(0, mouse.down ? "rgba(255, 92, 138, 0.18)" : "rgba(71, 199, 255, 0.12)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  p.drawingContext.fillStyle = g;
  p.noStroke();
  p.circle(mouse.x, mouse.y, radius * 2);
}

export function mountSketch(world, audioSync, container) {
  let lastTime = performance.now();
  const sketch = new p5((p) => {
    p.setup = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const canvas = p.createCanvas(w, h);
      canvas.parent(container);
      world.resize(w, h);
    };

    p.windowResized = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      p.resizeCanvas(w, h);
      world.resize(w, h);
    };

    p.draw = () => {
      const now = performance.now();
      const dt = Math.min(40, now - lastTime);
      lastTime = now;
      world.mouse.x = p.mouseX;
      world.mouse.y = p.mouseY;
      world.mouse.down = p.mouseIsPressed;
      world.mouse.active = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;

      world.step(dt, dt);
      if (audioSync) audioSync(world, dt);

      p.clear(0, 0, 0, 0);
      drawField(p, world);
      drawSpores(p, world);
      drawConnections(p, world);
      for (const cell of world.cells) {
        drawTrail(p, cell);
      }
      for (const cell of world.cells) {
        drawCell(p, cell, world.temporal);
      }
      drawBursts(p, world);
      drawMouse(p, world.mouse);
    };
  }, container);

  return sketch;
}
