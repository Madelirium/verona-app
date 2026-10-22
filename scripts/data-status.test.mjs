import test from 'node:test';
import assert from 'node:assert/strict';
import {datasetStatus} from './data-status.mjs';
const calendar={validFrom:'2026-10-18',validTo:'2026-11-17',publicationTimestamp:'2026-10-18T00:47:56Z'};
test('Validità ATV: distingue futuro, valido, scadenza e scaduto alla mezzanotte italiana',()=>{
  const at=now=>datasetStatus(calendar,{calendar:true,now});
  assert.equal(at('2026-10-17T21:59:59Z').state,'future');
  assert.equal(at('2026-10-17T22:00:00Z').state,'current');
  assert.equal(at('2026-11-10T11:00:00Z').state,'expiring');
  assert.match(at('2026-11-17T22:59:59Z').message,/fino a oggi/);
  assert.equal(at('2026-11-17T23:00:00Z').state,'expired');
});
test('Date mancanti, impossibili e intervalli invertiti non diventano orari validi',()=>{
  for(const data of [{},{validFrom:'2026-02-30',validTo:'2026-11-17'},{validFrom:'2026-11-18',validTo:'2026-11-17'}])assert.equal(datasetStatus(data,{calendar:true}).state,'unknown');
});
test('Una fonte vecchia non è nascosta da una raccolta globale recente; errore conserva lo stato parziale',()=>{
  const now='2026-10-21T12:00:00Z',data={updatedAt:now,sources:[{lastSuccessAt:'2026-10-18T12:00:00Z'}]};
  assert.equal(datasetStatus(data,{now,maxAgeHours:48}).state,'stale');
  data.sources[0].status='error';assert.equal(datasetStatus(data,{now,maxAgeHours:48}).state,'partial');
  assert.equal(datasetStatus({updatedAt:now},{now,maxAgeHours:48}).state,'current');
});
test('Timestamp mancanti o futuri non dichiarano un aggiornamento riuscito; i cataloghi statici non scadono dopo 48 ore',()=>{
  const now='2026-10-21T12:00:00Z';
  for(const updatedAt of [undefined,'non valida','2026-10-22T12:00:00Z'])assert.equal(datasetStatus({updatedAt},{now,maxAgeHours:48}).state,'unknown');
  assert.equal(datasetStatus({updatedAt:'2026-01-01T00:00:00Z'},{now}).state,'snapshot');
  assert.equal(datasetStatus({updatedAt:'2026-10-20T10:00:00Z',status:'error'},{now}).state,'partial');
});
