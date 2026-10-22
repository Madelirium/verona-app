import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateWasteData,wasteUpcoming,validateWasteSelection} from './waste.mjs';
const base=JSON.parse(await readFile(new URL('../data/waste.json',import.meta.url)));
const annual=JSON.parse(await readFile(new URL('../data/waste-calendars.json',import.meta.url)));
const data={...base,validFrom:'2026-01-01',zones:[...base.zones.map(z=>({...z,validFrom:base.validFrom})),...annual.zones]};
const at=(id,day)=>annual.zones.find(z=>z.id===id).dates.find(d=>d.day===day).materials;
test('AMIA: cinque calendari completi con 365 date distinte, fonte e impronta',()=>{
 assert.doesNotThrow(()=>validateWasteData(data));assert.equal(annual.zones.length,5);
 for(const zone of annual.zones){assert.match(zone.sha256,/^[a-f0-9]{64}$/);assert.equal(zone.dates.length,365);assert.ok(zone.dates.some(d=>d.materials.length===0));}
 const bad=structuredClone(data);bad.zones.at(-1).dates.splice(20,1);assert.throws(()=>validateWasteData(bad));
 const duplicate=structuredClone(data);duplicate.zones.at(-1).dates[20].day=duplicate.zones.at(-1).dates[19].day;assert.throws(()=>validateWasteData(duplicate));
 const unknown=structuredClone(data);unknown.zones.at(-1).dates[0].materials=['Vetro'];assert.throws(()=>validateWasteData(unknown));
});
test('AMIA: celle visibili verificate nei PDF, festività e calendario estivo',()=>{
 assert.deepEqual(at('amia-arancio','2026-01-01'),['Carta']);assert.deepEqual(at('amia-arancio','2026-07-02'),['Secco non riciclabile']);
 assert.deepEqual(at('amia-azzurra','2026-01-16'),['Secco non riciclabile']);
 assert.deepEqual(at('amia-arancio','2026-06-17'),['Umido']);assert.deepEqual(at('amia-arancio','2026-10-21'),['Carta']);
 assert.deepEqual(at('amia-arancio','2026-12-25'),[]);assert.deepEqual(at('amia-arancio','2026-12-26'),['Umido']);
 assert.deepEqual(at('amia-blu','2026-10-23'),['Plastica e metalli']);assert.deepEqual(at('amia-verde','2026-10-24'),['Umido']);assert.deepEqual(at('amia-viola','2026-10-22'),['Carta']);
});
test('AMIA: date di esposizione distinte dal ritiro e nessun prolungamento al 2027',()=>{
 const blu=wasteUpcoming(data,'amia-blu','2026-10-22',1)[0];assert.deepEqual(blu,{day:'2026-10-22',material:'Plastica e metalli',collectionDay:'2026-10-23',exposureTime:'dalle 19:00'});
 const arancio=wasteUpcoming(data,'amia-arancio','2026-10-22',1)[0];assert.equal(arancio.day,arancio.collectionDay);assert.equal(arancio.exposureTime,'19:00–21:00');
 const azzurra=wasteUpcoming(data,'amia-azzurra','2026-10-22',1)[0];assert.equal(azzurra.collectionDay,'2026-10-23');assert.equal(azzurra.exposureTime,'19:00–21:00');
 assert.deepEqual(wasteUpcoming(data,'amia-arancio','2027-01-01'),[]);assert.deepEqual(wasteUpcoming(data,'c7-brown','2026-01-15'),[]);
 assert.ok(wasteUpcoming(data,'amia-blu','2026-12-31').every(row=>row.collectionDay<='2026-12-31'));
 assert.equal(validateWasteSelection(data,{zoneId:'c7-brown',version:base.version,confirmedAt:'2026-10-22'}),true);
});
