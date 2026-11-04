// wallet.js — 钱包（服务器端）：金币、签到、商店购买 / 装备、礼物。
// 数据存在 Firestore 集合 wallets/{pub}：{ coins, earnDay, earned, signDay, signStreak, items:{id:1}, equip:{slot:id}, giftsSent, giftsRecv, charm }
// 只有登录用户有钱包；金币的增减都经过这里，服务器说了算（以后接真实付款也要走这里）。
const SD = require("./js/shopdata.js");

const START_COINS = 1250;     // 新账号初始金币
const EARN_CAP = 4000;        // 每天最多能从玩法（小游戏 / 唱歌等）赚到的金币，防止刷钱
const MAX_EVENT = 600;        // 一次最多上报多少金币的收入

const dayOf = (t = Date.now()) => new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 10);   // 马来西亚时间（UTC+8）

function create({ store }) {
  const cache = new Map();
  const fresh = () => ({ coins: START_COINS, earnDay: "", earned: 0, signDay: "", signStreak: 0, items: {}, equip: {}, giftsSent: 0, giftsRecv: 0, charm: 0 });
  function load(pub) {
    if (!cache.has(pub)) {
      if (cache.size > 6000) cache.clear();
      cache.set(pub, Promise.resolve(store.get("wallets", pub)).then((d) => Object.assign(fresh(), d || {})).catch((e) => { cache.delete(pub); throw e; }));
    }
    return cache.get(pub).then((d) => { const t = dayOf(); if (d.earnDay !== t) { d.earnDay = t; d.earned = 0; } return d; });
  }
  const save = (pub, d) => store.set("wallets", pub, d);
  const nextStreak = (d) => (d.signDay === dayOf() ? d.signStreak : (d.signDay === dayOf(Date.now() - 86400000) ? d.signStreak + 1 : 1));

  async function view(pub) {
    const d = await load(pub), signed = d.signDay === dayOf(), st = nextStreak(d);
    const had = signed || d.signDay === dayOf(Date.now() - 86400000) ? d.signStreak : 0;   // 已连续签到几天（断了就是 0）
    return { coins: d.coins, signed, streak: had, todayReward: SD.SIGN_REWARDS[(st - 1) % SD.SIGN_REWARDS.length], slot: (st - 1) % SD.SIGN_REWARDS.length,
             items: Object.keys(d.items), equip: Object.assign({}, d.equip), earned: d.earned, earnCap: EARN_CAP, giftsSent: d.giftsSent, giftsRecv: d.giftsRecv, charm: d.charm };
  }

  /* 玩法里的金币增减（客户端上报）：花钱要余额够；赚钱有单次和每天的上限 */
  async function apply(pub, delta) {
    const d = await load(pub); delta = Math.round(Number(delta) || 0);
    if (!delta) return { ok: true, applied: 0 };
    if (delta < 0) { if (d.coins + delta < 0) return { ok: false, reason: "no_coins" }; d.coins += delta; await save(pub, d); return { ok: true, applied: delta }; }
    if (delta > MAX_EVENT) return { ok: false, reason: "too_big" };
    const n = Math.min(delta, EARN_CAP - d.earned);
    if (n <= 0) return { ok: false, reason: "earn_cap" };
    d.coins += n; d.earned += n; await save(pub, d);
    return { ok: true, applied: n, capped: n < delta };
  }

  async function signIn(pub) {
    const d = await load(pub), t = dayOf();
    if (d.signDay === t) return { done: true };
    d.signStreak = nextStreak(d); d.signDay = t;
    const reward = SD.SIGN_REWARDS[(d.signStreak - 1) % SD.SIGN_REWARDS.length]; d.coins += reward; await save(pub, d);
    return { done: false, reward, streak: d.signStreak };
  }

  async function buy(pub, id) {
    const it = SD.byId[id]; if (!it) throw new Error("没有这件商品");
    const d = await load(pub); if (d.items[id]) throw new Error("已经拥有了");
    if (d.coins < it.price) throw new Error("金币不够（需要 " + it.price + "）");
    d.coins -= it.price; d.items[id] = 1; await save(pub, d); return it;
  }

  async function equip(pub, slot, id) {
    if (!SD.SLOTS[slot]) throw new Error("没有这个栏位");
    const d = await load(pub);
    if (!id) delete d.equip[slot];
    else { const it = SD.byId[id]; if (!it || it.slot !== slot) throw new Error("不能这样装备"); if (!d.items[id]) throw new Error("还没有购买"); d.equip[slot] = id; }
    await save(pub, d); return Object.assign({}, d.equip);
  }

  async function equipOf(pub) { return Object.assign({}, (await load(pub)).equip); }

  /* 送礼：扣送礼人的金币；对方的收礼数和魅力值增加 */
  async function gift(from, to, giftId) {
    const g = SD.giftById[giftId]; if (!g) throw new Error("没有这个礼物");
    const a = await load(from); if (a.coins < g.price) throw new Error("金币不够（需要 " + g.price + "）");
    const b = await load(to);
    a.coins -= g.price; a.giftsSent += 1; b.giftsRecv += 1; b.charm += g.price;
    await save(from, a); await save(to, b); return g;
  }

  return { view, apply, signIn, buy, equip, equipOf, gift, EARN_CAP, MAX_EVENT, START_COINS, dayOf };
}
module.exports = { create, EARN_CAP, MAX_EVENT, START_COINS };
