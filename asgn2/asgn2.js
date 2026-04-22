// CSE 160 – Assignment 2: Blocky 3D Animal

let g_ear1Angle = 0;
let g_ear2Angle = 0;
let g_legAngle = 0;
let g_time = 0;

let g_animating = false;

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    gl_PointSize = 10.0;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// ── WebGL globals ─────────────────────────────────────────────
let gl, canvas;
let a_Position;
let u_FragColor, u_ModelMatrix, u_GlobalRotateMatrix;

// ── Scene rotation (mouse drag) ───────────────────────────────
let g_angleX = 30, g_angleY = 0;
let g_lastX = null, g_lastY = null;
let g_dragging = false;

// ── Setup ─────────────────────────────────────────────────────
function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl');
  if (!gl) { alert('WebGL not supported'); return false; }
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);
  return true;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return false;
  a_Position           = gl.getAttribLocation (gl.program, 'a_Position');
  u_FragColor          = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix        = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  return true;
}

// ── Matrix4 ───────────────────────────────────────────────────
class Matrix4 {
  constructor(src) {
    this.elements = src ? new Float32Array(src.elements) : new Float32Array(16);
    if (!src) this.setIdentity();
  }
  setIdentity() {
    const e = this.elements;
    e[0]=1; e[4]=0; e[8]=0;  e[12]=0;
    e[1]=0; e[5]=1; e[9]=0;  e[13]=0;
    e[2]=0; e[6]=0; e[10]=1; e[14]=0;
    e[3]=0; e[7]=0; e[11]=0; e[15]=1;
    return this;
  }
  setTranslate(x, y, z) {
    const e = this.elements;
    e[0]=1; e[4]=0; e[8]=0;  e[12]=x;
    e[1]=0; e[5]=1; e[9]=0;  e[13]=y;
    e[2]=0; e[6]=0; e[10]=1; e[14]=z;
    e[3]=0; e[7]=0; e[11]=0; e[15]=1;
    return this;
  }
  setScale(x, y, z) {
    const e = this.elements;
    e[0]=x; e[4]=0; e[8]=0;  e[12]=0;
    e[1]=0; e[5]=y; e[9]=0;  e[13]=0;
    e[2]=0; e[6]=0; e[10]=z; e[14]=0;
    e[3]=0; e[7]=0; e[11]=0; e[15]=1;
    return this;
  }
  setRotate(angle, x, y, z) {
    const rad = angle * Math.PI / 180;
    const c = Math.cos(rad), s = Math.sin(rad), t = 1 - c;
    const len = Math.sqrt(x*x + y*y + z*z);
    if (len === 0) return this.setIdentity();
    x /= len; y /= len; z /= len;
    const e = this.elements;
    e[0]=t*x*x+c;   e[4]=t*x*y-s*z; e[8] =t*x*z+s*y; e[12]=0;
    e[1]=t*x*y+s*z; e[5]=t*y*y+c;   e[9] =t*y*z-s*x; e[13]=0;
    e[2]=t*x*z-s*y; e[6]=t*y*z+s*x; e[10]=t*z*z+c;   e[14]=0;
    e[3]=0;          e[7]=0;          e[11]=0;          e[15]=1;
    return this;
  }
  multiply(other) {
    const a = this.elements, b = other.elements;
    const r = new Float32Array(16);
    for (let col = 0; col < 4; col++)
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[row + k*4] * b[k + col*4];
        r[row + col*4] = sum;
      }
    this.elements = r;
    return this;
  }
  translate(x, y, z) { return this.multiply(new Matrix4().setTranslate(x, y, z)); }
  scale(x, y, z)      { return this.multiply(new Matrix4().setScale(x, y, z)); }
  rotate(a, x, y, z)  { return this.multiply(new Matrix4().setRotate(a, x, y, z)); }
}

// ── Cube geometry ─────────────────────────────────────────────
// Unit cube centred at origin. 6 faces x 2 triangles x 3 vertices = 36 vertices.
const CUBE_VERTS = new Float32Array([
  // Front  (z= 0.5)
  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5,   0.5, 0.5, 0.5,
  -0.5,-0.5, 0.5,   0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,
  // Back   (z=-0.5)
  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5,
  -0.5,-0.5,-0.5,   0.5, 0.5,-0.5,   0.5,-0.5,-0.5,
  // Left   (x=-0.5)
  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5,  -0.5, 0.5, 0.5,
  -0.5,-0.5,-0.5,  -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,
  // Right  (x= 0.5)
   0.5,-0.5,-0.5,   0.5, 0.5,-0.5,   0.5, 0.5, 0.5,
   0.5,-0.5,-0.5,   0.5, 0.5, 0.5,   0.5,-0.5, 0.5,
  // Top    (y= 0.5)
  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5,   0.5, 0.5, 0.5,
  -0.5, 0.5,-0.5,   0.5, 0.5, 0.5,   0.5, 0.5,-0.5,
  // Bottom (y=-0.5)
  -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,
  -0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5,
]);

// Shared GPU buffer — allocated once, reused every draw call.
let g_cubeBuffer = null;

function initCubeBuffer() {
  g_cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTS, gl.STATIC_DRAW);
}

// drawCube — set colour, bind the shared buffer, issue the draw call.
// The caller must upload u_ModelMatrix before calling this.
function drawCube(rgba) {
  gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3] ?? 1.0);
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

// ── Sphere geometry ───────────────────────────────────────────
let g_sphereBuffer = null;
let g_sphereVertCount = 0;

function initSphereBuffer() {
  console.log("initSphere called");
  const verts = [];
  const stacks = 8, slices = 8;
  for (let i = 0; i < stacks; i++) {
    const phi1 = (i / stacks) * Math.PI;
    const phi2 = ((i + 1) / stacks) * Math.PI;
    for (let j = 0; j < slices; j++) {
      const theta1 = (j / slices) * 2 * Math.PI;
      const theta2 = ((j + 1) / slices) * 2 * Math.PI;
      const v = [
        [Math.sin(phi1)*Math.cos(theta1), Math.cos(phi1), Math.sin(phi1)*Math.sin(theta1)],
        [Math.sin(phi2)*Math.cos(theta1), Math.cos(phi2), Math.sin(phi2)*Math.sin(theta1)],
        [Math.sin(phi2)*Math.cos(theta2), Math.cos(phi2), Math.sin(phi2)*Math.sin(theta2)],
        [Math.sin(phi1)*Math.cos(theta2), Math.cos(phi1), Math.sin(phi1)*Math.sin(theta2)],
      ];
      verts.push(...v[0], ...v[1], ...v[2]);
      verts.push(...v[0], ...v[2], ...v[3]);
    }
  }
  g_sphereVertCount = verts.length / 3;
  g_sphereBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
}

function drawSphere(rgba) {
  gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3] ?? 1.0);
  gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, g_sphereVertCount);
}

// ── Cube scene-object ─────────────────────────────────────────
class Cube {
  constructor() {
    this.color  = [1, 1, 1, 1];
    this.matrix = new Matrix4();
  }
  render() {
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    drawCube(this.color);
  }
}

// ── Render ────────────────────────────────────────────────────
function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const globalRot = new Matrix4()
    .setRotate(g_angleX, 1, 0, 0)
    .rotate(g_angleY, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRot.elements);

  drawAnimal();
}

// ── Animal ────────────────────────────────────────────────────
// One cube for now — add body parts here.
function drawAnimal() {
  // ── Body ──────────────────────────────────────────────────
  const body = new Cube();
  body.color = [0.85, 0.85, 0.85, 1];
  body.matrix.setIdentity().scale(0.5, 0.4, 0.35);
  body.render();

  // ── Head ──────────────────────────────────────────────────
  const head = new Cube();
  head.color = [0.85, 0.85, 0.85, 1];
  head.matrix.setIdentity().translate(0, 0.3, 0.15).scale(0.3, 0.28, 0.28);
  head.render();

  // ── Left Ear (base) ───────────────────────────────────────
  const earLBase = new Cube();
  earLBase.color = [0.85, 0.85, 0.85, 1];
  earLBase.matrix.setIdentity()
    .translate(-0.08, 0.45, 0.15)
    .rotate(g_ear1Angle, 0, 0, 1)
    .scale(0.07, 0.2, 0.07);
  earLBase.render();

  // ── Left Ear (mid) ────────────────────────────────────────
  const earLMid = new Cube();
  earLMid.color = [0.9, 0.75, 0.75, 1];
  earLMid.matrix.setIdentity()
    .translate(-0.08, 0.45, 0.15)
    .rotate(g_ear1Angle, 0, 0, 1)
    .translate(0, 0.2, 0)
    .rotate(g_ear2Angle, 0, 0, 1)
    .scale(0.055, 0.18, 0.055);
  earLMid.render();

  // ── Left Ear (tip) — 3rd level ────────────────────────────
  const earLTip = new Cube();
  earLTip.color = [0.95, 0.7, 0.7, 1];
  earLTip.matrix.setIdentity()
    .translate(-0.08, 0.45, 0.15)
    .rotate(g_ear1Angle, 0, 0, 1)
    .translate(0, 0.2, 0)
    .rotate(g_ear2Angle, 0, 0, 1)
    .translate(0, 0.18, 0)
    .scale(0.04, 0.1, 0.04);
  earLTip.render();

  // ── Right Ear (mirrors left, uses same angles) ─────────────
  const earRBase = new Cube();
  earRBase.color = [0.85, 0.85, 0.85, 1];
  earRBase.matrix.setIdentity()
    .translate(0.08, 0.45, 0.15)
    .rotate(-g_ear1Angle, 0, 0, 1)
    .scale(0.07, 0.2, 0.07);
  earRBase.render();

  const earRMid = new Cube();
  earRMid.color = [0.9, 0.75, 0.75, 1];
  earRMid.matrix.setIdentity()
    .translate(0.08, 0.45, 0.15)
    .rotate(-g_ear1Angle, 0, 0, 1)
    .translate(0, 0.2, 0)
    .rotate(-g_ear2Angle, 0, 0, 1)
    .scale(0.055, 0.18, 0.055);
  earRMid.render();

  const earRTip = new Cube();
  earRTip.color = [0.95, 0.7, 0.7, 1];
  earRTip.matrix.setIdentity()
    .translate(0.08, 0.45, 0.15)
    .rotate(-g_ear1Angle, 0, 0, 1)
    .translate(0, 0.2, 0)
    .rotate(-g_ear2Angle, 0, 0, 1)
    .translate(0, 0.18, 0)
    .scale(0.04, 0.1, 0.04);
  earRTip.render();

  // ── Front Legs ────────────────────────────────────────────
  const frontLegL = new Cube();
  frontLegL.color = [0.8, 0.8, 0.8, 1];
  frontLegL.matrix.setIdentity()
    .translate(-0.2, -0.15, 0.12)
    .rotate(g_legAngle, 1, 0, 0)
    .translate(0, -0.1, 0)
    .scale(0.1, 0.2, 0.1);
  frontLegL.render();

  const frontLegR = new Cube();
  frontLegR.color = [0.8, 0.8, 0.8, 1];
  frontLegR.matrix.setIdentity()
    .translate(0.2, -0.15, 0.12)
    .rotate(g_legAngle, 1, 0, 0)
    .translate(0, -0.1, 0)
    .scale(0.1, 0.2, 0.1);
  frontLegR.render();

  // ── Back Legs ─────────────────────────────────────────────
  const backLegL = new Cube();
  backLegL.color = [0.8, 0.8, 0.8, 1];
  backLegL.matrix.setIdentity()
    .translate(-0.2, -0.15, -0.12)
    .rotate(-g_legAngle, 1, 0, 0)
    .translate(0, -0.1, 0)
    .scale(0.1, 0.2, 0.13);
  backLegL.render();

  const backLegR = new Cube();
  backLegR.color = [0.8, 0.8, 0.8, 1];
  backLegR.matrix.setIdentity()
    .translate(0.2, -0.15, -0.12)
    .rotate(-g_legAngle, 1, 0, 0)
    .translate(0, -0.1, 0)
    .scale(0.1, 0.2, 0.13);
  backLegR.render();

  // ── Tail (sphere) ─────────────────────────────────────────
  const tailM = new Matrix4();
  tailM.setIdentity().translate(0, -0.05, -0.22).scale(0.1, 0.1, 0.1);;
  gl.uniformMatrix4fv(u_ModelMatrix, false, tailM.elements);
  drawSphere([1, 1, 1, 1]);
}

// ── UI callbacks (kept for HTML compatibility) ─────────────────
function setShape()    {}
function clearCanvas() { renderScene(); }
function drawPicture() { renderScene(); }

// ── Mouse drag for scene rotation ─────────────────────────────
function addMouseHandlers() {
  canvas.addEventListener('mousedown', ev => {
    g_dragging = true;
    g_lastX = ev.clientX;
    g_lastY = ev.clientY;
  });
  canvas.addEventListener('mousemove', ev => {
    if (!g_dragging) return;
    g_angleY += (ev.clientX - g_lastX) * 0.5;
    g_angleX += (ev.clientY - g_lastY) * 0.5;
    g_lastX = ev.clientX;
    g_lastY = ev.clientY;
    renderScene();
  });
  canvas.addEventListener('mouseup',    () => { g_dragging = false; });
  canvas.addEventListener('mouseleave', () => { g_dragging = false; });
}

// ── Shader helpers ────────────────────────────────────────────
function initShaders(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER,   vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return false;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Link:', gl.getProgramInfoLog(prog)); return false;
  }
  gl.useProgram(prog);
  gl.program = prog;
  return true;
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('Compile:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh); return null;
  }
  return sh;
}

function updateAnimationAngles() {
  g_ear1Angle = 20 * Math.sin(g_time * 2);
  g_ear2Angle = 15 * Math.sin(g_time * 2 + 1);
  g_legAngle  = 15 * Math.sin(g_time * 3);
}

function tick(timestamp) {
  g_time = timestamp / 1000;
  if (g_animating) updateAnimationAngles();
  renderScene();
  requestAnimationFrame(tick);
}

function toggleAnimation() {
  g_animating = !g_animating;
}

// ── Main ──────────────────────────────────────────────────────
function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;
  initCubeBuffer();
  initSphereBuffer();
  addMouseHandlers();
  requestAnimationFrame(tick);
}

window.onload = main;
