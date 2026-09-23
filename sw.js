/* Offline support. One cache per app version; the page registers sw.js?v=<version>. */
'use strict';
const VERSION=new URL(self.location.href).searchParams.get('v')||'dev',CACHE='mojitetsu-'+VERSION,NAV_TIMEOUT=4000;
// The page shell and every file it links are required. Card photos are best effort.
async function precache(){
 const cache=await caches.open(CACHE),response=await fetch('index.html',{cache:'no-store'});
 if(!response.ok)throw Error('index.html '+response.status);
 const html=await response.text(),linked=[...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m=>m[1]);
 await cache.put('index.html',new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
 await cache.addAll([...new Set(linked)]);
 const manifest=await (await cache.match(linked.find(u=>u.startsWith('app.webmanifest')))).json();
 const cards=await (await cache.match(linked.find(u=>u.startsWith('data/cards.js')))).text();
 const photos=[...manifest.icons.map(icon=>icon.src),...[...cards.matchAll(/"image":\s*"([^"]+)"/g)].map(m=>m[1])];
 await Promise.allSettled([...new Set(photos)].map(url=>cache.match(url).then(hit=>hit||cache.add(url))));
}
self.addEventListener('install',event=>event.waitUntil(precache().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('mojitetsu-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
// Pages: network first so online players always get the newest version; cached copy when offline or slow.
async function page(request){
 const fallback=new URL(request.url).pathname.endsWith('sources.html')?'sources.html':'index.html';
 const timeout=new Promise(resolve=>setTimeout(resolve,NAV_TIMEOUT,null));
 try{const response=await Promise.race([fetch(request),timeout]);if(response)return response;}catch{}
 return (await caches.match(fallback,{cacheName:CACHE}))||fetch(request);
}
// Files: cache first. New same-origin files (such as a newly added card photo) are kept for next time.
async function file(request){
 const cache=await caches.open(CACHE),hit=await cache.match(request);
 if(hit)return hit;
 try{const response=await fetch(request);if(response.ok&&!/\.html$/.test(new URL(request.url).pathname))cache.put(request,response.clone());return response;}
 catch(error){const loose=/\.html$/.test(new URL(request.url).pathname)?null:await cache.match(request,{ignoreSearch:true});if(loose)return loose;throw error;}
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL('./',self.location.href).pathname))return;
 event.respondWith(request.mode==='navigate'?page(request):file(request));
});
