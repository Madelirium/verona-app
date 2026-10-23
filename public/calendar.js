const payload = JSON.parse(document.getElementById('event-data').textContent);
const events = payload.events;
var agendaReady=false;
const newsData=payload.news||{items:[],sources:[]},newsItems=newsData.items||[];
const busData=payload.bus||{lines:[],alerts:[],sources:[]};
const placesData=payload.places||{items:[]},places=placesData.items||[];
const pharmacyData=payload.pharmacies||{periods:[]};
let pharmacyMode='list',pharmacyScope='city',pharmacyQuery='',pharmacyTimer=null,pharmacyReturnFocus=null,pharmacyMap=null,pharmacyLayer=null,pharmacyMapSignature=null,pharmacyTilesFailed=false;
const districtsData=payload.districts||{items:[]};
const wasteData=payload.waste||{zones:[],centers:[],links:{}};
let wasteSelection=null,wasteTab='collection',wasteEditing=false,wasteDraft=null,wasteReturnFocus=null,wasteAddress=null;
try{const saved=JSON.parse(localStorage.getItem('verona-waste-v1')||'null');if(validateWasteSelection(wasteData,saved))wasteSelection=saved;}catch{}
const districtChoices=districtsData.items.flatMap(d=>[{value:d.id+':*',name:'Tutta la circoscrizione',district:d,quarter:null},...d.quarters.map((q,i)=>({value:d.id+':'+i,name:q,district:d,quarter:q}))]);
let districtChoice='',districtMode='updates',districtSaved=false,districtReturnFocus=null;
try{const stored=JSON.parse(localStorage.getItem('verona-district-v1')||'null');if(districtChoices.some(c=>c.value===stored))districtChoice=stored;}catch{}
let exploreBounds=null,placeMapFocus=null,placeTilesFailed=false;
let exploreNearbyPoint=null;
let exploreMode='map',exploreSaved=false,placeFavorites={},placeMap=null,placeLayer=null,placeMapSignature=null,placeReturnFocus=null,placesShown=60;
try{placeFavorites=JSON.parse(localStorage.getItem('verona-places-v1')||'{}')||{};}catch{}
if(typeof placeFavorites!=='object'||Array.isArray(placeFavorites))placeFavorites={};
let busMode='lines',busFavorites={},busReturnFocus=null,busVisited=false,busAlertScope='all';
const busQueries={lines:'',alerts:''};
const timetableData=payload.busTimetables||{lines:[]};
const busRouteData=payload.busRoutes||{routes:[]};
const busRouteLoads=new Map();
let busRouteMap=null,busRouteLayer=null,busRouteLine=null,busRouteReturnFocus=null,busRouteMode='map',busRouteTileFailed=false;
let timetableMapStopKey='',timetableLine=null,timetableReturnFocus=null,timetableStopChoices=[],timetableChoices={};
try{timetableChoices=JSON.parse(localStorage.getItem('verona-timetables-v1')||'{}')||{};}catch{}
if(typeof timetableChoices!=='object'||Array.isArray(timetableChoices))timetableChoices={};
try{busFavorites=JSON.parse(localStorage.getItem('verona-bus-v1')||'{}')||{};}catch{}
if(typeof busFavorites!=='object'||Array.isArray(busFavorites))busFavorites={};
let newsMode='all',newsBookmarks={},newsReturnFocus=null;
let newsFilters={category:'',type:''};
let newsDeadlineSaves={};
let activeNewsValidityPanel=null;
try{const stored=JSON.parse(localStorage.getItem('verona-news-deadlines-v1')||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))for(const [id,item]of Object.entries(stored))if(item?.id===id&&validSavedDeadline(item))newsDeadlineSaves[id]=item;}catch{}
try{newsBookmarks=JSON.parse(localStorage.getItem('verona-news-v1')||'{}')||{};}catch{}
if(typeof newsBookmarks!=='object'||Array.isArray(newsBookmarks))newsBookmarks={};
const $ = id => document.getElementById(id);
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit' });
const dayCache = new Map();
let today = dayInRome(new Date());
let selected = today, month = today.slice(0,7), onlySaved = false, preferences = {};
let savedMode='upcoming',savedSnapshots={},savedHistoryFailed=false;
let savedVisited=false,eventMapReturn=null,filterSnapshot=null;
let currentUserLocation=null;const mapLocationStates=new Map();
let eventMap=null,eventMapLayer=null,eventMapSignature=null,eventMapSaved=false,eventMapFocus=null;
try { preferences = JSON.parse(localStorage.getItem('verona-events-v1') || '{}') || {}; } catch {}
if(typeof preferences!=='object'||Array.isArray(preferences))preferences={};
let view='home', dismissed={}, lastChoice=null, detailReturnFocus=null, currentDiscovery=null;
let selectedGame='briscola';
try{if(localStorage.getItem('verona-game-choice-v1')==='forza4')selectedGame='forza4';}catch{}
const services=[
  {id:'events',name:'Eventi',icon:'▦',description:'Scopri, salva, partecipa',ready:true},
  {id:'bus',name:'Autobus',icon:'↔',description:'Linee, percorsi e avvisi',ready:true},
  {id:'news',name:'Notizie e Comune',icon:'▤',description:'Resta aggiornato',ready:true},
  {id:'utilities',name:'Servizi utili',icon:'⊞',description:'Farmacie, parcheggi e rifiuti',ready:true},
  {id:'explore',name:'Esplora',icon:'⌖',description:'La mappa delle attività',ready:true}
];
try { dismissed=JSON.parse(localStorage.getItem('verona-dismissed-v1')||'{}')||{}; } catch {}
if(typeof dismissed!=='object'||Array.isArray(dismissed))dismissed={};
try{const cached=JSON.parse(localStorage.getItem('verona-saved-snapshots-v1')||'{}');if(cached&&typeof cached==='object'&&!Array.isArray(cached))for(const [id,e]of Object.entries(cached))if(e&&e.id===id&&typeof e.title==='string'&&typeof e.startsAt==='string'&&typeof e.endsAt==='string'&&Number.isFinite(Date.parse(e.startsAt))&&Number.isFinite(Date.parse(e.endsAt)))savedSnapshots[id]=e;}catch{}
function isSavedEvent(e){return ['interested','going'].includes(preferences[e.id]);}
function isPastSavedEvent(e){return eventDay(e.endsAt)<today;}
function savedEvents(){const catalog=new Map(Object.values(savedSnapshots).map(e=>[e.id,e]));for(const e of events)if(isSavedEvent(e))catalog.set(e.id,e);return [...catalog.values()].filter(isSavedEvent);}
function storeSavedSnapshots(){const next={};for(const e of savedEvents())next[e.id]=e;savedSnapshots=next;try{localStorage.setItem('verona-saved-snapshots-v1',JSON.stringify(next));savedHistoryFailed=false;}catch{savedHistoryFailed=true;}}
function refreshSavedDay(){const next=dayInRome(new Date());if(next===today)return;const followToday=selected===today;today=next;if((onlySaved&&savedMode==='upcoming')||(agendaReady&&followToday&&agendaRange==='day')){selected=today;month=today.slice(0,7);}render();if($('waste-dialog').open&&wasteTab==='collection'&&!wasteEditing)renderWasteCollection();}
function dayInRome(value) { return dayFormatter.format(new Date(value)); }
function eventDay(value) { if(!dayCache.has(value))dayCache.set(value,value.length===10?value:dayInRome(value));return dayCache.get(value); }
function occursOn(event, day) { return eventDay(event.startsAt) <= day && eventDay(event.endsAt) >= day; }
function shiftMonth(value, delta) { const [y,m] = value.split('-').map(Number); return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7); }
function visibleEvents() { const q = $('search').value.toLocaleLowerCase('it'); return (onlySaved?savedEvents():events).filter(e => (!onlySaved||(savedMode==='past'?isPastSavedEvent(e):!isPastSavedEvent(e))) && (!$('source').value || e.source === $('source').value) && (!onlySaved || ['interested','going'].includes(preferences[e.id])) && `${e.title} ${e.location||''}`.toLocaleLowerCase('it').includes(q)&&(!agendaReady||!['calendar','saved','eventmap'].includes(view)||agendaMatches(e))); }
function el(tag, value, cls) { const n=document.createElement(tag); n.textContent=value; if(cls)n.className=cls; return n; }
function formatDay(value, options) { return new Intl.DateTimeFormat('it-IT', {timeZone:'Europe/Rome', ...options}).format(new Date(value+'T12:00:00Z')); }
function save(id, state) {
  lastChoice=null;
  if(state) preferences[id]=state; else delete preferences[id];
  storeSavedSnapshots();
  try { localStorage.setItem('verona-events-v1',JSON.stringify(preferences)); $('feedback').textContent=state==='going'?'Presenza confermata nel tuo calendario.':state?'Evento aggiunto al tuo calendario.':'Evento rimosso dal tuo calendario.'; }
  catch { $('feedback').textContent='Scelta valida per questa visita. Il browser non consente il salvataggio permanente.'; }
  if(view==='district')$('district-feedback').textContent=$('feedback').textContent;
  render();
}
function render() {
  $('page-heading').hidden=view==='home'||view==='bus';
  $('app-shell').classList.toggle('home-layout',view==='home'||view==='bus');
  $('app-shell').classList.toggle('game-session-layout',view==='games'&&Boolean(globalThis.veronaGameSession));
  const filtered=visibleEvents();
  $('month').textContent=formatDay(month+'-01',{month:'long',year:'numeric'});
  $('selected').textContent=formatDay(selected,{weekday:'long',day:'numeric',month:'long'});
  for(const [id,target] of [['home','home'],['discover','discover'],['news','news'],['all','calendar'],['saved','saved'],['games','games']]){
    const active=view===target||(target==='calendar'&&view==='eventmap');$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));
  }
  $('home-view').hidden=view!=='home';$('news-view').hidden=view!=='news';$('discover-view').hidden=view!=='discover';$('calendar-view').hidden=!['calendar','saved'].includes(view)||Boolean(view==='saved'&&typeof savedHubReady!=='undefined'&&savedHubReady);
  $('saved-view').hidden=view!=='saved'||typeof savedHubReady==='undefined'||!savedHubReady;
  $('bus-view').hidden=view!=='bus';
  $('event-map-view').hidden=view!=='eventmap';
  $('explore-view').hidden=view!=='explore';
  $('district-view').hidden=view!=='district';
  $('games-view').hidden=view!=='games';
  $('open-filters').hidden=['home','explore','district','news','bus','games'].includes(view)||Boolean(view==='saved'&&typeof savedHubReady!=='undefined'&&savedHubReady);
  $('page-title').textContent=view==='home'?'':view==='district'?'Il mio quartiere':view==='explore'?'Esplora Verona':view==='bus'?'Autobus':view==='news'?'Notizie e Comune':view==='discover'?'Scopri Verona':onlySaved?'I tuoi salvati':'Il calendario';
  $('page-intro').textContent=view==='home'?'':view==='district'?'Notizie e iniziative della tua zona.':view==='explore'?'Piccole scoperte, vicino a te.':view==='bus'?'ATV · percorsi e orari programmati':view==='news'?'Ultime pubblicazioni · Comune di Verona':view==='discover'?'Il tuo prossimo programma è qui.':onlySaved?'Da “mi interessa” a “ci vediamo lì”.':'Scegli un giorno. Trova qualcosa di bello.';
  $('filter-dot').hidden=!($('search').value||$('source').value||($('period').value&&$('period').value!=='30')||($('collection').value&&$('collection').value!=='all'));
  if(view!=='saved'||typeof savedHubReady==='undefined'||!savedHubReady)renderAgenda(filtered);
  if(view==='saved'&&typeof savedHubReady!=='undefined'&&savedHubReady){$('page-intro').textContent='Tutto quello che vuoi ritrovare.';renderSavedHub();}
  const monthly=filtered.filter(e=>eventDay(e.startsAt)<=month+'-31'&&eventDay(e.endsAt)>=month+'-01').length;
  $('status').textContent=`${monthly} appuntamenti nel mese · ${events.length} nel catalogo · Dati raccolti il ${payload.updatedAt?formatDay(dayInRome(payload.updatedAt),{day:'numeric',month:'long',year:'numeric'}):'nessuna raccolta riuscita'}`;
  renderEventFreshness();
  if(view==='discover')renderDiscovery();
  if(view==='home'){currentDiscovery=null;renderHome();}
  if(view==='news'){currentDiscovery=null;renderNews();}
  if(view==='bus'){currentDiscovery=null;renderBus();}
  if(view==='eventmap'){currentDiscovery=null;$('page-title').textContent='Eventi sulla mappa';$('page-intro').textContent='Scegli quando. Scopri dove.';renderEventMap();}
  if(view==='explore'){currentDiscovery=null;renderExplore();}
  if(view==='district'){currentDiscovery=null;$('page-title').textContent='Il mio quartiere';$('page-intro').textContent='La vita della tua zona, a portata di mano.';renderDistrict();}
  if(view==='games'){currentDiscovery=null;$('page-title').textContent=selectedGame==='forza4'?'Forza 4':'Briscola';$('page-intro').textContent='Un tavolo per due. Invita chi vuoi.';}
}
function officialArchiveStatus(){return datasetStatus(payload.busOfficial||{},{calendar:true});}
function renderDataHealth(){
  const box=$('data-health');box.replaceChildren();
  const catalogues=[['Eventi',{...payload,sources:payload.importReport?.sources||[]},{maxAgeHours:48}],['Notizie e Comune',newsData,{maxAgeHours:48}],['Orari autobus',payload.busOfficial||{},{calendar:true}],['Luoghi e attività',payload.places||{},{}],['Parcheggi',payload.parking||{},{}]];
  for(const [name,data,options]of catalogues){const status=datasetStatus(data,options),card=el('section','','data-health-card');card.setAttribute('data-state',status.state);card.append(el('h3',name),el('p',status.message));
    const date=status.updatedAt?new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(status.updatedAt)):'non disponibile';card.append(el('small',(options.calendar?'Pubblicazione archivio: ':'Ultima raccolta riuscita: ')+date));
    if(options.calendar){card.append(el('p','Orari programmati, senza ritardi in tempo reale. Puoi consultare le date coperte anche se l’archivio non copre oggi.'));const link=el('a','Verifica gli orari sul sito ATV ↗','detail-link');link.href='https://www.atv.verona.it/Linee_e_orari_autobus';link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
    box.append(card);
  }
  const status=officialArchiveStatus(),warning=$('network-data-warning');warning.hidden=status.state==='current';warning.textContent=status.state==='expiring'?'Orari fino al '+status.validTo.split('-').reverse().join('/')+' · Dettagli':'Orari da verificare · Dettagli';warning.setAttribute('aria-label',status.message+' Apri informazioni sui dati');
}
function openDataHealth(){renderDataHealth();$('info-dialog').showModal();}
function refreshDataHealth(){
  renderDataHealth();
  if(view==='bus')renderBus();
  if(typeof officialBusData!=='undefined'&&officialBusData&&$('official-bus-dialog').open)renderOfficialTimes();
  if(typeof networkChosenStop!=='undefined'&&networkChosenStop&&typeof networkIsOpen==='function'&&networkIsOpen())renderNetworkStopPanel();
}
function renderEventFreshness(){
  const report=payload.importReport,box=$('event-source-status');box.replaceChildren();
  const sources=report?.sources||[...new Set(events.map(e=>e.source))].map(source=>({source,status:'ok',lastSuccessAt:events.filter(e=>e.source===source).map(e=>e.checkedAt).filter(Boolean).sort().at(-1)}));
  for(const source of sources){const date=source.lastSuccessAt?new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(source.lastSuccessAt)):'mai riuscito';box.append(el('p',source.source+' · Ultimo aggiornamento riuscito: '+date+(source.status==='error'?'. Ultimo tentativo non riuscito: dati precedenti conservati.':'.')));}
  const health=datasetStatus({...payload,sources},{maxAgeHours:48});
  const warning=$('event-update-warning');warning.hidden=health.state==='current';warning.textContent=warning.hidden?'':health.message+' Dettagli in ⓘ.';
  if(report?.checkedAt)box.append(el('p','Ultimo tentativo: '+new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(report.checkedAt))+'. La raccolta non rileva automaticamente tutte le cancellazioni o variazioni.','detail-note'));
}
function shiftDay(day,delta){return new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);}
function selectAgendaDay(day){if(agendaReady)agendaRange='day';selected=day;month=day.slice(0,7);$('feedback').textContent='';render();$('events').scrollTop=0;}
function focusAgendaDay(key,monthly){const button=Array.from($(monthly?'grid':'week-grid').children).find(b=>b.getAttribute('data-day')===key);button?.focus();}
function agendaDays(filtered,container,keys,monthly=false){
  container.replaceChildren();
  for(const key of keys){
    const matches=filtered.filter(e=>occursOn(e,key)),button=el('button','',monthly?'day':'week-day');button.type='button';
    button.classList.toggle('outside',!key.startsWith(month));button.classList.toggle('selected',key===selected);button.classList.toggle('today',key===today);
    button.setAttribute('data-day',key);button.setAttribute('aria-pressed',String(key===selected));button.setAttribute('aria-label',`${formatDay(key,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}, ${matches.length} eventi`);
    if(agendaReady){const saved=matches.filter(isSavedEvent).length;button.classList.toggle('has-saved',saved>0);if(saved)button.setAttribute('aria-label',button.getAttribute('aria-label')+', '+saved+' salvati');}
    if(!monthly)button.append(el('span',formatDay(key,{weekday:'short'}),'weekday'));
    button.append(el('span',String(Number(key.slice(-2))),'number'));
    const deadlines=deadlineDayRows(key).length;if(deadlines){button.classList.toggle('has-saved',true);button.setAttribute('aria-label',button.getAttribute('aria-label')+', '+deadlines+' scadenze personali');}
    if(monthly&&(matches.length||deadlines))button.append(el('span','','event-chip'));
    if(!monthly)button.append(el('span',matches.length||deadlines?String(matches.length+deadlines):'–','day-count'));
    button.onclick=()=>{selectAgendaDay(key);if(monthly)$('month-dialog').close();else focusAgendaDay(key,false)};
    button.addEventListener('keydown',event=>{
      let target;const delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7}[event.key];
      if(delta)target=shiftDay(key,delta);
      const offset=(new Date(key+'T12:00:00Z').getUTCDay()+6)%7;
      if(event.key==='Home')target=shiftDay(key,-offset);if(event.key==='End')target=shiftDay(key,6-offset);
      if(!target)return;event.preventDefault();
      if(monthly){month=target.slice(0,7);renderMonth(visibleEvents());focusAgendaDay(target,true)}else{selectAgendaDay(target);focusAgendaDay(target,false)}
    });container.append(button);
  }
}
function renderMonth(filtered){
  const first=month+'-01',offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7,days=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
  $('month').textContent=formatDay(first,{month:'long',year:'numeric'});
  agendaDays(filtered,$('grid'),Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>shiftDay(first,i-offset)),true);
}
function agendaTime(e){
  if(eventDay(e.startsAt)<selected&&eventDay(e.endsAt)>=selected)return 'In corso · fino al '+formatDay(eventDay(e.endsAt),{day:'numeric',month:'short'});
  if(e.startsAt.length===10)return 'Orario non indicato';
  return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(e.startsAt));
}
function renderAgenda(filtered){
  const past=onlySaved&&savedMode==='past';
  $('saved-event-tabs').hidden=!onlySaved;$('agenda-picker').hidden=past;
  for(const [id,mode]of [['saved-upcoming','upcoming'],['saved-past','past']]){const button=$(id);button.setAttribute('aria-pressed',String(savedMode===mode));button.classList.toggle('active',savedMode===mode);}
  $('saved-history-note').hidden=!onlySaved;
  $('events').setAttribute('aria-label',past?'Eventi passati salvati':'Eventi del giorno');
  $('saved-history-note').textContent=savedHistoryFailed?'Lo storico è disponibile per questa visita: il browser non consente di conservarlo.':'Gli eventi passano nei passati dal giorno successivo alla data finale. Storico conservato su questo dispositivo.';

  const monday=shiftDay(selected,-((new Date(selected+'T12:00:00Z').getUTCDay()+6)%7));
  $('agenda-month').textContent=formatDay(selected,{month:'long',year:'numeric'});
  $('week-range').textContent=formatDay(monday,{day:'numeric',month:'short'})+' – '+formatDay(shiftDay(monday,6),{day:'numeric',month:'short'});
  agendaDays(filtered,$('week-grid'),Array.from({length:7},(_,i)=>shiftDay(monday,i)));if($('month-dialog').open)renderMonth(filtered);
  const chips=$('agenda-filters');chips.replaceChildren();
  for(const id of ['search','source'])if($(id).value){const b=el('button',$(id).value+' ×');b.setAttribute('aria-label','Rimuovi filtro: '+$(id).value);b.onclick=()=>{$(id).value='';render()};chips.append(b)}chips.hidden=!chips.children.length;
  if(agendaReady)return renderEnhancedAgenda(filtered,past);
  const group=e=>eventDay(e.startsAt)<selected?1:e.startsAt.length===10?2:0;
  const daily=(past?[...filtered].sort((a,b)=>b.endsAt.localeCompare(a.endsAt)):filtered.filter(e=>occursOn(e,selected)).sort((a,b)=>group(a)-group(b)||Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.title.localeCompare(b.title,'it')));
  if(past)$('selected').textContent='Eventi passati';
  $('count').textContent=`${daily.length} ${daily.length===1?'appuntamento':'appuntamenti'}${onlySaved?' nel tuo calendario':''}`;
  const list=$('events');list.replaceChildren();
  if(!daily.length){
    const box=el('div','','agenda-empty');box.append(el('h3',past?'Non hai ancora eventi passati.':onlySaved?'Non hai eventi salvati per questo giorno.':'Nessun evento per questo giorno.'),el('p',past?'Qui compariranno automaticamente i tuoi eventi salvati dopo la data finale.':onlySaved?'Esplora gli eventi e salva i tuoi prossimi programmi.':'Prova una data diversa o modifica i filtri.'));
    if($('search').value||$('source').value){const reset=el('button','Rimuovi ricerca e filtri');reset.onclick=()=>{$('search').value='';$('source').value='';render()};box.append(reset)}
    const next=filtered.filter(e=>eventDay(e.startsAt)>selected).sort((a,b)=>a.startsAt.localeCompare(b.startsAt))[0];
    if(next){const b=el('button','Prossimi eventi · '+formatDay(eventDay(next.startsAt),{day:'numeric',month:'short'}));b.onclick=()=>selectAgendaDay(eventDay(next.startsAt));box.append(b)}
    const discover=el('button',onlySaved?'Scopri eventi da salvare':'Sfoglia gli eventi');discover.onclick=()=>setView('discover');box.append(discover);list.append(box);
  }
  for(const e of daily){
    const card=el('article','','event-card'),meta=el('div','','agenda-meta'),state=preferences[e.id];meta.append(el('span',past?eventWhen(e):agendaTime(e),'agenda-time'));
    if(state)meta.append(el('span',state==='going'?(past?'✓ Partecipazione confermata':'✓ Partecipi'):(past?'♡ Ti interessava':'♡ Ti interessa'),'agenda-state'+(state==='going'?' going':'' )));
    card.append(meta);const agendaImage=eventImage(e);if(agendaImage){const thumb=makeEventImage(e,'event-thumbnail');thumb.loading='lazy';card.append(thumb);}card.append(el('h3',e.title),el('p',e.location||'Sede da verificare sulla fonte'),el('span',e.source,'source'));
    const actions=el('div','','actions'),saveButton=el('button',state?'✓ Salvato':'♡ Salva',state?'chosen':'');
    saveButton.setAttribute('aria-label',(state?'Gestisci evento salvato: ':'Salva: ')+e.title);saveButton.onclick=()=>{if(state)openDetails(e);else{save(e.id,'interested');$('events').focus()}};
    const detail=el('button','Dettagli →');detail.setAttribute('aria-label','Dettagli: '+e.title);detail.onclick=()=>openDetails(e);
    actions.append(saveButton,detail);if(agendaImage)card.append(el('small',eventImageCredit(agendaImage)+' · Crediti nei dettagli','event-image-credit'));card.append(actions);list.append(card);
  }
}
function currentDistrict(){return districtChoices.find(c=>c.value===districtChoice)||null;}
function districtMatch(item){const chosen=currentDistrict();if(!chosen)return null;return (item.districtMatches||[]).find(m=>m.id===chosen.district.id&&(m.explicit||!chosen.quarter||m.quarters.includes(chosen.quarter)))||null;}
function districtRows(){
  const q=$('district-search').value.trim().toLocaleLowerCase('it'),isEvent=districtMode==='events';
  return (isEvent?events:newsItems).filter(i=>{
    if(isEvent&&(i.endsAt.length===10?eventDay(i.endsAt)<today:Date.parse(i.endsAt)<Date.now()))return false;
    if(districtMode==='city'?(i.districtMatches||[]).length>0:!districtMatch(i))return false;
    if(districtMode==='updates'&&!districtSaved&&(['expired','withdrawn'].includes(newsValidity(i).state)||newsPastSeason(i,today)||(newsValidity(i).state!=='open'&&i.publishedOn<shiftDay(today,-30))))return false;
    if(districtMode==='news'&&i.sourceKey!=='notizie'||districtMode==='notices'&&i.sourceKey!=='avvisi')return false;
    if(districtSaved&&!(isEvent?['interested','going'].includes(preferences[i.id]):newsBookmarks[i.id]))return false;
    return `${i.title} ${i.summary||''} ${i.location||''}`.toLocaleLowerCase('it').includes(q);
  }).sort((a,b)=>isEvent?a.startsAt.localeCompare(b.startsAt):b.publishedOn.localeCompare(a.publishedOn));
}
function districtReason(item){const m=districtMatch(item);return m?.explicit?`Circoscrizione ${m.id} indicata nel testo`:m?`Nome della zona nella ${districtMode==='events'?'sede':'pubblicazione'}: ${m.quarters.join(', ')}`:'Zona non indicata nella pubblicazione';}
function openDistrictChoice(){
  districtReturnFocus=document.activeElement;
  const select=$('district-choice');select.replaceChildren();const empty=el('option','Scegli una zona…');empty.value='';select.append(empty);
  for(const d of districtsData.items){const group=el('optgroup','');group.label=`Circoscrizione ${d.id} · ${d.name}`;for(const c of districtChoices.filter(c=>c.district.id===d.id)){const option=el('option',c.name);option.value=c.value;group.append(option);}select.append(group);}
  select.value=districtChoice;$('apply-district').disabled=!districtChoice;if(typeof renderDistrictPicker==='function'){$('district-picker-search').value='';renderDistrictPicker();}$('district-dialog').showModal();$('close-district').focus();
}
function applyDistrict(value){
  if(value&&!districtChoices.some(c=>c.value===value))return;
  districtChoice=value;$('district-feedback').textContent='';
  try{localStorage.setItem('verona-district-v1',JSON.stringify(value));}catch{$('district-feedback').textContent='Zona selezionata per questa visita. Il browser non consente il salvataggio.';}
  $('district-dialog').close();$('district-search').value='';districtSaved=false;if(view==='news')newsMode='zone';else districtMode='updates';if(typeof renderAreaPreferences==='function'){markAreaWelcomeSeen();renderAreaPreferences();}render();$('district-list').scrollTop=0;if(view==='news'&&currentDistrict())$('news-zone').focus();else if(districtReturnFocus?.isConnected)districtReturnFocus.focus({preventScroll:true});
}
function renderDistrict(){
  renderWasteEntry();
  const chosen=currentDistrict(),isEvent=districtMode==='events';
  if(typeof renderDistrictControls==='function')renderDistrictControls();
  $('district-name').textContent=chosen?(chosen.quarter||chosen.district.name):'La tua zona, ogni giorno.';
  $('district-area').textContent=chosen?`Circoscrizione ${chosen.district.id} · ${chosen.district.name}`:'Scegli il tuo quartiere a Verona';
  $('district-change').textContent=chosen?'Cambia →':'Scegli →';
  $('district-saved').classList.toggle('active',districtSaved);$('district-saved').setAttribute('aria-pressed',String(districtSaved));
  for(const [id,mode]of [['district-updates','updates'],['district-news','news'],['district-notices','notices'],['district-events','events'],['district-city','city']]){$(id).classList.toggle('active',districtMode===mode);$(id).setAttribute('aria-pressed',String(districtMode===mode));}
  if(typeof renderDistrictControls==='function')renderDistrictControls();
  $('district-office').href=chosen?chosen.district.sourceUrl:districtsData.sourceUrl;
  $('district-office').textContent=chosen?'La circoscrizione ↗':'Le circoscrizioni ↗';
  const updated=isEvent?payload.updatedAt:newsData.updatedAt;
  $('district-updated').textContent=updated?'Dati del '+formatDay(dayInRome(updated),{day:'numeric',month:'short'}):'Dati non disponibili';
  const list=$('district-list');list.replaceChildren();
  if(!chosen&&districtMode!=='city'){
    $('district-summary').textContent='';
    const card=el('div','','district-onboarding');const b=el('button','Scegli il mio quartiere');b.onclick=openDistrictChoice;
    card.append(el('span','⌂','district-symbol'),el('h2','Qual è il tuo quartiere?'),el('p','Sceglilo una volta per ritrovare qui notizie, avvisi e iniziative della zona.'),b,el('p','Puoi cambiare zona in ogni momento.'));list.append(card);return;
  }
  const rows=districtRows();
  $('district-summary').textContent=`${rows.length} ${isEvent?'appuntamenti futuri':'pubblicazioni'}${districtSaved?' salvati':''} · `+(districtMode==='city'?'Dal Comune, senza zona indicata. Non necessariamente riferite al tuo quartiere.':isEvent?'Zona ricavata dalla sede riportata. Verifica i dettagli.':'Quartiere e circoscrizione citati nei testi. Raccolta parziale.');
  if(districtMode==='updates')$('district-summary').textContent=rows.length+(districtSaved?' notizie e avvisi salvati della zona':' notizie e avvisi della zona · ultimi 30 giorni e scadenze aperte');
  if(!isEvent&&newsData.sources?.some(s=>s.status==='error'))$('district-summary').textContent+=' Aggiornamento incompleto: verifica la fonte.';
  if(!rows.length){const card=el('div','','district-onboarding');card.append(el('h2',districtSaved?'Nessun contenuto salvato.':'Per ora non ci sono risultati.'),el('p',districtSaved?'Salva una notizia o un evento per ritrovarlo qui.':'La raccolta può non includere tutte le iniziative della zona. Prova un’altra scheda o cambia ricerca.'));const b=el('button',districtSaved?'Mostra tutti':$('district-search').value?'Azzera ricerca':'Leggi dal Comune');b.onclick=()=>{if(districtSaved)districtSaved=false;else if($('district-search').value)$('district-search').value='';else districtMode='city';render()};card.append(b);list.append(card);return;}
  for(const item of rows){
    const card=el('article','','news-card'),meta=el('div','','news-card-meta');
    meta.append(el('span',isEvent?'Evento':item.kind,'news-kind'),el('span',isEvent?eventWhen(item):formatDay(item.publishedOn,{day:'numeric',month:'short',year:'numeric'})));
    const title=el('button',item.title,'news-title');title.setAttribute('data-focus-key','district-open-'+item.id);title.onclick=()=>isEvent?openDetails(item):openNews(item);if(!isEvent)appendNewsThumbnail(title,item);
    card.append(meta,title,el('p',isEvent?(item.location||'Consulta la sede sulla fonte'):item.summary),el('p',districtReason(item),'district-match'));
    if(isEvent){const actions=el('div','','actions');const state=preferences[item.id];for(const [label,value]of [['Mi interessa','interested'],['Partecipo','going']]){const b=el('button',(state===value?'✓ ':'')+label,state===value?'chosen':'');b.setAttribute('aria-pressed',String(state===value));b.setAttribute('data-focus-key','district-'+value+'-'+item.id);b.onclick=()=>save(item.id,state===value?(value==='going'?'interested':null):value);actions.append(b);}if(state){const remove=el('button','Rimuovi');remove.setAttribute('data-focus-key','district-remove-'+item.id);remove.onclick=()=>save(item.id,null);actions.append(remove);}card.append(actions);}
    else{appendNewsImageCredit(card,item);const bottom=el('div','','news-card-bottom');bottom.append(el('span','Comune di Verona','news-category'),newsSaveButton(item));card.append(bottom);}
    list.append(card);
  }
}
function eventPosition(e){const p=e.coordinates;if(e.mapDisabled||!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.lat<44.5||p.lat>46.3||p.lon<10||p.lon>12)return null;return p;}
function eventMapEvents(){const days=Number($('event-map-period').value||1);const end=new Date(Date.parse(selected+'T12:00:00Z')+(days-1)*86400000).toISOString().slice(0,10);return visibleEvents().filter(e=>eventDay(e.startsAt)<=end&&eventDay(e.endsAt)>=selected&&(!eventMapSaved||['interested','going'].includes(preferences[e.id])));}
function openEventMap(event=null){if(view!=='eventmap')eventMapReturn={view:['calendar','saved','explore'].includes(view)?view:'calendar',selected,search:$('search').value,source:$('source').value,scroll:$('events').scrollTop||0,agenda:agendaReady?captureAgendaState():null};if(event){if(agendaReady){agendaRange='day';for(const id of agendaFilterIds)$(id).value='';}selected=eventDay(event.startsAt);month=selected.slice(0,7);eventMapFocus=event.id;eventMapSaved=false;$('search').value='';$('source').value='';$('event-map-period').value='1';}else eventMapFocus=null;setView('eventmap');}
function renderEventMap(){
  $('event-map-back').textContent=eventMapReturn?.view==='explore'?'← Esplora':'← Calendario';
  $('event-map-date').value=selected;$('event-map-saved').classList.toggle('active',eventMapSaved);$('event-map-saved').setAttribute('aria-pressed',String(eventMapSaved));
  const all=eventMapEvents(),mapped=all.filter(e=>eventPosition(e)),groups=new Map();
  for(const e of mapped){const p=eventPosition(e),key=`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
  $('event-map-count').textContent=`${mapped.length} appuntamenti · ${groups.size} luoghi · ${all.length-mapped.length} senza posizione certa`;
  $('event-map-unlocated').hidden=all.length===mapped.length;$('event-map-unlocated').textContent=`Vedi nel calendario anche i ${all.length-mapped.length} senza posizione →`;
  const message=$('events-map-message');
  if(typeof L==='undefined'){message.textContent='Mappa non disponibile. Gli eventi restano consultabili nel calendario.';return;}
  if(!eventMap){eventMap=L.map('events-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer(placesData.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{message.textContent='Le strade non si caricano. Controlla la connessione o usa il calendario.';}).addTo(eventMap);eventMapLayer=L.layerGroup().addTo(eventMap);}
  installMapLocation(eventMap,'events');eventMap.invalidateSize();
  const signature=mapped.map(e=>e.id+':'+(preferences[e.id]||'')).join(',')+'|'+eventMapFocus;if(signature===eventMapSignature)return;
  eventMapSignature=signature;eventMapLayer.clearLayers();message.textContent=mapped.length?'':'Nessuna posizione disponibile con questi filtri. Cambia giorno o apri il calendario.';
  let focusMarker=null;
  for(const group of groups.values()){
    const p=eventPosition(group[0]),popup=el('div','','event-popup');popup.append(el('h3',`${group.length} appuntamenti in questo punto`));
    for(const e of [...group].sort((a,b)=>a.startsAt.localeCompare(b.startsAt))){const b=el('button',e.title);b.append(el('small',eventWhen(e)));b.onclick=()=>openDetails(e);popup.append(b);}
    const color=group.some(e=>preferences[e.id]==='going')?'#345f45':group.some(e=>preferences[e.id]==='interested')?'#c38b42':'#738b5a';
    const marker=L.circleMarker([p.lat,p.lon],{radius:10,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).bindPopup(popup).addTo(eventMapLayer);
    if(group.some(e=>e.id===eventMapFocus))focusMarker={marker,position:p};
  }
  if(focusMarker){eventMap.setView([focusMarker.position.lat,focusMarker.position.lon],16);focusMarker.marker.openPopup();}
  else if(mapped.length)eventMap.fitBounds(mapped.map(e=>[eventPosition(e).lat,eventPosition(e).lon]),{padding:[28,28],maxZoom:15});
}
function placeSearchText(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it').replace(/[^a-z0-9]+/g,' ').trim();}
function exploreDistance(point,place){const rad=Math.PI/180,a=(place.lat-point.lat)*rad,b=(place.lon-point.lon)*rad,h=Math.sin(a/2)**2+Math.cos(point.lat*rad)*Math.cos(place.lat*rad)*Math.sin(b/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function exploreCategoryMatches(place,category){const groups={food:['Bar e caffè','Ristoranti'],shops:['Negozi','Artigiani'],services:['Servizi','Farmacie']};return !category||(groups[category]?groups[category].includes(place.category):place.category===category);}
function filteredPlaces(){const words=placeSearchText($('explore-search').value).split(' ').filter(Boolean);const rows=places.filter(p=>exploreCategoryMatches(p,$('explore-category').value)&&(!exploreSaved||placeFavorites[p.id])&&(!exploreBounds||(p.lat>=exploreBounds.south&&p.lat<=exploreBounds.north&&p.lon>=exploreBounds.west&&p.lon<=exploreBounds.east))&&(!exploreNearbyPoint||exploreDistance(exploreNearbyPoint,p)<=1000)&&words.every(word=>placeSearchText(`${p.name} ${p.address||''} ${p.category}`).includes(word)));return exploreNearbyPoint?rows.sort((a,b)=>exploreDistance(exploreNearbyPoint,a)-exploreDistance(exploreNearbyPoint,b)||a.id.localeCompare(b.id)):rows;}
function resetExplore(){$('explore-feedback').textContent='';exploreBounds=null;exploreNearbyPoint=null;placeMapFocus=null;exploreSaved=false;placesShown=60;$('explore-search').value='';$('explore-category').value='';placeMapSignature=null;renderExplore();}

function togglePlace(id){if(placeFavorites[id])delete placeFavorites[id];else placeFavorites[id]=true;try{localStorage.setItem('verona-places-v1',JSON.stringify(placeFavorites));$('explore-feedback').textContent=placeFavorites[id]?'Attività salvata nei preferiti.':'Attività rimossa dai preferiti.';}catch{$('explore-feedback').textContent='Scelta disponibile per questa visita. Il browser non consente il salvataggio.';}if(view==='saved')$('saved-feedback').textContent=$('explore-feedback').textContent;render();}
function placeStar(place){const b=el('button',placeFavorites[place.id]?'★':'☆','bus-favorite'+(placeFavorites[place.id]?' chosen':''));b.type='button';b.setAttribute('data-focus-key','place-save-'+place.id);b.setAttribute('aria-label',`${placeFavorites[place.id]?'Rimuovi dai':'Aggiungi ai'} preferiti: ${place.name}`);b.setAttribute('aria-pressed',String(Boolean(placeFavorites[place.id])));b.onclick=()=>togglePlace(place.id);return b;}
function renderExplore(){
  refreshPharmacyEntry();
  for(const [id,category]of [['explore-quick-all',''],['explore-quick-food','food'],['explore-quick-shops','shops'],['explore-quick-services','services']])$(id).setAttribute('aria-pressed',String($('explore-category').value===category));
  $('explore-nearby-open').hidden=exploreMode!=='map';
  $('explore-needs-open').textContent=$('explore-category').value||exploreSaved?'Filtri •':'Filtri';
  const matches=filteredPlaces();
  $('explore-map-tab').classList.toggle('active',exploreMode==='map');$('explore-list-tab').classList.toggle('active',exploreMode==='list');
  $('explore-map-tab').setAttribute('aria-pressed',String(exploreMode==='map'));$('explore-list-tab').setAttribute('aria-pressed',String(exploreMode==='list'));
  $('explore-saved').classList.toggle('active',exploreSaved);$('explore-saved').setAttribute('aria-pressed',String(exploreSaved));
  $('places-map').hidden=exploreMode!=='map';$('places-list').hidden=exploreMode!=='list';$('places-map-message').hidden=exploreMode!=='map';
  const categoryLabel={food:'Mangiare',shops:'Negozi',services:'Servizi'}[$('explore-category').value]||$('explore-category').value;
  $('explore-count').textContent=`${matches.length} luoghi${categoryLabel?' · '+categoryLabel:''}${exploreSaved?' · preferiti':''}${exploreNearbyPoint?' · entro 1 km, in linea d’aria':exploreBounds?' · zona selezionata':''}${placesData.status==='error'?' · aggiornamento non riuscito':''}`;$('explore-reset').hidden=!exploreNearbyPoint&&!exploreBounds&&!exploreSaved&&!$('explore-search').value&&!$('explore-category').value;$('explore-search-area').hidden=exploreMode!=='map';$('explore-search-area').disabled=!placeMap;
  if(typeof renderExploreNeedHint==='function')renderExploreNeedHint();
  const list=$('places-list');list.replaceChildren();
  if(!matches.length){list.append(el('p',exploreNearbyPoint?'Nessuna attività del catalogo entro 1 km con questi filtri. Il catalogo è parziale: puoi cambiare zona o ripristinare i filtri.':exploreSaved?'Nessun preferito con questi filtri. Salva un’attività con la stella.':'Nessuna attività trovata. Prova un’altra categoria o una ricerca diversa.','place-empty'));const reset=el('button','Mostra tutte le attività','places-more');reset.onclick=resetExplore;list.append(reset);}
  for(const p of matches.slice(0,placesShown)){const card=el('article','','place-card'),open=el('button','','place-open');open.type='button';open.setAttribute('data-focus-key','place-open-'+p.id);open.append(el('span',p.category,'place-category'),el('strong',p.name),el('p',p.address||'Indirizzo non indicato · posizione sulla mappa'));if(exploreNearbyPoint)open.append(el('small','Circa '+Math.round(exploreDistance(exploreNearbyPoint,p)/10)*10+' m in linea d’aria','place-services'));const available=[p.website?'Sito web':'',p.phone?'Telefono':'',p.openingHours?'Orari indicati':''].filter(Boolean);if(available.length)open.append(el('small',available.join(' · '),'place-services'));open.onclick=()=>openPlace(p);card.append(open,placeStar(p));list.append(card);}
  if(matches.length>placesShown){const more=el('button','Mostra altre attività','places-more');more.onclick=()=>{placesShown+=60;renderExplore()};list.append(more);}
  if(exploreMode==='map')renderPlacesMap(matches);
}
function renderPlacesMap(matches){
  const message=$('places-map-message');
  if(typeof L==='undefined'){message.textContent='Mappa non disponibile. Apri Elenco per consultare le attività.';return;}
  if(!placeMap){placeMap=L.map('places-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer(placesData.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',updateWhenIdle:true}).on('tileerror',()=>{placeTilesFailed=true;message.textContent='Le strade non si caricano: controlla la connessione oppure usa Elenco.';}).addTo(placeMap);placeLayer=L.layerGroup().addTo(placeMap);}
  installMapLocation(placeMap,'places');$('explore-search-area').disabled=false;placeMap.invalidateSize();
  const signature=matches.map(p=>p.id).join(',')+'|'+placeMapFocus;if(signature===placeMapSignature)return;
  placeMapSignature=signature;placeLayer.clearLayers();message.textContent=placeTilesFailed?'Le strade non si caricano: controlla la connessione oppure usa Elenco.':matches.length?'':'Nessuna attività con questi filtri. Usa Ripristina per tornare a tutte le attività.';
  const colors={'Bar e caffè':'#a16c42','Ristoranti':'#ab635b','Negozi':'#536e9b','Artigiani':'#897043','Farmacie':'#4c896c','Sport':'#83719c','Servizi':'#5c7f7d'};
  for(const p of matches){const popup=el('div','','map-popup');popup.append(el('strong',p.name),el('span',p.category));if(exploreNearbyPoint)popup.append(el('p',placeDistanceLabel(p),'place-popup-distance'));const b=el('button','Apri dettagli →');b.setAttribute('data-focus-key','place-map-open-'+p.id);b.onclick=()=>openPlace(p);popup.append(b);const directions=el('a','Come arrivare ↗');directions.href=placeDirectionsUrl(p);directions.target='_blank';directions.rel='noopener noreferrer';popup.append(directions);const marker=L.circleMarker([p.lat,p.lon],{radius:p.id===placeMapFocus?11:7,color:p.id===placeMapFocus?'#254f78':'#fff',weight:2,fillColor:colors[p.category]||'#507447',fillOpacity:.95}).bindPopup(popup).addTo(placeLayer);if(p.id===placeMapFocus)marker.openPopup();}
  const focus=matches.find(p=>p.id===placeMapFocus);if(focus)placeMap.setView([focus.lat,focus.lon],17);else if(exploreNearbyPoint)placeMap.fitBounds([[exploreNearbyPoint.lat,exploreNearbyPoint.lon],...matches.map(p=>[p.lat,p.lon])],{padding:[25,25],maxZoom:16});else if(matches.length&&!exploreBounds)placeMap.fitBounds(matches.map(p=>[p.lat,p.lon]),{padding:[25,25],maxZoom:16});
}
function placeDirectionsUrl(p){return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;}
function placeDistanceLabel(p){return 'Circa '+Math.round(exploreDistance(exploreNearbyPoint,p)/10)*10+' m in linea d’aria';}
function openPlace(p){
  placeReturnFocus=document.activeElement;const content=$('place-detail-content');content.replaceChildren();const title=el('h2',p.name);title.id='place-detail-title';
  content.append(el('span',p.category,'source'),title,el('p',p.address||'Indirizzo non disponibile. Usa la posizione sulla mappa.'),el('p','Dati della community OpenStreetMap, non ancora verificati dal titolare.','detail-note'));
  if(exploreNearbyPoint)content.append(el('p',placeDistanceLabel(p),'place-distance'));
  $('place-feedback').textContent='';const saveButton=$('place-save');const refreshSave=()=>{const saved=Boolean(placeFavorites[p.id]);saveButton.textContent=saved?'✓ Salvato':'☆ Salva luogo';saveButton.setAttribute('aria-pressed',String(saved));saveButton.setAttribute('aria-label',(saved?'Rimuovi dai preferiti: ':'Salva luogo: ')+p.name);};refreshSave();saveButton.onclick=()=>{togglePlace(p.id);refreshSave();$('place-feedback').textContent=$('explore-feedback').textContent;};$('place-directions').href=placeDirectionsUrl(p);
  if(p.category==='Farmacie'){const duty=el('button','Cerca le farmacie di turno','dialog-save');duty.onclick=()=>{$('place-detail-dialog').close();openPharmacies();};content.append(el('p','Gli orari ordinari non indicano il turno farmaceutico.','detail-note'),duty);}
  const mapButton=el('button','⌖ Mostra sulla mappa','dialog-save');mapButton.onclick=()=>{$('place-detail-dialog').close();if(!filteredPlaces().some(item=>item.id===p.id))resetExplore();placeMapFocus=p.id;exploreMode='map';if(view!=='explore')setView('explore');else renderExplore();$('explore-map-tab').focus()};content.append(mapButton);
  if(p.openingHours)content.append(el('h3','Orari riportati nella fonte'),el('p',p.openingHours,'place-hours'));else content.append(el('p','Orari non disponibili. Verifica direttamente con l’attività.','detail-note'));
  if(p.wheelchair)content.append(el('p',`Accesso in sedia a rotelle indicato nella fonte: ${{yes:'sì',no:'no',limited:'limitato'}[p.wheelchair]}. Da verificare con l’attività.`,'detail-note'));
  const links=el('div','','place-links');const addLink=(label,url)=>{const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a)};
  if(p.website){try{const u=new URL(p.website);if(['https:','http:'].includes(u.protocol))addLink('Sito dell’attività ↗',u.href);}catch{}}
  if(p.phone){const phone=p.phone.split(';')[0].replace(/[^+\d]/g,'');if(phone){const a=el('a',`Chiama ${p.phone}`);a.href='tel:'+phone;links.append(a);}}
  addLink('Scheda OpenStreetMap ↗',p.sourceUrl);content.append(links,el('p',`Fonte: © OpenStreetMap contributors · ODbL. Raccolta del ${formatDay(dayInRome(p.checkedAt),{day:'numeric',month:'long',year:'numeric'})}. Dati e orari possono essere incompleti o cambiati.`,'detail-note'));
  $('place-detail-content').scrollTop=0;
  $('place-detail-dialog').showModal();
}
function openService(service){
  if(service.id==='utilities'){utilityReturnFocus=document.activeElement;$('utilities-dialog').showModal();$('utilities-close').focus();return;}
  if(service.id==='ztl'){$('ztl-dialog').showModal();return;}
  if(service.ready)setView(service.id==='events'?'discover':service.id);
}
function renderHome(){
  renderWasteEntry();
  if(typeof renderWeatherHeader==='function'){renderWeatherHeader();if(weatherReady&&typeof fetch==='function')loadWeather();}
  $('home-date').textContent=formatDay(today,{weekday:'long',day:'numeric',month:'long'});
  const todayCount=new Set(events.filter(e=>occursOn(e,today)).map(e=>e.sourceUrl)).size;
  $('home-today').textContent=`${todayCount} eventi oggi →`;
  $('services').replaceChildren();
  for(const service of services){
    const tile=el('button','','service-tile'+(service.ready?' ready':''));tile.type='button';tile.setAttribute('aria-label',service.name+(service.ready?'':' · in preparazione'));tile.setAttribute('data-service',service.id);tile.setAttribute('data-focus-key','service-'+service.id);
    const icon=el('span',service.icon,'service-icon');icon.setAttribute('aria-hidden','true');
    tile.append(icon,el('span',service.name,'service-name'),el('span',service.id==='district'&&currentDistrict()?(currentDistrict().quarter||currentDistrict().district.name):service.description,'service-description'));
    if(!service.ready)tile.append(el('span','PRESTO','service-badge'));
    tile.onclick=()=>openService(service);$('services').append(tile);
  }
  const useful=e=>eventDay(e.endsAt)>=today&&(e.endsAt.length===10||Date.parse(e.endsAt)<=Date.parse(e.startsAt)||Date.parse(e.endsAt)>Date.now());
  const nextSaved=savedEvents().filter(useful).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0];
  const featured=nextSaved||events.filter(e=>e.localVerified&&useful(e)).sort((a,b)=>a.startsAt.localeCompare(b.startsAt))[0];
  $('home-featured').replaceChildren();
  if(featured){const button=el('button','','home-event');button.type='button';button.setAttribute('data-focus-key','home-featured');button.append(el('span',nextSaved?'Il tuo prossimo evento':'Un’idea per uscire','home-row-label'),el('strong',featured.title),el('span',eventWhen(featured),'home-event-date'));button.onclick=()=>openDetails(featured);$('home-featured').append(button);}
  else{const button=el('button','Trova un evento nel calendario →','home-event');button.onclick=()=>setView('calendar');$('home-featured').append(button);}
  const total=typeof savedHubReady!=='undefined'&&savedHubReady?Object.values(savedHubCollections()).reduce((sum,items)=>sum+items.length,0):savedEvents().filter(e=>!isPastSavedEvent(e)).length+savedNewsDeadlines().filter(item=>newsValidity(item).state==='open').length;
  $('home-programs').textContent=total?`Salvati (${total}) →`:'Salvati →';
  const latest=homeNewsSelection();$('home-news-title').textContent=latest?`${currentDistrict()&&districtMatch(latest)?'Nella tua zona':newsValidity(latest).state==='open'?'Da ricordare':'Dal Comune'} · ${latest.title}`:'Le ultime dal Comune →';
  if(typeof homePersonalReady!=='undefined'&&homePersonalReady)renderHomePersonal();
}
function filteredNews(){
  const q=$('news-search').value.trim().toLocaleLowerCase('it');
  return newsItems.filter(i=>(newsMode!=='zone'||districtMatch(i))&&(newsMode!=='saved'||newsBookmarks[i.id])&&(!newsFilters.status||newsValidity(i).state===newsFilters.status)&&(!newsFilters.type||i.sourceKey===newsFilters.type)&&(!newsFilters.category||i.category===newsFilters.category)&&`${i.title} ${i.summary||''}`.toLocaleLowerCase('it').includes(q));
}
function newsTopic(value){return {'Mobilità':'Mobilità e lavori','Servizi':'Servizi e uffici','Comunità':'Famiglie e comunità','Bandi e opportunità':'Contributi e opportunità','Cultura e tempo libero':'Vita cittadina','Dal Comune':'Altre comunicazioni'}[value]||value;}
function newsZoneLabel(item){const matches=item.districtMatches||[];return matches.length?matches.map(m=>m.explicit?`Circoscrizione ${m.id}`:m.quarters.join(', ')).join(' · '):'Zona non indicata';}
function openNewsFilters(){$('news-category').value=newsFilters.category;$('news-type').value=newsFilters.type;$('news-status').value=newsFilters.status||'';$('news-filters-dialog').showModal();}
function busMatches(line){const q=$('bus-search').value.toLocaleLowerCase('it').trim();return (!$('bus-service').value||line.service===$('bus-service').value)&&(busMode!=='favorites'||busFavorites[line.id])&&(line.number+' '+line.route+' '+line.serviceLabel).toLocaleLowerCase('it').includes(q);}
function relatedBusAlerts(line){return busData.alerts.filter(a=>a.lines.includes(line.number));}
function busFavoriteNumbers(){return new Set([...busData.lines.filter(line=>busFavorites[line.id]).map(line=>line.number),...Object.keys(busFavorites).filter(key=>busFavorites[key]&&key.startsWith('official-')).map(key=>key.slice(9))]);}
function setBusMode(mode){const bucket=busMode==='alerts'?'alerts':'lines';busQueries[bucket]=$('bus-search').value;busMode=mode;$('bus-search').value=busQueries[mode==='alerts'?'alerts':'lines'];if(mode==='alerts')busAlertScope=busFavoriteNumbers().size?'mine':'all';$('bus-feedback').textContent='';render();$('bus-list').scrollTop=0;}
function busStar(line){const button=el('button',busFavorites[line.id]?'★':'☆','bus-favorite'+(busFavorites[line.id]?' chosen':''));button.type='button';button.setAttribute('aria-pressed',String(Boolean(busFavorites[line.id])));button.setAttribute('aria-label',(busFavorites[line.id]?'Rimuovi dalle tue linee: ':'Aggiungi alle tue linee: ')+line.number+', '+line.serviceLabel);button.onclick=()=>toggleBus(line.id);return button;}
function toggleBus(id){if(busFavorites[id])delete busFavorites[id];else busFavorites[id]=true;try{localStorage.setItem('verona-bus-v1',JSON.stringify(busFavorites));$('bus-feedback').textContent=busFavorites[id]?'Linea aggiunta alle tue linee.':'Linea rimossa dalle tue linee.';}catch{$('bus-feedback').textContent='Scelta disponibile per questa visita. Salvataggio permanente non consentito dal browser.';}render();if(view==='bus'&&!$('bus-detail-dialog').open)$('bus-list').focus();}
function officialBusLink(url,label,cls='detail-link'){try{const parsed=new URL(url);if(parsed.origin==='https://www.atv.verona.it'){const a=el('a',label,cls);a.href=parsed.href;a.target='_blank';a.rel='noopener noreferrer';return a;}}catch{}return el('p','Collegamento non disponibile.');}
function busPublicationCard(item,line=null){const card=el('article','','bus-alert');card.append(el('small',(item.serviceAlert?'Avviso di servizio':'Notizia ATV')+' · Pubblicato '+formatDay(dayInRome(item.publishedAt),{day:'numeric',month:'short',year:'numeric'})));const button=el('button',item.title);button.onclick=()=>openBusAlert(item,line);card.append(button);return card;}
function busEmpty(list,title,note,label,action){const box=el('div','','bus-empty'),button=el('button',label);button.onclick=action;box.append(el('h3',title),el('p',note),button);list.append(box);}
function filteredBusAlerts(){const q=$('bus-search').value.trim().toLocaleLowerCase('it'),numbers=busFavoriteNumbers();return busData.alerts.filter(a=>(typeof busAlertMatchesNetwork!=='function'||busAlertMatchesNetwork(a))&&(a.title+' '+a.lines.join(' ')).toLocaleLowerCase('it').includes(q)&&(busAlertScope==='all'||!a.lines.length||a.lines.some(n=>numbers.has(n))));}
function renderBus(){
  const alerts=busMode==='alerts',numbers=busFavoriteNumbers();if(!numbers.size)busAlertScope='all';
  for(const [id,mode]of [['bus-lines','lines'],['bus-favorites','favorites'],['bus-alerts','alerts'],['bus-stops','stops']]){const active=busMode===mode||(id==='bus-lines'&&busMode==='favorites');$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}
  if(typeof syncBusScopeControls==='function')syncBusScopeControls();
  $('bus-service-tools').hidden=alerts;$('bus-alert-tools').hidden=!alerts;$('bus-alert-mine').disabled=!numbers.size;
  for(const [id,scope]of [['bus-alert-mine','mine'],['bus-alert-all','all']])$(id).setAttribute('aria-pressed',String(busAlertScope===scope));
  $('bus-search').placeholder=alerts?'Cerca negli avvisi ATV…':'Cerca linea o fermata…';
  $('bus-search').setAttribute('aria-label',alerts?'Cerca negli avvisi ATV':'Cerca linea o fermata');$('bus-filter-open').hidden=alerts;
  if(!alerts&&typeof renderBusCatalog==='function')return renderBusCatalog();
  const rows=alerts?filteredBusAlerts():busData.lines.filter(busMatches),list=$('bus-list');list.replaceChildren();
  const rss=busData.sources.find(source=>source.key==='rss'),sourceDate=alerts?(rss?.lastSuccessAt||busData.updates?.[0]?.checkedAt||busData.updatedAt):null;
  const date=sourceDate||rows.map(row=>row.checkedAt).filter(Boolean).sort()[0]||busData.updatedAt;
  $('bus-count').textContent=rows.length+' '+(alerts?'pubblicazioni di servizio':busMode==='favorites'?'schede nelle tue linee':'schede linea')+' · Raccolta '+(date?formatDay(dayInRome(date),{day:'numeric',month:'short'}):'non disponibile');
  $('bus-stale').textContent=busData.sources.some(source=>source.status==='error')?'Raccolta incompleta: sono conservati anche dati precedenti. Dettagli in Altro.':alerts&&date&&Date.now()-Date.parse(date)>48*3600000?'Avvisi raccolti oltre due giorni fa: verifica le informazioni sul sito ATV.':'';
  if(!rows.length){const filtered=Boolean($('bus-search').value||(!alerts&&$('bus-service').value));if(!filtered&&busMode!=='favorites'&&(!alerts||busAlertScope==='all')){const box=el('div','','bus-empty');box.append(el('h3',alerts?'Nessun avviso nella raccolta.':'Schede linea non disponibili.'),el('p','Puoi consultare direttamente il servizio ufficiale ATV.'),officialBusLink(alerts?'https://www.atv.verona.it/linee-orari/deviazioni':'https://www.atv.verona.it/orari-urbani/dettaglio-percorsi-orari-pdf',alerts?'Avvisi sul sito ATV ↗':'Linee sul sito ATV ↗'));list.append(box);return;}busEmpty(list,busMode==='favorites'?'Nessuna linea preferita con questi filtri.':'Nessun risultato.',filtered?'Modifica la ricerca o rimuovi i filtri.':busMode==='favorites'?'Aggiungi le linee che usi toccando la stella.':'Non ci sono pubblicazioni corrispondenti nella raccolta.',filtered?'Azzera ricerca e filtri':alerts?'Mostra tutti gli avvisi':'Trova una linea',()=>{if(filtered){$('bus-search').value='';if(!alerts)$('bus-service').value='';render()}else if(alerts){busAlertScope='all';render()}else setBusMode('lines')});return;}
  if(alerts){
    list.append(el('p','Pubblicazioni recenti: verifica date e validità nella comunicazione ATV.','bus-feed-note'));
    const groups=[['Le tue linee',rows.filter(a=>a.lines.some(n=>numbers.has(n)))],[numbers.size?'Altre linee':'Linee indicate nel titolo',rows.filter(a=>a.lines.length&&!a.lines.some(n=>numbers.has(n)))],['Avvisi generali o senza linea indicata',rows.filter(a=>!a.lines.length)]];
    for(const [title,items]of groups){if(!items.length)continue;list.append(el('h3',title,'bus-feed-heading'));if(title.startsWith('Avvisi generali'))list.append(el('p','Nessun numero di linea riconosciuto nel titolo: verifica nella comunicazione se ti riguarda.','bus-feed-note'));for(const item of items)list.append(busPublicationCard(item));}return;
  }
  for(const line of rows){
    const card=el('article','','bus-card'),open=el('button','','bus-open'),body=el('div','','bus-line-body');open.type='button';body.append(el('strong',line.serviceLabel));
    for(const direction of line.directions||[])body.append(el('p',/^Direzione/i.test(direction.label)?direction.label:direction.path));
    if(!line.directions?.length)body.append(el('p',line.route));
    const count=relatedBusAlerts(line).length;if(count)body.append(el('span',count+' avvisi recenti per questa linea','bus-alert-count'));
    open.append(el('span',line.number,'bus-number'),body);open.setAttribute('aria-label','Dettagli linea '+line.number+', '+line.serviceLabel);open.onclick=()=>openBusLine(line);
    const actions=el('div','','bus-card-actions'),detail=el('button','Percorso e avvisi');detail.onclick=()=>openBusLine(line);detail.setAttribute('aria-label','Percorso e avvisi linea '+line.number+', '+line.serviceLabel);const timetable=el('button','Orari','bus-timetable');timetable.setAttribute('aria-label','Orari nell’app linea '+line.number+', '+line.serviceLabel);timetable.onclick=()=>openTimetable(line);actions.append(timetable,detail);if(busRoutesFor(line).length){const mapButton=el('button','Mappa');mapButton.onclick=()=>openBusRoute(line);actions.append(mapButton);}
    card.append(open,busStar(line),actions);list.append(card);
  }
}
function timetableFor(line){return timetableData.lines.find(item=>item.lineId===line.id&&item.sourceUrl===line.timetableUrl)||null;}
function timetableStopRows(block){const counts=new Map();return block.stops.map(stop=>{const n=(counts.get(stop.name)||0)+1;counts.set(stop.name,n);return {...stop,key:stop.name+'#'+n,label:stop.name+(n>1?' · passaggio '+n:'')};});}
function timetableBlocks(direction=$('timetable-direction').value,service=$('timetable-service').value){return (timetableLine?.blocks||[]).filter(block=>block.direction===direction&&block.service===service);}
function timetableOptions(id,items,placeholder,value=''){const select=$(id);select.replaceChildren();const empty=el('option',placeholder);empty.value='';select.append(empty);for(const item of items){const option=el('option',item.label);option.value=item.value;select.append(option)}select.value=items.some(item=>item.value===value)?value:'';}
function timetableServices(preferred=''){const direction=$('timetable-direction').value,services=[...new Set((timetableLine?.blocks||[]).filter(b=>b.direction===direction).map(b=>b.service))];timetableOptions('timetable-service',services.map(value=>({value,label:value})),timetableMapStopKey?'Tutti i servizi disponibili':'Scegli il servizio',preferred||(services.length===1?services[0]:''));$('timetable-service').disabled=!direction;}
function timetableStops(preferred=''){const stops=new Map();for(const block of (timetableMapStopKey&&!$('timetable-service').value?(timetableLine?.blocks||[]).filter(b=>b.direction===$('timetable-direction').value):timetableBlocks()))for(const stop of timetableStopRows(block))if(!stops.has(stop.key))stops.set(stop.key,{value:stop.key,label:stop.label});timetableStopChoices=[...stops.values()];timetableOptions('timetable-stop',timetableStopChoices,'Scegli la fermata',preferred);$('timetable-stop').disabled=!$('timetable-service').value&&!timetableMapStopKey;}
function persistTimetable(){if(!timetableLine)return;timetableChoices[timetableLine.lineId]={direction:$('timetable-direction').value,service:$('timetable-service').value,stop:$('timetable-stop').value};try{localStorage.setItem('verona-timetables-v1',JSON.stringify(timetableChoices));$('timetable-feedback').textContent='';}catch{$('timetable-feedback').textContent='Scelte disponibili per questa visita. Il browser non consente il salvataggio.';}}
function timetableDepartures({direction=$('timetable-direction').value,service=$('timetable-service').value,key=$('timetable-stop').value}={}){const result=[],seen=new Set();for(const block of timetableBlocks(direction,service)){const stops=timetableStopRows(block),stop=stops.find(item=>item.key===key);if(!stop)continue;for(let c=0;c<stop.times.length;c++){const time=stop.times[c];if(!time)continue;let previous=null,offset=0,minutes=0;for(const row of stops){const value=row.times[c];if(value){const parts=value.split(':').map(Number),clock=parts[0]*60+parts[1];if(previous!==null&&previous-clock>720)offset+=1440;previous=clock;minutes=clock+offset;}if(row.key===key)break;}if(/SERALE/i.test(block.service)&&minutes<720)minutes+=1440;const note=[block.validity[c],block.tripNotes?.[c],stop.marks[c]==='|'?'':stop.marks[c]].filter(Boolean).join(' · '),trip=block.tripIds[c],dedupe=JSON.stringify([time,minutes,trip,note]);if(trip&&seen.has(dedupe))continue;seen.add(dedupe);result.push({time,minutes,trip,note,page:block.page,nextDay:minutes>=1440});}}return result.sort((a,b)=>a.minutes-b.minutes||String(a.trip||'').localeCompare(String(b.trip||''),'it',{numeric:true}));}
function appendTimetableRows(list,rows){
  for(const row of rows){const entry=el('div','','timetable-row'),time=el('div');time.append(el('span',row.time,'timetable-time'));if(row.nextDay)time.append(el('small','Dopo mezzanotte · giorno successivo'));const meta=el('div','','timetable-row-meta');meta.append(el('small',row.trip?'Corsa '+row.trip:'Codice corsa non indicato'),el('small','Pagina '+row.page+' del PDF'));if(row.note)meta.append(el('small','Nota '+row.note));entry.append(time,meta);list.append(entry);}
}
function renderTimetable(){
  const list=$('timetable-results'),key=$('timetable-stop').value;list.replaceChildren();$('timetable-summary').textContent='';
  if(!timetableLine){list.append(el('p','Orari interni non disponibili per questa scheda. Puoi consultare la fonte originale.','timetable-prompt'));return;}
  if(timetableMapStopKey&&$('timetable-direction').value&&key&&!$('timetable-service').value){
    const services=[...new Set(timetableLine.blocks.filter(b=>b.direction===$('timetable-direction').value).map(b=>b.service))];let count=0;
    for(const service of services){const rows=timetableDepartures({service,key}),section=el('section','','timetable-service-group');section.append(el('h3',service));count+=rows.length;if(rows.length)appendTimetableRows(section,rows);else section.append(el('p','Nessun orario riportato per questa fermata in questo servizio.','timetable-prompt'));list.append(section);}
    $('timetable-summary').textContent=count+' orari · '+services.length+' servizi separati';return;
  }
  if(!$('timetable-direction').value||!$('timetable-service').value||!key){list.append(el('p',!$('timetable-direction').value?'Scegli una direzione per consultare gli orari.':!$('timetable-service').value?'Scegli il giorno di servizio indicato da ATV.':'Scegli una fermata della tabella.','timetable-prompt'));return;}
  const rows=timetableDepartures(),choice=timetableStopChoices.find(item=>item.value===key);$('timetable-summary').textContent=rows.length+' '+(rows.length===1?'orario':'orari')+' · '+(choice?.label||'');
  if(!rows.length)list.append(el('p','Nessun orario riportato per questa fermata nel servizio scelto. Prova un’altra fermata o un altro servizio.','timetable-prompt'));
  appendTimetableRows(list,rows);
}

function openTimetable(line,preset={}){
  if(typeof openOfficialBus==='function'&&payload.busOfficial?.lines.some(item=>item.number===line.number)&&!preset.stop)return openOfficialBus(line.number);

  timetableMapStopKey=preset.stop||'';$('bus-timetable-dialog').classList.toggle('map-stop-selected',Boolean(timetableMapStopKey));
  timetableReturnFocus=document.activeElement;$('timetable-source').open=false;timetableLine=timetableFor(line);$('bus-timetable-title').textContent='Linea '+line.number;$('timetable-feedback').textContent='';const chosen={...(timetableChoices[line.id]||{}),...preset,...(preset.stop?{service:preset.service||''}:{})},directions=[...new Set((timetableLine?.blocks||[]).map(b=>b.direction))];
  timetableOptions('timetable-direction',directions.map(value=>({value,label:value})),'Scegli la direzione',chosen.direction||(directions.length===1?directions[0]:''));$('timetable-direction').disabled=!directions.length;timetableServices(chosen.service);timetableStops(chosen.stop);const provenance=$('timetable-provenance');provenance.replaceChildren();
  if(timetableLine){for(const label of timetableLine.validityLabels)provenance.append(el('p',label));provenance.append(el('p','PDF raccolto il '+formatDay(dayInRome(timetableLine.downloadedAt),{day:'numeric',month:'long',year:'numeric'})+'. Sono riportate le fermate della tabella, che può non elencare tutte le fermate del percorso.'));
    const notes=[...new Set(timetableLine.blocks.flatMap(b=>b.notes))].filter(note=>!/^Note:?$/i.test(note));for(const note of notes)provenance.append(el('p',note));}
  provenance.append(officialBusLink(line.timetableUrl,'Fonte: PDF originale ATV ↗'));renderTimetable();$('timetable-map-context').textContent='';if(preset.stop)$('timetable-map-context').textContent='Fermata: '+preset.stop.replace(/#\d+$/,'')+'. Direzione: '+preset.direction+'. Gli orari comprendono le altre varianti della linea, separati per servizio.';$('timetable-results').scrollTop=0;$('bus-timetable-dialog').showModal();
}
function renderBusUpdates(){const q=$('bus-updates-search').value.trim().toLocaleLowerCase('it'),items=(busData.updates||[]).filter(a=>(a.title+' '+a.lines.join(' ')).toLocaleLowerCase('it').includes(q));$('bus-updates-count').textContent=items.length+' pubblicazioni ATV';const list=$('bus-updates-list');list.replaceChildren();for(const item of items)list.append(busPublicationCard(item));if(!items.length&&!q){const box=el('div','','bus-empty');box.append(el('h3','Pubblicazioni non disponibili.'),officialBusLink('https://www.atv.verona.it/','Consulta il sito ATV ↗'));list.append(box);return;}if(!items.length)busEmpty(list,'Nessuna pubblicazione trovata.','Prova una ricerca diversa.','Azzera ricerca',()=>{$('bus-updates-search').value='';renderBusUpdates()});}
function openBusMore(){const box=$('bus-source-status');box.replaceChildren();for(const source of busData.sources){const name={urban:'Feriale',evening:'Serale',holiday:'Festivo',rss:'Pubblicazioni ATV'}[source.key]||source.key,last=source.lastSuccessAt||busData.lines.filter(line=>line.service===source.key).map(line=>line.checkedAt).sort()[0]||(source.key==='rss'?(busData.updates||[])[0]?.checkedAt:null);box.append(el('p',name+' · Ultimo successo: '+(last?formatDay(dayInRome(last),{day:'numeric',month:'short',year:'numeric'}):'non disponibile')+(source.status==='error'?' · Ultimo tentativo fallito: dati precedenti conservati.':''),'bus-source-row'));}$('bus-more-dialog').showModal();}
function openBusLine(line){
  if(!$('bus-detail-dialog').open)busReturnFocus=document.activeElement;const content=$('bus-detail-content');content.replaceChildren();const title=el('h2','Linea '+line.number);title.id='bus-detail-title';
  const timetableButton=el('button','Consulta gli orari nell’app','dialog-save');timetableButton.onclick=()=>openTimetable(line);content.append(title,el('span',line.serviceLabel,'source'),timetableButton);
  if(busRoutesFor(line).length){const button=el('button','Mappa e fermate','dialog-save');button.onclick=()=>openBusRoute(line);content.append(button);}content.append(officialBusLink(line.timetableUrl,'PDF originale ATV ↗','bus-secondary-link'));
  for(const direction of line.directions||[{label:'Percorso indicato da ATV',path:line.route}]){const section=el('section','','bus-route-section');section.append(el('h3',direction.label),el('p',direction.path,'bus-route'));content.append(section);}
  content.append(el('p','Percorso sintetico dalla scheda ATV, non elenco completo delle fermate. Nel pannello Orari scegli il servizio indicato nella tabella. Il PDF resta la fonte per note e aggiornamenti. Non sono arrivi in tempo reale.','detail-note'),officialBusLink(line.sourceUrl,'Scheda della linea sul sito ATV ↗','bus-secondary-link'));
  const star=busStar(line);star.onclick=()=>{toggleBus(line.id);star.textContent=busFavorites[line.id]?'★':'☆';star.setAttribute('aria-pressed',String(Boolean(busFavorites[line.id])));star.setAttribute('aria-label',(busFavorites[line.id]?'Rimuovi dalle tue linee: ':'Aggiungi alle tue linee: ')+line.number+', '+line.serviceLabel);star.classList.toggle('chosen',Boolean(busFavorites[line.id]));};content.append(star);
  const alerts=relatedBusAlerts(line);if(alerts.length){content.append(el('h3','Avvisi recenti per questa linea'));for(const alert of alerts)content.append(busPublicationCard(alert,line));}
  const general=busData.alerts.filter(a=>!a.lines.length);if(general.length){const button=el('button','Avvisi generali o senza linea indicata ('+general.length+')','dialog-save');button.onclick=()=>{$('bus-detail-dialog').close();setBusMode('alerts');busAlertScope='all';render()};content.append(button);}
  content.append(el('p','Fonte: ATV Verona · Scheda raccolta il '+formatDay(dayInRome(line.checkedAt),{day:'numeric',month:'long',year:'numeric'})+'. Le pubblicazioni recenti non indicano automaticamente una deviazione ancora attiva.','detail-note'));
  if(!$('bus-detail-dialog').open)$('bus-detail-dialog').showModal();
}
function openBusAlert(alert,line=null){
  if(!$('bus-detail-dialog').open)busReturnFocus=document.activeElement;const content=$('bus-detail-content');content.replaceChildren();if(line){const back=el('button','← Torna alla linea '+line.number,'dialog-save');back.onclick=()=>openBusLine(line);content.append(back);}
  const title=el('h2',alert.title);title.id='bus-detail-title';content.append(title,el('p','Pubblicato il '+formatDay(dayInRome(alert.publishedAt),{day:'numeric',month:'long',year:'numeric'})),el('p','Apri la comunicazione ATV per date di validità, fermate coinvolte, percorsi alternativi e aggiornamenti. Il feed non contiene il testo completo.','detail-note'),officialBusLink(alert.sourceUrl,'Leggi sul sito ATV ↗'));if(!$('bus-detail-dialog').open)$('bus-detail-dialog').showModal();
}
function toggleNews(id){
  if(newsBookmarks[id])delete newsBookmarks[id];else newsBookmarks[id]=true;
  try{localStorage.setItem('verona-news-v1',JSON.stringify(newsBookmarks));$('news-feedback').textContent=newsBookmarks[id]?'Notizia salvata.':'Notizia rimossa dalle salvate.';}
  catch{$('news-feedback').textContent='Scelta disponibile per questa visita: il browser non consente il salvataggio.';}
  if(view==='district')$('district-feedback').textContent=$('news-feedback').textContent;
  if(view==='saved')$('saved-feedback').textContent=$('news-feedback').textContent;
  render();
}
function newsSaveButton(item){const button=el('button',newsBookmarks[item.id]?'✓ Salvata':'Salva','news-bookmark'+(newsBookmarks[item.id]?' chosen':''));button.type='button';button.setAttribute('data-focus-key','news-save-'+item.id);button.setAttribute('aria-pressed',String(Boolean(newsBookmarks[item.id])));button.setAttribute('aria-label',`${newsBookmarks[item.id]?'Rimuovi':'Salva'}: ${item.title}`);button.onclick=()=>toggleNews(item.id);return button;}
function renderNews(){
  const items=filteredNews(),chosen=currentDistrict();
  for(const [id,mode] of [['news-all','all'],['news-zone-tab','zone']]){$(id).classList.toggle('active',newsMode===mode);$(id).setAttribute('aria-pressed',String(newsMode===mode));}
  $('news-zone').hidden=newsMode!=='zone'||!chosen;
  $('news-zone').textContent=chosen?'⌖ '+(chosen.quarter||`Circoscrizione ${chosen.district.id}`):'⌖ Scegli zona';
  const filters=$('news-active-filters');filters.replaceChildren();
  for(const [key,label]of [['category',newsTopic(newsFilters.category)],['type',newsFilters.type==='avvisi'?'Avvisi':'Notizie'],['status',newsStateLabel(newsFilters.status)]]){if(!newsFilters[key])continue;const b=el('button',label+' ×');b.setAttribute('aria-label','Rimuovi filtro: '+label);b.onclick=()=>{newsFilters[key]='';render()};filters.append(b);}
  filters.hidden=!filters.children.length;$('news-open-filters').textContent=filters.children.length?`Filtri (${filters.children.length})`:'Filtri';
  $('news-summary').textContent=`${items.length} pubblicazioni${newsMode==='zone'&&chosen?' · '+(chosen.quarter||chosen.district.name):newsMode==='saved'?' salvate':''} · Raccolta ${newsData.updatedAt?formatDay(dayInRome(newsData.updatedAt),{day:'numeric',month:'short'}):'non disponibile'}`;
  const health=datasetStatus(newsData,{maxAgeHours:48});$('news-refresh-note').textContent=health.state==='current'?'':health.message;
  const list=$('news-list');list.replaceChildren();
  if(!newsItems.length){$('news-summary').textContent='Raccolta non disponibile';const box=el('div','','news-empty'),link=el('a','Leggi sul sito del Comune ↗','detail-link');link.href='https://www.comune.verona.it/Novita/Notizie';link.target='_blank';link.rel='noopener noreferrer';box.append(el('h3','Nessuna comunicazione disponibile.'),el('p','Puoi consultare le pubblicazioni direttamente sulla fonte ufficiale.'),link);list.append(box);return;}
  if(newsMode==='zone'&&!chosen){$('news-summary').textContent='Notizie e avvisi che citano il quartiere o la sua circoscrizione.';const box=el('div','','news-empty'),b=el('button','Scegli la mia zona');b.onclick=openDistrictChoice;box.append(el('h3','Quale zona ti interessa?'),el('p','La scelta è facoltativa e puoi cambiarla dalle impostazioni. In Tutte continui a vedere le comunicazioni di Verona.'),b);list.append(box);return;}
  if(!items.length){const filtered=Boolean($('news-search').value.trim()||newsFilters.category||newsFilters.type||newsFilters.status),box=el('div','','news-empty');
    box.append(el('h3',newsMode==='saved'?'Nessuna notizia salvata con questi filtri.':'Nessun risultato per ora.'),el('p',filtered?'Prova a rimuovere i filtri o cambiare ricerca.':newsMode==='zone'?'La raccolta può non includere tutte le comunicazioni della zona. In Tutte trovi anche quelle senza zona indicata.':'Apri Tutte per consultare le comunicazioni e salvarle.'));
    const b=el('button',filtered?'Azzera ricerca e filtri':'Mostra tutte le comunicazioni');b.onclick=()=>{if(filtered){$('news-search').value='';newsFilters={category:'',type:''};}else newsMode='all';render()};box.append(b);list.append(box);return;
  }
  for(const item of items){
    const card=el('article','','news-card'),meta=el('div','','news-card-meta');
    meta.append(el('span','Comune di Verona','news-card-source'),el('span','Pubblicata il '+formatDay(item.publishedOn,{day:'numeric',month:'short',year:'numeric'})));
    const validity=newsValidity(item);
    const title=el('button',item.title,'news-title');title.type='button';title.setAttribute('data-focus-key','news-open-'+item.id);title.setAttribute('aria-label','Leggi: '+item.title);title.onclick=()=>openNews(item);appendNewsThumbnail(title,item);
    const bottom=el('div','','news-card-actions'),read=el('button','Dettagli →','news-read');read.setAttribute('data-focus-key','news-read-'+item.id);read.setAttribute('aria-label','Dettagli: '+item.title);read.onclick=()=>openNews(item);bottom.append(read,newsSaveButton(item));
    card.append(meta,title);
    if(validity.state!=='informative'){const badge=el('p',newsCardValidityLabel(validity),'news-card-validity');badge.setAttribute('data-state',validity.state);card.append(badge);}
    appendNewsImageCredit(card,item);card.append(bottom);list.append(card);
  }
}
function newsCardValidityLabel(status){
  if(!status.deadline)return status.state==='unknown'?'Termini da verificare':status.label;
  const date=formatDay(status.deadline.day,{day:'numeric',month:'short',year:'numeric'}),clock=status.deadline.time?' · ore '+status.deadline.time:'';
  if(status.state==='open')return (status.deadline.day===today?'Scade oggi':'Entro il '+date)+clock;
  return status.label+' · '+date+clock;
}
function openNews(item){
  newsReturnFocus=document.activeElement;
  const content=$('news-detail-content');content.replaceChildren();
  const title=el('h2',item.title);title.id='news-detail-title';
  content.append(el('span',`Comune di Verona · ${item.kind} · Pubblicata il ${formatDay(item.publishedOn,{day:'numeric',month:'long',year:'numeric'})}`,'news-source-label'),title);
  const tags=el('div','','news-tags');tags.append(el('span',newsTopic(item.category),'news-topic'),el('span',newsZoneLabel(item)));content.append(tags);
  if(newsValidity(item).state!=='informative'||newsDeadlineSaves[item.id])appendNewsValidity(content,item);
  content.append(el('p',item.summary||'Leggi la pubblicazione completa sulla fonte ufficiale.'),el('p','La data indicata è quella di pubblicazione. Consulta la fonte per periodi di validità, scadenze e aggiornamenti.','detail-note'));appendEventPoster(content,item);
  try{const url=new URL(item.sourceUrl);if(url.origin==='https://www.comune.verona.it'){const link=el('a','Leggi sul sito del Comune ↗','detail-link');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';content.append(link)}}catch{}
  const saveButton=newsSaveButton(item);saveButton.onclick=()=>{toggleNews(item.id);saveButton.textContent=newsBookmarks[item.id]?'✓ Salvata':'Salva';saveButton.setAttribute('aria-pressed',String(Boolean(newsBookmarks[item.id])));saveButton.setAttribute('aria-label',`${newsBookmarks[item.id]?'Rimuovi':'Salva'}: ${item.title}`);saveButton.classList.toggle('chosen',Boolean(newsBookmarks[item.id]));};content.append(saveButton);
  const provenance=el('details','','news-provenance');provenance.append(el('summary','Fonte e aggiornamento'),el('p',`Sintesi dalla pagina comunale, raccolta il ${formatDay(dayInRome(item.checkedAt),{day:'numeric',month:'long',year:'numeric'})}. Argomento assegnato automaticamente dall’app. Le zone sono riconosciute dai riferimenti nei testi e possono essere incomplete.`));
  const license=el('a','Comune di Verona · CC BY 4.0 salvo eccezioni','news-source-label');license.href=item.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';provenance.append(license);content.append(provenance);
  $('news-detail-dialog').showModal();
}
function setView(next) {
  if(view==='bus'&&next!=='bus'&&typeof leaveBusMapHome==='function')leaveBusMapHome();
  if(next==='bus'&&!busVisited){busVisited=true;busMode=busFavoriteNumbers().size?'favorites':'lines';}
  if(next!=='discover')showDiscoveryFeedback('');
  view=next;onlySaved=next==='saved';
  // Aprendo i salvati, mostra il prossimo appuntamento anziché un giorno vuoto.
  if(onlySaved&&!savedVisited){savedVisited=true;const future=[...savedEvents().filter(e=>!isPastSavedEvent(e)).map(e=>eventDay(e.startsAt)<today?today:eventDay(e.startsAt)),...savedNewsDeadlines().filter(item=>newsValidity(item).state==='open').map(item=>item.timing.deadline.day)].sort();if(future.length){selected=future[0];month=selected.slice(0,7);}}
  render();
  if(next==='bus'&&typeof enterBusMapHome==='function')enterBusMapHome();
}
function discoveryEvents() {
  const now=Date.now();const period=$('period').value||'30';
  const until=period==='all'?'9999-12-31':new Date(Date.parse(today+'T12:00:00Z')+(Number(period)-1)*86400000).toISOString().slice(0,10);
  const savedUrls=new Set(events.filter(e=>['interested','going'].includes(preferences[e.id])&&eventDay(e.endsAt)>=today).map(e=>e.sourceUrl));
  const unique=new Map();
  for(const e of visibleEvents()) {
    if(eventDay(e.endsAt)<today||(e.endsAt.length>10&&Date.parse(e.endsAt)<now)||eventDay(e.startsAt)>until)continue;
    if(($('collection').value||'all')==='local'&&!e.localVerified)continue;
    if(dismissed[e.sourceUrl]||savedUrls.has(e.sourceUrl)||unique.has(e.sourceUrl))continue;
    unique.set(e.sourceUrl,e);
  }
  return [...unique.values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
function persistChoices() {
  storeSavedSnapshots();
  try {localStorage.setItem('verona-events-v1',JSON.stringify(preferences));localStorage.setItem('verona-dismissed-v1',JSON.stringify(dismissed));return true;}
  catch {return false;}
}
let discoveryFeedbackTimer=null;
function showDiscoveryFeedback(message) {
  clearTimeout(discoveryFeedbackTimer);
  $('discovery-feedback').textContent=message;
  discoveryFeedbackTimer=message?setTimeout(()=>{$('discovery-feedback').textContent='';discoveryFeedbackTimer=null;},2000):null;
}
function chooseDiscovery(action) {
  const e=currentDiscovery;if(!e)return;
  lastChoice={id:e.id,url:e.sourceUrl,previous:preferences[e.id],dismissed:dismissed[e.sourceUrl]};
  if(action==='interested')preferences[e.id]='interested';else dismissed[e.sourceUrl]=true;
  const stored=persistChoices();
  showDiscoveryFeedback((action==='interested'?'Evento aggiunto al tuo calendario.':'Evento passato. Puoi annullare la scelta.')+(stored?'':' Salvataggio disponibile solo per questa visita.'));
  render();
}
function undoDiscovery() {
  if(!lastChoice)return;
  if(lastChoice.previous)preferences[lastChoice.id]=lastChoice.previous;else delete preferences[lastChoice.id];
  if(lastChoice.dismissed)dismissed[lastChoice.url]=lastChoice.dismissed;else delete dismissed[lastChoice.url];
  lastChoice=null;const stored=persistChoices();showDiscoveryFeedback('Ultima scelta annullata.'+(stored?'':' Salvataggio disponibile solo per questa visita.'));render();
}
function presentation(e) {
  if(e.theme)return {theme:e.theme,label:e.categoryLabel};
  const categories=(e.category||[]).join(' ').toLocaleLowerCase('it');
  if(e.source==='Veronafiere')return {theme:'fair',label:'Fiere e incontri'};
  if(/sport|passegg|ambient/.test(categories))return {theme:'outdoor',label:'All’aria aperta'};
  if(/mercat/.test(categories))return {theme:'market',label:'Mercatini'};
  return {theme:'art',label:'Cultura e città'};
}
function eventWhen(e) {
  let label=formatDay(eventDay(e.startsAt),{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  const clock=value=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  if(e.startsAt.length>10)label+=' · '+clock(e.startsAt);
  if(eventDay(e.startsAt)!==eventDay(e.endsAt))label+=' → '+formatDay(eventDay(e.endsAt),{day:'numeric',month:'short'})+(e.endsAt.length>10?' · '+clock(e.endsAt):'');
  else if(e.startsAt.length>10&&e.endsAt.length>10&&Date.parse(e.endsAt)>Date.parse(e.startsAt))label+='–'+clock(e.endsAt);
  return label;
}
let eventDetailPreview=null;
function clearEventDetailPreview(){const state=eventDetailPreview;eventDetailPreview=null;state?.map?.remove();}
function appendEventDetailPreview(content,e){
  const point=eventPosition(e);if(!point)return;
  const section=el('section','','event-location-preview'),heading=el('h3','Dove si svolge'),box=el('div','','event-location-map'),status=el('p','Caricamento mappa…','event-location-status');
  box.setAttribute('role','region');box.setAttribute('aria-label','Anteprima del luogo: '+(e.location||e.title));status.setAttribute('role','status');section.append(heading,box,status);content.append(section);
  eventDetailPreview={box,status,point,map:null};
  const mapButton=el('button','⌖ Vedi sulla mappa','dialog-save event-map-detail-button');mapButton.onclick=()=>{closeDetails();openEventMap(e)};
  const directions=el('a','Indicazioni per arrivare ↗','bus-secondary-link');directions.href=`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`;directions.target='_blank';directions.rel='noopener noreferrer';
  if(typeof appendEventTravel!=='function')content.append(mapButton,directions);
  content.append(el('p','Punto indicato dalla fonte. Per manifestazioni diffuse e percorsi, verifica il luogo esatto nel programma.','detail-note'));
}
function mountEventDetailPreview(){
  const state=eventDetailPreview;if(!state)return;
  if(typeof L==='undefined'){state.status.textContent='Anteprima non disponibile. Puoi aprire le indicazioni per arrivare.';return;}
  try{
    state.map=L.map(state.box,{zoomControl:false,dragging:false,touchZoom:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,preferCanvas:true}).setView([state.point.lat,state.point.lon],15);
    let failed=false;
    L.tileLayer(placesData.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})
      .on('tileerror',()=>{if(eventDetailPreview===state){failed=true;state.status.textContent='Sfondo della mappa non disponibile. Puoi aprire le indicazioni per arrivare.';}})
      .on('load',()=>{if(eventDetailPreview===state&&!failed)state.status.textContent='';}).addTo(state.map);
    L.circleMarker([state.point.lat,state.point.lon],{radius:9,color:'#fff',weight:3,fillColor:'#254f78',fillOpacity:1,interactive:false}).addTo(state.map);
  }catch{state.map?.remove();state.map=null;state.status.textContent='Anteprima non disponibile. Puoi aprire le indicazioni per arrivare.';}
}
function openDetails(e) {
  clearEventDetailPreview();
  if(typeof clearEventWeatherPreview==='function')clearEventWeatherPreview();
  detailReturnFocus=document.activeElement;
  const content=$('detail-content');content.replaceChildren();content.scrollTop=0;
  const title=el('h2',e.title);title.id='detail-title';
  content.append(el('span',e.source,'source'),title,el('p',eventWhen(e),'event-detail-date'),el('p',e.location||'Sede da verificare sulla fonte ufficiale.','event-detail-place'),el('p',e.priceLabel||'Prezzo e condizioni di accesso da verificare.','event-detail-access'));
  if(e.accessNotes){const access=el('section','','event-access-notes');access.append(el('h3','Condizioni di accesso'),el('p',e.accessNotes));content.append(access);}
  const state=['interested','going'].includes(preferences[e.id])?preferences[e.id]:null;let manageTarget=null;
  if(state){
    content.append(el('h3',state==='going'?'Hai confermato la presenza':'Questo evento è nei tuoi salvati','event-detail-management'));
    const presence=el('button',state==='going'?'✓ Partecipi · annulla conferma':'Conferma: partecipo','dialog-save event-presence');presence.onclick=()=>{closeDetails();save(e.id,state==='going'?'interested':'going')};
    const remove=el('button','Rimuovi dai salvati','dialog-save event-remove');remove.onclick=()=>{closeDetails();save(e.id,null)};
    if(!isPastSavedEvent(e)){content.append(presence);manageTarget=presence;}content.append(remove);manageTarget||=remove;
  }
  if(e.summary)content.append(el('p',e.summary,'event-detail-summary'));
  appendEventDetailPreview(content,e);
  if(typeof appendEventWeather==='function')appendEventWeather(content,e);
  if(typeof appendEventTravel==='function'){if(!eventPosition(e))appendEventTravel(content,e);}
  else{if(typeof appendEventBus==='function')appendEventBus(content,e);if(typeof appendEventParking==='function')appendEventParking(content,e);}
  try{const url=new URL(e.sourceUrl);if(url.protocol==='https:'){const link=el('a','Apri il programma ufficiale ↗','detail-link');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';content.append(link)}}catch{}
  if(eventImage(e)){
    const toggle=el('button','Immagine e crediti ▾','event-poster-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','event-detail-poster');content.append(toggle);
    appendEventPoster(content,e);const poster=content.children[content.children.length-1];poster.id='event-detail-poster';poster.hidden=true;
    toggle.onclick=()=>{poster.hidden=!poster.hidden;toggle.setAttribute('aria-expanded',String(!poster.hidden));toggle.textContent=poster.hidden?'Immagine e crediti ▾':'Nascondi immagine e crediti ▴';};
  }
  if(e.localVerified)content.append(el('p',`Luogo controllato sulla fonte il ${formatDay(e.reviewedOn,{day:'numeric',month:'long',year:'numeric'})}.`,'detail-note'));
  content.append(el('p','Eventuali altre date sono nel calendario. Verifica aggiornamenti e disponibilità prima di partire.','detail-note'));
  if(agendaReady)appendAgendaExport(content,e);
  content.append(el('p','Salvare l’evento o confermare la presenza non acquista biglietti e non effettua prenotazioni.','detail-note'));
  const button=$('detail-save');button.textContent=state?(state==='going'?'✓ Partecipi · gestisci':'✓ Salvato · gestisci'):'♡ Salva evento';button.setAttribute('aria-label',state?'Gestisci evento salvato: '+e.title:'Salva evento: '+e.title);
  button.onclick=()=>{if(manageTarget){content.scrollTop=0;manageTarget.focus();return;}closeDetails();if(currentDiscovery?.id===e.id)chooseDiscovery('interested');else save(e.id,'interested');};
  const travel=$('detail-travel');travel.hidden=!eventPosition(e);travel.textContent=typeof openEventTravel==='function'?'Come arrivare':'Vedi mappa';travel.onclick=()=>{if(typeof openEventTravel==='function')openEventTravel(e);else{closeDetails();openEventMap(e);}};
  $('detail-dialog').showModal();$('close-detail').focus();mountEventDetailPreview();
}
function closeDetails() {$('detail-dialog').close();}
function renderDiscovery() {
  const queue=discoveryEvents();currentDiscovery=queue[0]||null;
  $('discovery-count').textContent=`${queue.length} ${queue.length===1?'evento da scoprire':'eventi da scoprire'}`;
  $('undo').disabled=!lastChoice;$('like').disabled=!currentDiscovery;$('skip').disabled=!currentDiscovery;
  const deck=$('deck');deck.replaceChildren();
  if(!currentDiscovery){
    const empty=el('div','','deck-empty');empty.append(el('h3','Per ora è tutto.'),el('p','Hai visto gli eventi disponibili con questi filtri. Puoi cambiare periodo o esplorare il catalogo completo.'));
    if(Object.keys(dismissed).length){const review=el('button','Rivedi gli eventi saltati');review.onclick=()=>{dismissed={};lastChoice=null;const stored=persistChoices();showDiscoveryFeedback('Eventi saltati nuovamente disponibili. I tuoi salvati sono conservati.'+(stored?'':' Scelta valida solo per questa visita.'));render()};empty.append(review);}
    const button=el('button','Esplora il catalogo completo');button.onclick=()=>{$('collection').value='all';$('period').value='all';$('source').value='';$('search').value='';render()};empty.append(button);deck.append(empty);return;
  }
  const e=currentDiscovery,p= presentation(e),card=el('article','','discover-card');
  const cover=el('div','',`card-cover theme-${p.theme}`);cover.setAttribute('aria-hidden','true');cover.append(el('span','Verona · da vivere','cover-label'),el('div','','cover-art'),el('span',p.label,'cover-type'));
  const coverImage=eventImage(e);if(coverImage){const fallback=[...cover.children],image=makeEventImage(e,'event-cover-image');image.hidden=true;cover.append(image);const credit=el('span',eventImageCredit(coverImage),'event-cover-credit');credit.hidden=true;image.onload=()=>{for(const node of fallback)node.hidden=true;cover.setAttribute('aria-hidden','false');cover.style.background='var(--page-bg)';image.hidden=false;credit.hidden=false};image.onerror=()=>{image.hidden=true;credit.hidden=true;for(const node of fallback)node.hidden=false;cover.setAttribute('aria-hidden','true');cover.style.background=''};cover.append(credit);}
  const likeStamp=el('span','MI INTERESSA','swipe-stamp'),skipStamp=el('span','PASSO','swipe-stamp skip');likeStamp.setAttribute('aria-hidden','true');skipStamp.setAttribute('aria-hidden','true');
  const body=el('div','','card-body');body.append(el('span',e.localVerified?'Luogo controllato · '+e.source:'Da verificare · '+e.source,'local-label'),el('h3',e.title),el('p',eventWhen(e),'card-meta'),el('p',e.location||'Sede da verificare sulla fonte','card-meta'),el('span',e.priceLabel||'Prezzo da verificare','card-price'));
  const detail=el('button','i','details-trigger');detail.type='button';detail.setAttribute('aria-label',`Apri i dettagli di ${e.title}`);detail.title='Dettagli evento';detail.onclick=()=>openDetails(e);card.append(cover,likeStamp,skipStamp,body,detail);deck.append(card);
  attachSwipe(card,e,likeStamp,skipStamp);
}
function attachSwipe(card,e,likeStamp,skipStamp) {
  let start=null,suppressClick=false;
  const reset=()=>{card.style.transform='';likeStamp.style.opacity='0';skipStamp.style.opacity='0';start=null;};
  card.addEventListener('pointerdown',event=>{if(event.isPrimary===false||event.button!==0||event.target.closest('button,a'))return;start={x:event.clientX,y:event.clientY,id:event.pointerId};suppressClick=false;});
  card.addEventListener('pointermove',event=>{if(!start||event.pointerId!==start.id)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>12){reset();return;}if(Math.abs(dx)>12){if(!card.hasPointerCapture(event.pointerId))card.setPointerCapture(event.pointerId);card.style.transform=`translateX(${Math.max(-130,Math.min(130,dx))}px) rotate(${dx/25}deg)`;likeStamp.style.opacity=String(Math.min(1,Math.max(0,dx/80)));skipStamp.style.opacity=String(Math.min(1,Math.max(0,-dx/80)));suppressClick=true;}});
  card.addEventListener('pointerup',event=>{if(!start||event.pointerId!==start.id)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;const accept=Math.abs(dx)>=80&&Math.abs(dx)>Math.abs(dy)*1.3;reset();if(accept){suppressClick=true;chooseDiscovery(dx>0?'interested':'skip');}});
  card.addEventListener('pointercancel',reset);
  card.addEventListener('click',event=>{if(event.target.closest('button,a'))return;if(suppressClick){suppressClick=false;return;}openDetails(e);});
}
$('prev').onclick=()=>{month=shiftMonth(month,-1);renderMonth(visibleEvents())};$('next').onclick=()=>{month=shiftMonth(month,1);renderMonth(visibleEvents())};$('today').onclick=()=>selectAgendaDay(today);
$('week-prev').onclick=()=>selectAgendaDay(shiftDay(selected,-7));$('week-next').onclick=()=>selectAgendaDay(shiftDay(selected,7));
$('open-month').onclick=()=>{month=selected.slice(0,7);renderMonth(visibleEvents());$('month-dialog').showModal();focusAgendaDay(selected,true)};
$('close-month').onclick=()=>$('month-dialog').close();$('month-dialog').addEventListener('close',()=>{month=selected.slice(0,7);$('open-month').focus()});
$('saved-upcoming').onclick=()=>{savedMode='upcoming';savedVisited=false;setView('saved');$('events').scrollTop=0};
$('saved-past').onclick=()=>{savedMode='past';render();$('events').scrollTop=0};
$('home').onclick=()=>setView('home');$('discover').onclick=()=>setView('discover');$('all').onclick=()=>setView('calendar');$('saved').onclick=()=>setView('saved');$('search').oninput=()=>{if(!filterSnapshot)render()};$('source').onchange=()=>{if(!filterSnapshot)render()};
$('period').onchange=()=>{if(!filterSnapshot)render()};$('collection').onchange=()=>{if(!filterSnapshot)render()};$('like').onclick=()=>chooseDiscovery('interested');$('skip').onclick=()=>chooseDiscovery('skip');$('undo').onclick=undoDiscovery;
$('close-detail').onclick=closeDetails;
$('detail-dialog').addEventListener('close',()=>{clearEventDetailPreview();if(typeof clearEventWeatherPreview==='function')clearEventWeatherPreview();if(detailReturnFocus?.isConnected)detailReturnFocus.focus();else $(view==='home'?'home':view==='district'?'district-zone':view==='eventmap'?'event-map-back':view==='discover'?'like':['calendar','saved'].includes(view)?'events':'all').focus()});
$('home-today').onclick=()=>{$('search').value='';$('source').value='';selected=today;month=today.slice(0,7);setView('calendar')};
$('home-programs').onclick=()=>setView('saved');
$('close-ztl').onclick=()=>$('ztl-dialog').close();
$('ztl-dialog').addEventListener('close',()=>($('utilities-dialog').open?$('utilities-ztl'):$('home')).focus());
let utilityReturnFocus=null;
$('utilities-close').onclick=()=>$('utilities-dialog').close();
$('utilities-dialog').addEventListener('close',()=>{if(utilityReturnFocus?.isConnected)utilityReturnFocus.focus();});
$('utilities-pharmacies').onclick=()=>openPharmacies();
$('utilities-parking').onclick=()=>openParkingCatalog();
$('utilities-waste').onclick=()=>openWaste();
$('utilities-ztl').onclick=()=>openService({id:'ztl'});
$('open-filters').onclick=()=>{if(view==='news')openNewsFilters();else if(view==='bus')openBusMore();else{filterSnapshot=Object.fromEntries(['search','source','period','collection'].map(id=>[id,$(id).value]));$('event-period-field').hidden=$('event-collection-field').hidden=view!=='discover';$('filters-dialog').showModal()}};
$('close-filters').onclick=()=>$('filters-dialog').close();
$('apply-filters').onclick=()=>{filterSnapshot=null;render();$('filters-dialog').close()};
$('reset-filters').onclick=()=>{$('search').value='';$('source').value='';$('period').value='30';$('collection').value='all'};
$('filters-dialog').addEventListener('close',()=>{if(filterSnapshot){for(const [id,value]of Object.entries(filterSnapshot))$(id).value=value;filterSnapshot=null;render()}$('open-filters').focus()});
$('open-info').onclick=openDataHealth;$('network-data-warning').onclick=openDataHealth;$('close-info').onclick=()=>$('info-dialog').close();
$('home-news').onclick=()=>{const item=homeNewsSelection();if(item)openNews(item);else setView('news');};
$('news').onclick=()=>setView('news');
for(const [id,mode] of [['news-all','all'],['news-zone-tab','zone']])$(id).onclick=()=>{newsMode=mode;$('news-feedback').textContent='';render()};
$('news-saved').onclick=()=>{if(typeof savedHubReady!=='undefined'&&savedHubReady){$('saved-category').value='news';$('saved-search').value='';setView('saved');}else{newsMode='saved';render();}};
$('close-news-detail').onclick=()=>$('news-detail-dialog').close();
$('news-detail-dialog').addEventListener('close',()=>{activeNewsValidityPanel=null;if(newsReturnFocus?.isConnected)newsReturnFocus.focus();else $(view==='district'?'district-zone':'news').focus()});
$('news-search').oninput=render;$('news-open-filters').onclick=openNewsFilters;$('news-zone').onclick=openDistrictChoice;
$('close-news-filters').onclick=()=>$('news-filters-dialog').close();
$('apply-news-filters').onclick=()=>{newsFilters={category:$('news-category').value,type:$('news-type').value,status:$('news-status').value};render();$('news-filters-dialog').close()};
$('reset-news-filters').onclick=()=>{$('news-category').value='';$('news-type').value='';$('news-status').value=''};
$('close-bus-timetable').onclick=()=>$('bus-timetable-dialog').close();$('bus-timetable-dialog').addEventListener('close',()=>{if(timetableReturnFocus?.isConnected)timetableReturnFocus.focus();else if($('bus-route-dialog').open)$('bus-route-variant').focus();else $('bus-list').focus()});
$('timetable-direction').onchange=()=>{timetableMapStopKey='';timetableServices();timetableStops();persistTimetable();renderTimetable();$('timetable-results').scrollTop=0};$('timetable-service').onchange=()=>{timetableStops($('timetable-stop').value||timetableMapStopKey);persistTimetable();renderTimetable();$('timetable-results').scrollTop=0};$('timetable-stop').onchange=()=>{persistTimetable();renderTimetable();$('timetable-results').scrollTop=0};
$('bus-back').onclick=()=>setView('home');$('bus-search').oninput=render;$('bus-service').onchange=render;
for(const [id,mode]of [['bus-lines','lines'],['bus-favorites','favorites'],['bus-alerts','alerts']])$(id).onclick=()=>setBusMode(mode);
$('bus-more').onclick=$('bus-alert-more').onclick=openBusMore;$('close-bus-more').onclick=()=>$('bus-more-dialog').close();$('bus-more-dialog').addEventListener('close',()=>$(busMode==='alerts'?'bus-alert-more':'bus-more').focus());
$('bus-alert-mine').onclick=()=>{busAlertScope='mine';render()};$('bus-alert-all').onclick=()=>{busAlertScope='all';render()};
$('bus-updates').onclick=()=>{$('bus-more-dialog').close();renderBusUpdates();$('bus-updates-dialog').showModal()};$('close-bus-updates').onclick=()=>$('bus-updates-dialog').close();$('bus-updates-search').oninput=renderBusUpdates;$('bus-updates-dialog').addEventListener('close',()=>$(busMode==='alerts'?'bus-alert-more':'bus-more').focus());
$('close-bus-detail').onclick=()=>$('bus-detail-dialog').close();$('bus-detail-dialog').addEventListener('close',()=>{if(busReturnFocus?.isConnected)busReturnFocus.focus();else $('bus-list').focus()});
$('discover-event-map').onclick=()=>{eventMapSaved=false;openEventMap()};
$('calendar-event-map').onclick=()=>{eventMapSaved=onlySaved;openEventMap()};
$('event-map-back').onclick=()=>{if(eventMapReturn){selected=eventMapReturn.selected;month=selected.slice(0,7);$('search').value=eventMapReturn.search;$('source').value=eventMapReturn.source;if(agendaReady)restoreAgendaState(eventMapReturn.agenda);}setView(eventMapReturn?.view||'calendar');$('events').scrollTop=eventMapReturn?.scroll||0;$(eventMapReturn?.view==='explore'?'explore-needs-open':'calendar-event-map').focus()};
$('event-map-unlocated').onclick=()=>{const day=selected;setView(eventMapReturn?.view||'calendar');selectAgendaDay(day)};
$('event-map-date').onchange=()=>{const value=$('event-map-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value){$('event-map-date').value=selected;return;}selected=value;month=value.slice(0,7);eventMapFocus=null;render()};
$('event-map-period').onchange=()=>{eventMapFocus=null;render()};
$('event-map-saved').onclick=()=>{eventMapSaved=!eventMapSaved;eventMapFocus=null;render()};
$('explore-back').onclick=()=>setView('home');$('explore-map-tab').onclick=()=>{exploreMode='map';render()};$('explore-list-tab').onclick=()=>{exploreMode='list';render()};
$('explore-search').oninput=()=>{placeMapFocus=null;placesShown=60;render()};$('explore-category').onchange=()=>{placeMapFocus=null;placesShown=60;render()};$('explore-saved').onclick=()=>{exploreSaved=!exploreSaved;placesShown=60;render()};
$('close-place-detail').onclick=()=>$('place-detail-dialog').close();$('place-detail-dialog').addEventListener('close',()=>{if(placeReturnFocus?.isConnected)placeReturnFocus.focus();else $('explore-list-tab').focus()});
$('district-back').onclick=()=>setView('home');$('district-zone').onclick=openDistrictChoice;
$('close-district').onclick=()=>$('district-dialog').close();
$('district-dialog').addEventListener('close',()=>{if(districtReturnFocus?.isConnected)districtReturnFocus.focus({preventScroll:true});});
$('apply-district').onclick=()=>{if($('district-choice').value)applyDistrict($('district-choice').value)};
$('district-choice').onchange=()=>{$('apply-district').disabled=!districtChoices.some(c=>c.value===$('district-choice').value)};
$('clear-district').onclick=()=>applyDistrict('');
$('district-search').oninput=render;
$('district-saved').onclick=()=>{districtSaved=!districtSaved;$('district-feedback').textContent='';render()};
for(const [id,mode]of [['district-updates','updates'],['district-news','news'],['district-notices','notices'],['district-events','events'],['district-city','city']])$(id).onclick=()=>{districtMode=mode;$('district-feedback').textContent='';render();$('district-list').scrollTop=0};
storeSavedSnapshots();
let savedMidnightTimer=null;
function scheduleSavedMidnight(){
  clearTimeout(savedMidnightTimer);
  const next=shiftDay(dayInRome(new Date()),1),hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',hourCycle:'h23'});
  const instant=['+01:00','+02:00'].map(offset=>Date.parse(next+'T00:00:00'+offset)).find(value=>dayInRome(value)===next&&hour.format(new Date(value))==='00');
  savedMidnightTimer=setTimeout(()=>{refreshSavedDay();refreshDataHealth();scheduleSavedMidnight();},Math.max(1,instant-Date.now()+50));
}
scheduleSavedMidnight();
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='hidden')return;refreshSavedDay();refreshDataHealth();scheduleSavedMidnight();});
render();

function busRoutesFor(line){return busRouteData.routes.filter(route=>route.lineId===line.id);}
function busRouteStopKey(route,stop){
  if(!stop.timetableCandidate||route.stops.filter(item=>item.name===stop.name).length!==1)return '';
  const keys=new Set();for(const block of (timetableFor(busRouteLine)?.blocks||[]).filter(block=>block.direction===route.timetableDirection))for(const row of timetableStopRows(block))if(row.name===stop.name)keys.add(row.key);
  return keys.size===1?[...keys][0]:'';
}
function busRouteStopContent(route,stop,{preview=false}={}){
  const box=el('div','','bus-map-stop');box.append(el('strong',stop.name));if(stop.ref)box.append(el('small',(preview?'Linea '+busRouteLine.number+' · ':'')+'Fermata '+stop.ref));
  const official=payload.busOfficial?.lines.some(item=>item.number===busRouteLine.number)&&/^\d+$/.test(stop.ref||'');const key=busRouteStopKey(route,stop);if(official){const number=busRouteLine.number;if(!preview)box.append(el('small','Linea '+number,'bus-stop-line'));if(preview){const departures=el('div','','bus-stop-preview');departures.setAttribute('aria-live','polite');box.append(departures);box.loadDepartures=()=>renderBusStopPreview(departures,number,stop.ref);}const button=el('button',preview?'Tutti gli orari':'Orari ufficiali di questa fermata',preview?'bus-stop-all-times':'');button.onclick=()=>openOfficialBus(number,{stopCode:stop.ref});box.append(button);}else if(key){const button=el('button','Orari di questa fermata');button.onclick=()=>openTimetable(busRouteLine,{direction:route.timetableDirection,stop:key});box.append(button);}else{const button=el('button','Consulta orari linea '+busRouteLine.number);button.onclick=()=>openTimetable(busRouteLine);box.append(button,el('small','Scegli la fermata negli orari della linea.'));}
  const google=el('a','Apri posizione in Google Maps ↗');google.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(stop.lat+','+stop.lon);google.target='_blank';google.rel='noopener noreferrer';if(!preview)box.append(google);
  return box;
}
function renderBusRoute(focusStop=null){
  const route=busRoutesFor(busRouteLine).find(item=>item.id===$('bus-route-variant').value),list=$('bus-route-stops'),message=$('bus-route-message');list.replaceChildren();if(!route)return;if(!route.stops){message.textContent='Caricamento del percorso…';return;}
  $('bus-route-map').hidden=busRouteMode!=='map';list.hidden=busRouteMode!=='list';
  $('bus-route-map-tab').setAttribute('aria-pressed',String(busRouteMode==='map'));$('bus-route-list-tab').setAttribute('aria-pressed',String(busRouteMode==='list'));
  $('bus-route-summary').textContent=route.stops.length+' fermate · '+route.label;
  const source=el('a','Fonte OpenStreetMap ↗');source.href=route.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';$('bus-route-source').replaceChildren(el('span','Percorso OSM indicativo · raccolto il '+formatDay(dayInRome(route.collectedAt||busRouteData.collectedAt),{day:'numeric',month:'short',year:'numeric'})+'. Verifica variazioni e deviazioni sul sito ATV. '),source);
  for(const stop of route.stops){const row=busRouteStopContent(route,stop),locate=el('button','Vedi sulla mappa');locate.onclick=()=>{busRouteMode='map';renderBusRoute(stop.id)};row.append(locate);list.append(row);}
  message.textContent=busRouteTileFailed?'Le strade non si caricano. Puoi usare l’elenco delle fermate.':'';
  if(busRouteMode!=='map')return;
  if(typeof L==='undefined'){message.textContent='Mappa non disponibile. Apri Fermate per consultare il percorso.';return;}
  if(!busRouteMap){busRouteMap=L.map('bus-route-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{busRouteTileFailed=true;$('bus-route-message').textContent='Le strade non si caricano. Puoi usare l’elenco delle fermate.';}).addTo(busRouteMap);busRouteLayer=L.layerGroup().addTo(busRouteMap);}
  installMapLocation(busRouteMap,'bus');busRouteMap.invalidateSize();busRouteLayer.clearLayers();
  L.polyline(route.segments,{color:'#fff',weight:8,opacity:1}).addTo(busRouteLayer);L.polyline(route.segments,{color:'#254f78',weight:4,opacity:1}).addTo(busRouteLayer);
  let focused=null;for(const stop of route.stops){const marker=L.circleMarker([stop.lat,stop.lon],{radius:8,color:'#254f78',weight:2,fillColor:'#fffefa',fillOpacity:1}).bindPopup(busRouteStopContent(route,stop,{preview:true}),{minWidth:200,maxWidth:Math.min(290,($('bus-route-map').clientWidth||330)-40),maxHeight:Math.max(100,Math.min(290,($('bus-route-map').clientHeight||320)-35))}).addTo(busRouteLayer);marker.on?.('popupopen',()=>{const content=marker.getPopup().getContent();if(content.loadDepartures)content.loadDepartures().then(()=>marker.getPopup()?.update());});if(stop.id===focusStop)focused={stop,marker};}
  if(focused){busRouteMap.setView([focused.stop.lat,focused.stop.lon],17);focused.marker.openPopup();}else busRouteMap.fitBounds(route.segments.flat(),{padding:[20,20],maxZoom:14});
}
async function openBusRoute(line){
  const routes=busRoutesFor(line);if(!routes.length)return;busRouteReturnFocus=document.activeElement;const sameLine=busRouteLine?.id===line.id;busRouteLine=line;
  $('bus-route-title').textContent='Linea '+line.number;$('bus-route-map').setAttribute('aria-label','Mappa del percorso della linea '+line.number);const previous=sameLine?$('bus-route-variant').value:line.number==='11'?'11344295':routes[0].id;timetableOptions('bus-route-variant',routes.map(route=>({value:route.id,label:route.label})),'Scegli il percorso',previous);if(!$('bus-route-variant').value)$('bus-route-variant').value=routes[0].id;
  if(!$('bus-route-dialog').open)$('bus-route-dialog').showModal();
  if(busRouteData.assetBase&&!routes[0].stops){
    $('bus-route-map').hidden=true;$('bus-route-stops').hidden=true;$('bus-route-source').replaceChildren();$('bus-route-summary').textContent='Linea '+line.number;$('bus-route-message').textContent='Caricamento del percorso…';
    try{
      if(!busRouteLoads.has(line.id))busRouteLoads.set(line.id,(async()=>{const response=await fetch('bus-routes/'+line.id+'.json',{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(!Array.isArray(data.routes)||!data.routes.length||data.routes.some(route=>route.lineId!==line.id||!Array.isArray(route.stops)||!Array.isArray(route.segments)))throw Error('Percorsi non validi');busRouteData.routes=busRouteData.routes.filter(route=>route.lineId!==line.id).concat(data.routes);})());
      await busRouteLoads.get(line.id);
    }catch{busRouteLoads.delete(line.id);if(busRouteLine?.id===line.id)$('bus-route-message').textContent='Percorso non disponibile. Chiudi e riprova; gli orari restano consultabili dalla scheda della linea.';return;}
    if(busRouteLine?.id!==line.id||!$('bus-route-dialog').open)return;
  }
  renderBusRoute();
}
$('close-bus-route').onclick=()=>$('bus-route-dialog').close();
$('bus-route-dialog').addEventListener('close',()=>{if(busRouteReturnFocus?.isConnected)busRouteReturnFocus.focus();else $('bus-list').focus()});
$('bus-route-variant').onchange=()=>{if(!$('bus-route-variant').value)$('bus-route-variant').value=busRoutesFor(busRouteLine)[0].id;$('bus-route-stops').scrollTop=0;renderBusRoute()};
$('bus-route-map-tab').onclick=()=>{busRouteMode='map';renderBusRoute()};
$('bus-route-list-tab').onclick=()=>{busRouteMode='list';renderBusRoute()};

function eventImage(e){
  const image=e.image;if(!image||typeof image!=='object')return null;
  if(image.license!=='CC BY 4.0'&&!(image.license==='Licenza non specificata'&&image.author==='Comune di Verona'&&image.rightsStatus==='unverified'))return null;
  try{const url=new URL(image.url);if(url.protocol!=='https:'||url.username||url.password)return null;if(url.hostname!=='www.comune.verona.it'&&!(url.hostname==='s3-eu-west-1.amazonaws.com'&&url.pathname.startsWith('/static.opencity.opencontent.it/var/verona/')))return null;return image;}catch{return null;}
}
function eventImageCredit(image){return image.rightsStatus==='unverified'?'Fonte immagine: Comune di Verona · Licenza non specificata':(image.author?'© '+image.author:'Fonte: Comune di Verona')+' · CC BY 4.0';}
function makeEventImage(e,className){const data=eventImage(e),image=el('img','',className);const size=className==='event-thumbnail'?180:['event-cover-image','news-card-image'].includes(className)?640:1200;image.loading=['event-thumbnail','news-card-image','event-poster-image'].includes(className)?'lazy':'eager';image.fetchPriority=className==='event-cover-image'?'high':'auto';image.src='https://flyimg.opencityitalia.it/upload/rf_1,o_auto,w_'+size+',h_'+size+'/'+encodeURIComponent(data.url);image.alt=data.alt||'Immagine dell’evento '+e.title;image.decoding='async';image.draggable=false;image.referrerPolicy='no-referrer';image.onerror=()=>{image.hidden=true};return image;}
function appendEventPoster(content,e){
  const image=eventImage(e);if(!image)return;
  const figure=el('figure','','event-poster'),photo=makeEventImage(e,'event-poster-image'),caption=el('figcaption'),credit=el('p',eventImageCredit(image));
  if(image.caption)caption.append(el('p',image.caption));caption.append(credit);
  if(image.license==='CC BY 4.0'){const license=el('a','Licenza CC BY 4.0 ↗');license.href='https://creativecommons.org/licenses/by/4.0/';license.target='_blank';license.rel='noopener noreferrer';caption.append(license);}else caption.append(el('p','La fonte indica “Licenza sconosciuta”. L’attribuzione non conferma il permesso di riutilizzo.'));
  const original=el('a','Apri immagine intera ↗','event-original-image');original.href=image.url;original.target='_blank';original.rel='noopener noreferrer';
  const source=el('a','Fonte immagine: Comune di Verona ↗');source.href=e.sourceUrl;try{const imageSource=new URL(image.sourceUrl);if(imageSource.origin==='https://www.comune.verona.it'&&!imageSource.pathname.startsWith('/api/'))source.href=imageSource.href;}catch{}source.target='_blank';source.rel='noopener noreferrer';caption.append(source,original);
  photo.onerror=()=>{photo.hidden=true;caption.append(el('p','Immagine non disponibile. Puoi aprire il programma ufficiale.'))};figure.append(photo,caption);content.append(figure);
}

function appendNewsThumbnail(title,item){if(!eventImage(item))return;title.className+=' news-title-with-image';const image=makeEventImage(item,'news-card-image');image.alt='';image.onerror=()=>{image.hidden=true;title.className=title.className.replace(' news-title-with-image','');};title.replaceChildren(image,el('span',item.title,'news-title-text'));}
function appendNewsImageCredit(card,item){const image=eventImage(item);if(image)card.append(el('small',eventImageCredit(image)+' · Crediti nei dettagli','news-image-credit'));}

$('explore-reset').onclick=resetExplore;
$('explore-search-area').onclick=()=>{
  if(!placeMap?.getBounds)return;const b=placeMap.getBounds(),bounds={south:b.getSouth(),north:b.getNorth(),west:b.getWest(),east:b.getEast()};if(!Object.values(bounds).every(Number.isFinite))return;
  $('explore-feedback').textContent='';exploreNearbyPoint=null;exploreBounds=bounds;placeMapFocus=null;placesShown=60;renderExplore();
};

$('explore-events').onclick=()=>{
  const previous={selected,search:$('search').value,source:$('source').value};
  selected=today;$('search').value='';$('source').value='';$('event-map-period').value='7';eventMapSaved=false;openEventMap();
  eventMapReturn={...eventMapReturn,...previous,view:'explore'};$('event-map-back').textContent='← Esplora';
};

function locationMapVisible(key){if(key==='network')return typeof networkIsOpen==='function'?networkIsOpen():$('bus-network-dialog').open;if(key==='event-bus')return $('event-bus-dialog').open;return key==='events'?view==='eventmap':key==='places'?view==='explore'&&exploreMode==='map':$('bus-route-dialog').open&&busRouteMode==='map';}
function drawMapLocation(state,center=false){
  state.layer.clearLayers();if(!currentUserLocation)return;
  const {lat,lon,accuracy}=currentUserLocation,point=[lat,lon];
  const circle=L.circle(point,{radius:accuracy,color:'#2371bc',weight:1,fillColor:'#2371bc',fillOpacity:.12,interactive:false}).addTo(state.layer);
  L.circleMarker(point,{radius:8,color:'#fff',weight:3,fillColor:'#2371bc',fillOpacity:1}).bindPopup(el('div','La tua posizione · precisione circa '+Math.round(accuracy)+' m')).addTo(state.layer);
  if(center){state.map.closePopup?.();state.map.fitBounds(circle.getBounds(),{padding:[35,35],maxZoom:16});}
}
function installMapLocation(map,key){
  if(mapLocationStates.has(key)||typeof L.control!=='function')return;
  const box=el('div','','map-location-control'),button=el('button','◎'),status=el('p','','map-location-status');
  button.type='button';button.id='locate-'+key;button.title='La mia posizione';button.setAttribute('aria-label','Mostra la mia posizione sulla mappa');status.id='location-status-'+key;status.setAttribute('role','status');status.hidden=true;
  box.append(status,button);L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box);
  const control=L.control({position:'bottomright'});control.onAdd=()=>box;control.addTo(map);
  const state={map,key,button,status,layer:L.layerGroup().addTo(map)};mapLocationStates.set(key,state);button.onclick=()=>requestMapLocation(key);drawMapLocation(state);
}
function requestMapLocation(key,options={}){
  const state=mapLocationStates.get(key);if(!state||state.button.disabled){options.onError?.('La mappa o la ricerca della posizione non è disponibile. Puoi scegliere una zona manualmente.');return;}
  const show=(message,duration=8000)=>{clearTimeout(state.statusTimer);state.status.hidden=false;state.status.textContent=message;const note=key==='network'?$('network-location-note'):null;if(note){note.hidden=false;note.textContent=message;}if(duration)state.statusTimer=setTimeout(()=>{state.status.hidden=true;state.status.textContent='';if(note){note.hidden=true;note.textContent='';}},duration);};
  const notifyError=message=>{show(message);options.onError?.(message);};
  if(typeof isSecureContext!=='undefined'&&!isSecureContext){notifyError('Per usare la posizione dal telefono serve la versione HTTPS. L’anteprima Wi-Fi HTTP non la supporta.');return;}
  if(typeof navigator==='undefined'||!navigator.geolocation){notifyError('Posizione non disponibile in questo browser. Puoi spostare la mappa manualmente.');return;}
  state.button.disabled=true;state.button.textContent='…';state.button.setAttribute('aria-busy','true');show('Ricerca della posizione…',0);
  const finish=()=>{state.button.disabled=false;state.button.textContent='◎';state.button.setAttribute('aria-busy','false');};
  const fail=error=>{finish();if(options.isActive&&!options.isActive()){show('',1);return;}if(error.code===1){currentUserLocation=null;for(const item of mapLocationStates.values())item.layer.clearLayers();}notifyError(error.code===1?'Permesso negato. Puoi abilitare la posizione nelle impostazioni del browser.':error.code===3?'La ricerca ha impiegato troppo tempo. Tocca di nuovo per riprovare.':'Posizione non disponibile. Controlla la localizzazione del dispositivo e riprova.');};
  try{navigator.geolocation.getCurrentPosition(position=>{
    finish();const {latitude:lat,longitude:lon,accuracy}=position.coords||{};
    if(options.isActive&&!options.isActive()){show('',1);return;}
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy)||lat< -90||lat>90||lon< -180||lon>180||accuracy<0){notifyError('Il dispositivo ha restituito una posizione non valida. Riprova.');return;}
    currentUserLocation={lat,lon,accuracy};for(const item of mapLocationStates.values())drawMapLocation(item,item===state&&locationMapVisible(key));
    const bounds=placesData.bounds,outside=key==='places'&&bounds&&(lat<bounds[0]||lon<bounds[1]||lat>bounds[2]||lon>bounds[3]);
    show('Posizione rilevata · precisione circa '+Math.round(accuracy)+' m.'+(outside?' Sei fuori dall’area del catalogo delle attività.':''),outside?8000:3000);
    options.onSuccess?.(currentUserLocation);
  },fail,{enableHighAccuracy:true,timeout:12000,maximumAge:0});}catch{fail({code:2});}
}
