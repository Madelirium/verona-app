import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {eventVenueForDay} from './event-occurrence.mjs';
import {applyEventEditorial} from './event-editorial.mjs';

const sourceUrl='https://www.comune.verona.it/Vivere-il-comune/Eventi/Il-Teatro-nei-Quartieri-2026';
const fixture=JSON.parse(await readFile(new URL('./fixtures/editorial-reviewed-theatre.json',import.meta.url),'utf8'));
const editorial={[sourceUrl]:fixture.review},catalog={events:fixture.rows};
const context={now:fixture.now,venues:fixture.venues,venueChecks:Object.fromEntries(Object.entries(fixture.venues).map(([id,v])=>[id,{checkedAt:fixture.now,revision:v.resourceRevision}]))};
function apply(event){
  return applyEventEditorial(structuredClone(event),fixture.review,context);
}
const row=day=>catalog.events.find(e=>e.sourceUrl===sourceUrl&&e.startsAt.startsWith(day));

test('Teatro 8 novembre: sede del programma e nessun pin ereditato da San Massimo',()=>{
  const original=row('2026-11-08');assert.ok(original);
  const event=apply(original),venue=eventVenueForDay(event,'2026-11-08',new Date(fixture.now));
  assert.match(event.location,/San Giovanni Evangelista/);
  assert.equal(event.coordinates.venueId,17970);assert.equal(event.mapDisabled,false);
  assert.equal(venue.usable,true);assert.equal(venue.coordinates.lat,45.418368);
  assert.equal(event.startsAt,original.startsAt);assert.equal(event.endsAt,original.endsAt);
  assert.equal(event.price,0);assert.match(event.accessNotes,/prenotazione/i);
});

test('Teatro 19 novembre: Camploy anziché la sede generica della rassegna',()=>{
  const event=apply(row('2026-11-19'));
  assert.match(event.location,/Teatro Camploy/);
  assert.equal(eventVenueForDay(event,'2026-11-19',new Date(fixture.now)).coordinates.venueId,352);
});

test('Teatro: cinque sedi future, nessun indirizzo o punto dedotto dal nome',()=>{
  const review=editorial[sourceUrl];
  assert.deepEqual(Object.keys(review.locationsByDay),['2026-11-08','2026-11-13','2026-11-19','2026-12-08','2026-12-12']);
  assert.equal(review.locationsByDay['2026-10-25'],undefined);
  for(const [day,occurrence]of Object.entries(review.occurrences)){
    assert.equal(occurrence.location,review.locationsByDay[day]);
    assert.equal(occurrence.coordinates,undefined);
    assert.equal(occurrence.verified,['2026-11-08','2026-11-19'].includes(day));
  }
});

test('Teatro: il resolver non presta il punto a un giorno privo di sede verificata',()=>{
  const event=apply(row('2026-11-08'));
  const venue=eventVenueForDay(event,'2026-11-20',new Date(fixture.now));
  assert.equal(venue.usable,false);assert.equal(venue.coordinates,null);
});

test('Teatro: la build blocca anche una nuova ricorrenza non mappata',()=>{
  const event=apply({...row('2026-11-08'),startsAt:'2026-11-20T21:00:00+01:00',endsAt:'2026-11-20T22:30:00+01:00'});
  assert.equal(event.coordinates,null);
  assert.equal(event.mapDisabled,true);
  assert.match(event.location,/da verificare/);
  assert.equal(eventVenueForDay(event,'2026-11-20').usable,false);
});
