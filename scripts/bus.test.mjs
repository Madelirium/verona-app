import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBusLines,parseBusAlerts,parseBusUpdates,alertLines,busSources,decodeAtv,splitBusDirections} from './bus.mjs';
const checkedAt='2026-10-17T12:00:00Z';
const fixture=`<div class='viewPar BLOBAlignJustify'><p>LINEA 25<br><strong>Direzione Stazione</strong><br>FIERA - STAZIONE</p></div><div class='blob-element-download'><a href="https://www.atv.verona.it/flex/cm/pages/ServeAttachment.php/test">orari linea 25</a></div>`;
test('Le schede importano percorso e PDF senza trasformare i punti di passaggio in fermate o arrivi live',()=>{
  const [line]=parseBusLines(fixture,busSources[0],checkedAt);
  assert.equal(line.number,'25');assert.equal(line.route,'Direzione Stazione\nFIERA - STAZIONE');assert.equal(line.realtime,false);assert.equal(line.service,'urban');
  assert.ok(line.timetableUrl.startsWith('https://www.atv.verona.it/'));
  assert.equal(parseBusLines(fixture,busSources[1],checkedAt)[0].id,'atv-evening-25');
});
test('Strutture incomplete e allegati fuori dal dominio ufficiale falliscono esplicitamente',()=>{
  assert.throws(()=>parseBusLines('<html>Manutenzione</html>',busSources[0],checkedAt));
  assert.throws(()=>parseBusLines(fixture.replace('https://www.atv.verona.it','https://example.com'),busSources[0],checkedAt));
});
test('I codici delle linee negli avvisi rispettano i confini numerici e quelli scolastici',()=>{
  assert.deepEqual(alertLines('LINEE 148-53-92-SC450 - dal 19/10 sospensione fermata'),['148','53','92','SC450']);
  assert.deepEqual(alertLines('LINEA 20 - deviazione'),['20']);
  assert.deepEqual(alertLines('LINEA 120 - deviazione'),['120']);
  assert.deepEqual(alertLines("LINEE 32-80-SC01- dall' 8/10 sospensione fermata codice 312"),['32','80','SC01']);
  assert.deepEqual(alertLines('LINEE 41-97- dal 28/9 sospensione fermata codice 4195'),['41','97']);
  assert.deepEqual(alertLines('LINEA 227- dal 14/10 deviazione'),['227']);
  assert.deepEqual(alertLines('LINEE 20, 21 e 22 - deviazione'),['20','21','22']);
  assert.deepEqual(alertLines('LINEE URBANE ED EXTRAURBANE - codice 2004/173011'),[]);
});

test('Le direzioni rispettano i blocchi ATV senza inventare capolinea quando mancano',()=>{
  assert.deepEqual(splitBusDirections('Direzione Centro\nA - B - CENTRO\nDirezione Periferia\nCENTRO - C - A'),[{label:'Direzione Centro',path:'A - B - CENTRO'},{label:'Direzione Periferia',path:'CENTRO - C - A'}]);
  assert.deepEqual(splitBusDirections('CIRCOLARE A - B - A'),[{label:'Percorso indicato da ATV',path:'CIRCOLARE A - B - A'}]);
  assert.deepEqual(splitBusDirections(''),[]);
});
test('Il feed mantiene solo avvisi di servizio ed esclude selezioni di personale',()=>{
  const item=t=>`<item><title>${t}</title><link>https://www.atv.verona.it/${t.startsWith('LINEA')?'avviso':'selezione'}</link><pubDate>Fri, 16 Oct 2026 00:00:00 +0200</pubDate></item>`;
  const xml=`<rss><channel>${item('LINEA 20 - deviazione')}${item('Selezione per operatore qualificato')}</channel></rss>`;
  const alerts=parseBusAlerts(xml,checkedAt);assert.equal(alerts.length,1);assert.deepEqual(alerts[0].lines,['20']);assert.equal(alerts[0].publishedAt,'2026-10-15T22:00:00.000Z');
  const updates=parseBusUpdates(xml,checkedAt);
  assert.equal(updates.length,2);assert.equal(updates.filter(i=>!i.serviceAlert).length,1);
  assert.throws(()=>parseBusAlerts('<html>Errore</html>',checkedAt));
});
test('La decodifica rispetta ISO-8859-1, evitando caratteri sostitutivi negli accenti',()=>{
  const bytes=Uint8Array.from([99,105,116,116,224]);assert.equal(decodeAtv(bytes,'text/html; charset=ISO-8859-1'),'città');
});
