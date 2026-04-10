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
let g_shape    = 'paint';
let g_color    = [1.0, 0.0, 0.0, 1.0];
let g_size     = 20;
let g_segments = 10;

// Track previous position for direction + gap-filling
let g_prevX = null, g_prevY = null;

// ============================================================
// Setup
// ============================================================
function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) { alert('WebGL not supported'); return false; }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 1);
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

// ============================================================
// Buffer helper
// ============================================================
function bufferAndDraw(verts, mode, count) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(mode, 0, count);
}

// ============================================================
// Shape Classes
// ============================================================

class Point {
  constructor(x, y, color, size) {
    this.x = x; this.y = y;
    this.color = color.slice(); this.size = size;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_PointSize, this.size);
    bufferAndDraw([this.x, this.y], gl.POINTS, 1);
  }
}

// ---- Awesome: Paint Brush ----
// Draws a cluster of overlapping points spread along the stroke direction,
// giving a real brushstroke look. Offsets computed in pixel-space so the
// spread scales properly with brush size.
class PaintBrush {
  constructor(x, y, color, size, dx, dy) {
    this.x = x; this.y = y;
    this.color = color.slice(); this.size = size;
    const len = Math.sqrt(dx * dx + dy * dy);
    this.dx = len > 0 ? dx / len : 1;
    this.dy = len > 0 ? dy / len : 0;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_PointSize, this.size * 0.7);

    // Convert pixel offsets to clip-space
    const scaleX = 2 / canvas.width;
    const scaleY = 2 / canvas.height;
    const spread = this.size * 0.45;

    const fwd  = [this.dx, this.dy];
    const perp = [-this.dy, this.dx];

    // 9 splat positions: centre + spread along and across stroke
    const offsets = [
      [0, 0], [1, 0], [-1, 0],
      [0.5, 0.4], [-0.5, -0.4],
      [1.2, 0.2], [-1.2, -0.2],
      [0.3, -0.5], [-0.3, 0.5],
    ];

    for (const [a, p] of offsets) {
      const ox = (fwd[0] * a + perp[0] * p) * spread * scaleX;
      const oy = (fwd[1] * a + perp[1] * p) * spread * scaleY;
      bufferAndDraw([this.x + ox, this.y + oy], gl.POINTS, 1);
    }
  }
}

// ---- Awesome: Stroke Segment (gap-filler) ----
// Filled rectangle between two points so fast drags have no gaps.
class StrokeSegment {
  constructor(x1, y1, x2, y2, color, size) {
    this.x1 = x1; this.y1 = y1;
    this.x2 = x2; this.y2 = y2;
    this.color = color.slice(); this.size = size;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_PointSize, this.size);

    const dx = this.x2 - this.x1, dy = this.y2 - this.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return;

    const hw = (this.size / 2) * (2 / canvas.width);
    const hh = (this.size / 2) * (2 / canvas.height);
    const nx = (-dy / len) * hw;
    const ny = ( dx / len) * hh;

    const x1 = this.x1, y1 = this.y1, x2 = this.x2, y2 = this.y2;
    bufferAndDraw([
      x1+nx, y1+ny,  x1-nx, y1-ny,  x2+nx, y2+ny,
      x1-nx, y1-ny,  x2-nx, y2-ny,  x2+nx, y2+ny,
    ], gl.TRIANGLES, 6);
  }
}

class Triangle {
  constructor(verts, color) {
    this.verts = verts.slice(); this.color = color.slice();
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_PointSize, 1.0);
    bufferAndDraw(this.verts, gl.TRIANGLES, 3);
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
      const a1 = 2 * Math.PI * i       / this.segments;
      const a2 = 2 * Math.PI * (i + 1) / this.segments;
      verts.push(this.x, this.y,
                 this.x + r * Math.cos(a1), this.y + r * Math.sin(a1),
                 this.x + r * Math.cos(a2), this.y + r * Math.sin(a2));
    }
    bufferAndDraw(verts, gl.TRIANGLES, this.segments * 3);
  }
}

// ============================================================
// Render
// renderAllShapes: full clear + redraw (Clear button, Draw Picture)
// renderOne:       draw one shape directly onto framebuffer —
//                  no clear so alpha strokes accumulate naturally
// ============================================================
function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (const s of g_shapesList) s.render();
}

function renderOne(s) {
  s.render();
}

// ============================================================
// Input
// ============================================================
function canvasCoords(ev) {
  const rect = canvas.getBoundingClientRect();
  const x =  ((ev.clientX - rect.left) / canvas.width)  * 2 - 1;
  const y = -((ev.clientY - rect.top)  / canvas.height) * 2 + 1;
  return [x, y];
}

function handleClick(ev) {
  const [x, y] = canvasCoords(ev);
  const dx = g_prevX !== null ? x - g_prevX : 0;
  const dy = g_prevY !== null ? y - g_prevY : 0;

  if (g_shape === 'paint') {
    // Gap-fill segment between last and current position
    if (g_prevX !== null) {
      const seg = new StrokeSegment(g_prevX, g_prevY, x, y, g_color, g_size);
      g_shapesList.push(seg);
      renderOne(seg);
    }
    const brush = new PaintBrush(x, y, g_color, g_size, dx, dy);
    g_shapesList.push(brush);
    renderOne(brush);

  } else if (g_shape === 'point') {
    const s = new Point(x, y, g_color, g_size);
    g_shapesList.push(s);
    renderOne(s);

  } else if (g_shape === 'triangle') {
    const r = g_size / 300;
    const s = new Triangle([x, y+r,  x-r, y-r,  x+r, y-r], g_color);
    g_shapesList.push(s);
    renderOne(s);

  } else if (g_shape === 'circle') {
    const s = new Circle(x, y, g_color, g_size, g_segments);
    g_shapesList.push(s);
    renderOne(s);
  }

  g_prevX = x; g_prevY = y;
}

function handleMouseMove(ev) {
  if (ev.buttons !== 1) return;
  handleClick(ev);
}

function handleMouseUp() {
  g_prevX = null; g_prevY = null;
}

// ============================================================
// UI
// ============================================================
function setShape(s) {
  g_shape = s;
  ['paint', 'point', 'triangle', 'circle'].forEach(id =>
    document.getElementById('btn_' + id).classList.toggle('active', s === id));
}

function updateColor() {
  const r = +document.getElementById('rSlider').value;
  const g = +document.getElementById('gSlider').value;
  const b = +document.getElementById('bSlider').value;
  const a = +document.getElementById('aSlider').value / 255;
  document.getElementById('rVal').textContent = r;
  document.getElementById('gVal').textContent = g;
  document.getElementById('bVal').textContent = b;
  document.getElementById('aVal').textContent = document.getElementById('aSlider').value;
  document.getElementById('colorBox').style.background = `rgba(${r},${g},${b},${a.toFixed(2)})`;
  g_color = [r/255, g/255, b/255, a];
}

function clearCanvas() {
  g_shapesList = [];
  g_prevX = null; g_prevY = null;
  renderAllShapes();
}

// ============================================================
// Draw Picture
// ============================================================
function drawPicture() {
  g_shapesList = [];
  function tri(x1,y1, x2,y2, x3,y3, r,g,b,a=1.0) {
    g_shapesList.push(new Triangle([x1,y1,x2,y2,x3,y3], [r,g,b,a]));
  }

  // Sky
  const sky = [[0.20,0.60,0.90],[0.15,0.50,0.85],[0.25,0.65,0.95],[0.10,0.45,0.80]];
  for (let i = 0; i < 8; i++) {
    const c = sky[i % sky.length], x = -1 + i * 0.25;
    tri(x,1.0, x+0.25,1.0, x,0.0, ...c);
    tri(x+0.25,1.0, x+0.25,0.0, x,0.0, ...c);
  }
  // Ground
  tri(-1,-1, 1,-1, -1,-0.05, 0.15,0.55,0.15);
  tri( 1,-1, 1,-0.05, -1,-0.05, 0.10,0.45,0.10);
  // Sun
  const sx=0.65, sy=0.70, sr=0.18;
  for (let i = 0; i < 12; i++) {
    const a1=2*Math.PI*i/12, a2=2*Math.PI*(i+1)/12;
    tri(sx,sy, sx+sr*Math.cos(a1),sy+sr*Math.sin(a1),
               sx+sr*Math.cos(a2),sy+sr*Math.sin(a2), 1.0,0.85,0.0);
  }
  // Sun glow (transparent)
  for (let i = 0; i < 12; i++) {
    const a1=2*Math.PI*i/12, a2=2*Math.PI*(i+1)/12, hr=sr*1.6;
    tri(sx,sy, sx+hr*Math.cos(a1),sy+hr*Math.sin(a1),
               sx+hr*Math.cos(a2),sy+hr*Math.sin(a2), 1.0,0.95,0.3, 0.25);
  }
  // Left mountain + snow + shadow
  tri(-0.9,-0.05, -0.45,0.55,  0.0,-0.05, 0.40,0.40,0.45);
  tri(-0.9,-0.05, -0.45,0.55, -1.0, 0.20, 0.35,0.35,0.40);
  tri(-0.55,0.40, -0.45,0.55, -0.35,0.40, 0.92,0.95,1.0);
  tri(-0.9,-0.05, -0.45,0.55, -1.0,0.20,  0.0,0.0,0.1, 0.18);
  // Right mountain + snow
  tri(0.10,-0.05, 0.55,0.65, 1.0,-0.05, 0.35,0.40,0.42);
  tri(0.45,0.50,  0.55,0.65, 0.65,0.50, 0.92,0.95,1.0);
  // Trees
  function tree(tx, ty) {
    tri(tx-0.02,ty-0.18, tx+0.02,ty-0.18, tx-0.02,ty, 0.55,0.27,0.07);
    tri(tx+0.02,ty-0.18, tx+0.02,ty,      tx-0.02,ty, 0.55,0.27,0.07);
    tri(tx-0.10,ty,      tx+0.10,ty,       tx,ty+0.20, 0.10,0.55,0.10);
    tri(tx-0.07,ty+0.12, tx+0.07,ty+0.12, tx,ty+0.28, 0.15,0.65,0.15);
    tri(tx-0.05,ty+0.22, tx+0.05,ty+0.22, tx,ty+0.35, 0.20,0.75,0.20);
  }
  tree(-0.28,-0.05);
  tree( 0.00,-0.05);
  // Letter Y
  tri(-0.82,0.35, -0.70,0.35, -0.62,0.15, 0.95,0.30,0.10);
  tri(-0.82,0.35, -0.62,0.15, -0.74,0.15, 0.95,0.30,0.10);
  tri(-0.58,0.35, -0.46,0.35, -0.62,0.15, 0.95,0.30,0.10);
  tri(-0.58,0.35, -0.62,0.15, -0.50,0.15, 0.95,0.30,0.10);
  tri(-0.68,0.15, -0.56,0.15, -0.68,-0.02, 0.95,0.30,0.10);
  tri(-0.56,0.15, -0.56,-0.02,-0.68,-0.02, 0.95,0.30,0.10);
  // Letter B
  const bx = 0.20;
  tri(bx,    0.35, bx+0.10,0.35, bx,    -0.02, 0.20,0.55,0.95);
  tri(bx+0.10,0.35, bx+0.10,-0.02, bx, -0.02, 0.20,0.55,0.95);
  tri(bx+0.10,0.35, bx+0.35,0.30, bx+0.10,0.17, 0.20,0.55,0.95);
  tri(bx+0.35,0.30, bx+0.35,0.17, bx+0.10,0.17, 0.20,0.55,0.95);
  tri(bx+0.10,0.17, bx+0.38,0.12, bx+0.10,-0.02, 0.20,0.55,0.95);
  tri(bx+0.38,0.12, bx+0.38,-0.02, bx+0.10,-0.02, 0.20,0.55,0.95);

  renderAllShapes();
}

// ============================================================
// Shader helpers
// ============================================================
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

// ============================================================
// Main
// ============================================================
function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;
  canvas.onmousedown  = handleClick;
  canvas.onmousemove  = handleMouseMove;
  canvas.onmouseup    = handleMouseUp;
  canvas.onmouseleave = handleMouseUp;
  renderAllShapes();
}

window.onload = main;
