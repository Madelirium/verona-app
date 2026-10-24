import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {directBusTrips} from './direct-bus.mjs';
const stop=(code,lat)=>({code,name:code,lat,lon:10.99});
const asset=()=>({number:'11',alightingAvailable:true,validFrom:'2026-10-18',validTo:'2026-11-17',stops:{O:stop('O',45.42),A:stop('A',45.438),B:stop('B',45.439)},trips:[{id:'trip',destination:'B',dates:['2026-10-24'],calls:[['O','10:00:00',0,true,null,0,false],['A','10:15:00',0,true,'10:14:00',0,true],['B','10:17:00',0,false,'10:17:00',0,true]]}]});
const options={origin:'O',point:{lat:45.438,lon:10.99},day:'2026-10-24',after:'09:00'};
test('Direct bus: same trip, correct order, actual arrival, explicit permissions and closest stop',()=>{
 const result=directBusTrips([asset()],options);assert.equal(result.length,1);assert.equal(result[0].arrival.code,'A');assert.equal(result[0].arrivalTime,'10:14:00');assert.equal(result[0].duration,14);assert.equal(result[0].arrivalOrder,1);
 for(const change of [data=>data.trips[0].calls[0][3]=false,data=>data.trips[0].dates=['2026-10-25'],data=>data.alightingAvailable=false,data=>{data.trips[0].calls[1][6]=false;data.trips[0].calls[2][6]=false;},data=>data.trips[0].calls.reverse()]){const data=asset();change(data);assert.equal(directBusTrips([data],options).length,0);}
 assert.equal(directBusTrips([asset()],{...options,after:'11:00'}).length,0);assert.equal(directBusTrips([asset()],{...options,notBeforeSeconds:36001}).length,0);
 assert.equal(directBusTrips([asset()],{...options,origin:'A'}).some(row=>row.arrival.code==='O'),false);
});
test('Direct bus: midnight service offset, non-boardable terminal, no inferred permissions or travel outside chosen civil day',()=>{
 const data=asset();data.trips[0].dates=['2026-10-23'];data.trips[0].calls=[['O','00:10:00',1,true,null,0,false],['A','00:40:00',1,false,'00:35:00',1,true]];
 const row=directBusTrips([data],{...options,after:'00:00'})[0];assert.equal(row.duration,25);assert.equal(row.row.serviceDay,'2026-10-23');assert.equal(row.row.offset,1);
 data.trips[0].calls[1][6]=undefined;assert.equal(directBusTrips([data],{...options,after:'00:00'}).length,0);
 data.trips[0].calls[1][6]=true;data.trips[0].calls[1][5]=2;assert.equal(directBusTrips([data],{...options,after:'00:00'}).length,0);
});
test('Direct bus: invalid inputs, unknown arrival fallback, no connection formed across trips',()=>{
 for(const override of [{day:'2026-02-31'},{day:'2027-01-01'},{after:'27:00'},{origin:'missing'},{point:null}])assert.deepEqual(directBusTrips([asset()],{...options,...override}),[]);
 const data=asset();data.trips[0].calls[1][4]=null;assert.equal(directBusTrips([data],options)[0].arrivalKnown,false);
 const split=asset();split.trips=[{...split.trips[0],calls:split.trips[0].calls.slice(0,1)},{...split.trips[0],id:'other',calls:split.trips[0].calls.slice(1)}];assert.deepEqual(directBusTrips([split],options),[]);
});
test('Direct bus real archive: Porta Nuova to Gran Guardia, preserving exact trip and permissions',async()=>{
 const data=JSON.parse(await readFile(new URL('../data/bus-official/11.json',import.meta.url),'utf8'));
 const choices=Object.values(data.stops).filter(stop=>stop.name.includes('STAZIONE PORTA NUOVA')).flatMap(stop=>directBusTrips([data],{origin:stop.code,point:{lat:45.43831,lon:10.991876},day:'2026-10-24',after:'08:00'}));
 assert.ok(choices.length>0);
 for(const row of choices){const trip=data.trips.find(trip=>trip.id===row.row.trip);assert.equal(trip.calls[row.row.order][3],true);assert.equal(trip.calls[row.arrivalOrder][6],true);assert.ok(row.arrivalOrder>row.row.order);assert.ok(row.distance<=800);assert.equal(trip.calls[row.arrivalOrder][0],row.arrival.code);}
});
test('Direct bus: DST elapsed duration is corrected; ambiguous and nonexistent local times are excluded',()=>{
 const data=asset();data.trips[0].dates=['2026-10-25'];data.trips[0].calls=[['O','01:50:00',0,true,null,0,false],['A','03:10:00',0,false,'03:10:00',0,true]];
 assert.equal(directBusTrips([data],{...options,day:'2026-10-25',after:'00:00'})[0].duration,140);
 assert.deepEqual(directBusTrips([data],{...options,day:'2026-10-25',after:'00:00'})[0].timelineMinutes,[0,140]);
 data.trips[0].calls[0][1]='02:10:00';assert.deepEqual(directBusTrips([data],{...options,day:'2026-10-25',after:'00:00'}),[]);
 data.validFrom='2027-03-01';data.validTo='2027-04-01';data.trips[0].dates=['2027-03-28'];data.trips[0].calls[0][1]='01:50:00';assert.equal(directBusTrips([data],{...options,day:'2027-03-28',after:'00:00'})[0].duration,20);
 data.trips[0].calls[1][4]='02:15:00';assert.deepEqual(directBusTrips([data],{...options,day:'2027-03-28',after:'00:00'}),[]);
});
test('Arrive by: exact deadline including seconds, descending arrival order before limit, departure constraints retained',()=>{
 const data=asset();data.trips=[['early','09:00:00','09:10:00'],['latest','10:00:00','10:10:00'],['late','10:05:00','10:10:01']].map(([id,departure,arrival])=>({id,destination:'A',dates:['2026-10-24'],calls:[['O',departure,0,true,null,0,false],['A',arrival,0,false,arrival,0,true]]}));
 const rows=directBusTrips([data],{...options,before:'10:10'});assert.deepEqual(rows.map(row=>row.row.trip),['latest','early']);
 assert.equal(directBusTrips([data],{...options,before:'10:10',limit:1})[0].row.trip,'latest');
 assert.equal(directBusTrips([data],{...options,before:'10:10',notBeforeSeconds:36001}).length,0);
 for(const before of ['27:00','bad','08:59'])assert.equal(directBusTrips([data],{...options,before}).length,0);
 assert.deepEqual(directBusTrips([data],options).map(row=>row.row.trip),['early','latest','late']);
});
test('Arrive by: farther eligible stop is kept when the closest stop arrives too late; midnight and DST deadlines respected',()=>{
 const data=asset();data.trips[0].calls=[['O','10:00:00',0,true,null,0,false],['B','10:09:00',0,false,'10:09:00',0,true],['A','10:15:00',0,false,'10:15:00',0,true]];
 assert.equal(directBusTrips([data],{...options,before:'10:10'})[0].arrival.code,'B');
 data.trips[0].dates=['2026-10-23'];data.trips[0].calls=[['O','00:10:00',1,true,null,0,false],['A','00:35:00',1,false,'00:35:00',1,true]];
 assert.equal(directBusTrips([data],{...options,after:'00:00',before:'00:35'}).length,1);assert.equal(directBusTrips([data],{...options,after:'00:00',before:'00:34'}).length,0);
 data.trips[0].dates=['2026-10-25'];assert.equal(directBusTrips([data],{...options,day:'2026-10-25',after:'00:00',before:'02:30'}).length,0);
});

test('Ritorno: arrivo oltre mezzanotte solo su richiesta e con validità del giorno successivo',()=>{const data=asset();data.trips[0].calls=[['O','23:50:00',0,true,null,0,false],['A','00:20:00',1,false,'00:20:00',1,true]];assert.equal(directBusTrips([data],{...options,after:'23:00'}).length,0);const row=directBusTrips([data],{...options,after:'23:00',allowOvernight:true})[0];assert.equal(row.arrivalDay,'2026-10-25');assert.equal(row.duration,30);assert.equal(row.arrivalSeconds,87600);assert.deepEqual(row.timelineMinutes,[0,30]);data.validTo='2026-10-24';assert.equal(directBusTrips([data],{...options,after:'23:00',allowOvernight:true}).length,0);});
