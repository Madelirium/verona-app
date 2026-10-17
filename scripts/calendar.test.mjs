import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

const logic = await readFile(new URL('../public/calendar.js',import.meta.url),'utf8');
const builtHtml = await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const catalog = JSON.parse(builtHtml.match(/<script id="event-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
function run(storage = new Map(),initialView='discover',mapApi) {
  class Element {
    constructor() { this.textContent='';this.value='';this.children=[];this.listeners={};this.attributes={};this.classList={toggle(){}};this.style={}; }
    append(...nodes){this.children.push(...nodes)}
    replaceChildren(...nodes){this.children=nodes}
    setAttribute(key,value){this.attributes[key]=value}
    addEventListener(key,fn){this.listeners[key]=fn}
    hasPointerCapture(){return false}
    setPointerCapture(){}
    showModal(){this.open=true}
    close(){this.open=false}
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
  assert.match(app.get('selected').textContent,/18/);
  app.get('calendar-event-map').onclick();assert.equal(app.get('event-map-date').value,'2026-10-18');
  app.get('event-map-date').value='';app.get('event-map-date').onchange();assert.equal(app.get('event-map-date').value,'2026-10-18');
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
  assert.ok(get('grid').children.length>=28);
  assert.match(get('status').textContent,/964 nel catalogo/);
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
  app.get('open-filters').onclick();assert.equal(app.get('bus-filters-dialog').open,true);
  app.get('bus-service').value='holiday';app.get('bus-service').onchange();
  assert.equal(new Script('busData.lines.filter(busMatches).every(l=>l.service==="holiday")').runInContext(app.context),true);
  app.get('apply-bus-filters').onclick();assert.equal(app.get('bus-filters-dialog').open,false);
  app.get('bus-list').children[0].children[0].onclick();assert.equal(app.get('bus-detail-dialog').open,true);
  assert.ok(app.get('bus-detail-content').children.some(e=>e.className==='bus-route'));
  assert.ok(app.get('bus-detail-content').children.some(e=>e.href?.includes('ServeAttachment.php')));
  app.get('close-bus-detail').onclick();app.get('bus-back').onclick();assert.equal(app.get('home-view').hidden,false);
});
test('Le linee preferite persistono e la rimozione lascia uno stato vuoto recuperabile',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);
  app.get('bus-list').children[0].children[1].onclick();assert.ok(app.storage.get('verona-bus-v1'));
  const next=run(app.storage,'home');new Script('setView("bus")').runInContext(next.context);next.get('bus-favorites').onclick();
  assert.equal(next.get('bus-list').children.length,1);
  next.get('bus-list').children[0].children[1].onclick();assert.match(next.get('bus-list').children[0].textContent,/Nessuna linea preferita/);
  next.get('bus-lines').onclick();assert.equal(next.get('bus-list').children.length,catalog.bus.lines.length);
});
test('Gli avvisi ATV aprono la fonte e non vengono presentati come orari live',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);app.get('bus-alerts').onclick();
  assert.equal(app.get('bus-list').children.length,catalog.bus.alerts.length);
  app.get('bus-list').children[0].children[1].onclick();assert.equal(app.get('bus-detail-dialog').open,true);
  assert.ok(app.get('bus-detail-content').children.some(e=>e.href?.startsWith('https://www.atv.verona.it/')));
  assert.ok(catalog.bus.lines.every(l=>l.realtime===false));
});
test('Notizie ATV mostra il feed completo, con ricerca anche nelle pubblicazioni aziendali',()=>{
  const app=run(new Map(),'home');new Script('setView("bus")').runInContext(app.context);app.get('bus-updates').onclick();
  assert.equal(app.get('bus-list').children.length,catalog.bus.updates.length);
  assert.ok(catalog.bus.updates.length>catalog.bus.alerts.length);
  const item=catalog.bus.updates.find(i=>!i.serviceAlert);app.get('bus-search').value=item.title;app.get('bus-search').oninput();
  assert.equal(app.get('bus-list').children.length,1);app.get('bus-list').children[0].children[1].onclick();assert.equal(app.get('bus-detail-dialog').open,true);
});
test('Notizie è attiva dalla Home e filtra le pubblicazioni ufficiali separatamente dagli eventi',()=>{
  const app=run(new Map(),'home');
  const news=app.get('services').children.find(e=>e.attributes['data-service']==='news');
  assert.ok(!news.attributes['aria-label'].includes('in preparazione'));news.onclick();
  assert.equal(app.get('news-view').hidden,false);assert.equal(app.get('calendar-view').hidden,true);assert.equal(app.get('news-list').children.length,catalog.news.items.length);
  app.get('news-notices').onclick();assert.equal(new Script('filteredNews().every(i=>i.sourceKey==="avvisi")').runInContext(app.context),true);
  app.get('news-all').onclick();app.get('open-filters').onclick();assert.equal(app.get('news-filters-dialog').open,true);
  app.get('news-search').value='tangenziale';app.get('news-search').oninput();
  assert.ok(new Script('filteredNews().length').runInContext(app.context)>0);
  app.get('apply-news-filters').onclick();assert.equal(app.get('news-filters-dialog').open,false);
  app.get('news-area').value='Circoscrizione 3';app.get('news-search').value='';app.get('news-area').onchange();
  assert.ok(new Script('filteredNews().every(i=>i.area==="Circoscrizione 3")').runInContext(app.context));
  app.get('reset-news-filters').onclick();assert.equal(app.get('news-area').value,'');
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
  assert.match(next.get('news-list').children[0].textContent,/Nessuna notizia salvata/);
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
  assert.equal(app.get('filter-dot').hidden,false);
  app.get('apply-filters').onclick();assert.equal(app.get('filters-dialog').open,false);
  assert.match(new Script('currentDiscovery.title').runInContext(app.context),/Hostaria/);
  app.get('open-filters').onclick();app.get('reset-filters').onclick();
  assert.equal(app.get('search').value,'');assert.equal(app.get('filter-dot').hidden,true);
  assert.equal(app.get('filters-dialog').open,true);
  app.get('close-filters').onclick();assert.equal(app.get('filters-dialog').open,false);
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
  assert.equal(JSON.parse(app.storage.get('verona-events-v1'))[catalog.events[0].id],'going');
  const reloaded=run(app.storage);
  new Script('selected="2026-10-17";month="2026-10";onlySaved=true;render()').runInContext(reloaded.context);
  assert.equal(reloaded.get('events').children.length,1);
  reloaded.get('events').children[0].children.at(-1).children.find(b=>b.textContent==='Rimuovi').onclick();
  assert.match(reloaded.get('events').children[0].textContent,/Non hai eventi salvati/);
});
test('Navigazione dicembre-gennaio e sovrapposizione eventi di più giorni',()=>{
  const {context}=run();
  assert.equal(new Script('shiftMonth("2026-12",1)').runInContext(context),'2027-01');
  assert.equal(new Script('shiftMonth("2027-01",-1)').runInContext(context),'2026-12');
  assert.equal(new Script('occursOn({startsAt:"2026-10-17",endsAt:"2026-10-18"},"2026-10-18")').runInContext(context),true);
  assert.equal(new Script('occursOn({startsAt:"2026-10-17",endsAt:"2026-10-18"},"2026-10-19")').runInContext(context),false);
});
test('Il file distribuibile incorpora il catalogo e non dipende dal percorso delle API',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const embedded=JSON.parse(html.match(/<script id="event-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(embedded.events.length,catalog.events.length);
  assert.ok(!html.includes('__EVENT_DATA__'));
  assert.ok(!logic.includes('fetch('));
});
