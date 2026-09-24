/* Pure game state and stroke matcher. No network or DOM. */
(function(root,factory){
'use strict';
const groups=typeof module!=='undefined'&&module.exports?require('./data/courses.js'):root.MojitetsuData?.courses;
const api=factory(groups);
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RailCore=api;
})(globalThis,function(GROUPS){
'use strict';
if(!GROUPS)throw Error('コース定義を読み込めません');
const CHARS=Object.values(GROUPS).flat();
// The game checks stroke order and direction, not tracing precision. These
// values are in the 109-unit character coordinate system, not screen pixels.
const START_TOLERANCE=10,PATH_TOLERANCE=10,END_MARGIN=3;
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function fresh(){return{version:2,revision:0,settings:{focus:['や','せ'],pool:[],guide:false},cursor:0,focusCursor:0,kanjiCursor:0,kanjiFocusCursor:0,katakanaCursor:0,katakanaFocusCursor:0,cards:[],shinyCards:[],sessions:[],activeId:null};}
function cycle(arr,start,count){return Array.from({length:count},(_,i)=>arr[(start+i)%arr.length]);}
function question(char){return{char,stroke:0,startedAt:null,complete:false,assisted:false,uncertain:false,records:{}};}
// Hiragana keeps the original cursor names so older saves continue where they left off.
const CURSOR_PREFIX={kanji:'kanji',katakana:'katakana'};
function start(state,course='hiragana'){
 let route=[];const available=GROUPS[course]||GROUPS.hiragana,{pool,focus}=state.settings,selectedPool=pool.filter(c=>available.includes(c)),selectedFocus=focus.filter(c=>available.includes(c)),cursorKey=CURSOR_PREFIX[course]?CURSOR_PREFIX[course]+'Cursor':'cursor',focusCursorKey=CURSOR_PREFIX[course]?CURSOR_PREFIX[course]+'FocusCursor':'focusCursor';
 state[cursorKey]??=0;state[focusCursorKey]??=0;
 if(selectedPool.length){route=cycle(selectedPool,state[cursorKey],5);state[cursorKey]+=5;}
 else {const f=selectedFocus.length?selectedFocus:[],rest=available.filter(c=>!f.includes(c));const chosen=cycle(f,state[focusCursorKey],Math.min(2,f.length));state[focusCursorKey]+=chosen.length;const other=cycle(rest,state[cursorKey],Math.min(5-chosen.length,rest.length));state[cursorKey]+=other.length;
  route=[chosen[0],other[0],chosen[1],...other.slice(1)].filter(Boolean);const missing=available.filter(c=>!route.includes(c));// Courses with fewer than five letters keep rotating while filling the set, so no letter is always the extra one.
  while(route.length<5){const src=rest.length?rest:available,next=src[state[cursorKey]%src.length];if(!missing.length&&next!==route.at(-1)){route.push(next);state[cursorKey]++;}else route.push(missing.shift()||available.find(c=>c!==route.at(-1))||available[0]);}}
 const s={id:uid(),createdAt:new Date().toISOString(),course,questions:route.map(question),guide:state.settings.guide,index:0,reward:null,repeat:false,shinyAwarded:false,orderMistake:false};state.sessions.push(s);state.sessions=state.sessions.slice(-100);state.activeId=s.id;return s;
}
function active(state){return state.sessions.find(s=>s.id===state.activeId)||null;}
function firstRecord(q,kind,observed=null,direction='forward',reason=null){const key=String(q.stroke);if(!q.records[key]||(['uncertain','unobserved'].includes(q.records[key].kind)&&['correct','order','direction'].includes(kind)))q.records[key]={...q.records[key],expected:q.stroke,observed,direction,kind,assisted:q.assisted,at:new Date().toISOString(),reason,engine:'trace-2.0'};return q.records[key];}
function recordMistake(s,q,c){s.orderMistake=true;return firstRecord(q,c.index!==q.stroke?'order':'direction',c.index,c.reverse?'reverse':'forward');}
function assist(q,reason='hint'){q.assisted=true;const k=String(q.stroke);q.records[k]??={expected:q.stroke,observed:null,direction:null,kind:'unobserved',assisted:true,at:new Date().toISOString(),engine:'trace-2.0'};q.records[k].help=reason;}
function uncertain(q,reason){q.uncertain=true;const r=firstRecord(q,'uncertain',null,null,reason);r.interrupted=reason;}
function cleanOrder(s){return !s.orderMistake&&s.questions.every(q=>!Object.values(q.records).some(r=>r.kind==='order'||r.kind==='direction'));}
function award(state,ids,rng=Math.random){const s=active(state);if(!s||!s.questions.every(q=>q.complete))return null;if(s.reward)return s.reward;const available=ids.filter(id=>!state.cards.includes(id));s.repeat=!available.length;const unshiny=ids.filter(id=>!state.shinyCards.includes(id));const choices=available.length?available:unshiny.length?unshiny:ids;s.reward=state.cards.length===0?ids[0]:choices[Math.min(choices.length-1,Math.floor(rng()*choices.length))];if(!state.cards.includes(s.reward))state.cards.push(s.reward);if(s.repeat&&cleanOrder(s)&&!state.shinyCards.includes(s.reward)){state.shinyCards.push(s.reward);s.shinyAwarded=true;}return s.reward;}
function resetCards(state){state.cards=[];state.shinyCards=[];if(active(state)?.reward)state.activeId=null;return state;}
function discardActive(state){const s=active(state);if(!s||s.reward)return false;state.sessions=state.sessions.filter(item=>item.id!==s.id);state.activeId=null;return true;}
function validate(x,counts){
 const check=(v,m)=>{if(!v)throw Error(m);},str=v=>typeof v==='string'&&v.length<150,integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max,unique=a=>new Set(a).size===a.length;
 check(x&&x.version===2,'対応していない保存形式です');x.kanjiCursor??=0;x.kanjiFocusCursor??=0;x.katakanaCursor??=0;x.katakanaFocusCursor??=0;check(integer(x.revision,1e9)&&integer(x.cursor,1e9)&&integer(x.focusCursor,1e9)&&integer(x.kanjiCursor,1e9)&&integer(x.kanjiFocusCursor,1e9)&&integer(x.katakanaCursor,1e9)&&integer(x.katakanaFocusCursor,1e9),'巡回位置が不正です');
 check(x.settings&&typeof x.settings.guide==='boolean','設定が不正です');for(const k of ['focus','pool'])check(Array.isArray(x.settings[k])&&x.settings[k].length<=CHARS.length&&unique(x.settings[k])&&x.settings[k].every(c=>CHARS.includes(c)),'文字の設定が不正です');
 check(Array.isArray(x.cards)&&x.cards.length<=10000&&unique(x.cards)&&x.cards.every(str),'カードの記録が不正です');
 x.shinyCards??=[];check(Array.isArray(x.shinyCards)&&x.shinyCards.length<=x.cards.length&&unique(x.shinyCards)&&x.shinyCards.every(id=>str(id)&&x.cards.includes(id)),'キラカードの記録が不正です');
 check(Array.isArray(x.sessions)&&x.sessions.length<=100&&unique(x.sessions.map(s=>s.id)),'履歴が不正です');
 check(x.activeId===null||str(x.activeId),'再開情報が不正です');
 for(const s of x.sessions){check((s.course===undefined||Object.hasOwn(GROUPS,s.course))&&(s.guide===undefined||typeof s.guide==='boolean')&&str(s.id)&&str(s.createdAt)&&Number.isFinite(Date.parse(s.createdAt))&&integer(s.index,5)&&typeof s.repeat==='boolean'&&(s.shinyAwarded===undefined||typeof s.shinyAwarded==='boolean')&&(s.orderMistake===undefined||typeof s.orderMistake==='boolean')&&(s.reward===null||str(s.reward)),'セッションが不正です');check(s.writingMode===undefined||['trace','recall'].includes(s.writingMode),'練習モードが不正です');check(Array.isArray(s.questions)&&s.questions.length===5,'出題数が不正です');if(s.shinyAwarded)check(s.repeat&&s.reward!==null&&cleanOrder(s),'キラ獲得記録が不正です');
  for(let qi=0;qi<5;qi++){const q=s.questions[qi];check(str(q.char)&&integer(q.stroke,8)&&typeof q.complete==='boolean'&&typeof q.assisted==='boolean'&&typeof q.uncertain==='boolean'&&(q.startedAt===null||str(q.startedAt)),'文字記録が不正です');check(q.records&&typeof q.records==='object'&&!Array.isArray(q.records)&&Object.keys(q.records).length<=8,'画の記録が不正です');
   check(q.recallUsed===undefined||typeof q.recallUsed==='boolean','想起記録が不正です');if(q.ink!==undefined)check(s.id===x.activeId&&qi===s.index&&Array.isArray(q.ink)&&q.ink.length===q.stroke&&q.ink.every(line=>Array.isArray(line)&&line.length>=2&&line.length<=128&&line.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-40&&p.x<=149&&p.y>=-40&&p.y<=149)),'途中の筆跡が不正です');const n=counts[q.char];if(n)check(q.stroke<=n&&q.complete===(q.stroke===n),'画数が一致しません');else check(s.id!==x.activeId||!!s.reward,'再開中に未対応の文字があります');
   for(const [k,r]of Object.entries(q.records)){check(/^[0-7]$/.test(k)&&r&&r.expected===+k&&(r.observed===null||integer(r.observed,7))&&['correct','order','direction','uncertain','unobserved'].includes(r.kind)&&typeof r.assisted==='boolean'&&['forward','reverse',null].includes(r.direction)&&str(r.at)&&str(r.engine),'画の記録形式が不正です');if(n)check(+k<n&&(r.observed===null||r.observed<n),'記録の画番号が不正です');for(const opt of ['reason','interrupted','help'])check(r[opt]===undefined||r[opt]===null||str(r[opt]),'補助記録が不正です');}
   if(qi<s.index)check(q.complete,'途中の文字が未完了です');if(qi>s.index)check(!q.complete&&q.stroke===0,'出題位置が不正です');
  }
  if(s.reward)check(s.index===5&&s.questions.every(q=>q.complete),'報酬が不整合です');else check(s.index<5,'報酬未確定の完了記録です');
 }
 check(x.activeId===null||x.sessions.some(s=>s.id===x.activeId),'再開先が見つかりません');return x;
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function candidates(paths,p,tolerance=START_TOLERANCE){const list=[];paths.forEach((points,index)=>{for(const reverse of [false,true]){const arr=reverse?points.slice().reverse():points;if(dist(arr[0],p)<=tolerance)list.push({index,reverse,points:arr,progress:0,error:dist(arr[0],p),steps:1,alive:true,reachedEnd:false});}});return list;}
function advance(c,from,to,tolerance=PATH_TOLERANCE){if(!c.alive||c.reachedEnd)return;const n=Math.max(1,Math.ceil(dist(from,to)/1.5));for(let step=1;step<=n;step++){const p={x:from.x+(to.x-from.x)*step/n,y:from.y+(to.y-from.y)*step/n};let best=c.progress,d=Infinity;for(let i=Math.max(0,c.progress-4);i<=Math.min(c.points.length-1,c.progress+16);i++){const dd=dist(p,c.points[i]);if(dd<d){d=dd;best=i;}}if(d>tolerance||best<c.progress-3){c.alive=false;return;}c.progress=Math.max(c.progress,best);c.error+=d;c.steps++;if(c.progress>=c.points.length-END_MARGIN){c.reachedEnd=true;return;}}}
function resolve(list,travel){if(travel<4)return null;const valid=list.filter(c=>c.alive&&c.progress>=Math.min(4,Math.floor(c.points.length*.2))).sort((a,b)=>a.error/a.steps-b.error/b.steps);if(valid.length===1)return valid[0];if(valid.length>1&&valid[1].error/valid[1].steps-valid[0].error/valid[0].steps>1.6)return valid[0];return null;}
// A recognizably wrong start counts even when the finger derails before resolve()
// can choose a full trace. A start shared with the correct stroke stays uncertain.
function wrongChoice(list,expected,travel){if(travel<4)return null;const correct=c=>c.index===expected&&!c.reverse,started=list.filter(c=>!correct(c));if(!started.length)return null;const valid=list.filter(c=>c.alive&&c.progress>=Math.min(4,Math.floor(c.points.length*.2)));if(valid.some(correct))return null;if(valid.length)return valid.filter(c=>!correct(c)).sort((a,b)=>a.error/a.steps-b.error/b.steps)[0]||null;return list.some(correct)?null:started.sort((a,b)=>a.error/a.steps-b.error/b.steps)[0];}
// Recall is matched on release. Bounded shifts, size and tilt compensate for
// memory writing. Keep multiple ordered positions when a path folds over itself.
function recallFollow(points,input){
 const path=points.filter((_,i)=>i%2===0||i===points.length-1),drawn=[input[0]];
 for(let i=1;i<input.length;i++){const a=input[i-1],b=input[i],n=Math.max(1,Math.ceil(dist(a,b)/2.5));for(let j=1;j<=n;j++)drawn.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n});}
 if(drawn.length>400){const step=Math.ceil(drawn.length/400);const sampled=drawn.filter((_,i)=>i%step===0);if(sampled.at(-1)!==drawn.at(-1))sampled.push(drawn.at(-1));drawn.splice(0,drawn.length,...sampled);}
 let states=new Float64Array(path.length).fill(Infinity);states[0]=dist(path[0],drawn[0]);
 let best=Infinity;
 const tail=Array(drawn.length).fill(0);for(let i=drawn.length-2;i>=0;i--)tail[i]=tail[i+1]+dist(drawn[i],drawn[i+1]);
 for(let i=1;i<drawn.length;i++){
  const next=new Float64Array(path.length).fill(Infinity);
  for(let j=0;j<path.length;j++)if(Number.isFinite(states[j]))for(let k=j;k<=Math.min(j+3,path.length-1);k++){
   const d=dist(path[k],drawn[i]);if(d>10)continue;
   const score=states[j]+d+(k===j?0.1:0);
   if(score<next[k])next[k]=score;
  }
  states=next;
  if(tail[i]<=32)for(let j=Math.max(0,path.length-3);j<path.length;j++)best=Math.min(best,states[j]);
 }
 return Number.isFinite(best)?best/drawn.length:null;
}
function recallMatch(paths,input,relaxed=false){
 if(input.length<2)return null;
 const travel=input.slice(1).reduce((n,p,i)=>n+dist(input[i],p),0);
 if(travel<4)return null;
 const matches=[];
 paths.forEach((path,index)=>{for(const reverse of [false,true]){
  const source=reverse?path.slice().reverse():path,origin=source[0],shift=dist(origin,input[0]);
  if(shift>14)continue;
  if(relaxed&&travel>source.length*8+80)continue;
  let best=null;
  const end=source.at(-1),last=input.at(-1),chord=dist(origin,end);
  let tilt=(Math.atan2(last.y-input[0].y,last.x-input[0].x)-Math.atan2(end.y-origin.y,end.x-origin.x))*180/Math.PI;
  tilt=((tilt+540)%360)-180;
  const size=chord>1?dist(input[0],last)/chord:1;
  const scales=[.85,1,1.15],angles=[-10,0,10];
  if(size>=.8&&size<=1.2)scales.push(size);
  if(Math.abs(tilt)<=12)angles.push(tilt);
  for(const scale of scales)for(const degrees of angles){
   const angle=degrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
   const points=source.map(p=>({x:input[0].x+scale*((p.x-origin.x)*cos-(p.y-origin.y)*sin),y:input[0].y+scale*((p.x-origin.x)*sin+(p.y-origin.y)*cos)}));
   let error;
   if(relaxed)error=recallFollow(points,input);
   else{
    const c=candidates([points],input[0],.01).find(c=>!c.reverse);
    let next=1;
    for(;next<input.length&&c.alive&&!c.reachedEnd;next++)advance(c,input[next-1],input[next],6);
    if(!c.alive||!c.reachedEnd)continue;
    let tail=dist(points.at(-1),input[next-1]);
    for(let i=next;i<input.length;i++)tail+=dist(input[i-1],input[i]);
    if(tail>32)continue;
    error=c.error/c.steps;
   }
   if(error===null)continue;
   const score=error+shift*.65+Math.abs(scale-1)*5+Math.abs(degrees)*.04;
   if(!best||score<best.score)best={index,reverse,score};
  }
  if(best)matches.push(best);
 }});
 matches.sort((a,b)=>a.score-b.score);
 // Never choose a stroke merely because it is the expected one.
 return matches.length&&(!matches[1]||matches[1].score-matches[0].score>1)?matches[0]:null;
}
return{recallMatch,CHARS,GROUPS,START_TOLERANCE,PATH_TOLERANCE,END_MARGIN,fresh,start,active,firstRecord,recordMistake,assist,uncertain,award,resetCards,discardActive,validate,dist,candidates,advance,resolve,wrongChoice};
});
