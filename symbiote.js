/* ==========================================================================
   symbiote.js
   A small, dependency-free WebGL2 renderer that draws glossy, wet-looking,
   living "symbiote" tendrils. Tendrils are simulated in JS (inverse-kinematic
   chains with organic undulation) and rendered in a fragment shader as a
   smooth-unioned signed-distance field, shaded as a 3D surface with specular
   highlights, environment reflections, fresnel rim light and a cast shadow.

   Exposes: window.Symbiote = { intro(opts), contact(opts), supported() }
   ========================================================================== */
(function (global) {
  'use strict';

  const MAXG = 40;    // max culling groups
  const MAXPER = 16;  // max segments per group
  const TAU = Math.PI * 2;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------------- shaders */

  const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  function fragSource(MAXS) {
    return `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;

uniform vec2  uRes;
uniform vec4  uSeg[${MAXS}];
uniform vec2  uRad[${MAXS}];
uniform vec4  uGrp[${MAXG}];
uniform ivec2 uRng[${MAXG}];
uniform int   uGroups;
uniform float uK;
uniform float uTime;
uniform vec3  uLight;
uniform float uLightPow;
uniform float uEnv;
uniform float uErode;
uniform float uShadow;
uniform vec2  uShadowOff;
uniform float uWobble;
uniform float uDetail;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.31) * 0.3 + vnoise(p * 4.11 - 3.17) * 0.15;
}
float ridge(vec2 q) {
  float f = fbm(q);
  return pow(1.0 - abs(f * 2.0 - 1.0), 6.0);
}

// tapered capsule
float sdTC(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float field(vec2 p) {
  float d = 1e4;
  for (int g = 0; g < ${MAXG}; g++) {
    if (g >= uGroups) break;
    vec4 gb = uGrp[g];
    if (length(p - gb.xy) - gb.z > d + uK) continue;   // group cannot affect the union
    ivec2 r = uRng[g];
    for (int j = 0; j < ${MAXPER}; j++) {
      if (j >= r.y) break;
      int i = r.x + j;
      vec4 s = uSeg[i];
      vec2 rr = uRad[i];
      d = smin(d, sdTC(p, s.xy, s.zw, rr.x, rr.y), uK);
    }
  }
  return d;
}

float surf(vec2 p) {
  float d = field(p);
  if (d < 40.0) {
    float t = uTime;
    d += (fbm(p * 0.021 + vec2(t * 0.23, -t * 0.17)) - 0.5) * uWobble;
    if (uErode > 0.0) d += uErode * (0.35 + fbm(p * 0.011 + vec2(t * 0.07))) * 140.0;
  }
  return d;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float d = surf(p);

  // soft cast shadow (for light page backgrounds)
  float sh = 0.0;
  float offLen = length(uShadowOff);
  if (uShadow > 0.0 && d > -1.0 && d < 44.0 + offLen) {
    float ds = surf(p - uShadowOff);
    sh = uShadow * smoothstep(24.0, -16.0, ds);
  }
  if (d > 1.5) { outColor = vec4(0.0, 0.0, 0.0, sh); return; }

  // height field -> surface normal (rounded, tube-like cross-sections)
  float gx = surf(p + vec2(1.0, 0.0)) - d;
  float gy = surf(p + vec2(0.0, 1.0)) - d;
  float R = 24.0;
  float s = clamp(-d, 0.0, R);
  float h = sqrt(s * (2.0 * R - s));
  float slope = (R - s) / max(h, 0.75);
  vec3 n = normalize(vec3(vec2(gx, gy) * slope, 1.0));

  // organic fibrous micro-relief drifting over the skin
  float inner = smoothstep(0.0, 9.0, s);
  vec2 q = p * 0.028 + vec2(uTime * 0.08, -uTime * 0.06);
  float r0 = ridge(q);
  float rx = ridge(q + vec2(0.08, 0.0));
  float ry = ridge(q + vec2(0.0, 0.08));
  n = normalize(n + vec3(r0 - rx, r0 - ry, 0.0) * uDetail * inner);

  // lighting: wet black surface
  vec3 P = vec3(p, h);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(uLight - P);
  vec3 Hh = normalize(L + V);
  float ndl = max(dot(n, L), 0.0);
  float nh = max(dot(n, Hh), 0.0);
  float spec = pow(nh, 90.0) * 2.0 + pow(nh, 18.0) * 0.3;

  vec3 L2 = normalize(vec3(-0.55, 0.75, 0.38));
  float spec2 = pow(max(dot(n, normalize(L2 + V)), 0.0), 50.0) * 0.45;

  vec3 Rf = reflect(-V, n);
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.4);
  float env = smoothstep(0.1, 0.9, -Rf.y) * 0.85
            + smoothstep(0.45, 1.0, Rf.x) * 0.3
            + smoothstep(0.6, 1.0, -Rf.x) * 0.18;

  vec3 col = vec3(0.010, 0.010, 0.016) * (1.0 + ndl * 2.5);
  col += vec3(0.60, 0.67, 0.86) * env * (0.06 + fres * 0.95) * uEnv;
  col += vec3(1.0, 0.97, 0.94) * spec * uLightPow;
  col += vec3(0.50, 0.62, 1.0) * spec2 * uEnv;
  // broad soft sheen so tube bodies read as rounded 3D forms, not just rims
  col += vec3(0.42, 0.46, 0.6) * smoothstep(-0.15, 0.85, -Rf.y) * (0.05 + 0.12 * (1.0 - n.z)) * uEnv;

  float a = smoothstep(1.5, -1.0, d);
  outColor = vec4(col * a, a + sh * (1.0 - a));
}`;
  }

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[symbiote] shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  /* --------------------------------------------------------------- renderer */

  class Renderer {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.o = Object.assign({ scale: 0.6, k: 24, env: 1, shadow: 0, shadowOff: [7, 15], wobble: 7, detail: 0.6, maxDpr: 1.5 }, opts || {});
      this.ok = false;
      let gl = null;
      try {
        gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
      } catch (e) { gl = null; }
      if (!gl) return;
      this.gl = gl;

      const maxVec = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 224;
      this.MAXS = Math.max(24, Math.min(160, Math.floor((maxVec - MAXG * 2 - 32) / 2)));

      const vs = compile(gl, gl.VERTEX_SHADER, VS);
      const fs = compile(gl, gl.FRAGMENT_SHADER, fragSource(this.MAXS));
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn('[symbiote] link error:', gl.getProgramInfoLog(prog));
        return;
      }
      this.prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.u = {};
      ['uRes', 'uSeg', 'uRad', 'uGrp', 'uRng', 'uGroups', 'uK', 'uTime', 'uLight', 'uLightPow',
        'uEnv', 'uErode', 'uShadow', 'uShadowOff', 'uWobble', 'uDetail'].forEach(name => {
        this.u[name] = gl.getUniformLocation(prog, name);
      });

      this.seg = new Float32Array(this.MAXS * 4);
      this.rad = new Float32Array(this.MAXS * 2);
      this.grp = new Float32Array(MAXG * 4);
      this.rng = new Int32Array(MAXG * 2);
      this.w = 1;
      this.h = 1;
      this.lost = false;
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
      this.begin();
      this.ok = true;
    }

    resize() {
      // layout size (unaffected by CSS transforms such as the section zoom transition)
      const r = { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
      const dpr = Math.min(global.devicePixelRatio || 1, this.o.maxDpr);
      const pw = Math.max(1, Math.round(r.width * dpr * this.o.scale));
      const ph = Math.max(1, Math.round(r.height * dpr * this.o.scale));
      if (this.canvas.width !== pw || this.canvas.height !== ph) {
        this.canvas.width = pw;
        this.canvas.height = ph;
      }
      this.w = r.width || 1;
      this.h = r.height || 1;
    }

    begin() { this.n = 0; this.g = 0; this.gOpen = false; this.gCount = 0; }

    group() {
      this._close();
      if (this.g >= MAXG) return false;
      this.gOpen = true;
      this.gStart = this.n;
      this.gCount = 0;
      this.bx0 = Infinity; this.by0 = Infinity; this.bx1 = -Infinity; this.by1 = -Infinity;
      return true;
    }

    _close() {
      if (!this.gOpen) return;
      this.gOpen = false;
      if (this.gCount === 0) return;
      const g = this.g;
      this.grp[g * 4] = (this.bx0 + this.bx1) / 2;
      this.grp[g * 4 + 1] = (this.by0 + this.by1) / 2;
      this.grp[g * 4 + 2] = Math.hypot(this.bx1 - this.bx0, this.by1 - this.by0) / 2 + 1;
      this.grp[g * 4 + 3] = 0;
      this.rng[g * 2] = this.gStart;
      this.rng[g * 2 + 1] = this.gCount;
      this.g++;
    }

    add(ax, ay, bx, by, ra, rb) {
      if (this.n >= this.MAXS) return;
      if (ra < 0.05 && rb < 0.05) return;
      if (!this.gOpen || this.gCount >= MAXPER) { if (!this.group()) return; }
      const i = this.n++;
      this.seg[i * 4] = ax; this.seg[i * 4 + 1] = ay; this.seg[i * 4 + 2] = bx; this.seg[i * 4 + 3] = by;
      this.rad[i * 2] = Math.max(0, ra); this.rad[i * 2 + 1] = Math.max(0, rb);
      const r = Math.max(ra, rb);
      this.bx0 = Math.min(this.bx0, ax - r, bx - r);
      this.by0 = Math.min(this.by0, ay - r, by - r);
      this.bx1 = Math.max(this.bx1, ax + r, bx + r);
      this.by1 = Math.max(this.by1, ay + r, by + r);
      this.gCount++;
    }

    blob(x, y, r) { this.add(x, y, x + 0.01, y, r, r); }

    draw(state) {
      if (!this.ok || this.lost) return;
      this._close();
      const gl = this.gl, u = this.u, o = this.o;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (this.g === 0) return;
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.uniform2f(u.uRes, this.w, this.h);
      gl.uniform4fv(u.uSeg, this.seg);
      gl.uniform2fv(u.uRad, this.rad);
      gl.uniform4fv(u.uGrp, this.grp);
      gl.uniform2iv(u.uRng, this.rng);
      gl.uniform1i(u.uGroups, this.g);
      gl.uniform1f(u.uK, o.k);
      gl.uniform1f(u.uTime, state.time);
      const L = state.light || [this.w * 0.35, -this.h * 0.25, 650];
      gl.uniform3f(u.uLight, L[0], L[1], L[2]);
      gl.uniform1f(u.uLightPow, state.lightPow != null ? state.lightPow : 1);
      gl.uniform1f(u.uEnv, state.env != null ? state.env : o.env);
      gl.uniform1f(u.uErode, state.erode || 0);
      gl.uniform1f(u.uShadow, o.shadow);
      gl.uniform2f(u.uShadowOff, o.shadowOff[0], o.shadowOff[1]);
      gl.uniform1f(u.uWobble, o.wobble);
      gl.uniform1f(u.uDetail, o.detail);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    destroy() {
      if (!this.gl) return;
      const ext = this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }

  /* ---------------------------------------------------------------- tendril */

  class Tendril {
    constructor(o) {
      this.root = { x: o.x, y: o.y };
      this.n = o.segs || 7;
      this.len = o.len || 200;
      this.dir = o.dir != null ? o.dir : -Math.PI / 2;
      this.r0 = o.r0 != null ? o.r0 : 18;
      this.r1 = o.r1 != null ? o.r1 : 2;
      this.profile = o.profile || null;
      this.wave = o.wave != null ? o.wave : 10;
      this.waveSpeed = o.waveSpeed != null ? o.waveSpeed : 1.6;
      this.follow = o.follow != null ? o.follow : 4;
      this.growRate = o.growRate != null ? o.growRate : 2.5;
      this.grow = o.grow != null ? o.grow : 0;
      this.growTarget = this.grow;
      this.pulse = o.pulse != null ? o.pulse : 0.12;
      this.split = o.split || 4;
      this.smoothCurve = !!o.smooth;
      this.seed = o.seed != null ? o.seed : Math.random() * 100;
      this.pts = [];
      this.rp = [];
      const seg = this.len * Math.max(this.grow, 0.02) / this.n;
      for (let i = 0; i <= this.n; i++) {
        this.pts.push({ x: o.x + Math.cos(this.dir) * seg * i, y: o.y + Math.sin(this.dir) * seg * i });
        this.rp.push({ x: this.pts[i].x, y: this.pts[i].y });
      }
      this.tip = { x: this.pts[this.n].x, y: this.pts[this.n].y };
      this.target = { x: this.tip.x, y: this.tip.y };
    }

    radius(u) {
      return this.profile ? this.profile(u) : this.r0 + (this.r1 - this.r0) * Math.pow(u, 0.75);
    }

    update(dt) {
      this.grow += (this.growTarget - this.grow) * (1 - Math.exp(-dt * this.growRate));
      const n = this.n, P = this.pts;
      const L = Math.max(this.len * this.grow, 0.5) / n;
      const k = 1 - Math.exp(-dt * this.follow);
      this.tip.x += (this.target.x - this.tip.x) * k;
      this.tip.y += (this.target.y - this.tip.y) * k;
      const cd = Math.cos(this.dir), sd = Math.sin(this.dir);

      // FABRIK: backward pass from the tip, forward pass from the anchored root
      P[n].x = this.tip.x; P[n].y = this.tip.y;
      for (let i = n - 1; i >= 0; i--) {
        let dx = P[i].x - P[i + 1].x, dy = P[i].y - P[i + 1].y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-4) { dx = -cd; dy = -sd; d = 1; }
        P[i].x = P[i + 1].x + dx / d * L;
        P[i].y = P[i + 1].y + dy / d * L;
      }
      P[0].x = this.root.x; P[0].y = this.root.y;
      for (let i = 1; i <= n; i++) {
        let dx = P[i].x - P[i - 1].x, dy = P[i].y - P[i - 1].y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-4) { dx = cd; dy = sd; d = 1; }
        P[i].x = P[i - 1].x + dx / d * L;
        P[i].y = P[i - 1].y + dy / d * L;
      }
      this.tip.x = P[n].x; this.tip.y = P[n].y;
    }

    emit(R, time) {
      const n = this.n, P = this.pts, rp = this.rp;
      const g = this.grow;
      const rs = smooth(g / 0.3);
      const amp = this.wave * clamp(g * 1.6);
      const t = time * this.waveSpeed, s = this.seed;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const w = (Math.sin(t + i * 0.85 + s) + 0.5 * Math.sin(t * 0.63 + i * 1.9 + s * 1.7)) * amp * u * (1 - 0.3 * u);
        rp[i].x = P[i].x - dy / d * w;
        rp[i].y = P[i].y + dx / d * w;
      }
      if (rs < 0.01) return;
      if (this.smoothCurve) { this.emitSmooth(R, time, rs); return; }
      R.group();
      for (let i = 0; i < n; i++) {
        if (i > 0 && i % this.split === 0) R.group();
        const u0 = i / n, u1 = (i + 1) / n;
        const p0 = 1 + this.pulse * Math.sin(time * 2.2 - u0 * 7 + s);
        const p1 = 1 + this.pulse * Math.sin(time * 2.2 - u1 * 7 + s);
        R.add(rp[i].x, rp[i].y, rp[i + 1].x, rp[i + 1].y, this.radius(u0) * rs * p0, this.radius(u1) * rs * p1);
      }
    }

    // one pass of Chaikin corner-cutting so long tendrils curve smoothly instead of bending at joints
    emitSmooth(R, time, rs) {
      const n = this.n, rp = this.rp, s = this.seed;
      const pts = [{ x: rp[0].x, y: rp[0].y, u: 0 }];
      for (let i = 0; i < n; i++) {
        const a = rp[i], b = rp[i + 1];
        if (i > 0) pts.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25, u: (i + 0.25) / n });
        if (i < n - 1) pts.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75, u: (i + 0.75) / n });
      }
      pts.push({ x: rp[n].x, y: rp[n].y, u: 1 });
      R.group();
      for (let i = 0; i < pts.length - 1; i++) {
        if (i > 0 && i % this.split === 0) R.group();
        const p0 = pts[i], p1 = pts[i + 1];
        const k0 = 1 + this.pulse * Math.sin(time * 2.2 - p0.u * 7 + s);
        const k1 = 1 + this.pulse * Math.sin(time * 2.2 - p1.u * 7 + s);
        R.add(p0.x, p0.y, p1.x, p1.y, this.radius(p0.u) * rs * k0, this.radius(p1.u) * rs * k1);
      }
    }
  }

  /* Stretched webbing strand between two points: thick where it clings, thin where it
     stretches, thinning further (and finally snapping) as the points move apart. */
  function strand(R, a, b, r, maxLen, t, seed) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1 || d > maxLen) return;
    const k = 1 - d / maxLen;
    const rr = r * Math.min(1, k * 2.2);
    if (rr < 0.35) return;
    const sway = Math.sin(t * 1.7 + seed) * d * 0.08;
    const mx = (a.x + b.x) / 2 - dy / d * sway, my = (a.y + b.y) / 2 + dx / d * sway + d * 0.06;
    R.group();
    R.add(a.x, a.y, mx, my, rr, rr * 0.3);
    R.add(mx, my, b.x, b.y, rr * 0.3, rr);
  }

  /* ---------------------------------------------------------- contact scene */
  /* The symbiote lives ON the button. A thin glossy film clings to the button's edge,
     and swellings of living mass crawl along that film. Behaviours:
       - crawling:     the swellings wander around the edge; fine veins creep a little
                       way onto the button face (never over the label)
       - attraction:   nearby swellings pull toward each other, stretching sticky
                       strands between them
       - assimilation: swellings that meet fuse into one larger mass, then later
                       separate again
       - convergence:  when the cursor approaches, everything gathers at the edge
                       point nearest the cursor, and thin tendrils reach out, pull
                       together and merge into a single droplet near the cursor
     On hover the mass spreads around the whole button as if absorbing it; when the
     cursor leaves, everything settles back into the edge. */
  function contact(o) {
    const sec = o.section, canvas = o.canvas, btn = o.button;
    const R = new Renderer(canvas, { scale: 0.9, k: 2.4, env: 0.45, shadow: 0.16, shadowOff: [2, 5], wobble: 0.6, detail: 0.2, maxDpr: 1.5 });
    if (!R.ok) return null;

    const touchDevice = global.matchMedia && global.matchMedia('(hover: none)').matches;
    let W = 0, H = 0, B = null, small = false, sc = 1;
    let nodes = [], tendrils = [], veins = [];
    const ptr = { x: -9999, y: -9999, active: false, until: 0 };
    let hover = 0, prox = 0, forceUntil = 0;
    let raf = 0, last = 0, demoDone = true; // no auto demo: touch screens keep only the idle crawl

    // the button's outline in the canvas's own (untransformed) layout space, so the
    // symbiote stays locked to the button even while the section is mid-transition;
    // includes the button's slight press-in scale while it is being absorbed
    function rel(el) {
      const w0 = el.offsetWidth, h0 = el.offsetHeight;
      const cx = el.offsetLeft - canvas.offsetLeft + w0 / 2;
      const cy = el.offsetTop - canvas.offsetTop + h0 / 2;
      const k = 1 - hover * 0.04;
      const w = w0 * k, h = h0 * k;
      return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
    }

    // pill-shaped outline of the button, expanded by e; u in [0,1) from bottom-centre, clockwise on screen
    function pillInfo(r, e) {
      const rad = r.h / 2 + e;
      const cx0 = r.x + r.h / 2, cx1 = r.x + r.w - r.h / 2, cy = r.y + r.h / 2;
      const straight = Math.max(0, cx1 - cx0);
      const arc = Math.PI * rad;
      return { rad, cx0, cx1, cy, straight, arc, total: 2 * straight + 2 * arc };
    }
    function pill(r, u, e) {
      const P = pillInfo(r, e);
      let s = (((u % 1) + 1) % 1) * P.total;
      if (s < P.straight / 2) return { x: (P.cx0 + P.cx1) / 2 + s, y: P.cy + P.rad, nx: 0, ny: 1, cap: false };
      s -= P.straight / 2;
      if (s < P.arc) { const a = Math.PI / 2 - s / P.rad; return { x: P.cx1 + Math.cos(a) * P.rad, y: P.cy + Math.sin(a) * P.rad, nx: Math.cos(a), ny: Math.sin(a), cap: true }; }
      s -= P.arc;
      if (s < P.straight) return { x: P.cx1 - s, y: P.cy - P.rad, nx: 0, ny: -1, cap: false };
      s -= P.straight;
      if (s < P.arc) { const a = -Math.PI / 2 - s / P.rad; return { x: P.cx0 + Math.cos(a) * P.rad, y: P.cy + Math.sin(a) * P.rad, nx: Math.cos(a), ny: Math.sin(a), cap: true }; }
      s -= P.arc;
      return { x: P.cx0 + s, y: P.cy + P.rad, nx: 0, ny: 1, cap: false };
    }
    function nearestU(x, y) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < 96; k++) {
        const q = pill(B, k / 96, 0);
        const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
        if (d < bd) { bd = d; best = k / 96; }
      }
      return best;
    }
    const wrapDist = (a, b) => { let d = (a - b) % 1; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return d; };

    function build() {
      R.resize();
      W = R.w; H = R.h;
      small = global.innerWidth < 720;
      sc = small ? 0.85 : 1;
      B = rel(btn);
      const n = small ? 5 : 6;
      nodes = [];
      veins = [];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.3 * Math.random()) / n;
        nodes.push({ u, v: 0, home: u, r: rand(4.2, 5.6) * sc, ph: rand(0, TAU), next: rand(1, 4) });
        // a fine vein that creeps a short way onto the button face from this swelling
        veins.push(new Tendril({
          x: 0, y: 0, len: 12 * sc, segs: 3, split: 3, r0: 2 * sc, r1: 0.5 * sc,
          wave: 1.6 * sc, waveSpeed: rand(0.8, 1.3), follow: 3, growRate: 1.2, grow: 0, pulse: 0.08
        }));
      }
      tendrils = [];
      const tn = small ? 3 : 4;
      for (let i = 0; i < tn; i++) {
        tendrils.push(new Tendril({
          x: B.cx, y: B.y + B.h, dir: Math.PI / 2, len: 84 * sc, segs: 6, split: 6,
          r0: 7.5 * sc, r1: 1.3 * sc, wave: 3 * sc, waveSpeed: rand(0.9, 1.4),
          follow: 2.1, growRate: 1.25, grow: 0, pulse: 0.1
        }));
      }
    }

    // thickness of the edge film at perimeter position u: a thin living film plus
    // smooth swellings where the crawling masses are
    function filmRadius(u, t, eh, ep) {
      let m = 0;
      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        const d = wrapDist(u, nd.u);
        const w = 0.045 + 0.02 * ep;
        m += nd.r * (1 + 0.12 * Math.sin(t * 2 + nd.ph)) * Math.exp(-(d * d) / (w * w));
      }
      // fused masses stay slim: soft cap on the combined thickness
      const cap = 8 * sc;
      m = cap * Math.tanh(m / cap);
      // on hover a continuous film spreads around the whole edge
      const film = eh * (2.6 + 0.45 * Math.sin(u * 23 + t * 1.1)) * sc;
      const r = Math.max(m, film) + 0.25 * Math.min(m, film);
      return r < 0.45 ? 0 : r;
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const t = now / 1000;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;

      B = rel(btn);
      const pActive = ptr.active || now < ptr.until;
      let pd = Infinity;
      if (pActive) {
        const dx = Math.max(B.x - ptr.x, 0, ptr.x - (B.x + B.w));
        const dy = Math.max(B.y - ptr.y, 0, ptr.y - (B.y + B.h));
        pd = Math.hypot(dx, dy);
      }
      const proxT = pActive ? clamp(1 - pd / (small ? 200 : 280)) : 0;
      const hovT = ((pActive && pd < 2) || now < forceUntil) ? 1 : 0;
      prox += (proxT - prox) * (1 - Math.exp(-dt * 2.4));
      hover += (hovT - hover) * (1 - Math.exp(-dt * (hovT > hover ? 2 : 1.4)));
      btn.style.setProperty('--absorb', hover.toFixed(3));
      sec.classList.toggle('is-absorbing', hover > 0.35);
      const ep = smooth(prox), eh = smooth(hover);
      const cu = pActive ? nearestU(ptr.x, ptr.y) : 0;
      const close = pActive ? smooth(clamp(1 - pd / (small ? 110 : 140))) * (1 - eh) : 0;

      /* ---- crawl / attract / assimilate / converge along the edge ---- */
      nodes.forEach((nd, i) => {
        nd.next -= dt;
        if (nd.next <= 0) { nd.home = (nd.u + rand(-0.22, 0.22) + 1) % 1; nd.next = rand(2.5, 5.5); }
        let goal = nd.home;
        if (ep > 0.02) goal = cu + (i / (nodes.length - 1) - 0.5) * (0.13 - 0.07 * ep); // convergence
        if (eh > 0.02) goal = cu + (i + 0.5) / nodes.length;                         // wrap the button
        let f = wrapDist(goal, nd.u) * (0.5 + 2.6 * Math.max(ep, eh));
        // attraction to neighbouring masses (pulls them together until they fuse)
        nodes.forEach(other => {
          if (other === nd) return;
          const d = wrapDist(other.u, nd.u);
          const ad = Math.abs(d);
          if (ad < 0.14) f += Math.sign(d) * (0.14 - ad) * 0.9 * (1 - eh);
        });
        nd.v += f * dt * 2.2;
        nd.v *= Math.exp(-dt * 3.8); // viscous damping
        nd.u = (((nd.u + nd.v * dt) % 1) + 1) % 1;
      });

      R.begin();

      /* ---- the edge film with its crawling swellings ---- */
      const steps = small ? 36 : 44;
      let prev = pill(B, 0, 0), prevR = filmRadius(0, t, eh, ep);
      for (let k = 1; k <= steps; k++) {
        const u = k / steps;
        const q = pill(B, u, 0);
        const r = filmRadius(u, t, eh, ep);
        if (prevR > 0 || r > 0) R.add(prev.x, prev.y, q.x, q.y, prevR, r);
        prev = q; prevR = r;
      }

      /* ---- sticky strands between masses that are close but not yet fused ---- */
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.abs(wrapDist(nodes[i].u, nodes[j].u));
          if (d < 0.025 || d > 0.12) continue;
          const a = pill(B, nodes[i].u, 1.5 * sc), b = pill(B, nodes[j].u, 1.5 * sc);
          strand(R, a, b, 1.1 * sc, 70 * sc, t, i * 1.7 + j);
        }
      }

      /* ---- fine veins creeping onto the button face (kept clear of the label) ---- */
      nodes.forEach((nd, i) => {
        const vn = veins[i];
        const q = pill(B, nd.u, -0.5 * sc);
        vn.root.x = q.x; vn.root.y = q.y;
        vn.dir = Math.atan2(-q.ny, -q.nx);
        const reach = q.cap ? Math.min(B.h * 0.42, 13 * sc) : Math.min(B.h * 0.2, 6 * sc);
        const sway = Math.sin(t * 0.7 + nd.ph) * 0.5;
        const ang = vn.dir + sway;
        vn.target.x = q.x + Math.cos(ang) * reach;
        vn.target.y = q.y + Math.sin(ang) * reach;
        vn.len = reach;
        vn.growTarget = (0.55 + 0.45 * Math.sin(t * 0.5 + nd.ph * 2)) * (1 - eh * 0.6);
        vn.update(dt);
        vn.emit(R, t);
      });

      /* ---- tendrils reaching from the gathered mass toward the cursor ---- */
      const maxReach = (30 + 40 * close) * sc; // reach farther the closer the cursor gets
      let tipX = 0, tipY = 0, tipCount = 0;
      if (pActive) {
        const q = pill(B, cu, 0);
        const dx = ptr.x - q.x, dy = ptr.y - q.y;
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(d, maxReach);
        tipX = q.x + dx / d * reach; tipY = q.y + dy / d * reach;
      }
      tendrils.forEach((tn, i) => {
        const nd = nodes[i % nodes.length];
        const spread = (i / Math.max(1, tendrils.length - 1) - 0.5) * 0.07;
        const q = pill(B, nd.u + spread * (1 - ep * 0.5), -1 * sc);
        tn.root.x = q.x; tn.root.y = q.y;
        tn.dir = Math.atan2(q.ny, q.nx);
        // idle: a short living bud on the edge, slowly wiggling
        const sway = Math.sin(t * 0.9 + i * 2.1) * 0.6 + Math.sin(t * 0.47 + i) * 0.4;
        const idleG = 0.2 * (1 - eh);
        let g = idleG;
        let tx = q.x + q.nx * 16 * sc - q.ny * sway * 10 * sc;
        let ty = q.y + q.ny * 16 * sc + q.nx * sway * 10 * sc;
        if (pActive && ep > 0.02) {
          const dx = ptr.x - q.x, dy = ptr.y - q.y;
          const d = Math.hypot(dx, dy) || 1;
          const facing = clamp(((dx * q.nx + dy * q.ny) / d + 0.2) / 0.9);
          // attraction between tendrils: tips are drawn toward their shared meeting point
          const wob = Math.sin(t * 1.3 + i * 1.9) * 7 * sc * (1 - ep);
          tx = lerp(q.x + dx / d * Math.min(d, maxReach), tipX, 0.6 * ep) - dy / d * wob;
          ty = lerp(q.y + dy / d * Math.min(d, maxReach), tipY, 0.6 * ep) + dx / d * wob;
          let reachG = ep * facing * (1 - eh);
          reachG *= smooth((reachG - 0.15) / 0.3);
          g = Math.max(idleG, reachG);
          if (close > 0.01) {
            const ra = (i / tendrils.length) * TAU + t * 1.7;
            const rx = ptr.x + Math.cos(ra) * 13 * sc, ry = ptr.y + Math.sin(ra) * 13 * sc;
            if (Math.hypot(rx - q.x, ry - q.y) < tn.len * 0.95) {
              tx = lerp(tx, rx, close);
              ty = lerp(ty, ry, close);
            }
            g = Math.max(g, close * clamp(facing + 0.35));
          }
        }
        tn.target.x = tx; tn.target.y = ty;
        tn.growTarget = g;
        tn.update(dt);
        tn.emit(R, t);
        if (tn.grow > 0.3) tipCount++;
      });
      // sticky strands: each reaching tendril stays tethered to the button by a thin
      // strand of goo that stretches as it reaches and snaps once pulled too far
      tendrils.forEach((tn, i) => {
        if (tn.grow < 0.35) return;
        const mid = tn.rp[3];
        const back = pill(B, nearestU(mid.x, mid.y) + (i % 2 ? 0.03 : -0.03), 0);
        strand(R, back, mid, 1.3 * sc * tn.grow, 46 * sc, t, i * 1.9 + 4);
      });
      // webbing between neighbouring reaching tendrils
      for (let i = 0; i < tendrils.length - 1; i++) {
        const A = tendrils[i], Bt = tendrils[i + 1];
        const g = Math.min(A.grow, Bt.grow);
        if (g < 0.35) continue;
        strand(R, A.rp[3], Bt.rp[2], 1.1 * sc * g, 30 * sc, t, i * 2.3);
      }
      // assimilation: where the tips meet they fuse into a single glossy droplet
      if (tipCount >= 2) {
        let mx = 0, my = 0, gsum = 0;
        tendrils.forEach(tn => { const g = tn.grow; mx += tn.tip.x * g; my += tn.tip.y * g; gsum += g; });
        if (gsum > 0) {
          const k = clamp((tipCount - 1) / (tendrils.length - 1)) * ep;
          R.group();
          R.blob(mx / gsum, my / gsum, (1.6 + 2.2 * k + 0.3 * Math.sin(t * 3)) * sc);
        }
      }

      const baseLx = W * 0.5 + Math.sin(t * 0.3) * W * 0.4;
      const lx = pActive ? lerp(baseLx, ptr.x, 0.4) : baseLx;
      R.draw({ time: t, light: [lx, -H * 0.8, 420], lightPow: 1, env: 0.4 });
    }

    // pointer position mapped into the canvas's layout space (undoing any CSS scale)
    function setPtr(e) {
      const c = canvas.getBoundingClientRect();
      const sx = canvas.clientWidth / (c.width || 1), sy = canvas.clientHeight / (c.height || 1);
      ptr.x = (e.clientX - c.left) * sx;
      ptr.y = (e.clientY - c.top) * sy;
    }

    sec.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return; // touch: no cursor tracking
      setPtr(e);
      ptr.active = true;
    }, { passive: true });
    sec.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') ptr.active = false;
    });
    btn.addEventListener('focus', () => { forceUntil = performance.now() + 1800; });

    function start() {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    build();
    let resizeTimer = 0;
    global.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    if (global.ResizeObserver) new ResizeObserver(() => { if (B) build(); }).observe(btn);

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          build();
          start();
          if (touchDevice && !demoDone) {
            demoDone = true;
            setTimeout(() => {
              const now = performance.now();
              ptr.x = B.cx + B.w * 0.3; ptr.y = B.y + B.h + 40;
              ptr.until = now + 2600;
              forceUntil = now + 2200;
            }, 700);
          }
        } else {
          stop();
        }
      });
    }, { threshold: 0.05 });
    io.observe(sec);

    return { rebuild: build };
  }

  function supported() {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  global.Symbiote = { contact, supported };
})(window);
