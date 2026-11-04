/* world.js — tiny WebGL2 scene engine: mesh builder, textures, day/night environment, sky, glow sprites.
   Everything is procedural (no external assets besides the GLB character). */
(function (G) {
'use strict';

/* ---------------- math ---------------- */
const M4 = {
  persp(fovy, a, n, f) { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); },
  look(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  inv(m) { // general 4x4 inverse
    const o = new Float32Array(16), a = m;
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  },
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/* ---------------- mesh builder ---------------- */
class MB {
  constructor() { this.v = []; this.i = []; this.n = 0; }
  vert(p, n, u, v, c) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], u, v, c[0], c[1], c[2]); return this.n++; }
  /* p0 bottom-left, p1 bottom-right, p2 top-right, p3 top-left (seen from the front); uv = [u0,v0,u1,v1], v0 = top of the image */
  quad(p0, p1, p2, p3, nrm, uv, col) {
    uv = uv || [0, 0, 1, 1]; col = col || [1, 1, 1];
    const a = this.vert(p0, nrm, uv[0], uv[3], col), b = this.vert(p1, nrm, uv[2], uv[3], col), c = this.vert(p2, nrm, uv[2], uv[1], col), d = this.vert(p3, nrm, uv[0], uv[1], col);
    this.i.push(a, b, c, a, c, d);
  }
  /* star-shaped polygon (points [x,z]) filled as a fan around its centroid; uv = world metres / tile */
  poly(pts, y, col, tile, up) {
    col = col || [1, 1, 1]; tile = tile || 4; let cx = 0, cz = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
    const c = this.vert([cx, y, cz], [0, 1, 0], cx / tile, cz / tile, col), b = this.n;
    pts.forEach(p => this.vert([p[0], y, p[1]], [0, 1, 0], p[0] / tile, p[1] / tile, col));
    for (let k = 0; k < pts.length; k++) this.i.push(c, b + k, b + (k + 1) % pts.length);
  }
  /* double-sided free triangle */
  tri(a, b, c, nrm, col) { const i0 = this.vert(a, nrm, 0, 0, col), i1 = this.vert(b, nrm, 1, 0, col), i2 = this.vert(c, nrm, .5, 1, col); this.i.push(i0, i1, i2); }
  /* axis-aligned box; tile = [metres per texture repeat u, v] */
  box(x0, y0, z0, x1, y1, z1, col, tile, o) {
    o = o || {}; col = col || [1, 1, 1]; const tw = tile ? tile[0] : 1e9, th = tile ? tile[1] : 1e9;
    const F = (p0, p1, p2, p3, n, u0, v0, u1, v1) => this.quad(p0, p1, p2, p3, n, [u0, v0, u1, v1], col);
    if (!o.noFront) F([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], 0, 0, (x1 - x0) / tw, (y1 - y0) / th);
    if (!o.noBack) F([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], 0, 0, (x1 - x0) / tw, (y1 - y0) / th);
    if (!o.noSides) {
      F([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], 0, 0, (z1 - z0) / tw, (y1 - y0) / th);
      F([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], 0, 0, (z1 - z0) / tw, (y1 - y0) / th);
    }
    if (!o.noTop) F([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 0, 0, (x1 - x0) / tw, (z1 - z0) / th);
  }
  /* flat quad on the ground (y), facing up */
  floor(x0, z0, x1, z1, y, col, uv) { this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], uv || [0, 0, 1, 1], col); }
  /* vertical quad facing +z at z */
  wall(x0, y0, x1, y1, z, col, uv) { this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], uv || [0, 0, 1, 1], col); }
  cyl(cx, cz, y0, y1, r0, r1, seg, col, cap) {
    col = col || [1, 1, 1]; const base = this.n;
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), sl = (r0 - r1) / (y1 - y0 || 1);
      const nn = [c, sl, s]; const l = Math.hypot(...nn);
      this.vert([cx + c * r0, y0, cz + s * r0], [nn[0] / l, nn[1] / l, nn[2] / l], k / seg, 1, col);
      this.vert([cx + c * r1, y1, cz + s * r1], [nn[0] / l, nn[1] / l, nn[2] / l], k / seg, 0, col);
    }
    for (let k = 0; k < seg; k++) { const a = base + k * 2; this.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    if (cap) {
      const t = this.vert([cx, y1, cz], [0, 1, 0], .5, .5, col), b0 = this.n;
      for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; this.vert([cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1], [0, 1, 0], .5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5, col); }
      for (let k = 0; k < seg; k++) this.i.push(t, b0 + k + 1, b0 + k);
    }
  }
  sphere(cx, cy, cz, rx, ry, rz, col, seg) {
    seg = seg || 10; col = col || [1, 1, 1]; const base = this.n;
    for (let j = 0; j <= seg; j++) for (let k = 0; k <= seg * 2; k++) {
      const th = j / seg * Math.PI, ph = k / (seg * 2) * Math.PI * 2, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      this.vert([cx + x * rx, cy + y * ry, cz + z * rz], [x, y, z], k / (seg * 2), j / seg, col);
    }
    const w = seg * 2 + 1;
    for (let j = 0; j < seg; j++) for (let k = 0; k < seg * 2; k++) { const a = base + j * w + k; this.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
  }
  /* flat disc / ring on the ground, uv mapped radially (0..1) */
  disc(cx, cz, y, r, seg, col, rin) {
    col = col || [1, 1, 1]; rin = rin || 0; const base = this.n;
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      this.vert([cx + c * rin, y, cz + s * rin], [0, 1, 0], .5 + c * .5 * rin / r, .5 + s * .5 * rin / r, col);
      this.vert([cx + c * r, y, cz + s * r], [0, 1, 0], .5 + c * .5, .5 + s * .5, col);
    }
    for (let k = 0; k < seg; k++) { const a = base + k * 2; this.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  /* arch: a ring segment in the XY plane, extruded along z (a0..a1 radians, 0 = +x, PI/2 = up) */
  arch(cx, cy, z0, z1, ro, ri, a0, a1, seg, col) {
    col = col || [1, 1, 1]; const pts = [];
    for (let k = 0; k <= seg; k++) { const a = lerp(a0, a1, k / seg); pts.push([Math.cos(a), Math.sin(a)]); }
    for (let k = 0; k < seg; k++) {
      const A = pts[k], B = pts[k + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ml = Math.hypot(mx, my), nx = mx / ml, ny = my / ml;
      const P = (r, p, z) => [cx + p[0] * r, cy + p[1] * r, z];
      this.quad(P(ro, A, z0), P(ro, B, z0), P(ro, B, z1), P(ro, A, z1), [nx, ny, 0], [0, 0, 1, 1], col);   // outer
      this.quad(P(ri, B, z0), P(ri, A, z0), P(ri, A, z1), P(ri, B, z1), [-nx, -ny, 0], [0, 0, 1, 1], col); // inner
      this.quad(P(ri, A, z1), P(ri, B, z1), P(ro, B, z1), P(ro, A, z1), [0, 0, 1], [0, 0, 1, 1], col);      // front cap
      this.quad(P(ro, A, z0), P(ro, B, z0), P(ri, B, z0), P(ri, A, z0), [0, 0, -1], [0, 0, 1, 1], col);     // back cap
    }
  }
}

/* ---------------- shaders ---------------- */
const VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec2 aUV; in vec3 aCol;
uniform mat4 uVP; out vec3 vN; out vec2 vUV; out vec3 vC; out vec3 vW;
void main(){ vN=aNrm; vUV=aUV; vC=aCol; vW=aPos; gl_Position=uVP*vec4(aPos,1.0); }`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec2 vUV; in vec3 vC; in vec3 vW;
uniform sampler2D uTex; uniform sampler2D uEm;
uniform vec3 uEye; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFogCol; uniform vec2 uFog;
uniform float uNight; uniform float uEmDay; uniform float uEmNight; uniform float uMode; uniform float uGlow; uniform float uDark; uniform float uFade;
out vec4 o;
void main(){
  vec4 t=texture(uTex,vUV);
  if(uMode>2.5){ o=vec4(vC, t.r*uGlow); return; }
  if(uMode>1.5){ float d=length(vW-uEye); float f=1.0-smoothstep(uFog.x,uFog.y,d); o=vec4(t.rgb*vC*uGlow*f,1.0); return; }
  vec3 n=normalize(vN);
  float d=max(dot(n,normalize(uSunDir)),0.0);
  float hemi=n.y*.5+.5;
  vec3 light=uAmb*(.75+.25*hemi)+uSunCol*d;
  vec3 base=t.rgb*vC;
  vec3 em=texture(uEm,vUV).rgb*(uEmDay+uNight*uEmNight);
  vec3 col=base*light+em;
  col*=1.0-uDark*(1.0-hemi)*.0;
  float dist=length(vW-uEye);
  col=mix(col,uFogCol,smoothstep(uFog.x,uFog.y,dist));
  o=vec4(col,uFade);
}`;
const SKY_VS = `#version 300 es
out vec2 vP; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vP=p; gl_Position=vec4(p*2.0-1.0,.9999,1.0); }`;
const SKY_FS = `#version 300 es
precision highp float; in vec2 vP; uniform vec3 uTop; uniform vec3 uBot; uniform float uNight; uniform float uTime; uniform float uAsp;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec3 c=mix(uBot,uTop,smoothstep(.0,1.0,vP.y));
  vec2 g=vec2(vP.x*uAsp,vP.y)*38.0; vec2 id=floor(g); float r=h(id);
  float star=step(.972,r)*smoothstep(.45,.8,vP.y)*uNight*(.6+.4*sin(uTime*2.0+r*40.0));
  float sp=length(fract(g)-.5); star*=smoothstep(.35,.0,sp);
  o=vec4(c+vec3(star),1.0);
}`;

function compile(gl, vs, fs, bind) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  (bind || []).forEach((n, i) => gl.bindAttribLocation(p, i, n)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const cnt = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < cnt; i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
  return { p, u };
}

/* ---------------- environment (time of day) ---------------- */
const C = {
  day: { top: hex('#4a90e0'), bot: hex('#bfe0f5'), amb: [.62, .66, .78], sun: [.62, .58, .45], fog: hex('#bcd8ee'), char: { amb: [.58, .60, .76], sun: [.46, .44, .26] } },
  gold: { top: hex('#4a3f86'), bot: hex('#ff9a62'), amb: [.52, .44, .56], sun: [.62, .36, .22], fog: hex('#d98a75'), char: { amb: [.58, .50, .70], sun: [.46, .30, .20] } },
  night: { top: hex('#070a22'), bot: hex('#2b2160'), amb: [.20, .23, .42], sun: [.10, .13, .26], fog: hex('#1d1a4a'), char: { amb: [.52, .54, .80], sun: [.26, .30, .46] } },
};
function envAt(h) {
  const ang = Math.PI * (h - 6) / 12, s = Math.sin(ang);
  const dayW = sstep(.08, .5, s), nightW = 1 - sstep(-.22, .08, s), goldW = clamp(1 - dayW - nightW, 0, 1);
  const pick = k => { const a = C.day[k], b = C.gold[k], c = C.night[k]; return [0, 1, 2].map(i => a[i] * dayW + b[i] * goldW + c[i] * nightW); };
  const pc = (k, j) => { const a = C.day.char[j], b = C.gold.char[j], c = C.night.char[j]; return [0, 1, 2].map(i => a[i] * dayW + b[i] * goldW + c[i] * nightW); };
  const sunUp = s > .02;
  const dir = sunUp ? [-Math.cos(ang) * .9, Math.max(.25, s) * 1.1, .55] : [.3, .8, .45];
  const sun = pick('sun'); if (!sunUp) { sun[0] = C.night.sun[0]; sun[1] = C.night.sun[1]; sun[2] = C.night.sun[2]; }
  return { night: nightW, gold: goldW, day: dayW, dir, sun, amb: pick('amb'), top: pick('top'), bot: pick('bot'), fog: pick('fog'), charAmb: pc('x', 'amb'), charSun: pc('x', 'sun'), indoor: false, line: [.23 - .15 * nightW, .14 - .08 * nightW, .17 - .05 * nightW] };
}

/* ---------------- renderer ---------------- */
class Renderer {
  constructor(canvas) {
    const gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('需要 WebGL2');
    this.canvas = canvas;
    this.prog = compile(gl, VS, FS, ['aPos', 'aNrm', 'aUV', 'aCol']);
    this.sky = compile(gl, SKY_VS, SKY_FS);
    this.emptyVAO = gl.createVertexArray();
    this.white = this.solidTex([255, 255, 255, 255]); this.black = this.solidTex([0, 0, 0, 255]);
    this.dyn = { buf: gl.createBuffer(), idx: gl.createBuffer(), vao: gl.createVertexArray() }; this._setupVAO(this.dyn.vao, this.dyn.buf, this.dyn.idx);
    this.view = null;
  }
  solidTex(rgba) { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba)); return t; }
  canvasTex(cv, o) {
    o = o || {}; const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    const pot = (cv.width & (cv.width - 1)) === 0 && (cv.height & (cv.height - 1)) === 0;
    if (o.mip !== false) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const w = o.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  }
  /* paint(w,h,fn(ctx,w,h)) -> GL texture */
  paint(w, h, fn, o) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return this.canvasTex(c, o); }
  _setupVAO(vao, buf, idx) {
    const gl = this.gl; gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const st = 44; [[0, 3, 0], [1, 3, 12], [2, 2, 24], [3, 3, 32]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, st, o); });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx); gl.bindVertexArray(null);
  }
  updateCanvasTex(tex, cv) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); }
  /* freeze a MeshBuilder into a GPU batch: {mb, mat} */
  batch(mb, mat) {
    const gl = this.gl, b = { vao: gl.createVertexArray(), buf: gl.createBuffer(), idx: gl.createBuffer(), count: mb.i.length, mat: Object.assign({ tex: this.white, em: this.black, emDay: 0, emNight: 0, mode: 0, glow: 1 }, mat) };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mb.v), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mb.i), gl.STATIC_DRAW);
    this._setupVAO(b.vao, b.buf, b.idx); return b;
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(2, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    return [w, h, dpr];
  }
  /* cam: {target:[x,y,z], dist, pitch, fov} */
  setCamera(cam, w, h) {
    const p = cam.pitch, e = [cam.target[0], cam.target[1] + cam.dist * Math.sin(p), cam.target[2] + cam.dist * Math.cos(p)];
    const V = M4.look(e, cam.target, [0, 1, 0]), Pm = M4.persp(cam.fov, w / h, 1, 260);
    this.view = { eye: e, V, P: Pm, VP: M4.mul(Pm, V), iVP: null, w, h, cam };
    this.view.iVP = M4.inv(this.view.VP); return this.view;
  }
  project(p) { const m = this.view.VP, x = p[0], y = p[1], z = p[2], w = m[3] * x + m[7] * y + m[11] * z + m[15]; if (w <= 0) return null; const X = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, Y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w; return [(X * .5 + .5) * this.view.w, (1 - (Y * .5 + .5)) * this.view.h, w]; }
  /* screen (device px) -> ground point at y */
  pickGround(sx, sy, y) {
    const v = this.view, nx = sx / v.w * 2 - 1, ny = 1 - sy / v.h * 2, m = v.iVP;
    const un = (z) => { const x = m[0] * nx + m[4] * ny + m[8] * z + m[12], yy = m[1] * nx + m[5] * ny + m[9] * z + m[13], zz = m[2] * nx + m[6] * ny + m[10] * z + m[14], w = m[3] * nx + m[7] * ny + m[11] * z + m[15]; return [x / w, yy / w, zz / w]; };
    const a = un(-1), b = un(1), t = (y - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t];
  }
  begin(env, w, h, time) {
    const gl = this.gl; gl.viewport(0, 0, w, h); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearColor(env.bot[0], env.bot[1], env.bot[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!env.indoor) {
      gl.disable(gl.DEPTH_TEST); gl.useProgram(this.sky.p); gl.uniform3fv(this.sky.u.uTop, env.top); gl.uniform3fv(this.sky.u.uBot, env.bot); gl.uniform1f(this.sky.u.uNight, env.night); gl.uniform1f(this.sky.u.uTime, time); gl.uniform1f(this.sky.u.uAsp, w / h);
      gl.bindVertexArray(this.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.DEPTH_TEST);
    }
    const P = this.prog, u = P.u; gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.uVP, false, this.view.VP); gl.uniform3fv(u.uEye, this.view.eye);
    gl.uniform3fv(u.uSunDir, env.dir); gl.uniform3fv(u.uSunCol, env.sun); gl.uniform3fv(u.uAmb, env.amb); gl.uniform3fv(u.uFogCol, env.fog);
    gl.uniform2f(u.uFog, env.fogNear || 45, env.fogFar || 120); gl.uniform1f(u.uNight, env.night); gl.uniform1f(u.uDark, 0);
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uEm, 1); this.env = env;
  }
  draw(b, glowScale) {
    const gl = this.gl, u = this.prog.u, m = b.mat; gl.useProgram(this.prog.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, m.em); gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u.uEmDay, m.emDay); gl.uniform1f(u.uEmNight, m.emNight); gl.uniform1f(u.uMode, m.mode); const fd = b.fade == null ? 1 : b.fade; gl.uniform1f(u.uFade, fd);
    const gs = typeof m.glow === 'function' ? m.glow(this.env) : m.glow; gl.uniform1f(u.uGlow, gs * (glowScale == null ? 1 : glowScale));
    gl.disable(gl.CULL_FACE);
    if (m.mode === 2) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); }
    else if (m.mode === 3) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1); }
    else if (fd < .995) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
    else { gl.disable(gl.BLEND); gl.depthMask(true); }
    gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
    if (m.mode >= 2 || fd < .995) { gl.disable(gl.BLEND); gl.depthMask(true); gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL); }
  }
  /* per-frame dynamic geometry */
  drawDynamic(mb, mat) {
    if (!mb.i.length) return; const gl = this.gl, d = this.dyn;
    gl.bindVertexArray(d.vao); gl.bindBuffer(gl.ARRAY_BUFFER, d.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mb.v), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mb.i), gl.STREAM_DRAW);
    this.draw({ vao: d.vao, count: mb.i.length, mat: Object.assign({ tex: this.white, em: this.black, emDay: 0, emNight: 0, mode: 0, glow: 1 }, mat) });
  }
}

G.World = { Renderer, MB, M4, envAt, clamp, lerp, sstep, mix3, hex };
})(window);
