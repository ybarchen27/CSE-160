// ============================================================
// CSE 160 – Assignment 1: Painting  (Awesome Edition)
// asgn1.js
//
// Awesome features:
//  1. Paint brush – splat of alpha-blended circles that looks like real paint
//  2. Brush aligned to stroke direction (rotated oval stamp)
//  3. Gap-filling with GL_LINES between mouse samples
//  4. Alpha slider for transparent / watercolour paint
// ============================================================

// ---- Shaders ----
// Vertex shader passes tex-coord so the fragment shader can
// compute a soft circular falloff for the paint splat.
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
    // Soft circular falloff using gl_PointCoord (only active for GL_POINTS)
    vec2 pc = gl_PointCoord - vec2(0.5);
    float dist = length(pc);
    if (dist > 0.5) discard;
    // Smooth edge: full opacity at centre, fades to 0 at edge
    float alpha = smoothstep(0.5, 0.15, dist);
    gl_FragColor = vec4(u_FragColor.rgb, u_FragColor.a * alpha);
  }
`;

// ---- Globals ----
let gl, canvas;
let a_Position, u_FragColor, u_PointSize;

let g_shapesList = [];
let g_shape    = 'point';
let g_color    = [1.0, 0.0, 0.0, 1.0];  // rgba
let g_size     = 10;
let g_segments = 10;
let g_alpha    = 1.0;

// For gap-filling: remember where the last stroke position was
let g_lastX = null;
let g_lastY = null;

// ============================================================
// WebGL Setup
// ============================================================
function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) { alert('WebGL not supported'); return false; }

  // Enable alpha blending so transparent paint layers properly
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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

// ---- Paint Brush ----
// Draws a cluster of soft alpha-blended splat points that look like
// a real paint dab. The cluster is stretched and rotated along the
// stroke direction (dx,dy) so it aligns with the stroke.
class PaintBrush {
  constructor(x, y, color, size, dx, dy) {
    this.x = x; this.y = y;
    this.color = color.slice(); this.size = size;
    // Normalise direction; default to vertical if no motion
    const len = Math.sqrt(dx*dx + dy*dy);
    this.dx = len > 0 ? dx/len : 0;
    this.dy = len > 0 ? dy/len : 1;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);

    const r  = this.size / 400;   // base radius in clip-space
    const dx = this.dx, dy = this.dy;
    // Perpendicular to stroke direction
    const px = -dy, py = dx;

    // Scatter several soft points; stretch along stroke (×1.8), squash perp (×0.5)
    const offsets = [
      [0,      0    ],
      [ 0.6,   0    ],
      [-0.6,   0    ],
      [ 0.3,   0.3  ],
      [-0.3,  -0.3  ],
      [ 0.9,  -0.1  ],
      [-0.9,   0.1  ],
    ];

    const splatSize = this.size * 0.75;
    gl.uniform1f(u_PointSize, splatSize);

    for (const [along, perp] of offsets) {
      const ox = dx * along * r * 1.8 + px * perp * r * 0.5;
      const oy = dy * along * r * 1.8 + py * perp * r * 0.5;
      bufferAndDraw([this.x + ox, this.y + oy], gl.POINTS, 1);
    }
  }
}

// ---- Stroke Segment ----
// Draws a thick filled line between two points using a rectangle
// (two triangles) aligned along the stroke, with rounded caps via circles.
// This fills gaps between mouse samples.
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
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1e-6) return;

    const r = this.size / 400;
    // Perpendicular unit vector
    const px = -dy/len * r, py = dx/len * r;

    // Rectangle: two triangles forming a capsule body
    const verts = [
      this.x1 + px, this.y1 + py,
      this.x1 - px, this.y1 - py,
      this.x2 + px, this.y2 + py,
      this.x1 - px, this.y1 - py,
      this.x2 - px, this.y2 - py,
      this.x2 + px, this.y2 + py,
    ];
    bufferAndDraw(verts, gl.TRIANGLES, 6);

    // Rounded caps using GL_POINTS (soft circle from fragment shader)
    bufferAndDraw([this.x1, this.y1], gl.POINTS, 1);
    bufferAndDraw([this.x2, this.y2], gl.POINTS, 1);
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
      const a1 = (2*Math.PI*i)      /this.segments;
      const a2 = (2*Math.PI*(i+1))  /this.segments;
      verts.push(this.x, this.y);
      verts.push(this.x + r*Math.cos(a1), this.y + r*Math.sin(a1));
      verts.push(this.x + r*Math.cos(a2), this.y + r*Math.sin(a2));
    }
    bufferAndDraw(verts, gl.TRIANGLES, this.segments * 3);
  }
}

// ============================================================
// Shared buffer helper
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
// Render
// ============================================================
function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (const s of g_shapesList) s.render();
}

// ============================================================
// Input Handling
// ============================================================
function canvasCoords(ev) {
  const rect = canvas.getBoundingClientRect();
  const x =  ((ev.clientX - rect.left) / canvas.width)  * 2 - 1;
  const y = -((ev.clientY - rect.top)  / canvas.height) * 2 + 1;
  return [x, y];
}

function addShapeAt(x, y, dx, dy) {
  if (g_shape === 'paint') {
    // Gap-fill: if we moved far enough, insert a StrokeSegment first
    if (g_lastX !== null) {
      const dist = Math.sqrt((x-g_lastX)**2 + (y-g_lastY)**2);
      if (dist > 0.001) {
        g_shapesList.push(new StrokeSegment(g_lastX, g_lastY, x, y, g_color, g_size));
      }
    }
    g_shapesList.push(new PaintBrush(x, y, g_color, g_size, dx, dy));
    g_lastX = x; g_lastY = y;

  } else if (g_shape === 'point') {
    g_shapesList.push(new Point(x, y, g_color, g_size));

  } else if (g_shape === 'triangle') {
    const s = g_size / 300;
    g_shapesList.push(new Triangle(
      [x, y+s,  x-s, y-s,  x+s, y-s], g_color));

  } else if (g_shape === 'circle') {
    g_shapesList.push(new Circle(x, y, g_color, g_size, g_segments));
  }
}

let g_prevX = null, g_prevY = null;

function handleClick(ev) {
  const [x, y] = canvasCoords(ev);
  const dx = g_prevX !== null ? x - g_prevX : 0;
  const dy = g_prevY !== null ? y - g_prevY : 0;
  addShapeAt(x, y, dx, dy);
  g_prevX = x; g_prevY = y;
  renderAllShapes();
}

function handleMouseMove(ev) {
  if (ev.buttons !== 1) return;
  handleClick(ev);
}

function handleMouseUp() {
  // Reset stroke tracking when the mouse is released
  g_lastX = null; g_lastY = null;
  g_prevX = null; g_prevY = null;
}

// ============================================================
// UI Helpers
// ============================================================
function setShape(s) {
  g_shape = s;
  ['paint','point','triangle','circle'].forEach(id => {
    document.getElementById('btn_' + id).classList.toggle('active', s === id);
  });
}

function updateColor() {
  const r = +document.getElementById('rSlider').value;
  const g = +document.getElementById('gSlider').value;
  const b = +document.getElementById('bSlider').value;
  g_alpha  = +document.getElementById('aSlider').value / 255;
  document.getElementById('rVal').textContent = r;
  document.getElementById('gVal').textContent = g;
  document.getElementById('bVal').textContent = b;
  document.getElementById('aVal').textContent = document.getElementById('aSlider').value;
  const preview = `rgba(${r},${g},${b},${g_alpha.toFixed(2)})`;
  document.getElementById('colorBox').style.background = preview;
  g_color = [r/255, g/255, b/255, g_alpha];
}

function clearCanvas() {
  g_shapesList = [];
  g_lastX = null; g_lastY = null;
  g_prevX = null; g_prevY = null;
  renderAllShapes();
}

// ============================================================
// Draw Picture – full landscape with initials "YB"
// ============================================================
function drawPicture() {
  g_shapesList = [];
  function tri(x1,y1, x2,y2, x3,y3, r,g,b,a=1.0) {
    g_shapesList.push(new Triangle([x1,y1, x2,y2, x3,y3], [r,g,b,a]));
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
  // Sun glow – semi-transparent halo
  for (let i=0; i<12; i++) {
    const a1=(2*Math.PI*i)/12, a2=(2*Math.PI*(i+1))/12;
    const hr=sr*1.6;
    tri(sx,sy, sx+hr*Math.cos(a1),sy+hr*Math.sin(a1),
               sx+hr*Math.cos(a2),sy+hr*Math.sin(a2), 1.0,0.95,0.3, 0.25);
  }

  // Left mountain + snow cap
  tri(-0.9,-0.05, -0.45,0.55,  0.0,-0.05, 0.40,0.40,0.45);
  tri(-0.9,-0.05, -0.45,0.55, -1.0, 0.20, 0.35,0.35,0.40);
  tri(-0.55,0.40, -0.45,0.55, -0.35,0.40, 0.92,0.95,1.0);
  // Shadow on mountain – translucent dark overlay
  tri(-0.9,-0.05, -0.45,0.55, -1.0,0.20,  0.0,0.0,0.1, 0.18);

  // Right mountain + snow cap
  tri(0.10,-0.05, 0.55,0.65, 1.0,-0.05,  0.35,0.40,0.42);
  tri(0.45,0.50,  0.55,0.65, 0.65,0.50,  0.92,0.95,1.0);

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

  // Letter Y (red-orange)
  tri(-0.82,0.35, -0.70,0.35, -0.62,0.15, 0.95,0.30,0.10);
  tri(-0.82,0.35, -0.62,0.15, -0.74,0.15, 0.95,0.30,0.10);
  tri(-0.58,0.35, -0.46,0.35, -0.62,0.15, 0.95,0.30,0.10);
  tri(-0.58,0.35, -0.62,0.15, -0.50,0.15, 0.95,0.30,0.10);
  tri(-0.68,0.15, -0.56,0.15, -0.68,-0.02, 0.95,0.30,0.10);
  tri(-0.56,0.15, -0.56,-0.02,-0.68,-0.02, 0.95,0.30,0.10);

  // Letter B (blue)
  const bx=0.20;
  tri(bx,    0.35, bx+0.10,0.35, bx,    -0.02, 0.20,0.55,0.95);
  tri(bx+0.10,0.35, bx+0.10,-0.02, bx, -0.02, 0.20,0.55,0.95);
  tri(bx+0.10,0.35, bx+0.35,0.30, bx+0.10,0.17, 0.20,0.55,0.95);
  tri(bx+0.35,0.30, bx+0.35,0.17, bx+0.10,0.17, 0.20,0.55,0.95);
  tri(bx+0.10,0.17, bx+0.38,0.12, bx+0.10,-0.02, 0.20,0.55,0.95);
  tri(bx+0.38,0.12, bx+0.38,-0.02, bx+0.10,-0.02, 0.20,0.55,0.95);

  renderAllShapes();
}

// ============================================================
// Shader Init
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

// ============================================================
// Main
// ============================================================
function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;
  canvas.onmousedown = handleClick;
  canvas.onmousemove = handleMouseMove;
  canvas.onmouseup   = handleMouseUp;
  canvas.onmouseleave = handleMouseUp;
  renderAllShapes();
}

window.onload = main;
