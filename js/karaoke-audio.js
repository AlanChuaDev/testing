/* Local karaoke playback, timed LRC lyrics, and microphone permission/capture.
   A separate WebRTC signaling service is required for transmitting microphone audio to other players. */
(() => {
'use strict';
const audio=document.getElementById('karaokeAudio');
const title=document.getElementById('karaokeTitle');
const lyrics=document.getElementById('karaokeLyrics');
const micBtn=document.getElementById('karaokeMic');
const micStatus=document.getElementById('karaokeMicStatus');
if(!audio||!micBtn)return;
const song={name:'小幸运',artist:'田馥甄',mp3:'assets/songs/xiaoxingyun.mp3',lrc:'assets/songs/xiaoxingyun.lrc'};
let lines=[],micStream=null;
function parseLrc(text){
 const out=[];
 text.split(/\r?\n/).forEach(line=>{
   const stamps=[...line.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
   const lyric=line.replace(/\[[^\]]+\]/g,'').trim();
   stamps.forEach(m=>out.push({t:Number(m[1])*60+Number(m[2])+Number(('0.'+(m[3]||'0')).replace('0.0','0.')) ,text:lyric}));
 });
 return out.sort((a,b)=>a.t-b.t);
}
function activeLyric(){
 if(!lines.length){lyrics.textContent='暂无歌词';return;}
 let lo=0,hi=lines.length-1,idx=-1,t=audio.currentTime;
 while(lo<=hi){const mid=(lo+hi)>>1;if(lines[mid].t<=t){idx=mid;lo=mid+1;}else hi=mid-1;}
 lyrics.textContent=idx>=0?lines[idx].text:'♪ 前奏 ♪';
}
async function startSong(){
 title.textContent=song.name+' — '+song.artist;
 if(!audio.src)audio.src=new URL(song.mp3,document.baseURI).href;
 try{await audio.play();}catch(e){micStatus.textContent='请点击播放并确认浏览器音频权限';}
}
fetch(song.lrc).then(r=>{if(!r.ok)throw Error('歌词读取失败');return r.text();}).then(t=>{lines=parseLrc(t);activeLyric();}).catch(()=>{lyrics.textContent='歌词文件暂时无法读取';});
audio.addEventListener('timeupdate',activeLyric);
document.getElementById('karaokePlay')?.addEventListener('click',startSong);
document.getElementById('karaokePause')?.addEventListener('click',()=>audio.pause());
micBtn.addEventListener('click',async()=>{
 if(micStream){
   micStream.getTracks().forEach(t=>t.stop());micStream=null;
   micBtn.textContent='🎙 开启麦克风';micStatus.textContent='麦克风已关闭';return;
 }
 if(!navigator.mediaDevices?.getUserMedia){micStatus.textContent='此环境不支持麦克风；请使用 HTTPS 或 APK WebView';return;}
 try{
   micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   micBtn.textContent='🔴 关闭麦克风';micStatus.textContent='麦克风已授权并采集（本机）';
 }catch(err){
   micStatus.textContent=err.name==='NotAllowedError'?'麦克风权限被拒绝，请在系统设置中允许':('麦克风启动失败：'+err.message);
 }
});
/* Capture clicks on the built-in song list to start the matching bundled test song. */
document.getElementById('songList')?.addEventListener('click',e=>{
 const b=e.target.closest('button.song');if(!b)return;
 if((b.textContent||'').includes('小幸运'))startSong();
},true);
})();
