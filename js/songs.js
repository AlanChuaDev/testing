/* songs.js — 歌曲表（前端点歌台 + 服务器共用，服务器用它校验歌名和演唱时长）。
   dur = 歌曲时长（秒）：演唱时间就是歌曲时长。
   · 有伴奏文件的歌（acc:true）以 mp3 实际时长为准（《小幸运》= 263.86 秒，取整 264）。
   · 其余歌曲暂时没有伴奏文件，dur 是标称时长，想改就直接改这里。
   新增歌曲：在 LIST 里加一行；有伴奏的话还要在 js/karaoke-audio.js 的 SONGS 里登记 mp3/lrc。 */
(function (root) {
'use strict';
const LIST = [
  { name: '后来', artist: '刘若英', dur: 279 },
  { name: '小幸运', artist: '田馥甄', dur: 264, acc: true },
  { name: '月亮代表我的心', artist: '邓丽君', dur: 203 },
  { name: '江南', artist: '林俊杰', dur: 267 },
  { name: '光年之外', artist: 'G.E.M.', dur: 235 },
  { name: '告白气球', artist: '周杰伦', dur: 215 },
  { name: '夜空中最亮的星', artist: '逃跑计划', dur: 255 },
  { name: '爱你', artist: '王心凌', dur: 226 },
  { name: 'Dancing Queen', artist: 'ABBA', dur: 231 },
  { name: 'Someone Like You', artist: 'Adele', dur: 285 },
  { name: 'Shape of You', artist: 'Ed Sheeran', dur: 233 },
  { name: 'Let It Go', artist: 'Idina Menzel', dur: 224 },
];
const byName = {};
LIST.forEach(s => { byName[s.name] = s; });
const api = { LIST, byName };
if (typeof module === 'object' && module.exports) module.exports = api; else root.SongData = api;
})(typeof window !== 'undefined' ? window : this);
