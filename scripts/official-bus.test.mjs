import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateOfficialLine} from './official-bus.mjs';
const root=new URL('../data/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('bus-official.json',root),'utf8'));
const assets=await Promise.all(manifest.lines.map(async line=>JSON.parse(await readFile(new URL('bus-official/'+line.number+'.json',root),'utf8'))));

test('NeTEx: tutte le linee e tutti i passaggi sono esportati, con riferimenti e sequenze temporali validi',()=>{
  const codes=new Set(),trips=new Set();let calls=0;
  assert.equal(assets.length,manifest.counts.Line);
  for(const asset of assets){
    validateOfficialLine(asset,manifest,asset.number);
    Object.keys(asset.stops).forEach(code=>codes.add(code));
    for(const trip of asset.trips){assert.ok(!trips.has(trip.id));trips.add(trip.id);calls+=trip.calls.length;}
  }
  assert.equal(trips.size,manifest.counts.ServiceJourney);
  assert.equal(calls,manifest.counts.TimetabledPassingTime);
  for(const stop of manifest.unassignedStops){assert.ok(!codes.has(stop.code));codes.add(stop.code);}
  assert.equal(codes.size,manifest.counts.ScheduledStopPoint);
});

test('NeTEx esportato: i 106 passaggi conservano orari, codici corsa e giorni dei campioni ufficiali',async()=>{
  const {trials}=JSON.parse(await readFile(new URL('bus-stop-trials.json',root),'utf8'));
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let matched=0;
  for(const trial of trials){
    const observed=[];
    for(const asset of assets.filter(a=>trial.departures.some(d=>d.line===a.number)))for(const trip of asset.trips.filter(t=>t.dates.includes(trial.date)))for(const call of trip.calls)if(call[0]===trial.stopCode&&call[3])observed.push([`ATV#1:${trip.id}`,call[1]]);
    const expected=trial.departures.map(row=>[row.tripId,clock.format(new Date(row.instant))]);
    assert.deepEqual(observed.sort(),expected.sort());matched+=expected.length;
  }
  assert.equal(matched,106);
});

test('NeTEx: archivio mancante, alterato o mescolato con un’altra versione non supera la validazione',()=>{
  const original=assets.find(a=>a.number==='24');
  for(const change of [data=>data.sha256='different',data=>data.trips[0].calls[0][0]='missing',data=>data.trips[0].dates.push('2027-01-01'),data=>data.trips.pop()]){
    const data=structuredClone(original);change(data);assert.throws(()=>validateOfficialLine(data,manifest,'24'),/non valido/);
  }
});
