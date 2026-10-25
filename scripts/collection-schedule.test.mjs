import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
function runs(id,eventName,schedule='',inputs={}){
  const block=workflow.match(new RegExp('id: '+id+'\\r?\\n([\\s\\S]*?)(?=\\r?\\n      - |$)'))?.[1];
  const condition=block?.match(/^\s*if: (.+)$/m)?.[1];
  assert.ok(condition,'Condizione mancante: '+id);
  return new Function('github','inputs','return Boolean('+condition+');')({event_name:eventName,event:{schedule}},inputs);
}
test('Raccolte pianificate: eventi e notizie ogni sei ore, farmacie solo nel giro giornaliero',()=>{
  const schedules=[...workflow.matchAll(/- cron: '([^']+)'/g)].map(m=>m[1]);
  assert.deepEqual(schedules,['17 4 * * *','17 10,16,22 * * *']);
  for(const schedule of schedules){assert.equal(runs('refresh','schedule',schedule),true);assert.equal(runs('refresh_news','schedule',schedule),true);assert.equal(runs('refresh_bus','schedule',schedule),false);for(const id of ['pharmacy_python','refresh_pharmacies'])assert.equal(runs(id,'schedule',schedule),schedule==='17 4 * * *');}
});
test('Raccolte manuali: ogni selezione rimane indipendente',()=>{
  const ids={refresh:'refresh_events',refresh_news:'refresh_news',refresh_bus:'refresh_bus',pharmacy_python:'refresh_pharmacies',refresh_pharmacies:'refresh_pharmacies'};
  for(const selected of Object.values(ids))for(const [id,input]of Object.entries(ids))assert.equal(runs(id,'workflow_dispatch','',{[selected]:true}),input===selected);
});
test('Pubblicazione codice: il push non avvia raccolte dalle fonti',()=>{
  for(const id of ['refresh','refresh_news','refresh_bus','pharmacy_python','refresh_pharmacies'])assert.equal(runs(id,'push','',{refresh_events:true,refresh_news:true,refresh_bus:true,refresh_pharmacies:true}),false);
});
