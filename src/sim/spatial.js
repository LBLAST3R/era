/**
 * Uniform grid for neighbor queries (avoid O(n²) when many cells).
 */
export class SpatialGrid {
  /**
   * @param {number} cellSize
   * @param {number} width
   * @param {number} height
   */
  constructor(cellSize, width, height) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    /** @type {Map<string, number[]>} */
    this.map = new Map();
  }

  clear() {
    this.map.clear();
  }

  /**
   * @param {import('./cellule.js').Cellule} c
   * @param {number} index
   */
  insert(c, index) {
    const cx = Math.floor(c.x / this.cellSize);
    const cy = Math.floor(c.y / this.cellSize);
    const key = `${cx},${cy}`;
    let arr = this.map.get(key);
    if (!arr) {
      arr = [];
      this.map.set(key, arr);
    }
    arr.push(index);
  }

  /**
   * @param {import('./cellule.js').Cellule} c
   * @returns {Iterable<number>}
   */
  *neighbors(c) {
    const cx = Math.floor(c.x / this.cellSize);
    const cy = Math.floor(c.y / this.cellSize);
    const seen = new Set();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${cx + dx},${cy + dy}`;
        const arr = this.map.get(key);
        if (!arr) continue;
        for (const i of arr) {
          if (!seen.has(i)) {
            seen.add(i);
            yield i;
          }
        }
      }
    }
  }
}
