import test from 'node:test';
import assert from 'node:assert/strict';
import {eventBusIndex} from './event-bus-index.mjs';

test('Indice fermate: rispetta giorni, sola discesa e differenze tra linee senza inventare partenze',()=>{
  const manifest={sha256:'snapshot',validFrom:'2026-10-19',validTo:'2026-10-21'};
  const stops={A:{code:'A',name:'Fermata A',lat:45.4,lon:11},B:{code:'B',name:'Capolinea',lat:45.5,lon:11}};
  const asset={number:'24',stops,trips:[{dates:['2026-10-19'],calls:[['A','10:00:00',0,true],['B','10:10:00',0,false]]},{dates:['2026-10-21'],calls:[['A','11:00:00',0,true]]}]};
  const result=eventBusIndex(manifest,[asset,{...asset,number:'96',trips:[{dates:['2026-10-20'],calls:[['A','12:00:00',0,true]]}]}]);
  assert.deepEqual(result.days,['2026-10-19','2026-10-20','2026-10-21']);assert.equal(result.stops.length,1);
  assert.deepEqual(result.stops[0].services,[['24','101'],['96','010']]);assert.equal(result.sha256,'snapshot');
  assert.throws(()=>eventBusIndex(manifest,[asset,{...asset,stops:{A:{...stops.A,lat:46},B:stops.B}}]),/discordante/);
});
