/** @typedef {'mere' | 'tissu' | 'lumiere' | 'impulsion' | 'fantome'} CellType */

export const CELL_TYPES = /** @type {const} */ (["mere", "tissu", "lumiere", "impulsion", "fantome"]);

/**
 * Living cell in the sonic organism.
 */
export class Cellule {
  /**
   * @param {object} o
   * @param {number} o.x
   * @param {number} o.y
   * @param {CellType} o.type
   * @param {number} [o.vx]
   * @param {number} [o.vy]
   * @param {number} [o.life]
   */
  constructor(o) {
    this.x = o.x;
    this.y = o.y;
    this.vx = o.vx ?? 0;
    this.vy = o.vy ?? 0;
    /** @type {CellType} */
    this.type = o.type;
    this.life = o.life ?? 1;
    this.age = 0;
    this.r = this.radiusForType(o.type);
    this.trail = [];
    this.maxTrail = 24;
    this.angle = Math.random() * Math.PI * 2;
    this.pulse = 0;
  }

  /**
   * @param {CellType} t
   */
  radiusForType(t) {
    switch (t) {
      case "mere":
        return 10;
      case "tissu":
        return 6;
      case "lumiere":
        return 4;
      case "impulsion":
        return 5;
      case "fantome":
        return 7;
      default:
        return 5;
    }
  }

  /**
   * @param {number} dt
   * @param {object} field
   */
  step(dt, field) {
    this.age += dt;
    const ax = field.ax ?? 0;
    const ay = field.ay ?? 0;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.vx *= 0.985;
    this.vy *= 0.985;

    if (this.type === "fantome") {
      this.angle += dt * 0.8;
      this.x += Math.cos(this.angle) * 20 * dt;
      this.y += Math.sin(this.angle) * 20 * dt;
    } else {
      this.x += this.vx * dt * 60;
      this.y += this.vy * dt * 60;
    }

    this.pulse *= 0.9;
    this.life -= dt * 0.012;

    this.trail.push({ x: this.x, y: this.y, a: this.life });
    while (this.trail.length > this.maxTrail) this.trail.shift();
  }
}
