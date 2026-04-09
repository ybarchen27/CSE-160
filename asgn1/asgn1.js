// ============================================================
// CSE 160 – Assignment 1: Painting
// asgn1.js
// ============================================================

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_PointSize;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_PointSize;
  }
`;
const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

let gl, canvas;
let a_Position, u_FragColor, u_PointSize;

let g_shapesList = [];
let g_shape     = 'point';
let g_color     = [1.0, 0.0, 0.0, 1.0];
let g_size      = 10;
let g_segments  = 10;

// ---- WebGL setup ----
function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) { alert('WebGL not supported'); return false; }
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return true;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return false;
  a_Position  = gl.getAttribLocation (gl.program, 'a_Position');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_PointSize = gl.getUniformLocation(gl.program, 'u_PointSize');
  return true;
}

// ---- Shape Classes ----
class Point {
  constructor(x, y, color, size) {
    this.x = x; this.y = y;
    this.color = color.slice(); this.size = size;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_PointSize, this.size);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([this.x, this.y]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}

class Triangle {
  constructor(verts, color) {
    this.verts = verts.slice(); this.color = color.slice();
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_PointSize, 1.0);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.verts), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

class Circle {
  constructor(x, y, color, size, segments) {
    this.x = x; this.y = y;
    this.color = color.slice(); this.size = size; this.segments = segments;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_PointSize, 1.0);
    const r = this.size / 200;
    const verts = [];
    for (let i = 0; i < this.segments; i++) {
      const a1 = (2 * Math.PI * i)       / this.segments;
      const a2 = (2 * Math.PI * (i + 1)) / this.segments;
      verts.push(this.x, this.y);
      verts.push(this.x + r * Math.cos(a1), this.y + r * Math.sin(a1));
      verts.push(this.x + r * Math.cos(a2), this.y + r * Math.sin(a2));
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.drawArrays(gl.TRIANGLES, 0, this.segments * 3);
  }
}

// ---- Render ----
function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (const s of g_shapesList) s.render();
}

// ---- Click / drag ----
function canvasCoords(ev) {
  const rect = canvas.getBoundingClientRect();
  const x =  ((ev.clientX - rect.left) / canvas.width)  * 2 - 1;
  const y = -((ev.clientY - rect.top)  / canvas.height) * 2 + 1;
  return [x, y];
}

function handleClick(ev) {
  const [x, y] = canvasCoords(ev);
  if (g_shape === 'point') {
    g_shapesList.push(new Point(x, y, g_color, g_size));
  } else if (g_shape === 'triangle') {
    const s = g_size / 300;
    g_shapesList.push(new Triangle(
      [x, y + s,  x - s, y - s,  x + s, y - s], g_color));
  } else if (g_shape === 'circle') {
    g_shapesList.push(new Circle(x, y, g_color, g_size, g_segments));
  }
  renderAllShapes();
}

function handleMouseMove(ev) {
  if (ev.buttons !== 1) return;
  handleClick(ev);
}

// ---- UI ----
function setShape(s) {
  g_shape = s;
  document.getElementById('btnPoint'   ).classList.toggle('active', s === 'point');
  document.getElementById('btnTriangle').classList.toggle('active', s === 'triangle');
  document.getElementById('btnCircle'  ).classList.toggle('active', s === 'circle');
}

function updateColor() {
  const r = +document.getElementById('rSlider').value;
  const g = +document.getElementById('gSlider').value;
  const b = +document.getElementById('bSlider').value;
  document.getElementById('rVal').textContent = r;
  document.getElementById('gVal').textContent = g;
  document.getElementById('bVal').textContent = b;
  document.getElementById('colorBox').style.background = `rgb(${r},${g},${b})`;
  g_color = [r/255, g/255, b/255, 1.0];
}

function clearCanvas() {
  g_shapesList = [];
  renderAllShapes();
}

// ---- Draw Picture – full landscape with initials "YB" ----
function drawPicture() {
  g_shapesList = [];
  function tri(x1,y1, x2,y2, x3,y3, r,g,b) {
    g_shapesList.push(new Triangle([x1,y1, x2,y2, x3,y3], [r,g,b,1.0]));
  }

  // Sky gradient panels
  const sky = [[0.20,0.60,0.90],[0.15,0.50,0.85],[0.25,0.65,0.95],[0.10,0.45,0.80]];
  for (let i=0; i<8; i++) {
    const c=sky[i%sky.length], x=-1+i*0.25;
    tri(x,1.0, x+0.25,1.0, x,0.0, ...c);
    tri(x+0.25,1.0, x+0.25,0.0, x,0.0, ...c);
  }

  // Ground
  tri(-1,-1, 1,-1, -1,-0.05, 0.15,0.55,0.15);
  tri( 1,-1, 1,-0.05, -1,-0.05, 0.10,0.45,0.10);

  // Sun
  const sx=0.65, sy=0.70, sr=0.18;
  for (let i=0; i<12; i++) {
    const a1=(2*Math.PI*i)/12, a2=(2*Math.PI*(i+1))/12;
    tri(sx,sy, sx+sr*Math.cos(a1),sy+sr*Math.sin(a1),
               sx+sr*Math.cos(a2),sy+sr*Math.sin(a2), 1.0,0.85,0.0);
  }

  // Left mountain + snow cap
  tri(-0.9,-0.05, -0.45,0.55, 0.0,-0.05,  0.40,0.40,0.45);
  tri(-0.9,-0.05, -0.45,0.55, -1.0,0.20,  0.35,0.35,0.40);
  tri(-0.55,0.40, -0.45,0.55, -0.35,0.40, 0.92,0.95,1.0);

  // Right mountain + snow cap
  tri(0.10,-0.05, 0.55,0.65, 1.0,-0.05,   0.35,0.40,0.42);
  tri(0.45,0.50,  0.55,0.65, 0.65,0.50,   0.92,0.95,1.0);

  // Trees
  function tree(tx, ty) {
    tri(tx-0.02,ty-0.18, tx+0.02,ty-0.18, tx-0.02,ty, 0.55,0.27,0.07);
    tri(tx+0.02,ty-0.18, tx+0.02,ty,      tx-0.02,ty, 0.55,0.27,0.07);
    tri(tx-0.10,ty, tx+0.10,ty, tx,ty+0.20, 0.10,0.55,0.10);
    tri(tx-0.07,ty+0.12, tx+0.07,ty+0.12, tx,ty+0.28, 0.15,0.65,0.15);
    tri(tx-0.05,ty+0.22, tx+0.05,ty+0.22, tx,ty+0.35, 0.20,0.75,0.20);
  }
  tree(-0.28,-0.05);
  tree( 0.00,-0.05);

  // ---- Letter Y (red-orange) ----
  // Left arm
  tri(-0.82,0.35, -0.70,0.35, -0.62,0.15, 0.95,0.30,0.10);
  tri(-0.82,0.35, -0.62,0.15, -0.74,0.15, 0.95,0.30,0.10);
  // Right arm
  tri(-0.58,0.35, -0.46,0.35, -0.62,0.15, 0.95,0.30,0.10);
  tri(-0.58,0.35, -0.62,0.15, -0.50,0.15, 0.95,0.30,0.10);
  // Stem
  tri(-0.68,0.15, -0.56,0.15, -0.68,-0.02, 0.95,0.30,0.10);
  tri(-0.56,0.15, -0.56,-0.02, -0.68,-0.02, 0.95,0.30,0.10);

  // ---- Letter B (blue) ----
  const bx=0.20;
  // Vertical bar
  tri(bx,0.35, bx+0.10,0.35, bx,-0.02,    0.20,0.55,0.95);
  tri(bx+0.10,0.35, bx+0.10,-0.02, bx,-0.02, 0.20,0.55,0.95);
  // Top bump
  tri(bx+0.10,0.35, bx+0.35,0.30, bx+0.10,0.17, 0.20,0.55,0.95);
  tri(bx+0.35,0.30, bx+0.35,0.17, bx+0.10,0.17, 0.20,0.55,0.95);
  // Bottom bump
  tri(bx+0.10,0.17, bx+0.38,0.12, bx+0.10,-0.02, 0.20,0.55,0.95);
  tri(bx+0.38,0.12, bx+0.38,-0.02, bx+0.10,-0.02, 0.20,0.55,0.95);

  renderAllShapes();
}

// ---- Shader init ----
function initShaders(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER,   vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return false;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(prog)); return false;
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
    console.error('Compile error:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh); return null;
  }
  return sh;
}

// ---- Main ----
function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;
  canvas.onmousedown = handleClick;
  canvas.onmousemove = handleMouseMove;
  renderAllShapes();
}

window.onload = main;
