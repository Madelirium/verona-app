import test from 'node:test';
import assert from 'node:assert/strict';
import {parseComune} from './parsers.mjs';
import {attachComuneVenues,parseComuneVenue} from './event-venues.mjs';

const venue=(id=6654)=>({metadata:{id,classIdentifier:'place'},data:{'ita-IT':{name:'Palazzo della Gran Guardia',has_address:{latitude:45.43831,longitude:10.991876,address:'Piazza Bra 3, Verona'}}},extradata:{'ita-IT':{urlAlias:'/Vivere-il-comune/Luoghi/Palazzo-della-Gran-Guardia'}}});
const event=(id='one',venueIds=[6654])=>({id,source:'Comune di Verona',location:'Gran Guardia',venueIds});

test('Evento senza punto: segue il riferimento ufficiale alla sede e riusa la richiesta per le ricorrenze',async()=>{
  const hit={metadata:{id:25116},data:{'ita-IT':{event_title:'Poeti Sociali',geo:{latitude:0,longitude:0},takes_place_in:[{id:6654,classIdentifier:'place',name:{'ita-IT':'Gran Guardia'}}],time_interval:{events:[{start:'2026-10-23T08:45:00+02:00',end:'2026-10-23T20:30:00+02:00'},{start:'2026-10-24T09:00:00+02:00',end:'2026-10-24T20:30:00+02:00'}]}}}};
  const parsed=parseComune([hit],{from:'2026-10-23',checkedAt:'2026-10-23T12:00:00Z'});let requests=0;
  const enriched=await attachComuneVenues(parsed,async id=>{requests++;assert.equal(id,6654);return venue();},{checkedAt:'2026-10-23T12:00:00Z'});
  assert.equal(requests,1);assert.equal(enriched.length,2);
  for(const item of enriched){assert.equal(item.coordinates.lat,45.43831);assert.equal(item.coordinates.lon,10.991876);assert.equal(item.coordinates.precision,'venue');assert.match(item.coordinates.sourceUrl,/Luoghi/);assert.match(item.location,/Piazza Bra 3/);}
  assert.ok(parsed.every(item=>!item.coordinates));assert.deepEqual(enriched.map(e=>e.id),parsed.map(e=>e.id));
});

test('Sedi ambigue, coordinate dirette, esclusione mappa e fonti diverse non vengono sostituite',async()=>{
  const rows=[event('multi',[1,2]),event('none',[]),{...event('direct'),coordinates:{lat:45.45,lon:11}},{...event('disabled'),mapDisabled:true},{...event('other'),source:'Veronafiere'},event('bad',[0])];
  const result=await attachComuneVenues(rows,()=>{throw Error('Non deve fare richieste');});assert.deepEqual(result,rows);
  const hit={metadata:{id:1},data:{'ita-IT':{event_title:'Due luoghi',takes_place_in:[{id:6654,classIdentifier:'place'},{id:20,classIdentifier:'other'}],time_interval:{events:[{start:'2026-10-24',end:'2026-10-24'}]}}}};
  assert.equal(parseComune([hit],{from:'2026-10-23',checkedAt:''})[0].venueIds,undefined);
  for(const references of [null,{},[null],[{id:6654,classIdentifier:'place'},null]]){hit.data['ita-IT'].takes_place_in=references;assert.equal(parseComune([hit],{from:'2026-10-23',checkedAt:''})[0].venueIds,undefined);}
});

test('Sede errata o senza coordinate non crea un punto; il guasto di una sede non blocca le altre',async()=>{
  assert.throws(()=>parseComuneVenue(venue(20),6654),/Identità/);
  for(const value of [0,null,'errore',48]){const invalid=venue();invalid.data['ita-IT'].has_address.latitude=value;assert.equal(parseComuneVenue(invalid,6654),null);}
  const wrong=venue();wrong.metadata.classIdentifier='image';assert.throws(()=>parseComuneVenue(wrong,6654),/Identità/);
  const errors=[];const rows=await attachComuneVenues([event('fail',[20]),event('ok')],async id=>{if(id===20)throw Error('HTTP 503');return venue();},{onError:id=>errors.push(id)});
  assert.deepEqual(errors,[20]);assert.equal(rows[0].coordinates,undefined);assert.equal(rows[1].coordinates.venueId,6654);
  const external=venue();external.extradata['ita-IT'].urlAlias='https://example.org/luogo';assert.match(parseComuneVenue(external,6654).coordinates.sourceUrl,/www\.comune\.verona\.it\/api/);
});
