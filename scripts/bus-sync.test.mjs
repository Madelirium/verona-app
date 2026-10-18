import test from 'node:test';
import assert from 'node:assert/strict';
import {collectBus} from './bus-sync.mjs';
import {busFeed,busSources} from './bus.mjs';
const before='2026-10-17T10:00:00Z',now='2026-10-18T10:00:00Z';
const html=`<div class="viewPar"><p>LINEA 25<br>Direzione Centro<br>A - CENTRO</p></div><a href="/flex/cm/pages/ServeAttachment.php/test">orario</a>`;
const rss='<rss><channel><item><title>LINEA 25- dal 18/10 deviazione</title><link>https://www.atv.verona.it/avviso</link><pubDate>Sun, 18 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>';
const get=async url=>url===busFeed?rss:html;

test('ATV aggiorna le quattro fonti e riconosce gli avvisi senza spazi prima del trattino',async()=>{
  const data=await collectBus({checkedAt:before,get});assert.equal(data.status,'ok');assert.equal(data.lines.length,3);assert.equal(data.alerts.length,1);
  assert.deepEqual(data.alerts[0].lines,['25']);assert.ok(data.sources.every(s=>s.lastSuccessAt===before));
});
test('ATV conserva solo le fonti fallite e non aggiorna la loro data di successo',async()=>{
  const previous=await collectBus({checkedAt:before,get});
  const data=await collectBus({previous,checkedAt:now,get:async url=>{if(url===busSources[0].url||url===busFeed)throw Error('HTTP 503');return html;}});
  assert.equal(data.status,'partial');assert.equal(data.updatedAt,now);assert.deepEqual(data.alerts,previous.alerts);
  assert.equal(data.sources[0].lastSuccessAt,before);assert.equal(data.sources[1].lastSuccessAt,now);assert.equal(data.sources[3].lastSuccessAt,before);
  assert.equal(data.lines.find(l=>l.service==='urban').checkedAt,before);
});
test('ATV non dichiara una raccolta nuova se tutte le fonti falliscono o sono vuote',async()=>{
  const previous=await collectBus({checkedAt:before,get});
  const data=await collectBus({previous,checkedAt:now,get:async url=>url===busFeed?'<rss><channel></channel></rss>':'<html>Manutenzione</html>'});
  assert.equal(data.status,'error');assert.equal(data.updatedAt,before);assert.deepEqual(data.lines,previous.lines);assert.deepEqual(data.updates,previous.updates);
});
test('ATV protegge le schede da un calo anomalo e gestisce la prima raccolta fallita',async()=>{
  const previous=await collectBus({checkedAt:before,get});const row=previous.lines.find(l=>l.service==='urban');previous.lines=Array.from({length:10},(_,i)=>({...row,id:'old-'+i,number:String(i)}));
  const data=await collectBus({previous,checkedAt:now,get});assert.equal(data.status,'partial');assert.equal(data.lines.filter(l=>l.service==='urban').length,10);assert.match(data.sources[0].error,/70%/);
  const empty=await collectBus({checkedAt:now,get:async()=>{throw Error('offline')}});assert.equal(empty.updatedAt,null);assert.equal(empty.status,'error');assert.equal(empty.lines.length,0);
});
