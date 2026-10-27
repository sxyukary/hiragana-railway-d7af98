const {chromium}=require('playwright'),assert=require('node:assert/strict');
// People v3: slots p1/p2/guest, names only in this browser, v2 saves moved once and kept.
const BASE=process.env.RAIL_TEST_URL||'http://127.0.0.1:8228/railway/',P1='mojitetsu-v3:p1',P2='mojitetsu-v3:p2',GUEST='mojitetsu-v3:guest',PEOPLE='mojitetsu-profiles',ACTIVE='mojitetsu_active_profile',OLD1='mojitetsu_sakkun_state_v2',OLD2='mojitetsu_kanachan_state_v2',LEGACY='hiragana-railway-v2';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 // Each case starts from an empty browser, puts the given keys in place, then opens the app.
 async function open(seed={},viewport={width:1024,height:768}){const context=await browser.newContext({serviceWorkers:'block',viewport,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE);await page.evaluate(seed=>{localStorage.clear();for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v);},seed);await page.reload();return{context,page,errors};}
 const get=(page,key)=>page.evaluate(key=>localStorage.getItem(key),key);
 const tickets=page=>page.locator('#profile-buttons .ticket').evaluateAll(bs=>bs.map(b=>[b.dataset.profile,b.querySelector('.ticket-name').textContent,b.getAttribute('aria-pressed')]));
 const withCards=(page,cards)=>page.evaluate(cards=>{const s=RailCore.fresh();s.cards=cards;return JSON.stringify(s);},cards);
 try{
  // Both v2 saves move to p1/p2 as they were, the old keys stay, and the selected child follows.
  {const {context,page}=await open();const old1=await withCards(page,['redwing','500']),old2=await withCards(page,['n700']);await context.close();
   const {context:c2,page:p,errors}=await open({[OLD1]:old1,[OLD2]:old2,[ACTIVE]:'kanachan'});
   assert.equal(await get(p,P1),old1);assert.equal(await get(p,P2),old2);assert.equal(await get(p,OLD1),old1,'old p1 save kept');assert.equal(await get(p,OLD2),old2,'old p2 save kept');assert.equal(await get(p,ACTIVE),'p2');
   assert.deepEqual(await tickets(p),[['p1','なまえ1','false'],['p2','なまえ2','true']]);assert.match(await p.locator('[data-owned-for="p1"]').textContent(),/ずかん 2 \//);assert.match(await p.locator('[data-owned-for="p2"]').textContent(),/ずかん 1 \//);assert.equal(await p.locator('body').getAttribute('data-profile'),'p2');
   assert.deepEqual(await p.locator('#lines [data-course]').evaluateAll(bs=>bs.map(b=>b.dataset.course)),['hiragana'],'p2 keeps hiragana only');
   // A later change to the old key is not copied again.
   await p.evaluate(([k,v])=>localStorage.setItem(k,v),[OLD1,'{"changed":true}']);await p.reload();assert.equal(await get(p,P1),old1,'migration runs once');
   await p.locator('button[data-profile="p1"]').click();assert.deepEqual(await p.locator('#lines [data-course]').evaluateAll(bs=>bs.map(b=>b.dataset.course)),['hiragana','katakana','kanji']);assert.equal(await p.locator('#owned').textContent(),'2 / 50');
   assert.deepEqual(errors,[]);await c2.close();console.log('PASS v2 saves move to p1/p2 once, old keys kept, selection follows');}
  // Only the second child had a save: p1 stays empty and is not shown unless selected.
  {const {context,page}=await open();const old2=await withCards(page,['n700']);await context.close();
   const {context:c2,page:p}=await open({[OLD2]:old2,[ACTIVE]:'kanachan'});assert.equal(await get(p,P1),null);assert.equal(await get(p,P2),old2);assert.deepEqual(await tickets(p),[['p2','なまえ2','true']]);await c2.close();
   const {context:c3,page:q}=await open({[LEGACY]:old2});assert.equal(await get(q,P1),old2,'oldest save goes to p1');assert.equal(await get(q,LEGACY),old2);assert.deepEqual(await tickets(q),[['p1','なまえ1','true']]);await c3.close();console.log('PASS one-sided and oldest saves');}
  // A broken old save is copied as it is, shown as unreadable and never overwritten.
  {const {context,page,errors}=await open({[OLD1]:'{bad'});assert.equal(await get(page,P1),'{bad');assert.equal(await get(page,OLD1),'{bad');assert.equal(await page.locator('#storage-warning').isVisible(),true);assert.match(await page.locator('#storage-warning').textContent(),/なまえ1の保存された記録を読み込めません/);await page.locator('#storage-warning button').click();await page.locator('#lines [data-course="hiragana"]').click();await page.locator('#back').isVisible();assert.equal(await get(page,P1),'{bad','broken save not overwritten');assert.deepEqual(errors,[]);await context.close();console.log('PASS broken old save kept and warned');}
  // Names: only in this browser, trimmed to 8 letters, shown on the tickets; a named p2 appears.
  {const {context,page,errors}=await open();assert.deepEqual(await tickets(page),[['p1','なまえ1','true']],'fresh browser shows only p1');
   await page.locator('#parents').click();await page.getByText('あそぶ人の名前',{exact:true}).click();assert.equal(await page.locator('#name-p1').getAttribute('placeholder'),'なまえ1');await page.locator('#name-p1').fill('  たろう ');await page.locator('#name-p2').fill('はなこ');await page.locator('#save-names').click();assert.match(await page.locator('#names-status').textContent(),/保存しました/);
   assert.deepEqual(JSON.parse(await get(page,PEOPLE)).people.p1,{name:'たろう',courses:['hiragana','katakana','kanji']});assert.equal(await page.locator('#parent-profile').textContent(),'たろう');
   await page.locator('#back').click();assert.deepEqual(await tickets(page),[['p1','たろう','true'],['p2','はなこ','false']]);assert.equal(await page.locator('button[data-profile="p1"] .ticket-badge').textContent(),'た');assert.equal(await page.locator('#current-profile').textContent(),'たろう');
   await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:1,people:{p1:{name:'あいうえおかきくけこ',courses:['nope']},p2:{name:7}}})),PEOPLE);await page.reload();assert.deepEqual(await tickets(page),[['p1','あいうえおかきく','true']],'long name cut, bad entries ignored');assert.deepEqual(await page.locator('#lines [data-course]').evaluateAll(bs=>bs.map(b=>b.dataset.course)),['hiragana','katakana','kanji'],'bad courses fall back');
   await page.locator('#parents').click();await page.getByText('あそぶ人の名前',{exact:true}).click();await page.locator('#name-p1').fill('');await page.locator('#save-names').click();assert.equal(await page.locator('#parent-profile').textContent(),'なまえ1','empty name falls back');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS names stay in this browser, are cleaned, and drive the tickets');}
  // Guest: chosen from the parents' screen, its own save, back to p1 from the tickets.
  {const {context,page,errors}=await open({[PEOPLE]:JSON.stringify({version:1,people:{p1:{name:'たろう'}}})});await page.locator('#parents').click();await page.getByText('あそぶ人の名前',{exact:true}).click();await page.locator('#play-guest').click();
   assert.equal(await page.locator('#home').isVisible(),true);assert.deepEqual(await tickets(page),[['p1','たろう','false'],['guest','ゲスト','true']]);assert.equal(await page.locator('body').getAttribute('data-profile'),'guest');assert.equal(await get(page,ACTIVE),'guest');
   await page.locator('#lines [data-course="katakana"]').click();assert.ok(JSON.parse(await get(page,GUEST)).sessions.length,'guest has its own save');assert.equal(await get(page,P1),null);
   await page.goto(BASE);await page.locator('button[data-profile="p1"]').click();assert.deepEqual(await tickets(page),[['p1','たろう','true']],'guest ticket goes away');
   await page.locator('#parents').click();await page.getByText('あそぶ人の名前',{exact:true}).click();assert.equal(await page.locator('#play-guest').isVisible(),true);
   assert.deepEqual(errors,[]);await context.close();console.log('PASS guest play and switching back');}
  // Backups: the new form names the slot and this browser's name; the old form still restores into whoever is selected.
  {const {context,page,errors}=await open({[PEOPLE]:JSON.stringify({version:1,people:{p1:{name:'たろう'}}})});const state=JSON.parse(await withCards(page,['redwing']));
   await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>{window.__copied=text;return Promise.resolve();}}}));await page.locator('#parents').click();await page.getByText('記録のバックアップと復元',{exact:true}).click();await page.locator('#copy-backup').click();const copied=JSON.parse(await page.evaluate(()=>window.__copied));assert.equal(copied.backupVersion,2);assert.equal(copied.profile,'p1');assert.equal(copied.profileName,'たろう');
   await page.locator('#backup-text').fill(JSON.stringify({backupVersion:1,profile:'sakkun',profileName:'むかしの名前',exportedAt:'2026-09-30T00:00:00.000Z',state}));await page.locator('#restore-text').click();assert.match(await page.locator('#restore-target').textContent(),/「むかしの名前」のバックアップを、現在選択中の たろう へ復元します/);await page.locator('#confirm-restore').click();assert.deepEqual(JSON.parse(await get(page,P1)).cards,['redwing']);
   await page.locator('#backup-text').fill(JSON.stringify({...copied,profile:'p2',profileName:'<b>x</b>'}));await page.locator('#restore-text').click();assert.match(await page.locator('#restore-target').textContent(),/「<b>x<\/b>」のバックアップを/,'names are shown as text');await page.locator('#cancel-restore').click();
   const dl=page.waitForEvent('download');await page.locator('#export').click();assert.match((await dl).suggestedFilename(),/^mojitetsu-p1-/);
   assert.deepEqual(errors,[]);await context.close();console.log('PASS new and old backups');}
  // Three tickets fit on a phone and on the iPad without sideways scrolling.
  for(const viewport of [{width:375,height:667},{width:768,height:1024}]){const {context,page}=await open({[PEOPLE]:JSON.stringify({version:1,people:{p1:{name:'あいうえおかきく'},p2:{name:'はなこ'}}}),[ACTIVE]:'guest'},viewport);assert.equal((await tickets(page)).length,3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`/tmp/mojitetsu-tickets-${viewport.width}.png`,fullPage:true});await context.close();}
  console.log('PASS three tickets fit at 375 and 768 wide');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
