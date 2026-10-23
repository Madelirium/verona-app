import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryStops,momoDate,assessCalibration,probeStop,calibration,collectCalibrationDay,romeDayBounds,collectStopDay,requestStopWindow,compareStopDays,compareTripDeparture,requestTripDetail,scheduledTripStop} from './bus-stop-extraction.mjs';

test('Inventario deduplica codici ma conserva conflitti e assenza di identità verificata',()=>{
  const data=inventoryStops({routes:[{lineId:'24',stops:[{ref:'1974',id:'a',name:'Santini'},{ref:'1974',id:'b',name:'Santini B'},{ref:null,id:'c',name:'X'}]},{lineId:'96',stops:[{ref:'1974',id:'a',name:'Santini'}]}]});
  assert.equal(data.uniqueCodes,1);assert.equal(data.withoutNumericCode,1);assert.equal(data.multipleOsmIds,1);assert.deepEqual(data.stops[0].lines,['24','96']);assert.equal(data.stops[0].identityVerified,false);
});
test('Date inviate al servizio mantengono istante e fuso invernale/estivo',()=>{
  assert.equal(momoDate('2026-10-19T00:00:00+02:00'),`/Date(${Date.parse('2026-10-19T00:00:00+02:00')}+0200)/`);
  assert.ok(momoDate('2026-12-19T00:00:00+01:00').endsWith('+0100)/'));assert.throws(()=>momoDate('wrong'));
});
test('HTTP valido e fermata corretta senza passaggi non superano la calibrazione',()=>{
  const result=assessCalibration({Tipo:0,StatusCode:200,Oggetto:{Fermata:{Codice:'1974'},Passaggi:[]}});
  assert.equal(result.status,'blocked');assert.deepEqual(result.missing,calibration.expectedTimes);assert.equal(result.complete,false);
});
test('Un campione corrispondente non dimostra copertura completa; fermate diverse sono rifiutate',()=>{
  const data={Tipo:0,StatusCode:200,Oggetto:{Fermata:{Codice:'1974'},Passaggi:calibration.expectedTimes.map(time=>({CodiceFermata:'1974',Percorso:{Linea:{Codice:'24'}},isPassaggioRealTime:false,DataOraPassaggio:momoDate(`2026-10-19T${time}:00+02:00`)}))}};
  assert.equal(assessCalibration(data).status,'sample-matched');assert.equal(assessCalibration(data).complete,false);
  data.Oggetto.Fermata.Codice='1973';assert.equal(assessCalibration(data).status,'blocked');
});
test('Orari uguali su un altro giorno o dati live non convalidano il campione programmato',()=>{
  const data={Tipo:0,StatusCode:200,Oggetto:{Fermata:{Codice:'1974'},Passaggi:calibration.expectedTimes.map(time=>({CodiceFermata:'1974',Percorso:{Linea:{Codice:'24'}},isPassaggioRealTime:false,DataOraPassaggio:momoDate(`2026-10-20T${time}:00+02:00`)}))}};
  assert.equal(assessCalibration(data).status,'blocked');
  data.Oggetto.Passaggi.forEach((row,index)=>{row.DataOraPassaggio=momoDate(`2026-10-19T${calibration.expectedTimes[index]}:00+02:00`);row.isPassaggioRealTime=true;});
  assert.equal(assessCalibration(data).status,'blocked');
});
test('Blocco HTTP termina la prova senza retry o richieste ad altri servizi',async()=>{
  let calls=0;const result=await probeStop({fetcher:async()=>{calls++;return {ok:false,status:403};}});
  assert.equal(calls,1);assert.equal(result.status,'blocked');assert.equal(result.httpStatus,403);
});

const departure=(time,id=time)=>({stopCode:'1974',line:'24',tripId:id,destination:'Piazza Righetti',instant:new Date(`2026-10-19T${time}:00+02:00`).toISOString(),date:'2026-10-19',time:time+':00',realTime:false});
test('La raccolta suddivide finestre sature e deduplica i confini senza unire corse simultanee',async()=>{
  const boundary=departure('04:00','A'),simultaneous=departure('04:00','B');
  const report=await collectCalibrationDay({request:async({from,to})=>{
    const a=Date.parse(from),b=Date.parse(to),start=Date.parse('2026-10-19T00:00:00+02:00');
    const saturated=a===start && b-a===8*3600000;
    const departures=saturated?Array.from({length:20},(_,i)=>departure('04:00',String(i))):a<start+8*3600000?[boundary,simultaneous].filter(d=>Date.parse(d.instant)>=a&&Date.parse(d.instant)<=b):[];
    return {httpStatus:200,stop:{code:'1974'},count:departures.length,departures};
  }});
  assert.equal(report.requests,5);assert.equal(report.departureCount,2);assert.equal(report.complete,false);assert.ok(report.coverageIssues.includes('Campione del portale non riprodotto'));
});
test('Una risposta HTTP fallita arresta la giornata e un budget esaurito non certifica copertura',async()=>{
  let calls=0;const failed=await collectCalibrationDay({request:async()=>{calls++;return {httpStatus:403};}});
  assert.equal(calls,1);assert.equal(failed.status,'incomplete');
  const limited=await collectCalibrationDay({maxRequests:1,request:async()=>({httpStatus:200,stop:{code:'1974'},count:0,departures:[]})});
  assert.ok(limited.coverageIssues.includes('Budget richieste esaurito'));
});

test('Le giornate italiane seguono i cambi di ora e rifiutano date impossibili',()=>{
  for(const [date,hours] of [['2026-10-25',25],['2026-03-29',23],['2026-10-19',24]]){
    const {start,end}=romeDayBounds(date);assert.equal((end-start)/3600000,hours);
    assert.ok(momoDate(new Date(start)).includes(date==='2026-10-25'?'+0200':date==='2026-03-29'?'+0100':'+0200'));
  }
  for(const date of ['2026-02-30','2026-13-01','wrong'])assert.throws(()=>romeDayBounds(date));
});
test('Le richieste usano la fermata e il giorno scelti, senza riusare Santini o il giorno del campione',async()=>{
  let payload;
  const result=await requestStopWindow({stopCode:'1973',date:'2026-10-25',from:'2026-10-24T22:00:00Z',to:'2026-10-25T06:00:00Z',fetcher:async(url,options)=>{
    payload=JSON.parse(options.body);return {ok:true,status:200,json:async()=>({Tipo:0,StatusCode:200,Oggetto:{Fermata:{Codice:'1973'},Passaggi:[]}})};
  }});
  assert.equal(payload.CodFermata,'1973');assert.equal(payload.Giorno,momoDate('2026-10-25T00:00:00+02:00'));assert.equal(result.stop.code,'1973');
});
test('La raccolta copre anche la venticinquesima ora senza dichiarare completo un giorno vuoto',async()=>{
  const bounds=romeDayBounds('2026-10-25');const calls=[];
  const result=await collectStopDay({stopCode:'1973',date:'2026-10-25',request:async options=>{calls.push(options);return {httpStatus:200,stop:{code:'1973'},count:0,departures:[]};}});
  assert.equal(calls.length,4);assert.equal(Date.parse(calls.at(-1).to),bounds.end);assert.equal(result.dayHours,25);assert.equal(result.complete,false);assert.equal(result.status,'incomplete');
  assert.equal(Date.parse(calls.at(0).from),bounds.start);
});
test('Il confronto rifiuta giorni diversi e non approva due elenchi vuoti o differenti',()=>{
  const previous={stopCode:'1974',date:'2026-10-19',status:'ready-for-ui-comparison',departures:[departure('05:30')]};
  assert.equal(compareStopDays(previous,structuredClone(previous)).consistent,true);
  assert.equal(compareStopDays(previous,{...previous,departures:[departure('05:50')]}).consistent,false);
  assert.equal(compareStopDays({...previous,departures:[]},{...previous,departures:[]}).consistent,false);
  assert.throws(()=>compareStopDays(previous,{...previous,date:'2026-10-20'}));
});

function tripFixture(expected){return {Tipo:0,StatusCode:200,Oggetto:{Corsa:{ID_Corsa:expected.tripId},Linea:{Codice:expected.line},Fermate:[{Localita:{Codice:expected.stopCode},OrarioPartenzaProgrammato:momoDate(expected.instant)},{Localita:{Codice:'1809',Descrizione:expected.destination}}]}};}
test('Il confronto con il dettaglio richiede corsa, linea, fermata, destinazione e istante programmato esatti',()=>{
  const expected=departure('05:30','ATV#1:700_1992062');
  const data=tripFixture(expected);
  assert.equal(compareTripDeparture(data,expected).status,'matched');
  data.Oggetto.Fermate[0].OrarioPartenzaProgrammato=momoDate('2026-10-19T05:31:00+02:00');
  assert.equal(compareTripDeparture(data,expected).status,'different-time');
  data.Oggetto.Fermate[0].Localita.Codice='1973';assert.equal(compareTripDeparture(data,expected).status,'missing-stop');
  data.Oggetto.Linea.Codice='96';assert.equal(compareTripDeparture(data,expected).status,'wrong-trip-or-line');
  assert.equal(compareTripDeparture({},expected).status,'invalid-response');
});
test('Le fermate ripetute rimangono distinte e un orario live non sostituisce il programmato',()=>{
  const expected=departure('05:30','ATV#1:700_1992062');const data=tripFixture(expected);
  data.Oggetto.Fermate.unshift({Localita:{Codice:'1974'},OrarioPartenzaProgrammato:momoDate('2026-10-19T04:30:00+02:00')});
  assert.equal(compareTripDeparture(data,expected).stopOccurrences,2);
  data.Oggetto.Fermate[1].Orario=data.Oggetto.Fermate[1].OrarioPartenzaProgrammato;data.Oggetto.Fermate[1].OrarioPartenzaProgrammato=null;
  assert.equal(compareTripDeparture(data,expected).status,'different-time');
});
test('Il dettaglio usa gli identificativi osservati nel portale e non riprova dopo un errore HTTP',async()=>{
  const expected=departure('05:30','ATV#1:700_1992062');let calls=0;
  const result=await requestTripDetail({expected,terminalCode:'1809',fetcher:async(url,options)=>{
    calls++;assert.ok(url.endsWith('GetFermateCorsa2'));const body=JSON.parse(options.body);
    assert.equal(body.IdCorsa,expected.tripId);assert.equal(body.CodicePercorso,'700_1992062');assert.equal(body.IdStazioneSalita,'1809');return {ok:false,status:429};
  }});
  assert.equal(calls,1);assert.equal(result.status,'http-error');assert.equal(result.httpStatus,429);
});

test('Un passaggio live viene convertito solo usando il programmato ufficiale della fermata giusta',()=>{
  const expected={...departure('05:35','ATV#1:700_1992062'),realTime:true};const data=tripFixture(expected);
  data.Oggetto.Fermate[0].OrarioPartenzaProgrammato=momoDate('2026-10-19T05:30:00+02:00');
  const result=scheduledTripStop(data,expected);assert.equal(result.status,'scheduled');assert.equal(result.departure.time,'05:30:00');assert.equal(result.departure.realTime,false);assert.equal(result.departure.sourceRealTime,true);assert.equal(result.departure.sourceInstant,expected.instant);
  data.Oggetto.Fermate.unshift(structuredClone(data.Oggetto.Fermate[0]));assert.equal(scheduledTripStop(data,expected).status,'ambiguous-stop');
  data.Oggetto.Fermate[0].Numero=1;data.Oggetto.Fermate[1].Numero=2;assert.equal(scheduledTripStop(data,{...expected,stopSequence:2}).status,'scheduled');
});
