/* Pure game state and stroke matcher. No network or DOM. */
(function(root){
'use strict';
const GROUPS={
 hiragana:['や','せ','ふ','ほ','も','む','よ'],
 kanji:['一','二','三','四','五','六','七','八','九','十','山','川','木','目','月','上','下']
};
const CHARS=[...GROUPS.hiragana,...GROUPS.kanji];
// The game checks stroke order and direction, not tracing precision. These
// values are in the 109-unit character coordinate system, not screen pixels.
const START_TOLERANCE=10,PATH_TOLERANCE=10;
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function fresh(){return{version:2,revision:0,settings:{focus:['や','せ'],pool:[],guide:false},cursor:0,focusCursor:0,kanjiCursor:0,kanjiFocusCursor:0,cards:[],sessions:[],activeId:null};}
function cycle(arr,start,count){return Array.from({length:count},(_,i)=>arr[(start+i)%arr.length]);}
function question(char){return{char,stroke:0,startedAt:null,complete:false,assisted:false,uncertain:false,records:{}};}
function start(state,course='hiragana'){
 let route=[];const available=GROUPS[course]||GROUPS.hiragana,{pool,focus}=state.settings,selectedPool=pool.filter(c=>available.includes(c)),selectedFocus=focus.filter(c=>available.includes(c)),cursorKey=course==='kanji'?'kanjiCursor':'cursor',focusCursorKey=course==='kanji'?'kanjiFocusCursor':'focusCursor';
 state[cursorKey]??=0;state[focusCursorKey]??=0;
 if(selectedPool.length){route=cycle(selectedPool,state[cursorKey],5);state[cursorKey]+=5;}
 else {const f=selectedFocus.length?selectedFocus:[],rest=available.filter(c=>!f.includes(c));const chosen=cycle(f,state[focusCursorKey],Math.min(2,f.length));state[focusCursorKey]+=chosen.length;const other=cycle(rest,state[cursorKey],Math.min(5-chosen.length,rest.length));state[cursorKey]+=other.length;
  route=[chosen[0],other[0],chosen[1],...other.slice(1)].filter(Boolean);const missing=available.filter(c=>!route.includes(c));while(route.length<5)route.push(missing.shift()||available.find(c=>c!==route.at(-1))||available[0]);}
 const s={id:uid(),createdAt:new Date().toISOString(),course,questions:route.map(question),guide:state.settings.guide,index:0,reward:null,repeat:false};state.sessions.push(s);state.sessions=state.sessions.slice(-100);state.activeId=s.id;return s;
}
function active(state){return state.sessions.find(s=>s.id===state.activeId)||null;}
function firstRecord(q,kind,observed=null,direction='forward',reason=null){const key=String(q.stroke);if(!q.records[key]||(['uncertain','unobserved'].includes(q.records[key].kind)&&['correct','order','direction'].includes(kind)))q.records[key]={...q.records[key],expected:q.stroke,observed,direction,kind,assisted:q.assisted,at:new Date().toISOString(),reason,engine:'trace-2.0'};return q.records[key];}
function assist(q,reason='hint'){q.assisted=true;const k=String(q.stroke);q.records[k]??={expected:q.stroke,observed:null,direction:null,kind:'unobserved',assisted:true,at:new Date().toISOString(),engine:'trace-2.0'};q.records[k].help=reason;}
function uncertain(q,reason){q.uncertain=true;const r=firstRecord(q,'uncertain',null,null,reason);r.interrupted=reason;}
function award(state,ids,rng=Math.random){const s=active(state);if(!s||!s.questions.every(q=>q.complete))return null;if(s.reward)return s.reward;const available=ids.filter(id=>!state.cards.includes(id));s.repeat=!available.length;const choices=available.length?available:ids;s.reward=state.cards.length===0?ids[0]:choices[Math.min(choices.length-1,Math.floor(rng()*choices.length))];if(!state.cards.includes(s.reward))state.cards.push(s.reward);return s.reward;}
function resetCards(state){state.cards=[];if(active(state)?.reward)state.activeId=null;return state;}
function discardActive(state){const s=active(state);if(!s||s.reward)return false;state.sessions=state.sessions.filter(item=>item.id!==s.id);state.activeId=null;return true;}
function validate(x,counts){
 const check=(v,m)=>{if(!v)throw Error(m);},str=v=>typeof v==='string'&&v.length<150,integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max,unique=a=>new Set(a).size===a.length;
 check(x&&x.version===2,'対応していない保存形式です');x.kanjiCursor??=0;x.kanjiFocusCursor??=0;check(integer(x.revision,1e9)&&integer(x.cursor,1e9)&&integer(x.focusCursor,1e9)&&integer(x.kanjiCursor,1e9)&&integer(x.kanjiFocusCursor,1e9),'巡回位置が不正です');
 check(x.settings&&typeof x.settings.guide==='boolean','設定が不正です');for(const k of ['focus','pool'])check(Array.isArray(x.settings[k])&&x.settings[k].length<=CHARS.length&&unique(x.settings[k])&&x.settings[k].every(c=>CHARS.includes(c)),'文字の設定が不正です');
 check(Array.isArray(x.cards)&&x.cards.length<=10000&&unique(x.cards)&&x.cards.every(str),'カードの記録が不正です');
 check(Array.isArray(x.sessions)&&x.sessions.length<=100&&unique(x.sessions.map(s=>s.id)),'履歴が不正です');
 check(x.activeId===null||str(x.activeId),'再開情報が不正です');
 for(const s of x.sessions){check((s.course===undefined||Object.hasOwn(GROUPS,s.course))&&(s.guide===undefined||typeof s.guide==='boolean')&&str(s.id)&&str(s.createdAt)&&Number.isFinite(Date.parse(s.createdAt))&&integer(s.index,5)&&typeof s.repeat==='boolean'&&(s.reward===null||str(s.reward)),'セッションが不正です');check(Array.isArray(s.questions)&&s.questions.length===5,'出題数が不正です');
  for(let qi=0;qi<5;qi++){const q=s.questions[qi];check(str(q.char)&&integer(q.stroke,8)&&typeof q.complete==='boolean'&&typeof q.assisted==='boolean'&&typeof q.uncertain==='boolean'&&(q.startedAt===null||str(q.startedAt)),'文字記録が不正です');check(q.records&&typeof q.records==='object'&&!Array.isArray(q.records)&&Object.keys(q.records).length<=8,'画の記録が不正です');
   const n=counts[q.char];if(n)check(q.stroke<=n&&q.complete===(q.stroke===n),'画数が一致しません');else check(s.id!==x.activeId||!!s.reward,'再開中に未対応の文字があります');
   for(const [k,r]of Object.entries(q.records)){check(/^[0-7]$/.test(k)&&r&&r.expected===+k&&(r.observed===null||integer(r.observed,7))&&['correct','order','direction','uncertain','unobserved'].includes(r.kind)&&typeof r.assisted==='boolean'&&['forward','reverse',null].includes(r.direction)&&str(r.at)&&str(r.engine),'画の記録形式が不正です');if(n)check(+k<n&&(r.observed===null||r.observed<n),'記録の画番号が不正です');for(const opt of ['reason','interrupted','help'])check(r[opt]===undefined||r[opt]===null||str(r[opt]),'補助記録が不正です');}
   if(qi<s.index)check(q.complete,'途中の文字が未完了です');if(qi>s.index)check(!q.complete&&q.stroke===0,'出題位置が不正です');
  }
  if(s.reward)check(s.index===5&&s.questions.every(q=>q.complete),'報酬が不整合です');else check(s.index<5,'報酬未確定の完了記録です');
 }
 check(x.activeId===null||x.sessions.some(s=>s.id===x.activeId),'再開先が見つかりません');return x;
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function candidates(paths,p,tolerance=START_TOLERANCE){const list=[];paths.forEach((points,index)=>{for(const reverse of [false,true]){const arr=reverse?points.slice().reverse():points;if(dist(arr[0],p)<=tolerance)list.push({index,reverse,points:arr,progress:0,error:dist(arr[0],p),steps:1,alive:true});}});return list;}
function advance(c,from,to,tolerance=PATH_TOLERANCE){if(!c.alive)return;const n=Math.max(1,Math.ceil(dist(from,to)/1.5));for(let step=1;step<=n;step++){const p={x:from.x+(to.x-from.x)*step/n,y:from.y+(to.y-from.y)*step/n};let best=c.progress,d=Infinity;for(let i=Math.max(0,c.progress-4);i<=Math.min(c.points.length-1,c.progress+16);i++){const dd=dist(p,c.points[i]);if(dd<d){d=dd;best=i;}}if(d>tolerance||best<c.progress-3){c.alive=false;return;}c.progress=Math.max(c.progress,best);c.error+=d;c.steps++;}}
function resolve(list,travel){if(travel<4)return null;const valid=list.filter(c=>c.alive&&c.progress>=Math.min(4,Math.floor(c.points.length*.2))).sort((a,b)=>a.error/a.steps-b.error/b.steps);if(valid.length===1)return valid[0];if(valid.length>1&&valid[1].error/valid[1].steps-valid[0].error/valid[0].steps>1.6)return valid[0];return null;}
const api={CHARS,GROUPS,START_TOLERANCE,PATH_TOLERANCE,fresh,start,active,firstRecord,assist,uncertain,award,resetCards,discardActive,validate,dist,candidates,advance,resolve};if(typeof module!=='undefined')module.exports=api;else root.RailCore=api;
})(globalThis);
