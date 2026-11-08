/* haunted_game.js — 鬼屋玩法：手电筒/电量、三件祭物、红衣女鬼(照到就僵住)、僵尸(听声辨位)、镜中鬼、脚本惊吓、祭坛与最终逃脱、HUD。
   通过 S.update / S.dyn 挂接，不改动 game.js；自带覆盖层 canvas(#hz) 和 DOM HUD。*/
(function (G) {
'use strict';
const { Aud, Dark, P, clamp, lerp, TAU, rnd } = G.HFX;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const QS = new URLSearchParams(location.search);
const CSS = `
body.hz-on #chat,body.hz-on #actions,body.hz-on #card,body.hz-on #topR,body.hz-on #timeChip,body.hz-on #viewBtn,body.hz-on #sceneName,body.hz-on #banner,body.hz-on #online,body.hz-on #flyFab,body.hz-on #gmFab,body.hz-on #fsBtn,body.hz-on #enterBtn,body.hz-on #lyricBar{display:none!important}
canvas#hz{position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none}
body.hz-on canvas#hz{display:block}
#hzHud{position:fixed;inset:0;pointer-events:none;display:none;font-family:system-ui,-apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#e8e2f0}
body.hz-on #hzHud{display:block}
#hzHud>*{pointer-events:auto}
#hzTop{position:absolute;left:50%;top:calc(8px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:none}
#hzTop .row{display:flex;gap:7px;align-items:center;padding:5px 12px;border-radius:999px;background:rgba(8,6,14,.62);border:1px solid #ffffff22;backdrop-filter:blur(3px)}
#hzHearts{font-size:17px;letter-spacing:2px;filter:drop-shadow(0 0 4px #ff2a4a88)}
.hzIt{display:flex;align-items:center;gap:3px;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:#ffffff10;opacity:.42;transition:.3s}
.hzIt.on{opacity:1;background:#d8b04a33;box-shadow:0 0 10px #d8b04a66}
.hzIt.done{opacity:1;background:#5fe08a2a;box-shadow:0 0 10px #5fe08a66}
#hzGoal{font-size:11.5px;opacity:.8;text-shadow:0 1px 3px #000;max-width:62vw;text-align:center}
#hzFl{position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(112px + env(safe-area-inset-bottom,0px));width:66px;height:66px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#4a4258,#15111f);border:2px solid #ffffff33;box-shadow:0 4px 14px #000a;font-size:28px;display:flex;align-items:center;justify-content:center;flex-direction:column;touch-action:none}
#hzFl.on{border-color:#ffe28a;box-shadow:0 0 18px #ffe28a66,0 4px 14px #000a}
#hzFl i{position:absolute;left:10px;right:10px;bottom:7px;height:5px;border-radius:3px;background:#0008;overflow:hidden}
#hzFl i b{display:block;height:100%;background:#ffe28a;transition:width .2s}
#hzFl.low i b{background:#ff5a4a}
#hzSet{position:absolute;right:calc(10px + env(safe-area-inset-right,0px));top:calc(8px + env(safe-area-inset-top,0px));display:flex;gap:6px}
#hzSet button{width:38px;height:38px;border-radius:50%;background:rgba(8,6,14,.62);border:1px solid #ffffff2a;font-size:17px}
#hzSet button.off{opacity:.45}
#hzHud.ttl #hzTop,#hzHud.ttl #hzFl,#hzHud.ttl #hzSet{visibility:hidden}
#hzExit{position:absolute;left:calc(10px + env(safe-area-inset-left,0px));top:calc(8px + env(safe-area-inset-top,0px));height:38px;padding:0 14px;border-radius:999px;background:rgba(8,6,14,.62);border:1px solid #ffffff2a;font-size:13px;font-weight:700}
#hzMsg{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);max-width:70vw;text-align:center;font-size:15px;font-weight:600;letter-spacing:.06em;color:#e9dfc8;text-shadow:0 0 8px #000,0 2px 4px #000;opacity:0;transition:opacity .6s;pointer-events:none}
#hzMsg.on{opacity:1}
#hzMsg.bad{color:#ff7a7a}
#hzEnd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(2,0,6,.82);text-align:center;pointer-events:auto}
#hzEnd.on{display:flex}
#hzEnd h2{margin:0;font-size:30px;letter-spacing:.2em}
#hzEnd p{margin:0;opacity:.8;font-size:14px;line-height:1.7}
#hzEnd .bt{display:flex;gap:12px}
#hzEnd button{padding:11px 26px;border-radius:999px;background:linear-gradient(#ffd96a,#f4a712);color:#3a2300;font-weight:900;font-size:15px}
#hzEnd button.g{background:#ffffff1c;color:#fff}
#hzTitle{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:radial-gradient(circle,rgba(20,4,8,.78),rgba(0,0,0,.94));text-align:center;pointer-events:auto}
#hzTitle.on{display:flex}
#hzTitle h1{margin:0;font-size:38px;letter-spacing:.28em;color:#ff4a3a;text-shadow:0 0 18px #a00,0 0 40px #600}
#hzTitle p{margin:0;font-size:13.5px;line-height:1.8;opacity:.85}
#hzTitle button{margin-top:8px;padding:12px 34px;border-radius:999px;background:linear-gradient(#ff7a5a,#c2271a);color:#fff;font-weight:900;font-size:16px;letter-spacing:.2em}
`;

G.HGame = {
  attach(S) {
    const NAV = S.nav, R = S.R, K = S.K, walls = NAV.walls, dark = new Dark(), HCOL = { warm: [255, 170, 80] };
    let GG = null, hzc = null, ctx = null, hud = null, active = false, st = null, last = 0, soft = lsGet('hz_soft', false), muted = lsGet('hz_mute', false), $ = null;
    const D2 = (a, b, c, d) => Math.hypot(a - c, b - d);
    const clear = (ax, az, bx, bz) => { const l = D2(ax, az, bx, bz); if (l < 1e-5) return true; return Dark.cast(ax, az, (bx - ax) / l, (bz - az) / l, walls, l).t >= l - 1e-3; };
    const free = (x, z, r) => { if (!S.walkable(x, z)) return false; for (const o of S.obstacles) if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return false; return true; };

    /* ---------- 路网（怪物寻路）---------- */
    const N = [[0, 12], [0, 8], [-4, 8.5], [4, 8.5], [0, 2.5], [0, -2], [0, -9], [0, -15.5], [0, -21], [-5.5, -2], [-9, -2.2], [-12, -5.5], [-9.5, 1.2], [5.5, -2], [9, -3.6], [12, -5.5], [9.5, 1.8], [-5.5, -15.5], [-9, -14.5], [-9, -19.5], [-12.5, -12.5], [5.5, -15.5], [9, -12], [6, -19.5], [12, -19.5]].map(([x, z], i) => ({ i, x, z, adj: [] }));
    [[0, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [10, 12], [5, 13], [13, 14], [14, 15], [14, 16], [7, 17], [17, 18], [18, 19], [18, 20], [7, 21], [21, 22], [22, 23], [22, 24]].forEach(([a, b]) => { N[a].adj.push(b); N[b].adj.push(a); });
    const nearNode = (x, z) => { let b = -1, bd = 1e9; N.forEach(n => { const d = D2(x, z, n.x, n.z) + (clear(x, z, n.x, n.z) ? 0 : 30); if (d < bd) { bd = d; b = n.i; } }); return b; };
    const pathTo = (x, z, tx, tz) => { if (clear(x, z, tx, tz)) return [[tx, tz]]; const s = nearNode(x, z), g = nearNode(tx, tz); if (s === g) return [[N[g].x, N[g].z], [tx, tz]]; const prev = {}, q = [s]; prev[s] = -1; while (q.length) { const c = q.shift(); if (c === g) break; N[c].adj.forEach(a => { if (!(a in prev)) { prev[a] = c; q.push(a); } }); } const p = []; let c = g; if (!(g in prev)) return [[tx, tz]]; while (c !== -1) { p.unshift([N[c].x, N[c].z]); c = prev[c]; } p.push([tx, tz]); return p; };
    const follow = (e, dt, sp, ignoreObs) => { if (!e.path || !e.path.length) return true; const [tx, tz] = e.path[0], dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d < .45) { e.path.shift(); return !e.path.length; }
      const vx = dx / d * sp * dt, vz = dz / d * sp * dt; e.yaw = Math.atan2(dx, dz); if (ignoreObs) { e.x += vx; e.z += vz; return false; }
      const r = .32; let m = false; if (free(e.x + vx, e.z, r)) { e.x += vx; m = true; } if (free(e.x, e.z + vz, r)) { e.z += vz; m = true; }
      if (!m) { e.stuck = (e.stuck || 0) + dt; if (e.stuck > .5) { e.x += (Math.random() - .5) * .5; e.z += (Math.random() - .5) * .5; e.stuck = 0; e.path = pathTo(e.x, e.z, tx, tz); } } else e.stuck = 0; return false; };

    /* ---------- 状态 ---------- */
    const newState = () => ({ phase: 'title', t: 0, lives: 3, bat: 100, flOn: true, flDir: 0, items: { talisman: 0, key: 0, jade: 0 }, placed: 0, placeT: 0, amulets: 0, invul: 0, shake: 0, flash: 0, flashCol: [255, 0, 0], scare: null, danger: 0, ambT: 8, flickT: 0, hint: 0, ev: {}, sprites: [], msgT: 0, noise: 0, step: 0, refl: [], reflMode: 0, reflT: 0, kills: 0, hitCd: 0, time: 0,
      ghost: { st: 'hidden', x: 0, z: 0, yaw: 0, alpha: 0, cd: 25, litT: 0, lit: false, whisp: 3, vis: false },
      zombie: { st: 'sleep', x: 7.5, z: 1.5, yaw: 0, ph: 0, path: [], stun: 0, lastSeen: null, loseT: 0, patT: 0, vis: false, hop: 0, alpha: 1 } });
    const reset = () => {
      const keepSoft = soft; st = newState(); st.phase = 'play0';
      NAV.pick.forEach(p => { if (p.got) { S.batches.push(...p.batches); p.got = false; } });
      NAV.lights.forEach(l => { l.k = 1; l.on = true; }); NAV.frontDoor.forEach(b => { const i = S.batches.indexOf(b); if (i >= 0) S.batches.splice(i, 1); }); S.obstacles = S.obstacles.filter(o => o !== NAV.frontObs); NAV.frontLocked = false;
      NAV.gateOpen.forEach(b => { const i = S.batches.indexOf(b); if (i >= 0) S.batches.splice(i, 1); }); NAV.gateClosed.forEach(b => { if (S.batches.indexOf(b) < 0) S.batches.push(b); }); if (S.obstacles.indexOf(NAV.gateObs) < 0) S.obstacles.push(NAV.gateObs);
      const me = GG.me; me.x = NAV.spawn[0]; me.z = NAV.spawn[1]; me.yaw = Math.PI; st.flDir = Math.PI; GG.target = null;
      if (QS.get('p')) { const [x, z] = QS.get('p').split(',').map(parseFloat); me.x = x; me.z = z; st.phase = 'play'; st.ev.slam = 1; lightsOut(true); }
      refreshHud(); if (st.phase === 'play0') { st.phase = 'title'; } };
    const lightsOut = (instant) => { NAV.lights.filter(l => /^sc|^moon/.test(l.id)).forEach((l, i) => { l.dieAt = instant ? 0 : i * .9 + .6; if (instant) { l.k = 0; l.on = false; } }); };

    /* ---------- DOM ---------- */
    const build = () => {
      if (hud) return; const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
      hzc = document.createElement('canvas'); hzc.id = 'hz'; const ov = document.getElementById('ov'); ov.parentNode.insertBefore(hzc, ov.nextSibling); ctx = hzc.getContext('2d');
      hud = document.createElement('div'); hud.id = 'hzHud'; hud.innerHTML = `
        <div id="hzTop"><div class="row"><span id="hzHearts"></span><span class="hzIt" data-i="talisman">📜 镇煞符</span><span class="hzIt" data-i="key">🗝️ 铜钥匙</span><span class="hzIt" data-i="jade">🪞 玉佩</span><span class="hzIt" id="hzAm" style="display:none">🧿 ×<b>0</b></span></div><div id="hzGoal"></div></div>
        <button id="hzExit">⟵ 离开</button>
        <div id="hzSet"><button id="hzSnd">🔊</button><button id="hzSoft" title="关闭强烈惊吓/闪光">😱</button></div>
        <button id="hzFl" class="on">🔦<i><b style="width:100%"></b></i></button>
        <div id="hzMsg"></div>
        <div id="hzEnd"><h2 id="hzEH"></h2><p id="hzEP"></p><div class="bt"><button id="hzAgain">再来一次</button><button id="hzLeave" class="g">离开鬼屋</button></div></div>
        <div id="hzTitle" class="on"><h1>鬼　屋</h1><p>门在你身后关上了。<br>找到 <b>镇煞符 · 铜钥匙 · 镜中玉佩</b>，带到书房的祭坛，<br>打开走廊尽头被封印的大门。</p><p style="opacity:.6;font-size:12px">🔦 红衣女鬼怕光——照住她，她就动不了<br>🧟 僵尸靠声音找你——不要乱跑 · 🕯️ 蜡烛补手电电量 · 🧿 护身符挡一次攻击</p><button id="hzGo">走进去</button></div>`;
      hud.classList.add('ttl'); document.body.appendChild(hud); $ = (s) => hud.querySelector(s);
      const tapStart = () => { Aud.init(); Aud.mute(muted); };
      hud.addEventListener('pointerdown', tapStart); window.addEventListener('keydown', tapStart, { once: true }); window.addEventListener('pointerdown', tapStart);
      $('#hzFl').addEventListener('pointerdown', e => { e.preventDefault(); toggleFl(); });
      $('#hzSnd').onclick = () => { muted = !muted; lsSet('hz_mute', muted); Aud.init(); Aud.mute(muted); $('#hzSnd').textContent = muted ? '🔇' : '🔊'; $('#hzSnd').classList.toggle('off', muted); };
      $('#hzSoft').onclick = () => { soft = !soft; lsSet('hz_soft', soft); $('#hzSoft').classList.toggle('off', soft); msg(soft ? '已降低惊吓强度（无突然闪光/大脸）' : '惊吓强度：全开'); };
      $('#hzSoft').classList.toggle('off', soft); $('#hzSnd').textContent = muted ? '🔇' : '🔊'; $('#hzSnd').classList.toggle('off', muted);
      $('#hzExit').onclick = () => leave();
      $('#hzGo').onclick = () => { Aud.init(); Aud.mute(muted); $('#hzTitle').classList.remove('on'); hud.classList.remove('ttl'); st.phase = 'intro'; st.t = 0; msg('…好冷。先找到那三件祭物。'); };
      $('#hzAgain').onclick = () => { $('#hzEnd').classList.remove('on'); reset(); $('#hzTitle').classList.remove('on'); hud.classList.remove('ttl'); st.phase = 'intro'; };
      $('#hzLeave').onclick = () => leave();
      window.addEventListener('keydown', e => { if (!active) return; if (e.key === 'f' || e.key === 'F') toggleFl(); });
    };
    const leave = () => { const ap = GG && GG.api; if (ap && ap.goTo) { ap.goTo(window.HZ_RETURN || 'plaza', window.HZ_RETURN_SPAWN || null); } else if (window.HZ_EXIT) window.HZ_EXIT(); else { msg('（测试版：刷新页面即可重新开始）'); } };
    let msgTimer = 0; const msg = (t, bad, ms) => { if (!$) return; const m = $('#hzMsg'); m.textContent = t; m.classList.toggle('bad', !!bad); m.classList.add('on'); clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove('on'), ms || 3400); };
    const refreshHud = () => { if (!$) return; $('#hzHearts').textContent = '❤'.repeat(Math.max(0, st.lives)) + '🖤'.repeat(Math.max(0, 3 - st.lives)); hud.querySelectorAll('.hzIt[data-i]').forEach(e => { const k = e.dataset.i; e.classList.toggle('on', !!st.items[k] && st.placed < 3); e.classList.toggle('done', !!st.items[k] && st.itemsPlaced && st.itemsPlaced[k]); }); const am = $('#hzAm'); am.style.display = st.amulets ? '' : 'none'; am.querySelector('b').textContent = st.amulets;
      const n = Object.values(st.items).filter(Boolean).length; $('#hzGoal').textContent = st.phase === 'final' ? '大门开了！快跑向走廊尽头！' : st.placed >= 3 ? '' : n >= 3 ? '带着三件祭物去书房祭坛（右下房间）' : `找到 3 件祭物（${n}/3）：棺材 · 灶台 · 梳妆台`; };
    const toggleFl = () => { if (!st || st.bat <= 0 && !st.flOn) { msg('电量耗尽了…找找蜡烛', true); return; } st.flOn = !st.flOn; Aud.click(); $('#hzFl').classList.toggle('on', st.flOn); };

    /* ---------- 脚本与效果 ---------- */
    const spawnSprite = (o) => { o.t = 0; st.sprites.push(o); return o; };
    const bigScare = (kind) => { if (soft) { st.flash = .35; st.flashCol = [120, 0, 10]; Aud.sting(.4); return; } st.scare = { t: 0, dur: .75, kind: kind || 'face' }; st.shake = Math.max(st.shake, .7); Aud.scream(); };
    const hitPlayer = (who) => {
      if (st.invul > 0 || st.phase === 'dead' || st.phase === 'win') return; const me = GG.me;
      if (QS.get('god')) return;
      if (st.amulets > 0) { st.amulets--; st.invul = 2.2; st.flash = .6; st.flashCol = [255, 200, 90]; Aud.chime(); Aud.hiss(.6); msg('🧿 护身符碎裂了，挡下了一击！'); refreshHud(); if (who === 'ghost') { st.ghost.st = 'hidden'; st.ghost.cd = 14; st.ghost.alpha = 0; } else st.zombie.stun = 3; return; }
      st.lives--; st.invul = 3.2; st.flash = 1; st.flashCol = [255, 0, 20]; bigScare(who === 'ghost' ? 'face' : 'zom'); refreshHud();
      const src = who === 'ghost' ? st.ghost : st.zombie, dx = me.x - src.x, dz = me.z - src.z, l = Math.hypot(dx, dz) || 1; for (let k = 0; k < 8; k++) { const nx = me.x + dx / l * .25, nz = me.z + dz / l * .25; if (free(nx, nz, .32)) { me.x = nx; me.z = nz; } }
      if (who === 'ghost') { st.ghost.st = 'hidden'; st.ghost.cd = 16; st.ghost.alpha = 0; } else st.zombie.stun = 3.2;
      if (st.lives <= 0) die(who);
    };
    const die = (who) => { st.phase = 'dead'; setTimeout(() => { $('#hzEH').textContent = '你被吓晕了…'; $('#hzEH').style.color = '#ff4a3a'; $('#hzEP').innerHTML = (who === 'ghost' ? '红衣女鬼抓住了你。' : '僵尸抓住了你。') + `<br>找到祭物 ${Object.values(st.items).filter(Boolean).length}/3 · 坚持 ${Math.round(st.time)} 秒`; $('#hzEnd').classList.add('on'); }, 1100); };
    const win = () => { if (st.phase === 'win') return; st.phase = 'win'; Aud.win(); setTimeout(() => { $('#hzEH').textContent = '逃出生天'; $('#hzEH').style.color = '#ffd96a'; const s = 3 - (3 - st.lives) * 0 ; $('#hzEP').innerHTML = `用时 ${Math.floor(st.time / 60)} 分 ${Math.round(st.time % 60)} 秒 · 剩余生命 ${'❤'.repeat(st.lives)}<br>${st.lives === 3 ? '完美！一次都没被抓到' : '你活下来了'}`; $('#hzEnd').classList.add('on'); }, 900); };
    const onPick = (p) => {
      p.got = true; p.batches.forEach(b => { const i = S.batches.indexOf(b); if (i >= 0) S.batches.splice(i, 1); }); const me = GG.me;
      if (p.kind === 'candle') { st.bat = Math.min(100, st.bat + 35); Aud.pick(); msg('🕯️ 蜡烛：手电电量 +35'); if (st.bat > 0 && !st.flOn && st.bat > 20) { } }
      else if (p.kind === 'amulet') { st.amulets++; Aud.pick(); msg('🧿 获得护身符：可挡一次攻击'); }
      else { st.items[p.id] = 1; Aud.pick(); msg(`获得「${p.name}」（${Object.values(st.items).filter(Boolean).length}/3）`);
        if (p.id === 'key') { Aud.static(90); st.flickT = 2.2; st.ev.radio = 1; spawnSprite({ t: 0, k: 'shade', x0: -2.8, z0: -4.8, x1: 2.8, z1: -4.8, dur: .9, h: 3.1 }); setTimeout(() => { if (active) { Aud.knock(); wakeZombie(); } }, 1400); setTimeout(() => msg('厨房的收音机……自己响了。', true), 600); }
        if (p.id === 'jade') { mirrorScare(); }
        if (p.id === 'talisman') { st.flickT = 1.4; Aud.hiss(.7); setTimeout(() => Aud.whisper(), 700); } }
      refreshHud(); };
    const wakeZombie = () => { const z = st.zombie; if (z.st === 'sleep') { z.st = 'alert'; z.path = pathTo(z.x, z.z, GG.me.x, GG.me.z); msg('……什么东西在跳。', true); } };
    const mirrorScare = () => { st.reflMode = 2; st.reflT = 0; st.flickT = 2.5; Aud.static(70); NAV.lights.forEach(l => { if (/^mirror/.test(l.id)) l.boost = 1; });
      setTimeout(() => { if (!active) return; bigScare('face'); st.shake = 1; st.reflMode = 3; Aud.slam(); if (st.ghost.st === 'hidden') st.ghost.cd = Math.min(st.ghost.cd, 3); msg('镜子……裂开了。', true); }, 1500); };
    const startFinal = () => { st.phase = 'final'; Aud.gate(); st.flickT = 4; st.shake = .8;
      NAV.gateClosed.forEach(b => { const i = S.batches.indexOf(b); if (i >= 0) S.batches.splice(i, 1); }); S.batches.push(...NAV.gateOpen); S.obstacles = S.obstacles.filter(o => o !== NAV.gateObs);
      NAV.lights.forEach(l => { if (l.id === 'gate') { l.col = [120, 170, 255]; l.a = .8; l.base = .8; l.fl = 0; l.r = 9; } });
      msg('封印解开了——快跑！！', true, 4200); refreshHud();
      const g = st.ghost, z = st.zombie; z.st = 'chase'; z.stun = 0; z.loseT = 0; z.hopV = 1.25; g.cd = 0; g.st = 'hidden'; g.fast = true; st.ambT = 3; };
    const ambient = () => { const r = Math.random(), me = GG.me;
      if (r < .3) Aud.whisper(); else if (r < .5) Aud.knock(); else if (r < .7) Aud.creak(.5); else if (r < .85) { Aud.thud(.5); } else { st.flickT = soft ? 0 : .8; Aud.blow(); }
      if (!soft && Math.random() < .25 && st.phase === 'play') { const side = Math.random() < .5 ? -1 : 1; spawnSprite({ k: 'shade', x0: me.x + side * 8, z0: me.z - 6, x1: me.x - side * 8, z1: me.z - 6, dur: 1.1, h: 3.1, far: 1 }); } };

    /* ---------- 每帧：逻辑 ---------- */
    const inCone = (x, z, range) => { const me = GG.me, dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); if (d > range) return false; let a = Math.atan2(dx, dz) - st.flDir; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) < .56 || d < 1.6; };
    S.update = (g, dt) => {
      GG = g; if (!active) { activate(); }
      if (!st || st.phase === 'title') { if (st) { last = performance.now(); } return; }
      const me = g.me; st.time += (st.phase === 'dead' || st.phase === 'win') ? 0 : dt; st.t += dt; st.invul = Math.max(0, st.invul - dt); st.shake = Math.max(0, st.shake - dt * 1.4); st.flash = Math.max(0, st.flash - dt * 1.6); st.flickT = Math.max(0, st.flickT - dt);
      if (st.scare) { st.scare.t += dt; if (st.scare.t > st.scare.dur) st.scare = null; }
      if (st.phase === 'dead' || st.phase === 'win') { Aud.heart(dt, 0); return; }
      /* 手电：朝向、电量 */
      if (me.moving) { let d = Math.atan2(Math.sin(me.yaw - st.flDir), Math.cos(me.yaw - st.flDir)); st.flDir += d * Math.min(1, dt * 9); }
      if (st.flOn) { st.bat -= dt * (.85 + (st.ghost.lit ? 2.2 : 0)); if (st.bat <= 0) { st.bat = 0; st.flOn = false; msg('手电没电了！', true); $('#hzFl').classList.remove('on'); Aud.click(); } }
      const bf = $('#hzFl'); bf.classList.toggle('low', st.bat < 25); bf.querySelector('b').style.width = st.bat + '%';
      /* 脚步声/噪音 */
      st.noise = me.moving ? (me.run ? 10.5 : 4.6) : .4; if (me.moving) { st.step -= dt * (me.run ? 3.2 : 2.1); if (st.step <= 0) { st.step = 1; Aud.step(me.run, 0); } }
      /* 序章：前门关上 */
      if (st.phase === 'intro' && me.z < 8.6) { st.phase = 'play'; st.ev.slam = 1; Aud.slam(); NAV.frontDoor.forEach(b => S.batches.push(b)); S.obstacles.push(NAV.frontObs); NAV.frontLocked = true; st.shake = .5; lightsOut(false); st.flickT = 1; setTimeout(() => { Aud.whisper(0); msg('「留下来……」', true, 3000); }, 900); st.zombie.patT = 18; st.ghost.cd = 30; refreshHud(); }
      if (st.phase === 'intro') { }
      /* 灯逐盏熄灭 */
      NAV.lights.forEach(l => { if (l.dieAt != null) { l.dieAt -= dt; if (l.dieAt <= 0 && l.on) { l.on = false; Aud.blow(); } } l.k += ((l.on ? 1 : 0) - l.k) * Math.min(1, dt * (l.on ? 4 : 7)); });
      /* 拾取 */
      NAV.pick.forEach(p => { if (p.got) return; const d = D2(me.x, me.z, p.x, p.z);
        if (p.id === 'talisman' && d < 3.4 && !st.ev.hand) { st.ev.hand = 1; spawnSprite({ k: 'hand', x: p.x - .4, z: p.z, dur: 2.4 }); Aud.thud(.9); Aud.creak(.7); st.flickT = .9; msg('棺材里……有东西在动！', true); }
        if (d < (p.kind === 'key' ? 1.35 : 1.05)) onPick(p); });
      /* 剧情触发 */
      if (st.phase === 'play' || st.phase === 'final') {
        if (!st.ev.hall && me.z < -5 && Math.abs(me.x) < 3.2) { st.ev.hall = 1; spawnSprite({ k: 'shade', x0: -2.6, z0: -17, x1: 2.6, z1: -17, dur: .8, h: 3.1 }); Aud.sting(.35); Aud.whisper(); }
        if (!st.ev.morgue && me.x < -4 && me.z > -8 && me.z < 4) { st.ev.morgue = 1; Aud.knock(); st.flickT = 1.6; msg('停尸柜里传来敲击声。', true); }
        if (!st.ev.kitchen && me.x > 4 && me.z > -8 && me.z < 4) { st.ev.kitchen = 1; Aud.static(110); msg('收音机里有人在低语……', true); }
        if (!st.ev.mirror && me.x < -4 && me.z < -9) { st.ev.mirror = 1; Aud.whisper(-.5); st.reflMode = 1; st.reflT = 0; }
        if (!st.ev.study && me.x > 4 && me.z < -9) { st.ev.study = 1; Aud.chime(); }
        if (st.reflMode === 1) { st.reflT += dt; if (st.reflT > 5 && !st.ev.reflLook) { st.ev.reflLook = 1; Aud.whisper(.3); } }
        /* 祭坛：逐一放入祭物 */
        const al = NAV.altar; if (st.phase === 'play' && D2(me.x, me.z, al.x, al.z) < 2.6) { const have = Object.keys(st.items).filter(k => st.items[k]), placedSet = st.itemsPlaced || (st.itemsPlaced = {}); const nxt = have.find(k => !placedSet[k]); if (nxt) { st.placeT -= dt; if (st.placeT <= 0) { st.placeT = .9; placedSet[nxt] = 1; st.placed = Object.keys(placedSet).length; Aud.chime(); const i = st.placed - 1; const pk = NAV.pick.find(p => p.id === nxt); st.flash = .25; st.flashCol = pk ? pk.col : [255, 200, 90]; spawnSprite({ k: 'glow', x: al.slots[i][0], z: al.slots[i][1], col: pk.col, dur: 99, h: 1.35 }); msg(`「${pk.name}」已供奉（${st.placed}/3）`); refreshHud(); if (st.placed >= 3) setTimeout(() => active && startFinal(), 1200); } } else if (have.length < 3 && !st.ev.altarHint) { st.ev.altarHint = 1; msg('祭坛还缺祭物。'); } }
        if (st.phase === 'final' && me.z < -23.2 && Math.abs(me.x) < 1.7) win();
        /* 钢琴 / 水龙头 / 收音机 */
        st.ambT -= dt; if (st.ambT <= 0) { st.ambT = (st.phase === 'final' ? 3 : 8) + Math.random() * 8; ambient(); }
        if (D2(me.x, me.z, NAV.piano.x, NAV.piano.z) < 7) { st.pianoT = (st.pianoT || 2) - dt; if (st.pianoT <= 0) { st.pianoT = 2.2 + Math.random() * 3; Aud.note([196, 207.7, 233, 277, 311][(Math.random() * 5) | 0]); } }
        if (D2(me.x, me.z, NAV.sink.x, NAV.sink.z) < 9) { st.dripT = (st.dripT || 1) - dt; if (st.dripT <= 0) { st.dripT = 1.6 + Math.random() * 1.2; Aud.drip(); } }
        if (D2(me.x, me.z, NAV.radio.x, NAV.radio.z) < 5 && !st.items.key) { st.radT = (st.radT || 1) - dt; if (st.radT <= 0) { st.radT = 3 + Math.random() * 3; Aud.static(130); } }
      }
      if (st.phase === 'play' || st.phase === 'final') { ghostAI(dt, me); zombieAI(dt, me); }
      /* 威胁度 → 音频/视觉 */
      let dg = 0; const gh = st.ghost, zb = st.zombie; if (gh.st === 'stalk') dg = Math.max(dg, 1 - D2(me.x, me.z, gh.x, gh.z) / 12); if (zb.st !== 'sleep') dg = Math.max(dg, (zb.st === 'chase' ? 1 : .8) * (1 - D2(me.x, me.z, zb.x, zb.z) / 11));
      st.danger += (clamp(dg, 0, 1) - st.danger) * Math.min(1, dt * 3); Aud.setDanger(st.danger); Aud.heart(dt, st.danger);
      /* 灯光闪烁：怪物靠近时更严重 */
      if (st.danger > .55 && !soft && Math.random() < dt * 3 * st.danger) st.flickT = Math.max(st.flickT, .15);
      st.hint -= dt; if (st.phase === 'play' && st.t > 40 && st.hint <= 0 && !st.ev.hint1) { st.ev.hint1 = 1; refreshHud(); }
    };

    /* ---------- 怪物 AI ---------- */
    function ghostAI(dt, me) {
      const g = st.ghost; g.lit = false;
      if (g.st === 'hidden') { g.cd -= dt; g.alpha = 0; if (g.cd <= 0) { // 选一个看不到的远处节点出现
          const cand = N.filter(n => D2(n.x, n.z, me.x, me.z) > 11 && !clear(me.x, me.z, n.x, n.z)); const n = cand.length ? cand[(Math.random() * cand.length) | 0] : N[(Math.random() * N.length) | 0]; g.x = n.x; g.z = n.z; g.st = 'stalk'; g.alpha = 0; g.litT = 0; g.path = []; g.repath = 0; Aud.whisper(); Aud.creak(.4); if (st.phase === 'final') g.fast = true; }
        return; }
      g.alpha = Math.min(1, g.alpha + dt * .9); const d = D2(me.x, me.z, g.x, g.z), seen = clear(me.x, me.z, g.x, g.z);
      g.lit = st.flOn && seen && d < 10.5 && inCone(g.x, g.z, 10.5);
      if (g.lit) { g.litT += dt; if (Math.random() < dt * 5) Aud.hiss(.3); if (g.litT > 3.4 && st.phase !== 'final') { g.st = 'hidden'; g.cd = 10 + Math.random() * 6; g.alpha = 0; Aud.scream(); msg('她退进了黑暗里……'); return; } }
      else { g.litT = Math.max(0, g.litT - dt * .6);
        g.repath -= dt; if (g.repath <= 0 || !g.path || !g.path.length) { g.path = pathTo(g.x, g.z, me.x, me.z); g.repath = .8; }
        const sp = g.fast ? 3.5 : 2.15 + Math.min(.6, st.time / 400); follow(g, dt, sp * (seen && d < 4 ? 1.12 : 1), true); }
      g.whisp -= dt; if (g.whisp <= 0 && d < 9) { g.whisp = 3.5 + Math.random() * 3; Aud.whisper(clamp((g.x - me.x) / 8, -1, 1)); }
      if (d < 1.15 && g.alpha > .5) hitPlayer('ghost');
    }
    function zombieAI(dt, me) {
      const z = st.zombie; z.hop = 0; if (z.st === 'sleep') { z.patT -= dt; if (z.patT <= 0 && st.phase === 'play' && st.t > 20) { z.st = 'patrol'; z.path = []; } return; }
      if (z.stun > 0) { z.stun -= dt; return; }
      const d = D2(me.x, me.z, z.x, z.z), seen = clear(me.x, me.z, z.x, z.z), canSee = seen && d < (st.flOn ? 11 : 5.5);
      const heard = st.noise > 1 && d < st.noise * (seen ? 1.25 : .8);
      if (z.st !== 'chase' && (canSee || (heard && d < st.noise))) { if (z.st !== 'alert' || canSee) { z.st = canSee ? 'chase' : 'alert'; z.path = []; z.repath = 0; if (canSee) { Aud.hiss(.4); Aud.creak(.8); } } z.lastSeen = [me.x, me.z]; z.loseT = 0; }
      if (z.st === 'chase') { if (canSee) { z.lastSeen = [me.x, me.z]; z.loseT = 0; } else { z.loseT += dt; if (z.loseT > 4.5) { z.st = 'search'; z.path = pathTo(z.x, z.z, z.lastSeen[0], z.lastSeen[1]); z.searchT = 4; } } }
      if (z.st === 'alert' && heard) z.lastSeen = [me.x, me.z];
      z.repath = (z.repath || 0) - dt; if ((z.st === 'chase' || z.st === 'alert') && z.lastSeen && (z.repath <= 0 || !z.path.length)) { z.path = pathTo(z.x, z.z, z.lastSeen[0], z.lastSeen[1]); z.repath = .6; }
      if (z.st === 'patrol' && (!z.path || !z.path.length)) { const n = N[(Math.random() * N.length) | 0]; z.path = pathTo(z.x, z.z, n.x, n.z); }
      if (z.st === 'search') { if (!z.path.length) { z.searchT -= dt; if (z.searchT <= 0) { z.st = 'patrol'; z.path = []; } } }
      /* 跳跃式移动：sin 的正半周才前进 */
      const vmax = z.st === 'chase' ? (z.hopV ? 12.5 : 11.2) : z.st === 'alert' ? 8 : 6; z.ph += dt * (z.st === 'chase' ? 7.2 : 6); const s = Math.max(0, Math.sin(z.ph)); z.hop = s; const oh = z.hopPrev || 0; z.hopPrev = s; if (oh > .5 && s <= .5 && z.st !== 'patrol') { Aud.thud(.35 * clamp(1 - d / 14, .1, 1)); } else if (oh > .5 && s <= .5) Aud.thud(.15 * clamp(1 - d / 14, 0, 1));
      const arrived = follow(z, dt, vmax * s, false); if (arrived && (z.st === 'alert')) { z.st = 'search'; z.searchT = 3; }
      if (d < 1.0) hitPlayer('zombie');
    }

    /* ---------- 渲染：覆盖层 ---------- */
    const flickMul = (l, t) => { if (!l.on && l.k < .02) return 0; let m = 1; const ph = l.x * 3.1 + l.z * 1.7;
      if (l.fl === 1) m = .82 + .12 * Math.sin(t * 11 + ph) + .08 * Math.sin(t * 23 + ph * 2); else if (l.fl === 2) { const q = Math.sin(t * 1.9 + ph); m = q > .93 ? (Math.sin(t * 90) > 0 ? 1 : .05) : q > .86 ? .35 : 1; } else if (l.fl === 3) m = .78 + .14 * Math.sin(t * 7 + ph) + .1 * Math.sin(t * 17.3 + ph); else if (l.fl === 4) m = .8 + .22 * Math.sin(t * 2.3);
      if (st.flickT > 0 && !soft) m *= Math.random() < .45 ? .1 : 1; if (l.boost) m *= 1.3; return m * l.k; };
    const sprProj = (x, z, h) => { const f = R.project([x, 0, z]), hd = R.project([x, h, z]); if (!f || !hd) return null; return { x: f[0], y: f[1], h: Math.abs(f[1] - hd[1]) }; };
    S.dyn = (fx, t, g, env) => {
      if (!active) return; fx.glow = { spray: 1, beam: 0, spark: .7 };
      const v = R.view; if (!v) return; const w = v.w, h = v.h; if (hzc.width !== w || hzc.height !== h) { hzc.width = w; hzc.height = h; }
      const me = g.me, tt = st.t; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
      const sh = st.shake; let sx = 0, sy = 0; if (sh > 0) { sx = (Math.random() - .5) * 18 * sh; sy = (Math.random() - .5) * 18 * sh; }
      const lights = [];
      /* —— 火焰光晕（加色层）—— */
      NAV.flames.forEach(f => { const k = f.L ? flickMul(f.L, tt) : 1; if (k < .05) return; K.halo(fx.spray, f.x, f.y, f.z, f.s * (.7 + k * .5), f.col.map(c => c * k)); });
      NAV.pick.forEach(p => { if (p.got) return; const a = .55 + .4 * Math.sin(tt * 3 + p.x); if (p.kind === 'key') { K.halo(fx.spray, p.x, p.mesh === 'talisman' ? 1.1 : p.mesh === 'key' ? 1.7 : 1.4, p.z, 1.1, p.col.map(c => c / 255 * a)); lights.push({ x: p.x, z: p.z, r: 2.6, a: .6 * a, col: p.col, tint: .2 }); } else if (p.kind === 'amulet') K.halo(fx.spray, p.x, .6, p.z, .5, [.8 * a, .15, .15]); });
      const ph = st.phase;
      /* —— 光源表 —— */
      NAV.lights.forEach(l => { if (D2(l.x, l.z, me.x, me.z) > 28) return; const m = flickMul(l, tt); if (m < .03) return; let x = l.x; if (l.fl === 4) x += Math.sin(tt * 1.15) * 1.0; lights.push({ x, z: l.z, r: l.r * (.9 + .1 * m), a: Math.min(1, l.a * m), col: l.col, tint: l.tint * m }); });
      /* —— 玩家：环境小光圈 + 手电锥 —— */
      const batLow = st.bat < 18 && st.flOn, fk = batLow ? (Math.random() < .12 ? .2 : .85) : 1;
      lights.push({ x: me.x, z: me.z, r: st.flOn ? 3.4 : 1.9, a: st.flOn ? .75 : .55, col: [255, 236, 190], tint: st.flOn ? .12 : 0 });
      if (st.flOn) lights.push({ x: me.x, z: me.z, r: 11.5, a: .98 * fk, col: [255, 244, 210], tint: .16 * fk, cone: { dir: st.flDir, half: .52 } });
      const dk = QS.get('lights') ? 0 : (st.flOn ? .93 : .965);
      /* —— 精灵：先画在 hz 上，随后被黑暗层一起盖住 —— */
      ctx.save(); ctx.translate(sx, sy);
      drawPortraits(me, tt); drawMirror(me, tt, w, h);
      for (let i = st.sprites.length - 1; i >= 0; i--) { const s = st.sprites[i]; s.t += (1 / 60); if (s.t > s.dur) { st.sprites.splice(i, 1); continue; } drawSprite(s, me, tt); }
      const gh = st.ghost; gh.vis = false; if (gh.st === 'stalk' && clear(me.x, me.z, gh.x, gh.z)) { const p = sprProj(gh.x, gh.z, 3.1); if (p) { gh.vis = true; P.ghost(ctx, p.x, p.y, p.h, tt, { lit: gh.lit ? 1 : 0, alpha: gh.alpha }); } }
      const zb = st.zombie; zb.vis = false; if (zb.st !== 'sleep' && clear(me.x, me.z, zb.x, zb.z)) { const p = sprProj(zb.x, zb.z, 3.0); if (p) { zb.vis = true; P.jiangshi(ctx, p.x, p.y, p.h, tt, { hop: zb.hop, face: zb.st === 'chase' ? 1 : 0 }); } }
      ctx.restore();
      /* —— 黑暗层 —— */
      dark.render({ R, w, h, me, walls, lights, darkness: dk, H: 5.6, target: ctx });
      /* —— 屏幕特效 —— */
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
      if (st.danger > .15 && ph !== 'dead') { const a = st.danger * (.22 + .1 * Math.sin(tt * (4 + st.danger * 8))), v2 = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.max(w, h) * .7); v2.addColorStop(0, 'rgba(120,0,10,0)'); v2.addColorStop(1, `rgba(150,0,16,${a})`); ctx.fillStyle = v2; ctx.fillRect(0, 0, w, h); }
      if (st.flash > 0) { ctx.fillStyle = `rgba(${st.flashCol[0]},${st.flashCol[1]},${st.flashCol[2]},${Math.min(.85, st.flash * .8)})`; ctx.fillRect(0, 0, w, h); }
      if (st.invul > 0 && ph !== 'dead') { ctx.fillStyle = `rgba(160,0,20,${.08 + .05 * Math.sin(tt * 20)})`; ctx.fillRect(0, 0, w, h); }
      if (st.scare) { const u = st.scare.t / st.scare.dur, k = Math.sin(Math.min(1, u * 1.2) * Math.PI * .5), r = Math.min(w, h) * (.16 + .27 * k); ctx.fillStyle = `rgba(0,0,0,${.78 * (1 - u * .6)})`; ctx.fillRect(0, 0, w, h); ctx.save(); ctx.translate((Math.random() - .5) * 14, (Math.random() - .5) * 14); if (st.scare.kind === 'zom') { P.jiangshi(ctx, w / 2, h * 1.05, h * 1.5 * (.7 + .3 * k), tt, { hop: .9, face: 1 }); } else P.face(ctx, w / 2, h * .5, r, tt, { open: .4 + .6 * Math.sin(tt * 30) * .5 + .3 }); ctx.restore(); ctx.fillStyle = `rgba(160,0,10,${.3 * (1 - u)})`; ctx.fillRect(0, 0, w, h); }
      if (ph === 'dead' || ph === 'win') { ctx.fillStyle = ph === 'dead' ? 'rgba(60,0,6,.5)' : 'rgba(40,60,120,.3)'; ctx.fillRect(0, 0, w, h); }
      if (ph === 'title') { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, w, h); }
      /* 老电影颗粒 */
      if (!soft) { ctx.globalAlpha = .05 + st.danger * .06; for (let i = 0; i < 90; i++) { ctx.fillStyle = Math.random() < .5 ? '#000' : '#fff'; ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1 + Math.random() * 2); } ctx.globalAlpha = 1; }
    };
    /* 肖像：眼睛跟着玩家 */
    function drawPortraits(me, t) {
      NAV.portraits.forEach((p, i) => { if (D2(me.x, me.z, p.x, p.z) > 14 || !clear(me.x, me.z, p.x, p.z + .9)) return; const c = R.project([p.x, p.y, p.z]); if (!c) return; const px = R.project([p.x + 1, p.y, p.z]); if (!px) return; const ppm = Math.abs(px[0] - c[0]), me2 = R.project([me.x, 1.3, me.z]); if (!me2) return;
        let ax = me2[0] - c[0], ay = me2[1] - c[1]; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; const blink = (Math.sin(t * .7 + i * 2.3) > .985) ? .15 : 1, er = p.s * ppm;
        [-1, 1].forEach(s => { const ex = c[0] + s * p.dx * ppm, ey = c[1]; ctx.fillStyle = '#d8d0b0'; ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.15, er * .8 * blink, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#0a0606'; ctx.beginPath(); ctx.ellipse(ex + ax * er * .5, ey + ay * er * .3, er * .5, er * .55 * blink, 0, 0, TAU); ctx.fill(); if (st.ev.hall && i === 2) { ctx.fillStyle = 'rgba(160,6,12,.85)'; ctx.fillRect(ex - 1, ey + er * .6, Math.max(2, er * .25), er * (6 + 2 * Math.sin(t))); } }); });
    }
    /* 镜子：延迟的倒影，玉佩事件后裂开并伸出手 */
    function drawMirror(me, t, w, h) {
      const m = NAV.mirror; if (!m || D2(me.x, me.z, (m.x0 + m.x1) / 2, m.z) > 13 || st.reflMode === 0) return; const a = R.project([m.x0, m.y1, m.z]), b = R.project([m.x1, m.y0, m.z]); if (!a || !b) return;
      ctx.save(); ctx.beginPath(); ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.clip();
      st.refl.push([me.x, me.z, t]); while (st.refl.length && t - st.refl[0][2] > .4) st.refl.shift(); const src = st.refl[0] || [me.x, me.z, t]; const rx = clamp(src[0], m.x0 + .5, m.x1 - .5), p = sprProj(rx, m.z - .05, 2.7 * (.72 + .18 * clamp((me.z - m.z) / 14, 0, 1)));
      if (p) { const drift = st.reflMode >= 2 ? Math.sin(t * 5) * p.h * .03 : 0; ctx.globalAlpha = .8; P.shade(ctx, p.x + drift + (st.reflMode >= 2 ? (me.x - rx) * 0.0 : 0), p.y - p.h * .02, p.h * 1.05, t, { alpha: st.reflMode >= 2 ? .95 : .72 });
        if (st.reflMode === 2) { ctx.strokeStyle = 'rgba(210,225,235,.9)'; ctx.lineWidth = p.h * .018; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(p.x + p.h * .06, p.y - p.h * .6); ctx.lineTo(p.x + p.h * (.12 + .04 * i) + Math.sin(t * 8 + i) * 2, p.y - p.h * (.95 + .02 * i)); ctx.stroke(); } }
        if (st.reflMode >= 3) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * .6, a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * .5, a[1] + (b[1] - a[1]) * .35); ctx.lineTo(a[0] + (b[0] - a[0]) * .62, a[1] + (b[1] - a[1]) * .6); ctx.lineTo(a[0] + (b[0] - a[0]) * .45, b[1]); ctx.stroke(); } }
      ctx.restore();
    }
    function drawSprite(s, me, t) {
      const u = s.t / s.dur;
      if (s.k === 'shade') { const x = lerp(s.x0, s.x1, u), z = lerp(s.z0, s.z1, u); if (!s.far && !clear(me.x, me.z, x, z)) return; const p = sprProj(x, z, s.h); if (p) P.shade(ctx, p.x, p.y, p.h, t * 2, { alpha: .92 * (1 - Math.abs(u - .5) * .6) }); }
      else if (s.k === 'hand') { const p = sprProj(s.x, s.z, 3); if (p) P.hand(ctx, p.x, p.y - p.h * .32, p.h * .7, t, clamp(Math.min(u * 5, (1 - u) * 5), 0, 1)); }
      else if (s.k === 'glow') { const p = sprProj(s.x, s.z, s.h); if (p) { const r = p.h * .5, g = ctx.createRadialGradient(p.x, p.y - p.h * .8, 0, p.x, p.y - p.h * .8, r); g.addColorStop(0, `rgba(${s.col[0]},${s.col[1]},${s.col[2]},.9)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - p.h * .8 - r, r * 2, r * 2); } }
    }

    /* ---------- 激活 / 退出 ---------- */
    function activate() {
      build(); active = true; st = newState(); document.body.classList.add('hz-on'); reset(); $('#hzTitle').classList.add('on'); hud.classList.add('ttl'); Aud.init();
      if (QS.get('lights') || QS.get('skip')) { $('#hzTitle').classList.remove('on'); hud.classList.remove('ttl'); st.phase = 'intro'; }
      window.__hz = { st: () => st, S, NAV, reset, hit: hitPlayer };
    }
    const watch = () => { if (!active) return; if (G.__game && G.__game.scene !== S) { active = false; document.body.classList.remove('hz-on'); Aud.setDanger(0); } };
    setInterval(() => { if (active && window.__game && window.__game.scene !== S) { active = false; document.body.classList.remove('hz-on'); Aud.setDanger(0); } }, 250);
  }
};
})(window);
