// bonds.js — 好友亲密度（服务器端）
// 数据存在 Firestore 集合 bonds/{conv}，conv = 两个 pub 排序后用 _ 连接：
//   { xp, day, daily:{dm,room,team,duet,gift}, care:{ [pub]:{ last:'YYYY-MM-DD', streak } } }
// 等级 1~10（10 级满级），越往后升级需要的亲密度越多。
// ★ 难度说明（只有开发者知道，不告诉玩家）：不靠礼物，每天最多能拿到的亲密度有上限，
//   加上等级表，最快约 30 天才能到「可以结婚」的等级。想调难度，改下面的 LEVEL_XP / CAPS / careXp 就行。

const LEVEL_XP = [0, 100, 250, 475, 800, 1250, 1850, 2650, 3700, 5100]; // 到达 1~10 级所需的累计亲密度
const MAX_LEVEL = 10;
const RING_LEVEL = 8;    // 买戒指需要的等级（给以后的教堂 / 商店用）
const MARRY_LEVEL = 9;   // 结婚需要的等级
const CAPS = { dm: 20, room: 30, team: 24, duet: 30, gift: 100000 };   // 每对好友每天各来源的上限（礼物暂不限，等礼物商店做好再定）
const careXp = (streak) => (streak >= 30 ? 25 : streak >= 7 ? 15 : 10);  // 每日问暖：连续 7 天以上多加，连续 30 天以上再多加
const GREETS = ["今天过得好吗？", "记得多喝水哦～", "今天也要开心呀！", "辛苦啦，早点休息～", "想你啦，快来玩！", "今天有什么好事吗？", "天冷了，注意保暖哦～", "愿你今天一切顺利！"];

const dayOf = (t = Date.now()) => new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 10);   // 按马来西亚时间（UTC+8）算「今天」
const conv = (a, b) => [a, b].sort().join("_");

function levelInfo(xp) {
  xp = Math.max(0, Math.floor(xp || 0));
  let lv = 1; for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lv = i + 1;
  const maxed = lv >= MAX_LEVEL, base = LEVEL_XP[lv - 1], next = maxed ? base : LEVEL_XP[lv];
  return { level: lv, xp, into: xp - base, need: maxed ? 0 : next - base, maxed };
}

function create({ store }) {
  const cache = new Map();   // conv -> Promise<doc>（单服务器运行，缓存里的对象就是最新的）
  const fresh = () => ({ xp: 0, day: "", daily: {}, care: {} });
  function doc(a, b) {
    const id = conv(a, b);
    if (!cache.has(id)) {
      if (cache.size > 6000) cache.clear();
      cache.set(id, Promise.resolve(store.get("bonds", id)).then((d) => Object.assign(fresh(), d || {})).catch((e) => { cache.delete(id); throw e; }));
    }
    return cache.get(id).then((d) => { const t = dayOf(); if (d.day !== t) { d.day = t; d.daily = {}; } return d; });
  }
  const save = (a, b, d) => store.set("bonds", conv(a, b), d);

  /* 加亲密度：kind = dm | room | team | duet | gift；每天每个来源有上限。返回 { gained, levelUp(新等级或 0) } */
  async function gain(a, b, kind, amount) {
    const cap = CAPS[kind]; if (!cap || !(amount > 0)) return { gained: 0, levelUp: 0 };
    const d = await doc(a, b), got = d.daily[kind] || 0, n = Math.min(Math.floor(amount), cap - got);
    if (n <= 0) return { gained: 0, levelUp: 0 };
    const before = levelInfo(d.xp).level; d.xp += n; d.daily[kind] = got + n;
    await save(a, b, d); const after = levelInfo(d.xp).level;
    return { gained: n, levelUp: after > before ? after : 0 };
  }

  /* 每日问暖：每个人每天对每个好友一次；连续天数断了就从头算 */
  async function careStatus(from, to) { const d = await doc(from, to), c = d.care[from]; return { done: !!(c && c.last === dayOf()), streak: c ? c.streak : 0 }; }
  async function care(from, to) {
    const d = await doc(from, to), t = dayOf(), c = d.care[from] || { last: "", streak: 0 };
    if (c.last === t) return { done: true, gained: 0, levelUp: 0, streak: c.streak };
    c.streak = c.last === dayOf(Date.now() - 86400000) ? c.streak + 1 : 1; c.last = t; d.care[from] = c;
    const gained = careXp(c.streak), before = levelInfo(d.xp).level; d.xp += gained;
    await save(from, to, d); const after = levelInfo(d.xp).level;
    return { done: false, gained, levelUp: after > before ? after : 0, streak: c.streak };
  }

  /* 好友列表用：我和每个好友的亲密度（等级、进度条、今天问暖了没有）。不把结婚 / 戒指需要的等级发给客户端 */
  async function view(me, pubs) {
    const out = {}, t = dayOf();
    await Promise.all(pubs.map(async (p) => {
      try { const d = await doc(me, p), li = levelInfo(d.xp), c = d.care[me]; out[p] = { level: li.level, into: li.into, need: li.need, maxed: li.maxed, careDone: !!(c && c.last === t), streak: c ? c.streak : 0 }; }
      catch (e) { /* 读不到就不显示 */ }
    }));
    return out;
  }

  /* 给以后的「教堂 / 戒指 / 结婚」用：这对好友现在能不能买戒指、能不能结婚 */
  async function status(a, b) { const d = await doc(a, b), li = levelInfo(d.xp); return Object.assign({ canRing: li.level >= RING_LEVEL, canMarry: li.level >= MARRY_LEVEL }, li); }

  const greeting = () => "💌 " + GREETS[Math.floor(Math.random() * GREETS.length)];
  return { gain, care, careStatus, view, status, greeting, levelInfo, RING_LEVEL, MARRY_LEVEL };
}

module.exports = { create, levelInfo, LEVEL_XP, MAX_LEVEL, RING_LEVEL, MARRY_LEVEL, CAPS };
