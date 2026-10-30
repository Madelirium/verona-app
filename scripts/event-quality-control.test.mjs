import test from 'node:test';
import assert from 'node:assert/strict';
import {addressConflict,narrativeVenueAddresses,variableVenueProgramme} from './event-location-quality.mjs';
import {comuneDetails,conditionFamilies,publicEventText} from './event-text.mjs';
import {parseComune} from './parsers.mjs';
import {auditEventQuality} from './event-quality-control.mjs';
import {attachComuneVenues} from './event-venues.mjs';

test('Indirizzi: iniziali e civici con barra equivalgono, nomi parzialmente comuni non equivalgono',()=>{
  assert.equal(addressConflict('v. A. Fedeli n°12','Via Aldo Fedeli 12'),false);
  assert.equal(addressConflict('Via Roma 1/G','Via Roma 1g'),false);
  assert.equal(addressConflict('Via Roma 1/G','Via Roma 1'),true);
  assert.equal(addressConflict('Via Vittorio Veneto 12','Via Vittorio Emanuele 12'),true);
  assert.equal(addressConflict('Piazza Roma 8','Via Roma 8'),true);
  assert.equal(addressConflict('Via Velino 27','Via Velino 22'),true);
});

test('Indirizzi narrativi: non trasforma recapito e sede legale in luoghi di svolgimento',()=>{
  const value='<p>L’incontro si terrà presso il Centro in via Aldo Fedeli 12. Per informazioni presso la segreteria in Via Roma 7.</p><p>Sede legale: Via Milano 20.</p>';
  assert.deepEqual(narrativeVenueAddresses(value),['via Aldo Fedeli 12']);
  assert.deepEqual(narrativeVenueAddresses('<p>Evento presso via A. Fedeli 12 e presso via Aldo Fedeli 12.</p>'),['via A. Fedeli 12']);
});

test('Shakespeare: programma con teatro e altre location richiede la sede per data',()=>{
  assert.equal(variableVenueProgramme('Spettacoli teatrali presso il Teatro Satiro OFF e in location suggestive all’interno di festival estivi.'),true);
  assert.equal(variableVenueProgramme('Spettacolo presso il Teatro Satiro OFF. Per informazioni rivolgersi alla sede legale.'),false);
});

test('Bulbetto: le condizioni dopo br rimangono insieme alla clausola senza prenotazione',()=>{
  const details=comuneDetails({description:'<ul><li>senza prenotazione:<br/>- recandosi al mattino dalle ore 9.30 alle 13, se disponibili<br/>- recandosi al pomeriggio dalle ore 14.00 alle 16, fino ad esaurimento delle scorte</li></ul>'});
  assert.match(details.accessNotes,/senza prenotazione/);assert.match(details.accessNotes,/14\.00 alle 16/);
});

test('Requisito in fondo a un paragrafo lungo: scansione e priorità precedono il taglio',()=>{
  const details=comuneDetails({description:'<p>'+('Presentazione culturale '.repeat(160))+'Per partecipare è necessaria iscrizione entro venerdì, posti limitati.</p>'});
  assert.match(details.accessNotes,/necessaria iscrizione entro venerdì/);assert.match(details.accessNotes,/posti limitati/);
  assert.ok(details.summary.length<=1600);assert.ok(details.accessNotes.length<1900);
  assert.deepEqual(conditionFamilies(details.accessNotes),['registration','capacity']);
});

test('Al lavoro consapevolmente: iscriversi è una condizione, non soltanto iscrizione',()=>{
  const details=comuneDetails({description:'<p>La partecipazione è limitata ad un numero massimo di iscritti, selezionati in ordine di iscrizione.</p><p>E’ possibile iscriversi ai singoli incontri o all’intero ciclo di eventi, selezionandoli nel seguente form.</p>'});
  assert.match(details.accessNotes,/possibile iscriversi ai singoli incontri/);
});

test('Intervallo CAP Verona: 37121-37142 non è un numero di cellulare',()=>{
  assert.equal(publicEventText('37121-37142 Verona'),'37121-37142 Verona');
  assert.equal(publicEventText('340 123 4567'),'[contatto sulla fonte]');
});

const options={from:'2026-10-29',checkedAt:'2026-10-29T16:00:00Z'};
function hit(){return {metadata:{id:999,modified:'2026-10-29T10:00:00+01:00'},data:{'ita-IT':{event_title:'Prova',description:'<p>Iscrizione obbligatoria.</p>',time_interval:{events:[{start:'2026-11-01T10:00:00+01:00',end:'2026-11-01T11:00:00+01:00'}]}}}};}
test('Controllo ripetibile: separa anomalie fonte, errori esportazione e cambi successivi',async()=>{
  const source=hit(),rows=parseComune([source],options),catalog={updatedAt:options.checkedAt,importReport:{from:options.from},events:rows};
  assert.equal((await auditEventQuality({hits:[source],catalog})).status,'ok');
  const broken=structuredClone(catalog);broken.events[0].startsAt='2026-11-01T12:00:00+01:00';
  const mismatch=await auditEventQuality({hits:[source],catalog:broken});
  assert.ok(mismatch.importerErrors.some(i=>i.code==='invalid-exported-time'));
  const changed=structuredClone(source);changed.metadata.modified='2026-10-29T20:00:00+01:00';
  const drift=await auditEventQuality({hits:[changed],catalog});assert.equal(drift.counts.sourceChanges,1);assert.equal(drift.importerErrors.length,0);
  const bad=hit();bad.data['ita-IT'].time_interval.events.push({start:'2026-11-02T12:00:00+01:00',end:'2026-11-02T11:00:00+01:00'});
  const upstream=await auditEventQuality({hits:[bad],catalog});assert.ok(upstream.sourceAnomalies.some(i=>i.classification==='source-invalid-time'));assert.equal(upstream.importerErrors.length,0);
});

test('Controllo ripetibile: duplicati equivalenti e rimozione fonte non diventano cancellazione certa',async()=>{
  const source=hit(),rows=parseComune([source],options),catalog={updatedAt:options.checkedAt,importReport:{from:options.from},events:[...rows,{...rows[0],id:'other-id'}]};
  const duplicates=await auditEventQuality({hits:[source],catalog});assert.ok(duplicates.importerErrors.some(i=>i.code==='duplicate-source-occurrence'));
  const removed=await auditEventQuality({hits:[],catalog:{...catalog,events:rows}});
  assert.ok(removed.sourceChanges.some(i=>/not-confirmed-cancelled/.test(i.code)));
});

test('Soglia di revisione: distingue 349 e 351 metri senza dichiarare precisione dell’ingresso',async()=>{
  const venue={metadata:{id:12,classIdentifier:'place'},data:{'ita-IT':{name:'Sede',has_address:{latitude:45.44,longitude:11,address:'Via Roma 8'}}}};
  const event={source:'Comune di Verona',venueIds:[12],locationEvidence:{address:'Via Roma 8'}};
  const near={...event,coordinates:{lat:45.44+349/111195,lon:11}},far={...event,coordinates:{lat:45.44+351/111195,lon:11}};
  const results=await attachComuneVenues([near,far],async()=>venue);
  assert.equal(results[0].mapDisabled,undefined);assert.equal(results[1].mapDisabled,true);
});

test('Controllo: sede mancante è evidenza incompleta, sede modificata è variazione fonte',async()=>{
  const source=hit();source.data['ita-IT'].takes_place_in=[{id:12,classIdentifier:'place',name:{'ita-IT':'Sede'}}];
  const rows=parseComune([source],options),catalog={updatedAt:options.checkedAt,importReport:{from:options.from},events:rows};
  const incomplete=await auditEventQuality({hits:[source],catalog});assert.equal(incomplete.status,'incomplete');assert.equal(incomplete.counts.missingVenueResources,1);
  const venue={metadata:{id:12,classIdentifier:'place',modified:'2026-10-29T20:00:00+01:00'},data:{'ita-IT':{name:'Sede',has_address:{latitude:45.44,longitude:11,address:'Via Roma 8'}}}};
  const changed=await auditEventQuality({hits:[source],venues:{12:venue},catalog});assert.equal(changed.status,'source-changed');assert.equal(changed.importerErrors.length,0);
});
