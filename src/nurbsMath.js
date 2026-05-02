export function bsplineBasis(i, degree, u, knots) {
  if (degree === 0) {
    return (knots[i] <= u && u < knots[i + 1]) || (u === 1 && knots[i + 1] === 1) ? 1 : 0;
  }
  const leftDenominator = knots[i + degree] - knots[i];
  const rightDenominator = knots[i + degree + 1] - knots[i + 1];
  const left = leftDenominator === 0 ? 0 : ((u - knots[i]) / leftDenominator) * bsplineBasis(i, degree - 1, u, knots);
  const right = rightDenominator === 0 ? 0 : ((knots[i + degree + 1] - u) / rightDenominator) * bsplineBasis(i + 1, degree - 1, u, knots);
  return left + right;
}
