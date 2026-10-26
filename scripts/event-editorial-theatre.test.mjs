import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {eventVenueForDay} from './event-occurrence.mjs';

const sourceUrl='https://www.comune.verona.it/Vivere-il-comune/Eventi/Il-Teatro-nei-Quartieri-2026';
const editorial=JSON.parse(await readFile(new URL('../data/editorial.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../data/events.json',import.meta.url),'utf8'));
// Exercise the actual editorial transformation without invoking the writing build.
const build=await readFile(new URL('./build-calendar.mjs',import.meta.url),'utf8');
const start=build.indexOf('data.events=data.events.map(e=>{');
const end=build.indexOf('\n  data.districts=',start);
assert.ok(start>=0&&end>start,'Trasformazione editoriale della build riconoscibile');
function apply(event){
  const data={events:[structuredClone(event)]};
  runInNewContext(build.slice(start,end),{data,editorial,Intl,Date});
  return data.events[0];
}
const row=day=>catalog.events.find(e=>e.sourceUrl===sourceUrl&&e.startsAt.startsWith(day));

test('Teatro 8 novembre: sede del programma e nessun pin ereditato da San Massimo',()=>{
  const original=row('2026-11-08');assert.ok(original);
  const event=apply(original),venue=eventVenueForDay(event,'2026-11-08');
  assert.match(event.location,/Teatro S\. Giovanni Evangelista/);
  assert.equal(event.coordinates,null);assert.equal(event.mapDisabled,true);
  assert.equal(venue.usable,false);assert.equal(venue.coordinates,null);
  assert.equal(event.startsAt,original.startsAt);assert.equal(event.endsAt,original.endsAt);
  assert.equal(event.price,0);assert.match(event.accessNotes,/prenotazione/i);
});

test('Teatro 19 novembre: Camploy anziché la sede generica della rassegna',()=>{
  const event=apply(row('2026-11-19'));
  assert.match(event.location,/Teatro Camploy/);
  assert.equal(eventVenueForDay(event,'2026-11-19').coordinates,null);
});

test('Teatro: cinque sedi future, nessun indirizzo o punto dedotto dal nome',()=>{
  const review=editorial[sourceUrl];
  assert.deepEqual(Object.keys(review.locationsByDay),['2026-11-08','2026-11-13','2026-11-19','2026-12-08','2026-12-12']);
  assert.equal(review.locationsByDay['2026-10-25'],undefined);
  for(const [day,occurrence]of Object.entries(review.occurrences)){
    assert.equal(occurrence.location,review.locationsByDay[day]);
    assert.equal(occurrence.coordinates,null);assert.equal(occurrence.verified,false);
    assert.equal(eventVenueForDay({...row('2026-11-08'),...review},day).usable,false);
  }
});

test('Teatro: il resolver non presta il punto a un giorno privo di sede verificata',()=>{
  const event=apply(row('2026-11-08'));
  const venue=eventVenueForDay(event,'2026-11-20');
  assert.equal(venue.usable,false);assert.equal(venue.coordinates,null);
});

test('Teatro: la build blocca anche una nuova ricorrenza non mappata',()=>{
  const event=apply({...row('2026-11-08'),startsAt:'2026-11-20T21:00:00+01:00',endsAt:'2026-11-20T22:30:00+01:00'});
  assert.equal(event.coordinates,null);
  assert.equal(event.mapDisabled,true);
  assert.match(event.location,/da verificare/);
  assert.equal(eventVenueForDay(event,'2026-11-20').usable,false);
});
