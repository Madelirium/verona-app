import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import {datasetStatus} from './data-status.mjs';
import {newsDeadlineInstant,newsValidity,newsPastSeason} from './news-timing.mjs';
import {validateWasteSelection,wasteUpcoming,normalizeWasteStreet,searchWasteStreets,resolveWasteAddress} from './waste.mjs';
import {pharmacyPeriods} from './pharmacies.mjs';

const newsServicesLogic=await readFile(new URL('../public/news-services.js',import.meta.url),'utf8');
const logic = [datasetStatus,newsDeadlineInstant,newsValidity,newsPastSeason,validateWasteSelection,wasteUpcoming,normalizeWasteStreet,searchWasteStreets,resolveWasteAddress,pharmacyPeriods].map(fn=>fn.toString()).join('\n')+'\n'+newsServicesLogic+'\n'+await readFile(new URL('../public/calendar.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../public/waste.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../public/pharmacies.js',import.meta.url),'utf8');
const builtHtml = await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const catalog = JSON.parse(builtHtml.match(/<script id="event-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const liveCatalog = structuredClone(catalog);
catalog.busRoutes=JSON.parse(await readFile(new URL('../data/bus-routes.json',import.meta.url),'utf8'));
catalog.pharmacies=JSON.parse(await readFile(new URL('./fixtures/pharmacies.json',import.meta.url),'utf8'));
catalog.news=JSON.parse(await readFile(new URL('./fixtures/calendar-news.json',import.meta.url),'utf8'));
// Casi reali congelati: gli import futuri non spostano l’orologio dei test UI.
const fixture=JSON.parse(await readFile(new URL('./fixtures/calendar-events.json',import.meta.url),'utf8'));
catalog.events=fixture.events;catalog.updatedAt=fixture.updatedAt;
catalog.bus=JSON.parse(await readFile(new URL('./fixtures/calendar-bus.json',import.meta.url),'utf8'));
function run(storage = new Map(),initialView='discover',mapApi) {
  class Element {
    constructor() { this.textContent='';this.value='';this.children=[];this.listeners={};this.attributes={};this.classList={toggle(){}};this.style={}; }
    append(...nodes){this.children.push(...nodes)}
    replaceChildren(...nodes){this.children=nodes}
    setAttribute(key,value){this.attributes[key]=value}
    getAttribute(key){return this.attributes[key]}
    addEventListener(key,fn){this.listeners[key]=fn}
    hasPointerCapture(){return false}
    setPointerCapture(){}
    showModal(){this.open=true}
    close(){this.open=false;this.listeners.close?.()}
    focus(){}
  }
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  get('event-data').textContent=JSON.stringify(catalog);
  class TestDate extends Date { constructor(...args){super(...(args.length?args:['2026-10-17T09:00:00Z']))}static now(){return new Date('2026-10-17T09:00:00Z').getTime()} }
  const timers=new Map();let nextTimer=0;
  const context=createContext({setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),Intl,Date:TestDate,URL,JSON,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},document:{getElementById:get,createElement:()=>new Element()}});
  if(mapApi)context.L=mapApi;
  new Script(logic).runInContext(context);
  if(initialView==='discover')get('discover').onclick();
  return {get,context,storage,timers};
}

const agendaLogic=await readFile(new URL('../public/agenda.js',import.meta.url),'utf8');
function runAgenda(storage=new Map()){const app=run(storage,'home');app.context.TextEncoder=TextEncoder;new Script(agendaLogic).runInContext(app.context);return app;}
function deadlineFixture(app){app.context.deadlineFixture={id:'comune-news-9999001',title:'Domanda per contributo',summary:'Domande entro il 22 ottobre 2026 ore 12',publishedOn:'2026-10-20',checkedAt:'2026-10-21T09:00:00Z',source:'Comune di Verona',sourceUrl:'https://www.comune.verona.it/Novita/Avvisi/Contributo',kind:'Avviso',sourceKey:'avvisi',category:'Bandi e opportunità',districtMatches:[],timing:{deadline:{day:'2026-10-22',time:'12:00',evidence:'entro il 22 ottobre 2026 ore 12'}}};return app.context.deadlineFixture;}
function wasteFind(app,text){const find=nodes=>{for(const node of nodes){if(node.textContent===text)return node;const child=find(node.children||[]);if(child)return child;}};return find(app.get('waste-collection-panel').children);}
test('Farmacie: accesso da Esplora, filtri città/provincia, chiamata e nessuna apertura inventata',()=>{
  const app=run(new Map(),'home');useRomeInstant(app,'2026-10-22T10:00:00Z');new Script('setView("explore")').runInContext(app.context);assert.equal(app.get('explore-pharmacies').hidden,true);app.get('explore-category').value='Farmacie';app.get('explore-category').onchange();assert.equal(app.get('explore-pharmacies').hidden,false);app.get('explore-pharmacies').onclick();assert.equal(app.get('pharmacy-dialog').open,true);assert.match(app.get('pharmacy-count').textContent,/4 farmacie/);
  let cards=app.get('pharmacy-list').children.filter(child=>child.className==='pharmacy-card');assert.equal(cards.length,4);assert.ok(cards[0].children.at(-1).children[0].href.startsWith('tel:'));assert.ok(cards[0].children.at(-1).children[1].href.includes('destination='));
  app.get('pharmacy-scope').value='all';app.get('pharmacy-scope').onchange();assert.match(app.get('pharmacy-count').textContent,/13 farmacie/);app.get('pharmacy-search').value='Legnago';app.get('pharmacy-search').oninput();assert.match(app.get('pharmacy-count').textContent,/1 farmacia/);
  app.get('pharmacy-search').value='inesistente';app.get('pharmacy-search').oninput();app.get('pharmacy-list').children.find(child=>child.className==='pharmacy-reset').onclick();assert.match(app.get('pharmacy-count').textContent,/13 farmacie/);
});
test('Farmacie: pannello aperto cambia turno alle 9 e non mostra dati scaduti',()=>{
  const app=run(new Map(),'home');useRomeInstant(app,'2026-10-22T06:59:59Z');new Script('openPharmacies()').runInContext(app.context);assert.ok(app.get('pharmacy-list').children.some(card=>card.children?.[0]?.textContent.includes('CAPRI')));
  useRomeInstant(app,'2026-10-22T07:00:00Z');const id=new Script('pharmacyTimer').runInContext(app.context);app.timers.get(id).fn();assert.ok(app.get('pharmacy-list').children.some(card=>card.children?.[0]?.textContent.includes('DUE CAMPANE')));assert.ok(!app.get('pharmacy-list').children.some(card=>card.children?.[0]?.textContent.includes('CAPRI')));
  useRomeInstant(app,'2026-11-01T08:00:00Z');new Script('renderPharmacies()').runInContext(app.context);assert.equal(app.get('pharmacy-list').children.filter(child=>child.className==='pharmacy-card').length,0);assert.equal(app.get('pharmacy-count').textContent,'Turni da aggiornare');assert.ok(app.get('pharmacy-list').children.some(child=>child.href==='https://farmamiaverona.it/'));
  app.get('pharmacy-map-tab').onclick();assert.match(app.get('pharmacy-map-message').textContent,/non disponibile/);const timer=new Script('pharmacyTimer').runInContext(app.context);app.get('pharmacy-close').onclick();assert.equal(app.timers.has(timer),false);
});
test('Farmacie: mappa parziale, punto della farmacia, navigazione conservata e pulizia alla scadenza',()=>{
  const calls={markers:[],fit:0},map={setView(){return this},invalidateSize(){},fitBounds(){calls.fit++}},api={map:()=>map,tileLayer:()=>({on(){return this},addTo(){return this}}),layerGroup:()=>({addTo(){return this},clearLayers(){calls.markers=[]}}),circleMarker:(position)=>({bindPopup(card){this.card=card;return this},addTo(){calls.markers.push({position,card:this.card});return this}})};
  const app=run(new Map(),'home',api);useRomeInstant(app,'2026-10-22T10:00:00Z');new Script('openPharmacies()').runInContext(app.context);app.get('pharmacy-map-tab').onclick();assert.ok(calls.markers.length>0);assert.match(app.get('pharmacy-map-message').textContent,/indirizzi solo in Elenco/);const fit=calls.fit;new Script('renderPharmacies()').runInContext(app.context);assert.equal(calls.fit,fit);
  const popup=calls.markers[0].card;assert.ok(popup.children.at(-1).children[0].href.startsWith('tel:'));
  useRomeInstant(app,'2026-11-01T08:00:00Z');new Script('renderPharmacies()').runInContext(app.context);assert.equal(calls.markers.length,0);assert.match(app.get('pharmacy-map-message').textContent,/Turni da aggiornare/);
});
function wasteForm(app){const form=app.get('waste-collection-panel').children.find(c=>c.className==='waste-address-form');return {form,street:form.children[0].children[0],civic:form.children[3].children[0],result:form.children[5]};}
test('Trova zona: ricerca, scelta via, civico, conferma e persistenza della sola zona',()=>{
  const app=run(new Map(),'home');app.get('district-waste').onclick();wasteFind(app,'Trova la zona di raccolta').onclick();let fields=wasteForm(app);fields.street.value='tiber';fields.street.oninput();wasteFind(app,'Via Tiberghien').onclick();fields=wasteForm(app);fields.civic.value='12';fields.civic.oninput();fields.form.onsubmit({preventDefault(){}});
  assert.ok(wasteFind(app,'Via Tiberghien, civico 12'));assert.equal(app.storage.has('verona-waste-v1'),false);wasteFind(app,'Torna indietro').onclick();assert.equal(wasteForm(app).civic.value,'12');wasteForm(app).form.onsubmit({preventDefault(){}});wasteFind(app,'Conferma zona').onclick();
  const saved=JSON.parse(app.storage.get('verona-waste-v1'));assert.equal(saved.zoneId,'c7-brown');assert.deepEqual(Object.keys(saved).sort(),['confirmedAt','version','zoneId']);app.get('waste-close').onclick();assert.equal(new Script('wasteAddress').runInContext(app.context),null);
  const reload=run(app.storage,'home');assert.equal(reload.get('home-waste').hidden,true);
});
test('Trova zona: civico mancante, intervallo escluso, ambiguità e nessun risultato non salvano',()=>{
  const app=run(new Map(),'home');app.get('district-waste').onclick();wasteFind(app,'Trova la zona di raccolta').onclick();let fields=wasteForm(app);fields.street.value='tiber';fields.street.oninput();wasteFind(app,'Via Tiberghien').onclick();fields=wasteForm(app);fields.form.onsubmit({preventDefault(){}});assert.match(fields.result.textContent,/Scrivi il numero/);
  fields.civic.value='39';fields.form.onsubmit({preventDefault(){}});assert.match(fields.result.textContent,/non è coperto/);assert.equal(wasteFind(app,'Conferma zona'),undefined);
  fields.street.value='monte bianco';fields.street.oninput();wasteFind(app,'Via Monte Bianco').onclick();fields=wasteForm(app);fields.civic.value='5';fields.form.onsubmit({preventDefault(){}});assert.match(fields.result.textContent,/Non possiamo scegliere/);
  fields.street.value='nome inesistente';fields.street.oninput();assert.equal(fields.form.children[1].children.length,0);assert.equal(fields.form.children[4].hidden,true);assert.equal(app.storage.has('verona-waste-v1'),false);
  fields.form.onsubmit({preventDefault(){}});assert.match(fields.result.textContent,/Scegli prima una via/);
});
test('Raccolta semplice: scelta e conferma separate, persistenza e annullamento',()=>{
  const app=run(new Map(),'home');assert.equal(app.get('home-waste').hidden,true);app.get('district-waste').onclick();
  assert.equal(wasteFind(app,'Conferma zona'),undefined);wasteFind(app,'Zona Marrone').onclick();assert.equal(app.storage.has('verona-waste-v1'),false);
  assert.ok(wasteFind(app,'Conferma solo se la tua via e il tuo civico appartengono a questa zona.'));
  wasteFind(app,'Conferma zona').onclick();assert.equal(JSON.parse(app.storage.get('verona-waste-v1')).zoneId,'c7-brown');assert.equal(app.get('home-waste').hidden,true);
  const cards=app.get('waste-collection-panel').children;assert.equal(cards.filter(c=>c.className==='waste-next').length,1);assert.equal(cards.filter(c=>c.className==='waste-day').length,2);assert.equal(cards.find(c=>c.className==='waste-more').children.length,4);
  wasteFind(app,'Cambia zona').onclick();wasteFind(app,'Zona Rossa').onclick();wasteFind(app,'Annulla modifica').onclick();assert.equal(JSON.parse(app.storage.get('verona-waste-v1')).zoneId,'c7-brown');
  const reload=run(app.storage,'home');assert.equal(reload.get('home-waste').hidden,true);reload.get('home-waste').onclick();wasteFind(reload,'Rimuovi la zona salvata').onclick();assert.equal(reload.get('home-waste').hidden,true);assert.equal(JSON.parse(reload.storage.get('verona-waste-v1')),null);
});
test('Raccolta semplice: aiuto, ritorno indietro, versione obsoleta e memoria bloccata',()=>{
  const app=run(new Map([['verona-waste-v1','{"version":"old","zoneId":"c7-red","confirmedAt":"2026-10-22"}']]),'home');assert.equal(app.get('home-waste').hidden,true);app.get('district-waste').onclick();
  wasteFind(app,'Trova la zona di raccolta').onclick();assert.ok(wasteFind(app,'Trova la zona di raccolta'));assert.ok(wasteFind(app,'Cerca le altre zone sul sito AMIA ↗'));assert.equal(wasteFind(app,'Conferma zona'),undefined);
  wasteFind(app,'Torna alla scelta della zona').onclick();wasteFind(app,'Zona Gialla').onclick();wasteFind(app,'Torna indietro').onclick();assert.equal(app.storage.get('verona-waste-v1').includes('old'),true);
  wasteFind(app,'Zona Gialla').onclick();app.context.localStorage.setItem=()=>{throw Error('blocked')};wasteFind(app,'Conferma zona').onclick();assert.match(app.get('waste-feedback').textContent,/questa visita/);assert.equal(app.get('home-waste').hidden,true);
});
test('Raccolta semplice: isole senza zona e periodo non coperto senza conferme inutili',()=>{
  const app=run(new Map(),'home');app.get('district-waste').onclick();app.get('waste-centers-tab').onclick();const centers=app.get('waste-centers-panel').children.filter(c=>c.className==='waste-center');assert.equal(centers.length,2);assert.ok(centers[0].children.some(c=>/Avesani 34/.test(c.textContent)));assert.ok(centers[1].children.some(c=>/Mattaranetta 41/.test(c.textContent)));assert.ok(centers[0].children.some(c=>c.href?.includes('destination=Via%20Bartolomeo')));
  useRomeInstant(app,'2027-01-01T12:00:00Z');app.get('waste-collection-tab').onclick();assert.ok(wasteFind(app,'Il calendario va aggiornato'));assert.equal(wasteFind(app,'Conferma zona'),undefined);assert.equal(app.storage.has('verona-waste-v1'),false);
});
test('Raccolta semplice: nuovo giorno, domani e modifica preservata a mezzanotte',()=>{
  const selection={zoneId:'c7-brown',version:catalog.waste.version,confirmedAt:'2026-10-22T10:00:00Z'},app=run(new Map([['verona-waste-v1',JSON.stringify(selection)]]),'home');
  useRomeInstant(app,'2026-10-22T21:59:00Z');new Script('openWaste()').runInContext(app.context);assert.match(app.get('waste-collection-panel').children.find(c=>c.className==='waste-next').children[1].textContent,/Oggi/);
  useRomeInstant(app,'2026-10-22T22:00:00Z');assert.match(app.get('waste-collection-panel').children.find(c=>c.className==='waste-next').children[1].textContent,/28 ottobre/);
  useRomeInstant(app,'2026-10-27T12:00:00Z');assert.match(app.get('home-waste').textContent,/Domani/);
  wasteFind(app,'Cambia zona').onclick();wasteFind(app,'Zona Rossa').onclick();const apply=wasteFind(app,'Conferma zona');useRomeInstant(app,'2026-10-28T12:00:00Z');assert.equal(wasteFind(app,'Conferma zona'),apply);
  useRomeInstant(app,'2027-01-01T12:00:00Z');apply.onclick();assert.ok(wasteFind(app,'Il calendario va aggiornato'));assert.equal(JSON.parse(app.storage.get('verona-waste-v1')).zoneId,'c7-brown');
});

test('Scadenza personale: salvataggio separato dagli eventi, calendario e persistenza senza presenza',()=>{
  const app=runAgenda();deadlineFixture(app);useRomeInstant(app,'2026-10-21T09:00:00Z');new Script('openNews(deadlineFixture)').runInContext(app.context);
  const box=app.get('news-detail-content').children.find(child=>child.className==='news-validity');box.children.find(child=>child.className==='dialog-save').onclick();
  assert.ok(JSON.parse(app.storage.get('verona-news-deadlines-v1'))['comune-news-9999001']);assert.equal(app.storage.get('verona-events-v1'),undefined);
  const reload=runAgenda(app.storage);useRomeInstant(reload,'2026-10-21T09:00:00Z');new Script('setView("saved")').runInContext(reload.context);assert.equal(new Script('selected').runInContext(reload.context),'2026-10-22');assert.match(reload.get('count').textContent,/1 scadenza/);
  const card=reload.get('events').children.find(child=>child.className==='news-deadline-card');assert.ok(card);assert.ok(!card.children.some(child=>/Partecipo/.test(child.textContent)));
  assert.ok(reload.get('week-grid').children.some(child=>/1 scadenze personali/.test(child.attributes['aria-label'])));
  card.children.at(-1).onclick();assert.deepEqual(JSON.parse(reload.storage.get('verona-news-deadlines-v1')),{});
});
test('Scadenza con ora: passa nei conclusi e il pannello aperto impedisce un nuovo salvataggio',()=>{
  const app=runAgenda();deadlineFixture(app);useRomeInstant(app,'2026-10-22T09:59:59Z');new Script('openNews(deadlineFixture)').runInContext(app.context);const panel=app.get('news-detail-content').children.find(child=>child.className==='news-validity'),save=panel.children.find(child=>child.className==='dialog-save');
  useRomeInstant(app,'2026-10-22T10:00:00Z');save.onclick();assert.equal(app.storage.get('verona-news-deadlines-v1'),undefined);assert.equal(save.hidden,true);assert.equal(panel.attributes['data-state'],'expired');
  useRomeInstant(app,'2026-10-22T09:59:59Z');new Script('toggleNewsDeadline(deadlineFixture)').runInContext(app.context);useRomeInstant(app,'2026-10-22T10:00:00Z');new Script('setView("saved")').runInContext(app.context);assert.ok(!app.get('events').children.some(child=>child.className==='news-deadline-card'));new Script('savedMode="past";setView("saved")').runInContext(app.context);assert.ok(app.get('events').children.some(child=>child.className==='news-deadline-card'));
});
test('Home: evita periodi precedenti e scadenze concluse; privilegia la zona senza nascondere i contenuti in Tutte',()=>{
  const app=runAgenda();deadlineFixture(app);useRomeInstant(app,'2026-10-21T09:00:00Z');new Script('newsItems.splice(0,newsItems.length,{...deadlineFixture,id:"comune-news-2",title:"Incontri primavera 2026",kind:"Notizia",timing:{},publishedOn:"2026-10-21"},{...deadlineFixture,id:"comune-news-3",timing:{deadline:{day:"2026-09-22",time:null}}},deadlineFixture);renderHome()').runInContext(app.context);
  assert.match(app.get('home-news-title').textContent,/Da ricordare.*Domanda per contributo/);app.get('home-news').onclick();assert.equal(app.get('news-detail-dialog').open,true);
  new Script('districtChoice="3:*";newsItems.push({...deadlineFixture,id:"comune-news-4",title:"Scadenza della mia zona",districtMatches:[{id:"3",explicit:true,quarters:[]}]});renderHome()').runInContext(app.context);assert.match(app.get('home-news-title').textContent,/Nella tua zona.*Scadenza della mia zona/);
  app.get('news').onclick();assert.equal(app.get('news-list').children.length,4);app.get('news-open-filters').onclick();app.get('news-status').value='open';app.get('close-news-filters').onclick();assert.equal(app.get('news-list').children.length,4);
  app.get('news-open-filters').onclick();app.get('news-status').value='open';app.get('apply-news-filters').onclick();assert.equal(app.get('news-list').children.length,2);app.get('news-active-filters').children[0].onclick();assert.equal(app.get('news-list').children.length,4);
});
test('Informazioni servizi: riepilogo, scadenza ATV e aggiornamento del giorno senza ricaricare',()=>{
  const app=run(new Map(),'home');useRomeInstant(app,'2026-10-21T12:00:00Z');app.get('open-info').onclick();
  assert.equal(app.get('data-health').children.length,5);assert.equal(app.get('network-data-warning').hidden,true);
  useRomeInstant(app,'2026-11-17T22:59:59Z');new Script('renderDataHealth()').runInContext(app.context);assert.equal(app.get('network-data-warning').hidden,false);assert.match(app.get('network-data-warning').attributes['aria-label'],/fino a oggi/);
  useRomeInstant(app,'2026-11-17T23:00:00Z');new Script('refreshDataHealth()').runInContext(app.context);assert.match(app.get('network-data-warning').attributes['aria-label'],/scaduti/);
  const card=app.get('data-health').children[2];assert.equal(card.attributes['data-state'],'expired');assert.ok(card.children.some(child=>/Consulta ATV/.test(child.textContent)));
});
function agendaFixture(app,rows,day='2026-10-23'){
  app.context.agendaRows=rows.map((row,i)=>({id:'agenda-'+i,title:'Evento '+i,source:'Comune di Verona',sourceUrl:'https://www.comune.verona.it/evento-'+i,category:[],...row}));
  app.context.agendaTestDay=day;new Script('events.splice(0,events.length,...agendaRows);selected=agendaTestDay;month=selected.slice(0,7);view="calendar";agendaShowAll=true;render()').runInContext(app.context);
}
function agendaTitles(app){return app.get('events').children.filter(c=>c.className==='event-card agenda-rich-card').map(card=>card.children[1].children[0].children[0].children[0].textContent);}
test('Nuova agenda: ordina gli istanti con offset diversi e mantiene i gruppi senza orario',()=>{
  const app=runAgenda();agendaFixture(app,[{title:'Dieci',startsAt:'2026-10-23T10:00:00+02:00',endsAt:'2026-10-23T11:30:00+02:00'},{title:'Nove',startsAt:'2026-10-23T10:00:00+03:00',endsAt:'2026-10-23T11:00:00+03:00'},{title:'Senza ora',startsAt:'2026-10-23',endsAt:'2026-10-23'}]);
  assert.deepEqual(agendaTitles(app),['Nove','Dieci','Senza ora']);assert.ok(app.get('events').children.some(e=>e.textContent==='Mattina'));
});
test('Nuova agenda: Da adesso nasconde solo corse concluse con fine nota, giornata completa reversibile',()=>{
  const app=runAgenda();useRomeInstant(app,'2026-10-23T08:30:00Z');agendaFixture(app,[{title:'Finito',startsAt:'2026-10-23T08:00:00+02:00',endsAt:'2026-10-23T09:00:00+02:00'},{title:'Iniziato',startsAt:'2026-10-23T10:00:00+02:00',endsAt:'2026-10-23T11:00:00+02:00'},{title:'Fine non nota',startsAt:'2026-10-23T09:00:00+02:00',endsAt:'2026-10-23T09:00:00+02:00'}]);
  new Script('agendaShowAll=false;render()').runInContext(app.context);assert.deepEqual(agendaTitles(app),['Fine non nota','Iniziato']);
  app.get('agenda-day-mode').onclick();assert.deepEqual(agendaTitles(app),['Finito','Fine non nota','Iniziato']);
});
test('Weekend: mostra sabato e domenica, conteggi distinti e cambio anno/ora',()=>{
  const app=runAgenda();useRomeInstant(app,'2026-10-25T09:00:00Z');agendaFixture(app,[{title:'Sabato',startsAt:'2026-10-24T10:00:00+02:00',endsAt:'2026-10-24T11:00:00+02:00'},{title:'Domenica',startsAt:'2026-10-25T10:00:00+01:00',endsAt:'2026-10-25T11:00:00+01:00'}]);
  app.get('agenda-weekend').onclick();assert.equal(new Script('selected').runInContext(app.context),'2026-10-24');assert.deepEqual(agendaTitles(app),['Sabato','Domenica']);assert.match(app.get('count').textContent,/2 appuntamenti/);
  app.get('calendar-event-map').onclick();assert.equal(app.get('event-map-period').value,'2');assert.equal(new Script('eventMapEvents().length').runInContext(app.context),2);app.get('event-map-back').onclick();assert.equal(new Script('agendaRange').runInContext(app.context),'weekend');
  assert.equal(new Script('agendaWeekend("2027-01-01").join(",")').runInContext(app.context),'2027-01-02,2027-01-03');
  app.get('agenda-tomorrow').onclick();assert.equal(new Script('agendaRange').runInContext(app.context),'day');assert.equal(new Script('selected').runInContext(app.context),'2026-10-26');
});
test('Filtri agenda: categoria, fascia, prezzo dichiarato, annullamento e coerenza con la mappa',()=>{
  const app=runAgenda();agendaFixture(app,[{title:'Mostra libera',category:['Mostra'],priceLabel:'Ingresso gratuito',startsAt:'2026-10-23T10:00:00+02:00',endsAt:'2026-10-23T11:00:00+02:00'},{title:'Corso',category:['Corso'],startsAt:'2026-10-23T20:00:00+02:00',endsAt:'2026-10-23T21:00:00+02:00'}]);
  app.get('agenda-open-filters').onclick();app.get('agenda-category').value='Mostra';app.get('close-filters').onclick();assert.equal(app.get('agenda-category').value,'');
  app.get('agenda-open-filters').onclick();app.get('agenda-category').value='Mostra';app.get('agenda-price').value='free';app.get('apply-filters').onclick();assert.deepEqual(agendaTitles(app),['Mostra libera']);
  app.get('calendar-event-map').onclick();assert.equal(new Script('eventMapEvents().length').runInContext(app.context),1);app.get('event-map-back').onclick();assert.equal(app.get('agenda-category').value,'Mostra');
});
test('Programmi personali: conflitti solo con durata nota e salvati riconoscibili nei giorni del mese',()=>{
  const app=runAgenda();agendaFixture(app,[{title:'Uno',startsAt:'2026-10-23T10:00:00+02:00',endsAt:'2026-10-23T11:00:00+02:00'},{title:'Due',startsAt:'2026-10-23T10:30:00+02:00',endsAt:'2026-10-23T11:30:00+02:00'},{title:'Periodo',startsAt:'2026-10-23',endsAt:'2026-10-25'}]);
  new Script('preferences[events[0].id]="interested";preferences[events[1].id]="going";preferences[events[2].id]="interested"').runInContext(app.context);
  assert.equal(new Script('agendaConflicts(events[0]).length').runInContext(app.context),1);assert.equal(new Script('agendaConflicts(events[2]).length').runInContext(app.context),0);
  app.get('open-month').onclick();assert.ok(app.get('grid').children.some(button=>/3 salvati/.test(button.attributes['aria-label'])));
});
test('Esportazione ICS: UTC, date senza orario con fine esclusiva, escape e righe UTF-8',()=>{
  const app=runAgenda();app.context.exportEvent={id:'123',title:'Caffè, musica; incontri\n'+('è'.repeat(90)),source:'Comune',sourceUrl:'https://www.comune.verona.it/evento',location:'Verona',startsAt:'2026-10-25T01:30:00+02:00',endsAt:'2026-10-25T02:30:00+01:00'};
  const ics=new Script('agendaIcs(exportEvent)').runInContext(app.context);assert.match(ics,/DTSTART:20261024T233000Z/);assert.match(ics,/DTEND:20261025T013000Z/);assert.match(ics,/Caffè\\, musica\\; incontri\\n/);assert.ok(ics.split('\r\n').every(row=>new TextEncoder().encode(row).length<=75));
  app.context.exportEvent.startsAt='2026-12-31';app.context.exportEvent.endsAt='2027-01-02';const allDay=new Script('agendaIcs(exportEvent)').runInContext(app.context);assert.match(allDay,/DTSTART;VALUE=DATE:20261231/);assert.match(allDay,/DTEND;VALUE=DATE:20270103/);
});
test('Esportazione ICS: genera il download su richiesta e comunica anche un errore del browser',()=>{
  const app=runAgenda(),files=[];app.context.Blob=class {constructor(parts,options){this.parts=parts;this.type=options.type;}};app.context.URL=class extends URL{static createObjectURL(blob){files.push(blob);return 'blob:test';}static revokeObjectURL(){}};
  app.context.document.body={append(){}};const create=app.context.document.createElement;app.context.document.createElement=tag=>tag==='a'?{click(){},remove(){}}:create(tag);
  app.context.exportTarget=app.get('export-target');new Script('appendAgendaExport(exportTarget,events[0])').runInContext(app.context);
  const [button,feedback]=app.get('export-target').children;assert.equal(files.length,0);button.onclick();assert.equal(files.length,1);assert.match(files[0].parts[0],/BEGIN:VCALENDAR/);assert.match(feedback.textContent,/File .ics pronto/);
  app.context.URL.createObjectURL=()=>{throw Error('Browser unavailable');};button.onclick();assert.match(feedback.textContent,/non disponibile/);
});

test('Le mappe delle altre linee caricano soltanto il file richiesto e riusano i percorsi già letti',async()=>{
  const app=run(new Map(),'home'),calls=[];
  const routes=catalog.busRoutes.routes.filter(route=>route.lineId==='atv-urban-12');
  app.context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>({routes})}};
  new Script('busRouteData.assetBase="bus-routes/";busRouteData.routes=busRouteData.routes.map(({stops,segments,...route})=>route)').runInContext(app.context);
  await new Script('openBusRoute(busData.lines.find(line=>line.id==="atv-urban-12"))').runInContext(app.context);
  assert.deepEqual(calls,['bus-routes/atv-urban-12.json']);assert.match(app.get('bus-route-title').textContent,/Linea 12/);
  app.get('bus-route-list-tab').onclick();assert.ok(app.get('bus-route-stops').children.length>20);
  const first=app.get('bus-route-stops').children[0];assert.ok(first.children.some(child=>child.href?.startsWith('https://www.google.com/maps/search/')));
  app.get('close-bus-route').onclick();await new Script('openBusRoute(busRouteLine)').runInContext(app.context);assert.equal(calls.length,1);
});

test('Una mappa non scaricata segnala l’errore e permette di ritentare senza bloccare gli orari',async()=>{
  const app=run(new Map(),'home');let fail=true;
  const routes=catalog.busRoutes.routes.filter(route=>route.lineId==='atv-urban-12');
  app.context.fetch=async()=>({ok:!fail,status:503,json:async()=>({routes})});
  new Script('busRouteData.assetBase="bus-routes/";busRouteData.routes=busRouteData.routes.map(({stops,segments,...route})=>route)').runInContext(app.context);
  await new Script('openBusRoute(busData.lines.find(line=>line.id==="atv-urban-12"))').runInContext(app.context);
  assert.match(app.get('bus-route-message').textContent,/Chiudi e riprova/);app.get('close-bus-route').onclick();fail=false;
  await new Script('openBusRoute(busRouteLine)').runInContext(app.context);app.get('bus-route-list-tab').onclick();assert.ok(app.get('bus-route-stops').children.length>20);
});

function locationTestApp(){
  const maps=[0,1,2].map(()=>({fits:0,fitBounds(){this.fits++},closePopup(){}}));
  const L={control(){return {addTo(){this.onAdd();return this}}},DomEvent:{disableClickPropagation(){},disableScrollPropagation(){}},layerGroup(){return {items:[],addTo(){return this},clearLayers(){this.items=[]}}},circle(point,options){return {point,options,addTo(layer){layer.items.push(this);return this},getBounds(){return [point,point]}}},circleMarker(){return {bindPopup(){return this},addTo(layer){layer.items.push(this);return this}}}};
  const app=run(new Map(),'home',L);app.context.testMaps=maps;app.context.isSecureContext=true;
  new Script('view="eventmap";installMapLocation(testMaps[0],"events");installMapLocation(testMaps[1],"places");installMapLocation(testMaps[2],"bus")').runInContext(app.context);
  app.click=()=>new Script('mapLocationStates.get("events").button.onclick()').runInContext(app.context);
  app.status=()=>new Script('mapLocationStates.get("events").status.textContent').runInContext(app.context);
  return {...app,maps};
}

test('La posizione richiede un tocco, mostra la precisione sulle tre mappe e resta in memoria',()=>{
  const app=locationTestApp();let calls=0,success,options;
  app.context.navigator={geolocation:{getCurrentPosition(ok,fail,settings){calls++;success=ok;options=settings}}};
  assert.equal(calls,0);app.click();app.click();assert.equal(calls,1);assert.equal(options.maximumAge,0);assert.equal(options.timeout,12000);
  success({coords:{latitude:45.44,longitude:11,accuracy:35}});
  assert.match(app.status(),/35 m/);assert.equal(app.maps[0].fits,1);assert.equal(app.maps[1].fits,0);assert.equal(app.maps[2].fits,0);
  assert.equal(new Script('[...mapLocationStates.values()].every(state=>state.layer.items.length===2)').runInContext(app.context),true);
  assert.ok(![...app.storage.keys()].some(key=>/location|position/i.test(key)));
});

test('Il messaggio posizione scompare dopo tre secondi, conservando il punto e annullando timer precedenti',()=>{
  const app=locationTestApp();let success;app.context.navigator={geolocation:{getCurrentPosition(ok){success=ok}}};new Script('installMapLocation(testMaps[0],"network");requestMapLocation("network")').runInContext(app.context);success({coords:{latitude:45.44,longitude:11,accuracy:20}});
  const state=new Script('mapLocationStates.get("network")').runInContext(app.context),firstTimer=state.statusTimer;assert.equal(app.get('network-location-note').hidden,false);assert.equal(app.timers.get(firstTimer).ms,3000);
  app.timers.get(firstTimer).fn();assert.equal(state.status.hidden,true);assert.equal(app.get('network-location-note').hidden,true);assert.equal(state.layer.items.length,2);assert.equal(new Script('currentUserLocation.accuracy').runInContext(app.context),20);
  new Script('requestMapLocation("network")').runInContext(app.context);success({coords:{latitude:45.44,longitude:11,accuracy:20}});const secondTimer=state.statusTimer;new Script('requestMapLocation("network")').runInContext(app.context);assert.equal(app.timers.has(secondTimer),false);assert.equal(state.status.hidden,false);assert.match(state.status.textContent,/Ricerca/);
});
test('La posizione gestisce HTTP, permesso negato e timeout senza bloccare le mappe',()=>{
  const app=locationTestApp();let calls=0,fail;
  app.context.navigator={geolocation:{getCurrentPosition(ok,error){calls++;fail=error}}};app.context.isSecureContext=false;
  app.click();assert.equal(calls,0);assert.match(app.status(),/HTTPS/);
  app.context.isSecureContext=true;app.click();fail({code:3});assert.match(app.status(),/troppo tempo/);
  assert.equal(new Script('mapLocationStates.get("events").button.disabled').runInContext(app.context),false);
  new Script('currentUserLocation={lat:45.44,lon:11,accuracy:30}').runInContext(app.context);
  app.click();fail({code:1});assert.match(app.status(),/Permesso negato/);assert.equal(new Script('currentUserLocation').runInContext(app.context),null);
  assert.equal(new Script('[...mapLocationStates.values()].every(state=>state.layer.items.length===0)').runInContext(app.context),true);
});

test('Una risposta tardiva non sposta una mappa abbandonata e coordinate non valide vengono rifiutate',()=>{
  const app=locationTestApp();let success;app.context.navigator={geolocation:{getCurrentPosition(ok){success=ok}}};
  app.click();new Script('view="home"').runInContext(app.context);success({coords:{latitude:45.44,longitude:11,accuracy:80}});assert.equal(app.maps[0].fits,0);
  app.click();success({coords:{latitude:100,longitude:11,accuracy:10}});assert.match(app.status(),/non valida/);assert.equal(app.maps[0].fits,0);
});

test('Da Esplora si apre la mappa eventi dei prossimi sette giorni e si torna ai filtri delle attività',()=>{
  const app=run(new Map(),'home');new Script('setView("explore")').runInContext(app.context);
  app.get('explore-category').value='Farmacie';app.get('explore-category').onchange();app.get('explore-list-tab').onclick();
  app.get('search').value='ricerca calendario';app.get('source').value='Comune di Verona';
  app.get('explore-events').onclick();assert.equal(app.get('event-map-view').hidden,false);assert.equal(app.get('event-map-period').value,'7');assert.equal(app.get('event-map-date').value,'2026-10-17');assert.equal(app.get('search').value,'');assert.match(app.get('event-map-back').textContent,/Esplora/);
  app.get('event-map-back').onclick();assert.equal(app.get('explore-view').hidden,false);assert.equal(app.get('places-list').hidden,false);assert.equal(app.get('explore-category').value,'Farmacie');assert.equal(app.get('search').value,'ricerca calendario');assert.equal(app.get('source').value,'Comune di Verona');
});

test('Esplora cerca nella zona visibile, mantiene il filtro nella lista e ripristina il catalogo',()=>{
  const point=catalog.places.items[0],markers=[];let tileError,mapCount=0;
  const map={setView(){return this},invalidateSize(){},fitBounds(){},getBounds(){return {getSouth:()=>point.lat-.0001,getNorth:()=>point.lat+.0001,getWest:()=>point.lon-.0001,getEast:()=>point.lon+.0001}}};
  const layer={addTo(){return this},clearLayers(){markers.length=0}};
  const L={map(){mapCount++;return map},tileLayer(){return {on(name,fn){tileError=fn;return this},addTo(){return this}}},layerGroup(){return layer},circleMarker(){const marker={bindPopup(){return this},addTo(){markers.push(this);return this},openPopup(){this.open=true}};return marker}};
  const app=run(new Map(),'home',L);new Script('setView("explore")').runInContext(app.context);
  assert.equal(app.get('explore-search-area').disabled,false);app.get('explore-search-area').onclick();
  assert.match(app.get('explore-count').textContent,/zona selezionata/);
  const count=new Script('filteredPlaces().length').runInContext(app.context);assert.ok(count>0&&count<catalog.places.items.length);
  app.get('explore-list-tab').onclick();assert.equal(app.get('explore-search-area').hidden,true);
  app.get('places-list').children[0].children[0].onclick();app.get('place-detail-content').children.find(child=>child.textContent==='⌖ Mostra sulla mappa').onclick();
  assert.equal(app.get('place-detail-dialog').open,false);assert.equal(app.get('places-map').hidden,false);assert.ok(markers.some(marker=>marker.open));
  tileError();app.get('explore-reset').onclick();assert.equal(new Script('filteredPlaces().length').runInContext(app.context),catalog.places.items.length);
  assert.match(app.get('places-map-message').textContent,/non si caricano/);assert.equal(mapCount,1);
});

test('Esplora riconosce accenti e parole invertite e recupera una ricerca senza risultati',()=>{
  const app=run(new Map(),'home');new Script('setView("explore");exploreMode="list";places.unshift({id:"test-caffe",name:"Caffè della Piazza",category:"Bar e caffè",address:"Via Roma",lat:45.44,lon:11});').runInContext(app.context);
  app.get('explore-search').value='ROMA caffe';app.get('explore-search').oninput();assert.equal(new Script('filteredPlaces().some(p=>p.id==="test-caffe")').runInContext(app.context),true);
  app.get('explore-search').value='nessun luogo di prova 999';app.get('explore-search').oninput();app.get('places-list').children.at(-1).onclick();
  assert.equal(app.get('explore-search').value,'');assert.equal(app.get('explore-reset').hidden,true);assert.ok(new Script('filteredPlaces().length').runInContext(app.context)>100);
});

test('I crediti per licenza sconosciuta indicano la fonte senza attribuire una licenza CC',()=>{
  const app=run(new Map(),'home');
  new Script(`const unknownPhotoNews=newsItems[0];unknownPhotoNews.image={url:'https://www.comune.verona.it/foto.jpg',author:'Comune di Verona',license:'Licenza non specificata',rightsStatus:'unverified',sourceUrl:'https://www.comune.verona.it/Media/Images/Foto'};openNews(unknownPhotoNews);`).runInContext(app.context);
  const poster=app.get('news-detail-content').children.find(child=>child.className==='event-poster'),caption=poster.children[1];
  assert.ok(caption.children.some(child=>child.textContent.includes('Fonte immagine: Comune di Verona')));
  assert.ok(caption.children.some(child=>child.textContent.includes('Licenza sconosciuta')));
  assert.ok(!caption.children.some(child=>child.href?.includes('creativecommons.org')));
  assert.ok(caption.children.some(child=>child.href==='https://www.comune.verona.it/Media/Images/Foto'));
});

test('Le notizie mostrano miniature leggere e foto completa senza alterare i salvataggi',()=>{
  const app=run(new Map(),'home');
  new Script(`const photoNews=newsItems[0];photoNews.image={url:'https://www.comune.verona.it/foto.jpg',alt:'Foto del Comune',author:'Autrice',license:'CC BY 4.0'};setView('news');`).runInContext(app.context);
  const card=app.get('news-list').children[0],title=card.children.find(child=>child.className?.includes('news-title')),image=title.children[0];
  assert.equal(image.loading,'lazy');assert.match(image.src,/w_640,h_640/);assert.equal(image.alt,'');assert.equal(title.children[1].className,'news-title-text');
  assert.ok(card.children.some(child=>child.className==='news-image-credit'));
  title.onclick();assert.equal(app.get('news-detail-dialog').open,true);
  const poster=app.get('news-detail-content').children.find(child=>child.className==='event-poster');assert.ok(poster);assert.match(poster.children[0].src,/w_1200,h_1200/);
  image.onerror();assert.equal(image.hidden,true);assert.ok(card.children.at(-1).children.some(child=>child.className?.startsWith('news-bookmark')));
});

test('Immagini eventi: copertina, dettaglio completo, miniatura e recupero dopo errore',()=>{
  const app=run();
  new Script(`const imageTestEvent=currentDiscovery;imageTestEvent.imageId=17;imageTestEvent.image={url:'https://www.comune.verona.it/media/prova.png',author:'Autrice',license:'CC BY 4.0',alt:'Locandina di prova'};renderDiscovery();`).runInContext(app.context);
  const cover=app.get('deck').children[0].children[0],photo=cover.children.find(child=>child.className==='event-cover-image'),credit=cover.children.at(-1);
  assert.equal(photo.alt,'Locandina di prova');assert.equal(credit.hidden,true);assert.equal(photo.hidden,true);photo.onload();assert.equal(credit.hidden,false);assert.equal(photo.hidden,false);assert.ok(cover.children.slice(0,3).every(node=>node.hidden));photo.onerror();assert.equal(credit.hidden,true);assert.equal(photo.hidden,true);assert.ok(cover.children.slice(0,3).every(node=>node.hidden===false));
  new Script('openDetails(imageTestEvent)').runInContext(app.context);
  const poster=app.get('detail-content').children.find(child=>child.className==='event-poster');assert.ok(poster);
  assert.equal(poster.children[0].src,'https://flyimg.opencityitalia.it/upload/rf_1,o_auto,w_1200,h_1200/'+encodeURIComponent('https://www.comune.verona.it/media/prova.png'));assert.ok(poster.children[1].children.some(child=>child.href==='https://www.comune.verona.it/media/prova.png'));assert.equal(photo.fetchPriority,'high');assert.match(photo.src,/w_640,h_640/);assert.ok(poster.children[1].children.some(child=>child.href==='https://creativecommons.org/licenses/by/4.0/'));
  new Script('selectAgendaDay(eventDay(imageTestEvent.startsAt))').runInContext(app.context);
  const thumbnail=app.get('events').children.flatMap(card=>card.children).find(child=>child.className==='event-thumbnail');assert.ok(thumbnail);assert.equal(thumbnail.loading,'lazy');assert.match(thumbnail.src,/w_180,h_180/);
  new Script(`imageTestEvent.image.url='javascript:alert(1)';openDetails(imageTestEvent)`).runInContext(app.context);
  assert.ok(!app.get('detail-content').children.some(child=>child.className==='event-poster'));
});

test('Mappa autobus: il fallback PDF mantiene elenco, direzione e servizi separati',()=>{
  const app=run(new Map(),'home');
  new Script('payload.busOfficial={lines:[]}').runInContext(app.context);
  new Script('openBusRoute(busData.lines.find(line=>line.id==="atv-urban-11"))').runInContext(app.context);
  assert.equal(app.get('bus-route-dialog').open,true);assert.match(app.get('bus-route-message').textContent,/non disponibile/);
  assert.equal(app.get('bus-route-variant').value,'11344295');
  app.get('bus-route-list-tab').onclick();assert.equal(app.get('bus-route-stops').hidden,false);
  const row=app.get('bus-route-stops').children.find(row=>row.children[0].textContent==='Via Giberti');
  row.children.find(child=>child.textContent==='Orari di questa fermata').onclick();
  assert.equal(app.get('bus-timetable-dialog').open,true);assert.match(app.get('timetable-direction').value,/Chievo/);
  assert.match(app.get('timetable-map-context').textContent,/Via Giberti/);
  assert.equal(app.get('timetable-stop').value,'Via Giberti#1');assert.equal(app.get('timetable-service').value,'');
  const groups=app.get('timetable-results').children;assert.equal(groups.length,2);
  assert.ok(groups.every(group=>group.className==='timetable-service-group'&&group.children.length>10));
  assert.ok(groups.some(group=>group.children[0].textContent==='LUN-VEN SCOLASTICO'));
  assert.ok(groups.some(group=>group.children[0].textContent==='SABATO e VACANZE SCOLASTICHE'));
  app.get('timetable-service').value='LUN-VEN SCOLASTICO';app.get('timetable-service').onchange();
  assert.equal(app.get('timetable-stop').value,'Via Giberti#1');assert.ok(app.get('timetable-results').children.length>10);
  app.get('timetable-service').value='';app.get('timetable-service').onchange();assert.equal(app.get('timetable-results').children.length,2);
  app.get('close-bus-timetable').onclick();assert.equal(app.get('bus-route-dialog').open,true);
  app.get('bus-route-variant').value='1859585';app.get('bus-route-variant').onchange();
  const ambiguous=app.get('bus-route-stops').children.filter(row=>row.children[0].textContent==='Piazza Chievo');
  assert.equal(ambiguous.length,2);assert.ok(ambiguous.every(row=>!row.children.some(child=>child.textContent==='Orari di questa fermata')));
  app.get('close-bus-route').onclick();new Script('openBusRoute(busRouteLine)').runInContext(app.context);
  assert.equal(app.get('bus-route-variant').value,'1859585');
});

test('Mappa autobus: geometrie reali, riuso mappa, localizzazione da elenco ed errore delle tile',()=>{
  const markers=[],paths=[];let mapCount=0,tileError;
  const map={setView(){return this},invalidateSize(){},fitBounds(){}};
  const layer={addTo(){return this},clearLayers(){markers.length=0;paths.length=0}};
  const L={map(){mapCount++;return map},tileLayer(){return {on(name,fn){tileError=fn;return this},addTo(){return this}}},layerGroup(){return layer},polyline(points){paths.push(points);return {addTo(){return this}}},circleMarker(){const marker={bindPopup(popup){this.popup=popup;return this},addTo(){markers.push(this);return this},openPopup(){this.open=true}};return marker}};
  const app=run(new Map(),'home',L);new Script('openBusRoute(busData.lines.find(line=>line.id==="atv-urban-11"))').runInContext(app.context);
  assert.equal(mapCount,1);assert.equal(markers.length,45);assert.equal(paths.length,2);assert.ok(paths[0].length>100);
  app.get('bus-route-list-tab').onclick();app.get('bus-route-stops').children[0].children.at(-1).onclick();
  assert.ok(markers[0].open);assert.equal(app.get('bus-route-map').hidden,false);
  tileError();assert.match(app.get('bus-route-message').textContent,/non si caricano/);
  app.get('bus-route-variant').value='1859585';app.get('bus-route-variant').onchange();assert.equal(mapCount,1);
  assert.match(app.get('bus-route-message').textContent,/non si caricano/);
  app.get('bus-route-list-tab').onclick();assert.ok(app.get('bus-route-stops').children.length>40);
});
test('La mappa eventi rispetta date, periodo, preferiti e rientro al calendario',()=>{
  const app=run();app.get('discover-event-map').onclick();
  assert.equal(app.get('event-map-view').hidden,false);assert.equal(app.get('discover-view').hidden,true);
  assert.equal(app.get('event-map-date').value,'2026-10-17');assert.match(app.get('events-map-message').textContent,/calendario/);
  const daily=new Script('eventMapEvents().length').runInContext(app.context);
  app.get('event-map-period').value='7';app.get('event-map-period').onchange();
  assert.ok(new Script('eventMapEvents().length').runInContext(app.context)>=daily);
  app.get('event-map-saved').onclick();assert.match(app.get('event-map-count').textContent,/^0 appuntamenti/);
  new Script('save(events[0].id,"interested")').runInContext(app.context);
  assert.equal(new Script('eventMapEvents().length').runInContext(app.context),1);
  app.get('event-map-date').value='2026-10-18';app.get('event-map-date').onchange();
  app.get('event-map-back').onclick();assert.equal(app.get('calendar-view').hidden,false);
  assert.match(app.get('selected').textContent,/17/);
  app.get('calendar-event-map').onclick();assert.equal(app.get('event-map-date').value,'2026-10-17');
  app.get('event-map-date').value='';app.get('event-map-date').onchange();assert.equal(app.get('event-map-date').value,'2026-10-17');
});

test('Dettagli e mappa condividono il salvataggio e scartano sedi ambigue',()=>{
  const app=run();
  assert.equal(new Script('events.filter(e=>e.mapDisabled).every(e=>eventPosition(e)===null)').runInContext(app.context),true);
  assert.ok(catalog.events.some(e=>e.mapDisabled&&e.coordinates));
  new Script('openDetails(events.find(e=>eventPosition(e)))').runInContext(app.context);
  assert.ok(app.get('detail-content').children.some(b=>b.href?.includes('maps/dir/')));
  app.get('detail-content').children.find(b=>b.className==='dialog-save').onclick();
  assert.equal(Object.keys(JSON.parse(app.storage.get('verona-events-v1'))).length,1);
  new Script('openDetails(events.find(e=>eventPosition(e)))').runInContext(app.context);
  app.get('detail-content').children.find(b=>b.className==='dialog-save event-map-detail-button').onclick();
  assert.equal(app.get('event-map-view').hidden,false);assert.equal(app.get('detail-dialog').open,false);
  assert.equal(new Script('eventMapEvents().some(e=>e.id===eventMapFocus)').runInContext(app.context),true);
});

test('I punti raggruppano appuntamenti reali e aprono dettagli e data corretti',()=>{
  const markers=[];let mapCount=0;
  const map={setView(){return this},invalidateSize(){},fitBounds(){},remove(){}};
  const layer={addTo(){return this},clearLayers(){markers.length=0}};
  const L={map(target){if(target==='events-map')mapCount++;return map},tileLayer(){return {on(){return this},addTo(){return this}}},layerGroup(){return layer},circleMarker(position,options){const marker={position,options,bindPopup(popup){this.popup=popup;return this},addTo(){markers.push(this);return this},openPopup(){this.open=true}};return marker}};
  const app=run(new Map(),'home',L);app.get('calendar-event-map').onclick();
  assert.ok(markers.length>0);assert.equal(mapCount,1);
  const expected=new Script('new Set(eventMapEvents().filter(eventPosition).map(e=>{const p=eventPosition(e);return p.lat.toFixed(5)+","+p.lon.toFixed(5)})).size').runInContext(app.context);
  assert.equal(markers.length,expected);
  markers[0].popup.children[1].onclick();assert.equal(app.get('detail-dialog').open,true);
  app.get('detail-content').children.find(b=>b.className==='dialog-save').onclick();
  assert.ok(markers.some(m=>m.options.fillColor==='#c38b42'));
  new Script('openDetails(events.find(e=>eventPosition(e)))').runInContext(app.context);
  app.get('detail-content').children.find(b=>b.className==='dialog-save event-map-detail-button').onclick();
  assert.ok(markers.some(m=>m.open));assert.equal(mapCount,1);
});

test('Anteprima evento: posizione reale, nessun gesto che blocca lo scroll, pulizia e risposte tardive isolate',()=>{
  const maps=[],tiles=[],points=[];
  const L={map(box,options){const map={box,options,setView(point,zoom){this.point=point;this.zoom=zoom;return this},remove(){this.removed=true}};maps.push(map);return map;},tileLayer(){const tile={handlers:{},on(event,fn){this.handlers[event]=fn;return this},addTo(){return this}};tiles.push(tile);return tile;},circleMarker(point,options){points.push({point,options});return {addTo(){return this}}}};
  const app=run(new Map(),'home',L);new Script('openDetails(events.find(e=>eventPosition(e)))').runInContext(app.context);
  assert.equal(maps.length,1);assert.equal(maps[0].options.dragging,false);assert.equal(maps[0].options.scrollWheelZoom,false);assert.equal(maps[0].options.keyboard,false);
  const section=app.get('detail-content').children.find(child=>child.className==='event-location-preview');assert.ok(section);assert.equal(points[0].options.interactive,false);
  assert.deepEqual(points[0].point,maps[0].point);tiles[0].handlers.tileerror();assert.match(section.children[2].textContent,/Sfondo/);
  new Script('openDetails({...events.find(e=>eventPosition(e)),coordinates:{lat:45.44,lon:10.99}})').runInContext(app.context);
  assert.equal(maps[0].removed,true);const current=app.get('detail-content').children.find(child=>child.className==='event-location-preview');tiles[0].handlers.load();assert.match(current.children[2].textContent,/Caricamento/);
  tiles[1].handlers.load();assert.equal(current.children[2].textContent,'');app.get('close-detail').onclick();assert.equal(maps[1].removed,true);
});
test('Anteprima evento: sedi ambigue escluse e indicazioni accessibili se Leaflet non è disponibile',()=>{
  const app=run(new Map(),'home');new Script('openDetails(events.find(e=>eventPosition(e)))').runInContext(app.context);
  const section=app.get('detail-content').children.find(child=>child.className==='event-location-preview');assert.match(section.children[2].textContent,/non disponibile/);
  assert.ok(app.get('detail-content').children.some(child=>child.href?.includes('maps/dir/')));
  new Script('openDetails({...events[0],mapDisabled:true,coordinates:{lat:45.44,lon:10.99}})').runInContext(app.context);
  assert.ok(!app.get('detail-content').children.some(child=>child.className==='event-location-preview'));
});

test('Il quartiere è attivo dalla Home e la scelta si applica solo alla conferma',()=>{
  const app=run(new Map(),'home');app.get('services').children.find(s=>s.attributes['data-service']==='district').onclick();
  assert.equal(app.get('district-view').hidden,false);assert.equal(app.get('open-filters').hidden,true);
  assert.equal(app.get('district-list').children[0].className,'district-onboarding');
  app.get('district-zone').onclick();assert.equal(app.get('district-dialog').open,true);assert.equal(app.get('apply-district').disabled,true);
  app.get('district-choice').value='3:0';app.get('district-choice').onchange();assert.equal(app.get('apply-district').disabled,false);
  app.get('close-district').onclick();assert.equal(app.storage.get('verona-district-v1'),undefined);
  app.get('district-zone').onclick();assert.equal(app.get('district-choice').value,'');
  app.get('district-choice').value='3:0';app.get('apply-district').onclick();
  assert.equal(app.get('district-name').textContent,'Borgo Milano');assert.equal(app.get('district-dialog').open,false);
  assert.ok(app.get('district-list').children.some(c=>c.children.some(n=>/Consiglio circoscrizionale/.test(n.textContent))));
  assert.ok(app.get('district-office').href.endsWith('Circoscrizione-3-Ovest'));
  const next=run(app.storage,'home');new Script('setView("district")').runInContext(next.context);
  assert.equal(next.get('district-name').textContent,'Borgo Milano');
  next.get('district-zone').onclick();next.get('clear-district').onclick();
  assert.equal(new Script('currentDistrict()').runInContext(next.context),null);
  assert.equal(next.get('district-list').children[0].className,'district-onboarding');
});

test('Il quartiere distingue le pubblicazioni locali da quelle senza zona e corregge la commissione',()=>{
  const app=run(new Map(),'home');new Script('applyDistrict("3:*");setView("district")').runInContext(app.context);
  const matches=new Script('districtRows().map(i=>i.title)').runInContext(app.context);
  assert.ok(matches.some(t=>t.includes('Consiglio circoscrizionale')));
  assert.ok(!matches.some(t=>t.includes('Commissione Permanente')));
  new Script('applyDistrict("8:*")').runInContext(app.context);
  assert.ok(new Script('districtRows().some(i=>i.title.includes("Commissione Permanente"))').runInContext(app.context));
  app.get('district-city').onclick();
  assert.equal(new Script('districtRows().every(i=>!i.districtMatches.length)').runInContext(app.context),true);
  assert.match(app.get('district-summary').textContent,/senza zona indicata/);
  app.get('district-notices').onclick();assert.match(app.get('district-list').children[0].children[0].textContent,/non ci sono risultati/);
  app.get('district-search').value='impossibile-123456';app.get('district-search').oninput();
  app.get('district-list').children[0].children.at(-1).onclick();assert.equal(app.get('district-search').value,'');
});

test('Notizie salvate dal quartiere sono condivise e persistono senza cambiare i filtri Notizie',()=>{
  const app=run(new Map(),'home');app.get('news-search').value='filtro-indipendente';
  new Script('applyDistrict("3:*");setView("district")').runInContext(app.context);
  app.get('district-list').children[0].children.at(-1).children[1].onclick();
  const bookmarks=JSON.parse(app.storage.get('verona-news-v1'));assert.equal(Object.keys(bookmarks).length,1);
  assert.equal(app.get('news-search').value,'filtro-indipendente');
  app.get('district-saved').onclick();assert.equal(app.get('district-list').children.length,1);
  app.get('district-list').children[0].children[1].onclick();assert.equal(app.get('news-detail-dialog').open,true);
  app.get('news-detail-content').children.find(c=>c.className?.startsWith('news-bookmark')).onclick();
  assert.match(app.get('district-list').children[0].children[0].textContent,/Nessun contenuto salvato/);
  assert.equal(app.storage.get('verona-events-v1'),undefined);
});

test('Gli eventi locali mantengono le singole date e condividono calendario e presenza',()=>{
  const app=run(new Map(),'home');
  new Script('const localEvent=events.find(e=>e.districtMatches.length&&Date.parse(e.endsAt)>Date.now());applyDistrict(localEvent.districtMatches[0].id+":*");districtMode="events";setView("district")').runInContext(app.context);
  const count=new Script('districtRows().length').runInContext(app.context);assert.ok(count>0);
  const id=new Script('districtRows()[0].id').runInContext(app.context);
  app.get('district-list').children[0].children.at(-1).children[1].onclick();
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[id],'going');
  app.get('district-saved').onclick();assert.equal(app.get('district-list').children.length,1);
  app.get('district-list').children[0].children[1].onclick();assert.equal(app.get('detail-dialog').open,true);
  app.get('close-detail').onclick();
  app.get('district-list').children[0].children.at(-1).children.find(b=>b.textContent==='Rimuovi').onclick();
  assert.match(app.get('district-list').children[0].children[0].textContent,/Nessun contenuto salvato/);
  app.get('district-back').onclick();assert.equal(app.get('home-view').hidden,false);
});

test('Una preferenza di quartiere non valida viene ignorata e i blocchi al salvataggio sono visibili',()=>{
  const app=run(new Map([['verona-district-v1','{"district":"inventato"}']]),'home');
  assert.equal(new Script('currentDistrict()').runInContext(app.context),null);
  new Script('setView("district");localStorage.setItem=()=>{throw new Error("blocked")};applyDistrict("2:*")').runInContext(app.context);
  assert.match(app.get('district-feedback').textContent,/questa visita/);
  assert.equal(app.get('district-name').textContent,'Nord-ovest');
});

test('Il nome di un quartiere non estende la notizia agli altri quartieri della stessa circoscrizione',()=>{
  const app=run(new Map(),'home');new Script('applyDistrict("2:1");setView("district")').runInContext(app.context);
  assert.ok(new Script('districtRows().some(i=>i.title.includes("Borgo Trento"))').runInContext(app.context));
  new Script('applyDistrict("2:2")').runInContext(app.context);
  assert.equal(new Script('districtRows().some(i=>i.title.includes("Borgo Trento"))').runInContext(app.context),false);
  new Script('applyDistrict("2:*")').runInContext(app.context);
  assert.ok(new Script('districtRows().some(i=>i.title.includes("Borgo Trento"))').runInContext(app.context));
});

test('Il calendario parte dai dati incorporati, senza richieste di rete',()=>{
  const {get}=run();
  assert.equal(get('week-grid').children.length,7);
  assert.ok(get('status').textContent.includes(catalog.events.length+' nel catalogo'));
  assert.ok(get('month').textContent.length>0);
});
test('La Home contiene sei servizi e Permessi ZTL sostituisce Persone con il portale ufficiale',()=>{
  const app=run(new Map(),'home');
  assert.equal(app.get('home-view').hidden,false);assert.equal(app.get('discover-view').hidden,true);assert.equal(app.get('calendar-view').hidden,true);
  assert.equal(app.get('open-filters').hidden,true);assert.equal(app.get('home').attributes['aria-pressed'],'true');
  assert.equal(app.get('services').children.length,6);
  assert.equal(app.get('services').children.find(e=>e.attributes['data-service']==='people'),undefined);
  const utilities=app.get('services').children.find(e=>e.attributes['data-service']==='utilities');
  assert.equal(utilities.attributes['aria-label'],'Servizi utili');utilities.onclick();assert.equal(app.get('utilities-dialog').open,true);
  app.get('utilities-ztl').onclick();
  assert.equal(app.get('ztl-dialog').open,true);assert.equal(app.get('home-view').hidden,false);
  app.get('close-ztl').onclick();assert.equal(app.get('ztl-dialog').open,false);
  assert.equal(app.get('utilities-dialog').open,true);app.get('utilities-pharmacies').onclick();assert.equal(app.get('pharmacy-dialog').open,true);app.get('pharmacy-close').onclick();app.get('utilities-waste').onclick();assert.equal(app.get('waste-dialog').open,true);app.get('waste-close').onclick();app.get('utilities-close').onclick();assert.equal(app.get('utilities-dialog').open,false);
  assert.match(builtHtml,/<a id="ztl-portal"[^>]*href="https:\/\/permessi\.mobilita\.comune\.verona\.it\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
});
test('Esplora è attiva dalla Home, filtra luoghi reali e conserva i preferiti',()=>{
  const app=run(new Map(),'home');app.get('services').children.find(e=>e.attributes['data-service']==='explore').onclick();
  assert.equal(app.get('explore-view').hidden,false);assert.match(app.get('places-map-message').textContent,/Elenco/);
  app.get('explore-list-tab').onclick();assert.equal(app.get('places-list').hidden,false);
  const first=catalog.places.items[0];app.get('explore-search').value=first.name;app.get('explore-search').oninput();
  assert.ok(app.get('places-list').children.length>0);
  app.get('places-list').children[0].children[1].onclick();
  assert.ok(app.storage.get('verona-places-v1'));assert.equal(app.storage.get('verona-events-v1'),undefined);
  const next=run(app.storage,'home');new Script('setView("explore")').runInContext(next.context);next.get('explore-list-tab').onclick();next.get('explore-saved').onclick();
  assert.equal(new Script('filteredPlaces().length').runInContext(next.context),1);
  next.get('places-list').children[0].children[0].onclick();assert.equal(next.get('place-detail-dialog').open,true);
  assert.ok(next.get('place-detail-content').children.some(n=>n.className==='place-links'));
  next.get('close-place-detail').onclick();next.get('places-list').children[0].children[1].onclick();
  assert.match(next.get('places-list').children[0].textContent,/Nessun preferito/);
});
test('Categorie, stato vuoto e caricamento progressivo dei luoghi non alterano le altre sezioni',()=>{
  const app=run(new Map(),'home');new Script('setView("explore")').runInContext(app.context);app.get('explore-list-tab').onclick();
  const more=app.get('places-list').children.at(-1);assert.equal(more.className,'places-more');more.onclick();
  assert.equal(new Script('placesShown').runInContext(app.context),120);
  app.get('explore-category').value='Farmacie';app.get('explore-category').onchange();
  assert.equal(new Script('filteredPlaces().every(p=>p.category==="Farmacie")').runInContext(app.context),true);
  app.get('explore-search').value='nessuna-attivita-123456';app.get('explore-search').oninput();
  assert.match(app.get('places-list').children[0].textContent,/Nessuna attività trovata/);
  app.get('explore-back').onclick();assert.equal(app.get('home-view').hidden,false);assert.equal(app.get('explore-view').hidden,true);
});
test('Autobus apre schede reali dalla Home, cerca il percorso e distingue i servizi',()=>{
  const app=run(new Map(),'home');app.get('services').children.find(e=>e.attributes['data-service']==='bus').onclick();
  assert.equal(app.get('bus-view').hidden,false);assert.equal(app.get('home-view').hidden,true);
  assert.equal(app.get('bus-list').children.length,catalog.bus.lines.length);
  app.get('bus-search').value='MONTORIO';app.get('bus-search').oninput();
  assert.ok(new Script('busData.lines.filter(busMatches).length').runInContext(app.context)>0);
  assert.equal(app.get('open-filters').hidden,true);assert.equal(app.get('bus-service-tools').hidden,false);
  app.get('bus-service').value='holiday';app.get('bus-service').onchange();
  assert.equal(new Script('busData.lines.filter(busMatches).every(l=>l.service==="holiday")').runInContext(app.context),true);

  app.get('bus-list').children[0].children[0].onclick();assert.equal(app.get('bus-detail-dialog').open,true);
  assert.ok(app.get('bus-detail-content').children.some(e=>e.children?.some(n=>n.className==='bus-route')));
  assert.ok(app.get('bus-detail-content').children.some(e=>e.href?.includes('ServeAttachment.php')));
  app.get('close-bus-detail').onclick();app.get('bus-back').onclick();assert.equal(app.get('home-view').hidden,false);
});
test('Le linee preferite persistono e la rimozione lascia uno stato vuoto recuperabile',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);
  app.get('bus-list').children[0].children[1].onclick();assert.ok(app.storage.get('verona-bus-v1'));
  const next=run(app.storage,'home');new Script('setView("bus")').runInContext(next.context);next.get('bus-favorites').onclick();
  assert.equal(next.get('bus-list').children.length,1);
  next.get('bus-list').children[0].children[1].onclick();assert.match(next.get('bus-list').children[0].children[0].textContent,/Nessuna linea preferita/);
  next.get('bus-lines').onclick();assert.equal(next.get('bus-list').children.length,catalog.bus.lines.length);
});
test('Gli avvisi ATV aprono la fonte e non vengono presentati come orari live',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);app.get('bus-alerts').onclick();
  assert.equal(app.get('bus-list').children.filter(c=>c.className==='bus-alert').length,catalog.bus.alerts.length);
  app.get('bus-list').children.find(c=>c.className==='bus-alert').children[1].onclick();assert.equal(app.get('bus-detail-dialog').open,true);
  assert.ok(app.get('bus-detail-content').children.some(e=>e.href?.startsWith('https://www.atv.verona.it/')));
  assert.ok(catalog.bus.lines.every(l=>l.realtime===false));
});
test('Notizie ATV mostra il feed completo, con ricerca anche nelle pubblicazioni aziendali',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);app.get('bus-more').onclick();app.get('bus-updates').onclick();
  assert.equal(app.get('bus-updates-dialog').open,true);assert.equal(app.get('bus-updates-list').children.length,catalog.bus.updates.length);
  assert.ok(catalog.bus.updates.length>catalog.bus.alerts.length);
  const item=catalog.bus.updates.find(i=>!i.serviceAlert);app.get('bus-updates-search').value=item.title;app.get('bus-updates-search').oninput();
  assert.equal(app.get('bus-updates-list').children.length,1);app.get('bus-updates-list').children[0].children[1].onclick();assert.equal(app.get('bus-detail-dialog').open,true);
});

test('Autobus apre le mie linee quando esistono preferiti e conserva ricerca e servizio',()=>{
  const line=catalog.bus.lines.find(l=>l.id==='atv-urban-13'),storage=new Map([['verona-bus-v1',JSON.stringify({[line.id]:true})]]);
  const app=run(storage,'home');new Script('setView("bus")').runInContext(app.context);
  assert.equal(new Script('busMode').runInContext(app.context),'favorites');assert.equal(app.get('bus-list').children.length,1);
  const card=app.get('bus-list').children[0],body=card.children[0].children[1];
  assert.ok(body.children.some(n=>n.textContent==='Direzione Montorio'));assert.ok(body.children.some(n=>n.textContent==='Direzione Croce Bianca'));
  card.children[2].children[0].onclick();assert.equal(app.get('bus-timetable-dialog').open,true);app.get('close-bus-timetable').onclick();
  app.get('bus-search').value='Montorio';app.get('bus-service').value='urban';app.get('bus-search').oninput();
  app.get('bus-back').onclick();new Script('setView("bus")').runInContext(app.context);
  assert.equal(app.get('bus-search').value,'Montorio');assert.equal(app.get('bus-service').value,'urban');assert.equal(new Script('busMode').runInContext(app.context),'favorites');
});

test('Gli avvisi personali includono quelli senza linea e rispettano i numeri esatti',()=>{
  const app=run(new Map([['verona-bus-v1',JSON.stringify({'atv-urban-20':true,'atv-holiday-97':true})]]),'home');
  new Script('setView("bus")').runInContext(app.context);app.get('bus-search').value='Centro';app.get('bus-service').value='holiday';
  app.get('bus-alerts').onclick();assert.equal(app.get('bus-search').value,'');assert.equal(app.get('bus-service-tools').hidden,true);
  assert.equal(new Script('busAlertScope').runInContext(app.context),'mine');
  assert.equal(new Script('filteredBusAlerts().every(a=>!a.lines.length||a.lines.includes("20")||a.lines.includes("97"))').runInContext(app.context),true);
  assert.ok(app.get('bus-list').children.some(c=>c.className==='bus-feed-heading'&&c.textContent.startsWith('Avvisi generali')));
  assert.ok(new Script('filteredBusAlerts().some(a=>a.lines.includes("97"))').runInContext(app.context));
  app.get('bus-alert-all').onclick();assert.equal(new Script('filteredBusAlerts().length').runInContext(app.context),catalog.bus.alerts.length);
  app.get('bus-lines').onclick();assert.equal(app.get('bus-search').value,'Centro');assert.equal(app.get('bus-service').value,'holiday');
});

test('Da un avviso si torna alla linea senza perdere la scheda e le direzioni',()=>{
  const app=run(new Map(),'home');new Script('setView("bus");openBusLine(busData.lines.find(l=>l.id==="atv-urban-20"))').runInContext(app.context);
  app.get('bus-detail-content').children.find(c=>c.className==='bus-alert').children[1].onclick();
  const back=app.get('bus-detail-content').children[0];assert.match(back.textContent,/Torna alla linea 20/);back.onclick();
  assert.equal(app.get('bus-detail-content').children[0].textContent,'Linea 20');assert.equal(app.get('bus-detail-dialog').open,true);
  assert.equal(app.get('bus-detail-content').children.filter(c=>c.className==='bus-route-section').length,2);
});

test('Gli stati vuoti autobus azzerano i filtri e le notizie hanno una ricerca indipendente',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);
  app.get('bus-service').value='evening';app.get('bus-search').value='nessuna-linea-12345';app.get('bus-search').oninput();
  app.get('bus-list').children[0].children.at(-1).onclick();assert.equal(app.get('bus-search').value,'');assert.equal(app.get('bus-service').value,'');
  app.get('bus-search').value='Montorio';app.get('bus-service').value='urban';app.get('bus-search').oninput();
  app.get('bus-more').onclick();app.get('bus-updates').onclick();app.get('bus-updates-search').value='nessuna-notizia-12345';app.get('bus-updates-search').oninput();
  app.get('bus-updates-list').children[0].children.at(-1).onclick();assert.equal(app.get('bus-updates-list').children.length,catalog.bus.updates.length);
  app.get('close-bus-updates').onclick();assert.equal(app.get('bus-search').value,'Montorio');assert.equal(app.get('bus-service').value,'urban');
});

test('La scheda senza direzioni non inventa destinazioni e gli errori delle fonti sono visibili',()=>{
  const app=run(new Map(),'home');new Script('setView("bus");openBusLine(busData.lines.find(l=>l.id==="atv-holiday-96"))').runInContext(app.context);
  const route=app.get('bus-detail-content').children.find(c=>c.className==='bus-route-section');assert.equal(route.children[0].textContent,'Percorso indicato da ATV');
  new Script('busData.sources[0].status="error";render()').runInContext(app.context);assert.match(app.get('bus-stale').textContent,/Raccolta incompleta/);
  app.get('bus-more').onclick();assert.match(app.get('bus-source-status').children[0].textContent,/dati precedenti conservati/);
});

test('Autobus senza catalogo o feed conserva un accesso utile alle fonti ufficiali',()=>{
  const app=run(new Map(),'home');new Script('busData.lines=[];busData.alerts=[];busData.updates=[];setView("bus")').runInContext(app.context);
  assert.ok(app.get('bus-list').children[0].children.some(c=>c.href?.includes('atv.verona.it')));
  app.get('bus-alerts').onclick();assert.ok(app.get('bus-list').children[0].children.some(c=>c.href?.includes('/deviazioni')));
  app.get('bus-alert-more').onclick();app.get('bus-updates').onclick();assert.ok(app.get('bus-updates-list').children[0].children.some(c=>c.href==='https://www.atv.verona.it/'));
});

test('Gli orari stagionali non scadono dopo 48 ore mentre gli avvisi segnalano una raccolta vecchia',()=>{
  const app=run(new Map(),'home');new Script(`busData.sources.forEach(s=>{s.status='ok';s.lastSuccessAt='2026-10-14T08:00:00Z'});busData.lines.forEach(l=>l.checkedAt='2026-10-14T08:00:00Z');busData.updatedAt='2026-10-14T08:00:00Z';setView('bus')`).runInContext(app.context);
  assert.equal(app.get('bus-stale').textContent,'');
  app.get('bus-alerts').onclick();assert.match(app.get('bus-stale').textContent,/Avvisi raccolti oltre due giorni/);
});

function chooseTimetable(app,lineId,service,stopPrefix){
  new Script(`openTimetable(busData.lines.find(line=>line.id===${JSON.stringify(lineId)}))`).runInContext(app.context);
  const line=catalog.busTimetables.lines.find(line=>line.lineId===lineId);
  app.get('timetable-direction').value=line.blocks[0].direction;app.get('timetable-direction').onchange();
  app.get('timetable-service').value=service;app.get('timetable-service').onchange();
  const option=app.get('timetable-stop').children.find(child=>child.value.startsWith(stopPrefix));assert.ok(option);
  app.get('timetable-stop').value=option.value;app.get('timetable-stop').onchange();
}

test('Gli orari si aprono dentro l’app e richiedono il servizio senza presumere il calendario scolastico',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);app.get('bus-list').children[0].children[2].children[0].onclick();
  assert.equal(app.get('bus-timetable-dialog').open,true);assert.equal(app.get('timetable-direction').value,'');assert.equal(app.get('timetable-service').disabled,true);
  chooseTimetable(app,'atv-urban-11','LUN-VEN SCOLASTICO','Stazione FS - Corsia B1#');
  const rows=new Script('timetableDepartures()').runInContext(app.context);assert.equal(rows[0].time,'05:30');assert.ok(rows.some(row=>row.trip==='21'&&row.time==='07:22'));
  assert.ok(app.get('timetable-results').children.length>20);assert.ok(app.get('timetable-provenance').children.some(c=>c.href?.startsWith('https://www.atv.verona.it/')));
});

test('Direzione, servizio e fermata persistono e le vecchie selezioni non valide vengono azzerate',()=>{
  const app=run(new Map(),'home');chooseTimetable(app,'atv-urban-11','SABATO e VACANZE SCOLASTICHE','Piazza Chievo#');
  const saved=JSON.parse(app.storage.get('verona-timetables-v1'))['atv-urban-11'];assert.equal(saved.service,'SABATO e VACANZE SCOLASTICHE');
  app.get('close-bus-timetable').onclick();assert.equal(app.get('bus-timetable-dialog').open,false);
  const next=run(app.storage,'home');new Script('openTimetable(busData.lines.find(line=>line.id==="atv-urban-11"))').runInContext(next.context);
  assert.equal(next.get('timetable-service').value,saved.service);assert.equal(next.get('timetable-stop').value,saved.stop);
  next.get('timetable-direction').value=catalog.busTimetables.lines.find(line=>line.lineId==='atv-urban-11').blocks.at(-1).direction;next.get('timetable-direction').onchange();assert.equal(next.get('timetable-stop').value,'');
  const invalid=run(new Map([['verona-timetables-v1',JSON.stringify({'atv-urban-11':{direction:'inesistente',service:'FESTIVO',stop:'non-valida'}})]]),'home');new Script('openTimetable(busData.lines.find(line=>line.id==="atv-urban-11"))').runInContext(invalid.context);assert.equal(invalid.get('timetable-direction').value,'');assert.equal(invalid.get('timetable-stop').disabled,true);
});

test('Gli orari serali ordinano dopo mezzanotte senza trasformarsi in tempi di attesa',()=>{
  const app=run(new Map(),'home');chooseTimetable(app,'atv-evening-81','SERALE GIORNALIERO','Piazza Chievo#');
  const rows=new Script('timetableDepartures()').runInContext(app.context);assert.equal(rows[0].time,'21:12');assert.equal(rows.at(-1).time,'00:32');assert.equal(rows.at(-1).nextDay,true);assert.equal(rows.at(-1).minutes,1472);
  assert.match(app.get('timetable-results').children.at(-1).children[0].children[1].textContent,/giorno successivo/);
});

test('I due passaggi della circolare rimangono distinti e le note delle corse restano disponibili',()=>{
  const app=run(new Map(),'home');chooseTimetable(app,'atv-holiday-96','FESTIVO','P.le Stefani - Ospedale#1');
  assert.equal(new Script('timetableDepartures()[0].time').runInContext(app.context),'06:35');
  app.get('timetable-stop').value='P.le Stefani - Ospedale#2';app.get('timetable-stop').onchange();assert.equal(new Script('timetableDepartures()[0].time').runInContext(app.context),'06:57');
  chooseTimetable(app,'atv-urban-22','LUN-VEN SCOLASTICO','Parona - via dei Reti#');
  assert.ok(new Script('timetableDepartures().some(row=>row.note.includes("3"))').runInContext(app.context));assert.ok(app.get('timetable-provenance').children.some(c=>c.textContent.includes('venerdì')));
});

test('Orari senza dati e salvataggio bloccato mantengono una consultazione utilizzabile',()=>{
  const app=run(new Map(),'home');new Script('localStorage.setItem=()=>{throw Error("blocked")};').runInContext(app.context);
  chooseTimetable(app,'atv-urban-11','LUN-VEN SCOLASTICO','Piazza Chievo#');assert.match(app.get('timetable-feedback').textContent,/questa visita/);assert.ok(app.get('timetable-results').children.length);
  new Script('timetableData.lines=[];openTimetable(busData.lines[0])').runInContext(app.context);assert.match(app.get('timetable-results').children[0].textContent,/non disponibili/);assert.ok(app.get('timetable-provenance').children.some(c=>c.href));
});
test('Notizie è attiva dalla Home e filtra le pubblicazioni ufficiali separatamente dagli eventi',()=>{
  const app=run(new Map(),'home');
  const news=app.get('services').children.find(e=>e.attributes['data-service']==='news');
  assert.ok(!news.attributes['aria-label'].includes('in preparazione'));news.onclick();
  assert.equal(app.get('news-view').hidden,false);assert.equal(app.get('calendar-view').hidden,true);assert.equal(app.get('news-list').children.length,catalog.news.items.length);
  assert.equal(app.get('open-filters').hidden,true);app.get('news-open-filters').onclick();assert.equal(app.get('news-filters-dialog').open,true);
  app.get('news-type').value='avvisi';app.get('apply-news-filters').onclick();assert.equal(new Script('filteredNews().every(i=>i.sourceKey==="avvisi")').runInContext(app.context),true);
  app.get('news-open-filters').onclick();app.get('reset-news-filters').onclick();app.get('apply-news-filters').onclick();
  app.get('news-search').value='tangenziale';app.get('news-search').oninput();
  assert.ok(new Script('filteredNews().length').runInContext(app.context)>0);
  assert.equal(app.get('news-filters-dialog').open,false);
  app.get('news-search').value='';new Script('applyDistrict("3:*")').runInContext(app.context);
  assert.ok(new Script('filteredNews().every(i=>districtMatch(i))').runInContext(app.context));
  app.get('news-all').onclick();assert.equal(app.get('news-list').children.length,catalog.news.items.length);
});
test('Le notizie salvate persistono, si rimuovono dal dettaglio e non entrano nel calendario eventi',()=>{
  const app=run(new Map(),'home');app.get('news').onclick();
  const first=app.get('news-list').children[0];first.children[1].onclick();
  assert.equal(app.get('news-detail-dialog').open,true);
  const save=app.get('news-detail-content').children.find(e=>e.className?.startsWith('news-bookmark'));save.onclick();
  assert.equal(save.textContent,'✓ Salvata');assert.equal(app.storage.get('verona-events-v1'),undefined);
  const next=run(app.storage,'home');next.get('news').onclick();next.get('news-saved').onclick();
  assert.equal(next.get('news-list').children.length,1);
  next.get('news-list').children[0].children[1].onclick();
  next.get('news-detail-content').children.find(e=>e.className?.startsWith('news-bookmark')).onclick();
  assert.match(next.get('news-list').children[0].children[0].textContent,/Nessuna notizia salvata/);
});

test('I filtri notizie applicano soltanto i campi confermati e si possono rimuovere uno per volta',()=>{
  const app=run(new Map(),'home');app.get('news').onclick();const total=app.get('news-list').children.length;
  app.get('news-open-filters').onclick();app.get('news-category').value='Mobilità';app.get('news-type').value='avvisi';
  assert.equal(new Script('filteredNews().length').runInContext(app.context),total);
  app.get('close-news-filters').onclick();app.get('news-open-filters').onclick();assert.equal(app.get('news-category').value,'');assert.equal(app.get('news-type').value,'');
  app.get('news-category').value='Comunità';app.get('news-type').value='notizie';app.get('apply-news-filters').onclick();
  assert.equal(new Script('filteredNews().every(i=>i.category==="Comunità"&&i.sourceKey==="notizie")').runInContext(app.context),true);
  assert.equal(app.get('news-active-filters').children.length,2);assert.equal(app.get('news-active-filters').hidden,false);
  app.get('news-active-filters').children[0].onclick();assert.equal(new Script('newsFilters.category').runInContext(app.context),'');
  assert.equal(new Script('newsFilters.type').runInContext(app.context),'notizie');
  app.get('news-open-filters').onclick();app.get('reset-news-filters').onclick();app.get('close-news-filters').onclick();
  assert.equal(new Script('newsFilters.type').runInContext(app.context),'notizie');
  app.get('news-active-filters').children[0].onclick();assert.equal(app.get('news-list').children.length,total);assert.equal(app.get('news-active-filters').hidden,true);
});

test('La vista notizie della zona riutilizza la scelta e i riferimenti testuali del Mio quartiere',()=>{
  const app=run(new Map(),'home');app.get('news').onclick();app.get('news-zone-tab').onclick();
  assert.match(app.get('news-list').children[0].children[0].textContent,/Qual è la tua zona/);
  app.get('news-list').children[0].children.at(-1).onclick();app.get('district-choice').value='2:1';app.get('apply-district').onclick();
  assert.equal(app.get('news-view').hidden,false);assert.match(app.get('news-zone').textContent,/Borgo Trento/);
  assert.ok(new Script('filteredNews().some(i=>i.title.includes("Borgo Trento"))').runInContext(app.context));
  assert.ok(new Script('filteredNews().every(i=>districtMatch(i))').runInContext(app.context));
  const next=run(app.storage,'home');next.get('news').onclick();next.get('news-zone-tab').onclick();assert.match(next.get('news-zone').textContent,/Borgo Trento/);
  next.get('news-zone').onclick();next.get('district-choice').value='3:*';next.get('close-district').onclick();assert.match(next.get('news-zone').textContent,/Borgo Trento/);
  next.get('news-zone').onclick();next.get('clear-district').onclick();assert.match(next.get('news-list').children[0].children[0].textContent,/Qual è la tua zona/);
});

test('Le schede mostrano argomento e zona distinti e spiegano le date nel dettaglio',()=>{
  const app=run(new Map(),'home');app.get('news').onclick();app.get('news-search').value='Consiglio circoscrizionale';app.get('news-search').oninput();
  const card=app.get('news-list').children[0];const tags=card.children.find(c=>c.className==='news-tags');
  assert.equal(tags.children[0].textContent,'Altre comunicazioni');assert.match(tags.children[1].textContent,/Circoscrizione 3/);
  assert.match(card.children[0].children[1].textContent,/Pubblicata/);
  card.children.at(-1).children[0].onclick();assert.equal(app.get('news-detail-dialog').open,true);
  const details=app.get('news-detail-content');assert.ok(details.children.some(c=>c.textContent.includes('data indicata è quella di pubblicazione')));
  assert.ok(details.children.some(c=>c.href?.startsWith('https://www.comune.verona.it/Novita/')));
  assert.ok(details.children.some(c=>c.className==='news-provenance'));
});

test('La ricerca senza risultati si recupera senza perdere la vista o il quartiere',()=>{
  const app=run(new Map(),'home');new Script('applyDistrict("3:*");setView("news")').runInContext(app.context);app.get('news-zone-tab').onclick();
  app.get('news-search').value='impossibile-123456';app.get('news-search').oninput();
  assert.match(app.get('news-list').children[0].children[0].textContent,/Nessun risultato/);
  app.get('news-list').children[0].children.at(-1).onclick();assert.equal(app.get('news-search').value,'');
  assert.equal(new Script('newsMode').runInContext(app.context),'zone');assert.equal(new Script('districtChoice').runInContext(app.context),'3:*');
  assert.ok(new Script('filteredNews().length').runInContext(app.context)>0);
});

test('Una raccolta di notizie assente mantiene un accesso alla fonte ufficiale',()=>{
  const app=run(new Map(),'home');new Script('newsItems.splice(0);setView("news")').runInContext(app.context);
  assert.equal(app.get('news-summary').textContent,'Raccolta non disponibile');
  const link=app.get('news-list').children[0].children.at(-1);assert.equal(link.href,'https://www.comune.verona.it/Novita/Notizie');assert.equal(link.target,'_blank');
});

test('Dalla Home si salva un evento reale e si apre il proprio programma',()=>{
  const app=run(new Map(),'home');
  app.get('home-featured').children[0].onclick();
  assert.equal(app.get('detail-dialog').open,true);
  const button=app.get('detail-content').children.find(e=>e.className==='dialog-save');button.onclick();
  assert.equal(app.get('detail-dialog').open,false);assert.equal(app.get('home-view').hidden,false);
  assert.match(app.get('home-programs').textContent,/\(1\)/);
  app.get('home-programs').onclick();assert.equal(app.get('calendar-view').hidden,false);
  assert.match(app.get('count').textContent,/nel tuo calendario/);
  app.get('home').onclick();assert.equal(app.get('home-view').hidden,false);
  app.get('services').children.find(e=>e.attributes['data-service']==='events').onclick();
  assert.equal(app.get('discover-view').hidden,false);
});
test('Il collegamento agli eventi di oggi rimuove filtri precedenti e seleziona la data corretta',()=>{
  const app=run(new Map(),'home');app.get('search').value='inesistente';app.get('source').value='Veronafiere';
  app.get('home-today').onclick();
  assert.equal(app.get('search').value,'');assert.equal(app.get('source').value,'');
  assert.equal(app.get('calendar-view').hidden,false);
  assert.equal(new Script('selected').runInContext(app.context),'2026-10-17');
  assert.ok(app.get('events').children.length>0);
});
test('Scopri salva nel calendario, non ripropone la stessa serie e annulla senza perdere scelte precedenti',()=>{
  const app=run();
  const current=new Script('currentDiscovery').runInContext(app.context);
  assert.ok(current.sourceUrl); // La selezione iniziale comprende anche gli eventi non revisionati manualmente.
  app.get('like').onclick();
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[current.id],'interested');
  assert.equal(new Script('discoveryEvents().some(e=>e.sourceUrl===lastChoice.url)').runInContext(app.context),false);
  app.get('saved').onclick();
  assert.equal(app.get('calendar-view').hidden,false);
  assert.ok(app.get('events').children.some(c=>c.children.some(n=>n.textContent===current.title)));
  app.get('discover').onclick();app.get('undo').onclick();
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[current.id],undefined);
  assert.equal(new Script('currentDiscovery.id').runInContext(app.context),current.id);
});
test('Scarto persistente, annullamento e fine selezione recuperabile',()=>{
  const app=run();const url=new Script('currentDiscovery.sourceUrl').runInContext(app.context);
  app.get('skip').onclick();
  const reloaded=run(app.storage);
  assert.equal(new Script('discoveryEvents()').runInContext(reloaded.context).some(e=>e.sourceUrl===url),false);
  app.get('undo').onclick();assert.equal(JSON.parse(app.storage.get('verona-dismissed-v1'))[url],undefined);
  app.get('search').value='nessun-risultato-123';app.get('search').oninput();
  assert.equal(app.get('like').disabled,true);assert.equal(app.get('skip').disabled,true);
  app.get('deck').children[0].children.at(-1).onclick();
  assert.equal(app.get('collection').value,'all');assert.ok(app.get('deck').children[0].children.length>0);
});
test('Gesti: scorrimento verticale e cancellazione non salvano, swipe orizzontale salva',()=>{
  const app=run();let card=app.get('deck').children[0];
  const id=new Script('currentDiscovery.id').runInContext(app.context);
  const pointer=(x,y)=>({clientX:x,clientY:y,pointerId:1,isPrimary:true,button:0,target:{closest:()=>null}});
  card.listeners.pointerdown(pointer(100,100));card.listeners.pointermove(pointer(103,160));card.listeners.pointerup(pointer(104,180));
  assert.equal(app.storage.get('verona-events-v1'),undefined);
  card.listeners.pointerdown(pointer(100,100));card.listeners.pointermove(pointer(180,105));card.listeners.pointercancel();
  assert.equal(card.style.transform,'');assert.equal(app.storage.get('verona-events-v1'),undefined);
  card.listeners.pointerdown(pointer(100,100));card.listeners.pointermove(pointer(200,105));card.listeners.pointerup(pointer(200,105));
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[id],'interested');
});
test('Dettagli accessibili con salvataggio e filtri con date future',()=>{
  const app=run();new Script('openDetails(currentDiscovery)').runInContext(app.context);
  assert.equal(app.get('detail-dialog').open,true);
  assert.ok(app.get('detail-content').children.some(n=>n.id==='detail-title'));
  const save=app.get('detail-content').children.find(n=>n.className==='dialog-save');save.onclick();
  assert.equal(app.get('detail-dialog').open,false);assert.match(app.get('discovery-feedback').textContent,/aggiunto/);
  app.get('collection').value='local';app.get('collection').onchange();
  app.get('source').value='Veronafiere';app.get('source').onchange();
  assert.equal(new Script('discoveryEvents().length').runInContext(app.context),0);
  app.get('collection').value='all';app.get('collection').onchange();
  const all=new Script('discoveryEvents()').runInContext(app.context);
  assert.ok(all.length>0);assert.ok(all.every(e=>e.source==='Veronafiere'));
});
test('I filtri si aprono in un pannello e si possono applicare e azzerare senza cambiare vista',()=>{
  const app=run();app.get('open-filters').onclick();
  assert.equal(app.get('filters-dialog').open,true);
  app.get('search').value='Hostaria';app.get('search').oninput();
  assert.equal(app.get('filter-dot').hidden,true);
  app.get('apply-filters').onclick();assert.equal(app.get('filters-dialog').open,false);
  assert.match(new Script('currentDiscovery.title').runInContext(app.context),/Hostaria/);
  app.get('open-filters').onclick();app.get('reset-filters').onclick();
  assert.equal(app.get('search').value,'');assert.equal(app.get('filter-dot').hidden,false);
  assert.equal(app.get('filters-dialog').open,true);
  app.get('close-filters').onclick();assert.equal(app.get('filters-dialog').open,false);assert.equal(app.get('search').value,'Hostaria');
  app.get('all').onclick();assert.equal(app.get('page-title').textContent,'Il calendario');
  app.get('open-info').onclick();assert.equal(app.get('info-dialog').open,true);
  app.get('close-info').onclick();assert.equal(app.get('info-dialog').open,false);
});
test('Un evento salvato compare nel calendario personale e rimane dopo il ricaricamento',()=>{
  const app=run();
  new Script('selected="2026-10-17";month="2026-10";render()').runInContext(app.context);
  const card=app.get('events').children.find(c=>c.children.some(n=>n.textContent==='Bridal Week - La Fiera degli sposi'));
  assert.ok(card);
  const actions=card.children.at(-1);
  actions.children[0].onclick();
  app.get('saved').onclick();
  assert.equal(app.get('events').children.length,1);
  app.get('events').children[0].children.at(-1).children[1].onclick();
  app.get('detail-content').children.find(b=>b.className==='dialog-save event-presence').onclick();
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[catalog.events[0].id],'going');
  const reloaded=run(app.storage);
  new Script('selected="2026-10-17";month="2026-10";onlySaved=true;render()').runInContext(reloaded.context);
  assert.equal(reloaded.get('events').children.length,1);
  reloaded.get('events').children[0].children.at(-1).children[1].onclick();
  reloaded.get('detail-content').children.find(b=>b.className==='dialog-save event-remove').onclick();
  assert.match(reloaded.get('events').children[0].children[0].textContent,/Non hai eventi salvati/);
});
test('Navigazione dicembre-gennaio e sovrapposizione eventi di più giorni',()=>{
  const {context}=run();
  assert.equal(new Script('shiftMonth("2026-12",1)').runInContext(context),'2027-01');
  assert.equal(new Script('shiftMonth("2027-01",-1)').runInContext(context),'2026-12');
  assert.equal(new Script('occursOn({startsAt:"2026-10-17",endsAt:"2026-10-18"},"2026-10-18")').runInContext(context),true);
  assert.equal(new Script('occursOn({startsAt:"2026-10-17",endsAt:"2026-10-18"},"2026-10-19")').runInContext(context),false);
});

test('Agenda settimanale: conteggi reali, cambio anno e navigazione da tastiera',()=>{
  const app=run();app.get('all').onclick();
  new Script('selectAgendaDay("2026-10-18")').runInContext(app.context);
  assert.equal(app.get('week-grid').children.length,7);
  const sunday=app.get('week-grid').children[6];
  assert.equal(sunday.getAttribute('data-day'),'2026-10-18');
  assert.match(sunday.getAttribute('aria-label'),/12 eventi/);
  assert.equal(app.get('events').children.length,12);
  sunday.listeners.keydown({key:'ArrowRight',preventDefault(){}});
  assert.equal(new Script('selected').runInContext(app.context),'2026-10-19');
  new Script('selectAgendaDay("2026-12-29")').runInContext(app.context);
  app.get('week-next').onclick();assert.equal(new Script('selected').runInContext(app.context),'2027-01-05');
  app.get('week-prev').onclick();assert.equal(new Script('selected').runInContext(app.context),'2026-12-29');
  assert.equal(new Script('shiftDay("2026-10-25",1)').runInContext(app.context),'2026-10-26');
});

test('Il mese si sfoglia senza cambiare agenda: annullamento, tastiera e scelta esplicita',()=>{
  const app=run();app.get('all').onclick();app.get('open-month').onclick();
  assert.equal(app.get('month-dialog').open,true);
  app.get('next').onclick();assert.equal(new Script('month').runInContext(app.context),'2026-11');
  assert.equal(new Script('selected').runInContext(app.context),'2026-10-17');
  app.get('close-month').onclick();assert.equal(new Script('month').runInContext(app.context),'2026-10');
  app.get('open-month').onclick();
  app.get('grid').children.find(b=>b.getAttribute('data-day')==='2026-10-31').listeners.keydown({key:'ArrowRight',preventDefault(){}});
  assert.equal(new Script('month').runInContext(app.context),'2026-11');
  assert.equal(new Script('selected').runInContext(app.context),'2026-10-17');
  app.get('grid').children.find(b=>b.getAttribute('data-day')==='2026-11-01').onclick();
  assert.equal(new Script('selected').runInContext(app.context),'2026-11-01');assert.equal(app.get('month-dialog').open,false);
});

test('Le due azioni della scheda mantengono la presenza e permettono di gestirla nei dettagli',()=>{
  const app=run();app.get('all').onclick();
  const card=app.get('events').children.find(c=>c.className==='event-card');
  assert.equal(card.children.at(-1).children.length,2);
  card.children.at(-1).children[0].onclick();
  app.get('events').children[0].children.at(-1).children[1].onclick();
  app.get('detail-content').children.find(b=>b.className==='dialog-save event-presence').onclick();
  const id=Object.keys(JSON.parse(app.storage.get('verona-events-v1')))[0];
  app.get('events').children[0].children.at(-1).children[0].onclick();
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[id],'going');
  app.get('detail-content').children.find(b=>b.className==='dialog-save event-presence').onclick();
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[id],'interested');
});

test('Il ritorno dalla mappa recupera salvati, data, filtri e posizione della lista',()=>{
  const app=run();new Script('save(events[0].id,"going");setView("saved");selectAgendaDay("2026-10-18")').runInContext(app.context);
  app.get('search').value='Bridal';app.get('source').value='Veronafiere';app.get('events').scrollTop=120;
  app.get('calendar-event-map').onclick();
  app.get('event-map-date').value='2026-10-20';app.get('event-map-date').onchange();
  app.get('event-map-back').onclick();
  assert.equal(new Script('view').runInContext(app.context),'saved');assert.equal(new Script('onlySaved').runInContext(app.context),true);
  assert.equal(new Script('selected').runInContext(app.context),'2026-10-18');
  assert.equal(app.get('search').value,'Bridal');assert.equal(app.get('source').value,'Veronafiere');assert.equal(app.get('events').scrollTop,120);
  app.get('all').onclick();app.get('saved').onclick();assert.equal(new Script('selected').runInContext(app.context),'2026-10-18');
});

test('Filtri agenda: bozza annullabile, campi pertinenti e recupero dello stato vuoto',()=>{
  const app=run();app.get('all').onclick();const count=app.get('events').children.length;
  app.get('open-filters').onclick();assert.equal(app.get('event-period-field').hidden,true);
  app.get('search').value='nessun-risultato-123';app.get('search').oninput();
  assert.equal(app.get('events').children.length,count);
  app.get('filters-dialog').close();assert.equal(app.get('search').value,'');
  app.get('open-filters').onclick();app.get('search').value='nessun-risultato-123';app.get('apply-filters').onclick();
  assert.equal(app.get('agenda-filters').children.length,1);
  const empty=app.get('events').children[0];assert.equal(empty.className,'agenda-empty');
  empty.children.find(b=>b.textContent==='Rimuovi ricerca e filtri').onclick();
  assert.equal(app.get('events').children.length,count);assert.equal(app.get('agenda-filters').hidden,true);
});

test('Il primo accesso ai salvati conserva gli eventi di oggi fino alla mezzanotte e le date senza orario',()=>{
  const app=run();
  new Script(`events.push({id:'ended',title:'Finito',startsAt:'2026-10-17T06:00:00Z',endsAt:'2026-10-17T07:00:00Z',source:'Comune di Verona'},{id:'tomorrow',title:'Domani',startsAt:'2026-10-18',endsAt:'2026-10-18',source:'Comune di Verona'});preferences={ended:'going',tomorrow:'interested'};setView('saved')`).runInContext(app.context);
  assert.equal(new Script('selected').runInContext(app.context),'2026-10-17');
  assert.equal(new Script('agendaTime(events.find(e=>e.id==="tomorrow"))').runInContext(app.context),'Orario non indicato');
  assert.equal(new Script('agendaTime({startsAt:"2026-10-16",endsAt:"2026-10-20"})').runInContext(app.context),'In corso · fino al 20 ott');
});

test('Le informazioni distinguono raccolta riuscita e tentativi falliti senza nascondere i dati conservati',()=>{
  const app=run();
  new Script(`payload.importReport={checkedAt:'2026-10-17T08:30:00Z',sources:[{source:'Comune di Verona',status:'error',lastSuccessAt:'2026-10-16T07:00:00Z'},{source:'Veronafiere',status:'ok',lastSuccessAt:'2026-10-17T08:30:00Z'}]};setView('calendar')`).runInContext(app.context);
  assert.equal(app.get('event-update-warning').hidden,false);
  assert.match(app.get('event-source-status').children[0].textContent,/16 ott 2026/);
  assert.match(app.get('event-source-status').children[0].textContent,/dati precedenti conservati/);
  assert.match(app.get('event-source-status').children[1].textContent,/17 ott 2026/);
  assert.ok(app.get('events').children.some(c=>c.className==='event-card'));
  new Script(`payload.importReport={sources:[{source:'Comune di Verona',status:'ok',lastSuccessAt:'2026-10-17T08:30:00Z'}]};payload.updatedAt='2026-10-14T08:30:00Z';render()`).runInContext(app.context);
  assert.match(app.get('event-update-warning').textContent,/oltre due giorni/);
});
test('Il file distribuibile incorpora il catalogo e non dipende dal percorso delle API',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const embedded=JSON.parse(html.match(/<script id="event-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(embedded.events.length,liveCatalog.events.length);
  assert.ok(!html.includes('__EVENT_DATA__'));
  assert.equal(embedded.busRoutes.assetBase,'bus-routes/');assert.ok(embedded.busRoutes.routes.every(route=>!route.stops&&!route.segments));const routeAsset=JSON.parse(await readFile(new URL('../public/bus-routes/atv-urban-12.json',import.meta.url),'utf8'));assert.ok(routeAsset.routes.every(route=>route.stops.length>1&&route.segments.length>0));
});

const officialLogic=await readFile(new URL('../public/bus-official.js',import.meta.url),'utf8');
const official24=JSON.parse(await readFile(new URL('../data/bus-official/24.json',import.meta.url),'utf8'));
function runOfficial(){const app=run(new Map(),'home');new Script(officialLogic).runInContext(app.context);app.context.fetch=async()=>({ok:true,json:async()=>structuredClone(official24)});return app;}
test('Archivio ufficiale: 40 passaggi a Santini, calendario sabato e domenica, scadenza distinta da assenza',async()=>{
  const app=runOfficial();await new Script('openOfficialBus("24");loadOfficialLine("24",{stopCode:"1974"})').runInContext(app.context);
  app.get('official-date').value='2026-10-19';app.get('official-date').onchange();
  assert.equal(app.get('official-results').children.length,40);assert.match(app.get('official-summary').textContent,/40 partenze/);
  assert.equal(new Script('officialBusData.trips.filter(t=>t.dates.includes("2026-10-19")).length').runInContext(app.context),87);
  assert.equal(new Script('officialBusData.trips.filter(t=>t.dates.includes("2026-10-24")).length').runInContext(app.context),59);
  app.get('official-date').value='2026-10-25';app.get('official-date').onchange();assert.match(app.get('official-results').children[0].textContent,/Nessuna partenza/);
  app.get('official-date').value='2026-11-18';app.get('official-date').onchange();assert.equal(app.get('official-results').children.length,0);assert.match(app.get('official-summary').textContent,/fuori dalla validità/);
});
test('Archivio ufficiale: tutte le 141 linee, accesso dalla scheda e dalla mappa con codice fermata',async()=>{
  const app=runOfficial();assert.equal(app.get('bus-official-all').hidden,false);
  new Script('openTimetable(busData.lines.find(l=>l.number==="24"))').runInContext(app.context);
  assert.equal(app.get('official-bus-dialog').open,true);assert.equal(app.get('official-line').children.length,141);
  const box=new Script('busRouteLine=busData.lines.find(l=>l.number==="24");busRouteStopContent({stops:[]},{name:"Via Santini",ref:"1974",lat:45.46,lon:10.98})').runInContext(app.context);
  box.children.find(c=>c.textContent==='Orari ufficiali di questa fermata').onclick();
  await new Script('loadOfficialLine("24",{stopCode:"1974"})').runInContext(app.context);
  assert.equal(app.get('official-stop').value,'1974');
  await new Script('loadOfficialLine("24",{stopCode:"unknown"})').runInContext(app.context);
  assert.equal(app.get('official-stop').value,'');assert.match(app.get('official-summary').textContent,/non è presente/);
});
test('Archivio ufficiale: caricamento fallito recuperabile e risposta tardiva ignorata dopo la chiusura',async()=>{
  const app=runOfficial();app.get('official-bus-dialog').showModal();app.context.fetch=async()=>({ok:false});
  await new Script('loadOfficialLine("24")').runInContext(app.context);assert.match(app.get('official-summary').textContent,/Impossibile/);assert.equal(app.get('official-results').children[0].textContent,'Riprova');
  let resolve;app.context.fetch=()=>new Promise(r=>resolve=r);const pending=new Script('loadOfficialLine("24")').runInContext(app.context);
  app.get('close-official-bus').onclick();resolve({ok:true,json:async()=>structuredClone(official24)});await pending;
  assert.equal(app.get('official-bus-dialog').open,false);assert.equal(new Script('officialBusData').runInContext(app.context),null);
});
test('Archivio ufficiale: terminali di sola discesa esclusi e passaggi del giorno successivo conservati',()=>{
  const app=runOfficial();app.context.sample={validFrom:'2026-10-19',validTo:'2026-10-20',trips:[{id:'T',dates:['2026-10-19'],destination:'B',calls:[['A','23:55:00',0,true],['A','00:15:00',1,true],['B','00:30:00',1,false]]}]};
  const rows=new Script('officialDepartures(sample,"2026-10-19","A")').runInContext(app.context);assert.equal(rows.length,2);assert.equal(rows[1].offset,1);assert.equal(rows[1].minutes,1455);
  assert.equal(new Script('officialDepartures(sample,"2026-10-19","B").length').runInContext(app.context),0);
});

test('Scopri: la selezione iniziale include il catalogo reale, senza richiedere una revisione manuale',()=>{
  const app=run(new Map(),'home');const base=structuredClone(liveCatalog.events[0]);app.context.liveEvents=[{...base,id:'default-unchecked',sourceUrl:'https://www.comune.verona.it/evento-a',startsAt:'2026-10-17',endsAt:'2026-10-18',localVerified:false},{...base,id:'default-checked',sourceUrl:'https://www.comune.verona.it/evento-b',startsAt:'2026-10-17',endsAt:'2026-10-18',localVerified:true}];
  new Script('events.splice(0,events.length,...liveEvents);setView("discover")').runInContext(app.context);
  const queue=new Script('discoveryEvents()').runInContext(app.context);
  assert.equal(queue.length,2);assert.ok(queue.some(event=>!event.localVerified));
  assert.equal(new Set(queue.map(event=>event.sourceUrl)).size,queue.length);
  app.get('collection').value='local';app.get('collection').onchange();assert.ok(new Script('discoveryEvents().length').runInContext(app.context)<queue.length);
  app.get('reset-filters').onclick();assert.equal(app.get('collection').value,'all');
});
test('Scopri: rivedere gli eventi passati conserva i salvati e persiste dopo il ricaricamento',()=>{
  const app=run();const saved=new Script('currentDiscovery.id').runInContext(app.context);app.get('like').onclick();
  const passed=[];let count=0;
  while(!app.get('skip').disabled&&count++<100){passed.push(new Script('currentDiscovery.sourceUrl').runInContext(app.context));app.get('skip').onclick();}
  assert.ok(passed.length);assert.equal(app.get('skip').disabled,true);
  app.get('deck').children[0].children.find(child=>child.textContent==='Rivedi gli eventi saltati').onclick();
  assert.ok(!app.get('skip').disabled);assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[saved],'interested');
  assert.deepEqual(JSON.parse(app.storage.get('verona-dismissed-v1')),{});
  const reloaded=run(app.storage);assert.equal(new Script('discoveryEvents().some(e=>e.id==="'+saved+'")').runInContext(reloaded.context),false);
  assert.ok(new Script('discoveryEvents()').runInContext(reloaded.context).some(e=>passed.includes(e.sourceUrl)));
});

function useRomeInstant(app,instant){const NativeDate=Date;app.context.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return NativeDate.parse(instant);}};new Script('refreshSavedDay()').runInContext(app.context);}
test('Salvati: un evento che termina il 22 rimane prossimo tutto il 22 e passa nei passati alla mezzanotte di Verona',()=>{
  const app=run(new Map(),'home');const base=structuredClone(catalog.events[0]);
  app.context.historyFixture={...base,id:'history-multi',title:'Evento dal 19 al 22',startsAt:'2026-10-19',endsAt:'2026-10-22'};
  new Script('events.push(historyFixture);save(historyFixture.id,"going");setView("saved")').runInContext(app.context);
  useRomeInstant(app,'2026-10-22T21:59:59Z');assert.equal(new Script('visibleEvents().some(e=>e.id==="history-multi")').runInContext(app.context),true);
  useRomeInstant(app,'2026-10-22T22:00:00Z');assert.equal(new Script('today').runInContext(app.context),'2026-10-23');assert.equal(new Script('visibleEvents().some(e=>e.id==="history-multi")').runInContext(app.context),false);
  app.get('saved-past').onclick();assert.equal(new Script('visibleEvents().some(e=>e.id==="history-multi")').runInContext(app.context),true);
  assert.equal(app.get('agenda-picker').hidden,true);assert.ok(app.get('events').children.some(card=>card.children.some(c=>c.textContent==='Evento dal 19 al 22')));
  app.get('saved-upcoming').onclick();assert.equal(app.get('agenda-picker').hidden,false);
});
test('Salvati: storico persistente dopo la rimozione dal catalogo e rimozione esplicita dal dispositivo',()=>{
  const app=run(new Map(),'home');const event=structuredClone(catalog.events[0]);event.id='removed-history';event.title='Evento non più nel catalogo';event.startsAt='2026-10-10';event.endsAt='2026-10-12';app.context.archived=event;
  new Script('events.push(archived);save(archived.id,"interested")').runInContext(app.context);
  const reloaded=run(app.storage,'home');new Script('setView("saved")').runInContext(reloaded.context);reloaded.get('saved-past').onclick();
  assert.equal(new Script('events.some(e=>e.id==="removed-history")').runInContext(reloaded.context),false);
  assert.equal(new Script('visibleEvents().some(e=>e.id==="removed-history")').runInContext(reloaded.context),true);
  new Script('openDetails(savedEvents().find(e=>e.id==="removed-history"))').runInContext(reloaded.context);assert.ok(reloaded.get('detail-content').children.some(c=>c.textContent==='Rimuovi dai salvati'));
  new Script('save("removed-history",null)').runInContext(reloaded.context);
  assert.equal(JSON.parse(reloaded.storage.get('verona-saved-snapshots-v1'))['removed-history'],undefined);
});
test('Salvati: un evento futuro non scade il giorno dopo il salvataggio e le conferme non cambiano',()=>{
  const app=run(new Map(),'home');app.context.futureSaved={...structuredClone(catalog.events[0]),id:'future-saved',startsAt:'2026-10-25',endsAt:'2026-10-25'};
  new Script('events.push(futureSaved);save(futureSaved.id,"going");setView("saved")').runInContext(app.context);useRomeInstant(app,'2026-10-20T12:00:00Z');
  assert.equal(new Script('visibleEvents().some(e=>e.id==="future-saved")').runInContext(app.context),true);assert.equal(JSON.parse(app.storage.get('verona-events-v1'))['future-saved'],'going');
});

test('Lo spostamento notturno segue la mezzanotte di Verona anche nei giorni da 23 e 25 ore',()=>{
  const app=run(new Map(),'home');
  for(const [instant,hours]of [['2026-10-24T22:00:00Z',25],['2026-03-28T23:00:00Z',23]]){
    useRomeInstant(app,instant);new Script('scheduleSavedMidnight()').runInContext(app.context);
    const timer=new Script('savedMidnightTimer').runInContext(app.context);assert.equal(app.timers.get(timer).ms,hours*3600000+50);
  }
});

const eventBusLogic=await readFile(new URL('../public/event-bus.js',import.meta.url),'utf8');
const parkingLogic=await readFile(new URL('../public/parking.js',import.meta.url),'utf8');
function runParking(mapApi){const app=runEventBus();if(mapApi)app.context.L=mapApi;new Script(parkingLogic).runInContext(app.context);app.context.parkingFixture={...structuredClone(catalog.events[0]),title:'Evento in Arena',coordinates:{lat:45.4386,lon:10.9929},mapDisabled:false};return app;}

test('Servizi utili: parcheggi senza evento, filtro e ritorno alla ricerca vicina all’evento',()=>{
  const app=runParking();app.get('services').children.find(e=>e.attributes['data-service']==='utilities').onclick();app.get('utilities-parking').onclick();
  assert.equal(app.get('parking-dialog').open,true);assert.equal(app.get('parking-distance-control').hidden,true);assert.equal(new Script('parkingEvent').runInContext(app.context),null);
  const cards=app.get('parking-results').children.filter(card=>card.className==='parking-card');assert.equal(cards.length,catalog.parking.items.length);assert.ok(cards.length>0);assert.ok(cards.every(card=>!card.children[1].textContent.includes('evento')));assert.ok(cards.every(card=>!card.children.at(-1).children.some(link=>link.href?.includes('travelmode=walking'))));
  app.get('parking-type').value='free';app.get('parking-type').onchange();assert.ok(app.get('parking-results').children.filter(card=>card.className==='parking-card').every(card=>/Gratuito secondo/.test(card.children[1].textContent)));app.get('parking-close').onclick();assert.equal(app.get('utilities-dialog').open,true);
  new Script('openEventParking(parkingFixture)').runInContext(app.context);assert.equal(app.get('parking-distance-control').hidden,false);assert.match(app.get('parking-count').textContent,/distanze/);
});
test('Parcheggi evento: ordinamento reale, filtri, percorsi distinti e ritorno senza perdere i salvati',()=>{
  const app=runParking();new Script('openDetails(parkingFixture);openEventParking(parkingFixture)').runInContext(app.context);
  assert.equal(app.get('parking-dialog').open,true);assert.equal(app.get('detail-dialog').open,true);
  const rows=new Script('nearbyParking(parkingFixture)').runInContext(app.context);assert.ok(rows.length>0);assert.ok(rows.every((row,i)=>!i||row.distance>=rows[i-1].distance));assert.ok(rows.every(row=>row.distance<=1500));
  const first=app.get('parking-results').children[0],links=first.children.at(-1).children;assert.match(links[0].href,/travelmode=driving/);assert.match(links[1].href,/travelmode=walking&origin=/);assert.match(links[1].href,/destination=45.4386,10.9929/);
  app.get('parking-type').value='free';app.get('parking-type').onchange();const cards=app.get('parking-results').children.filter(card=>card.className==='parking-card');assert.ok(cards.length);assert.ok(cards.every(card=>/Gratuito secondo/.test(card.children[1].textContent)));
  const storage=JSON.stringify([...app.storage]);app.get('parking-close').onclick();assert.equal(app.get('parking-dialog').open,false);assert.equal(app.get('detail-dialog').open,true);assert.equal(JSON.stringify([...app.storage]),storage);
});
test('Parcheggi: sede ambigua, provincia senza risultati e sfondo non disponibile restano recuperabili',()=>{
  const app=runParking();new Script('openDetails({...parkingFixture,mapDisabled:true})').runInContext(app.context);const section=app.get('detail-content').children.find(section=>section.children?.[0]?.textContent==='Dove parcheggiare');assert.match(section.children[1].textContent,/non è abbastanza precisa/);
  new Script('openEventParking({...parkingFixture,coordinates:{lat:45.8,lon:11.3}})').runInContext(app.context);assert.match(app.get('parking-count').textContent,/0 parcheggi/);app.get('parking-results').children[1].onclick();assert.equal(app.get('parking-radius').value,'3000');assert.match(app.get('parking-results').children[0].textContent,/non tutta la provincia/);assert.match(app.get('parking-map-note').textContent,/elenco e le indicazioni/);
});
test('Mappa parcheggi: evento distinto, selezione dalla scheda e pulizia alla chiusura',()=>{
  let removed=0;const pins=[],fits=[],map={setView(){return this},invalidateSize(){},fitBounds(value){fits.push(value)},remove(){removed++}};
  const L={map(){return map},tileLayer(){return {on(){return this},addTo(){return this}}},layerGroup(){return {clearLayers(){pins.length=0},addTo(){return this}}},circleMarker(point,options){const pin={point,options,bindPopup(value){this.popup=value;return this},addTo(){pins.push(this);return this}};return pin}};
  const app=runParking(L);new Script('openEventParking(parkingFixture)').runInContext(app.context);assert.equal(pins[0].options.fillColor,'#254f78');assert.ok(pins.length>1);app.get('parking-results').children[0].children[0].onclick();assert.equal(pins.filter(pin=>pin.options.radius===12).length,2);assert.equal(fits.at(-1).length,2);app.get('parking-dialog').close();assert.equal(removed,1);
});
const eventBusIndexData=JSON.parse(await readFile(new URL('../public/bus-official/stops.json',import.meta.url),'utf8'));
function runEventBus(){const app=runOfficial();new Script(eventBusLogic).runInContext(app.context);app.context.fetch=async url=>({ok:true,json:async()=>structuredClone(String(url).endsWith('/stops.json')?eventBusIndexData:official24)});return app;}

const busCatalogLogic=await readFile(new URL('../public/bus-catalog.js',import.meta.url),'utf8');
function runBusCatalog(){const app=runEventBus();new Script(busCatalogLogic+'\nview="bus"').runInContext(app.context);return app;}
test('Rete e vista sono indipendenti: Fermate segue la rete e mantiene la ricerca',async()=>{
  const app=runBusCatalog();app.get('bus-extraurban').onclick();app.get('bus-search').value='San Bonifacio';
  app.get('bus-stops').onclick();await new Script('renderBus()').runInContext(app.context);
  assert.equal(new Script('busMode').runInContext(app.context),'stops');assert.equal(app.get('bus-search').value,'San Bonifacio');
  assert.equal(app.get('bus-stops').attributes['aria-pressed'],'true');assert.equal(app.get('bus-extraurban').attributes['aria-pressed'],'true');
  assert.ok(!app.get('bus-list').children.some(child=>child.className==='bus-card bus-catalog-card'));
  const results=app.get('bus-list').children.at(-1);assert.ok(results.children.some(child=>child.className==='bus-search-stop'));
  app.get('bus-scope-urban').onclick();await new Script('renderBus()').runInContext(app.context);
  assert.equal(new Script('busMode').runInContext(app.context),'stops');assert.match(app.get('bus-count').textContent,/0 fermate/);
  app.get('bus-scope-all').onclick();assert.equal(app.get('bus-scope-all').attributes['aria-pressed'],'true');
});
test('Avvisi per rete: conserva i generali, esclude le altre reti e mantiene i preferiti condivisi',()=>{
  const app=runBusCatalog();app.get('bus-extraurban').onclick();
  assert.equal(new Script('busAlertMatchesNetwork({lines:["130"]})').runInContext(app.context),true);
  assert.equal(new Script('busAlertMatchesNetwork({lines:["24"]})').runInContext(app.context),false);
  assert.equal(new Script('busAlertMatchesNetwork({lines:[]})').runInContext(app.context),true);
  new Script('busCatalogStar(busCatalogLines().find(line=>line.number==="130")).onclick()').runInContext(app.context);
  app.get('bus-favorites').onclick();assert.match(app.get('bus-count').textContent,/1 linea/);
  app.get('bus-scope-urban').onclick();assert.match(app.get('bus-list').children[0].children[0].textContent,/Nessuna linea/);
  assert.ok(JSON.parse(app.storage.get('verona-bus-v1'))['official-130']);
  app.get('bus-scope-all').onclick();assert.match(app.get('bus-count').textContent,/1 linea/);
});
test('Mappa della rete: nessuna urbana nelle extraurbane e selezione recuperata tornando a Tutte',async()=>{
  const app=runBusCatalog(),logic=await readFile(new URL('../public/bus-network.js',import.meta.url),'utf8');new Script(logic).runInContext(app.context);
  app.storage.set('verona-bus-network-v1',JSON.stringify(['11','24']));app.get('bus-extraurban').onclick();
  await new Script('openBusNetwork({compare:true})').runInContext(app.context);assert.equal(new Script('networkAvailableLines().length').runInContext(app.context),0);assert.equal(app.get('network-add-line').disabled,true);
  assert.deepEqual(JSON.parse(app.storage.get('verona-bus-network-v1')),['11','24']);
  app.get('close-bus-network').onclick();app.get('bus-scope-all').onclick();await new Script('openBusNetwork({compare:true})').runInContext(app.context);
  assert.equal(new Script('busNetworkLines.join(",")').runInContext(app.context),'11,24');
});
test('Extraurbane: filtro verificato su ATV, urbane escluse e ripristino del catalogo completo',async()=>{
  const app=runBusCatalog();app.get('bus-extraurban').onclick();assert.match(app.get('bus-count').textContent,/73 linee · Extraurbane/);
  const numbers=new Script('busCatalogLines().filter(line=>busLineCategory(line)==="extraurban").map(line=>line.number)').runInContext(app.context);
  assert.ok(numbers.includes('130')&&numbers.includes('484')&&numbers.includes('X02'));assert.ok(!numbers.includes('11')&&!numbers.includes('24')&&!numbers.includes('SC01'));
  app.get('bus-network-scope').value='urban';app.get('bus-network-scope').onchange();assert.match(app.get('bus-count').textContent,/38 linee · Urbane/);
  app.get('bus-filter-reset').onclick();assert.match(app.get('bus-count').textContent,/141 linee/);
});
test('Extraurbane: ricerca destinazione e orari interni della 130 dal file ufficiale',async()=>{
  const app=runBusCatalog();app.get('bus-extraurban').onclick();app.get('bus-search').value='San Bonifacio';await new Script('renderBus()').runInContext(app.context);
  assert.ok(app.get('bus-list').children.some(card=>card.children.some(child=>child.attributes['aria-label']==='Orari linea 130, VERONA - SAN BONIFACIO')));
  const data=JSON.parse(await readFile(new URL('../data/bus-official/130.json',import.meta.url),'utf8'));
  const trip=data.trips.find(trip=>trip.dates.includes('2026-10-21')&&trip.calls.some(call=>call[3]));assert.ok(trip);
  app.context.fetch=async()=>({ok:true,json:async()=>structuredClone(data)});app.context.extraStop=trip.calls.find(call=>call[3])[0];
  await new Script('openOfficialBus("130");loadOfficialLine("130",{stopCode:extraStop,date:"2026-10-21"})').runInContext(app.context);
  assert.equal(app.get('official-stop').value,app.context.extraStop);assert.ok(app.get('official-results').children.length>0);assert.match(app.get('official-summary').textContent,/partenze/);
});
test('Catalogo unico: include le linee senza scheda, ricerca fermata 1974 e apertura senza ricompilare il codice',async()=>{
  const app=runBusCatalog();await new Script('renderBus()').runInContext(app.context);
  assert.match(app.get('bus-count').textContent,/141 linee/);
  app.get('bus-search').value='1974';await new Script('renderBus()').runInContext(app.context);
  assert.match(app.get('bus-count').textContent,/0 linee · 1 fermata/);
  const results=app.get('bus-list').children.at(-1),stopButton=results.children[0];assert.equal(stopButton.children[0].textContent,'VIA SANTINI B');
  stopButton.onclick();assert.equal(app.get('bus-stop-dialog').open,true);assert.equal(app.get('bus-stop-shared').stopUi.buttons.size,2);
  await app.get('bus-stop-shared').stopUi.buttons.get('24').onclick();app.get('bus-stop-shared').stopUi.day.onclick();
  await new Script('loadOfficialLine("24",{stopCode:"1974",date:"2026-10-21"})').runInContext(app.context);
  assert.equal(app.get('official-stop').value,'1974');assert.match(app.get('official-summary').textContent,/40 partenze/);
});
test('Catalogo: preferiti delle linee senza scheda persistono e gli avvisi ne riconoscono il numero',async()=>{
  const app=runBusCatalog();const line=new Script('busCatalogLines().find(line=>!line.sheets.length)').runInContext(app.context);assert.ok(line);
  app.context.onlyOfficial=line;new Script('busCatalogStar(onlyOfficial).onclick()').runInContext(app.context);
  assert.ok(JSON.parse(app.storage.get('verona-bus-v1'))['official-'+line.number]);
  assert.equal(new Script('busFavoriteNumbers().has(onlyOfficial.number)').runInContext(app.context),true);
  await new Script('busMode="favorites";renderBus()').runInContext(app.context);assert.match(app.get('bus-count').textContent,/1 linea/);
  new Script('busCatalogStar(onlyOfficial).onclick()').runInContext(app.context);assert.match(app.get('bus-list').children[0].children[0].textContent,/Nessuna linea/);
});
test('Ricerca fermate: errore recuperabile e risposta tardiva non sovrascrive una ricerca successiva',async()=>{
  const app=runBusCatalog();app.get('bus-search').value='1974';app.context.fetch=async()=>({ok:false});await new Script('renderBus()').runInContext(app.context);
  let results=app.get('bus-list').children.at(-1);assert.equal(results.children[1].textContent,'Riprova ricerca fermate');
  let resolve;app.context.fetch=()=>new Promise(r=>resolve=r);const pending=results.children[1].onclick();
  app.get('bus-search').value='';new Script('renderBus()').runInContext(app.context);const first=app.get('bus-list').children[0];
  resolve({ok:true,json:async()=>structuredClone(eventBusIndexData)});await pending;assert.equal(app.get('bus-list').children[0],first);assert.match(app.get('bus-count').textContent,/141 linee/);
});
test('Prossime partenze: filtra il passato, mantiene il servizio dopo mezzanotte e distingue una data non coperta',()=>{
  const app=runOfficial();app.context.sample={validFrom:'2026-10-18',validTo:'2026-11-17',trips:[
    {id:'yesterday',dates:['2026-10-18'],destination:'Centro',calls:[['X','00:45:00',1,true]]},
    {id:'today',dates:['2026-10-19'],destination:'Centro',calls:[['X','00:10:00',0,true],['X','01:00:00',0,true]]}
  ]};
  const rows=new Script('officialUpcomingRows(sample,"2026-10-19","X","",new Date("2026-10-18T22:30:00Z"))').runInContext(app.context);
  assert.deepEqual(Array.from(rows,row=>row.time),['00:45:00','01:00:00']);assert.equal(rows[0].offset,0);
  assert.equal(new Script('officialUpcomingRows(sample,"2026-11-18","X")').runInContext(app.context),null);
});
test('Consultatore: oggi apre sulle prossime corse, giornata completa recuperabile e destinazioni pertinenti',async()=>{
  const app=runOfficial();useRomeInstant(app,'2026-10-19T10:00:00Z');
  await new Script('openOfficialBus("24");loadOfficialLine("24",{stopCode:"1974",date:"2026-10-19"})').runInContext(app.context);
  const count=app.get('official-results').children.length;assert.ok(count>0&&count<40);assert.equal(app.get('official-next').attributes['aria-pressed'],'true');
  assert.ok(app.get('official-destination').children.length<8);
  app.get('official-day').onclick();assert.equal(app.get('official-results').children.length,40);
  app.get('official-next').onclick();assert.equal(app.get('official-results').children.length,count);
});
test('Autobus vicini: distanze, limite 800 m, tre risultati e servizio reale della 24/96 per data',()=>{
  const app=runEventBus();app.context.index=eventBusIndexData;
  const nearby=new Script('nearbyBusStops(index,index.stops.find(s=>s.code==="1974"),"2026-10-19")').runInContext(app.context);
  assert.equal(nearby[0].code,'1974');assert.equal(nearby[0].distance,0);assert.ok(nearby[0].lines.includes('24'));assert.ok(nearby.length<=3);assert.ok(nearby.every(stop=>stop.distance<=800));
  const sunday=new Script('nearbyBusStops(index,index.stops.find(s=>s.code==="1974"),"2026-10-25")').runInContext(app.context);
  assert.ok(!sunday[0].lines.includes('24'));assert.ok(sunday[0].lines.includes('96'));
  const expired=new Script('nearbyBusStops(index,index.stops.find(s=>s.code==="1974"),"2026-12-01")').runInContext(app.context);assert.equal(expired[0].knownDate,false);
  assert.equal(new Script('nearbyBusStops(index,{lat:46.2,lon:11.9},"2026-10-19").length').runInContext(app.context),0);
});
test('Evento → fermata → orari: conserva il codice e la data dell’evento, non il giorno corrente',async()=>{
  const app=runEventBus();const stop=eventBusIndexData.stops.find(s=>s.code==='1974');app.context.busEvent={...structuredClone(catalog.events[0]),id:'nearby-event',title:'Evento vicino a Santini',startsAt:'2026-10-21',endsAt:'2026-10-21',coordinates:{lat:stop.lat,lon:stop.lon},mapDisabled:false};
  new Script('openDetails(busEvent)').runInContext(app.context);assert.ok(app.get('detail-content').children.some(section=>section.className==='event-bus-entry'));
  await new Script('openEventBus(busEvent)').runInContext(app.context);assert.equal(app.get('event-bus-date').value,'2026-10-21');assert.equal(app.get('event-bus-stops').children.length,3);
  const first=app.get('event-bus-stops').children[0];first.children.find(c=>c.className==='nearby-bus-lines').children.find(c=>c.textContent==='Linea 24 · Orari').onclick();
  await new Script('loadOfficialLine("24",{stopCode:"1974",date:"2026-10-21"})').runInContext(app.context);
  assert.equal(app.get('official-date').value,'2026-10-21');assert.equal(app.get('official-stop').value,'1974');assert.match(app.get('official-summary').textContent,/40 partenze/);
});
test('Autobus vicini: posizione incerta, errore recuperabile e chiusura durante la ricerca',async()=>{
  const app=runEventBus();app.context.uncertain={...structuredClone(catalog.events[0]),mapDisabled:true};new Script('openDetails(uncertain)').runInContext(app.context);
  const section=app.get('detail-content').children.find(c=>c.className==='event-bus-entry');assert.match(section.children[1].textContent,/non è abbastanza precisa/);
  const stop=eventBusIndexData.stops[0];app.context.busEvent={...structuredClone(catalog.events[0]),coordinates:{lat:stop.lat,lon:stop.lon},mapDisabled:false};
  app.context.fetch=async()=>({ok:false});await new Script('openEventBus(busEvent)').runInContext(app.context);assert.match(app.get('event-bus-status').textContent,/temporaneamente/);assert.equal(app.get('event-bus-stops').children[0].textContent,'Riprova');
  let resolve;app.context.fetch=()=>new Promise(r=>resolve=r);const pending=new Script('renderEventBus()').runInContext(app.context);app.get('close-event-bus').onclick();resolve({ok:true,json:async()=>eventBusIndexData});await pending;assert.equal(app.get('event-bus-stops').children.length,0);
});
test('Scheda fermata: stesso accesso agli orari in mappa ed elenco, senza link tecnico o falso messaggio bloccante',()=>{
  const app=runOfficial();const box=new Script('busRouteLine=busData.lines.find(l=>l.number==="24");busRouteStopContent({stops:[]},{name:"Via Santini",ref:"1974",lat:45.46,lon:10.98})').runInContext(app.context);
  assert.ok(box.children.some(c=>c.textContent==='Orari ufficiali di questa fermata'));assert.ok(!box.children.some(c=>/OpenStreetMap|non associati/.test(c.textContent)));
  const unlinked=new Script('busRouteStopContent({stops:[]},{name:"Fermata senza codice",lat:45.46,lon:10.98})').runInContext(app.context);assert.ok(unlinked.children.some(c=>c.textContent==='Consulta orari linea 24'));assert.ok(!unlinked.children.some(c=>/non associati/.test(c.textContent)));
});

test('Popup fermata: carica automaticamente le prossime partenze senza aprire il pannello completo e con una sola richiesta per linea',async()=>{
  const app=runOfficial();useRomeInstant(app,'2026-10-19T03:35:00Z');let calls=0;app.context.fetch=async()=>{calls++;return {ok:true,json:async()=>structuredClone(official24)}};
  const boxes=new Script('busRouteLine=busData.lines.find(l=>l.number==="24");[busRouteStopContent({stops:[]},{name:"Santini B",ref:"1974",lat:45.46,lon:10.98},{preview:true}),busRouteStopContent({stops:[]},{name:"Santini A",ref:"1973",lat:45.46,lon:10.98},{preview:true})]').runInContext(app.context);
  assert.equal(calls,0);await Promise.all(boxes.map(box=>box.loadDepartures()));assert.equal(calls,1);
  const preview=boxes[0].children.find(child=>child.className==='bus-stop-preview');const rows=preview.children.filter(child=>child.className==='bus-stop-departure');assert.equal(rows.length,3);assert.equal(rows[0].children[0].children[0].textContent,'05:50');assert.match(rows[0].children[1].textContent,/PIAZZA RIGHETTI/);
  assert.ok(boxes[0].children.some(child=>child.textContent==='Tutti gli orari'));assert.notEqual(app.get('official-bus-dialog').open,true);assert.equal(new Script('officialBusData').runInContext(app.context),null);
});
test('Prossime partenze: include corse notturne del giorno di servizio precedente senza riproporre passaggi già terminati',()=>{
  const app=runOfficial();app.context.night={validFrom:'2026-10-19',validTo:'2026-10-21',trips:[{id:'N',dates:['2026-10-19'],destination:'Centro',calls:[['S','00:30:00',1,true]]},{id:'D',dates:['2026-10-20'],destination:'Stazione',calls:[['S','01:00:00',0,true],['S','00:05:00',0,true]]}]};
  const rows=new Script('nextBusStopDepartures(night,"S",new Date("2026-10-19T22:10:00Z"))').runInContext(app.context);assert.deepEqual(Array.from(rows,row=>row.time),['00:30:00','01:00:00']);assert.equal(rows[0].offset,0);
  assert.equal(new Script('nextBusStopDepartures(night,"S",new Date("2026-11-01T10:00:00Z"))').runInContext(app.context),null);
});
test('Popup fermata: rete non disponibile recuperabile, archivio scaduto e assenza di altre partenze sono stati distinti',async()=>{
  const app=runOfficial();const box=app.get('inline-test');app.context.inlineBox=box;app.context.fetch=async()=>({ok:false});
  await new Script('renderBusStopPreview(inlineBox,"24","1974")').runInContext(app.context);assert.match(box.children[0].textContent,/temporaneamente/);assert.equal(box.children[1].textContent,'Riprova');
  app.context.fetch=async()=>({ok:true,json:async()=>structuredClone(official24)});
  await new Script('renderBusStopPreview(inlineBox,"24","1974",new Date("2026-12-01T10:00:00Z"))').runInContext(app.context);assert.match(box.children[0].textContent,/scaduto/);
  await new Script('renderBusStopPreview(inlineBox,"24","1974",new Date("2026-11-17T22:59:59Z"))').runInContext(app.context);assert.ok(box.children.some(child=>/Nessun’altra partenza/.test(child.textContent)));
});

test('Mappa evento: più linee colorate, varianti associate ai codici vicini e limite di otto linee',async()=>{
  const app=runEventBus();app.context.index=eventBusIndexData;
  const groups=await new Script('loadEventRouteGroups(nearbyBusStops(index,{lat:45.434644,lon:10.977568},"2026-10-26",{limit:Infinity}))').runInContext(app.context);
  assert.ok(groups.length>1);assert.ok(groups.length<=8);assert.equal(new Set(groups.map(group=>group.color)).size,groups.length);
  const line=groups.find(group=>group.number==='62');assert.ok(line);assert.equal(line.status,'ready');assert.equal(line.routes.length,2);
  app.context.routeGroups=groups;
  new Script('eventBusRouteGroups=routeGroups;eventBusCurrent={point:{lat:45.434644,lon:10.977568},stops:[]};renderEventBusLegend()').runInContext(app.context);
  const buttons=app.get('event-bus-line-legend').children;assert.equal(buttons.length,groups.length+1);assert.equal(buttons[0].attributes['aria-pressed'],'true');
  const target=buttons.find(button=>button.attributes['aria-label']==='Mostra linea 62');target.onclick();assert.equal(new Script('eventBusSelectedLine').runInContext(app.context),'62');
});
test('Tracciati vicini: scarica solo la linea richiesta, condivide la cache e rifiuta risposte di altre linee',async()=>{
  const app=runEventBus(),calls=[];const routes=catalog.busRoutes.routes.filter(route=>route.number==='62');app.context.routes62=routes;
  new Script('busRouteData.assetBase="bus-routes/";busRouteData.routes=routes62.map(({stops,segments,...r})=>r)').runInContext(app.context);
  app.context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>({routes})}};
  await new Script('loadEventRouteLine("62")').runInContext(app.context);await new Script('loadEventRouteLine("62")').runInContext(app.context);assert.deepEqual(calls,['bus-routes/atv-urban-62.json']);
  const missing=await new Script('loadEventRouteLine("SC01")').runInContext(app.context);assert.equal(missing.length,0);assert.equal(calls.length,1);
});
test('Percorsi evento: il filtro cambia i tracciati ma mantiene il segnaposto evento in evidenza',()=>{
  const app=runEventBus(),paths=[],icons=[],pins=[],fits=[];
  const layer={addTo(){return this},clearLayers(){paths.length=0;pins.length=0;}};
  const marker=options=>({bindPopup(){return this},addTo(){pins.push(options);return this}});
  app.context.L={map:()=>({setView(){return this},invalidateSize(){},fitBounds(points){fits.push(points)}}),tileLayer:()=>({on(){return this},addTo(){}}),layerGroup:()=>layer,polyline:(segments,options)=>({bindPopup(){return this},addTo(){paths.push(options);return this}}),circleMarker:(point,options)=>marker(options),divIcon:options=>{icons.push(options);return options},marker:(point,options)=>marker(options)};
  app.context.mapGroups=[{number:'11',color:'#245f9e',routes:[{label:'A → B',segments:[[[45.43,10.98],[45.44,10.99]]],stops:[{id:'a',ref:'1',name:'A',lat:45.43,lon:10.98}]}]},{number:'62',color:'#b13c45',routes:[{label:'C → D',segments:[[[45.42,10.97],[45.44,10.99]]],stops:[{id:'b',ref:'2',name:'B',lat:45.42,lon:10.97}]}]}];
  new Script('eventBusEvent={title:"Il mio evento"};eventBusRouteGroups=mapGroups;eventBusFitFull=true;drawEventBusMap({lat:45.434,lon:10.977},[])').runInContext(app.context);
  assert.ok(paths.some(path=>path.color==='#245f9e'));assert.ok(paths.some(path=>path.color==='#b13c45'));assert.ok(pins.some(pin=>pin.zIndexOffset===1000));assert.ok(icons.at(-1).html.includes('Evento'));
  new Script('eventBusSelectedLine="62";drawEventBusMap({lat:45.434,lon:10.977},[])').runInContext(app.context);assert.ok(!paths.some(path=>path.color==='#245f9e'));assert.ok(paths.some(path=>path.color==='#b13c45'));assert.ok(pins.some(pin=>pin.zIndexOffset===1000));assert.ok(fits.at(-1).some(point=>point[0]===45.434));
});

const networkLogic=await readFile(new URL('../public/bus-network.js',import.meta.url),'utf8');
function runStopsNetwork(){const app=runBusCatalog();new Script(networkLogic).runInContext(app.context);return app;}
test('Elenco linee sopra la mappa: scelta percorso, cambio linea e ripristino di tutte le fermate',async()=>{
  const app=runStopsNetwork();new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);
  const rail=app.get('network-line-rail');assert.equal(rail.hidden,false);assert.ok(rail.lineButtons.has('24'));const button=rail.lineButtons.get('24');
  new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);await button.onclick();
  assert.equal(new Script('networkChosenStop').runInContext(app.context),null);assert.equal(new Script('networkChosenLine').runInContext(app.context),'24');assert.equal(new Script('networkRouteState').runInContext(app.context),'ready');assert.equal(button.attributes['aria-pressed'],'true');assert.equal(rail.lineButtons.get('24'),button);
  await rail.lineButtons.get('130').onclick();assert.equal(button.attributes['aria-pressed'],'false');assert.equal(new Script('networkRouteState').runInContext(app.context),'missing');assert.ok(new Script('networkExplorerMatches().length').runInContext(app.context)>10);
  rail.allButton.onclick();assert.equal(new Script('networkChosenLine').runInContext(app.context),'');assert.equal(rail.allButton.attributes['aria-pressed'],'true');assert.ok(new Script('networkExplorerMatches().length').runInContext(app.context)>4000);
  app.get('network-list-tab').onclick();assert.equal(rail.hidden,true);app.get('network-map-tab').onclick();assert.equal(rail.hidden,false);
  app.get('bus-catalog-entry').onclick();app.get('bus-extraurban').onclick();await app.get('bus-map-entry').onclick();assert.equal(rail.lineButtons.has('24'),false);assert.ok(rail.lineButtons.has('130'));
});
test('Tendina linee: ricerca numero e destinazione, vuoto, annullamento e scelta con focus conservato',async()=>{
  const app=runStopsNetwork();new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);
  const toggle=app.get('network-line-toggle'),menu=app.get('network-line-menu'),input=app.get('network-line-query'),rail=app.get('network-line-rail');menu.hidden=true;
  let inputFocusCount=0,toggleFocusCount=0;input.focus=()=>inputFocusCount++;toggle.focus=()=>toggleFocusCount++;
  toggle.onclick();assert.equal(menu.hidden,false);assert.equal(toggle.attributes['aria-expanded'],'true');input.value='Quinzano';input.oninput();assert.equal(rail.lineButtons.get('24').hidden,false);assert.equal(rail.lineButtons.get('11').hidden,true);
  assert.equal(inputFocusCount,0,'Aprire la tendina non deve attivare la tastiera');assert.equal(toggleFocusCount,1);
  input.value='nessuna destinazione xyz';input.oninput();assert.equal(app.get('network-line-empty').hidden,false);assert.equal(rail.allButton.hidden,true);
  menu.onkeydown({key:'Escape',preventDefault(){}});assert.equal(menu.hidden,true);assert.equal(new Script('networkChosenLine').runInContext(app.context),'');
  toggle.onclick();assert.equal(input.value,'');input.value='24';input.oninput();assert.equal(rail.lineButtons.get('24').hidden,false);let focused=false;toggle.focus=()=>{focused=true;};await rail.lineButtons.get('24').onclick();assert.equal(menu.hidden,true);assert.equal(focused,true);assert.equal(toggle.attributes['aria-expanded'],'false');assert.match(toggle.textContent,/Linea 24/);
  toggle.onclick();app.get('bus-catalog-entry').onclick();assert.equal(menu.hidden,true);
});
test('Mappa comoda: ricerca apribile senza tastiera e cache fermate coerente con linea e rete',async()=>{
  const app=runStopsNetwork();new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);
  let inputFocus=0;app.get('network-stop-search').focus=()=>inputFocus++;app.get('network-search-toggle').onclick();assert.equal(inputFocus,0);assert.equal(app.get('network-search-toggle').attributes['aria-expanded'],'true');
  const first=new Script('networkOfficialStops()').runInContext(app.context),matches=new Script('networkExplorerMatches()').runInContext(app.context);assert.equal(new Script('networkOfficialStops()').runInContext(app.context),first);assert.equal(new Script('networkExplorerMatches()').runInContext(app.context),matches);
  await app.get('network-line-rail').lineButtons.get('24').onclick();assert.equal(app.get('network-search-toggle').attributes['aria-expanded'],'false');const filtered=new Script('networkExplorerMatches()').runInContext(app.context);assert.notEqual(filtered,matches);assert.ok(filtered.every(stop=>stop.numbers.includes('24')));
  app.get('network-fit').onclick();assert.equal(new Script('networkChosenLine').runInContext(app.context),'24');
  app.get('network-search-toggle').onclick();app.get('network-stop-search').value='1974';app.get('network-stop-search').oninput();app.get('network-search-results').children[0].onclick();assert.equal(new Script('networkChosenLine').runInContext(app.context),'24');assert.equal(new Script('networkChosenStop.code').runInContext(app.context),'1974');assert.equal(app.get('network-search-toggle').attributes['aria-expanded'],'false');
  app.get('bus-catalog-entry').onclick();app.get('bus-extraurban').onclick();await app.get('bus-map-entry').onclick();assert.notEqual(new Script('networkOfficialStops()').runInContext(app.context),first);assert.equal(new Script('networkOfficialStops().some(stop=>stop.numbers.includes("24"))').runInContext(app.context),false);
});
test('Menu laterale mappa: azioni contestuali, chiusura dopo scelta e annullamento da tastiera',async()=>{
  const app=runStopsNetwork();new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);
  const toggle=app.get('network-actions-toggle'),menu=app.get('network-actions-menu');assert.equal(toggle.hidden,false);assert.equal(app.get('network-return-stop').hidden,true);assert.equal(app.get('network-fit').hidden,true);assert.equal(app.get('page-heading').hidden,true);assert.ok(app.get('network-actions-items').children.includes(app.get('bus-catalog-entry')));
  toggle.onclick();assert.equal(menu.hidden,false);assert.equal(toggle.attributes['aria-expanded'],'true');app.get('network-options-toggle').onclick();assert.equal(app.get('network-extra-options').hidden,false);
  menu.onkeydown({key:'Escape',preventDefault(){}});assert.equal(menu.hidden,true);assert.equal(toggle.attributes['aria-expanded'],'false');
  new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);await new Script('selectNetworkLine("24")').runInContext(app.context);assert.equal(app.get('network-return-stop').hidden,false);assert.equal(app.get('network-fit').hidden,false);
  toggle.onclick();app.get('network-return-stop').onclick();assert.equal(menu.hidden,true);toggle.onclick();app.get('network-fit').onclick();assert.equal(menu.hidden,true);assert.equal(new Script('networkChosenLine').runInContext(app.context),'24');
  toggle.onclick();app.get('bus-catalog-entry').onclick();assert.equal(menu.hidden,true);assert.equal(app.get('bus-map-home').hidden,true);await app.get('bus-map-entry').onclick();assert.equal(app.get('bus-map-home').hidden,false);assert.equal(new Script('networkChosenStop.code').runInContext(app.context),'1974');
});
test('Ingresso Autobus: mappa nella schermata principale, elenco alternativo e ritorno senza perdere la fermata',async()=>{
  const app=runStopsNetwork();new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);
  assert.equal(new Script('busNetworkInline&&networkIsOpen()').runInContext(app.context),true);assert.notEqual(app.get('bus-network-dialog').open,true);assert.equal(app.get('bus-map-home').hidden,false);
  new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);app.get('bus-catalog-entry').onclick();assert.equal(new Script('networkIsOpen()').runInContext(app.context),false);
  await app.get('bus-map-entry').onclick();assert.equal(new Script('networkChosenStop.code').runInContext(app.context),'1974');assert.equal(app.get('bus-map-entry').attributes['aria-pressed'],'true');
  app.get('home').onclick();assert.equal(new Script('networkIsOpen()').runInContext(app.context),false);
});
test('Scheda sulla mappa: tre dimensioni, pulsanti e gesto con annullamento',async()=>{
  const app=runStopsNetwork();new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);
  assert.equal(app.get('network-sheet').attributes['data-size'],'compact');app.get('network-sheet-more').onclick();assert.equal(app.get('network-sheet').attributes['data-size'],'medium');app.get('network-sheet-more').onclick();assert.equal(app.get('network-map').inert,true);assert.equal(app.get('network-sheet-more').attributes['aria-disabled'],'true');
  app.get('network-sheet-less').onclick();assert.equal(app.get('network-map').inert,false);const tools=app.get('network-sheet-tools');tools.onpointerdown({clientY:100,pointerId:1});tools.onpointercancel();tools.onpointerup({clientY:20,pointerId:1});assert.equal(app.get('network-sheet').attributes['data-size'],'medium');
  tools.onpointerdown({clientY:100,pointerId:2});tools.onpointerup({clientY:160,pointerId:2});assert.equal(app.get('network-sheet').attributes['data-size'],'compact');
  app.get('network-sheet-more').onclick();app.get('network-sheet-more').onclick();app.get('network-selected-stop').stopUi.options.onClose();new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);assert.equal(app.get('network-sheet').attributes['data-size'],'compact');assert.equal(app.get('network-map').inert,false);
});
test('Ricerca sulla mappa: distingue linea e fermata, mantiene il codice e permette di cambiare rete',async()=>{
  const app=runStopsNetwork();new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);app.get('network-stop-search').value='24';app.get('network-stop-search').oninput();
  assert.match(app.get('network-search-results').children[0].textContent,/^Linea 24 ·/);await app.get('network-search-results').children[0].onclick();assert.equal(new Script('networkChosenLine').runInContext(app.context),'24');
  app.get('network-stop-search').value='1974';app.get('network-stop-search').oninput();const stop=app.get('network-search-results').children[0];assert.match(stop.textContent,/Fermata 1974/);stop.onclick();assert.equal(new Script('networkChosenStop.code').runInContext(app.context),'1974');
  app.get('bus-catalog-entry').onclick();app.get('bus-extraurban').onclick();await app.get('bus-map-entry').onclick();assert.equal(new Script('networkChosenStop').runInContext(app.context),null);assert.equal(new Script('networkOfficialStops().some(stop=>stop.numbers.includes("24"))').runInContext(app.context),false);
});
test('Gruppi di fermate: conservano tutti i codici e separano celle differenti senza inventare percorsi',()=>{
  const app=runStopsNetwork();app.context.groupPoints=[{code:'A',lat:45,lon:11,x:5,y:5},{code:'B',lat:47,lon:13,x:15,y:10},{code:'C',lat:44,lon:10,x:100,y:5}];
  const groups=new Script('clusterNetworkStops(groupPoints,stop=>({x:stop.x,y:stop.y}),64)').runInContext(app.context);assert.equal(groups.length,2);assert.equal(groups[0].stops.length,2);assert.equal(groups[0].lat,46);assert.equal(groups[0].lon,12);assert.equal(groups.flatMap(g=>g.stops).length,3);
});
test('Mappa compatta: scegliendo una linea il focus passa a Espandi e non resta su un pulsante nascosto',async()=>{
  const app=runStopsNetwork();useRomeInstant(app,'2026-10-21T08:00:00Z');new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);
  const panel=app.get('network-selected-stop'),button=panel.stopUi.buttons.get('24');panel.contains=element=>element===button;app.context.document.activeElement=button;let focused=false;app.get('network-sheet-more').focus=()=>{focused=true;};await button.onclick();assert.equal(focused,true);assert.equal(app.get('network-sheet').attributes['data-size'],'compact');
});
test('Scheda mappa: trenta partenze scorribili e posizione conservata durante aggiornamento',async()=>{
  const app=runStopsNetwork();useRomeInstant(app,'2026-10-21T08:00:00Z');new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);
  const box=app.get('network-selected-stop');await box.stopUi.buttons.get('24').onclick();await box.stopUi.pending;const ui=box.stopUi;assert.equal(ui.results.children.length,30);assert.equal(app.get('network-sheet').attributes['data-size'],'compact');assert.equal(app.get('network-sheet-label').textContent,'Scorri gli orari');
  ui.results.scrollTop=160;app.timers.get(ui.timer).fn();await box.stopUi.pending;assert.equal(ui.results.scrollTop,160);assert.equal(ui.results.children.length,30);
});
test('Corsa esatta: sequenza dalla salita, arrivi distinti dalle partenze e cambio giorno',()=>{
  const app=runStopsNetwork();app.context.tripSample={number:'T',validFrom:'2026-10-19',validTo:'2026-10-21',stops:{A:{name:'Partenza'},B:{name:'Destinazione'}},trips:[{id:'T1',dates:['2026-10-19'],destination:'B',calls:[['A','23:50:00',0,true,null,0],['A','00:10:00',1,true,'00:09:00',1],['B','00:30:00',1,false,'00:25:00',1]]},{id:'T2',dates:['2026-10-19'],destination:'Altra',calls:[['A','00:10:00',1,true],['B','00:50:00',1,false]]}]};
  const rows=new Script('officialDepartures(tripSample,"2026-10-19","A")').runInContext(app.context);app.context.tripRow=rows.find(row=>row.trip==='T1'&&row.order===1);
  const calls=new Script('busTripTimeline(tripSample,tripRow)').runInContext(app.context);assert.equal(calls.length,2);assert.equal(calls[0].time,'00:10:00');assert.equal(calls[0].day,'2026-10-20');assert.equal(calls[1].time,'00:25:00');assert.equal(calls[1].minutes,15);
  new Script('openBusTrip(tripSample,tripRow)').runInContext(app.context);assert.equal(app.get('bus-trip-dialog').open,true);assert.equal(app.get('bus-trip-stops').children.length,2);app.get('bus-trip-search').value='Destinazione';app.get('bus-trip-search').oninput();assert.equal(app.get('bus-trip-stops').children.length,1);assert.match(app.get('bus-trip-stops').children[0].children[1].children[1].textContent,/15 min/);app.get('bus-trip-search').value='inesistente';app.get('bus-trip-search').oninput();assert.match(app.get('bus-trip-count').textContent,/Nessuna fermata/);app.get('bus-trip-close').onclick();assert.equal(app.get('bus-trip-dialog').open,false);
});
test('Orario nella mappa: apre solo le fermate della corsa selezionata dal dato ufficiale',async()=>{
  const app=runStopsNetwork();useRomeInstant(app,'2026-10-21T08:00:00Z');new Script('setView("bus")').runInContext(app.context);await new Script('loadNetworkStops()').runInContext(app.context);new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);const box=app.get('network-selected-stop');await box.stopUi.buttons.get('24').onclick();await box.stopUi.pending;
  const card=box.stopUi.results.children[0];assert.match(card.attributes['aria-label'],/Vedi fermate della corsa/);card.onclick();assert.equal(app.get('bus-trip-dialog').open,true);assert.ok(app.get('bus-trip-stops').children.length>1);assert.match(app.get('bus-trip-summary').textContent,/Via Santini B/);assert.match(app.get('bus-trip-stops').children[0].children[1].children[1].textContent,/La tua partenza/);
});
test('Scheda fermata condivisa: nessuna linea arbitraria, pulsanti stabili e destinazioni con prossime partenze',async()=>{
  const app=runStopsNetwork();useRomeInstant(app,'2026-10-21T08:00:00Z');await new Script('openBusNetwork()').runInContext(app.context);new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);
  const box=app.get('network-selected-stop'),ui=box.stopUi,button=ui.buttons.get('24');assert.equal(ui.selected,'');assert.equal(ui.day.hidden,true);
  await button.onclick();await box.stopUi.pending;assert.equal(box.stopUi.buttons.get('24'),button);assert.equal(button.attributes['aria-pressed'],'true');
  assert.ok(box.stopUi.results.children.length>0);assert.match(box.stopUi.results.children[0].children[1].children[1].textContent,/Piazza Righetti/);
  await new Script('renderNetworkExplorer()').runInContext(app.context);assert.equal(box.stopUi.buttons.get('24'),button);
});
test('Scheda fermata: orari completi con codice conservato e ritorno alla stessa linea senza dialoghi sovrapposti',async()=>{
  const app=runStopsNetwork();await new Script('openBusNetwork()').runInContext(app.context);app.context.testStop=new Script('networkOfficialStops().find(stop=>stop.code==="1974")').runInContext(app.context);
  app.get('close-bus-network').onclick();await new Script('openCatalogStop(testStop,{line:"24"})').runInContext(app.context);app.get('bus-stop-shared').stopUi.day.onclick();
  assert.equal(app.get('bus-stop-dialog').open,false);assert.equal(app.get('official-bus-dialog').open,true);assert.equal(app.get('close-official-bus').attributes['aria-label'],'Torna alla fermata');
  assert.equal(new Script('officialTimeMode').runInContext(app.context),'day');
  app.get('close-official-bus').onclick();assert.equal(app.get('bus-stop-dialog').open,true);assert.equal(app.get('bus-stop-shared').stopUi.selected,'24');
});
test('Scheda fermata: la risposta tardiva di una linea non sostituisce una scelta successiva',async()=>{
  const app=runStopsNetwork();await new Script('openBusNetwork()').runInContext(app.context);new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);
  let resolve;app.context.fetch=url=>String(url).endsWith('/24.json')?new Promise(r=>resolve=r):Promise.resolve({ok:false,status:503});
  const box=app.get('network-selected-stop');const pending=box.stopUi.buttons.get('24').onclick();await box.stopUi.buttons.get('96').onclick();await box.stopUi.pending;
  resolve({ok:true,json:async()=>structuredClone(official24)});await pending;await Promise.resolve();assert.equal(box.stopUi.selected,'96');assert.match(box.stopUi.caption.textContent,/temporaneamente non disponibili/);
});
test('Scheda fermata: aggiorna le prossime corse dalla cache e interrompe il timer alla chiusura',async()=>{
  const app=runStopsNetwork();useRomeInstant(app,'2026-10-21T08:00:00Z');await new Script('openBusNetwork()').runInContext(app.context);new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.code==="1974"))').runInContext(app.context);
  const box=app.get('network-selected-stop');await box.stopUi.buttons.get('24').onclick();await box.stopUi.pending;const button=box.stopUi.buttons.get('24'),timer=box.stopUi.timer;assert.equal(app.timers.get(timer).ms,60000);
  app.timers.get(timer).fn();await box.stopUi.pending;assert.equal(box.stopUi.buttons.get('24'),button);const next=box.stopUi.timer;assert.notEqual(next,timer);app.get('close-bus-network').onclick();assert.equal(app.timers.has(next),false);
});
test('Mappa fermate: apertura predefinita dall’indice ufficiale, ricerca e scelta linea con percorso',async()=>{
  const app=runStopsNetwork();await new Script('openBusNetwork()').runInContext(app.context);
  assert.equal(new Script('busNetworkExplore').runInContext(app.context),true);assert.equal(app.get('network-picker').hidden,true);
  assert.ok(new Script('networkOfficialStops().length').runInContext(app.context)>4000);
  app.get('network-list-tab').onclick();app.get('network-stop-search').value='1974';app.get('network-stop-search').oninput();assert.equal(app.get('network-stops').children.length,1);
  app.get('network-stops').children[0].children[2].onclick();const panel=app.get('network-selected-stop');assert.equal(panel.hidden,false);
  assert.match(panel.children[0].children[0].children[1].textContent,/1974/);
  assert.ok(panel.stopUi.buttons.has('24'));
  await new Script('selectNetworkLine("24")').runInContext(app.context);assert.equal(new Script('networkRouteState').runInContext(app.context),'ready');
  assert.ok(new Script('networkChosenRoutes.length').runInContext(app.context)>0);assert.equal(app.get('network-stop-search').value,'');
  assert.ok(new Script('networkExplorerMatches().every(stop=>stop.numbers.includes("24"))').runInContext(app.context));
});
test('Mappa fermate: extraurbane con fermate anche senza tracciato, ripristino e filtri coerenti',async()=>{
  const app=runStopsNetwork();app.get('bus-extraurban').onclick();await new Script('openBusNetwork()').runInContext(app.context);
  assert.ok(new Script('networkOfficialStops().length').runInContext(app.context)>0);
  assert.equal(new Script('networkOfficialStops().some(stop=>stop.numbers.includes("24"))').runInContext(app.context),false);
  new Script('selectNetworkStop(networkOfficialStops().find(stop=>stop.numbers.includes("130")))').runInContext(app.context);
  await new Script('selectNetworkLine("130")').runInContext(app.context);assert.equal(new Script('networkRouteState').runInContext(app.context),'missing');
  assert.ok(new Script('networkExplorerMatches().length').runInContext(app.context)>10);assert.match(app.get('network-selected-stop').children.at(-1).textContent,/Tracciato non disponibile/);
  await app.get('network-all-stops').onclick();assert.equal(new Script('networkChosenLine').runInContext(app.context),'');assert.equal(app.get('network-selected-stop').hidden,true);
});
test('Mappa fermate: errore ritentabile e risposta tardiva dopo la chiusura ignorata',async()=>{
  const app=runStopsNetwork();app.context.fetch=async()=>({ok:false,status:503});await new Script('openBusNetwork()').runInContext(app.context);assert.equal(app.get('network-retry').hidden,false);
  let resolve;app.context.fetch=()=>new Promise(r=>resolve=r);const pending=app.get('network-retry').onclick();app.get('close-bus-network').onclick();resolve({ok:true,json:async()=>eventBusIndexData});await pending;
  assert.equal(new Script('networkStopIndex').runInContext(app.context),null);
});
function runNetwork(storage=new Map()){const app=run(new Map(storage),'home');new Script(officialLogic+'\n'+eventBusLogic+'\n'+networkLogic).runInContext(app.context);return app;}
test('Mappa generale: linee iniziali, aggiunta e rimozione persistenti, massimo sei e ricerca fermate',async()=>{
  const app=runNetwork();await new Script('openBusNetwork({compare:true})').runInContext(app.context);assert.equal(app.get('bus-network-dialog').open,true);assert.equal(app.get('network-lines').children.length,3);
  app.get('network-list-tab').onclick();app.get('network-stop-search').value='Maffei';app.get('network-stop-search').oninput();assert.ok(app.get('network-stops').children.length>0);assert.ok(app.get('network-stops').children.every(card=>card.children[0].textContent.includes('Maffei')));
  app.get('network-line').value='24';app.get('network-add-line').onclick();await new Script('loadBusNetwork()').runInContext(app.context);assert.equal(app.get('network-lines').children.length,4);assert.ok(JSON.parse(app.storage.get('verona-bus-network-v1')).includes('24'));
  app.get('network-lines').children.find(button=>button.attributes['aria-label']==='Rimuovi linea 24 dalla mappa').onclick();await new Script('loadBusNetwork()').runInContext(app.context);assert.equal(app.get('network-lines').children.length,3);
  new Script('busNetworkLines=["11","12","13","21","22","23"]').runInContext(app.context);app.get('network-line').value='24';app.get('network-add-line').onclick();assert.match(app.get('network-status').textContent,/fino a 6 linee/);
});
test('Mappa generale: riprende le preferite e conserva anche una selezione svuotata intenzionalmente',async()=>{
  const app=runNetwork(new Map([['verona-bus-v1',JSON.stringify({'atv-urban-24':true})]]));await new Script('openBusNetwork({compare:true})').runInContext(app.context);assert.equal(app.get('network-lines').children.length,1);assert.equal(new Script('busNetworkLines[0]').runInContext(app.context),'24');
  app.get('network-lines').children[0].onclick();await new Script('loadBusNetwork()').runInContext(app.context);assert.equal(new Script('busNetworkLines.length').runInContext(app.context),0);
  const reloaded=runNetwork(app.storage);await new Script('openBusNetwork({compare:true})').runInContext(reloaded.context);assert.equal(new Script('busNetworkLines.length').runInContext(reloaded.context),0);assert.deepEqual(JSON.parse(reloaded.storage.get('verona-bus-network-v1')),[]);
});
test('Mappa generale: chiudere durante il download non aggiorna la vista',async()=>{
  const app=runNetwork();const routes=catalog.busRoutes.routes.filter(route=>route.lineId==='atv-urban-11');app.context.meta=routes.map(({stops,segments,...route})=>route);new Script('busRouteData.assetBase="bus-routes/";busRouteData.routes=meta').runInContext(app.context);
  let resolve;app.context.fetch=()=>new Promise(r=>resolve=r);const pending=new Script('openBusNetwork({compare:true})').runInContext(app.context);app.get('close-bus-network').onclick();resolve({ok:true,json:async()=>({routes})});await pending;assert.equal(app.get('bus-network-dialog').open,false);assert.equal(new Script('busNetworkGroups.length').runInContext(app.context),0);
});
test('Partenze in popup: una risposta tardiva di un’altra linea non sostituisce la scelta corrente',async()=>{
  const app=runOfficial(),line11=JSON.parse(await readFile(new URL('../data/bus-official/11.json',import.meta.url),'utf8'));let resolve;
  app.context.fetch=url=>String(url).endsWith('/11.json')?new Promise(r=>resolve=r):Promise.resolve({ok:true,json:async()=>structuredClone(official24)});app.context.inlineBox=app.get('switch-preview');
  const first=new Script('renderBusStopPreview(inlineBox,"11","1104",new Date("2026-10-19T03:35:00Z"))').runInContext(app.context);
  await new Script('renderBusStopPreview(inlineBox,"24","1974",new Date("2026-10-19T03:35:00Z"))').runInContext(app.context);resolve({ok:true,json:async()=>line11});await first;
  const rows=app.get('switch-preview').children.filter(child=>child.className==='bus-stop-departure');assert.equal(rows[0].children[0].children[0].textContent,'05:50');assert.match(rows[0].children[1].textContent,/PIAZZA RIGHETTI/);
});

test('AMIA: conferma zona, promemoria nei servizi, persistenza e rimozione',()=>{
 const app=run(new Map(),'home');useRomeInstant(app,'2026-10-22T10:00:00Z');app.get('utilities-waste').onclick();wasteFind(app,'Zona Blu').onclick();assert.ok(wasteFind(app,'Basse San Michele · San Felice · Valpantena'));wasteFind(app,'Conferma zona').onclick();
 const next=app.get('waste-collection-panel').children.find(node=>node.className==='waste-next');assert.equal(next.children[0].textContent,'Da esporre');assert.equal(next.children[2].textContent,'Plastica e metalli');assert.equal(next.children[3].textContent,'dalle 19:00');assert.match(app.get('utilities-waste-preview').textContent,/Oggi.*Plastica e metalli.*19:00/);assert.equal(app.get('home-waste').hidden,true);
 const loaded=run(app.storage,'home');useRomeInstant(loaded,'2026-10-22T10:00:00Z');new Script('renderHome()').runInContext(loaded.context);assert.match(loaded.get('utilities-waste-preview').textContent,/Plastica e metalli/);loaded.get('utilities-waste').onclick();wasteFind(loaded,'Rimuovi la zona salvata').onclick();assert.match(loaded.get('utilities-waste-preview').textContent,/Scegli la zona/);
 useRomeInstant(app,'2027-01-01T12:00:00Z');new Script('renderHome()').runInContext(app.context);assert.match(app.get('utilities-waste-preview').textContent,/aggiornare/);assert.doesNotMatch(app.get('utilities-waste-preview').textContent,/19:00/);
});

test('Parcheggi: ricerca locale, destinazione, distanze e nessun risultato senza geocodifica inventata',()=>{
 const app=runParking();new Script('openParkingCatalog()').runInContext(app.context);app.get('parking-destination').onclick();assert.equal(app.get('parking-search-dialog').open,true);app.get('parking-search').value='Arena';app.get('parking-search').oninput();assert.ok(app.get('parking-search-results').children[0].textContent.includes('Arena'));app.get('parking-search-results').children[0].onclick();
 assert.equal(app.get('parking-search-dialog').open,false);assert.equal(app.get('parking-clear').hidden,false);assert.equal(app.get('parking-distance-control').hidden,false);assert.match(app.get('parking-event-name').textContent,/Arena/);const rows=new Script('parkingRows()').runInContext(app.context);assert.ok(rows.every((row,i)=>!i||rows[i-1].distance<=row.distance));assert.ok(rows.length);
 const card=app.get('parking-results').children[0];assert.match(card.children[1].textContent,/dal punto scelto/);assert.ok(card.children.at(-1).children.some(link=>link.href?.includes('travelmode=walking')));
 app.get('parking-clear').onclick();assert.equal(new Script('parkingTarget').runInContext(app.context),null);assert.equal(app.get('parking-distance-control').hidden,true);app.get('parking-destination').onclick();app.get('parking-search').value='indirizzo inesistente 999999';app.get('parking-search').oninput();assert.match(app.get('parking-search-results').children[0].textContent,/Nessun luogo/);assert.equal(app.get('parking-search-results').children.length,1);
});
test('Parcheggi: posizione solo su richiesta, errori recuperabili e risposte tardive ignorate',()=>{
 const app=runParking();let done,calls=0;app.context.isSecureContext=false;app.context.navigator={geolocation:{getCurrentPosition(success){calls++;done=success;}}};new Script('openParkingCatalog()').runInContext(app.context);assert.equal(calls,0);app.get('parking-nearby').onclick();assert.equal(calls,0);assert.match(app.get('parking-feedback').textContent,/HTTPS/);
 app.context.isSecureContext=true;app.get('parking-nearby').onclick();assert.equal(calls,1);assert.equal(app.get('parking-nearby').disabled,true);app.get('parking-close').onclick();done({coords:{latitude:45.44,longitude:11,accuracy:20}});assert.equal(new Script('parkingTarget').runInContext(app.context),null);
 new Script('openParkingCatalog()').runInContext(app.context);app.get('parking-nearby').onclick();done({coords:{latitude:45.44,longitude:11,accuracy:350}});assert.match(app.get('parking-feedback').textContent,/approssimativa/);assert.equal(app.get('parking-nearby').disabled,false);assert.equal(app.get('parking-event-name').textContent,'La mia posizione');assert.equal(app.storage.has('verona-parking-position'),false);
 app.get('parking-nearby').onclick();app.get('parking-clear').onclick();done({coords:{latitude:45.44,longitude:11,accuracy:20}});assert.equal(new Script('parkingTarget').runInContext(app.context),null);
});
test('Parcheggi: tocco della mappa, selezione diretta, alternativa elenco e centro da tastiera',()=>{
 const handlers={},markers=[],map={setView(){return this},invalidateSize(){},fitBounds(){},on(name,fn){handlers[name]=fn;},getCenter(){return {lat:45.438, lng:10.992}},remove(){}};
 const api={map:()=>map,tileLayer:()=>({on(){return this},addTo(){return this}}),layerGroup:()=>({addTo(){return this},clearLayers(){markers.length=0}}),circleMarker:(point,options)=>({on(name,fn){this.choose=fn;return this},addTo(){markers.push(this);return this},bindPopup(){return this}})};
 const app=runParking(api);new Script('openParkingCatalog()').runInContext(app.context);assert.equal(app.get('parking-results').hidden,true);markers.find(m=>m.choose).choose();assert.equal(app.get('parking-results').hidden,false);assert.equal(app.get('parking-deselect').hidden,false);assert.ok(app.get('parking-results').children.filter(card=>!card.hidden).length===1);app.get('parking-list-tab').onclick();assert.ok(app.get('parking-results').children.filter(card=>!card.hidden).length>1);
 app.get('parking-destination').onclick();app.get('parking-pick').onclick();assert.equal(app.get('parking-center').hidden,false);handlers.click({latlng:{lat:45.438,lng:10.992}});assert.equal(app.get('parking-center').hidden,true);assert.match(app.get('parking-event-name').textContent,/Punto scelto/);app.get('parking-destination').onclick();app.get('parking-pick').onclick();app.get('parking-center').onclick();assert.equal(new Script('parkingTarget.lat').runInContext(app.context),45.438);
});

test('Parcheggio e autobus: fermate reali ordinate, giorno e codice già impostati negli orari',async()=>{
 const app=runParking();useRomeInstant(app,'2026-10-22T10:00:00Z');new Script('openParkingCatalog()').runInContext(app.context);const card=app.get('parking-results').children[0],entry=card.children.at(-1).children.find(child=>child.textContent==='Autobus nelle vicinanze');assert.ok(entry);await entry.onclick();
 assert.equal(app.get('parking-bus-dialog').open,true);assert.equal(app.get('parking-dialog').open,true);assert.match(app.get('parking-bus-place').textContent,/Arena/);assert.match(app.get('parking-bus-status').textContent,/fermate.*800 m/);
 const expected=new Script('nearbyBusStops(eventBusStops,parkingBusPlace,"2026-10-22",{limit:Infinity}).filter(stop=>stop.lines.length).slice(0,5)').runInContext(app.context),cards=app.get('parking-bus-stops').children;assert.equal(cards.length,expected.length);assert.ok(cards.length);assert.equal(cards[0].children[0].children[0].textContent,expected[0].name);assert.equal(cards[0].open,true);
 assert.ok(cards.every((card,i)=>card.children[1].href.includes('origin='+catalog.parking.items[0].lat+','+catalog.parking.items[0].lon)&&card.children[1].href.includes('destination='+expected[i].lat+','+expected[i].lon)));
 const calls=[];app.context.openOfficialBus=(number,preset)=>calls.push({number,preset});const row=cards[0].children.find(child=>child.className==='parking-bus-line');row.children[1].children[0].onclick();assert.equal(calls[0].preset.stopCode,expected[0].code);assert.equal(calls[0].preset.date,'2026-10-22');assert.ok(expected[0].lines.includes(calls[0].number));
 const selected=new Script('parkingSelected').runInContext(app.context);app.get('parking-bus-close').onclick();assert.equal(app.get('parking-dialog').open,true);assert.equal(new Script('parkingSelected').runInContext(app.context),selected);
});
test('Autobus dal parcheggio: fuori copertura, assenza risultati e data vuota non inventano servizio',async()=>{
 const app=runParking();useRomeInstant(app,'2026-10-22T10:00:00Z');await new Script('openParkingBus(parkingData.items[0])').runInContext(app.context);app.get('parking-bus-day').value='2027-02-01';await app.get('parking-bus-day').onchange();assert.match(app.get('parking-bus-validity').textContent,/fuori copertura/);assert.ok(app.get('parking-bus-stops').children.length);
 app.get('parking-bus-day').value='';await app.get('parking-bus-day').onchange();assert.match(app.get('parking-bus-status').textContent,/validi/);assert.equal(app.get('parking-bus-stops').children.length,0);
 app.get('parking-bus-day').value='2026-10-22';new Script('parkingBusPlace={name:"Lontano",lat:46.2,lon:11.8}').runInContext(app.context);await app.get('parking-bus-day').onchange();assert.match(app.get('parking-bus-status').textContent,/Nessuna fermata/);
});
test('Autobus dal parcheggio: errore recuperabile, cache e risposta tardiva dopo la chiusura',async()=>{
 const app=runParking();useRomeInstant(app,'2026-10-22T10:00:00Z');let calls=0;app.context.fetch=async()=>{calls++;throw Error('offline')};await new Script('openParkingBus(parkingData.items[0])').runInContext(app.context);assert.match(app.get('parking-bus-status').textContent,/non disponibili/);assert.equal(app.get('parking-bus-stops').children[0].textContent,'Riprova');
 app.context.fetch=async()=>{calls++;return {ok:true,json:async()=>structuredClone(eventBusIndexData)}};await app.get('parking-bus-stops').children[0].onclick();assert.ok(app.get('parking-bus-stops').children.length);app.get('parking-bus-radius').value='400';await app.get('parking-bus-radius').onchange();assert.equal(calls,2);
 const late=runParking();let finish;late.context.fetch=()=>new Promise(resolve=>{finish=resolve});const pending=new Script('openParkingBus(parkingData.items[0])').runInContext(late.context);late.get('parking-bus-close').onclick();finish({ok:true,json:async()=>structuredClone(eventBusIndexData)});await pending;assert.equal(late.get('parking-bus-stops').children.length,0);assert.equal(late.get('parking-bus-dialog').open,false);
});
test('Percorso dal parcheggio: una linea senza corrispondenza della fermata non apre un percorso errato',async()=>{
 const app=runParking();useRomeInstant(app,'2026-10-22T10:00:00Z');await new Script('openParkingBus(parkingData.items[0])').runInContext(app.context);const row=app.get('parking-bus-stops').children.flatMap(card=>card.children).find(row=>row.className==='parking-bus-line'&&row.children[1].children.length===2);assert.ok(row);
 let opened=0;app.context.openBusRoute=async()=>{opened++};app.context.loadEventRouteLine=async()=>[{stops:[{ref:'not-a-stop'}]}];await row.children[1].children[1].onclick();assert.equal(opened,0);assert.match(row.children[2].textContent,/non è associato/);assert.equal(row.children[1].children[1].disabled,false);
});


test('Home personale: prossimo salvato anche fuori dal feed, esclusione fine nota e ripristino dopo riavvio',()=>{
  const app=run(new Map(),'home');useRomeInstant(app,'2026-10-22T10:00:00Z');
  new Script('const base=events[0];savedSnapshots={next:{...base,id:"next",title:"Il mio programma",startsAt:"2026-10-23T18:00:00+02:00",endsAt:"2026-10-23T20:00:00+02:00"},ended:{...base,id:"ended",title:"Finito stamattina",startsAt:"2026-10-22T08:00:00+02:00",endsAt:"2026-10-22T09:00:00+02:00"}};preferences.next="interested";preferences.ended="going";storeSavedSnapshots();localStorage.setItem("verona-events-v1",JSON.stringify(preferences));renderHome()').runInContext(app.context);
  let card=app.get('home-featured').children[0];assert.equal(card.children[0].textContent,'Il tuo prossimo evento');assert.equal(card.children[1].textContent,'Il mio programma');card.onclick();assert.equal(app.get('detail-dialog').open,true);
  const reload=run(app.storage,'home');useRomeInstant(reload,'2026-10-22T10:00:00Z');new Script('renderHome()').runInContext(reload.context);assert.equal(reload.get('home-featured').children[0].children[1].textContent,'Il mio programma');
  new Script('preferences.next="";renderHome()').runInContext(app.context);card=app.get('home-featured').children[0];assert.notEqual(card.children[1]?.textContent,'Finito stamattina');assert.equal(card.children[0].textContent,'Un’idea per uscire');
});

test('Home personale: zona confermata, cambio giorno e rimozione aggiornano il riepilogo',()=>{
  const app=run(new Map(),'home');assert.equal(app.get('home-daily-waste').children[1].textContent,'Scegli la tua zona →');app.get('home-daily-waste').onclick();assert.equal(app.get('waste-dialog').open,true);
  new Script('wasteSelection={zoneId:"c7-red",version:wasteData.version,confirmedAt:new Date().toISOString()};saveWasteSelection();renderWasteEntry()').runInContext(app.context);
  assert.equal(app.get('home-daily-waste').children[0].textContent,'Raccolta porta a porta');
  const reload=run(app.storage,'home');assert.equal(reload.get('home-daily-waste').children[0].textContent,'Raccolta porta a porta');useRomeInstant(reload,'2027-01-01T12:00:00Z');new Script('renderHome()').runInContext(reload.context);assert.match(reload.get('home-daily-waste').children[1].textContent,/aggiornare/);
  new Script('wasteSelection=null;saveWasteSelection();renderWasteEntry()').runInContext(reload.context);assert.equal(reload.get('home-daily-waste').children[1].textContent,'Scegli la tua zona →');
});


const travelLogic=await readFile(new URL('../public/event-travel.js',import.meta.url),'utf8');
function runTravel(){const app=runParking();new Script(travelLogic).runInContext(app.context);useRomeInstant(app,'2026-10-22T10:00:00Z');new Script('parkingFixture.startsAt="2026-10-22T10:00:00+02:00";parkingFixture.endsAt="2026-10-24T18:00:00+02:00"').runInContext(app.context);return app;}
test('Come arrivare: mezzo, evento e giorno conservati, indicazioni a piedi e rientro nei dettagli',async()=>{
 const app=runTravel();new Script('openDetails(parkingFixture)').runInContext(app.context);const sections=app.get('detail-content').children.filter(node=>node.className==='event-bus-entry');assert.equal(sections.length,1);assert.equal(sections[0].children[0].textContent,'Come arrivare');sections[0].children[0].onclick();assert.equal(app.get('event-travel-dialog').open,true);assert.match(app.get('event-travel-walk').href,/travelmode=walking/);assert.match(app.get('event-travel-map-note').textContent,/Mappa non disponibile/);
 await app.get('event-travel-modes').children[0].onclick();assert.equal(app.get('event-travel-dialog').open,false);assert.equal(app.get('event-bus-dialog').open,true);assert.equal(app.get('event-bus-name').textContent,'Evento in Arena');app.get('event-bus-date').value='2026-10-23';
 app.get('event-bus-travel-modes').children[1].onclick();assert.equal(app.get('event-bus-dialog').open,false);assert.equal(app.get('parking-dialog').open,true);assert.equal(app.get('parking-event-name').textContent,'Evento in Arena');
 await app.get('parking-travel-modes').children[0].onclick();assert.equal(app.get('parking-dialog').open,false);assert.equal(app.get('event-bus-date').value,'2026-10-23');app.get('event-bus-travel-modes').children[2].onclick();assert.equal(app.get('event-bus-dialog').open,false);assert.equal(app.get('event-travel-dialog').open,true);app.get('event-travel-close').onclick();assert.equal(app.get('detail-dialog').open,true);assert.equal(app.get('event-travel-dialog').open,false);
 new Script('openParkingCatalog()').runInContext(app.context);assert.equal(app.get('parking-travel-modes').hidden,true);
});
test('Come arrivare: sede assente senza suggerimenti inventati e risposta autobus tardiva ignorata',async()=>{
 const app=runTravel();new Script('openDetails({...parkingFixture,mapDisabled:true})').runInContext(app.context);const section=app.get('detail-content').children.find(node=>node.className==='event-bus-entry');assert.match(section.children[1].textContent,/non è abbastanza preciso/);assert.equal(app.get('event-travel-dialog').open,undefined);
 let finish;app.context.fetch=()=>new Promise(resolve=>{finish=resolve});new Script('openEventTravel(parkingFixture)').runInContext(app.context);const pending=app.get('event-travel-modes').children[0].onclick();app.get('event-bus-travel-modes').children[1].onclick();finish({ok:true,json:async()=>structuredClone(eventBusIndexData)});await pending;assert.equal(app.get('event-bus-dialog').open,false);assert.equal(app.get('parking-dialog').open,true);assert.equal(app.get('event-bus-stops').children.length,0);
});


const weatherLogic=await readFile(new URL('../public/weather.js',import.meta.url),'utf8');
function runWeather(storage=new Map()){
 const app=run(storage,'home');app.context.AbortController=AbortController;new Script(weatherLogic).runInContext(app.context);useRomeInstant(app,'2026-10-22T13:00:00Z');
 app.context.weatherFixture={day:'2026-10-22',time:'13:00',fetchedAt:'2026-10-22T13:00:00Z',zones:['14','15'].map(id=>({id,days:[{day:'2026-10-22',period:'am',sky:'Nuvoloso',rain:'Assenti',probability:0,min:'8/10',max:'18/20'},{day:'2026-10-22',period:'pm',sky:'Sereno o poco nuvoloso',rain:'Assenti',probability:0,min:'',max:id==='14'?'18/20':'19/21'},{day:'2026-10-23',period:'am',sky:'Variabile',rain:'Piogge sparse',probability:60,min:'8/10',max:'17/19'}]}))};
 return app;
}
test('Meteo ARPAV: intervalli originali, zero precipitazioni, area persistente e scadenza del bollettino',()=>{
 const app=runWeather();new Script('weatherData=weatherFixture;renderWeather()').runInContext(app.context);assert.equal(app.get('home-weather-value').textContent,'Max 18–20 °C →');assert.equal(app.get('weather-days').children.length,2);assert.match(app.get('weather-days').children[0].children[2].textContent,/Max 18–20/);assert.doesNotMatch(app.get('weather-days').children[0].children[2].textContent,/Min/);assert.match(app.get('weather-days').children[0].children[3].textContent,/0%/);
 app.get('weather-area').value='15';app.get('weather-area').onchange();assert.equal(app.get('home-weather-label').textContent,'Meteo Garda');assert.equal(app.storage.get('verona-weather-area-v1'),'15');
 for(const [input,expected]of [['',''],['n.d.',''],['18x',''],['70',''],['20/18',''],['-2/0','-2–0 °C']]){app.context.tempInput=input;assert.equal(new Script('weatherTemperature(tempInput)').runInContext(app.context),expected);}
 useRomeInstant(app,'2026-10-24T13:00:00Z');new Script('renderWeather()').runInContext(app.context);assert.match(app.get('home-weather-value').textContent,/aggiornare/);assert.equal(app.get('weather-days').children[0].className,'weather-empty');assert.throws(()=>new Script('parseWeatherXML("<!DOCTYPE bulletin><bulletin/>")').runInContext(app.context),/non valido/);
});
test('Meteo ARPAV: cache evita richieste duplicate, errore conserva il bollettino, ricarica e cache corrotta',async()=>{
 const app=runWeather();new Script('weatherData=weatherFixture;localStorage.setItem("verona-weather-v1",JSON.stringify(weatherData))').runInContext(app.context);let calls=0;app.context.fetch=async()=>{calls++;throw Error('offline')};await new Script('loadWeather()').runInContext(app.context);assert.equal(calls,0);await new Script('loadWeather(true)').runInContext(app.context);assert.equal(calls,1);assert.match(app.get('weather-status').textContent,/ultimo bollettino/);assert.equal(app.get('weather-days').children.length,2);assert.equal(app.get('weather-refresh').disabled,false);
 const reload=runWeather(app.storage);new Script('renderWeather()').runInContext(reload.context);assert.equal(reload.get('home-weather-value').textContent,'Max 18–20 °C →');
 const broken=runWeather(new Map([['verona-weather-v1','{bad JSON']]));assert.equal(new Script('weatherData').runInContext(broken.context),null);broken.context.fetch=async()=>{throw Error('offline')};await new Script('openWeather()').runInContext(broken.context);assert.match(broken.get('weather-status').textContent,/non disponibile/);broken.get('weather-close').onclick();assert.equal(broken.get('weather-dialog').open,false);
});


function eventWeatherFixture(app,changes={}){app.context.eventWeatherFixture={...structuredClone(catalog.events[0]),title:'Evento meteo Verona',location:'Via Aspromonte 4, 37126 Verona',coordinates:{lat:45.446798,lon:10.986527},mapDisabled:false,area:'Verona',areaConfirmed:false,datePrecision:'datetime',startsAt:'2026-10-22T17:00:00+02:00',endsAt:'2026-10-22T18:00:00+02:00',...changes};return app.context.eventWeatherFixture;}
test('Meteo evento: area esplicita, fascia pertinente e nessuna assegnazione generica alla provincia',()=>{
 const app=runWeather();eventWeatherFixture(app);new Script('weatherData=weatherFixture;openDetails(eventWeatherFixture)').runInContext(app.context);let preview=app.get('detail-content').children.find(node=>node.className==='event-weather-preview');assert.equal(preview.hidden,false);assert.match(preview.children[0].children[1].textContent,/Pomeriggio.*Sereno/);assert.match(preview.children[0].children[2].textContent,/Max 18–20.*0%/);
 for(const changes of [{location:'Sede da definire'},{location:'Provincia di Verona'},{location:'Bardolino, provincia di Verona',coordinates:{lat:45.546,lon:10.72}},{mapDisabled:true},{coordinates:null},{startsAt:'2026-10-22T08:00:00+02:00',endsAt:'2026-10-22T10:00:00+02:00'}]){eventWeatherFixture(app,changes);assert.equal(new Script('eventWeatherContext(eventWeatherFixture)').runInContext(app.context),null);}
 eventWeatherFixture(app,{startsAt:'2026-10-23T11:00:00+02:00',endsAt:'2026-10-23T12:00:00+02:00'});assert.equal(JSON.stringify(new Script('eventWeatherContext(eventWeatherFixture).periods').runInContext(app.context)),JSON.stringify(['am']));
 eventWeatherFixture(app,{startsAt:'2026-10-23T11:00:00+02:00',endsAt:'2026-10-23T13:00:00+02:00'});assert.equal(JSON.stringify(new Script('eventWeatherContext(eventWeatherFixture).periods').runInContext(app.context)),JSON.stringify(['am','pm']));
 eventWeatherFixture(app,{startsAt:'2026-10-22T22:00:00+02:00',endsAt:'2026-10-23T00:00:00+02:00'});new Script('selected="2026-10-23"').runInContext(app.context);assert.equal(new Script('eventWeatherContext(eventWeatherFixture)').runInContext(app.context),null);
});
test('Meteo evento: dettaglio filtrato senza cambiare la preferenza Garda, rientro e assenza di copertura',async()=>{
 const app=runWeather();eventWeatherFixture(app);new Script('weatherData=weatherFixture;weatherArea="15";localStorage.setItem("verona-weather-area-v1","15");openDetails(eventWeatherFixture)').runInContext(app.context);const preview=app.get('detail-content').children.find(node=>node.className==='event-weather-preview');await preview.children[0].onclick();assert.equal(app.get('weather-area').value,'14');assert.equal(app.get('weather-days').children.length,1);assert.match(app.get('weather-event-context').textContent,/Evento meteo Verona/);assert.equal(app.get('home-weather-label').textContent,'Meteo Garda');assert.equal(app.storage.get('verona-weather-area-v1'),'15');app.get('weather-all-days').onclick();assert.equal(app.get('weather-area').value,'14');assert.equal(app.get('weather-days').children.length,2);app.get('weather-close').onclick();assert.equal(app.get('detail-dialog').open,true);
 await app.get('home-weather').onclick();assert.equal(app.get('weather-area').value,'15');assert.equal(app.get('weather-event-context').hidden,true);app.get('weather-close').onclick();
 eventWeatherFixture(app,{startsAt:'2026-11-20T17:00:00+01:00',endsAt:'2026-11-20T18:00:00+01:00'});new Script('openDetails(eventWeatherFixture)').runInContext(app.context);assert.equal(app.get('detail-content').children.find(node=>node.className==='event-weather-preview').hidden,true);
 new Script('weatherData.day="2026-10-19";renderWeather()').runInContext(app.context);assert.equal(app.get('detail-content').children.find(node=>node.className==='event-weather-preview').hidden,true);app.get('close-detail').onclick();assert.equal(new Script('eventWeatherPreview').runInContext(app.context),null);
});


const exploreNeedsLogic=await readFile(new URL('../public/explore-needs.js',import.meta.url),'utf8');
function runExploreNeeds(){const app=runParking();new Script(exploreNeedsLogic).runInContext(app.context);new Script('setView("explore")').runInContext(app.context);return app;}
test('Esplora per bisogni: ricerca suggerita, servizi ufficiali e ritorno senza perdere i filtri',()=>{
 const app=runExploreNeeds();app.get('explore-search').value='parcheggio';app.get('explore-search').oninput();assert.equal(app.get('explore-need-hint').hidden,false);app.get('explore-need-hint').onclick();assert.equal(app.get('parking-dialog').open,true);assert.equal(app.get('explore-search').value,'parcheggio');app.get('parking-close').onclick();
 app.get('explore-needs-open').onclick();app.get('explore-need-pharmacies').onclick();assert.equal(app.get('explore-needs-dialog').open,false);assert.equal(app.get('pharmacy-dialog').open,true);app.get('pharmacy-close').onclick();app.get('explore-needs-open').onclick();app.get('explore-need-waste').onclick();assert.equal(app.get('waste-dialog').open,true);assert.equal(app.get('waste-centers-panel').hidden,false);app.get('waste-close').onclick();
 app.get('explore-category').value='Farmacie';app.get('explore-category').onchange();app.get('explore-search').value='farmacia';app.get('explore-search').oninput();assert.equal(app.get('explore-need-hint').hidden,true);assert.equal(app.get('explore-pharmacies').hidden,false);
 app.get('explore-needs-open').onclick();app.get('explore-needs-close').onclick();assert.equal(app.get('explore-search').value,'farmacia');assert.equal(app.get('explore-category').value,'Farmacie');app.get('explore-needs-open').onclick();app.get('explore-events').onclick();assert.equal(app.get('explore-needs-dialog').open,false);assert.equal(app.get('event-map-period').value,'7');app.get('event-map-back').onclick();assert.equal(app.get('explore-category').value,'Farmacie');
});
test('Esplora nelle vicinanze: raggio reale, ordine per distanza, filtri, stato vuoto e ripristino',()=>{
 const app=runExploreNeeds();new Script('places.splice(0,places.length,{id:"far",name:"Lontano",category:"Negozi",lat:45.46,lon:11},{id:"near",name:"Vicino",category:"Negozi",lat:45.4385,lon:10.9916},{id:"middle",name:"Medio",category:"Bar e caffè",lat:45.441,lon:10.9916});setExploreNearby({lat:45.4384,lon:10.9916});exploreMode="list";renderExplore()').runInContext(app.context);
 assert.equal(new Script('filteredPlaces().map(p=>p.id).join(",")').runInContext(app.context),'near,middle');assert.match(app.get('explore-count').textContent,/entro 1 km/);assert.match(app.get('places-list').children[0].children[0].children[3].textContent,/in linea d’aria/);
 app.get('explore-category').value='Negozi';app.get('explore-category').onchange();assert.equal(new Script('filteredPlaces().length').runInContext(app.context),1);new Script('setExploreNearby({lat:46,lon:12})').runInContext(app.context);assert.match(app.get('places-list').children[0].textContent,/catalogo.*parziale/);app.get('explore-reset').onclick();assert.equal(new Script('exploreNearbyPoint').runInContext(app.context),null);assert.equal(new Script('filteredPlaces().length').runInContext(app.context),3);
});
test('Esplora posizione: solo su richiesta, errore Wi-Fi, successo e risposta dopo annullamento ignorata',()=>{
 const app=locationTestApp();new Script(exploreNeedsLogic).runInContext(app.context);app.context.renderPlacesMap=()=>{};new Script('view="explore"').runInContext(app.context);let calls=0,success;app.context.navigator={geolocation:{getCurrentPosition(ok){calls++;success=ok;}}};app.context.isSecureContext=false;new Script('openExploreNeed("nearby")').runInContext(app.context);assert.equal(calls,0);app.get('explore-use-location').onclick();assert.equal(calls,0);assert.match(app.get('explore-nearby-status').textContent,/HTTPS/);assert.equal(app.get('explore-use-location').disabled,false);
 app.context.isSecureContext=true;app.get('explore-use-location').onclick();assert.equal(calls,1);success({coords:{latitude:45.4384,longitude:10.9916,accuracy:20}});assert.equal(app.get('explore-nearby-dialog').open,false);assert.ok(new Script('exploreNearbyPoint').runInContext(app.context));
 new Script('resetExplore();openExploreNeed("nearby")').runInContext(app.context);app.get('explore-use-location').onclick();app.get('explore-nearby-close').onclick();success({coords:{latitude:45.45,longitude:11,accuracy:20}});assert.equal(new Script('exploreNearbyPoint').runInContext(app.context),null);assert.equal(app.get('explore-use-location').disabled,false);
 new Script('openExploreNeed("nearby")').runInContext(app.context);app.get('explore-pick-area').onclick();assert.match(app.get('explore-feedback').textContent,/Cerca qui/);assert.equal(app.get('explore-nearby-dialog').open,false);
});
