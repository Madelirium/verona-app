import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {atomicJSON,checkpoint,withJobLock,cachedPublicFetcher,importPublicResponse} from './bus-bot-storage.mjs';
import {requestTripDetail,momoDate} from './bus-stop-extraction.mjs';

async function temporary(t){
  const root=await mkdtemp(join(tmpdir(),'verona-bot-'));
  t.after(async()=>{assert.equal(dirname(root),tmpdir());assert.ok(root.startsWith(join(tmpdir(),'verona-bot-')));await rm(root,{recursive:true,force:true});});return root;
}
const tripUrl='https://www.mycicero.it/OTPProxy/host.ashx?url=momoservice/json/GetFermateCorsa2';
const options=token=>({method:'POST',headers:{Client:'tpwebportal-atv;5.5.4'},body:JSON.stringify({IdCorsa:'ATV#1:700_1',Giorno:'day-1',SecurityToken:token})});
const validTrip=()=>({Tipo:0,StatusCode:200,Oggetto:{Corsa:{ID_Corsa:'ATV#1:700_1'},Fermate:[{x:1}]}});
const response=data=>new Response(JSON.stringify(data),{status:200});

test('La cache riusa la corsa anche dopo un riavvio senza salvare il token, e separa le date',async t=>{
  const root=await temporary(t);let calls=0;
  const fetcher=async()=>{calls++;return response(validTrip());};
  await cachedPublicFetcher(root,{fetcher,delayMs:0})(tripUrl,options('secret-one'));
  const resumed=cachedPublicFetcher(root,{fetcher,delayMs:0});
  await resumed(tripUrl,options('secret-two'));assert.equal(calls,1);assert.equal(resumed.stats.hits,1);
  const file=(await readdir(root))[0];const text=await readFile(join(root,file),'utf8');assert.ok(!text.includes('SecurityToken'));assert.ok(!text.includes('secret-one'));
  const next=options('third');const payload=JSON.parse(next.body);payload.Giorno='day-2';next.body=JSON.stringify(payload);
  await resumed(tripUrl,next);assert.equal(calls,2);
});

test('Un interruzione riprende dalle richieste mancanti e una verifica usa una cache distinta',async t=>{
  const root=await temporary(t);let calls=0;
  const first=cachedPublicFetcher(join(root,'baseline'),{delayMs:0,fetcher:async()=>{calls++;if(calls===2)throw new Error('interruzione');return response(validTrip());}});
  await first(tripUrl,options('a'));
  const second=options('b');const body=JSON.parse(second.body);body.Giorno='day-2';second.body=JSON.stringify(body);
  await assert.rejects(first(tripUrl,second),/interruzione/);
  const fetcher=async()=>{calls++;return response(validTrip());};
  const resumed=cachedPublicFetcher(join(root,'baseline'),{fetcher,delayMs:0});await resumed(tripUrl,options('c'));await resumed(tripUrl,second);
  assert.equal(calls,3);assert.equal(resumed.stats.hits,1);
  await cachedPublicFetcher(join(root,'verification'),{fetcher,delayMs:0})(tripUrl,options('d'));assert.equal(calls,4);
});

test('Gli errori HTTP e le risposte applicative errate non vengono salvati',async t=>{
  const root=await temporary(t);let calls=0;
  const fetcher=cachedPublicFetcher(root,{delayMs:0,fetcher:async()=>{calls++;return calls===1?new Response('',{status:429}):response({Tipo:1,StatusCode:200,Oggetto:{}});}});
  assert.equal((await fetcher(tripUrl,options('a'))).status,429);assert.equal(calls,1);
  await fetcher(tripUrl,options('a'));assert.equal(calls,2);assert.deepEqual(await readdir(root),[]);
});

test('Un file alterato non viene riutilizzato o sostituito silenziosamente',async t=>{
  const root=await temporary(t);let calls=0;
  const fetcher=cachedPublicFetcher(root,{delayMs:0,fetcher:async()=>{calls++;return response(validTrip());}});
  await fetcher(tripUrl,options('a'));const file=join(root,(await readdir(root))[0]);
  const data=JSON.parse(await readFile(file,'utf8'));data.data.Oggetto.Fermate=[];await writeFile(file,JSON.stringify(data));
  await assert.rejects(fetcher(tripUrl,options('b')),/non integra/);assert.equal(calls,1);
});

test('Il checkpoint conserva il progresso, rifiuta un manifest diverso e il blocco impedisce avvii concorrenti',async t=>{
  const root=await temporary(t);
  await withJobLock(root,async()=>{
    const job=await checkpoint(root,{manifest:'A'});await job.put('0',{status:'matched'});
    await assert.rejects(withJobLock(root,async()=>{}),/già in esecuzione/);
  });
  await withJobLock(root,async()=>{
    const job=await checkpoint(root,{manifest:'A'},{resume:true});assert.equal(job.state.completed[0].status,'matched');
    await assert.rejects(checkpoint(root,{manifest:'B'},{resume:true}),/diversi/);
  });
  const path=join(root,'preserved.json');await atomicJSON(path,{valid:true});const circular={};circular.circular=circular;
  await assert.rejects(atomicJSON(path,circular));assert.deepEqual(JSON.parse(await readFile(path,'utf8')),{valid:true});
});

test('Il dettaglio scaricato una volta verifica due fermate diverse senza una seconda richiesta',async t=>{
  const root=await temporary(t);let calls=0;
  const make=(stopCode,time)=>({stopCode,line:'24',tripId:'ATV#1:700_1',destination:'Terminale',date:'2026-10-19',instant:new Date('2026-10-19T'+time+':00+02:00').toISOString()});
  const a=make('1974','08:00'),b=make('1973','08:10');
  const data=validTrip();data.Oggetto.Linea={Codice:'24'};data.Oggetto.Fermate=[a,b].map(expected=>({Localita:{Codice:expected.stopCode},OrarioPartenzaProgrammato:momoDate(expected.instant)}));data.Oggetto.Fermate.push({Localita:{Descrizione:'Terminale'}});
  const fetcher=cachedPublicFetcher(root,{delayMs:0,fetcher:async()=>{calls++;return response(data);}});
  for(const expected of [a,b])assert.equal((await requestTripDetail({expected,terminalCode:'1809',fetcher})).status,'matched');
  assert.equal(calls,1);assert.equal(fetcher.stats.hits,1);
});

test('Una raccolta nuova può aggiornare la cache; la sua ripresa mantiene i dettagli già aggiornati',async t=>{
  const root=await temporary(t);let calls=0;
  const fetcher=async()=>{calls++;return response(validTrip());};
  await cachedPublicFetcher(root,{fetcher,delayMs:0})(tripUrl,options('a'));
  const fresh=cachedPublicFetcher(root,{fetcher,delayMs:0,refresh:true});await fresh(tripUrl,options('b'));await fresh(tripUrl,options('c'));assert.equal(calls,2);
  const resumed=cachedPublicFetcher(root,{fetcher,delayMs:0,refresh:true,freshSince:'2000-01-01T00:00:00Z'});await resumed(tripUrl,options('d'));assert.equal(calls,2);
});

test('Le risposte storiche conservano data e provenienza e non sovrascrivono cache più recenti',async t=>{
  const root=await temporary(t);const source={file:'original.json'};
  assert.equal(await importPublicResponse(root,tripUrl,options('token'),validTrip(),{collectedAt:'2026-10-18T12:00:00Z',source}),true);
  const file=join(root,(await readdir(root))[0]);const stored=JSON.parse(await readFile(file,'utf8'));
  assert.equal(stored.collectedAt,'2026-10-18T12:00:00Z');assert.deepEqual(stored.importedFrom,source);
  assert.equal(await importPublicResponse(root,tripUrl,options('other'),validTrip(),{collectedAt:'2026-10-17T12:00:00Z',source}),false);
  await assert.rejects(importPublicResponse(root,tripUrl,options('x'),validTrip(),{}),/provenienza/);
});
