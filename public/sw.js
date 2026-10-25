const VERSION='40c222d7585437fa955b';
const PREFIX='verona-pwa-';
const CACHE=PREFIX+VERSION;
const BASE=new URL('./',self.location.href);
const HOME=new URL('./',BASE).href;
const offlineClients=new Set();
const CORE=['./','manifest.webmanifest','assets/brand/logo-header.webp','assets/brand/icon-32.png','assets/brand/icon-180.png','assets/brand/icon-192.png','assets/brand/icon-512.png'].map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();if(event.data?.type==='CHECK_OFFLINE'&&offlineClients.has(event.source?.id))event.source.postMessage({type:'OFFLINE_COPY'});});
// Only public app files belong in this cache. Never intercept accounts, games,
// external maps, weather, OAuth callbacks or other API traffic.
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const path=url.pathname.slice(BASE.pathname.length);
  const home=request.mode==='navigate'&&(path===''||path==='index.html');
  if(home&&(url.searchParams.has('code')||url.searchParams.has('error')||url.hash))return;
  const asset=!url.search&&(/^(assets\/brand\/[a-z0-9-]+\.(png|jpg|webp)|manifest\.webmanifest)$/.test(path));
  const bus=!url.search&&/^bus-(official\/[A-Za-z0-9]+|routes\/atv-(urban|holiday|evening)-[0-9]+)\.json$/.test(path);
  if(!home&&!asset&&!bus)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),key=home?HOME:request;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    try{
      const response=await fetch(request,{cache:'no-cache',signal:controller.signal});
      if(response.ok&&!response.redirected&&response.type!=='opaque'){
        // Save a canonical home, never a navigation containing a room/auth code.
        if(!home||(!url.search&&!url.hash))await cache.put(key,response.clone());
        if(bus){const keys=(await cache.keys()).filter(item=>/\/bus-(official|routes)\//.test(item.url));for(const old of keys.slice(0,Math.max(0,keys.length-40)))await cache.delete(old);}
        return response;
      }
      if(!home)return response;
      throw Error('App non disponibile');
    }catch(error){
      const saved=await cache.match(key);
      if(saved){if(home)offlineClients.add(event.resultingClientId||event.clientId);return saved;}
      if(home)return new Response('<!doctype html><html lang="it"><meta name="viewport" content="width=device-width"><title>Verona in Tasca</title><h1>Connessione non disponibile</h1><p>Ricollegati a Internet e riapri Verona in Tasca.</p></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      throw error;
    }finally{clearTimeout(timer);}
  })());
});
