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
  const context=createContext({Intl,Date:TestDate,URL,JSON,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},document:{getElementById:get,createElement:()=>new Element()}});
  if(mapApi)context.L=mapApi;
  new Script(logic).runInContext(context);
  if(initialView==='discover')get('discover').onclick();
  return {get,context,storage};
}

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

test('Mappa autobus: elenco alternativo, fermate certe e orari della direzione scelta',()=>{
  const app=run(new Map(),'home');
  new Script('openBusRoute(busData.lines.find(line=>line.id==="atv-urban-11"))').runInContext(app.context);
  assert.equal(app.get('bus-route-dialog').open,true);assert.match(app.get('bus-route-message').textContent,/non disponibile/);
  assert.equal(app.get('bus-route-variant').value,'11344295');
  app.get('bus-route-list-tab').onclick();assert.equal(app.get('bus-route-stops').hidden,false);
  const row=app.get('bus-route-stops').children.find(row=>row.children[0].textContent==='Via Giberti');
  row.children.find(child=>child.textContent==='Orari di questa fermata').onclick();
  assert.equal(app.get('bus-timetable-dialog').open,true);assert.match(app.get('timetable-direction').value,/Chievo/);
  assert.match(app.get('timetable-map-context').textContent,/Via Giberti/);
  app.get('timetable-service').value='LUN-VEN SCOLASTICO';app.get('timetable-service').onchange();
  assert.equal(app.get('timetable-stop').value,'Via Giberti#1');assert.ok(app.get('timetable-results').children.length>10);
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
  const map={setView(){return this},invalidateSize(){},fitBounds(){}};
  const layer={addTo(){return this},clearLayers(){markers.length=0}};
  const L={map(){mapCount++;return map},tileLayer(){return {on(){return this},addTo(){return this}}},layerGroup(){return layer},circleMarker(position,options){const marker={position,options,bindPopup(popup){this.popup=popup;return this},addTo(){markers.push(this);return this},openPopup(){this.open=true}};return marker}};
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
  assert.ok(current.localVerified);
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

test('Il primo accesso ai salvati esclude eventi già finiti oggi e conserva date senza orario',()=>{
  const app=run();
  new Script(`events.push({id:'ended',title:'Finito',startsAt:'2026-10-17T06:00:00Z',endsAt:'2026-10-17T07:00:00Z',source:'Comune di Verona'},{id:'tomorrow',title:'Domani',startsAt:'2026-10-18',endsAt:'2026-10-18',source:'Comune di Verona'});preferences={ended:'going',tomorrow:'interested'};setView('saved')`).runInContext(app.context);
  assert.equal(new Script('selected').runInContext(app.context),'2026-10-18');
  assert.equal(new Script('agendaTime(events.find(e=>e.id==="tomorrow"))').runInContext(app.context),'Orario non indicato');
  assert.equal(new Script('agendaTime({startsAt:"2026-10-17",endsAt:"2026-10-20"})').runInContext(app.context),'In corso · fino al 20 ott');
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
