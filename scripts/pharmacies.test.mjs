import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePharmacyPdf,pharmacyPeriods,pharmacyPhone,attachPharmacyPositions,validatePharmacies} from './pharmacies.mjs';
const fixture=JSON.parse(await readFile(new URL('fixtures/pharmacy-tables.json',import.meta.url),'utf8')),data=JSON.parse(await readFile(new URL('fixtures/pharmacies.json',import.meta.url),'utf8'));
const currentUrl='https://www.ordinefarmacisti.vr.it/wp-content/uploads/2026/09/11_Dalle-ore-9.00-del-22.10.2026-alle-ore-9.00-del-24.10.2026.pdf',nextUrl='https://www.ordinefarmacisti.vr.it/wp-content/uploads/2026/09/12_Dalle-ore-9.00-del-24.10.2026-alle-ore-9.00-del-26.10.2026.pdf';
test('Farmacie: due impaginazioni ufficiali, righe complete e modalità non dedotta',()=>{
  const current=parsePharmacyPdf(fixture.current,currentUrl,'2026-10-22T06:00:00Z'),next=parsePharmacyPdf(fixture.next,nextUrl,'2026-10-22T06:00:00Z');
  assert.equal(current.items.length,13);assert.equal(next.items.length,12);assert.equal(current.items.filter(item=>item.scope==='city').length,4);assert.equal(next.items.filter(item=>item.scope==='city').length,5);
  assert.equal(current.startsAt,'2026-10-22T07:00:00.000Z');assert.equal(current.endsAt,'2026-10-24T07:00:00.000Z');assert.ok(current.items.every(item=>item.serviceMode==='unspecified'));
  assert.equal(current.items.find(item=>item.phone==='0458581003').city,'CASELLE DI SOMMACAMPAGNA');
});
test('Farmacie: estrazioni incomplete, fonte e periodo incoerenti vengono rifiutati',()=>{
  const missing=structuredClone(fixture.current);missing.tables[0].pop();assert.throws(()=>parsePharmacyPdf(missing,currentUrl,'2026-10-22'));
  assert.throws(()=>parsePharmacyPdf(fixture.current,nextUrl,'2026-10-22'));assert.throws(()=>parsePharmacyPdf(fixture.current,'https://example.com/file.pdf','2026-10-22'));
  const phone=structuredClone(fixture.current);phone.tables[0][3][4]='';assert.throws(()=>parsePharmacyPdf(phone,currentUrl,'2026-10-22'));
});
test('Farmacie: cambio alle 9, ora legale e fine copertura escludono turni scaduti',()=>{
  assert.doesNotThrow(()=>validatePharmacies(data));assert.equal(data.periods.length,7);
  assert.equal(pharmacyPeriods(data,'2026-10-22T06:59:59Z')[0].startsAt,'2026-10-20T07:00:00.000Z');assert.equal(pharmacyPeriods(data,'2026-10-22T07:00:00Z')[0].startsAt,'2026-10-22T07:00:00.000Z');
  assert.equal(pharmacyPeriods(data,'2026-10-25T02:00:00Z').length,1);assert.equal(pharmacyPeriods(data,'2026-10-26T08:00:00Z')[0].startsAt,'2026-10-26T08:00:00.000Z');
  assert.deepEqual(pharmacyPeriods(data,'2026-11-01T08:00:00Z'),[]);assert.deepEqual(pharmacyPeriods(data,'invalid'),[]);
  const overlap=structuredClone(data);overlap.periods[1].startsAt=overlap.periods[0].startsAt;assert.throws(()=>validatePharmacies(overlap));
});
test('Farmacie: coordinate solo con corrispondenza univoca, telefoni sicuri e fonti separate',()=>{
  const period={items:[{phone:'045123456',address:'VIA ROMA 12',city:'VERONA'}]},node={id:1,type:'node',lat:45.43,lon:11,tags:{amenity:'pharmacy',phone:'+39 045 123456'}};
  attachPharmacyPositions([period],{elements:[node]},'2026-10-22');assert.equal(period.items[0].position.match,'unique-phone');
  delete period.items[0].position;attachPharmacyPositions([period],{elements:[node,{...node,id:2}]},'2026-10-22');assert.equal(period.items[0].position,undefined);
  const addressNode={...node,tags:{amenity:'pharmacy','addr:street':'Via Roma','addr:housenumber':'12','addr:city':'Verona'}};attachPharmacyPositions([period],{elements:[addressNode]},'2026-10-22');assert.equal(period.items[0].position.match,'unique-address-city');
  assert.equal(pharmacyPhone('+39 045/8006660'),'0458006660');assert.equal(pharmacyPhone('javascript:alert(1)'),null);
});
