/* ============================================================================
   creator.js  —  character-creation panel ("创建人物 / 换装"): left = live 3D preview, right = option menu.
   ----------------------------------------------------------------------------
   WHERE IT IS USED
     * Opened from the 换装 button / wardrobe mirror:  game.js openWardrobe() -> Creator.open().
       (For a brand-new account call Creator.open() on first entry — the panel edits G.me.outfit live and saves it.)
     * game.js render loop, right after render():   if (Creator.isOpen()) Creator.drawPreview(dt);
     * game.js boot, after the DOM exists:           Creator.init({G, $, store, closePanels, drawPortrait}); Creator.bind();
   REQUIREMENTS
     * index.html must contain the <section id="creator"> markup (see creator.html) and css/creator.css must be loaded.
     * js/face.js, js/outfit.js loaded before this file.  Needs G.GR (GLBChar renderer), G.R.gl / G.R.canvas (main WebGL canvas),
       G.me (player entity: {inst, outfit}), G.owned (array of unlocked set ids, e.g. ['hoodie']).
     * The preview re-uses the main WebGL canvas: it renders the player into a small viewport and copies it to <canvas id="cPrev">.
   SAVING: every change calls  store.set('outfit', outfit)  — replace this with your server call when you go online.
   ============================================================================ */
(function (global) {
'use strict';
let G, $, store, closePanels, drawPortrait;
const { SKIN, HAIRS, DEFAULT_HAIR, TOPS, BOTS, SOCKS, SHOES, CHAR_NAMES, MALE_NAMES, HAIR_NAMES, MHAIR_NAMES, EAR_NAMES, SHAPE_NAMES, applyOutfit, randomOutfit } = global.Outfit;
const pick = a => a[(Math.random() * a.length) | 0];
/* ---------------- character creator (left: live preview, right: option menu) ---------------- */
const CR = { open: false, tab: 'base', yaw: .35, zoom: 0, zoomTarget: 0, drag: null, thumbs: new Map() };
const CR_TABS = [['base', '基础'], ['shape', '脸型'], ['eye', '眼睛'], ['brow', '眉毛'], ['nose', '鼻子'], ['mouth', '嘴巴'], ['cheek', '脸颊'], ['hair', '发型'], ['ear', '耳朵'], ['cloth', '服装']];
const CR_FACE_TABS = ['shape', 'eye', 'brow', 'nose', 'mouth', 'cheek', 'hair', 'ear'];
function openCreator() {
  if (!G.me) return;
  closePanels(); CR.open = true; $('creator').hidden = false; CR.zoomTarget = CR_FACE_TABS.includes(CR.tab) ? 1 : 0; renderCreator();
}
function closeCreator() { CR.open = false; $('creator').hidden = true; store.set('outfit', G.me.outfit); drawPortrait(); }
function renderCreator() {
  const o = G.me.outfit; o.face = FaceGen.normalize(o.face);
  const tabs = $('cTabs'), body = $('cBody'), scroll = body.scrollTop;
  tabs.innerHTML = ''; CR_TABS.forEach(([k, t]) => { const b = document.createElement('button'); b.className = 'ctab' + (CR.tab === k ? ' on' : ''); b.textContent = t; b.onclick = () => { CR.tab = k; CR.zoomTarget = CR_FACE_TABS.includes(k) ? 1 : 0; body.scrollTop = 0; renderCreator(); }; tabs.appendChild(b); });
  body.innerHTML = '';
  const hairHex = o.hair || DEFAULT_HAIR;
  const commit = (re) => { applyOutfit(G.me.inst, o); store.set('outfit', o); renderCreator(); };
  const sec = (title) => { const h = document.createElement('h4'); h.textContent = title; body.appendChild(h); const d = document.createElement('div'); d.className = 'cgrid'; body.appendChild(d); return d; };
  const swatches = (host, list, cur, pick_, allowAuto, customKey) => {
    if (allowAuto) { const b = document.createElement('button'); b.className = 'sw def' + (!cur ? ' on' : ''); b.title = '默认'; b.onclick = () => pick_(null); host.appendChild(b); }
    list.forEach(c => { const b = document.createElement('button'); b.className = 'sw' + (cur === c ? ' on' : ''); b.style.background = c; b.onclick = () => pick_(c); host.appendChild(b); });
    if (customKey) { const l = document.createElement('label'); l.className = 'sw custom' + (cur && !list.includes(cur) ? ' on' : ''); l.title = '自定义颜色'; l.textContent = '+'; const i = document.createElement('input'); i.type = 'color'; i.value = cur || list[0]; i.onchange = () => pick_(i.value); l.appendChild(i); host.appendChild(l); }
  };
  const chipsRow = (host, names, cur, fn) => names.forEach((n, i) => { const b = document.createElement('button'); b.className = 'chip' + (cur === i ? ' on' : ''); b.textContent = n; b.onclick = () => fn(i); host.appendChild(b); });
  const thumbGrid = (host, part, key, names) => names.forEach((n, i) => {
    const cfg = Object.assign({}, o.face, { [key]: i }), ck = part + JSON.stringify(cfg) + hairHex; let cv = CR.thumbs.get(ck);
    if (!cv) { cv = FaceGen.thumb(cfg, part, 120, 64, hairHex); if (CR.thumbs.size > 400) CR.thumbs.clear(); CR.thumbs.set(ck, cv); }
    const b = document.createElement('button'); b.className = 'topt' + (o.face[key] === i ? ' on' : ''); const c2 = document.createElement('canvas'); c2.width = 120; c2.height = 64; c2.getContext('2d').drawImage(cv, 0, 0); b.appendChild(c2);
    const sp = document.createElement('span'); sp.textContent = n; b.appendChild(sp); b.onclick = () => { o.face[key] = i; commit(); }; host.appendChild(b);
  });
  const setFace = (k, v) => { o.face[k] = v; commit(); };
  const male = o.gender === 'm';
  switch (CR.tab) {
    case 'base': {
      chipsRow(sec('性别'), ['女生', '男生'], male ? 1 : 0, i => { o.gender = i ? 'm' : 'f'; commit(); });
      const h = sec('肤色'); SKIN.forEach((s, i) => { const b = document.createElement('button'); b.className = 'sw' + ((o.skin || 0) === i ? ' on' : ''); b.style.background = `rgb(${251 * s[0] | 0},${217 * s[1] | 0},${196 * s[2] | 0})`; b.onclick = () => { o.skin = i; commit(); }; h.appendChild(b); });
      const p = document.createElement('p'); p.className = 'hint'; p.textContent = '人物身高、头身比对所有玩家固定（标准尺寸），不能调整。'; body.appendChild(p); break;
    }
    case 'shape': chipsRow(sec('脸型（耳朵和头发会跟着变）'), SHAPE_NAMES, o.shape | 0, i => { o.shape = i; commit(); }); break;
    case 'eye': thumbGrid(sec('眼型'), 'eye', 'eye', FaceGen.EYES); swatches(sec('眼睛颜色'), FaceGen.EYE_COLORS, o.face.eyeColor, c => setFace('eyeColor', c), false, true); thumbGrid(sec('睫毛'), 'eye', 'lash', FaceGen.LASHES); break;
    case 'brow': thumbGrid(sec('眉形'), 'brow', 'brow', FaceGen.BROWS); swatches(sec('眉毛颜色（默认跟随发色）'), ['#2a1a14', '#5b3a29', '#8a5a3a', '#d8b26a', '#c94f6a', '#4a90d9'], o.face.browColor, c => setFace('browColor', c), true, true); break;
    case 'nose': thumbGrid(sec('鼻子'), 'nose', 'nose', FaceGen.NOSES); break;
    case 'mouth': thumbGrid(sec('嘴型'), 'mouth', 'mouth', FaceGen.MOUTHS); swatches(sec('唇色'), FaceGen.LIP_COLORS, o.face.lip, c => setFace('lip', c), false, true); break;
    case 'cheek': {
      thumbGrid(sec('腮红'), 'blush', 'blush', FaceGen.BLUSHES); swatches(sec('腮红颜色'), FaceGen.BLUSH_COLORS, o.face.blushColor, c => setFace('blushColor', c), false, true);
      chipsRow(sec('雀斑'), ['无', '有'], o.face.freckles ? 1 : 0, i => setFace('freckles', !!i)); thumbGrid(sec('痣'), 'mole', 'mole', FaceGen.MOLES); break;
    }
    case 'hair': {
      if (male) chipsRow(sec('发型'), MHAIR_NAMES, o.mhair | 0, i => { o.mhair = i; commit(); }); else chipsRow(sec('发型'), HAIR_NAMES, o.hairStyle | 0, i => { o.hairStyle = i; commit(); });
      swatches(sec('发色'), HAIRS, o.hair || DEFAULT_HAIR, c => { o.hair = c; commit(); }, false, true); break;
    }
    case 'ear': chipsRow(sec('耳朵'), EAR_NAMES, o.ear | 0, i => { o.ear = i; commit(); }); { const p = document.createElement('p'); p.className = 'hint'; p.textContent = '猫耳颜色跟随发色，其他耳朵跟随肤色。'; body.appendChild(p); } break;
    case 'cloth': {
      if (!male) {
        if (G.owned.includes('hoodie')) chipsRow(sec('套装'), ['日常', '蓝色卫衣套装'], o.set === 'hoodie' ? 1 : 0, i => { o.set = i ? 'hoodie' : null; commit(); });
        else { const h = sec('套装'); const b = document.createElement('button'); b.className = 'chip'; b.textContent = '🎁 领取 蓝色卫衣套装'; b.onclick = () => { G.owned.push('hoodie'); store.set('owned', G.owned); o.set = 'hoodie'; commit(); }; h.appendChild(b); }
        chipsRow(sec('下装'), ['短裤', '短裙'], o.bottomType === 'skirt' ? 1 : 0, i => { o.bottomType = i ? 'skirt' : 'shorts'; commit(); });
        chipsRow(sec('项圈'), ['不戴', '戴'], o.choker ? 1 : 0, i => { o.choker = !!i; commit(); });
      }
      swatches(sec('上衣颜色'), TOPS, o.top, c => { o.top = c; commit(); }, true); swatches(sec('下装颜色'), BOTS, o.bottom, c => { o.bottom = c; commit(); }, true); swatches(sec('鞋子颜色'), SHOES, o.shoes, c => { o.shoes = c; commit(); }, true); if (!male) swatches(sec('袜子颜色'), SOCKS, o.socks, c => { o.socks = c; commit(); }, true); break;
    }
  }
  body.scrollTop = scroll;
}
function creatorRandom() { const r = randomOutfit(), o = G.me.outfit; r.set = G.owned.includes('hoodie') ? r.set : null; Object.assign(o, r); applyOutfit(G.me.inst, o); store.set('outfit', o); renderCreator(); }
function drawCreatorPreview(dt) {
  const cv = $('cPrev'), me = G.me, gl = G.R.gl, GR = G.GR, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = Math.max(64, Math.round(cv.clientWidth * dpr)), H = Math.max(64, Math.round(cv.clientHeight * dpr));
  const mc = G.R.canvas, k = Math.min(1, mc.width / W, mc.height / H); W = Math.max(32, Math.floor(W * k)); H = Math.max(32, Math.floor(H * k));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  CR.zoom += (CR.zoomTarget - CR.zoom) * Math.min(1, dt * 7);
  const z = CR.zoom, halfH = 1.18 + (.36 - 1.18) * z, ty = 1.02 + (1.78 - 1.02) * z;
  const old = me.inst.pos.slice(), oy = me.inst.yaw; me.inst.pos = [0, 0, 0]; me.inst.yaw = CR.yaw;
  gl.viewport(0, 0, W, H); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, W, H); gl.clearColor(.17, .16, .40, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  const vp = GR.viewProj({ yaw: 0, pitch: 0, halfH, target: [0, ty, 0] }, W, H);
  GR.draw(me.inst, vp, { outline: Math.max(.002, 2 * halfH / H * 1.7), amb: [.66, .64, .80], sun: [.46, .42, .26], line: [.23, .14, .17], light: [-.3, .5, 1], view: [0, 0, 1] });
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H); ctx.drawImage(mc, 0, mc.height - H, W, H, 0, 0, W, H);
  gl.disable(gl.SCISSOR_TEST); me.inst.pos = old; me.inst.yaw = oy;
}
function bindCreator() {
  const cv = $('cPrev');
  cv.addEventListener('pointerdown', e => { CR.drag = { x: e.clientX, id: e.pointerId }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (CR.drag && e.pointerId === CR.drag.id) { CR.yaw += (e.clientX - CR.drag.x) * .012; CR.drag.x = e.clientX; } });
  const end = e => { if (CR.drag && e.pointerId === CR.drag.id) CR.drag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $('cDone').onclick = closeCreator; $('cRand').onclick = creatorRandom;
  $('cZoomBody').onclick = () => { CR.zoomTarget = 0; }; $('cZoomFace').onclick = () => { CR.zoomTarget = 1; };
  ['keydown', 'keyup'].forEach(t => $('creator').addEventListener(t, e => e.stopPropagation()));
}
global.Creator = {
  init: c => { G = c.G; $ = c.$; store = c.store; closePanels = c.closePanels; drawPortrait = c.drawPortrait; },
  open: openCreator, close: closeCreator, isOpen: () => CR.open, drawPreview: drawCreatorPreview, bind: bindCreator, render: renderCreator,
};
})(window);
