import test from 'node:test';
import assert from 'node:assert/strict';
import {collectEvents,validateFrom} from './event-sync.mjs';

const before='2026-10-17T10:00:00Z',now='2026-10-18T10:00:00Z';
const row=(id,source='Comune di Verona')=>({id,title:id,source,startsAt:'2026-10-20',endsAt:'2026-10-20',checkedAt:before});
const previous={updatedAt:before,events:[row('c'),row('f','Veronafiere')]};
const fail=async()=>{throw new Error('HTTP 503')};
const run=loaders=>collectEvents({from:'2026-10-18',checkedAt:now,previous,loaders});

test('Una raccolta completa sostituisce gli eventi per fonte e mantiene gli identificativi',async()=>{
  const data=await run({comune:async()=>[{...row('c'),title:'Orario aggiornato'},row('new'),row('new')],fiere:async()=>[row('f','Veronafiere')]});
  assert.equal(data.importReport.status,'ok');assert.equal(data.events.length,3);
  assert.equal(data.events.find(e=>e.id==='c').title,'Orario aggiornato');
  assert.equal(data.importReport.sources[0].added,1);assert.equal(data.updatedAt,now);
});
test('Una fonte non disponibile conserva soltanto i propri dati e la data del successo precedente',async()=>{
  const data=await run({comune:fail,fiere:async()=>[row('new','Veronafiere')]});
  assert.equal(data.importReport.status,'partial');assert.deepEqual(data.events.map(e=>e.id),['c','new']);
  assert.equal(data.importReport.sources[0].lastSuccessAt,before);assert.equal(data.importReport.sources[1].lastSuccessAt,now);
});
test('Un fallimento totale non finge una nuova raccolta riuscita',async()=>{
  const data=await run({comune:fail,fiere:fail});assert.equal(data.importReport.status,'error');assert.equal(data.updatedAt,before);
  assert.deepEqual(data.events,previous.events);assert.equal(data.importReport.checkedAt,now);
});
test('Una fonte vuota o un calo anomalo non cancella il catalogo precedente',async()=>{
  const prev={...previous,events:Array.from({length:30},(_,i)=>row('c'+i))};
  const data=await collectEvents({from:'2026-10-18',checkedAt:now,previous:prev,loaders:{comune:async()=>[row('only')],fiere:async()=>[]}});
  assert.equal(data.events.length,30);assert.match(data.importReport.sources[0].error,/70%/);assert.match(data.importReport.sources[1].error,/Nessun evento/);
});
test('Il calo non conta eventi scaduti e una rimozione non viene chiamata cancellazione',async()=>{
  const prev={...previous,events:[...Array.from({length:30},(_,i)=>({...row('old'+i),startsAt:'2026-10-01',endsAt:'2026-10-01'})),row('c')]};
  const data=await collectEvents({from:'2026-10-18',checkedAt:now,previous:prev,loaders:{comune:async()=>[row('new')],fiere:async()=>[row('f','Veronafiere')]}});
  assert.equal(data.importReport.status,'ok');assert.equal(data.importReport.sources[0].removed,1);
});
test('La prima raccolta fallita non inventa una data e date impossibili vengono rifiutate',async()=>{
  const data=await collectEvents({from:'2026-10-18',checkedAt:now,loaders:{comune:fail,fiere:fail}});
  assert.equal(data.updatedAt,null);assert.equal(data.events.length,0);
  for(const value of ['2026-02-30','2026-13-01','invalid'])assert.throws(()=>validateFrom(value),/EVENTS_FROM/);
});
