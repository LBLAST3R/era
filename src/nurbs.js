import { bsplineBasis } from "./nurbsMath.js";

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}
export function sampleWeightedNurbs(controls, degree, knots, sampleCount) {
  const count = Math.max(8, Math.floor(sampleCount));
  const points = [];
  for (let s = 0; s < count; s += 1) {
    const u = s / count;
    const basis = [];
    for (let i = 0; i < controls.length; i += 1) {
      basis.push(bsplineBasis(i, degree, u, knots));
    }
    let x = 0;
    let y = 0;
    let denominator = 0;
    for (let i = 0; i < controls.length; i += 1) {
      const b = basis[i] * controls[i].w;
      x += controls[i].x * b;
      y += controls[i].y * b;
      denominator += b;
    }
    if (denominator === 0) points.push({ x: controls[0].x, y: controls[0].y });
    else points.push({ x: x / denominator, y: y / denominator });
  }
  return points;
}

export function sampleNurbsMembrane(cell, sampleCount, temporal) {
  const controls = cell.gene.controls.map((control, i) => {
    const phase = cell.phase * control.spin + cell.hyper * 0.7 + i * 0.37;
    const mapping = cell.mapping;
    const fourD = Math.sin(cell.hyper + control.z * 2.4 + i) * (0.26 + mapping.dimension * 0.32);
    const projection = 1 / (1.38 - fourD * 0.42);
    const angle = control.angle + Math.sin(phase) * 0.16 + cell.gene.twist * 0.08;
    const fold = 1 + Math.sin(phase * control.fold) * (0.08 + mapping.modulation * 0.1) + Math.cos(cell.hyper + i) * 0.06;
    const radius = cell.size * control.radius * fold * projection;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * (0.82 + Math.sin(cell.depth + cell.hyper) * 0.1),
      w: control.w * (0.86 + projection * 0.18)
    };
  });
  return sampleWeightedNurbs(controls, cell.gene.degree, cell.gene.knots, sampleCount * temporal.quality);
}
