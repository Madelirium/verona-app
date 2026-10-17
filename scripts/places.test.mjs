import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlaces,safeWebsite,placeCategory} from './places.mjs';
const checkedAt='2026-10-17T12:00:00Z';
const point=(id,tags={},lat=45.44,lon=10.99)=>({id,type:'node',lat,lon,tags:{name:'Un bar',amenity:'cafe',...tags}});
test('I luoghi mantengono coordinate e fonte, senza inventare contatti o apertura',()=>{
  const [p]=normalizePlaces({elements:[point(1)]},checkedAt);assert.equal(p.category,'Bar e caffè');assert.equal(p.phone,null);assert.equal(p.openingHours,null);assert.equal(p.website,null);assert.equal(p.sourceUrl,'https://www.openstreetmap.org/node/1');
});
test('Elementi fuori area, senza coordinate o dichiarati dismessi non entrano nel catalogo',()=>{
  const r=normalizePlaces({elements:[point(1),point(2,{},44,12),point(3,{disused:'yes'}),{id:4,type:'node',tags:{name:'Non localizzato'}}]},checkedAt);assert.equal(r.length,1);
  assert.throws(()=>normalizePlaces({elements:[],remark:'timeout'},checkedAt));
});
test('Si rimuovono duplicati nello stesso punto mantenendo distinte filiali in zone diverse',()=>{
  const r=normalizePlaces({elements:[point(1),point(2),point(3,{},45.445,10.995)]},checkedAt);assert.equal(r.length,2);
});
test('Siti e telefoni accettano solo collegamenti utilizzabili',()=>{
  assert.equal(safeWebsite('example.com'),'https://example.com/');assert.equal(safeWebsite('javascript:alert(1)'),null);assert.equal(safeWebsite('https://user:pass@example.com'),null);
  const [p]=normalizePlaces({elements:[point(1,{phone:'<script>bad</script>',website:'https://example.com'})]},checkedAt);assert.equal(p.phone,null);assert.equal(p.website,'https://example.com/');assert.equal(placeCategory({shop:'bakery'}),'Negozi');
});
