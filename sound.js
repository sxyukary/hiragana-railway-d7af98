'use strict';
// Sound effects (OtoLogic, CC BY 4.0; credit in sources.html). Same files and playback as けいさん鉄道's drive.js.
// Only praise sounds: no sound for mistakes (AGENTS.md). The on/off setting is per device and stays out of the saved records.
(()=>{
const KEY='mojitetsu_sound',FILES={seikai:'assets/sound/correct.mp3',kira:'assets/sound/kira.mp3',jajaan:'assets/sound/jajaan.mp3'},buffers={};
let on=true,ac=null,unlocked=false;try{on=localStorage.getItem(KEY)!=='off';}catch{}
// iPad Safari can leave the context stopped (interrupted etc.): resume it on every touch, and rebuild it if it is closed. Decoded files are kept.
function audio(){if(ac&&ac.state!=='running'&&ac.state!=='suspended'){try{ac.close().catch(()=>{});}catch{}ac=null;}if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch{ac=null;return null;}}if(ac.state==='suspended')ac.resume().catch(()=>{});return ac;}
function load(){const a=ac;if(!a)return;for(const [k,u] of Object.entries(FILES))if(!buffers[k])buffers[k]=fetch(u).then(r=>{if(!r.ok)throw r.status;return r.arrayBuffer();}).then(b=>new Promise((ok,ng)=>a.decodeAudioData(b,ok,ng))).then(b=>buffers[k]=b,()=>{delete buffers[k];});}
// The context is made on the first touch, so a sound is never queued up before the player has touched the screen.
document.addEventListener('pointerdown',()=>{unlocked=true;if(audio())load();},{capture:true,passive:true});
function beep(freq,dur,vol,when=0){const a=ac;if(!a)return;const t=a.currentTime+when,o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+.05);}
// Plays the file; returns false if it is not decoded yet so the caller can use a short synthesized sound instead.
function file(k,vol=1,when=0){const a=ac,b=buffers[k];if(!(b instanceof AudioBuffer)||!a)return false;const s=a.createBufferSource(),g=a.createGain();g.gain.value=vol;s.buffer=b;s.connect(g);g.connect(a.destination);s.start(a.currentTime+when);return true;}
function ready(){return on&&unlocked&&audio();}
// One character finished (tracing or recall).
function seikai(){if(!ready())return;load();if(!file('seikai'))beep(1047,.3,.08),beep(1568,.5,.08,.12);}
// A card was earned or turned shiny: キラーン, then ジャジャーン as the bell fades (chosen by listening, 2026-09-27).
// The bell peaks about 0.6s in and fades by 1.5s; the phrase is loud from its start, so it comes in at 0.9s a little quieter.
function kira(){if(!ready())return;load();if(!file('kira'))[1047,1319,1568,2093].forEach((f,i)=>beep(f,.4,.05,i*.07));file('jajaan',.6,.9);}
function ui(){const label=on?'おと あり':'おと なし',icon=on?'🔊':'🔈';for(const b of document.querySelectorAll('[data-sound-toggle]')){b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',label);b.innerHTML='<span aria-hidden="true">'+icon+'</span><span class="sound-label"> '+label+'</span>';}}
function toggle(){on=!on;try{localStorage.setItem(KEY,on?'on':'off');}catch{}ui();if(on&&unlocked&&audio())beep(880,.18,.1);}
for(const b of document.querySelectorAll('[data-sound-toggle]'))b.addEventListener('click',toggle);
ui();
window.MojiSound={seikai,kira,toggle,get on(){return on;}};
})();
