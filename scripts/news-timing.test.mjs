import test from 'node:test';
import assert from 'node:assert/strict';
import {extractNewsTiming,newsValidity,newsDeadlineInstant,newsPastSeason,attachNewsTiming} from './news-timing.mjs';
const item=summary=>({id:'comune-news-1',title:'Avviso per contributi',summary,kind:'Avviso'});
test('Scadenze esplicite: data completa, ore prima o dopo, nessun anno dedotto',()=>{
  for(const [summary,day,time]of [['Proposte entro le ore 12.00 del 26 ottobre 2026','2026-10-26','12:00'],['Domande entro il 22 ottobre 2026 alle ore 12','2026-10-22','12:00'],['Scadenza 30/11/2026','2026-11-30',null],['Candidature entro e non oltre le ore 23:59 di domenica 13 settembre 2026','2026-09-13','23:59']]){
    const timing=extractNewsTiming(item(summary));assert.equal(timing.deadline?.day,day);assert.equal(timing.deadline?.time,time);
  }
  for(const summary of ['Domande entro il 16 ottobre','Delibera del 22 ottobre 2026','Attività dal 24 agosto al 9 settembre 2026','Scadenza 31/02/2026','Scadenza 30/11/2026 ore 25:00'])assert.equal(extractNewsTiming(item(summary)).deadline,null);
});
test('Date discordanti e proroghe multiple richiedono verifica, non viene scelta una scadenza arbitraria',()=>{
  const timing=extractNewsTiming(item('Scadenza 22/10/2026. Termine prorogato al 30/10/2026.'));assert.equal(timing.deadline,null);assert.equal(timing.ambiguous,true);
  const repeated=extractNewsTiming(item('Domande entro il 22 ottobre 2026. Domande entro il 22 ottobre 2026 ore 12.'));assert.equal(repeated.deadline.time,'12:00');
});
test('Scadenza della pubblicazione separata dal termine operativo; identità API obbligatoria',()=>{
  const resource={metadata:{id:1,modified:'2026-10-21T10:00:00Z'},data:{'ita-IT':{dead_line:'2026-10-20T00:00:00+02:00',body:'<p>Per informazioni consultare il servizio.</p>'}}};
  const timing=extractNewsTiming(item('Informazioni generali'),resource);assert.equal(timing.deadline,null);assert.equal(timing.publicationExpiresOn,'2026-10-20');assert.equal(newsValidity({...item(''),timing},new Date('2026-10-21T10:00:00Z')).state,'expired');
  assert.throws(()=>extractNewsTiming(item(''),{metadata:{id:2}}),/Identità/);
});
test('Scadenza con ora: chiude nell’istante esatto; senza ora resta aperta fino alla mezzanotte di Roma',()=>{
  const timing=extractNewsTiming(item('Domande entro il 22 ottobre 2026 ore 12'));
  assert.equal(newsDeadlineInstant(timing.deadline),'2026-10-22T10:00:00.000Z');
  assert.equal(newsValidity({...item(''),timing},'2026-10-22T09:59:59Z').state,'open');assert.equal(newsValidity({...item(''),timing},'2026-10-22T10:00:00Z').state,'expired');
  const untimed={...timing,deadline:{...timing.deadline,time:null}};assert.equal(newsValidity({...item(''),timing:untimed},'2026-10-22T21:59:59Z').state,'open');assert.equal(newsValidity({...item(''),timing:untimed},'2026-10-22T22:00:00Z').state,'expired');
  assert.equal(newsDeadlineInstant({day:'2026-10-25',time:'02:30'}),null);assert.equal(newsDeadlineInstant({day:'2026-03-29',time:'02:30'}),null);
});
test('Nessuna data significa da verificare per avvisi, informativa per notizie; revoca non è una scadenza aperta',()=>{
  assert.equal(newsValidity(item('')).state,'unknown');assert.equal(newsValidity({...item(''),kind:'Notizia'}).state,'informative');
  const revoked={...item('Scadenza 30/11/2026'),title:'Revoca del bando'};revoked.timing=extractNewsTiming(revoked);assert.equal(newsValidity(revoked).state,'withdrawn');
  assert.equal(newsPastSeason({title:'Incontri primavera 2026',summary:''},'2026-10-21'),true);assert.equal(newsPastSeason({title:'Graduatoria voucher 2025',summary:''},'2026-10-21'),false);
});
test('Dettaglio non raggiungibile: conserva la sintesi, segnala il limite e non inventa validità',async()=>{
  const [value]=await attachNewsTiming([item('Informazioni generali')],async()=>{throw Error('offline')});assert.equal(value.timing.detailUnavailable,true);assert.equal(value.timing.deadline,null);
});
