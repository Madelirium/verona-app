import test from 'node:test';
import assert from 'node:assert/strict';
import {districtCatalog,districtMatches,explicitDistricts} from './districts.mjs';

test('Il catalogo collega 23 quartieri alle otto circoscrizioni con fonti ufficiali',()=>{
  assert.equal(districtCatalog.items.length,8);
  assert.equal(districtCatalog.items.flatMap(d=>d.quarters).length,23);
  for(const d of districtCatalog.items)assert.equal(new URL(d.sourceUrl).origin,'https://www.comune.verona.it');
});
test('I numeri di commissione non vengono attribuiti alla circoscrizione',()=>{
  assert.deepEqual(explicitDistricts('Commissione Permanente di Lavoro n. 3 Circoscrizione 8^'),['8']);
  assert.deepEqual(explicitDistricts('Consiglio della 3^ circoscrizione'),['3']);
  assert.deepEqual(explicitDistricts('Circoscrizione 2 e Circoscrizione 5'),['2','5']);
  assert.deepEqual(explicitDistricts('Commissione n. 3, sala 4'),[]);
});
test('Le associazioni testuali rispettano nomi interi e varianti, mantenendo più zone',()=>{
  assert.equal(districtMatches('Incontro a Cadidavid')[0].id,'5');
  assert.equal(districtMatches("Ca' di David")[0].quarters[0],'Ca’ di David');
  assert.deepEqual(districtMatches('Parona e Borgo Milano').map(m=>m.id),['2','3']);
  assert.deepEqual(districtMatches('Paronamic e Valdonegana'),[]);
  assert.deepEqual(districtMatches('Il quinto incontro'),[]);
  assert.deepEqual(districtMatches('San Zeno di Montagna'),[]);
  assert.equal(districtMatches('Quinto di Valpantena')[0].id,'8');
  assert.equal(districtMatches('Incontro a Quinto')[0].id,'8');
  assert.deepEqual(districtMatches('Notizia su tutta la città'),[]);
});
