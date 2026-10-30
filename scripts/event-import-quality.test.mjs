import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseComune} from './parsers.mjs';
import {publicEventText} from './event-text.mjs';
import {attachComuneVenues} from './event-venues.mjs';
import {eventVenueForDay} from './event-occurrence.mjs';
import {collectEvents} from './event-sync.mjs';

// Minimal first-party API excerpts read on 29 October; contact fields omitted.
const hits=JSON.parse(await readFile(new URL('./fixtures/event-import-sample.json',import.meta.url),'utf8'));
const venues=JSON.parse(await readFile(new URL('./fixtures/event-import-venues.json',import.meta.url),'utf8'));
const options={from:'2026-10-29',checkedAt:'2026-10-29T12:00:00Z'};
const parsed=()=>parseComune(structuredClone(hits),options);
const first=(rows,id)=>rows.find(e=>e.sourceEventId===id);

test('Campioni reali: iscrizione digitale, posti limitati e destinatari non si perdono dietro Gratuito',()=>{
  const rows=parsed(),digital=first(rows,23941),writing=first(rows,19204),italian=first(rows,24799);
  assert.equal(digital.price,0);assert.match(digital.accessNotes,/necessaria iscrizione/);
  assert.match(writing.accessNotes,/posti sono limitati/);
  assert.match(italian.summary,/donne straniere/);assert.match(italian.accessNotes,/mamme alloglotte/);
  assert.match(italian.accessNotes,/baby parking/);assert.match(italian.accessNotes,/0-3 anni/);
  assert.deepEqual(digital.targetAudience,['Adulti','Anziani','Giovani']);
  assert.equal(digital.sourceModifiedAt,'2026-10-21T10:06:08+02:00');
});

test('Campioni reali 29 ottobre: conserva gli istanti, visualizzati correttamente in Europe/Rome',()=>{
  const rows=parsed(),clock=value=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  for(const [id,start,end]of [[19204,'09:30','11:00'],[23941,'09:30','12:00'],[24799,'09:30','11:30'],[23465,'10:00','19:00']]){
    const event=first(rows,id);assert.equal(clock(event.startsAt),start);assert.equal(clock(event.endsAt),end);
  }
  assert.equal(first(rows,23465).price,null);
});

test('Campione Scienza: conflitto Piazza del Popolo / sede in Via Aldo Fedeli blocca il percorso',async()=>{
  const rows=await attachComuneVenues(parsed(),async id=>venues[id]);
  const event=first(rows,24241);
  assert.equal(event.mapDisabled,true);assert.equal(event.coordinates,null);
  assert.ok(event.locationIssues.includes('linked-address-conflict'));
  assert.match(event.accessNotes,/Sede da verificare/);
  assert.equal(eventVenueForDay(event,'2026-10-29').usable,false);
  // Thursday is explicitly supplied by the API: report the recurrence exception, never move it to Wednesday.
  assert.equal(event.startsAt,'2026-10-29T21:00:00+01:00');
  assert.deepEqual(event.dateIssues,['recurrence-weekday-exception']);
});

test('Campioni Palazzina e primo soccorso: blocco generale per indirizzi discordanti, non per titolo',async()=>{
  const rows=await attachComuneVenues(parsed(),async id=>venues[id]);
  assert.ok(first(rows,25194).locationIssues.includes('narrative-address-conflict'));
  assert.ok(first(rows,25321).locationIssues.includes('linked-narrative-conflict'));
  assert.equal(first(rows,25194).coordinates,null);
});

test('Sede coerente: recupera il punto ufficiale senza inventare un ingresso',async()=>{
  const rows=await attachComuneVenues(parsed(),async id=>venues[id]),event=first(rows,24799);
  assert.equal(event.mapDisabled,undefined);assert.equal(event.coordinates.precision,'venue');
  assert.equal(event.coordinates.venueId,17970);assert.equal(event.coordinates.lat,45.418368);
});

test('Due punti ufficiali lontani: conserva un avviso anziché scegliere arbitrariamente',async()=>{
  const original={...first(parsed(),24241),locationEvidence:{address:'Via Aldo Fedeli 12'},coordinates:{lat:45.45,lon:11.09}};
  const [event]=await attachComuneVenues([original],async()=>venues[6544]);
  assert.ok(event.locationIssues.includes('linked-coordinate-conflict'));assert.equal(event.coordinates,null);
  const coherent={...original,coordinates:{lat:45.434512,lon:11.045153}};
  assert.deepEqual((await attachComuneVenues([coherent],async()=>venues[6544]))[0].coordinates,coherent.coordinates);
});

test('Descrizioni limitate, HTML inerte, contatti rimossi; gratuità solo dal campo esplicito',()=>{
  const value='<script>codice segreto</script><style>css segreto</style><p>Necessaria iscrizione: persona@example.org, +39 3401234567, 340 123 4567, 045 540073, 045 807 7633.</p>';
  const safe=publicEventText(value);assert.doesNotMatch(safe,/segreto|example|3401234567|540073|4567|7633|<[^>]+>/);
  assert.equal(publicEventText('Il 01 11 2026, ore 9.30–11.30.'),'Il 01 11 2026, ore 9.30–11.30.');
  assert.match(safe,/Necessaria iscrizione/);assert.ok(publicEventText('Parola '.repeat(1000),300).length<=300);
  const hit=structuredClone(hits[0]);hit.data['ita-IT'].description='Ingresso gratuito, prenotazione obbligatoria.';
  const [event]=parseComune([hit],options);assert.equal(event.price,null);assert.match(event.accessNotes,/prenotazione obbligatoria/);
});

test('Ricorrenze esplicite vuote non risuscitano quelle rimosse; date impossibili sono segnalate',()=>{
  const hit=structuredClone(hits[0]),data=hit.data['ita-IT'];
  data.time_interval.recurrences=data.time_interval.events;data.time_interval.events=[];
  assert.deepEqual(parseComune([hit],options),[]);
  data.time_interval.events=[{start:'2026-11-31T10:00:00+01:00',end:'2026-11-31T11:00:00+01:00'}];
  const issues=[];assert.deepEqual(parseComune([hit],{...options,onIssue:i=>issues.push(i)}),[]);
  assert.equal(issues[0].code,'invalid-occurrence');
});

test('Rapporto distingue esito raccolta da qualità e non chiama cancellazione una rimozione',async()=>{
  const event=first(parsed(),23941);
  const result=await collectEvents({...options,previous:{events:[{...event,id:'removed'}]},loaders:{
    comune:async({diagnostics})=>{diagnostics.quality={venueFailures:1,issues:[{code:'example',sourceRecords:1}]};return [event];},
    fiere:async()=>[{...event,id:'fair',source:'Veronafiere'}]
  }});
  assert.equal(result.importReport.status,'ok');assert.equal(result.importReport.sources[0].removed,1);
  assert.equal(result.importReport.sources[0].diagnostics.quality.venueFailures,1);
  assert.equal(result.events.some(e=>e.id==='removed'),false);
});

test('Rapporto conta modifiche visibili e duplicati senza confondere il nuovo controllo con un aggiornamento',async()=>{
  const event=first(parsed(),23941),old={...event,checkedAt:'2026-10-28T12:00:00Z'};
  const run=async current=>collectEvents({...options,previous:{events:[old]},loaders:{comune:async()=>[current,current],fiere:async()=>[{...event,id:'fair',source:'Veronafiere'}]}});
  const unchanged=await run(event);assert.equal(unchanged.importReport.sources[0].updated,0);
  assert.equal(unchanged.importReport.sources[0].diagnostics.duplicateOccurrences,1);
  assert.equal((await run({...event,accessNotes:'Nuova condizione dalla fonte'})).importReport.sources[0].updated,1);
});
