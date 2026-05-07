// camera.js – Camera class for Assignment 3
// Requires cuon-matrix.js (Matrix4, Vector3)

class Camera {
  constructor() {
    this.fov = 60;
    this.eye = new Vector3([0, 1.5, 5]);   // start position
    this.at  = new Vector3([0, 1.5, 4]);   // look target (one unit in front)
    this.up  = new Vector3([0, 1, 0]);

    this.viewMatrix       = new Matrix4();
    this.projectionMatrix = new Matrix4();

    this._updateView();
    this._updateProjection();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _updateView() {
    const e = this.eye.elements;
    const a = this.at.elements;
    const u = this.up.elements;
    this.viewMatrix.setLookAt(
      e[0], e[1], e[2],
      a[0], a[1], a[2],
      u[0], u[1], u[2]
    );
  }

  _updateProjection() {
    const canvas = document.getElementById('webgl');
    this.projectionMatrix.setPerspective(
      this.fov,
      canvas.width / canvas.height,
      0.1,
      1000
    );
  }

  // Returns the normalised forward vector (at - eye)
  _forward() {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.normalize();
    return f;
  }

  // Returns the normalised right vector (forward × up)
  _right() {
    let f = this._forward();
    let r = Vector3.cross(f, this.up);
    r.normalize();
    return r;
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  moveForward(speed = 0.15) {
    let f = this._forward();
    f.mul(speed);
    this.eye.add(f);
    this.at.add(f);
    this._updateView();
  }

  moveBackwards(speed = 0.15) {
    let f = this._forward();
    f.mul(-speed);
    this.eye.add(f);
    this.at.add(f);
    this._updateView();
  }

  moveLeft(speed = 0.15) {
    let s = this._right();
    s.mul(-speed);
    this.eye.add(s);
    this.at.add(s);
    this._updateView();
  }

  moveRight(speed = 0.15) {
    let s = this._right();
    s.mul(speed);
    this.eye.add(s);
    this.at.add(s);
    this._updateView();
  }

  // ── Rotation ──────────────────────────────────────────────────────────────

  panLeft(alpha = 3) {
    let f = this._forward();
    let rot = new Matrix4();
    const u = this.up.elements;
    rot.setRotate(alpha, u[0], u[1], u[2]);
    let fp = rot.multiplyVector3(f);
    let e = this.eye.elements;
    this.at.elements[0] = e[0] + fp.elements[0];
    this.at.elements[1] = e[1] + fp.elements[1];
    this.at.elements[2] = e[2] + fp.elements[2];
    this._updateView();
  }

  panRight(alpha = 3) {
    this.panLeft(-alpha);
  }

  // Mouse-based look: dx = horizontal delta, dy = vertical delta (pixels)
  mouseLook(dx, dy) {
    const sensitivity = 0.2;
    this.panLeft(-dx * sensitivity);

    // Vertical look (pitch) — rotate around the right axis
    let f = this._forward();
    let r = this._right();
    let rot = new Matrix4();
    rot.setRotate(-dy * sensitivity, r.elements[0], r.elements[1], r.elements[2]);
    let fp = rot.multiplyVector3(f);
    fp.normalize();

    // Clamp so we don't flip upside-down
    const dot = fp.elements[1]; // y component (≈ sin(pitch))
    if (dot > 0.98 || dot < -0.98) return; // skip extreme angles

    let e = this.eye.elements;
    this.at.elements[0] = e[0] + fp.elements[0];
    this.at.elements[1] = e[1] + fp.elements[1];
    this.at.elements[2] = e[2] + fp.elements[2];
    this._updateView();
  }
}
