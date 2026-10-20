import test from 'node:test';
import assert from 'node:assert/strict';
import {compareBusStop} from './bus-stop-comparison.mjs';

test('Un nome simile è solo una proposta e il confronto Google rimane un link esterno',()=>{
  const stop={id:'node/1',name:'Via Galvani IV',lat:45.44,lon:11,timetableCandidate:true};
  const route={stops:[stop],timetableDirection:'Andata'},blocks=[{direction:'Andata',stops:[{name:'Via Galvani'}]}];
  const result=compareBusStop(route,stop,blocks);assert.equal(result.status,'review');assert.equal(result.pdfName,null);assert.deepEqual(result.candidates,['Via Galvani']);assert.match(result.googleMapsUrl,/google.com\/maps\/search/);
  stop.name='Via Galvani';assert.equal(compareBusStop(route,stop,blocks).status,'exact');
  route.timetableDirection=null;assert.equal(compareBusStop(route,stop,blocks).status,'direction-unverified');
});
