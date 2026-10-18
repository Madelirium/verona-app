import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateTimetables} from './timetables.mjs';
const data=JSON.parse(await readFile(new URL('../data/bus-timetables.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../data/bus-timetable-snapshots.json',import.meta.url),'utf8'));

test('Tutte le 38 schede orarie hanno colonne coerenti, fonti e impronte corrispondenti ai PDF raccolti',()=>{
  const result=validateTimetables(data,manifest);assert.equal(result.lines,38);assert.equal(data.errors.length,0);assert.ok(result.times>50000);
  assert.ok(data.lines.every(line=>line.validityLabels.length));
});
test('La linea 11 mantiene i buchi e associa gli orari alle corse originali',()=>{
  const block=data.lines.find(l=>l.lineId==='atv-urban-11').blocks[0];
  const station=block.stops.find(s=>s.name==='Stazione FS - Corsia B1');
  assert.equal(station.times[block.tripIds.indexOf('1')],null);assert.equal(station.times[block.tripIds.indexOf('5')],'05:30');assert.equal(station.times[block.tripIds.indexOf('21')],'07:22');
  const chievo=block.stops.find(s=>s.name==='Piazza Chievo');assert.equal(chievo.times[block.tripIds.indexOf('21')],null);assert.equal(chievo.marks[block.tripIds.indexOf('21')],'|');
});
test('Le eccezioni del documento conservano gli orari senza inventare codici corsa',()=>{
  const line63=data.lines.find(l=>l.lineId==='atv-urban-63'),block63=line63.blocks.find(b=>b.tripIds.includes(null));
  assert.equal(block63.stops.find(s=>s.name==='Alpo').times[block63.tripIds.indexOf(null)],'07:05');
  const block91=data.lines.find(l=>l.lineId==='atv-holiday-91').blocks[0];assert.equal(block91.tripIds.at(-1),null);assert.equal(block91.stops.find(s=>s.name==='S.Croce - L.go Zandonai').times.at(-1),'20:02');
  const block98=data.lines.find(l=>l.lineId==='atv-holiday-98').blocks[0];assert.equal(block98.stops.find(s=>s.name==='Mizzole').times[5],'08:37');
});
test('Note condizionali e fermate ripetute della circolare rimangono esplicite',()=>{
  const line22=data.lines.find(l=>l.lineId==='atv-urban-22');assert.ok(line22.blocks.some(b=>b.tripNotes.includes('3')));assert.ok(line22.blocks.some(b=>b.notes.some(n=>n.startsWith('3)'))));
  const line92=data.lines.find(l=>l.lineId==='atv-holiday-92');assert.ok(line92.blocks.some(b=>b.tripNotes.includes('A3')));
  const stops=data.lines.find(l=>l.lineId==='atv-holiday-96').blocks[0].stops.filter(s=>s.name==='P.le Stefani - Ospedale');assert.equal(stops.length,2);assert.equal(stops[0].times[0],'06:35');assert.equal(stops[1].times[0],'06:57');
});
test('Dati rotti o PDF sostituiti fermano la generazione anziché pubblicare tabelle ambigue',()=>{
  const damaged=structuredClone(data);damaged.lines[0].blocks[0].stops[0].times.pop();assert.throws(()=>validateTimetables(damaged,manifest),/Fermata/);
  const changed=structuredClone(manifest);changed.items[0].sha256='a'.repeat(64);assert.throws(()=>validateTimetables(data,changed),/PDF cambiato/);
});
