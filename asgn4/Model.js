// Model.js — OBJ loader for Assignment 4 (Lighting)
// Usage:
//   const model = new Model(gl, program);
//   model.loadOBJ(objText);        // parse OBJ string
//   model.initBuffers();           // upload to GPU
//   model.draw(modelMatrix);       // render with current program uniforms

class Model {
  /**
   * @param {WebGLRenderingContext} gl
   * @param {WebGLProgram} program   – must have a_Pos, a_Normal, a_UV bound
   */
  constructor(gl, program) {
    this.gl = gl;
    this.program = program;

    // Raw geometry arrays (built from OBJ parsing)
    this.positions = [];   // Float32Array  — 3 floats per vertex
    this.normals   = [];   // Float32Array  — 3 floats per vertex
    this.uvs       = [];   // Float32Array  — 2 floats per vertex
    this.indices   = [];   // Uint16Array / Uint32Array

    // WebGL buffer handles
    this.posBuffer  = null;
    this.normBuffer = null;
    this.uvBuffer   = null;
    this.idxBuffer  = null;

    this.vertexCount = 0;
    this.ready = false;
  }

  // ─────────────────────────────────────────────
  // Parse an OBJ file string into flat vertex arrays
  // Handles triangulated and quad faces (v, v/vt, v//vn, v/vt/vn)
  // ─────────────────────────────────────────────
  loadOBJ(text) {
    const rawPos  = [[0, 0, 0]]; // 1-indexed so pad index 0
    const rawNorm = [[0, 0, 0]];
    const rawUV   = [[0, 0]];

    const positions = [];
    const normals   = [];
    const uvs       = [];

    const vertCache = {};   // "pi/ui/ni" → index in flat arrays
    const indices   = [];

    let nextIdx = 0;

    const getOrAdd = (pi, ui, ni) => {
      const key = `${pi}/${ui}/${ni}`;
      if (key in vertCache) return vertCache[key];

      const idx = nextIdx++;
      vertCache[key] = idx;

      const p = rawPos[pi]  || [0, 0, 0];
      const n = rawNorm[ni] || [0, 0, 0];
      const u = rawUV[ui]   || [0, 0];

      positions.push(p[0], p[1], p[2]);
      normals.push(n[0], n[1], n[2]);
      uvs.push(u[0], u[1]);

      return idx;
    };

    const lines = text.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line[0] === '#') continue;

      const parts = line.split(/\s+/);
      const cmd = parts[0];

      if (cmd === 'v') {
        rawPos.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (cmd === 'vn') {
        rawNorm.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (cmd === 'vt') {
        rawUV.push([parseFloat(parts[1]), parseFloat(parts[2] || '0')]);
      } else if (cmd === 'f') {
        // Collect polygon vertices
        const faceVerts = [];
        for (let i = 1; i < parts.length; i++) {
          const tok = parts[i].split('/');
          const pi = parseInt(tok[0]) || 0;
          const ui = parseInt(tok[1]) || 0;
          const ni = parseInt(tok[2]) || 0;
          faceVerts.push(getOrAdd(pi, ui, ni));
        }
        // Fan triangulation for quads / n-gons
        for (let i = 1; i < faceVerts.length - 1; i++) {
          indices.push(faceVerts[0], faceVerts[i], faceVerts[i + 1]);
        }
      }
    }

    // If no normals in file, compute flat normals from triangles
    const hasNormals = rawNorm.length > 1;
    if (!hasNormals) {
      this._computeFlatNormals(positions, indices, normals);
    }

    this.positions   = new Float32Array(positions);
    this.normals     = new Float32Array(normals);
    this.uvs         = new Float32Array(uvs);

    // Use Uint32Array for large models, fall back to Uint16Array
    this.indices = indices.length <= 65535
      ? new Uint16Array(indices)
      : new Uint32Array(indices);

    this.vertexCount = indices.length;

    console.log(`[Model] Loaded OBJ: ${nextIdx} unique vertices, ${indices.length / 3 | 0} triangles`);
  }

  // ─────────────────────────────────────────────
  // Compute flat normals when OBJ has none
  // ─────────────────────────────────────────────
  _computeFlatNormals(positions, indices, normals) {
    // Zero out normals array (same length as positions)
    for (let i = 0; i < positions.length; i++) normals[i] = 0;

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i]     * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const ax = positions[i1]     - positions[i0];
      const ay = positions[i1 + 1] - positions[i0 + 1];
      const az = positions[i1 + 2] - positions[i0 + 2];

      const bx = positions[i2]     - positions[i0];
      const by = positions[i2 + 1] - positions[i0 + 1];
      const bz = positions[i2 + 2] - positions[i0 + 2];

      // cross product
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;

      for (const vi of [i0, i1, i2]) {
        normals[vi]     += nx;
        normals[vi + 1] += ny;
        normals[vi + 2] += nz;
      }
    }

    // Normalize
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
      normals[i]     /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    }
  }

  // ─────────────────────────────────────────────
  // Upload geometry to GPU
  // ─────────────────────────────────────────────
  initBuffers() {
    const gl = this.gl;

    this.posBuffer  = gl.createBuffer();
    this.normBuffer = gl.createBuffer();
    this.uvBuffer   = gl.createBuffer();
    this.idxBuffer  = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);

    const idxType = this.indices instanceof Uint32Array
      ? gl.UNSIGNED_INT
      : gl.UNSIGNED_SHORT;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    // Store index type for drawElements call
    this._idxType = idxType;

    this.ready = true;
    console.log('[Model] Buffers initialized.');
  }

  // ─────────────────────────────────────────────
  // Draw the model
  //   modelMatrix  — Matrix4 (your existing class)
  //   uniforms     — object with WebGL uniform locations:
  //     { uM, aPos, aNormal, aUV, uTI, uW, uCol }
  //   textureIndex — which texture slot to use (default 0)
  // ─────────────────────────────────────────────
  draw(modelMatrix, uniforms, textureIndex = 0) {
    if (!this.ready) return;
    const gl = this.gl;

    // Model matrix
    if (uniforms.uM) {
      gl.uniformMatrix4fv(uniforms.uM, false, modelMatrix.elements);
    }

    // Normal matrix = transpose(inverse(modelMatrix))
    // For rigid transforms (rotation + translation only) it equals the model matrix.
    // We compute it properly here so non-uniform scaling works too.
    if (uniforms.uNormalMatrix) {
      const nm = this._normalMatrix(modelMatrix.elements);
      gl.uniformMatrix3fv(uniforms.uNormalMatrix, false, nm);
    }

    // Texture / color blend
    if (uniforms.uTI !== undefined) gl.uniform1i(uniforms.uTI, textureIndex);
    if (uniforms.uW  !== undefined) gl.uniform1f(uniforms.uW, 1.0);

    // Bind position buffer
    if (uniforms.aPos !== undefined && uniforms.aPos >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.vertexAttribPointer(uniforms.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(uniforms.aPos);
    }

    // Bind normal buffer
    if (uniforms.aNormal !== undefined && uniforms.aNormal >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuffer);
      gl.vertexAttribPointer(uniforms.aNormal, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(uniforms.aNormal);
    }

    // Bind UV buffer
    if (uniforms.aUV !== undefined && uniforms.aUV >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.vertexAttribPointer(uniforms.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(uniforms.aUV);
    }

    // Draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuffer);
    gl.drawElements(gl.TRIANGLES, this.vertexCount, this._idxType, 0);
  }

  // ─────────────────────────────────────────────
  // Compute 3x3 normal matrix (column-major Float32Array)
  // = transpose of inverse of upper-left 3x3 of model matrix
  // ─────────────────────────────────────────────
  _normalMatrix(m) {
    // Extract upper-left 3x3 (column-major)
    const a00=m[0],a01=m[1],a02=m[2];
    const a10=m[4],a11=m[5],a12=m[6];
    const a20=m[8],a21=m[9],a22=m[10];

    // Determinant
    const det = a00*(a11*a22-a12*a21)
              - a10*(a01*a22-a02*a21)
              + a20*(a01*a12-a02*a11);
    const invDet = det ? 1/det : 0;

    // Inverse then transpose = adjugate / det
    return new Float32Array([
      (a11*a22-a12*a21)*invDet, (a20*a12-a10*a22)*invDet, (a10*a21-a20*a11)*invDet,
      (a21*a02-a01*a22)*invDet, (a00*a22-a20*a02)*invDet, (a20*a01-a00*a21)*invDet,
      (a01*a12-a11*a02)*invDet, (a10*a02-a00*a12)*invDet, (a00*a11-a10*a01)*invDet,
    ]);
  }

  // ─────────────────────────────────────────────
  // Convenience: load OBJ from a URL (async)
  // ─────────────────────────────────────────────
  async loadFromURL(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Model.loadFromURL: failed to fetch ${url} (${res.status})`);
    const text = await res.text();
    this.loadOBJ(text);
    this.initBuffers();
  }

  // ─────────────────────────────────────────────
  // Dispose GPU resources
  // ─────────────────────────────────────────────
  dispose() {
    const gl = this.gl;
    if (this.posBuffer)  gl.deleteBuffer(this.posBuffer);
    if (this.normBuffer) gl.deleteBuffer(this.normBuffer);
    if (this.uvBuffer)   gl.deleteBuffer(this.uvBuffer);
    if (this.idxBuffer)  gl.deleteBuffer(this.idxBuffer);
    this.ready = false;
  }
}
