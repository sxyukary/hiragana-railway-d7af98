const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.RAIL_TEST_URL||'http://127.0.0.1:8228/railway/',KEY='mojitetsu_sakkun_state_v2';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE);
  const version=await page.locator('meta[name="app-version"]').getAttribute('content');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const cached=await page.evaluate(async version=>{const cache=await caches.open('mojitetsu-'+version),missing=[];for(const url of ['index.html','sources.html',...[...document.querySelectorAll('script[src],link[href]')].map(e=>e.getAttribute('src')||e.getAttribute('href')),...RAIL_DATA.cards.map(c=>c.image)])if(!await cache.match(url))missing.push(url);return{missing,keys:await caches.keys()};},version);
  assert.deepEqual(cached.missing,[],'app shell, linked files and every card photo are cached');assert.deepEqual(cached.keys,['mojitetsu-'+version]);
  await page.evaluate(key=>{const s=RailCore.fresh();s.cards=RAIL_DATA.cards.slice(0,3).map(c=>c.id);localStorage.setItem(key,JSON.stringify(s));},KEY);
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('#home').isVisible(),true,'home opens offline');assert.equal(await page.locator('#station-number').textContent(),'03');
  await page.waitForFunction(()=>{const img=document.getElementById('hero-photo');return img.complete&&img.naturalWidth>0;});
  await page.locator('#lines [data-course="hiragana"]').click();assert.equal(await page.locator('#game').isVisible(),true,'writing works offline');assert.ok(await page.locator('#strokes path').count()>0);
  await page.locator('#rest').click();await page.locator('#collection').click();assert.equal(await page.locator('.train-card').count(),3);
  await page.waitForFunction(()=>[...document.querySelectorAll('.train-card img')].every(img=>img.complete&&img.naturalWidth>0));
  await page.locator('#back').click();await page.locator('#parents').click();await page.waitForFunction(()=>/準備できています/.test(document.getElementById('offline-status').textContent));
  const total=await page.evaluate(()=>RAIL_DATA.cards.length);assert.match(await page.locator('#offline-status').textContent(),new RegExp(`写真 ${total} / ${total}まい`));
  const sources=await context.newPage();await sources.goto(new URL('sources.html',BASE).href);assert.ok(await sources.locator('section').count()>0,'sources page opens offline');await sources.close();
  console.log('PASS offline shell, writing screen, card photos, parent status and sources page');
  await context.setOffline(false);
  await page.evaluate(()=>navigator.serviceWorker.register('sw.js?v=next-test'));
  await page.waitForFunction(async()=>(await caches.keys()).includes('mojitetsu-next-test')&&(await navigator.serviceWorker.getRegistration()).active?.scriptURL.includes('next-test'),null,{timeout:60000});
  await page.waitForFunction(async version=>!(await caches.keys()).includes('mojitetsu-'+version),version);
  console.log('PASS new version replaces the old offline cache');
  assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors');
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
