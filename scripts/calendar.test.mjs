import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

const logic = await readFile(new URL('../public/calendar.js',import.meta.url),'utf8');
const builtHtml = await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const catalog = JSON.parse(builtHtml.match(/<script id="event-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const liveCatalog = structuredClone(catalog);
catalog.busRoutes=JSON.parse(await readFile(new URL('../data/bus-routes.json',import.meta.url),'utf8'));
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
function runAgenda(){const app=run(new Map(),'home');app.context.TextEncoder=TextEncoder;new Script(agendaLogic).runInContext(app.context);return app;}
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
  const ztl=app.get('services').children.find(e=>e.attributes['data-service']==='ztl');
  assert.equal(ztl.attributes['aria-label'],'Permessi ZTL');ztl.onclick();
  assert.equal(app.get('ztl-dialog').open,true);assert.equal(app.get('home-view').hidden,false);
  app.get('close-ztl').onclick();assert.equal(app.get('ztl-dialog').open,false);
  assert.match(builtHtml,/<a id="ztl-portal"[^>]*href="https:\/\/permessi\.mobilita\.comune\.verona\.it\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
});
test('Esplora è attiva dalla Home, filtra luoghi reali e conserva i preferiti',()=>{
  const app=run(new Map(),'home');app.get('services').children.find(e=>e.attributes['data-service']==='explore').onclick();
  assert.equal(app.get('explore-view').hidden,false);assert.match(app.get('places-map-message').textContent,/Lista/);
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
  await new Script('openBusNetwork()').runInContext(app.context);assert.equal(new Script('networkAvailableLines().length').runInContext(app.context),0);assert.equal(app.get('network-add-line').disabled,true);
  assert.deepEqual(JSON.parse(app.storage.get('verona-bus-network-v1')),['11','24']);
  app.get('close-bus-network').onclick();app.get('bus-scope-all').onclick();await new Script('openBusNetwork()').runInContext(app.context);
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
  stopButton.onclick();assert.equal(app.get('bus-stop-dialog').open,true);assert.equal(app.get('bus-stop-line').children.length,2);
  app.get('bus-stop-line').value='24';app.get('bus-stop-all').onclick();
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
function runNetwork(storage=new Map()){const app=run(new Map(storage),'home');new Script(officialLogic+'\n'+eventBusLogic+'\n'+networkLogic).runInContext(app.context);return app;}
test('Mappa generale: linee iniziali, aggiunta e rimozione persistenti, massimo sei e ricerca fermate',async()=>{
  const app=runNetwork();await new Script('openBusNetwork()').runInContext(app.context);assert.equal(app.get('bus-network-dialog').open,true);assert.equal(app.get('network-lines').children.length,3);
  app.get('network-list-tab').onclick();app.get('network-stop-search').value='Maffei';app.get('network-stop-search').oninput();assert.ok(app.get('network-stops').children.length>0);assert.ok(app.get('network-stops').children.every(card=>card.children[0].textContent.includes('Maffei')));
  app.get('network-line').value='24';app.get('network-add-line').onclick();await new Script('loadBusNetwork()').runInContext(app.context);assert.equal(app.get('network-lines').children.length,4);assert.ok(JSON.parse(app.storage.get('verona-bus-network-v1')).includes('24'));
  app.get('network-lines').children.find(button=>button.attributes['aria-label']==='Rimuovi linea 24 dalla mappa').onclick();await new Script('loadBusNetwork()').runInContext(app.context);assert.equal(app.get('network-lines').children.length,3);
  new Script('busNetworkLines=["11","12","13","21","22","23"]').runInContext(app.context);app.get('network-line').value='24';app.get('network-add-line').onclick();assert.match(app.get('network-status').textContent,/fino a 6 linee/);
});
test('Mappa generale: riprende le preferite e conserva anche una selezione svuotata intenzionalmente',async()=>{
  const app=runNetwork(new Map([['verona-bus-v1',JSON.stringify({'atv-urban-24':true})]]));await new Script('openBusNetwork()').runInContext(app.context);assert.equal(app.get('network-lines').children.length,1);assert.equal(new Script('busNetworkLines[0]').runInContext(app.context),'24');
  app.get('network-lines').children[0].onclick();await new Script('loadBusNetwork()').runInContext(app.context);assert.equal(new Script('busNetworkLines.length').runInContext(app.context),0);
  const reloaded=runNetwork(app.storage);await new Script('openBusNetwork()').runInContext(reloaded.context);assert.equal(new Script('busNetworkLines.length').runInContext(reloaded.context),0);assert.deepEqual(JSON.parse(reloaded.storage.get('verona-bus-network-v1')),[]);
});
test('Mappa generale: chiudere durante il download non aggiorna la vista',async()=>{
  const app=runNetwork();const routes=catalog.busRoutes.routes.filter(route=>route.lineId==='atv-urban-11');app.context.meta=routes.map(({stops,segments,...route})=>route);new Script('busRouteData.assetBase="bus-routes/";busRouteData.routes=meta').runInContext(app.context);
  let resolve;app.context.fetch=()=>new Promise(r=>resolve=r);const pending=new Script('openBusNetwork()').runInContext(app.context);app.get('close-bus-network').onclick();resolve({ok:true,json:async()=>({routes})});await pending;assert.equal(app.get('bus-network-dialog').open,false);assert.equal(new Script('busNetworkGroups.length').runInContext(app.context),0);
});
test('Partenze in popup: una risposta tardiva di un’altra linea non sostituisce la scelta corrente',async()=>{
  const app=runOfficial(),line11=JSON.parse(await readFile(new URL('../data/bus-official/11.json',import.meta.url),'utf8'));let resolve;
  app.context.fetch=url=>String(url).endsWith('/11.json')?new Promise(r=>resolve=r):Promise.resolve({ok:true,json:async()=>structuredClone(official24)});app.context.inlineBox=app.get('switch-preview');
  const first=new Script('renderBusStopPreview(inlineBox,"11","1104",new Date("2026-10-19T03:35:00Z"))').runInContext(app.context);
  await new Script('renderBusStopPreview(inlineBox,"24","1974",new Date("2026-10-19T03:35:00Z"))').runInContext(app.context);resolve({ok:true,json:async()=>line11});await first;
  const rows=app.get('switch-preview').children.filter(child=>child.className==='bus-stop-departure');assert.equal(rows[0].children[0].children[0].textContent,'05:50');assert.match(rows[0].children[1].textContent,/PIAZZA RIGHETTI/);
});
