import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseBusRoute,validateBusRoutes,matchTimetableDirection} from './bus-routes.mjs';

function fixture(){return [
  {type:'relation',id:1,tags:{route:'bus',ref:'11',operator:'ATV',from:'Chievo',to:'San Michele'},members:[{type:'node',ref:2,role:'platform'},{type:'way',ref:8,role:''},{type:'node',ref:3,role:'platform'},{type:'way',ref:9,role:''}]},
  {type:'node',id:2,lat:45.4,lon:11,tags:{name:'A'}},{type:'node',id:3,lat:45.41,lon:11,tags:{name:'A'}},
  {type:'node',id:4,lat:45.5,lon:11},{type:'node',id:5,lat:45.51,lon:11},
  {type:'way',id:8,nodes:[2,3]},{type:'way',id:9,nodes:[4,5]}
];}
const options={collectedAt:'2026-10-18T12:00:00Z',timetableDirections:['(Bussolengo) - Chievo - S.Michele Nord']};
test('I tracciati mantengono segmenti separati e fermate ambigue senza abbinamento',()=>{
  const route=parseBusRoute(fixture(),1,options);
  assert.equal(route.segments.length,2);assert.deepEqual(route.segments[0],[[45.4,11],[45.41,11]]);
  assert.ok(route.stops.every(stop=>stop.timetableCandidate===false));
  assert.equal(validateBusRoutes({routes:[route]}),1);
});
test('Fonte inattesa, coordinate e geometria incomplete vengono rifiutate',()=>{
  const wrong=fixture();wrong[0].tags.ref='12';assert.throws(()=>parseBusRoute(wrong,1,options));
  const missing=fixture().filter(element=>element.id!==5);assert.throws(()=>parseBusRoute(missing,1,options),/Posizione/);
  const outside=fixture();outside[1].lat=0;assert.throws(()=>parseBusRoute(outside,1,options),/Posizione/);
  assert.throws(()=>parseBusRoute(fixture(),1,{timetableDirections:[]}),/Direzione/);
});
test('Il catalogo locale estende la mappa a più linee mantenendo le varianti originali e le fonti OSM',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/bus-routes.json',import.meta.url),'utf8'));
  assert.ok(validateBusRoutes(data)>=80);assert.ok(new Set(data.routes.map(route=>route.lineId)).size>=25);assert.equal(data.license,'ODbL');
  const route=data.routes.find(route=>route.id==='11344295');assert.equal(route.stops.length,45);
  assert.ok(route.stops.some(stop=>stop.name==='Via Giberti'&&stop.timetableCandidate));
  const duplicate=data.routes.find(route=>route.id==='1859585').stops.filter(stop=>stop.name==='Piazza Chievo');
  assert.equal(duplicate.length,2);assert.ok(duplicate.every(stop=>!stop.timetableCandidate));
});

test('Le direzioni richiedono almeno tre nomi univoci ordinati e rifiutano parità e ambiguità',()=>{
  const stops=['A','B','C','D'].map(name=>({name})),block=(direction,names)=>({direction,stops:names.map(name=>({name}))});
  const blocks=[block('Andata',['A','B','C','D']),block('Ritorno',['D','C','B','A'])];
  assert.equal(matchTimetableDirection(stops,blocks).direction,'Andata');
  assert.equal(matchTimetableDirection([...stops].reverse(),blocks).direction,'Ritorno');
  assert.equal(matchTimetableDirection(stops.slice(0,2),blocks),null);
  assert.equal(matchTimetableDirection(stops,[blocks[0],block('Altra variante',['A','B','C','D'])]),null);
});

test('Un percorso senza direzione ATV certa rimane visibile senza associare orari',()=>{
  const data=fixture();data[0].tags.ref='12';
  const route=parseBusRoute(data,1,{number:'12',lineId:'atv-urban-12',allowUnmatchedDirection:true});
  assert.equal(route.number,'12');assert.equal(route.timetableDirection,null);assert.equal(validateBusRoutes({routes:[route]}),1);
});
