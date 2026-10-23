import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

async function harness(base='https://veronaintasca.it/'){
  const events={},stored=new Map(),deleted=[],messages=[];let network=async()=>new Response('fresh'),skipped=0;
  const cache={addAll:async()=>{},put:async(key,res)=>stored.set(typeof key==='string'?key:key.url,res),match:async key=>stored.get(typeof key==='string'?key:key.url)?.clone(),keys:async()=>[...stored.keys()].map(url=>({url})),delete:async key=>stored.delete(key.url||key)};
  const self={location:{href:base+'sw.js'},addEventListener:(type,fn)=>events[type]=fn,skipWaiting:()=>skipped++,clients:{claim:async()=>{},get:async()=>({postMessage:msg=>messages.push(msg)})}};
  runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{URL,Request,Response,Set,Error,AbortController,setTimeout,clearTimeout,self,caches:{open:async()=>cache,keys:async()=>['unrelated','verona-pwa-old'],delete:async key=>deleted.push(key)},fetch:(...args)=>network(...args)});
  return {events,stored,deleted,messages,setNetwork:fn=>network=fn,skipped:()=>skipped,fetch:async(path,options={})=>{let result;events.fetch({request:{url:new URL(path,base).href,method:'GET',mode:'cors',...options},clientId:'old',resultingClientId:'new',respondWith:p=>result=p});return result?await result:null;}};
}
test('PWA: network first, copia offline e nessuna cache per API, login o inviti',async()=>{
  const h=await harness();assert.equal(await(await h.fetch('./',{mode:'navigate'})).text(),'fresh');
  h.setNetwork(async()=>{throw Error('offline');});assert.equal(await(await h.fetch('?forza4=ABC234',{mode:'navigate'})).text(),'fresh');let message;h.events.message({data:{type:'CHECK_OFFLINE'},source:{id:'new',postMessage:value=>message=value}});assert.equal(message.type,'OFFLINE_COPY');
  for(const path of ['api/briscola','api/ranked','?code=secret','?error=access_denied','inviti/briscola/?stanza=ABC234','https://external.example/map.png'])assert.equal(await h.fetch(path,{mode:'navigate'}),null);
  assert.equal(await h.fetch('bus-official/24.json',{method:'POST'}),null);
  assert.deepEqual([...h.stored.keys()],['https://veronaintasca.it/']);
});
test('PWA: errori server non sostituiscono la copia valida e query non vengono memorizzate',async()=>{
  const h=await harness('https://example.org/verona-app/');await h.fetch('./',{mode:'navigate'});
  h.setNetwork(async()=>new Response('down',{status:503}));assert.equal(await(await h.fetch('./',{mode:'navigate'})).text(),'fresh');
  h.setNetwork(async()=>new Response('room'));await h.fetch('?briscola=ABC234',{mode:'navigate'});assert.equal(await h.stored.get('https://example.org/verona-app/').text(),'fresh');
});
test('PWA: aggiornamento esplicito e pulizia solo delle cache proprietarie',async()=>{
  const h=await harness();let work;h.events.activate({waitUntil:p=>work=p});await work;assert.deepEqual(h.deleted,['verona-pwa-old']);assert.equal(h.skipped(),0);h.events.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(h.skipped(),1);
});
test('PWA: build distribuisce worker, interfaccia installazione e metadati coerenti',async()=>{
  const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
  assert.match(await read('public/sw.js'),/VERSION='[a-f0-9]{20}'/);
  const html=await read('public/index.html');assert.match(html,/beforeinstallprompt/);assert.match(html,/id="pwa-offline"/);assert.match(html,/register\('sw.js'/);assert.match(html,/apple-mobile-web-app-capable/);
  assert.match(await read('.github/workflows/pages.yml'),/cp public\/sw.js _site\/sw.js/);
});
