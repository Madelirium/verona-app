import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseParking,parkingSnapshot,parkingWebsite} from './parking.mjs';
const header='Prog,"Nome parcheggio",Indirizzo,Tipologia,Contatti,"Sito web","Latitudine e longitudine"\n';
const row='1,"Arena, centro","Via ""Roma"", 8",a pagamento,,https://example.org/?utm_source=x&gclid=y,"45.435571,10.992020"\n';
test('CSV comunale: gestisce virgole, virgolette, BOM e righe multiple senza spostare le coordinate',()=>{
  const [item]=parseParking('\uFEFF'+header+row);assert.equal(item.name,'Arena, centro');assert.equal(item.address,'Via "Roma", 8');assert.equal(item.lat,45.435571);assert.equal(item.typeKey,'paid');assert.equal(item.website,'https://example.org/');
  assert.equal(parseParking((header+row).replaceAll('\n','\r\n')).length,1);
});
test('Catalogo incompleto o schema cambiato non sostituisce silenziosamente i dati precedenti',()=>{
  for(const csv of [header.replace('Prog','Id')+row,header+row.replace('45.435571','0'),header+row+row,header+row.slice(0,-3)])assert.throws(()=>parseParking(csv));
  assert.throws(()=>parkingSnapshot(header,null,'2026-10-21T10:00:00Z'),/vuoto/);
  const previous={items:Array(17).fill({})};assert.throws(()=>parkingSnapshot(header+row,previous,'2026-10-21T10:00:00Z'),/soglia/);
  assert.equal(previous.items.length,17);
});
test('Parcheggi: provenienza e licenza conservate, nessun prezzo o dato live inventato',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/parking.json',import.meta.url),'utf8'));
  assert.ok(data.items.length>=10);assert.equal(new Set(data.items.map(item=>item.id)).size,data.items.length);assert.equal(data.license,'CC BY 4.0');
  assert.ok(data.items.every(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lon)&&!('availableSpaces' in item)&&!('price' in item)));
  assert.ok(data.items.some(item=>item.typeKey==='free'));
  assert.equal(parkingWebsite('javascript:alert(1)'),null);assert.equal(parkingWebsite('https://user:password@example.org/'),null);
});
