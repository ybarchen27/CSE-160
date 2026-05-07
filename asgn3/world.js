// world.js – Main WebGL application for Assignment 3: Creating a Virtual World
// Requires: cuon-utils.js, cuon-matrix.js, camera.js

// ═══════════════════════════════════════════════════════════════════
//  SHADERS
// ═══════════════════════════════════════════════════════════════════

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_TexCoord;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  varying vec2 v_TexCoord;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_TexCoord  = a_TexCoord;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform sampler2D u_Sampler0;   // texture 0 – wall/brick
  uniform sampler2D u_Sampler1;   // texture 1 – ground/grass
  uniform sampler2D u_Sampler2;   // texture 2 – sky
  uniform int   u_TexIndex;       // which texture to use (-1 = solid color)
  uniform vec4  u_BaseColor;      // solid base color
  uniform float u_TexColorWeight; // 0=solid, 1=texture
  varying vec2 v_TexCoord;
  void main() {
    vec4 texColor;
    if (u_TexIndex == 0)      texColor = texture2D(u_Sampler0, v_TexCoord);
    else if (u_TexIndex == 1) texColor = texture2D(u_Sampler1, v_TexCoord);
    else                      texColor = texture2D(u_Sampler2, v_TexCoord);
    gl_FragColor = (1.0 - u_TexColorWeight) * u_BaseColor + u_TexColorWeight * texColor;
  }
`;

// ═══════════════════════════════════════════════════════════════════
//  32×32 WORLD MAP  (values = wall height: 0=empty, 1-4=wall height)
// ═══════════════════════════════════════════════════════════════════

// prettier-ignore
const g_map = [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,2,2,2,2,0,0,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,2,0,0,2,0,0,0,3,0,3,0,0,0,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,2,0,0,2,0,0,0,3,0,3,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,2,0,0,0,0,0,0,3,3,3,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,2,2,2,2,0,0,0,0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
];

// ═══════════════════════════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════════════════════════

let gl, canvas;
let a_Position, a_TexCoord;
let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_Sampler0, u_Sampler1, u_Sampler2;
let u_TexIndex, u_BaseColor, u_TexColorWeight;
let cubeVertexBuffer, cubeTexCoordBuffer, cubeIndexBuffer;
let camera;
let keys = {};
let textures = [null, null, null]; // loaded WebGL texture objects
let texturesLoaded = 0;
const TOTAL_TEXTURES = 3;

// ═══════════════════════════════════════════════════════════════════
//  CUBE GEOMETRY  (unit cube centred at origin)
// ═══════════════════════════════════════════════════════════════════

// 24 unique vertices (4 per face × 6 faces) for per-face UVs
// Layout per face: bottom-left, bottom-right, top-right, top-left
const CUBE_VERTS = new Float32Array([
  // +X face (right)
   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,   0.5, 0.5, 0.5,   0.5, 0.5,-0.5,
  // -X face (left)
  -0.5,-0.5, 0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5,
  // +Y face (top)
  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5,   0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,
  // -Y face (bottom)
  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,
  // +Z face (front)
  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5,   0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,
  // -Z face (back)
   0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5,
]);

const CUBE_TEXCOORDS = new Float32Array([
  0,0, 1,0, 1,1, 0,1,  // +X
  0,0, 1,0, 1,1, 0,1,  // -X
  0,0, 1,0, 1,1, 0,1,  // +Y
  0,0, 1,0, 1,1, 0,1,  // -Y
  0,0, 1,0, 1,1, 0,1,  // +Z
  0,0, 1,0, 1,1, 0,1,  // -Z
]);

// 6 faces × 2 triangles × 3 indices
const CUBE_INDICES = new Uint16Array([
   0, 1, 2,  0, 2, 3,   // +X
   4, 5, 6,  4, 6, 7,   // -X
   8, 9,10,  8,10,11,   // +Y
  12,13,14, 12,14,15,   // -Y
  16,17,18, 16,18,19,   // +Z
  20,21,22, 20,22,23,   // -Z
]);

// ═══════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════

function main() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas);
  if (!gl) { alert('WebGL unavailable'); return; }

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    alert('Shader init failed'); return;
  }

  // Attribute / uniform locations
  a_Position        = gl.getAttribLocation(gl.program,  'a_Position');
  a_TexCoord        = gl.getAttribLocation(gl.program,  'a_TexCoord');
  u_ModelMatrix      = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix       = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Sampler0        = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1        = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_Sampler2        = gl.getUniformLocation(gl.program, 'u_Sampler2');
  u_TexIndex        = gl.getUniformLocation(gl.program, 'u_TexIndex');
  u_BaseColor       = gl.getUniformLocation(gl.program, 'u_BaseColor');
  u_TexColorWeight  = gl.getUniformLocation(gl.program, 'u_TexColorWeight');

  initCubeBuffers();
  initTextures();
  setupEventListeners();

  camera = new Camera();
  // Reposition camera to centre of map
  camera.eye.elements[0] = 16;
  camera.eye.elements[1] = 1.5;
  camera.eye.elements[2] = 16;
  camera.at.elements[0]  = 16;
  camera.at.elements[1]  = 1.5;
  camera.at.elements[2]  = 15;
  camera._updateView();

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.53, 0.81, 0.98, 1.0);

  requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════════
//  BUFFERS
// ═══════════════════════════════════════════════════════════════════

function initCubeBuffers() {
  cubeVertexBuffer   = gl.createBuffer();
  cubeTexCoordBuffer = gl.createBuffer();
  cubeIndexBuffer    = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTS, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_TEXCOORDS, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CUBE_INDICES, gl.STATIC_DRAW);
}

// ═══════════════════════════════════════════════════════════════════
//  TEXTURES
// ═══════════════════════════════════════════════════════════════════

function initTextures() {
  // We'll create procedural textures using Canvas 2D so no image files are needed.
  textures[0] = createProceduralTexture(makeBrickPattern,  128); // wall
  textures[1] = createProceduralTexture(makeGrassPattern,  128); // ground
  textures[2] = createProceduralTexture(makeSkyPattern,    128); // sky

  // Bind sampler uniforms
  gl.uniform1i(u_Sampler0, 0);
  gl.uniform1i(u_Sampler1, 1);
  gl.uniform1i(u_Sampler2, 2);

  // Activate all three texture units
  for (let i = 0; i < 3; i++) {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, textures[i]);
  }
}

function createProceduralTexture(drawFn, size) {
  const offscreen = document.createElement('canvas');
  offscreen.width = offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  drawFn(ctx, size);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

// ── Procedural texture draw functions ────────────────────────────

function makeBrickPattern(ctx, s) {
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, 0, s, s);
  const bw = s / 4, bh = s / 8;
  ctx.fillStyle = '#CD853F';
  for (let row = 0; row < s / bh; row++) {
    const offset = (row % 2) * bw * 0.5;
    for (let col = -1; col < s / bw + 1; col++) {
      const x = col * bw + offset;
      const y = row * bh;
      ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    }
  }
}

function makeGrassPattern(ctx, s) {
  ctx.fillStyle = '#4a7c3f';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#3a6b30';
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    const r = 3 + Math.random() * 8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#5a8c50';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    ctx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
}

function makeSkyPattern(ctx, s) {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0,   '#1a6bb5');
  grad.addColorStop(0.6, '#87ceeb');
  grad.addColorStop(1,   '#cce8ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 5; i++) {
    const cx = Math.random() * s, cy = Math.random() * s * 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, 8 + Math.random() * 14, 0, Math.PI * 2); ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DRAW HELPERS
// ═══════════════════════════════════════════════════════════════════

const modelMatrix = new Matrix4();

function drawCube(tx, ty, tz, sx, sy, sz, texIndex, color) {
  modelMatrix.setIdentity();
  modelMatrix.translate(tx, ty, tz);
  modelMatrix.scale(sx, sy, sz);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

  if (texIndex >= 0) {
    gl.uniform1i(u_TexIndex, texIndex);
    gl.uniform1f(u_TexColorWeight, 1.0);
  } else {
    gl.uniform1i(u_TexIndex, 0);
    gl.uniform1f(u_TexColorWeight, 0.0);
    gl.uniform4fv(u_BaseColor, color);
  }

  // Bind vertex positions
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  // Bind tex coords
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexCoordBuffer);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_TexCoord);

  // Draw
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

// ═══════════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════════

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Upload view & projection
  gl.uniformMatrix4fv(u_ViewMatrix,       false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  // ── Sky box (giant cube, solid blue-ish) ─────────────────────
  drawCube(16, 0, 16, 900, 900, 900, 2, null);

  // ── Ground (large flat cube) ──────────────────────────────────
  drawCube(16, -0.5, 16, 32, 0.1, 32, 1, null);

  // ── World walls from map ──────────────────────────────────────
  for (let x = 0; x < 32; x++) {
    for (let z = 0; z < 32; z++) {
      const h = g_map[z][x];
      if (h === 0) continue;
      for (let y = 0; y < h; y++) {
        drawCube(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, 0, null);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════════

function tick() {
  handleKeys();
  renderScene();
  requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════════════════

function setupEventListeners() {
  document.addEventListener('keydown', e => { keys[e.code] = true;  handleSpecialKeys(e); });
  document.addEventListener('keyup',   e => { keys[e.code] = false; });

  // Pointer lock for mouse look
  canvas.addEventListener('click', () => canvas.requestPointerLock());
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    document.getElementById('hud').textContent =
      locked ? 'Mouse captured – press Esc to release' : 'Virtual World Explorer | Click canvas to capture mouse';
  });
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
      camera.mouseLook(e.movementX, e.movementY);
    }
  });
}

function handleKeys() {
  if (keys['KeyW'] || keys['ArrowUp'])    camera.moveForward();
  if (keys['KeyS'] || keys['ArrowDown'])  camera.moveBackwards();
  if (keys['KeyA'] || keys['ArrowLeft'])  camera.moveLeft();
  if (keys['KeyD'] || keys['ArrowRight']) camera.moveRight();
  if (keys['KeyQ']) camera.panLeft();
  if (keys['KeyE']) camera.panRight();
}

function handleSpecialKeys(e) {
  // F = add block in front, G = delete block in front
  if (e.code === 'KeyF') modifyBlock(true);
  if (e.code === 'KeyG') modifyBlock(false);
}

// Find the map cell directly in front of camera and add/remove a block
function modifyBlock(add) {
  const f = camera._forward();
  const ex = camera.eye.elements[0];
  const ez = camera.eye.elements[2];
  // Step 1 unit forward
  const tx = Math.floor(ex + f.elements[0]);
  const tz = Math.floor(ez + f.elements[2]);
  if (tx < 0 || tx >= 32 || tz < 0 || tz >= 32) return;
  if (add) {
    if (g_map[tz][tx] < 4) g_map[tz][tx]++;
  } else {
    if (g_map[tz][tx] > 0) g_map[tz][tx]--;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

window.onload = main;
