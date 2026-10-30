import test from 'node:test';
import assert from 'node:assert/strict';
import {eventChangeReview,detectEventChanges} from './event-changes.mjs';
const old={id:'old',source:'Comune di Verona',sourceEventId:12,sourceUrl:'https://example.org/event',startsAt:'2026-11-08T16:30:00+01:00',endsAt:'2026-11-08T18:00:00+01:00',location:'Sede A',coordinates:{lat:45.44,lon:11}};
const options={from:'2026-10-29',sources:[{source:old.source,status:'ok'}]};
test('Salvati: orario spostato cambia ID ma propone soltanto una ricorrenza univoca dello stesso giorno',()=>{
  const next={...old,id:'new',startsAt:'2026-11-08T17:00:00+01:00'};
  const review=eventChangeReview(old,[next],options);assert.equal(review.kind,'changed');assert.equal(review.current.id,'new');assert.deepEqual(review.fields,['time']);
  const ambiguous=eventChangeReview(old,[next,{...next,id:'other',startsAt:'2026-11-08T20:00:00+01:00'}],options);assert.equal(ambiguous.current,null);assert.equal(ambiguous.kind,'not-present');
});
test('Salvati: orario identico con offset diverso e spostamento del punto sotto 25 m non allarmano',()=>{
  const equivalent={...old,startsAt:'2026-11-08T17:30:00+02:00',endsAt:'2026-11-08T19:00:00+02:00',coordinates:{lat:45.44001,lon:11}};
  assert.equal(eventChangeReview(old,[equivalent],options).kind,'unchanged');
  assert.deepEqual(eventChangeReview(old,[{...old,location:'Sede B'}],options).fields,['location']);
});
test('Rimozione non significa annullamento; raccolta fallita e archivio sono distinti',()=>{
  const missing=eventChangeReview(old,[],options);assert.equal(missing.kind,'not-present');assert.match(missing.message,/Non significa che sia annullato/);
  assert.equal(eventChangeReview(old,[],{...options,sources:[{source:old.source,status:'error'}]}).kind,'unverified');
  assert.equal(eventChangeReview({...old,startsAt:'2026-10-20',endsAt:'2026-10-20'},[],options).kind,'historical');
});
test('Identificativo ricorrenza ufficiale stabile riconosce una data spostata senza deduzioni dal titolo',()=>{
  const snapshot={...old,sourceOccurrenceId:'official-reference'},next={...snapshot,id:'moved-date',startsAt:'2026-11-09T16:30:00+01:00',endsAt:'2026-11-09T18:00:00+01:00'};
  const result=eventChangeReview(snapshot,[next],options);assert.equal(result.current.id,'moved-date');assert.deepEqual(result.fields,['time']);
  assert.equal(eventChangeReview({...old,sourceOccurrenceId:undefined},[next],options).current,null);
});
test('Registro significativo: esclude fonti fallite e ignora descrizioni e nuovo checkedAt',()=>{
  const run=current=>detectEventChanges([old],current,{from:options.from,checkedAt:'2026-10-29T17:00:00Z',successfulSources:[old.source]});
  assert.equal(run([{...old,summary:'Descrizione nuova',checkedAt:'oggi'}]).length,0);
  assert.equal(run([])[0].kind,'not-present');assert.deepEqual(run([{...old,location:'Sede B'}])[0].fields,['location']);
  assert.deepEqual(detectEventChanges([old],[],{from:options.from,successfulSources:[]}),[]);
});
