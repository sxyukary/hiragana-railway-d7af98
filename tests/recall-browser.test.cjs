const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.RAIL_TEST_URL||'http://127.0.0.1:8228/railway/',KEY='mojitetsu_sakkun_state_v2';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 // Scripted strokes follow a known question order: with Math.random at 0 the shuffle picks in list order.
 const openContext=browser.newContext.bind(browser);browser.newContext=async options=>{const context=await openContext(options);await context.addInitScript(()=>{Math.random=()=>0;});return context;};

 try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:768,height:1024},hasTouch:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE);
 // Use actual SVG geometry to verify every supported character, not synthetic stand-ins.
 const results=await page.evaluate(()=>{
  const failures=[];let strokes=0;
  for(const char of [...RailCore.GROUPS.kanji,...RailCore.GROUPS.hiragana,...RailCore.GROUPS.katakana]){const paths=RAIL_DATA.characters[char].paths.map(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const len=p.getTotalLength(),n=Math.ceil(len);return Array.from({length:n+1},(_,i)=>{const v=p.getPointAtLength(i*len/n);return{x:v.x,y:v.y};});});
   for(const [i,line]of paths.entries()){
    const a=line[0],b=line.at(-1),length=Math.hypot(b.x-a.x,b.y-a.y);
    const bend=Math.max(...line.map(p=>Math.abs((b.y-a.y)*p.x-(b.x-a.x)*p.y+b.x*a.y-b.y*a.x)/(length||1)));
    const relaxed=!RailCore.GROUPS.kanji.includes(char);
    if(bend>12&&RailCore.recallMatch(paths,[a,b],relaxed)?.index===i)failures.push({char,i,kind:'shortcut'});
    strokes++;for(const kind of ['exact','shift','tilt','size','reverse']){const a=line[0],input=kind==='reverse'?line.slice().reverse():line.map(p=>kind==='shift'?{x:p.x+4,y:p.y+4}:kind==='tilt'?{x:a.x+(p.x-a.x)*Math.cos(.12)-(p.y-a.y)*Math.sin(.12),y:a.y+(p.x-a.x)*Math.sin(.12)+(p.y-a.y)*Math.cos(.12)}:kind==='size'?{x:a.x+(p.x-a.x)*1.1,y:a.y+(p.y-a.y)*1.1}:p);const result=RailCore.recallMatch(paths,input,relaxed);if(result?.index!==i||result.reverse!==(kind==='reverse'))failures.push({char,i,kind,result});}
    if(!RailCore.GROUPS.kanji.includes(char)){
     const variants={sparse:line.filter((_,j)=>j%6===0||j===line.length-1),jitter:line.map((p,j)=>({x:p.x+Math.sin(j*1.7)*3,y:p.y+Math.cos(j*1.3)*3})),wobble:line.flatMap((p,j)=>j%13===7?[p,{x:p.x+7,y:p.y-7}]:[p]),retrace:line.flatMap((p,j)=>j===Math.floor(line.length*.5)?[p,...line.slice(j-6,j).reverse(),...line.slice(j-6,j)]:[p])};
     for(const [kind,input]of Object.entries(variants)){const result=RailCore.recallMatch(paths,input,true);if(result?.index!==i||result.reverse)failures.push({char,i,kind,result});}
    }
   }
  }return{failures,strokes};});
 assert.deepEqual(results.failures,[]);console.log('PASS all kanji, hiragana and katakana strokes, including sparse and perturbed kana retracing:',results.strokes);
 await page.evaluate(key=>{const state=RailCore.fresh();state.settings.pool=['木'];localStorage.setItem(key,JSON.stringify(state));},KEY);await page.reload();await page.locator('#lines [data-course="kanji"]').click();await page.locator('#mode-recall').click();
 assert.equal(await page.locator('#game').getAttribute('data-recall'),'preview');assert.equal(await page.locator('#recall-countdown').textContent(),'3');
 async function points(i,offset=0){return page.locator('#strokes path').nth(i).evaluate((p,offset)=>{const len=p.getTotalLength(),n=Math.ceil(len/2),m=p.getScreenCTM();return Array.from({length:n+1},(_,i)=>{const v=p.getPointAtLength(i*len/n),r=new DOMPoint(v.x+offset,v.y+offset).matrixTransform(m);return{x:r.x,y:r.y};});},offset);}
 async function draw(i,{offset=0,reverse=false,lift=true}={}){let ps=await points(i,offset);if(reverse)ps.reverse();await page.mouse.move(ps[0].x,ps[0].y);await page.mouse.down();for(const p of ps.slice(1))await page.mouse.move(p.x,p.y);if(lift)await page.mouse.up();}
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY),current=s=>s.sessions.find(v=>v.id===s.activeId).questions[0];
 // Countdown input is ignored.
 await page.locator('#board').dispatchEvent('pointerdown',{pointerId:7,clientX:200,clientY:200});assert.equal(current(await saved()).stroke,0);
 await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');await page.waitForTimeout(350);
 assert.equal(await page.locator('#strokes').evaluate(e=>getComputedStyle(e).opacity),'0');assert.equal(await page.locator('#char-label').textContent(),'き');assert.equal(await page.locator('#hint-mark text').textContent(),'1');assert.equal(await page.locator('#demo').isVisible(),false);
 assert.equal(await page.locator('#recall-grid').isVisible(),true,'cross guides must actually render');await page.screenshot({path:'/tmp/mojitetsu-recall-blank.png'});
 await draw(1);assert.equal(current(await saved()).stroke,0,'wrong stroke rejected');await draw(0,{reverse:true});assert.equal(current(await saved()).stroke,0,'reverse rejected');
 await page.locator('#hint').click();assert.equal(await page.locator('#game').getAttribute('data-recall'),'hint');await page.waitForTimeout(400);assert.equal(await page.locator('#strokes').evaluate(e=>getComputedStyle(e).opacity),'0.45');await page.screenshot({path:'/tmp/mojitetsu-recall-hint.png'});await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');
 await draw(0,{offset:4});assert.equal(current(await saved()).stroke,1);assert.equal(await page.locator('#written path').count(),1);assert.equal(await page.locator('#strokes').evaluate(e=>getComputedStyle(e).opacity),'0');
 const ink=current(await saved()).ink;await page.locator('#rest').click();await page.reload();await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');assert.deepEqual(current(await saved()).ink,ink);assert.equal(await page.locator('#written path').count(),1);
 // Touch cancellation never awards a stroke, even at the endpoint.
 const cdp=await context.newCDPSession(page),ps=await points(1);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...ps[0],id:1}]});for(const p of ps.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(current(await saved()).stroke,1);
 await draw(1);await draw(2);await draw(3,{lift:false});assert.equal(current(await saved()).complete,false,'release required');await page.mouse.up();assert.equal(current(await saved()).complete,true);assert.equal(await page.locator('#game').getAttribute('data-recall'),'complete');assert.match(await page.locator('#message').textContent(),/大開通/);await page.waitForTimeout(650);assert.equal(await page.locator('#strokes').evaluate(e=>getComputedStyle(e).opacity),'0.65');await page.screenshot({path:'/tmp/mojitetsu-recall-complete.png'});
 await page.locator('#next').click();assert.equal((await saved()).sessions[0].questions[0].ink,undefined,'ink removed when advancing');
 // Switch during countdown and make sure no old timer later hides tracing.
 await page.locator('#mode-trace').click();await page.waitForTimeout(3200);assert.equal(await page.locator('#game').getAttribute('data-recall'),null);assert.match(await page.locator('#char-label').textContent(),/木/);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.locator('#game').getAttribute('data-recall'),null,'tracing stays visible after backgrounding');
 await draw(0);assert.equal(await page.locator('#stroke-label').textContent(),'2かくめ');await page.locator('#mode-recall').click();await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');assert.equal(await page.locator('#written path').count(),1);
 for(const size of [{width:1024,height:768},{width:390,height:844},{width:844,height:390},{width:768,height:1024}]){await page.setViewportSize(size);await page.waitForTimeout(100);const bounds=await page.locator('#board').boundingBox(),tools=await page.locator('.play-tools').boundingBox();assert.ok(bounds.height>100);assert.ok(tools.y+tools.height<=size.height);assert.equal(await page.evaluate(()=>scrollY),0);}
 // Finish the remaining four questions in recall mode and reload the reward.
 await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');
 for(let round=1;round<5;round++){
  const from=round===1?1:0;
  if(round>1)await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');
  await page.locator('#hint').click();
  for(let i=from;i<4;i++)await draw(i);
  assert.equal(await page.locator('#next').isVisible(),true);
  await page.locator('#next').click();
 }
 assert.equal(await page.locator('#reward').isVisible(),true);
 const completed=await saved();assert.equal(completed.cards.length,1);assert.ok(completed.sessions[0].questions.every(q=>q.complete&&q.ink===undefined));
 await page.reload();assert.equal(await page.locator('#reward').isVisible(),true);assert.equal((await saved()).cards.length,1);
 await page.locator('#finish').click();await page.locator('button[data-profile="kanachan"]').click();await page.locator('#lines [data-course="hiragana"]').click();
 assert.equal(await page.locator('#writing-modes').isVisible(),true);assert.equal(await page.locator('#mode-trace').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#recall-grid').isVisible(),false);
 await page.locator('#mode-recall').click();assert.equal(await page.locator('#game').getAttribute('data-recall'),'preview');assert.equal(await page.locator('#recall-countdown').textContent(),'3');
 await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');assert.equal(await page.locator('#char-label').textContent(),'や');assert.equal(await page.locator('#board').getAttribute('aria-label'),'やを おぼえて書くところ');assert.equal(await page.locator('#recall-grid').isVisible(),true);
 await draw(0);const kana=await page.evaluate(()=>JSON.parse(localStorage.getItem('mojitetsu_kanachan_state_v2')));assert.equal(current(kana).stroke,1);assert.equal(current(kana).recallUsed,true);assert.equal(await page.locator('#written path').count(),1);
 await page.locator('#mode-trace').click();assert.equal(await page.locator('#mode-trace').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#recall-grid').isVisible(),false);
 for(const char of ['わ','ゆ']){
  await page.evaluate(char=>{const state=RailCore.fresh();state.settings.pool=[char];localStorage.setItem('mojitetsu_kanachan_state_v2',JSON.stringify(state));},char);
  await page.reload();await page.locator('#lines [data-course="hiragana"]').click();await page.locator('#mode-recall').click();await page.waitForFunction(()=>document.querySelector('#game').dataset.recall==='writing');
  const count=await page.locator('#strokes path').count();for(let i=0;i<count;i++)await draw(i);
  const savedKana=await page.evaluate(()=>JSON.parse(localStorage.getItem('mojitetsu_kanachan_state_v2')));assert.equal(current(savedKana).stroke,count,char+' all strokes accepted');assert.equal(current(savedKana).complete,true);
 }
 assert.deepEqual(errors,[]);console.log('PASS countdown, hidden answer, hint, ink, mistakes, release, touch cancellation, resume, mode switches, viewport and JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
