/* ============================================================================
   outfit.js  —  "Outfit" module: everything that turns an `outfit` object into what you see on a character.
   ----------------------------------------------------------------------------
   WHERE IT IS USED
     * game.js calls  Outfit.init(G)  once, right after the global game state `G` exists.
     * game.js calls  Outfit.applyOutfit(inst, outfit)  for EVERY character (the player and every NPC) right after
       GLBChar.makeInstance(...) — see makeEntity() — and again whenever the outfit changes (character creator does this).
     * game.js uses  Outfit.DEFAULT_OUTFIT  (merged with the saved outfit for the player) and  Outfit.randomOutfit()  (NPCs).
     * creator.js (the character-creation panel) reads the palettes / name lists exported here.
   REQUIREMENTS
     * js/face.js (FaceGen) must be loaded BEFORE this file.   * GLBChar renderer must have makeTexture/updateTexture/deleteTexture (glbchar.js patch).
     * The GLB must contain the meshes listed in MESH NAMES below (girl.glb v4+).
   THE OUTFIT OBJECT (this is what you save / send to the server):
     { gender:'f'|'m', hairStyle:0-9 (girl), mhair:0-9 (boy), ear:0-6, shape:0-11 (face shape), face:{...FaceGen options...}, hair:'#rrggbb'|null,
       skin:0-7, set:null|'hoodie', top,bottom,shoes:'#rrggbb'|null, bottomType:'shorts'|'skirt', choker:bool, scale:1 }
   MESH NAMES (toggled through inst.hidden[name]):
     girl : Body Head0 Hair0-9 Top Shorts Skirt Shoes Choker (Socks always hidden)      boy : BodyM HeadM0 HairM0-9 TopM ShortsM
     hoodie set (girl, unlocked): HoodieTop HoodieShorts HoodieSocks HoodieShoes Bow     ears: EarStd EarElf EarCat EarBig EarSmall EarWing EarPoint
     Face texture: NOT in the GLB — FaceGen draws it at runtime and it is bound to Head0 / HeadM0 via inst.texOv.
   ============================================================================ */
(function (global) {
'use strict';
let G = null;                                   // set by Outfit.init(G)
const pick = a => a[(Math.random() * a.length) | 0];
const SKIN = [[1, 1, 1], [.96, .88, .8], [.88, .74, .62], [.78, .62, .5], [.97, .93, .88], [.70, .55, .45], [.62, .48, .40], [.52, .40, .33]];   // 前 4 个和原来游戏里的肤色一致（老玩家的肤色不变），后 4 个是新增
const HAIRS = ['#141414', '#2a1a14', '#5b3a29', '#8a5a3a', '#b5793f', '#d8b26a', '#eed9a0', '#e8e8f0', '#c94f6a', '#ff8fb8', '#d8412f', '#ff9d5c', '#3b3f7a', '#4a90d9', '#4bb89a', '#7a4fd0'];
const DEFAULT_HAIR = '#5b3a29', STANDARD_SCALE = 1.3;   // STANDARD_SCALE = the one fixed character size for everybody (model is ~1.54 m tall, ~4.5 heads)
const TOPS = ['#ef6a5b', '#2fb3a3', '#f6b92b', '#6c8cf0', '#c779d9', '#ff9d5c', '#5ac26e', '#f4f4f8', '#2b2b3a', '#ff7ab6'];
const BOTS = ['#f4f4f8', '#2d3a5a', '#3d5a4a', '#e8a0b8', '#2b2b3a', '#c9b48a', '#8b5cf6'];
const SOCKS = ['#6c8cf0', '#f4f4f8', '#2b2b3a', '#ff7ab6', '#5ac26e', '#f6b92b'];
const SHOES = ['#f4f4f8', '#2b2b3a', '#ef6a5b', '#6c8cf0', '#f6b92b'];
function rgb(hexc, k) { const c = hexc.replace('#', ''); return [parseInt(c.slice(0, 2), 16) / 255 * (k || 1), parseInt(c.slice(2, 4), 16) / 255 * (k || 1), parseInt(c.slice(4, 6), 16) / 255 * (k || 1)]; }
const CHAR_NAMES = ['米米', '露娜', '糖糖', '小空', '珍珠'];   // girl.glb still contains Head0-4 (only Head0 is used; its face texture is drawn at runtime)
const MALE_NAMES = ['阿翔', '小宇'];   // HeadM0-1 (only HeadM0 is used)
const HAIR_NAMES = ['波波头', '长卷发', '双马尾', '高马尾', '丸子头', '精灵短发', '侧边麻花辫', '姬发式长直', '侧马尾', '蓬蓬卷发'];   // 女生 Hair0-9
const MHAIR_NAMES = ['短发', '刺猬头', '寸头', '油头背头', '韩系中分', '武士丸子头', '爆炸头', '狼尾', '斜刘海遮眼', '莫西干'];   // 男生 HairM0-9
const EAR_NAMES = ['标准耳', '精灵耳', '猫耳', '大耳', '小耳', '招风耳', '尖耳'], EAR_MESH = ['EarStd', 'EarElf', 'EarCat', 'EarBig', 'EarSmall', 'EarWing', 'EarPoint'];   // 旧存档里 0/1/2 的意思不变
/* 脸型：[名字, 下颌宽, 颧骨宽, 额头宽, 下巴长, 脸长]；用同一组参数变形头 / 耳朵 / 头发的顶点，所以耳朵和头发会跟着脸型走 */
const SHAPES = [['鹅蛋脸', 0, 0, 0, 0, 1], ['圆脸', .06, .08, 0, -.3, .94], ['瓜子脸', -.14, -.02, 0, .8, 1.03], ['方脸', .10, .03, 0, -.2, 1], ['心形脸', -.16, .04, .05, .5, 1], ['长脸', -.04, 0, 0, 0, 1.1],
  ['菱形脸', -.12, .07, -.06, .4, 1], ['娃娃脸', .02, .10, 0, -.4, .9], ['尖下巴', -.2, 0, 0, 1.0, 1], ['梨形脸', .08, 0, -.07, 0, 1], ['小V脸', -.22, -.04, 0, .6, 1.05], ['国字脸', .12, .10, 0, -.3, 1]];
const SHAPE_NAMES = SHAPES.map(s => s[0]);
const shapeBufs = new Map();
function shapeBuffer(prim, si) {          // 变形后的顶点位置（按 网格名+脸型 缓存，所有角色共用）
  const key = prim.name + '|' + si; let b = shapeBufs.get(key); if (b) return b;
  const [, jaw, cheek, fore, chin, len] = SHAPES[si], P = Float32Array.from(prim.pos0);
  const ss = (a, c, x) => { x = Math.max(0, Math.min(1, (x - a) / (c - a))); return x * x * (3 - 2 * x); };
  for (let v = 0; v < P.length; v += 3) {
    let x = P[v], y = P[v + 1]; const t = (y - 1.195) / .345;
    x *= 1 + jaw * (1 - ss(.18, .5, t)) + cheek * ss(.15, .42, t) * (1 - ss(.55, .8, t)) + fore * ss(.55, .85, t);
    y -= chin * .03 * (1 - ss(0, .35, t)); y = 1.37 + (y - 1.37) * len; P[v] = x; P[v + 1] = y;
  }
  b = G.GR.makePosBuffer(P); shapeBufs.set(key, b); return b;
}
const faceCache = new Map();
function faceTexFor(inst, o, hairHex) {
  const face = FaceGen.normalize(o.face), key = JSON.stringify(face) + hairHex;
  if (inst.isMe) {
    if (inst._faceKey === key) return inst.meTex;
    const cv = FaceGen.compose(face, 768, hairHex);
    if (!inst.meTex) inst.meTex = G.GR.makeTexture(cv); else G.GR.updateTexture(inst.meTex, cv);
    inst._faceKey = key; return inst.meTex;
  }
  let t = faceCache.get(key);
  if (!t) { if (faceCache.size > 60) { for (const [k, v] of faceCache) { G.GR.deleteTexture(v); faceCache.delete(k); } } t = G.GR.makeTexture(FaceGen.compose(face, 320, hairHex)); faceCache.set(key, t); }
  return t;
}
function applyOutfit(inst, o) {
  inst.recolor = {}; inst.tints = {};
  const male = o.gender === 'm', set = !male && o.set === 'hoodie', skirt = o.bottomType === 'skirt';
  const mod = (v, n) => ((v | 0) % n + n) % n;
  const hs = mod(o.hairStyle, HAIR_NAMES.length), mh = mod(o.mhair, MHAIR_NAMES.length), ear = mod(o.ear, EAR_MESH.length), si = mod(o.shape, SHAPES.length);
  const hairHex = o.hair || DEFAULT_HAIR;
  const rc = (name, hexc, k) => { if (hexc) { const c = rgb(hexc, k || 1).map(v => Math.min(v, 1.3)); inst.recolor[name] = [c[0], c[1], c[2], .92]; } };
  rc('Hair' + hs, hairHex, 2.1); rc('HairM' + mh, hairHex, 2.1); rc('EarCat', hairHex, 2.1);
  rc('Socks', o.socks, 1); rc('Top', o.top, 1); rc('TopM', o.top, 1); rc('Shorts', o.bottom, 1); rc('ShortsM', o.bottom, 1); rc('Skirt', o.bottom, 1); rc('Shoes', o.shoes, 1);
  const sk = SKIN[o.skin || 0]; inst.tints.Body = sk; inst.tints.BodyM = sk; EAR_MESH.forEach(n => { if (n !== 'EarCat') inst.tints[n] = sk; });
  const tex = faceTexFor(inst, o, hairHex); inst.texOv = { Head0: tex, HeadM0: tex };
  const hid = (n, v) => { inst.hidden[n] = !!v; };
  hid('Body', male);
  for (let i = 0; i < CHAR_NAMES.length; i++) { inst.tints['Head' + i] = sk; hid('Head' + i, male || i !== 0); }
  for (let i = 0; i < HAIR_NAMES.length; i++) hid('Hair' + i, male || i !== hs);
  hid('Top', male || set); hid('Shorts', male || set || skirt); hid('Skirt', male || set || !skirt);
  hid('Socks', male || set); hid('Choker', male || !(set || o.choker));
  hid('HoodieTop', !set); hid('HoodieShorts', !set); hid('HoodieSocks', !set); hid('HoodieShoes', !set); hid('Bow', !set);
  hid('Shoes', set);
  hid('BodyM', !male); hid('TopM', !male); hid('ShortsM', !male);
  for (let i = 0; i < MALE_NAMES.length; i++) { inst.tints['HeadM' + i] = sk; hid('HeadM' + i, !male || i !== 0); }
  for (let i = 0; i < MHAIR_NAMES.length; i++) hid('HairM' + i, !male || i !== mh);
  EAR_MESH.forEach((n, i) => hid(n, i !== ear));
  // 脸型：头 / 当前耳朵 / 当前头发 用变形后的顶点（鹅蛋脸 = 原始形状，不需要额外缓冲）
  inst.posOv = {};
  if (si) for (const p of inst.model.meshes) {
    if (!p.pos0 || inst.hidden[p.name]) continue;
    inst.posOv[p.name] = shapeBuffer(p, si);
  }
  inst.scale = (o.scale || 1) * STANDARD_SCALE;
}
const DEFAULT_OUTFIT = { gender: 'f', hairStyle: 0, mhair: 0, ear: 0, shape: 0, face: {}, set: null, hair: null, top: null, bottom: null, shoes: null, bottomType: 'shorts', choker: true, skin: 0, scale: 1 };
function randomOutfit() {
  const F = FaceGen, ri = n => (Math.random() * n) | 0;
  const face = { eye: ri(F.EYES.length), eyeColor: pick(F.EYE_COLORS), lash: ri(F.LASHES.length), brow: ri(F.BROWS.length), nose: ri(F.NOSES.length), mouth: ri(F.MOUTHS.length), lip: pick(F.LIP_COLORS), blush: ri(F.BLUSHES.length), blushColor: pick(F.BLUSH_COLORS), freckles: Math.random() < .15, mole: Math.random() < .8 ? 0 : 1 + ri(F.MOLES.length - 1) };
  return { gender: Math.random() < .3 ? 'm' : 'f', hairStyle: ri(HAIR_NAMES.length), mhair: ri(MHAIR_NAMES.length), ear: Math.random() < .6 ? 0 : 1 + ri(EAR_NAMES.length - 1), shape: ri(SHAPES.length), face, set: Math.random() < .2 ? 'hoodie' : null, hair: pick(HAIRS), top: pick(TOPS), bottom: pick(BOTS), shoes: pick(SHOES), bottomType: Math.random() < .45 ? 'skirt' : 'shorts', choker: Math.random() < .4, skin: ri(SKIN.length), scale: 1 };
}

global.Outfit = { init: g => { G = g; }, SKIN, HAIRS, DEFAULT_HAIR, STANDARD_SCALE, TOPS, BOTS, SOCKS, SHOES, CHAR_NAMES, MALE_NAMES, HAIR_NAMES, MHAIR_NAMES, EAR_NAMES, SHAPE_NAMES, DEFAULT_OUTFIT, applyOutfit, randomOutfit, rgb };
})(window);
