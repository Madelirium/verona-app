import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateWasteData,validateWasteSelection,wasteUpcoming,normalizeWasteStreet,searchWasteStreets,resolveWasteAddress} from './waste.mjs';
const data=JSON.parse(await readFile(new URL('../data/waste.json',import.meta.url),'utf8'));
test('Indirizzi raccolta: indice controllato, ricerca senza accenti e nessuna correzione automatica',()=>{
  assert.equal(data.addressIndex.entries.length,114);assert.equal(new Set(data.addressIndex.entries.map(e=>e.street)).size,107);
  assert.deepEqual(searchWasteStreets(data,'tiber'),['Via Tiberghien']);assert.deepEqual(searchWasteStreets(data,'monte bianco'),['Via Monte Bianco']);
  assert.ok(searchWasteStreets(data,'unità italia').includes("Via Unita' d'Italia"));assert.equal(normalizeWasteStreet("Via Unità d’Italia"),normalizeWasteStreet("via unita' d'italia"));
  assert.deepEqual(searchWasteStreets(data,'via'),[]);assert.deepEqual(searchWasteStreets(data,'non esiste'),[]);
  assert.deepEqual(resolveWasteAddress(data,'Tiberghien','12'),{status:'not-covered'});
});
test('Indirizzi raccolta: intervalli inclusivi e civici richiesti anche nelle vie senza limiti',()=>{
  for(const civic of ['1','12','38'])assert.deepEqual(resolveWasteAddress(data,'Via Tiberghien',civic),{status:'matched',zoneId:'c7-brown'});
  for(const civic of ['39','100'])assert.equal(resolveWasteAddress(data,'Via Tiberghien',civic).status,'not-covered');
  assert.equal(resolveWasteAddress(data,'Via Giordano Corsini','6').status,'not-covered');assert.equal(resolveWasteAddress(data,'Via Giordano Corsini','7').status,'matched');assert.equal(resolveWasteAddress(data,'Via Giordano Corsini','13').status,'matched');assert.equal(resolveWasteAddress(data,'Via Giordano Corsini','14').status,'not-covered');
  assert.equal(resolveWasteAddress(data,'Strada Mattaranetta','').status,'missing-civic');assert.equal(resolveWasteAddress(data,'Strada Mattaranetta','41').zoneId,'c7-yellow');
  for(const civic of ['0','-3','12/A','12 bis','1.2','1e2'])assert.equal(resolveWasteAddress(data,'Strada Mattaranetta',civic).status,'review');
});
test('Indirizzi raccolta: sovrapposizioni e tratti a incroci richiedono verifica, senza sottrazioni implicite',()=>{
  for(const street of ['Via Monte Bianco','Via Monte Tesoro','Via Dolomiti','Via Aldo Fedeli','Via Adamello',"Via Unita' d'Italia"]){
    for(const civic of ['3','20','324'])assert.equal(resolveWasteAddress(data,street,civic).status,'review',street+' '+civic);
  }
  assert.equal(resolveWasteAddress(data,'Via Bernini Buri','88').reason,'landmark');
  const bad=structuredClone(data);bad.addressIndex.entries[0].zoneId='missing';assert.throws(()=>validateWasteData(bad));
  const interval=structuredClone(data);interval.addressIndex.entries.find(e=>e.kind==='range').to=0;assert.throws(()=>validateWasteData(interval));
});
test('Raccolta: catalogo limitato alle due frazioni confermate, con fonti e senza orari inventati',()=>{
  assert.doesNotThrow(()=>validateWasteData(data));assert.equal(data.zones.length,3);assert.equal(data.exposureTime,null);assert.equal(data.holidayExceptionsVerified,false);
  assert.match(data.sourceUrl,/comune.verona.it/);assert.match(data.validToReason,/editoriale/);
  const bad=structuredClone(data);bad.zones[0].rules[0].weekday=7;assert.throws(()=>validateWasteData(bad));
  bad.zones[0].rules[0].weekday=3;bad.validFrom='2026-02-30';assert.throws(()=>validateWasteData(bad));
});
test('Raccolta: i giorni delle tre zone rispettano la comunicazione comunale',()=>{
  assert.deepEqual(wasteUpcoming(data,'c7-brown','2026-10-22',3),[{day:'2026-10-22',material:'Plastica e metalli'},{day:'2026-10-28',material:'Carta'},{day:'2026-10-29',material:'Plastica e metalli'}]);
  assert.deepEqual(wasteUpcoming(data,'c7-yellow','2026-10-22',2),[{day:'2026-10-23',material:'Carta'},{day:'2026-10-27',material:'Plastica e metalli'}]);
  assert.deepEqual(wasteUpcoming(data,'c7-red','2026-10-22',2),[{day:'2026-10-24',material:'Plastica e metalli'},{day:'2026-10-26',material:'Carta'}]);
});
test('Raccolta: cambio ora, fine anno e input fuori copertura non creano date fittizie',()=>{
  assert.equal(wasteUpcoming(data,'c7-red','2026-10-25',1)[0].day,'2026-10-26');
  assert.deepEqual(wasteUpcoming(data,'c7-brown','2026-12-31'),[{day:'2026-12-31',material:'Plastica e metalli'}]);
  for(const day of ['2027-01-01','2026-01-01','2026-02-30','abc'])assert.deepEqual(wasteUpcoming(data,'c7-brown',day),[]);
  assert.deepEqual(wasteUpcoming(data,'unknown','2026-10-22'),[]);assert.deepEqual(wasteUpcoming(data,'c7-brown','2026-10-22',0),[]);
});
test('Raccolta: una scelta deve appartenere alla versione corrente del catalogo',()=>{
  const selection={zoneId:'c7-yellow',version:data.version,confirmedAt:'2026-10-22T10:00:00Z'};
  assert.equal(validateWasteSelection(data,selection),true);
  for(const invalid of [null,{}, {...selection,version:'old'},{...selection,zoneId:'other'},{...selection,confirmedAt:'abc'}])assert.equal(validateWasteSelection(data,invalid),false);
});
