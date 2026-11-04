/* glbchar.js: a small, dependency-free GLB character renderer (WebGL2).
   Skinned meshes + skeletal animation (cross-fades) + toon shading + inverted-hull outlines.
   Works with this project's GLB and with ordinary rigged GLBs (vertex colours, base-colour textures). */
(function (global) {
'use strict';

/* ---------------- math (column-major) ---------------- */
const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function mulInto(o, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
const mul = (a, b) => mulInto(new Float32Array(16), a, b);
function fromTRS(o, o3, t, ti, q, qi, s, si) {
  const x = q[qi], y = q[qi + 1], z = q[qi + 2], w = q[qi + 3];
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = s[si], sy = s[si + 1], sz = s[si + 2];
  o[0] = (1 - (yy + zz)) * sx; o[1] = (xy + wz) * sx; o[2] = (xz - wy) * sx; o[3] = 0;
  o[4] = (xy - wz) * sy; o[5] = (1 - (xx + zz)) * sy; o[6] = (yz + wx) * sy; o[7] = 0;
  o[8] = (xz + wy) * sz; o[9] = (yz - wx) * sz; o[10] = (1 - (xx + yy)) * sz; o[11] = 0;
  o[12] = t[ti]; o[13] = t[ti + 1]; o[14] = t[ti + 2]; o[15] = 1;
}
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const trans = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const scl = (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
const ortho = (l, r, b, t, n, f) => new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);

/* ---------------- GLB parsing ---------------- */
function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB file');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); off += 8;
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off, len)));
    else if (type === 0x004E4942) bin = buf.slice(off, off + len);
    off += len;
  }
  return { json, bin };
}
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function readAcc(g, bin, idx, asFloat) {
  const a = g.accessors[idx], bv = g.bufferViews[a.bufferView], T = CT[a.componentType], comps = NC[a.type], bytes = T.BYTES_PER_ELEMENT;
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || comps * bytes;
  let out;
  if (stride === comps * bytes) out = new T(bin.slice(start, start + a.count * comps * bytes));
  else {
    out = new T(a.count * comps);
    const src = new Uint8Array(bin, start - (start % 1)), dv = new DataView(bin);
    const getter = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < comps; k++) out[i * comps + k] = dv[getter](start + i * stride + k * bytes, true);
  }
  if (asFloat && a.componentType !== 5126) {
    const f = new Float32Array(out.length), div = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 4294967295 }[a.componentType] : 1;
    for (let i = 0; i < out.length; i++) f[i] = Math.max(out[i] / div, -1);
    out = f;
  }
  return { data: out, comps, count: a.count };
}

/* ---------------- model ---------------- */
async function loadModel(url, renderer) {
  const buf = typeof url === 'string' ? await (await fetch(url)).arrayBuffer() : url;
  const { json: g, bin } = parseGLB(buf);
  const n = g.nodes.length;
  const m = { g, nodes: g.nodes, n, parent: new Int32Array(n).fill(-1), restT: new Float32Array(n * 3), restR: new Float32Array(n * 4), restS: new Float32Array(n * 3), order: [], meshes: [], anims: {}, names: {} };
  g.nodes.forEach((nd, i) => {
    (nd.children || []).forEach(c => m.parent[c] = i);
    m.restT.set(nd.translation || [0, 0, 0], i * 3); m.restR.set(nd.rotation || [0, 0, 0, 1], i * 4); m.restS.set(nd.scale || [1, 1, 1], i * 3);
    if (nd.name) m.names[nd.name] = i;
  });
  const seen = new Uint8Array(n);
  const visit = i => { if (seen[i]) return; if (m.parent[i] >= 0) visit(m.parent[i]); seen[i] = 1; m.order.push(i); };
  for (let i = 0; i < n; i++) visit(i);
  // skins
  m.skins = (g.skins || []).map(s => ({ joints: s.joints, ibm: s.inverseBindMatrices != null ? readAcc(g, bin, s.inverseBindMatrices, true).data : null }));
  // images / textures
  const imgs = await Promise.all((g.images || []).map(async im => {
    let blob;
    if (im.bufferView != null) { const bv = g.bufferViews[im.bufferView]; blob = new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: im.mimeType || 'image/png' }); }
    else blob = await (await fetch(im.uri)).blob();
    return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  }));
  const gl = renderer.gl;
  const texCache = {};
  const getTex = ti => {
    if (texCache[ti]) return texCache[ti];
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgs[g.textures[ti].source]);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return texCache[ti] = t;
  };
  const buffer = (data, target) => { const b = gl.createBuffer(); gl.bindBuffer(target || gl.ARRAY_BUFFER, b); gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
  g.nodes.forEach((nd, ni) => {
    if (nd.mesh == null) return;
    g.meshes[nd.mesh].primitives.forEach(p => {
      const pos = readAcc(g, bin, p.attributes.POSITION, true), N = pos.count;
      const nrm = p.attributes.NORMAL != null ? readAcc(g, bin, p.attributes.NORMAL, true).data : new Float32Array(N * 3).fill(0.577);
      let col = new Float32Array(N * 4).fill(1);
      if (p.attributes.COLOR_0 != null) { const c = readAcc(g, bin, p.attributes.COLOR_0, true); if (c.comps === 4) col = c.data; else for (let i = 0; i < N; i++) { col[i * 4] = c.data[i * 3]; col[i * 4 + 1] = c.data[i * 3 + 1]; col[i * 4 + 2] = c.data[i * 3 + 2]; } }
      const uv = p.attributes.TEXCOORD_0 != null ? readAcc(g, bin, p.attributes.TEXCOORD_0, true).data : new Float32Array(N * 2);
      const skinned = p.attributes.JOINTS_0 != null && nd.skin != null;
      const J = skinned ? Uint16Array.from(readAcc(g, bin, p.attributes.JOINTS_0, false).data) : new Uint16Array(N * 4);
      const W = skinned ? readAcc(g, bin, p.attributes.WEIGHTS_0, true).data : (() => { const w = new Float32Array(N * 4); for (let i = 0; i < N; i++) w[i * 4] = 1; return w; })();
      let idx = p.indices != null ? readAcc(g, bin, p.indices, false).data : Uint32Array.from({ length: N }, (_, i) => i);
      if (idx instanceof Uint8Array) idx = Uint16Array.from(idx);
      const mat = g.materials && p.material != null ? g.materials[p.material] : {}, pbr = mat.pbrMetallicRoughness || {};
      const prim = { node: ni, name: nd.name || ('mesh' + ni), skin: skinned ? nd.skin : -1, count: idx.length, itype: idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
        base: pbr.baseColorFactor || [1, 1, 1, 1], tex: pbr.baseColorTexture ? getTex(pbr.baseColorTexture.index) : null, mask: mat.alphaMode === 'MASK', cutoff: mat.alphaCutoff != null ? mat.alphaCutoff : .5, double: !!mat.doubleSided,
        hidden: !!(nd.extras && nd.extras.defaultHidden), pos0: /^(Head|Ear|Hair)/.test(nd.name || '') ? pos.data : null /* [创建面板] 脸型变形要用 */, bufs: { pos: buffer(pos.data), nrm: buffer(nrm), col: buffer(col), uv: buffer(uv), J: buffer(J), W: buffer(W), idx: buffer(idx, gl.ELEMENT_ARRAY_BUFFER) } };
      m.meshes.push(prim);
    });
  });
  // animations
  (g.animations || []).forEach(a => {
    const ch = a.channels.map(c => { const s = a.samplers[c.sampler]; return { node: c.target.node, path: c.target.path, t: readAcc(g, bin, s.input, true).data, v: readAcc(g, bin, s.output, true).data }; }).filter(c => c.node != null);
    const dur = Math.max(...ch.map(c => c.t[c.t.length - 1]));
    m.anims[a.name || 'anim' + Object.keys(m.anims).length] = { duration: dur, ch };
  });
  m.maxJoints = Math.max(1, ...m.skins.map(s => s.joints.length));
  return m;
}

/* ---------------- instance (pose + mixer) ---------------- */
function makeInstance(model, renderer) {
  const n = model.n;
  const inst = { model, T: new Float32Array(n * 3), R: new Float32Array(n * 4), S: new Float32Array(n * 3), world: new Float32Array(n * 16), tmp: new Float32Array(16),
    layers: [], pos: [0, 0, 0], yaw: 0, scale: 1, hidden: {}, tint: [1, 1, 1], speed: 1, clip: null };
  inst.hidden = {}; model.meshes.forEach(p => { if (p.hidden) inst.hidden[p.name] = true; });
  inst.boneTex = renderer.makeBoneTexture(model.maxJoints);
  inst.boneData = new Float32Array(model.maxJoints * 16 * Math.max(1, model.skins.length));
  inst.play = (name, fade = .2, loop = true) => {
    if (inst.clip === name || !model.anims[name]) return;
    inst.clip = name;
    inst.layers.forEach(l => l.target = 0);
    const same = inst.layers.find(l => l.name === name);
    if (same) { same.target = 1; return; }
    inst.layers.push({ name, anim: model.anims[name], t: 0, w: inst.layers.length ? 0 : 1, target: 1, fade, loop });
  };
  inst.update = dt => {
    for (const l of inst.layers) {
      l.t += dt * inst.speed; if (l.loop) l.t %= l.anim.duration; else l.t = Math.min(l.t, l.anim.duration);
      const step = dt / Math.max(l.fade, .001); l.w += Math.sign(l.target - l.w) * Math.min(Math.abs(l.target - l.w), step);
    }
    inst.layers = inst.layers.filter(l => l.target > 0 || l.w > 0.001);
    evalPose(inst);
  };
  evalPose(inst);
  return inst;
}
function sampleChannel(c, t, out, oi, isQuat) {
  const ts = c.t; let hi = ts.length - 1;
  if (t <= ts[0]) hi = 0; else if (t < ts[hi]) { let lo = 0; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ts[mid] <= t) lo = mid; else hi = mid; } }
  const k = isQuat ? 4 : 3;
  if (hi === 0 || t >= ts[ts.length - 1]) { const i = (hi === 0 ? 0 : ts.length - 1) * k; for (let j = 0; j < k; j++) out[oi + j] = c.v[i + j]; return; }
  const lo = hi - 1, f = (t - ts[lo]) / (ts[hi] - ts[lo]), a = lo * k, b = hi * k;
  if (!isQuat) { for (let j = 0; j < 3; j++) out[oi + j] = c.v[a + j] + (c.v[b + j] - c.v[a + j]) * f; return; }
  let d = c.v[a] * c.v[b] + c.v[a + 1] * c.v[b + 1] + c.v[a + 2] * c.v[b + 2] + c.v[a + 3] * c.v[b + 3], sg = d < 0 ? -1 : 1; d = Math.abs(d);
  let s0, s1;
  if (d > .9995) { s0 = 1 - f; s1 = f * sg; } else { const th = Math.acos(d), sn = Math.sin(th); s0 = Math.sin((1 - f) * th) / sn; s1 = Math.sin(f * th) / sn * sg; }
  let l = 0; for (let j = 0; j < 4; j++) { out[oi + j] = c.v[a + j] * s0 + c.v[b + j] * s1; l += out[oi + j] * out[oi + j]; }
  l = 1 / Math.sqrt(l); for (let j = 0; j < 4; j++) out[oi + j] *= l;
}
const _q = new Float32Array(4), _t = new Float32Array(3), _loc = new Float32Array(16);
function evalPose(inst) {
  const m = inst.model, n = m.n;
  inst.T.set(m.restT); inst.R.set(m.restR); inst.S.set(m.restS);
  const L = inst.layers;
  if (L.length) {
    let tot = 0; for (const l of L) tot += l.w; if (tot <= 0) tot = 1;
    if (!inst.accR) { inst.accR = new Float32Array(n * 4); inst.accT = new Float32Array(n * 3); inst.wR = new Float32Array(n); inst.wT = new Float32Array(n); }
    const accR = inst.accR, accT = inst.accT, wR = inst.wR, wT = inst.wT, rr = m.restR, rt = m.restT;
    accR.fill(0); accT.fill(0); wR.fill(0); wT.fill(0);
    for (const l of L) {
      const w = l.w / tot; if (w <= 0) continue;
      for (const c of l.anim.ch) {
        if (c.path === 'rotation') {
          sampleChannel(c, l.t, _q, 0, true); const o = c.node * 4;
          const sg = (_q[0] * rr[o] + _q[1] * rr[o + 1] + _q[2] * rr[o + 2] + _q[3] * rr[o + 3]) < 0 ? -1 : 1;
          for (let j = 0; j < 4; j++) accR[o + j] += _q[j] * w * sg; wR[c.node] += w;
        } else if (c.path === 'translation') {
          sampleChannel(c, l.t, _t, 0, false);
          for (let j = 0; j < 3; j++) accT[c.node * 3 + j] += _t[j] * w; wT[c.node] += w;
        }
      }
    }
    for (let nd = 0; nd < n; nd++) {
      if (wR[nd] > 0) {
        const o = nd * 4, rest = Math.max(0, 1 - wR[nd]);
        for (let j = 0; j < 4; j++) accR[o + j] += rr[o + j] * rest;
        const l = 1 / (Math.hypot(accR[o], accR[o + 1], accR[o + 2], accR[o + 3]) || 1);
        for (let j = 0; j < 4; j++) inst.R[o + j] = accR[o + j] * l;
      }
      if (wT[nd] > 0) { const rest = Math.max(0, 1 - wT[nd]); for (let j = 0; j < 3; j++) inst.T[nd * 3 + j] = accT[nd * 3 + j] + rt[nd * 3 + j] * rest; }
    }
  }
  const w = inst.world, tmp = inst.tmp, loc = _loc;
  for (const i of m.order) {
    fromTRS(loc, null, inst.T, i * 3, inst.R, i * 4, inst.S, i * 3);
    const p = m.parent[i];
    if (p < 0) w.set(loc, i * 16); else { mulInto(tmp, w.subarray(p * 16, p * 16 + 16), loc); w.set(tmp, i * 16); }
  }
  m.skins.forEach((s, si) => {
    for (let j = 0; j < s.joints.length; j++) {
      const jw = w.subarray(s.joints[j] * 16, s.joints[j] * 16 + 16);
      if (s.ibm) mulInto(tmp, jw, s.ibm.subarray(j * 16, j * 16 + 16)); else tmp.set(jw);
      inst.boneData.set(tmp, (si * m.maxJoints + j) * 16);
    }
  });
}

/* ---------------- renderer ---------------- */
const VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec4 aCol; in vec2 aUV; in uvec4 aJ; in vec4 aW;
uniform sampler2D uBones; uniform mat4 uVP; uniform mat4 uModel; uniform float uOutline; uniform float uSkinned;
out vec3 vN; out vec4 vC; out vec2 vUV;
mat4 bone(uint i){ int k=int(i)*4; return mat4(texelFetch(uBones,ivec2(k,0),0),texelFetch(uBones,ivec2(k+1,0),0),texelFetch(uBones,ivec2(k+2,0),0),texelFetch(uBones,ivec2(k+3,0),0)); }
void main(){
  vec4 p=vec4(aPos,1.0); vec3 n=aNrm;
  if(uSkinned>.5){ mat4 s=aW.x*bone(aJ.x)+aW.y*bone(aJ.y)+aW.z*bone(aJ.z)+aW.w*bone(aJ.w); p=s*p; n=mat3(s)*aNrm; }
  n=normalize(n); p.xyz+=n*uOutline;
  vN=normalize(mat3(uModel)*n); vC=aCol; vUV=aUV;
  gl_Position=uVP*uModel*p;
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec4 vC; in vec2 vUV;
uniform sampler2D uTex; uniform float uHasTex; uniform vec4 uBase; uniform vec3 uTint; uniform vec3 uLight; uniform vec3 uView; uniform float uPass; uniform vec3 uLine; uniform float uMask; uniform float uCut; uniform vec3 uRim; uniform vec3 uAmb; uniform vec3 uSunCol; uniform vec4 uRecol;
out vec4 o;
void main(){
  vec4 base=uBase*vC; if(uHasTex>.5) base*=texture(uTex,vUV);
  if(uRecol.a>0.0){ float lum=dot(base.rgb,vec3(.3,.59,.11)); base.rgb=mix(base.rgb,uRecol.rgb*clamp(lum*1.7,0.15,1.25),uRecol.a); }
  if(uMask>.5 && base.a<uCut) discard;
  if(uPass>.5){ o=vec4(uLine,1.0); return; }
  vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
  float d=dot(n,normalize(uLight));
  float lit=smoothstep(-.06,.10,d)*.5+smoothstep(.38,.52,d)*.5;
  vec3 shade=uAmb+uSunCol*lit;
  float rim=pow(1.0-clamp(dot(n,normalize(uView)),0.0,1.0),3.0)*smoothstep(-.3,.4,-d+.2);
  vec3 col=base.rgb*uTint*shade+uRim*rim*.35*(uAmb.b+.2);
  o=vec4(col,1.0);
}`;

function createRenderer(canvas, opts) {
  opts = opts || {};
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.preserve });
  if (!gl) throw new Error('WebGL2 not available');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  const locs = { aPos: 0, aNrm: 1, aCol: 2, aUV: 3, aJ: 4, aW: 5 };
  Object.keys(locs).forEach(k => gl.bindAttribLocation(pr, locs[k], k));
  gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const U = {}; ['uBones', 'uVP', 'uModel', 'uOutline', 'uSkinned', 'uTex', 'uHasTex', 'uBase', 'uTint', 'uLight', 'uView', 'uPass', 'uLine', 'uMask', 'uCut', 'uRim', 'uAmb', 'uSunCol', 'uRecol'].forEach(k => U[k] = gl.getUniformLocation(pr, k));
  const r = { gl, canvas, vaos: new WeakMap() };
  r.makeBoneTexture = nJ => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, nJ * 4, 1, 0, gl.RGBA, gl.FLOAT, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const buildVao = (p, posBuf) => {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    const B = p.bufs, att = (loc, buf, size, type, ints) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); if (ints) gl.vertexAttribIPointer(loc, size, type, 0, 0); else gl.vertexAttribPointer(loc, size, type, false, 0, 0); };
    att(0, posBuf || B.pos, 3, gl.FLOAT); att(1, B.nrm, 3, gl.FLOAT); att(2, B.col, 4, gl.FLOAT); att(3, B.uv, 2, gl.FLOAT); att(4, B.J, 4, gl.UNSIGNED_SHORT, true); att(5, B.W, 4, gl.FLOAT);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, B.idx); return v;
  };
  const vao = p => { let v = r.vaos.get(p); if (v) return v; v = buildVao(p); r.vaos.set(p, v); return v; };
  /* [创建面板] inst.posOv[网格名] = 另一份顶点位置（脸型变形），只对这个角色生效；每个角色按需生成自己的 VAO */
  const vaoFor = (inst, p) => {
    const ov = inst.posOv && inst.posOv[p.name]; if (!ov) return vao(p);
    const cache = inst.vaoOv || (inst.vaoOv = {}), e = cache[p.name];
    if (e && e.buf === ov) return e.vao;
    if (e) gl.deleteVertexArray(e.vao);
    const v = buildVao(p, ov); cache[p.name] = { buf: ov, vao: v }; return v;
  };
  r.makePosBuffer = data => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
  /* camera: { yaw, pitch, halfH (world units seen from centre to top), target:[x,y,z] } */
  r.viewProj = (cam, w, h) => {
    const V = mul(rotX(cam.pitch), mul(rotY(-cam.yaw), trans(-cam.target[0], -cam.target[1], -cam.target[2])));
    const a = w / h, P = ortho(-cam.halfH * a, cam.halfH * a, -cam.halfH, cam.halfH, -60, 60);
    return mul(P, V);
  };
  /* [创建面板] 运行时生成的贴图（人物脸部）：makeTexture(canvas) / updateTexture(tex, canvas) / deleteTexture(tex)，配合 inst.texOv 使用 */
  r.makeTexture = (src) => { const t = gl.createTexture(); r.updateTexture(t, src); return t; };
  r.updateTexture = (t, src) => {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  r.deleteTexture = t => gl.deleteTexture(t);
  r.begin = (w, h, clear) => {
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.useProgram(pr);
    if (clear) { gl.clearColor(clear[0], clear[1], clear[2], clear[3]); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  };
  r.draw = (inst, VP, o) => {
    o = o || {}; gl.useProgram(pr);
    const m = inst.model;
    const M = mul(trans(inst.pos[0], inst.pos[1], inst.pos[2]), mul(rotY(inst.yaw), scl(inst.scale, inst.scale, inst.scale)));
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniformMatrix4fv(U.uModel, false, M);
    gl.uniform3fv(U.uAmb, o.amb || [.60, .58, .78]); gl.uniform3fv(U.uSunCol, o.sun || [.40, .40, .18]); gl.uniform3fv(U.uLight, o.light || [-.45, .8, .55]); gl.uniform3fv(U.uView, o.view || [0, .5, 1]); gl.uniform3fv(U.uTint, inst.tint); gl.uniform3fv(U.uLine, o.line || [.23, .14, .17]); gl.uniform3fv(U.uRim, o.rim || [.45, .55, 1.0]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, inst.boneTex); gl.uniform1i(U.uBones, 1);
    gl.uniform1i(U.uTex, 0);
    const outW = o.outline == null ? .0034 : o.outline;
    let upSkin = -2;
    const pass = (outlinePass) => {
      gl.cullFace(outlinePass ? gl.FRONT : gl.BACK);
      for (const p of m.meshes) {
        if (inst.hidden[p.name]) continue;
        if (outlinePass && outW <= 0) continue;
        if (p.skin >= 0 && p.skin !== upSkin) { upSkin = p.skin;
          const nJ = m.skins[p.skin].joints.length; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, inst.boneTex);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nJ * 4, 1, gl.RGBA, gl.FLOAT, inst.boneData.subarray(p.skin * m.maxJoints * 16, p.skin * m.maxJoints * 16 + nJ * 16));
        }
        gl.uniform1f(U.uSkinned, p.skin >= 0 ? 1 : 0);
        if (p.skin < 0) gl.uniformMatrix4fv(U.uModel, false, mul(M, inst.world.subarray(p.node * 16, p.node * 16 + 16)));
        gl.uniform1f(U.uPass, outlinePass ? 1 : 0);
        gl.uniform1f(U.uOutline, outlinePass ? outW * (p.name.indexOf('Hair') === 0 ? .75 : p.name === 'Choker' ? .35 : 1) : 0);   // [创建面板] Hair0-4 / HairM0-1 都按头发处理
        gl.uniform4fv(U.uBase, p.base); const rc = inst.recolor && inst.recolor[p.name]; gl.uniform4fv(U.uRecol, rc || [0, 0, 0, 0]); const tn = inst.tints && inst.tints[p.name]; gl.uniform3fv(U.uTint, tn || inst.tint); gl.uniform1f(U.uMask, p.mask ? 1 : 0); gl.uniform1f(U.uCut, p.cutoff);
        const tx = (inst.texOv && inst.texOv[p.name]) || p.tex; gl.activeTexture(gl.TEXTURE0); if (tx) gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1f(U.uHasTex, tx ? 1 : 0);   // [创建面板] inst.texOv：单个角色覆盖贴图
        if (p.double) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
        gl.bindVertexArray(vaoFor(inst, p)); gl.drawElements(gl.TRIANGLES, p.count, p.itype, 0);
      }
    };
    pass(true); pass(false);
    gl.enable(gl.CULL_FACE);
  };
  return r;
}


/* ---------------- procedural actions (sit / dance / cheer / clap) ----------------
   The shipped GLB only has idle / walk / run / wave. These extra clips are generated in code from the
   skeleton, so no new animation files are needed. Rotations are authored as NET model-space rotations
   (model faces +Z, up is +Y, left side is +X) and converted to local joint rotations. */
function addActions(model) {
  if (model.anims.dance && model.anims.clap) return;
  const g = model.g, names = {}; const J = model.skins[0] ? model.skins[0].joints : [];
  J.forEach(i => { names[g.nodes[i].name] = i; });
  const qm = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qi = a => [-a[0], -a[1], -a[2], a[3]];
  const qa = (ax, deg) => { const h = deg * Math.PI / 360, s = Math.sin(h); return ax === 'x' ? [s, 0, 0, Math.cos(h)] : ax === 'y' ? [0, s, 0, Math.cos(h)] : [0, 0, s, Math.cos(h)]; };
  const ID = [0, 0, 0, 1];
  const rr = i => [model.restR[i * 4], model.restR[i * 4 + 1], model.restR[i * 4 + 2], model.restR[i * 4 + 3]];
  // rest world rotation of every node
  const Wr = new Array(model.n);
  for (const i of model.order) { const p = model.parent[i]; Wr[i] = p < 0 ? rr(i) : qm(Wr[p], rr(i)); }
  const hipsRest = [model.restT[names.hips * 3], model.restT[names.hips * 3 + 1], model.restT[names.hips * 3 + 2]];
  // D(bone) = net rotation relative to the rest pose, in model space. pitch>0 swings a hanging limb BACK, pitch<0 forward.
  const pr = (pitch, roll, yaw) => qm(qa('z', roll || 0), qm(qa('y', yaw || 0), qa('x', pitch || 0)));
  function clip(name, dur, keys) {
    const bones = new Set(); keys.forEach(k => Object.keys(k.r || {}).forEach(b => { if (names[b] != null) bones.add(b); }));
    const ch = []; const tt = keys.map(k => k.t);
    const perKey = keys.map(k => {
      const Wn = new Array(model.n), loc = {};
      for (const i of model.order) {
        const p = model.parent[i], nm = g.nodes[i].name, spec = (k.r || {})[nm];
        const desired = spec ? qm(spec, Wr[i]) : (p < 0 ? rr(i) : qm(Wn[p], rr(i)));
        Wn[i] = desired; const par = p < 0 ? ID : Wn[p];
        if (spec) loc[nm] = qm(qi(par), desired);
      }
      return loc;
    });
    bones.forEach(b => { const v = []; perKey.forEach(loc => v.push(...loc[b])); ch.push({ node: names[b], path: 'rotation', t: tt.slice(), v }); });
    if (keys.some(k => k.hips)) { const v = []; keys.forEach(k => { const h = k.hips || [0, hipsRest[1], 0]; v.push(h[0] + hipsRest[0], h[1], h[2] + hipsRest[2]); }); ch.push({ node: names.hips, path: 'translation', t: tt.slice(), v }); }
    if (!model.anims[name] || name === 'dance' || name === 'clap') model.anims[name] = { duration: dur, ch };
  }
  const arms = (s, pitchU, rollU, pitchF, rollF) => { const m = s === 'L' ? 1 : -1; return { ['upperarm.' + s]: pr(pitchU, m * rollU), ['forearm.' + s]: pr(pitchF, m * rollF) }; };
  const legs = (s, pitchT, pitchC) => ({ ['thigh.' + s]: pr(pitchT, 0), ['calf.' + s]: pr(pitchC, 0) });
  const merge = (...o) => Object.assign({}, ...o);
  // ----- sit (several seat heights): feet stay on the ground, thighs angled up from the seat -----
  const FOOT = .075, CALF = .385, THIGH = .38, HIPS = hipsRest[1];
  function sitClip(name, seatTop) {
    const hy = seatTop + .07, cb = Math.cos(8 * Math.PI / 180), c = Math.max(-1, Math.min(1, (hy - FOOT - CALF * cb) / THIGH)), alpha = Math.acos(c) * 180 / Math.PI;
    const pose = t => ({ hips: [0, hy, -.06], r: merge(legs('L', -alpha, 8), legs('R', -alpha, 8), arms('L', -20, 2, -80, -14), arms('R', -20, 2, -80, -14), { spine: pr(-2 + t, 0), head: pr(1 - t, 0) }) });
    clip(name, 3, [Object.assign({ t: 0 }, pose(0)), Object.assign({ t: 1.5 }, pose(1.6)), Object.assign({ t: 3 }, pose(0))]);
  }
  // ----- dance: hip sway, alternating raised arms and stepping legs -----
  const dance = (sw, ar, step) => ({ hips: [.06 * sw, HIPS - .008, 0], r: merge(
    arms('L', -20, 100 - 70 * (ar > 0 ? 0 : 1), -55, 120 - 70 * (ar > 0 ? 0 : 1)), arms('R', -20, 100 - 70 * (ar > 0 ? 1 : 0), -55, 120 - 70 * (ar > 0 ? 1 : 0)),
    legs('L', step > 0 ? -22 : -4, step > 0 ? 42 : 4), legs('R', step > 0 ? -4 : -22, step > 0 ? 4 : 42),
    { spine: pr(0, 7 * sw), chest: pr(0, 4 * sw), head: pr(-3, -6 * sw) }) });
  clip('dance', 1.6, [Object.assign({ t: 0 }, dance(1, 1, 1)), Object.assign({ t: .4 }, dance(0, 1, 1)), Object.assign({ t: .8 }, dance(-1, -1, -1)), Object.assign({ t: 1.2 }, dance(0, -1, -1)), Object.assign({ t: 1.6 }, dance(1, 1, 1))]);
  // ----- clap -----
  const clap = (open) => ({ r: merge(arms('L', -38, open ? 8 : -34, -98, open ? 6 : -104), arms('R', -38, open ? 8 : -34, -98, open ? 6 : -104), { head: pr(-4, 0) }) });
  clip('clap', .5, [Object.assign({ t: 0 }, clap(true)), Object.assign({ t: .22 }, clap(false)), Object.assign({ t: .5 }, clap(true))]);

  // ===== 新动作（v3）：举牌 ✔/❌、拍照、鞠躬、比心、点赞、指向，以及坐着也能做的版本（sit_xxx） =====
  // 牌子是 GLB 里的 SignOK / SignNo 两块网格，绑在 hand.R 上。做举牌动作时 hand.R 整个转 180° 让牌子朝上，
  // 牌子什么时候显示由 game.js 里按当前动作名控制。
  const HANDUP = pr(0, 180);
  const signPose = (up, nod, shake) => ({ r: merge(arms('R', -52, 20, -(160 + up), 0), arms('L', -6, 8, -16, 0), { 'hand.R': HANDUP, head: pr(nod, 0, shake), chest: pr(nod * .3, 0) }) });
  clip('signok', 1.2, [Object.assign({ t: 0 }, signPose(0, 2, 0)), Object.assign({ t: .3 }, signPose(4, 9, 0)), Object.assign({ t: .6 }, signPose(0, 2, 0)), Object.assign({ t: .9 }, signPose(4, 9, 0)), Object.assign({ t: 1.2 }, signPose(0, 2, 0))]);
  clip('signno', 1.2, [Object.assign({ t: 0 }, signPose(0, 0, 0)), Object.assign({ t: .15 }, signPose(2, 0, 14)), Object.assign({ t: .45 }, signPose(2, 0, -14)), Object.assign({ t: .75 }, signPose(2, 0, 14)), Object.assign({ t: 1.05 }, signPose(0, 0, -10)), Object.assign({ t: 1.2 }, signPose(0, 0, 0))]);
  // 拍照：右手举到脸旁比 V，头歪一点，另一只手叉腰
  const photo = (w) => ({ hips: [0, HIPS - .004, 0], r: merge(arms('R', -20, 62, -150 - w, 0), arms('L', 6, 28, -92, -50), { head: pr(-2, -9 + w * .4), spine: pr(0, 3), chest: pr(0, 2) }) });
  clip('photo', 1.2, [Object.assign({ t: 0 }, photo(0)), Object.assign({ t: .6 }, photo(5)), Object.assign({ t: 1.2 }, photo(0))]);
  // 鞠躬：弯腰 → 停一下 → 起身
  const bow = (a) => ({ hips: [0, HIPS - .016 * (a / 38), .03 * (a / 38)], r: merge({ spine: pr(a * .45), chest: pr(a), head: pr(a * 1.1) }, arms('L', -a * .5, 4, -a * .35, 0), arms('R', -a * .5, 4, -a * .35, 0)) });
  clip('bow', 2.4, [Object.assign({ t: 0 }, bow(0)), Object.assign({ t: .6 }, bow(38)), Object.assign({ t: 1.5 }, bow(38)), Object.assign({ t: 2.1 }, bow(0)), Object.assign({ t: 2.4 }, bow(0))]);
  // 比心：双臂在头上围成一个圈
  const heart = (b) => ({ hips: [0, HIPS - .004 * b, 0], r: merge(arms('L', -140, 8, -165, 36 + 4 * b), arms('R', -140, 8, -165, 36 + 4 * b), { head: pr(-3, 3 * (b ? 1 : -1)), spine: pr(0, 2 * (b ? 1 : -1)) }) });
  clip('heart', 1, [Object.assign({ t: 0 }, heart(0)), Object.assign({ t: .5 }, heart(1)), Object.assign({ t: 1 }, heart(0))]);
  // 点赞：右拳向前上方举起，轻轻上下弹
  const thumbs = (b) => ({ r: merge(arms('R', -62 - b * 6, 14, -112 - b * 8, 0), arms('L', -6, 8, -16, 0), { head: pr(-2 + b * 2, 0), spine: pr(b * 1.5) }) });
  clip('thumbs', .8, [Object.assign({ t: 0 }, thumbs(0)), Object.assign({ t: .4 }, thumbs(1)), Object.assign({ t: .8 }, thumbs(0))]);
  // 指向：右臂向前伸直，微微上下点
  const point = (b) => ({ r: merge(arms('R', -8 - b * 3, 78 + b * 3, -8, 78 + b * 3), arms('L', 4, 26, -78, -34), { head: pr(0, 0, -16), chest: pr(0, 0, -5) }) });
  clip('point', .8, [Object.assign({ t: 0 }, point(0)), Object.assign({ t: .4 }, point(1)), Object.assign({ t: .8 }, point(0))]);
  // ----- 坐着做动作：保留 sit 的腿/腰，只把手臂换成动作里的手臂 -----
  if (model.anims.sit) {
    const ARM = new Set(['upperarm.L', 'forearm.L', 'hand.L', 'upperarm.R', 'forearm.R', 'hand.R'].map(n => names[n]));
    const base = model.anims.sit, D = base.duration;
    ['wave', 'clap', 'cheer', 'signok', 'signno', 'heart', 'thumbs', 'point', 'photo'].forEach(n => {
      const a = model.anims[n]; if (!a || model.anims['sit_' + n]) return;
      const rep = Math.max(1, Math.round(D / a.duration)), sc = D / (rep * a.duration), ch = base.ch.filter(c => !ARM.has(c.node));
      a.ch.filter(c => ARM.has(c.node)).forEach(c => {
        const nc = c.path === 'rotation' ? 4 : 3, t = [], v = [];
        for (let k = 0; k < rep; k++) for (let i = 0; i < c.t.length; i++) { if (k && i === 0) continue; t.push((c.t[i] + k * a.duration) * sc); for (let j = 0; j < nc; j++) v.push(c.v[i * nc + j]); }
        ch.push({ node: c.node, path: c.path, t, v });
      });
      model.anims['sit_' + n] = { duration: D, ch };
    });
  }
}

global.GLBChar = { loadModel, makeInstance, createRenderer, parseGLB, addActions };
})(window);
