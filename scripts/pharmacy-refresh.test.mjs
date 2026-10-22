import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {refreshPharmacies,pharmacyPdfLinks,pharmacyCoverage} from './pharmacy-refresh.mjs';
import {validatePharmacies} from './pharmacies.mjs';
const extracted=JSON.parse(await readFile(new URL('fixtures/pharmacy-tables.json',import.meta.url),'utf8')),snapshot=JSON.parse(await readFile(new URL('fixtures/pharmacies.json',import.meta.url),'utf8'));
const current=snapshot.periods.find(period=>period.startsAt==='2026-10-22T07:00:00.000Z').sourceUrl,next=snapshot.periods.find(period=>period.startsAt==='2026-10-24T07:00:00.000Z').sourceUrl;
function options(overrides={}){return {now:'2026-10-22T10:00:00Z',day:'2026-10-22',fetchPage:async()=>'<a href="'+current+'">turno</a><a href="'+next+'">successivo</a>',fetchPdf:async url=>Buffer.from('%PDF-'+url),extractPdf:async bytes=>extracted[bytes.toString().endsWith(current)?'current':'next'],loadPositions:async()=>({elements:[{id:1,type:'node',lat:45.438,lon:10.99,tags:{amenity:'pharmacy',phone:'0458006660'}}]}),...overrides};}
test('Aggiornamento farmacie: seleziona solo PDF ufficiali nel periodo, con link relativi e senza duplicati',()=>{
  assert.deepEqual(pharmacyPdfLinks('<a href="'+current+'">a</a><a href="'+current+'">b</a><a href="https://example.com/f.pdf">x</a>','2026-10-22'),[current]);
  assert.deepEqual(pharmacyPdfLinks('<a href="'+new URL(current).pathname+'?download=1&amp;v=2">a</a>','2026-10-22'),[current+'?download=1&v=2']);
  assert.throws(()=>pharmacyPdfLinks('<html>nessun calendario</html>','2026-10-22'));assert.throws(()=>pharmacyPdfLinks('', '2026-02-30'));
});
test('Aggiornamento farmacie: raccolta completa, cache verificata per hash e coordinate non riscaricate ogni giorno',async()=>{
  const first=await refreshPharmacies(options());assert.equal(first.report.status,'ok');assert.equal(first.report.items.filter(item=>item.extraction==='parsed').length,2);assert.equal(first.data.periods[0].items[0].position.source,'OpenStreetMap contributors');
  const original=JSON.stringify(first.data);let maps=0,parses=0;
  const second=await refreshPharmacies(options({previous:first.data,now:'2026-10-23T10:00:00Z',day:'2026-10-23',extractPdf:async()=>{parses++;throw Error('non necessario')},loadPositions:async()=>{maps++;throw Error('non necessario')}}));
  assert.equal(second.report.status,'ok');assert.equal(second.report.items.every(item=>item.extraction==='unchanged'),true);assert.equal(parses,0);assert.equal(maps,0);assert.equal(JSON.stringify(first.data),original);assert.equal(second.data.checkedAt,'2026-10-23T10:00:00Z');
});
test('Aggiornamento farmacie: rete o PDF incompleto non producono un catalogo da sostituire al precedente',async()=>{
  const original=JSON.stringify(snapshot);
  for(const failure of [{fetchPage:async()=>{throw Error('HTTP 503')}},{fetchPdf:async()=>Buffer.from('pagina HTML')},{extractPdf:async()=>{throw Error('colonne inattese')}}]){
    const result=await refreshPharmacies(options({...failure,previous:snapshot}));assert.equal(result.data,null);assert.equal(result.report.status,'error');assert.equal(result.report.preservedPrevious,true);assert.ok(result.report.error);assert.equal(JSON.stringify(snapshot),original);
  }
});
test('Aggiornamento farmacie: rifiuta vuoti nel calendario, copertura ridotta e soli turni già scaduti',async()=>{
  const gap=structuredClone(snapshot);gap.periods=gap.periods.filter(period=>period.startsAt!=='2026-10-26T08:00:00.000Z');assert.throws(()=>pharmacyCoverage(gap,'2026-10-22T10:00:00Z',snapshot),/Manca/);
  const short=structuredClone(snapshot);short.periods=short.periods.slice(0,4);assert.throws(()=>pharmacyCoverage(short,'2026-10-22T10:00:00Z',snapshot),/riduce/);
  assert.throws(()=>pharmacyCoverage(snapshot,'2026-11-01T08:00:00Z'),/non copre/);
  const result=await refreshPharmacies(options({previous:snapshot}));assert.equal(result.data,null);assert.match(result.report.error,/riduce/);
});
test('Aggiornamento farmacie: un problema solo delle coordinate conserva i punti e permette i nuovi turni',async()=>{
  const first=await refreshPharmacies(options());first.data.positionsCheckedAt='2026-10-01T10:00:00Z';const point=structuredClone(first.data.periods[0].items[0].position);
  const result=await refreshPharmacies(options({previous:first.data,loadPositions:async()=>{throw Error('OSM non disponibile')}}));assert.equal(result.report.status,'ok');assert.equal(result.data.positionStatus,'cached');assert.deepEqual(result.data.periods[0].items[0].position,point);assert.match(result.report.warnings[0],/Coordinate non aggiornate/);
});
test('Aggiornamento farmacie: avviso quando mancano nuove pubblicazioni e copertura sotto 72 ore',async()=>{
  const result=await refreshPharmacies(options({now:'2026-10-26T07:00:00Z',day:'2026-10-26'}));assert.equal(result.report.status,'ok');assert.ok(result.report.warnings.some(warning=>warning.includes('72 ore')));assert.equal(result.report.coverage.remainingHours,1);
});
test('Catalogo farmacie distribuibile: resta valido anche dopo nuovi import, senza date fissate nei test UI',async()=>{
  const live=JSON.parse(await readFile(new URL('../data/pharmacies.json',import.meta.url),'utf8'));assert.doesNotThrow(()=>validatePharmacies(live));
});
