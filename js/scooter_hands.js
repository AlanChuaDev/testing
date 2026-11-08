/* scooter_hands.js — 骑行第一人称视角里的「手 + 前臂」：程序化建模，随车把转向。
   Hands.build(skinRGB, sleeveRGB) → { hand: MB }（两只手合并，局部坐标 = 踏板局部坐标，已握在握把上，直行姿态）
   Hands.emit(T, H, x, y, z, yaw, scale, o)  → 把手随转向角转动后追加到目标网格 T（含动态前臂）
        o = { steer（正 = 向左）, press（右手拇指按油门 0..1）, pitch, roll }
   手的结构：手掌（放样）+ 大小鱼际 + 4 根手指（沿握把圆周包裹，三节 + 指关节）+ 拇指（搭在油门 / 车铃侧）+ 手腕 + 前臂 + 袖口。 */
(function (G) {
'use strict';
const S = G.Scooter, { MB } = G.World, GE = S.GEOM, PI = Math.PI;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulc = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];

/* 握把中心线：u = 0（外端）… .085（内端）；s = +1 左手 / -1 右手 */
const GU = .085;
const grip = (s, u) => { const t = u / GU; return [s * (GE.GRIP_OUT - u), 1.004 - .005 * t, .240 + .015 * t]; };

function buildHand(B, mb, s, skin, press) {
  const skinD = mulc(skin, .86), skinL = mulc(skin, 1.06), nail = mix(skin, [1, .86, .86], .55);
  const R0 = GE.GRIP_R;
  /* ---- 手掌：沿 z 放样（x 方向 = 握把方向），盖在握把上方 ---- */
  const cx = grip(s, .0425)[0];
  const sec = (z, y, rx, ry, n) => ({ c: [cx, y, z], rx, ry, n: n || 2.6 });
  B.loft(mb, [sec(.140, 1.052, .024, .020, 2.2), sec(.165, 1.052, .032, .0185), sec(.195, 1.048, .039, .0165), sec(.225, 1.041, .0425, .0150), sec(.252, 1.0345, .0435, .0135), sec(.268, 1.029, .0420, .0115, 2.4)], skin, 20);
  /* 大鱼际（拇指根部肌肉）+ 小鱼际（小指侧）*/
  B.ellip(mb, [grip(s, .074)[0], 1.032, .205], [.019, .0125, .034], skin, 8);
  B.ellip(mb, [grip(s, .010)[0], 1.030, .222], [.014, .0105, .036], skinD, 8);
  /* ---- 四指：沿握把圆周包裹（θ 自顶面向前、向下、回到掌心）---- */
  const FING = [  // u 位置, 半径, 弧末端角, 色
    { u: .0715, r: .0098, e: 3.55 }, { u: .0495, r: .0102, e: 3.70 }, { u: .0285, r: .0097, e: 3.55 }, { u: .0085, r: .0083, e: 3.25 }];
  FING.forEach(f => {
    const c = grip(s, f.u), pts = [], N = 15, th0 = .22;
    for (let k = 0; k <= N; k++) {
      const t = k / N, th = th0 + (f.e - th0) * t, rad = f.r * (1 - .22 * t), R = R0 + rad * .92;
      pts.push([c[0], c[1] + R * Math.cos(th), c[2] + R * Math.sin(th)]);
    }
    /* 手指起点从掌面连过来 */
    pts.unshift([c[0], c[1] + .0215, c[2] - .014]);
    B.tube(mb, pts, t => f.r * (1.02 - .24 * t), skin, 10, true, 2);
    /* 指关节（鼓出一点）*/
    B.ellip(mb, [c[0], c[1] + (R0 + f.r * .75) * Math.cos(.28), c[2] + (R0 + f.r * .75) * Math.sin(.28) + .001], [f.r * .98, f.r * .9, f.r * .98], skinL, 8);
    [.9, 1.75].forEach(th => B.ellip(mb, [c[0], c[1] + (R0 + f.r * .8) * Math.cos(th), c[2] + (R0 + f.r * .8) * Math.sin(th)], [f.r * .93, f.r * .78, f.r * .78], skin, 6));
  });
  /* ---- 拇指：从大鱼际向前、向内，搭在油门 / 车铃侧 ---- */
  const ti = grip(s, .083), y0 = 1.030, dp = press ? .0085 * press : 0;
  const tp = [[ti[0] - s * .002, y0 - .002, .190], [ti[0] - s * .010, y0 + .006, .222], [ti[0] - s * .024, y0 + .010, .252], [ti[0] - s * .038, y0 + .0035 - dp * .7, .272], [ti[0] - s * .048, y0 - .0015 - dp, .284]];
  B.tube(mb, tp, t => .0112 - .0027 * t, skin, 10, true, 3);
  B.ellip(mb, [tp[2][0], tp[2][1] + .004, tp[2][2]], [.0108, .0098, .0108], skinL, 8);   // 拇指关节
  { const e = tp[tp.length - 1], d = [tp[4][0] - tp[3][0], tp[4][1] - tp[3][1], tp[4][2] - tp[3][2]]; B.push().T(e[0] - d[0] * .15, e[1] + .0055, e[2] - d[2] * .15).RY(Math.atan2(d[0], d[2])).RX(-.12); B.ellip(mb, [0, 0, 0], [.0078, .0028, .0098], nail, 7); B.pop(); }   // 拇指指甲
}

/* 构建双手（skin: [r,g,b]）*/
function build(skin, sleeve) {
  const B = new S.Build(), out = { L: new MB(), R: new MB(), RP: new MB(), skin, sleeve };
  buildHand(B, out.L, 1, skin, 0); buildHand(B, out.R, -1, skin, 0); buildHand(B, out.RP, -1, skin, 1);
  return out;
}

/* 追加：steer = 转向弧度（正 = 向左）。手网格随转向绕立杆旋转；前臂每帧重建（肘固定、腕随把）*/
function emit(T, H, x, y, z, yaw, scale, o) {
  o = o || {}; const st = o.steer || 0, M = st ? S.rotAbout(GE.STEER_P, GE.STEER_D, st) : null, pres = M ? [M] : null;
  const sc = scale || 1, P = o.press || 0, pr = pres;
  S.emit(T, H.L, x, y, z, yaw, sc, o.pitch, o.roll, pr);
  S.emit(T, P > .05 ? H.RP : H.R, x, y, z, yaw, sc, o.pitch, o.roll, pr);
  /* 前臂：腕点（把转后）→ 肘（固定在骑手身体上）*/
  const B = new S.Build(), tmp = new MB();
  const apply = p => { if (!M) return p; const R = M.R, t = M.t; return [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + t[2]]; };
  [1, -1].forEach(s => {
    const cx = grip(s, .0425)[0], W = apply([cx, 1.052, .148]), E = [s * .268, .905, -.150], mid = [(W[0] * .45 + E[0] * .55), (W[1] * .45 + E[1] * .55) + .012, (W[2] * .45 + E[2] * .55)];
    const pts = [[W[0], W[1], W[2] + .012], W, mid, E];
    const cut = .30;   // 袖口位置（沿前臂）
    const A = [W, mid, E], pa = t => { const u = t * 2; return u < 1 ? [0, 1, 2].map(k => A[0][k] + (A[1][k] - A[0][k]) * u) : [0, 1, 2].map(k => A[1][k] + (A[2][k] - A[1][k]) * (u - 1)); };
    const pl = []; for (let k = 0; k <= 10; k++) pl.push(pa(k / 10 * cut)); pl.unshift([W[0], W[1], W[2] + .012]);
    B.tube(tmp, pl, t => .0255 + .008 * t, H.skin, 12, false, 2);
    const ps = []; for (let k = 0; k <= 10; k++) ps.push(pa(cut + (1 - cut) * k / 10));
    B.tube(tmp, ps, t => .0395 + .011 * t, H.sleeve, 14, true, 2);
    B.tube(tmp, [pa(cut - .004), pa(cut + .02)], .0415, mulc(H.sleeve, .8), 14, true);   // 袖口卷边
    void pts;
  });
  S.emit(T, tmp, x, y, z, yaw, sc, o.pitch, o.roll, null);
}
S.hands = { build, emit, grip };
})(window);
