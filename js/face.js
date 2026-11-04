/* FaceGen — builds the face texture of the head mesh in real time from a few option indices / colours.
   The head mesh maps the face with a planar projection: x in [-.17,.17], y in [1.18,1.54] (metres, model space). */
(function (global) {
'use strict';
const TEX_X = .17, TEX_Y0 = 1.18, TEX_Y1 = 1.54, SKIN = [251, 217, 196];

const EYES = ['圆眼', '大眼', '杏眼', '猫眼', '垂眼', '困倦眼', '星星眼', '细长眼'];
const EYE_P = [
  { ew: .031, eh: .038, tilt: 0 },
  { ew: .034, eh: .044, tilt: 0 },
  { ew: .033, eh: .034, tilt: .12 },
  { ew: .033, eh: .031, tilt: .30, wing: 1 },
  { ew: .032, eh: .036, tilt: -.22 },
  { ew: .032, eh: .036, tilt: 0, lid: .26 },
  { ew: .033, eh: .040, tilt: 0, sparkle: 1 },
  { ew: .036, eh: .026, tilt: .08 },
];
const LASHES = ['无', '自然', '上翘', '猫眼线', '浓密'];
const BROWS = ['柔和', '平直', '粗眉', '细挑眉', '下垂眉', '英气眉'];
const BROW_P = [
  { len: .046, arch: .008, tilt: 0, w: .0034, y: 1.380 },
  { len: .048, arch: .001, tilt: 0, w: .0034, y: 1.378 },
  { len: .050, arch: .004, tilt: 0, w: .0062, y: 1.376 },
  { len: .046, arch: .012, tilt: .004, w: .0022, y: 1.388 },
  { len: .044, arch: .005, tilt: -.012, w: .0036, y: 1.380 },
  { len: .050, arch: .006, tilt: .014, w: .0044, y: 1.376 },
];
const NOSES = ['无', '小点', '小弧线', '圆鼻头', '高鼻梁'];
const MOUTHS = ['微笑', '猫嘴', '张嘴笑', '平静', '嘟嘴', '露齿笑', '小 o', '一字'];
const BLUSHES = ['无', '淡红', '浓红', '圆点', '斜线'];
const MOLES = ['无', '眼下痣', '嘴边痣'];

const EYE_COLORS = ['#7a4a2a', '#3b2a22', '#a8742f', '#3f7f5a', '#4a7bc8', '#2c4a8a', '#8a5bd0', '#d0568c', '#6a7480', '#c9a227', '#1fa5a5', '#c0392b'];
const LIP_COLORS = ['#c25a62', '#d9778a', '#a8404a', '#e0907a', '#8a4a6a', '#e8a0b0'];
const BLUSH_COLORS = ['#ff7882', '#ff9a8a', '#f06aa0', '#e0605a', '#c07adf'];

const DEFAULT = { eye: 0, eyeColor: EYE_COLORS[0], lash: 2, brow: 0, browColor: null, nose: 2, mouth: 0, lip: LIP_COLORS[0], blush: 1, blushColor: BLUSH_COLORS[0], freckles: false, mole: 0 };

const hex = h => { const c = h.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE = [255, 255, 255];

function normalize(cfg) { const c = Object.assign({}, DEFAULT, cfg || {}); c.eye = Math.max(0, Math.min(EYES.length - 1, c.eye | 0)); return c; }

function compose(cfgIn, S, hairHex) {
  const cfg = normalize(cfgIn);
  S = S || 1024;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const k = S / (2 * TEX_X), U = x => S / 2 + x * k, V = y => (TEX_Y1 - y) * k;
  ctx.fillStyle = rgba(SKIN); ctx.fillRect(0, 0, S, S);
  const dark = c => mix(c, [20, 10, 8], .55);

  // ---- blush ----
  const blobs = (cx, cy, rx, ry, col, a) => {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
  };
  const bc = hex(cfg.blushColor);
  for (const sx of [-1, 1]) {
    const bx = U(sx * .086), by = V(1.282);
    if (cfg.blush === 1) blobs(bx, by, .030 * k, .016 * k, bc, .42);
    else if (cfg.blush === 2) blobs(bx, by, .034 * k, .020 * k, bc, .70);
    else if (cfg.blush === 3) { blobs(bx, by, .017 * k, .017 * k, bc, .85); }
    else if (cfg.blush === 4) {
      ctx.strokeStyle = rgba(bc, .75); ctx.lineWidth = .0030 * k; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(bx + (i * .011 - .006) * k, by + .008 * k); ctx.lineTo(bx + (i * .011 + .006) * k, by - .008 * k); ctx.stroke(); }
    }
  }
  if (cfg.freckles) {
    ctx.fillStyle = rgba([176, 112, 84], .55);
    const pts = [[.060, 1.296], [.074, 1.304], [.088, 1.298], [.100, 1.304], [.068, 1.288], [.082, 1.291], [.096, 1.290]];
    for (const sx of [-1, 1]) for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(U(sx * x), V(y), .0020 * k, 0, 7); ctx.fill(); }
  }

  // ---- eyes ----
  const P = EYE_P[cfg.eye], base = hex(cfg.eyeColor);
  const irisTop = mix(base, [10, 6, 6], .50), irisBot = mix(base, WHITE, .42);
  const lashCol = [48, 28, 22];
  const brCol = cfg.browColor ? hex(cfg.browColor) : mix(hairHex ? hex(hairHex) : [98, 62, 44], [20, 10, 8], .35);
  for (const sx of [-1, 1]) {
    const cx = U(sx * .053), cy = V(1.322), ew = P.ew * k, eh = P.eh * k;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-sx * P.tilt);
    // eye white
    ctx.fillStyle = 'rgb(255,250,248)'; ctx.beginPath(); ctx.ellipse(0, 0, ew, eh, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, ew, eh, 0, 0, 7); ctx.clip();
    // iris
    const iw = ew * .88, ih = eh * .97, iy = eh * .05;
    const gr = ctx.createLinearGradient(0, iy - ih, 0, iy + ih); gr.addColorStop(0, rgba(irisTop)); gr.addColorStop(1, rgba(irisBot));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, iy, iw, ih, 0, 0, 7); ctx.fill();
    // pupil + lower glow
    ctx.fillStyle = 'rgb(34,20,16)'; ctx.beginPath(); ctx.ellipse(0, iy + ih * .06, iw * .45, ih * .56, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,215,.45)'; ctx.lineWidth = .004 * k; ctx.beginPath(); ctx.ellipse(0, iy, iw * .8, ih * .8, 0, .35, 2.8); ctx.stroke();
    // upper lid shadow
    const sh = ctx.createLinearGradient(0, -eh, 0, eh * .35); sh.addColorStop(0, 'rgba(30,18,14,.42)'); sh.addColorStop(1, 'rgba(30,18,14,0)');
    ctx.fillStyle = sh; ctx.fillRect(-ew, -eh, 2 * ew, eh * 1.4);
    // highlights
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-sx * iw * .36, iy - ih * .42, iw * .33, ih * .29, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(sx * iw * .40, iy + ih * .46, iw * .13, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (P.sparkle) {
      const x0 = sx * iw * .42, y0 = iy - ih * .38, r1 = iw * .24, r2 = iw * .06; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i * 45 - 90) * Math.PI / 180, r = i % 2 ? r2 : r1; ctx[i ? 'lineTo' : 'moveTo'](x0 + Math.cos(a) * r, y0 + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
    if (P.lid) { ctx.fillStyle = rgba(SKIN); ctx.fillRect(-ew * 1.2, -eh * 1.2, ew * 2.4, eh * (1.2 + 2 * P.lid - 1) ); }
    ctx.restore();
    // upper lash line
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(lashCol); ctx.lineWidth = (cfg.lash ? .0060 : .0044) * k;
    const lidY = P.lid ? -eh + 2 * eh * P.lid : 0;
    ctx.beginPath();
    if (P.lid) { ctx.moveTo(-ew * 1.04, lidY * .55); ctx.quadraticCurveTo(0, lidY + eh * .08, ew * 1.04, lidY * .55); }
    else ctx.ellipse(0, -eh * .02, ew * 1.05, eh * 1.02, 0, 188 * Math.PI / 180, 352 * Math.PI / 180);
    ctx.stroke();
    const ox = sx * ew * 1.05, oy = P.lid ? lidY * .55 : -eh * .02 + Math.sin(188 * Math.PI / 180) * 0; // outer corner
    const L = cfg.lash, w2 = k;
    ctx.lineWidth = .0042 * k;
    if (L === 2 || P.wing) { ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + sx * .014 * w2, oy - .010 * w2); ctx.lineTo(ox + sx * .022 * w2, oy - .017 * w2); ctx.stroke(); }
    else if (L === 3) { ctx.lineWidth = .0046 * k; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + sx * .016 * w2, oy - .014 * w2); ctx.lineTo(ox + sx * .026 * w2, oy - .026 * w2); ctx.stroke(); }
    else if (L === 1) { ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + sx * .010 * w2, oy + .003 * w2); ctx.lineTo(ox + sx * .016 * w2, oy + .010 * w2); ctx.stroke(); }
    else if (L === 4) {
      ctx.lineWidth = .0034 * k;
      [[.010, -.006], [.016, -.014], [.018, -.002], [.008, -.018]].forEach(([ax, ay], j) => { ctx.beginPath(); ctx.moveTo(ox - sx * .002 * w2 * j, oy + j * .002 * w2); ctx.lineTo(ox + sx * ax * w2, oy + ay * w2); ctx.stroke(); });
    }
    // lower lash + crease
    ctx.strokeStyle = 'rgba(120,76,60,.7)'; ctx.lineWidth = .0021 * k; ctx.beginPath(); ctx.ellipse(0, 0, ew * .92, eh * .98, 0, 22 * Math.PI / 180, 158 * Math.PI / 180); ctx.stroke();
    ctx.strokeStyle = 'rgba(176,110,96,.55)'; ctx.lineWidth = .0020 * k; ctx.beginPath(); ctx.ellipse(0, -eh * .10, ew * 1.15, eh * 1.2, 0, 205 * Math.PI / 180, 335 * Math.PI / 180); ctx.stroke();
    ctx.restore();
    // eyebrow
    const B = BROW_P[cfg.brow], bx = U(sx * .055), by = V(B.y), BL = B.len * k;
    ctx.strokeStyle = rgba(brCol, .88); ctx.lineWidth = B.w * k; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, xx = bx + (t - .5) * BL * -sx, yy = by - Math.sin(t * Math.PI) * B.arch * k + (t - .5) * sx * B.tilt * k * 2;
      ctx[i ? 'lineTo' : 'moveTo'](xx, yy);
    }
    ctx.stroke();
  }
  // ---- mole ----
  if (cfg.mole === 1) { ctx.fillStyle = 'rgba(70,40,34,.85)'; ctx.beginPath(); ctx.arc(U(-.068), V(1.290), .0024 * k, 0, 7); ctx.fill(); }
  if (cfg.mole === 2) { ctx.fillStyle = 'rgba(70,40,34,.85)'; ctx.beginPath(); ctx.arc(U(.030), V(1.246), .0024 * k, 0, 7); ctx.fill(); }

  // ---- nose ----
  const nx = U(0), ny = V(1.286); ctx.lineCap = 'round';
  const nc = 'rgba(214,146,128,.8)';
  if (cfg.nose === 1) { ctx.fillStyle = nc; ctx.beginPath(); ctx.arc(nx, ny, .0032 * k, 0, 7); ctx.fill(); }
  else if (cfg.nose === 2) { ctx.strokeStyle = nc; ctx.lineWidth = .0022 * k; ctx.beginPath(); ctx.ellipse(nx, ny, .006 * k, .005 * k, 0, 20 * Math.PI / 180, 160 * Math.PI / 180); ctx.stroke(); }
  else if (cfg.nose === 3) { blobs(nx, ny, .0085 * k, .0065 * k, [226, 150, 134], .55); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(nx - .0018 * k, ny - .0022 * k, .0015 * k, 0, 7); ctx.fill(); }
  else if (cfg.nose === 4) { ctx.strokeStyle = nc; ctx.lineWidth = .0022 * k; ctx.beginPath(); ctx.moveTo(nx - .001 * k, ny - .016 * k); ctx.lineTo(nx - .002 * k, ny - .002 * k); ctx.quadraticCurveTo(nx, ny + .006 * k, nx + .008 * k, ny + .002 * k); ctx.stroke(); }

  // ---- mouth ----
  const mx = U(0), my = V(1.258), lip = hex(cfg.lip), lipD = mix(lip, [40, 10, 14], .45), lipL = mix(lip, WHITE, .35);
  ctx.strokeStyle = rgba(lip); ctx.fillStyle = rgba(lip); ctx.lineCap = 'round';
  const arc = (x, y, rx, ry, a0, a1, w) => { ctx.lineWidth = w * k; ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, a0 * Math.PI / 180, a1 * Math.PI / 180); ctx.stroke(); };
  switch (cfg.mouth) {
    case 0: arc(mx, my, .018, .012, 18, 162, .0036); ctx.fillStyle = rgba(lipL, .5); ctx.beginPath(); ctx.ellipse(mx, my + .0125 * k, .005 * k, .0028 * k, 0, 0, 7); ctx.fill(); break;
    case 1: arc(mx - .0075 * k, my, .0075, .008, 0, 180, .0032); arc(mx + .0075 * k, my, .0075, .008, 0, 180, .0032); break;
    case 2: ctx.fillStyle = rgba(lipD); ctx.beginPath(); ctx.ellipse(mx, my - .001 * k, .015 * k, .013 * k, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = rgba(lipL); ctx.beginPath(); ctx.ellipse(mx, my + .009 * k, .009 * k, .0045 * k, 0, 0, Math.PI); ctx.fill(); break;
    case 3: arc(mx, my + .004 * k, .014, .008, 25, 155, .0032); break;
    case 4: ctx.fillStyle = rgba(lip); ctx.beginPath(); ctx.ellipse(mx, my + .002 * k, .0075 * k, .0058 * k, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(mx - .002 * k, my, .0014 * k, 0, 7); ctx.fill(); break;
    case 5: ctx.fillStyle = rgba(lipD); ctx.beginPath(); ctx.ellipse(mx, my - .004 * k, .019 * k, .015 * k, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(mx - .014 * k, my - .004 * k, .028 * k, .0045 * k); break;
    case 6: ctx.fillStyle = rgba(lipD); ctx.beginPath(); ctx.ellipse(mx, my + .004 * k, .006 * k, .0075 * k, 0, 0, 7); ctx.fill(); ctx.strokeStyle = rgba(lip); ctx.lineWidth = .0022 * k; ctx.stroke(); break;
    case 7: ctx.lineWidth = .0034 * k; ctx.beginPath(); ctx.moveTo(mx - .011 * k, my + .004 * k); ctx.lineTo(mx + .011 * k, my + .004 * k); ctx.stroke(); break;
  }
  return cv;
}

// crop regions (texture metres) used for the menu thumbnails
const REGION = { eye: [-.10, .10, 1.292, 1.40], brow: [-.10, .10, 1.350, 1.410], nose: [-.04, .04, 1.270, 1.302], mouth: [-.04, .04, 1.236, 1.280], blush: [-.13, .13, 1.255, 1.315], mole: [-.12, .12, 1.230, 1.320] };
function thumb(cfg, part, W, H, hairHex) {
  const S = 512, k = S / (2 * TEX_X), r = REGION[part] || REGION.eye, src = compose(cfg, S, hairHex);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const x0 = (S / 2 + r[0] * k), x1 = (S / 2 + r[1] * k), y0 = (TEX_Y1 - r[3]) * k, y1 = (TEX_Y1 - r[2]) * k;
  out.getContext('2d').drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, W, H);
  return out;
}

global.FaceGen = { compose, thumb, normalize, DEFAULT, EYES, LASHES, BROWS, NOSES, MOUTHS, BLUSHES, MOLES, EYE_COLORS, LIP_COLORS, BLUSH_COLORS };
})(window);
