/**
 * Optional WebGL overlay: additive glow discs (instanced triangles), low cost.
 */

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec2 a_inst;
layout(location=3) in float a_size;
layout(location=4) in vec3 a_col;
uniform vec2 u_res;
uniform float u_scale;
out vec2 v_uv;
out vec3 v_col;
void main() {
  vec2 world = a_inst + a_pos * a_size * u_scale;
  vec2 ndc = (world / u_res) * 2.0 - 1.0;
  ndc.y *= -1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_uv = a_uv;
  v_col = a_col;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_col;
out vec4 outColor;
void main() {
  float d = length(v_uv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a = pow(a, 2.2);
  outColor = vec4(v_col * a, a * 0.55);
}`;

export class WebGLLayer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    this.gl = gl;
    this.program = null;
    this.vao = null;
    this.instanceCap = 256;
    this.enabled = true;
    if (!gl) {
      this.enabled = false;
      return;
    }
    this._build(gl);
  }

  /**
   * @param {WebGL2RenderingContext} gl
   */
  _build(gl) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, VERT);
    gl.shaderSource(fs, FRAG);
    gl.compileShader(vs);
    gl.compileShader(fs);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.enabled = false;
      return;
    }
    this.program = prog;

    const quad = new Float32Array([
      -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1,
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const instPos = new Float32Array(this.instanceCap * 2);
    const instSize = new Float32Array(this.instanceCap);
    const instCol = new Float32Array(this.instanceCap * 3);

    const ibPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibPos);
    gl.bufferData(gl.ARRAY_BUFFER, instPos.byteLength, gl.DYNAMIC_DRAW);

    const ibSize = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibSize);
    gl.bufferData(gl.ARRAY_BUFFER, instSize.byteLength, gl.DYNAMIC_DRAW);

    const ibCol = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibCol);
    gl.bufferData(gl.ARRAY_BUFFER, instCol.byteLength, gl.DYNAMIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const stride = 4 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(0, 0);
    gl.vertexAttribDivisor(1, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, ibPos);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 8, 0);
    gl.vertexAttribDivisor(2, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, ibSize);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 4, 0);
    gl.vertexAttribDivisor(3, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, ibCol);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, 12, 0);
    gl.vertexAttribDivisor(4, 1);

    this.vao = vao;
    this._buffers = { instPos, instSize, instCol, ibPos, ibSize, ibCol };
    gl.bindVertexArray(null);
  }

  /**
   * @param {number} w
   * @param {number} h
   * @param {import('../sim/world.js').World} world
   * @param {number} energy01
   */
  render(w, h, world, energy01) {
    const gl = this.gl;
    if (!this.enabled || !gl || !this.program) return;

    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const cells = world.cells;
    const n = Math.min(this.instanceCap - 1, cells.length);
    const { instPos, instSize, instCol, ibPos, ibSize, ibCol } = this._buffers;

    let idx = 0;
    const nucleusHue = world.nucleus.hue;
    instPos[idx * 2] = world.nucleus.x;
    instPos[idx * 2 + 1] = world.nucleus.y;
    instSize[idx] = world.nucleus.r * 2.8 * (1 + energy01 * 0.3);
    instCol[idx * 3] = 0.3 + nucleusHue * 0.4;
    instCol[idx * 3 + 1] = 0.85;
    instCol[idx * 3 + 2] = 0.9;
    idx++;

    for (let i = 0; i < cells.length && idx < this.instanceCap; i++) {
      const c = cells[i];
      instPos[idx * 2] = c.x;
      instPos[idx * 2 + 1] = c.y;
      instSize[idx] = c.r * (2.2 + energy01);
      const typ = c.type;
      if (typ === "mere") {
        instCol[idx * 3] = 0.2;
        instCol[idx * 3 + 1] = 0.95;
        instCol[idx * 3 + 2] = 0.85;
      } else if (typ === "impulsion") {
        instCol[idx * 3] = 1;
        instCol[idx * 3 + 1] = 0.25;
        instCol[idx * 3 + 2] = 0.55;
      } else {
        instCol[idx * 3] = 0.45;
        instCol[idx * 3 + 1] = 0.65;
        instCol[idx * 3 + 2] = 1;
      }
      idx++;
      if (idx >= this.instanceCap) break;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, ibPos);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instPos.subarray(0, idx * 2));

    gl.bindBuffer(gl.ARRAY_BUFFER, ibSize);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instSize.subarray(0, idx));

    gl.bindBuffer(gl.ARRAY_BUFFER, ibCol);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instCol.subarray(0, idx * 3));

    gl.useProgram(this.program);
    const uRes = gl.getUniformLocation(this.program, "u_res");
    const uScale = gl.getUniformLocation(this.program, "u_scale");
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uScale, 1);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, idx);
    gl.bindVertexArray(null);
  }

  destroy() {
    /* noop */
  }
}
