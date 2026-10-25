import test from 'node:test';
import assert from 'node:assert/strict';
import {createTravelRouteClient,rankTravelBusTrips,chooseActiveTravel} from './travel-routes.mjs';
import {eventTripAssessment} from './event-trip-plan.mjs';
const start={lat:45.4295,lon:10.9828},end={lat:45.43557,lon:10.99202};
const payload=()=>({code:'Ok',routes:[{distance:1700,duration:300,geometry:{type:'LineString',coordinates:[[start.lon,start.lat],[end.lon,end.lat]]}}],waypoints:[{distance:2},{distance:3}]});
test('Travel: real foot/car profiles, shared throttle, cache and no credentials',async()=>{
 let clock=10000;const calls=[],client=createTravelRouteClient({now:()=>clock,wait:async ms=>{clock+=ms;},fetchRoute:async(url,options)=>{calls.push({url,options,clock});return {ok:true,json:async()=>payload()};}});
 const [first,same,car]=await Promise.all([client.load(start,end),client.load(start,end),client.load(start,end,{mode:'car'})]);assert.equal(first,same);assert.notEqual(car,first);assert.equal(calls.length,2);assert.match(calls[0].url,/routed-foot\/route\/v1\/foot/);assert.match(calls[1].url,/routed-car\/route\/v1\/driving/);assert.ok(calls[1].clock-calls[0].clock>=1100);assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.headers,undefined);
 clock+=300001;await client.load(start,end);assert.equal(calls.length,3);
});
test('Travel: reject invalid area, unsupported profile and cancelled queued requests',async()=>{
 let calls=0;const client=createTravelRouteClient({fetchRoute:async()=>{calls++;}});await assert.rejects(client.load({lat:0,lon:0},end));await assert.rejects(client.load(start,end,{mode:'bus'}));const c=new AbortController();c.abort();await assert.rejects(client.load(start,end,{signal:c.signal}));assert.equal(calls,0);
});
test('Travel: missing geometry, distant snaps, NaN and unknown routes never become calculated trips',async()=>{
 for(const mutate of [p=>p.code='NoRoute',p=>p.routes[0].duration=NaN,p=>p.waypoints[0].distance=70,p=>p.routes[0].geometry.coordinates[0]=[11.2,45.2],p=>p.routes[0].geometry.type='Polygon']){const client=createTravelRouteClient({fetchRoute:async()=>{const p=payload();mutate(p);return {ok:true,json:async()=>p};}});await assert.rejects(client.load(start,end));}
 let tries=0;const client=createTravelRouteClient({wait:async()=>{},fetchRoute:async()=>++tries===1?{ok:false,status:429}:{ok:true,json:async()=>payload()}});await assert.rejects(client.load(start,end),/occupato/);assert.equal((await client.load(start,end)).distance,1700);assert.equal(tries,2);
});
test('Travel: a response after abort is never cached',async()=>{
 let resolve,tries=0;const controller=new AbortController(),client=createTravelRouteClient({wait:async()=>{},fetchRoute:async()=>{tries++;if(tries===1)return new Promise(r=>resolve=r);return {ok:true,json:async()=>payload()};}});const pending=client.load(start,end,{signal:controller.signal});await new Promise(r=>setImmediate(r));controller.abort();resolve({ok:true,json:async()=>payload()});await assert.rejects(pending,/annullato/);await client.load(start,end);assert.equal(tries,2);
});
const trip=(time,arrival,startSeconds,endSeconds)=>({row:{time},arrivalTime:arrival,startWalk:{duration:startSeconds},endWalk:{duration:endSeconds}});
test('Travel: bus ranking includes both walks and boarding, rejects missed departures and sorts venue arrivals',()=>{
 const day='2026-10-26',departureAt=Date.parse(day+'T09:00:00+01:00');
 const rows=rankTravelBusTrips([trip('09:03:00','09:10:00',180,60),trip('09:10:00','09:20:00',60,600),trip('09:15:00','09:24:00',120,60),trip('09:20:00','09:25:00',undefined,60)],{day,departureAt,now:departureAt,assess:eventTripAssessment});
 assert.equal(rows.length,2);assert.equal(rows[0].row.time,'09:15:00');assert.equal(rows[0].assessment.venueAt,Date.parse(day+'T09:25:00+01:00'));assert.equal(rows[1].assessment.venueAt,Date.parse(day+'T09:30:00+01:00'));
});
test('Travel: bus ranking rejects ambiguous DST and handles next-day arrivals',()=>{
 const day='2026-10-25',start=Date.parse(day+'T00:00:00+02:00');assert.equal(rankTravelBusTrips([trip('02:30:00','03:00:00',60,60)],{day,departureAt:start,now:start,assess:eventTripAssessment}).length,0);
 const next='2026-10-26',departureAt=Date.parse(next+'T23:40:00+01:00'),rows=rankTravelBusTrips([{...trip('23:50:00','00:10:00',60,60),arrivalDay:'2026-10-27'}],{day:next,departureAt,now:departureAt,assess:eventTripAssessment});assert.equal(rows.length,1);assert.equal(rows[0].assessment.venueAt,Date.parse('2026-10-27T00:11:00+01:00'));
});

const walkOption=(duration=1800,distance=2400)=>({route:{distance},duration});
const busOption=(duration=1000,start=200,end=300)=>({duration,row:{startWalk:{distance:start},endWalk:{distance:end}}});
test('Active travel: short walking routes never require an unnecessary bus',()=>{
 const choice=chooseActiveTravel(walkOption(600,700),busOption(300));assert.equal(choice.kind,'walk');assert.equal(choice.reason,'nearby');
});
test('Active travel: bus must save both meaningful time and walking, including its access leg',()=>{
 assert.equal(chooseActiveTravel(walkOption(),busOption(1900)).kind,'walk');assert.equal(chooseActiveTravel(walkOption(),busOption(1600)).kind,'walk');assert.equal(chooseActiveTravel(walkOption(),busOption(1400,1100,700)).kind,'walk');
 const useful=chooseActiveTravel(walkOption(),busOption(1000));assert.equal(useful.kind,'bus');assert.equal(useful.savedSeconds,800);
});
test('Active travel: reject a long detour to board even if the bus is faster',()=>{
 assert.equal(chooseActiveTravel(walkOption(3600,5000),busOption(1200,1500,300)).kind,'walk');assert.equal(chooseActiveTravel(walkOption(1800,2400),busOption(1000,200,1700)).kind,'walk');
});
test('Active travel: missing provider does not fabricate a comparison or lose a verified route',()=>{
 assert.equal(chooseActiveTravel(walkOption(),{error:'No bus'}).kind,'walk');assert.equal(chooseActiveTravel({error:'No walking'},busOption()).kind,'bus');assert.ok(chooseActiveTravel({error:'No walking'},{error:'No bus'}).error);assert.equal(chooseActiveTravel(undefined,undefined),undefined);
});
