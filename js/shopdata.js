/* shopdata.js — 商店 / 礼物 / 签到的商品表（服务器和浏览器共用同一份，价格以服务器为准）。
   想加新商品：在 ITEMS 里加一行，id 不能重复，slot 是 title(称号) / frame(头像框) / bubble(聊天气泡) / nameColor(名字颜色)。 */
(function (root) {
'use strict';
const SLOTS = { title: '称号', frame: '头像框', bubble: '聊天气泡', nameColor: '名字颜色' };
const ITEMS = [
  // 称号：显示在名字左边的小标签
  { id: 't_star',    slot: 'title', name: 'K歌新星', price: 200,  bg: '#ffd36e', fg: '#2a1c00' },
  { id: 't_regular', slot: 'title', name: '广场常客', price: 300,  bg: '#5b8cff', fg: '#ffffff' },
  { id: 't_night',   slot: 'title', name: '夜猫子',   price: 500,  bg: '#6a3fd0', fg: '#ffffff' },
  { id: 't_love',    slot: 'title', name: '情圣',     price: 800,  bg: '#e84a9b', fg: '#ffffff' },
  { id: 't_god',     slot: 'title', name: '歌神',     price: 1500, bg: '#ffb21a', fg: '#3a2400' },
  // 头像框：左上角头像的边框
  { id: 'f_gold', slot: 'frame', name: '金色边框', price: 600,  color: '#ffcf4a', glow: '#ffcf4a' },
  { id: 'f_pink', slot: 'frame', name: '粉色边框', price: 600,  color: '#ff7ad1', glow: '#ff7ad1' },
  { id: 'f_cyan', slot: 'frame', name: '冰蓝边框', price: 600,  color: '#5ee7ff', glow: '#5ee7ff' },
  { id: 'f_neon', slot: 'frame', name: '霓虹边框', price: 1200, color: '#b8ff5a', glow: '#ff4adf' },
  // 聊天气泡：头顶说话的气泡颜色
  { id: 'b_pink', slot: 'bubble', name: '粉粉气泡', price: 300, bg: 'rgba(255,214,236,.97)', fg: '#5b1840' },
  { id: 'b_blue', slot: 'bubble', name: '天空气泡', price: 300, bg: 'rgba(210,232,255,.97)', fg: '#12315c' },
  { id: 'b_dark', slot: 'bubble', name: '暗夜气泡', price: 500, bg: 'rgba(35,28,70,.96)',    fg: '#f4efff' },
  { id: 'b_gold', slot: 'bubble', name: '黄金气泡', price: 800, bg: 'rgba(255,236,170,.97)', fg: '#4a3000' },
  // 名字颜色：头顶名字的颜色
  { id: 'n_gold',  slot: 'nameColor', name: '金色名字', price: 400, color: '#ffd36e' },
  { id: 'n_pink',  slot: 'nameColor', name: '粉色名字', price: 400, color: '#ff9bd7' },
  { id: 'n_cyan',  slot: 'nameColor', name: '冰蓝名字', price: 400, color: '#7defff' },
  { id: 'n_green', slot: 'nameColor', name: '薄荷名字', price: 400, color: '#9dff9a' },
];
// 礼物：送给别人，对方在地图里能看到特效；送给好友还会增加亲密度（亲密度 = 价格 ÷ 5）
const GIFTS = [
  { id: 'rose',  icon: '🌹', name: '玫瑰',   price: 20 },
  { id: 'heart', icon: '💖', name: '爱心',   price: 50 },
  { id: 'cake',  icon: '🎂', name: '蛋糕',   price: 100 },
  { id: 'bear',  icon: '🧸', name: '小熊',   price: 200 },
  { id: 'fire',  icon: '🎆', name: '烟花',   price: 300 },
  { id: 'crown', icon: '👑', name: '皇冠',   price: 500 },
];
const SIGN_REWARDS = [50, 60, 70, 80, 100, 120, 200];   // 连续签到第 1~7 天的金币，第 8 天起重新循环

const byId = {}; ITEMS.forEach(i => { byId[i.id] = i; });
const giftById = {}; GIFTS.forEach(g => { giftById[g.id] = g; });

/* 把「已装备」{ title:'t_star', ... } 变成画面要用的样子（名牌、气泡、头像框） */
function look(cos) {
  if (!cos) return null;
  const t = byId[cos.title], f = byId[cos.frame], b = byId[cos.bubble], n = byId[cos.nameColor];
  return { title: t ? { name: t.name, bg: t.bg, fg: t.fg } : null, frame: f ? { color: f.color, glow: f.glow } : null,
           bubble: b ? { bg: b.bg, fg: b.fg } : null, nameColor: n ? n.color : null };
}
const api = { SLOTS, ITEMS, GIFTS, SIGN_REWARDS, byId, giftById, look };
if (typeof module === 'object' && module.exports) module.exports = api; else root.ShopData = api;
})(typeof window !== 'undefined' ? window : this);
