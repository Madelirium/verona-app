import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLinePlan,expandTrip} from './bus-line-plan.mjs';
import {collectLineStopDay} from './bus-line-batch.mjs';
import {digest} from './bus-bot-storage.mjs';
import {momoDate} from './bus-stop-extraction.mjs';

function entry(){const data={Tipo:0,StatusCode:200,Oggetto:{Linea:{Codice:'24'},Corsa:{ID_Corsa:'ATV#1:700_1'},Fermate:['1974','1974','1809'].map((code,index)=>({Localita:{Codice:code,Descrizione:'Stop '+code,Coordinate:{Lat:45.4,Lng:11}},OrarioPartenzaProgrammato:momoDate(`2026-10-19T0${5+index}:00:00+02:00`),OrarioProgrammato:momoDate(`2026-10-19T0${5+index}:00:00+02:00`)}))}};const identity={payload:{IdCorsa:'ATV#1:700_1',Giorno:momoDate('2026-10-19T00:00:00+02:00')}};return {data,dataHash:digest(data),identity,key:digest(identity),collectedAt:'2026-10-18T12:00:00Z'};}
const catalog={routes:[{id:'r',number:'24',from:'A',to:'B',stops:[{id:'n1',ref:'1974',lat:45.4,lon:11,name:'A'},{id:'n2',ref:'99',lat:45.4,lon:11,name:'B'}]}]};
test('Il piano mantiene fermate mancanti, date esplicite e differenze tra OSM e fonte ufficiale',()=>{
  const plan=buildLinePlan({catalog,entries:[entry()]});
  assert.equal(plan.dates.length,7);assert.equal(plan.jobs.length,21);assert.deepEqual(plan.summary.osmOnly,['99']);assert.deepEqual(plan.summary.officialOnly,['1809']);assert.equal(plan.complete,false);
  const trip=plan.knownTrips[0];assert.equal(trip.stops.length,3);assert.deepEqual(trip.stops.map(s=>s.kind),['departure','passage','arrival']);assert.equal(trip.stops[0].stopCode,trip.stops[1].stopCode);
});
test('Dati alterati e sequenze temporali invertite interrompono la preparazione',()=>{
  const e=entry();e.data.Oggetto.Fermate.reverse();assert.throws(()=>expandTrip(e,'24'),/integro/);e.dataHash=digest(e.data);assert.throws(()=>expandTrip(e,'24'),/temporale/);
});
test('Cambiare il giorno nei metadati non trasferisce le corse a un altro giorno di servizio',()=>{
  const e=entry();e.identity.payload.Giorno=momoDate('2026-10-20T00:00:00+02:00');
  assert.throws(()=>expandTrip(e,'24'),/Identità/);
  e.key=digest(e.identity);assert.throws(()=>expandTrip(e,'24'),/giorno di servizio/);
});
const dep={line:'24',stopCode:'1974',date:'2026-10-19',tripId:'ATV#1:700_1',terminalCode:'1809',destination:'A',instant:'2026-10-19T05:00:00Z',time:'07:00:00',realTime:false};
const scanResult=(departures=[dep])=>({stopCode:'1974',date:'2026-10-19',status:'ready-for-ui-comparison',coverageIssues:[],departures});
test('Un primo elenco parziale è conservato e il lotto richiede due scansioni finali corrispondenti',async()=>{
  let calls=0;const result=await collectLineStopDay({line:'24',scan:async()=>++calls===1?scanResult([]):scanResult(),verify:async()=>({status:'matched',httpStatus:200})});
  assert.equal(calls,3);assert.equal(result.status,'observed-and-checked');assert.equal(result.complete,false);
});
test('Un festivo con un’altra linea non viene trasformato in orari della 24 o assenza certificata',async()=>{
  const result=await collectLineStopDay({line:'24',scan:async()=>scanResult([{...dep,line:'96'}]),verify:async()=>{throw new Error('Non deve verificare la 96');}});
  assert.equal(result.status,'no-line-observed');assert.equal(result.complete,false);assert.deepEqual(result.departures,[]);
});
test('Il budget esaurito interrompe il lotto e i dettagli discordanti non vengono approvati',async()=>{
  const failed=await collectLineStopDay({line:'24',scan:async()=>({...scanResult(),coverageIssues:['Budget rete esaurito']}),verify:async()=>({})});assert.equal(failed.halt,true);
  const mismatch=await collectLineStopDay({line:'24',scan:async()=>scanResult(),verify:async()=>({status:'different-time',httpStatus:200})});assert.equal(mismatch.status,'detail-mismatch');assert.equal(mismatch.complete,false);
});
