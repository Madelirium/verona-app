import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNews,mergeNews,newsSources} from './news.mjs';
const options={checkedAt:'2026-10-17T10:00:00Z',from:'2026-07-19',to:'2026-10-17'};
function card({id='123',title='Viabilità: lavori in tangenziale',date='16/10/2026',summary='Restringimenti di carreggiata.',url='https://www.comune.verona.it/Novita/Notizie/Lavori'}={}){
  return `<div data-object_id="${id}" class="card"><h3 class="card-title other">${title}</h3><div class="text-paragraph-card"><p>${summary}</p><p><strong>Data di pubblicazione:</strong> ${date}</p></div><a class="read-more" href="${url}">Dettagli</a></div>`;
}
test('Le schede mantengono fonte e data, puliscono la sintesi e assegnano categorie senza inventare una zona',()=>{
  const [item]=parseNews(card({summary:'<b>Transito</b> &amp; sosta.'}),newsSources[0],options);
  assert.equal(item.summary,'Transito & sosta.');assert.equal(item.publishedOn,'2026-10-16');assert.equal(item.category,'Mobilità');assert.equal(item.area,null);assert.equal(item.categoryMethod,'automatic');
});
test('La finestra temporale esclude pubblicazioni vecchie e future e rifiuta date impossibili',()=>{
  assert.equal(parseNews(card({date:'18/10/2026'}),newsSources[0],options).length,0);
  assert.equal(parseNews(card({date:'18/07/2026'}),newsSources[0],options).length,0);
  assert.throws(()=>parseNews(card({date:'31/09/2026'}),newsSources[0],options));
});
test('La zona si usa solo se una circoscrizione è esplicita; gli avvisi rimangono distinti dalle notizie',()=>{
  const [item]=parseNews(card({title:'Consiglio della 3^ circoscrizione',url:'https://www.comune.verona.it/Novita/Avvisi/Consiglio'}),newsSources[1],options);
  assert.equal(item.area,'Circoscrizione 3');assert.equal(item.kind,'Avviso');assert.equal(item.sourceKey,'avvisi');
});
test('Struttura cambiata e link esterni non producono schede silenziosamente errate',()=>{
  assert.throws(()=>parseNews('<html>Errore</html>',newsSources[0],options));
  assert.throws(()=>parseNews(card({url:'https://example.com/notizia'}),newsSources[0],options));
});

test('Il numero della commissione non sostituisce la circoscrizione dichiarata',()=>{
  const [item]=parseNews(card({title:'Convocazione Commissione Permanente di Lavoro n. 3 Circoscrizione 8^'}),newsSources[0],options);
  assert.equal(item.area,'Circoscrizione 8');
});
test('Gli identificativi comunali rimuovono i duplicati e gli aggiornamenti sostituiscono la vecchia sintesi',()=>{
  const old=parseNews(card(),newsSources[0],options)[0];
  const update={...old,summary:'Nuovi orari'};
  assert.equal(mergeNews([old,update]).length,1);assert.equal(mergeNews([old,update])[0].summary,'Nuovi orari');
});
