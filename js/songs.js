/* songs.js — 歌曲表（前端点歌台 + 服务器共用，服务器用它校验歌名和演唱时长）。
   dur = 歌曲时长（秒）：演唱时间就是歌曲时长。
   · 这里的每一首歌都有伴奏（acc:true），dur 以 mp3 实际时长为准（取整）。
   · 没有伴奏文件的歌已经全部删除，点歌台里不会再出现。
   新增歌曲：在 LIST 里加一行，再到 js/karaoke-audio.js 的 SONGS 里登记同名的 mp3 / lrc。
   ⚠ 两个文件里的歌名必须一字不差（包括空格和括号），否则服务器会提示「没有这首歌」或者没有伴奏。 */
(function (root) {
'use strict';
const LIST = [
  { name: '小幸运', artist: '田馥甄', dur: 265, acc: true },
  { name: '珊瑚海', artist: '周杰伦&Lara梁心颐', dur: 257, acc: true },
  { name: '明明就', artist: '周杰伦', dur: 262, acc: true },
  { name: '夏夜最后的烟火', artist: '颜人中', dur: 279, acc: true },
  { name: '有点甜', artist: '汪苏泷&BY2', dur: 235, acc: true },
  { name: '我知道', artist: 'BY2', dur: 249, acc: true },
  { name: '恶作剧', artist: '林依晨', dur: 220, acc: true },
  { name: '坠落', artist: '蔡健雅', dur: 250, acc: true },
  { name: '孤身', artist: '徐秉龙', dur: 211, acc: true },
  { name: '可不可以', artist: '张紫豪', dur: 241, acc: true },
  { name: '后会无期', artist: '徐良&汪苏泷', dur: 211, acc: true },
  { name: '一滴泪的时间 (L)', artist: '赵紫骅', dur: 260, acc: true },
  { name: '如愿', artist: '王菲', dur: 265, acc: true },
  { name: '大眠', artist: '王心凌', dur: 239, acc: true },
  { name: '乌梅子酱', artist: '李荣浩', dur: 257, acc: true },
  { name: '说好的幸福呢', artist: '周杰伦', dur: 255, acc: true },
  { name: '倒数', artist: 'G.E.M. 邓紫棋', dur: 228, acc: true },
  { name: '静悄悄', artist: '陈泫孝', dur: 186, acc: true },
  { name: '爱我还是他', artist: '陶喆', dur: 294, acc: true },
  { name: '此生不换', artist: '青鸟飞鱼', dur: 264, acc: true },
  { name: '天天', artist: '陶喆', dur: 270, acc: true },
  { name: '孤雏', artist: 'AGA', dur: 294, acc: true },
  { name: '彩虹', artist: '周杰伦', dur: 262, acc: true },
  { name: '月牙湾', artist: 'F.I.R.飞儿乐团', dur: 315, acc: true },
];
const byName = {};
LIST.forEach(s => { byName[s.name] = s; });
const api = { LIST, byName };
if (typeof module === 'object' && module.exports) module.exports = api; else root.SongData = api;
})(typeof window !== 'undefined' ? window : this);
