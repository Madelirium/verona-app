import test from 'node:test';
import assert from 'node:assert/strict';
import { parseComune, parseFiere, dedupe, romeDay } from './parsers.mjs';
const options = { from: '2026-10-17', checkedAt: '2026-10-17T10:00:00Z', year: 2026 };

test('Comune: importa coordinate dirette valide senza dedurle dalla sede',()=>{
  const hit=geo=>({metadata:{id:1},data:{'ita-IT':{event_title:'Prova',geo,time_interval:{events:[{start:'2026-10-18T10:00:00+02:00',end:'2026-10-18T12:00:00+02:00'}]}}}});
  const [valid]=parseComune([hit({latitude:'45.44',longitude:'10.99',address:'Via Roma'})],options);
  assert.deepEqual(valid.coordinates,{lat:45.44,lon:10.99,source:'Comune di Verona',precision:'source'});
  assert.equal(valid.location,'Via Roma');
  for(const geo of [undefined,{latitude:0,longitude:0},{latitude:'errato',longitude:11},{latitude:48,longitude:11}])assert.equal(parseComune([hit(geo)],options)[0].coordinates,undefined);
});
test('Comune: usa gli orari modificati e conserva le singole ricorrenze future', () => {
  const hits = [{ metadata: { id: 12 }, data: { 'ita-IT': { event_title: 'Incontro', time_interval: {
    events: [{ start: '2026-10-16T20:00:00+02:00', end: '2026-10-16T22:00:00+02:00' }, { start: '2026-10-18T20:00:00+02:00', end: '2026-10-18T22:00:00+02:00' }],
    recurrences: [{ start: '2026-10-18T10:00:00+02:00', end: '2026-10-18T11:00:00+02:00' }]
  } } } }];
  const result = parseComune(hits, options);
  assert.equal(result.length, 1); assert.equal(result[0].startsAt, '2026-10-18T20:00:00+02:00');
  assert.equal(dedupe([...result, ...result]).length, 1);
});
const card = (date, title = 'Evento &amp; amici') => `<div class=" calendario__event col-lg-4" data-order="1"><span class="calendario__event__dates">${date}</span><a class="calendario__event__detail__link" href="https://www.veronafiere.it/manifestazione/prova/"><h4 class="calendario__event__title">${title}</h4></a></div>`;
test('Veronafiere: intervalli inclusivi senza inventare orari o sede', () => {
  const [e] = parseFiere(card('17-18<small>Ottobre</small>'), options);
  assert.equal(e.startsAt, '2026-10-17'); assert.equal(e.endsAt, '2026-10-18');
  assert.equal(e.title, 'Evento & amici'); assert.equal(e.location, null);
  assert.equal(e.publicationStatus, 'draft'); assert.equal(e.areaConfirmed, false);
});
test('Veronafiere: rifiuta date impossibili e struttura cambiata', () => {
  assert.throws(() => parseFiere(card('31<small>Novembre</small>'), options));
  assert.throws(() => parseFiere('<html>Manutenzione</html>', options));
});
test('Veronafiere: intervallo fra due mesi', () => {
  const [e] = parseFiere(card('28 Febbraio - 02 Marzo'), { ...options, year: 2027 });
  assert.equal(e.startsAt, '2027-02-28'); assert.equal(e.endsAt, '2027-03-02');
});
test('Il filtro giorno rispetta Europe/Rome a mezzanotte e il cambio ora', () => {
  assert.equal(romeDay(new Date('2026-10-16T22:30:00Z')), '2026-10-17');
  assert.equal(romeDay(new Date('2026-12-01T23:30:00Z')), '2026-12-02');
});
