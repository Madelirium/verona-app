import test from 'node:test';
import assert from 'node:assert/strict';
import {eventSourceRevision,venueResourceRevision,applyEventEditorial} from './event-editorial.mjs';
import {eventVenueForDay} from './event-occurrence.mjs';
const now='2026-10-29T17:30:00Z';
const hit={metadata:{id:1,modified:'2026-10-29T10:00:00+01:00'},data:{'ita-IT':{event_title:'Evento',description:'Programma ufficiale',time_interval:{events:[{start:'2026-11-08T16:30:00+01:00',end:'2026-11-08T18:00:00+01:00'}]},geo:{latitude:0,longitude:0}}}};
const resource={metadata:{id:12,classIdentifier:'place',modified:'2026-01-01T10:00:00+01:00'},data:{'ita-IT':{name:'Sede ufficiale',has_address:{latitude:45.44,longitude:11,address:'Via Roma 8'}}}};
const revision=eventSourceRevision(hit),venueRevision=venueResourceRevision(resource);
const event={id:'one',sourceRevision:revision,startsAt:'2026-11-08T16:30:00+01:00',endsAt:'2026-11-08T18:00:00+01:00',mapDisabled:true,coordinates:null,location:'Sede incerta',accessNotes:'Iscrizione obbligatoria. Sede da verificare: conflitto della fonte. Consulta il programma ufficiale prima di partire.'};
const review={verification:{sourceRevision:revision,reviewedOn:'2026-10-29',validUntil:'2026-11-28',evidence:[{kind:'attachment',url:'https://www.comune.verona.it/content/download/prova.pdf',sha256:'document-hash'}]},occurrences:{'2026-11-08':{location:'Sede ufficiale · Via Roma 8',venueId:12,verified:true}}};
const context={now,venues:{12:{coordinates:{lat:45.44,lon:11},resourceRevision:venueRevision,sourceUrl:'https://www.comune.verona.it/luogo'}},venueChecks:{12:{checkedAt:now,revision:venueRevision}},documentChecks:{'https://www.comune.verona.it/content/download/prova.pdf':{checkedAt:now,sha256:'document-hash'}}};
test('Override tracciato: risolve solo il giorno verificato, conserva orari e condizioni',()=>{
  const result=applyEventEditorial(event,review,context);assert.equal(result.mapDisabled,false);assert.equal(result.coordinates.venueId,12);
  assert.equal(result.startsAt,event.startsAt);assert.match(result.accessNotes,/Iscrizione obbligatoria/);assert.doesNotMatch(result.accessNotes,/conflitto della fonte/);
  assert.equal(eventVenueForDay(result,'2026-11-09',new Date(now)).usable,false);
  assert.equal(applyEventEditorial({...event,startsAt:'2026-11-09T16:30:00+01:00'},review,context).mapDisabled,true);
});
test('Reimport invariato mantiene la prova; modifica luogo/orario/testo invalida la revisione',()=>{
  assert.equal(eventSourceRevision(structuredClone(hit)),revision);
  for(const field of ['description','geo','time_interval']){const changed=structuredClone(hit);changed.data['ita-IT'][field]=field==='description'?'Nuovo luogo':{changed:true};const result=applyEventEditorial({...event,sourceRevision:eventSourceRevision(changed)},review,context);assert.equal(result.editorialStatus.state,'stale');assert.equal(result.coordinates,null);}
});
test('Coordinate ufficiali o allegato cambiati, indisponibili o troppo vecchi bloccano il percorso',()=>{
  for(const changed of [
    {...context,venueChecks:{}},
    {...context,venueChecks:{12:{checkedAt:now,revision:'different'}}},
    {...context,venueChecks:{12:{checkedAt:'2026-10-20T12:00:00Z',revision:venueRevision}}},
    {...context,documentChecks:{}},
    {...context,documentChecks:{'https://www.comune.verona.it/content/download/prova.pdf':{checkedAt:now,sha256:'changed'}}}
  ]){const result=applyEventEditorial(event,review,changed);assert.equal(result.mapDisabled,true);assert.equal(result.editorialStatus.state,'stale');}
});
test('Scadenza si applica anche a una vecchia copia offline nel browser',()=>{
  const result=applyEventEditorial(event,review,context);assert.equal(eventVenueForDay(result,'2026-11-08',new Date('2026-11-29T10:00:00Z')).usable,false);
  assert.equal(applyEventEditorial(event,review,{...context,now:'2026-11-29T10:00:00Z'}).editorialStatus.state,'stale');
});
test('Impronta sede comprende coordinate e indirizzo, non il tempo della raccolta',()=>{
  const changed=structuredClone(resource);changed.data['ita-IT'].has_address.longitude=11.01;assert.notEqual(venueResourceRevision(changed),venueRevision);
});
test('Una vecchia verifica senza impronta conserva la presentazione ma non certifica il punto',()=>{
  const result=applyEventEditorial({...event,mapDisabled:false,coordinates:{lat:45.44,lon:11}},{localVerified:true,reviewedOn:'2026-10-17',summary:'Sintesi storica'},context);
  assert.equal(result.summary,'Sintesi storica');assert.equal(result.mapDisabled,true);assert.equal(result.editorialStatus.state,'legacy-unverified');
});
