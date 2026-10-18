const payload = JSON.parse(document.getElementById('event-data').textContent);
const events = payload.events;
const newsData=payload.news||{items:[],sources:[]},newsItems=newsData.items||[];
const busData=payload.bus||{lines:[],alerts:[],sources:[]};
const placesData=payload.places||{items:[]},places=placesData.items||[];
const districtsData=payload.districts||{items:[]};
const districtChoices=districtsData.items.flatMap(d=>[{value:d.id+':*',name:'Tutta la circoscrizione',district:d,quarter:null},...d.quarters.map((q,i)=>({value:d.id+':'+i,name:q,district:d,quarter:q}))]);
let districtChoice='',districtMode='news',districtSaved=false;
try{const stored=JSON.parse(localStorage.getItem('verona-district-v1')||'null');if(districtChoices.some(c=>c.value===stored))districtChoice=stored;}catch{}
let exploreMode='map',exploreSaved=false,placeFavorites={},placeMap=null,placeLayer=null,placeMapSignature=null,placeReturnFocus=null,placesShown=60;
try{placeFavorites=JSON.parse(localStorage.getItem('verona-places-v1')||'{}')||{};}catch{}
if(typeof placeFavorites!=='object'||Array.isArray(placeFavorites))placeFavorites={};
let busMode='lines',busFavorites={},busReturnFocus=null,busVisited=false,busAlertScope='all';
const busQueries={lines:'',alerts:''};
try{busFavorites=JSON.parse(localStorage.getItem('verona-bus-v1')||'{}')||{};}catch{}
if(typeof busFavorites!=='object'||Array.isArray(busFavorites))busFavorites={};
let newsMode='all',newsBookmarks={},newsReturnFocus=null;
let newsFilters={category:'',type:''};
try{newsBookmarks=JSON.parse(localStorage.getItem('verona-news-v1')||'{}')||{};}catch{}
if(typeof newsBookmarks!=='object'||Array.isArray(newsBookmarks))newsBookmarks={};
const $ = id => document.getElementById(id);
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit' });
const dayCache = new Map();
const today = dayInRome(new Date());
let selected = today, month = today.slice(0,7), onlySaved = false, preferences = {};
let savedVisited=false,eventMapReturn=null,filterSnapshot=null;
let eventMap=null,eventMapLayer=null,eventMapSignature=null,eventMapSaved=false,eventMapFocus=null;
try { preferences = JSON.parse(localStorage.getItem('verona-events-v1') || '{}') || {}; } catch {}
if(typeof preferences!=='object'||Array.isArray(preferences))preferences={};
let view='home', dismissed={}, lastChoice=null, detailReturnFocus=null, currentDiscovery=null;
const services=[
  {id:'events',name:'Eventi',icon:'▦',description:'Scopri, salva, partecipa',ready:true},
  {id:'bus',name:'Autobus',icon:'↔',description:'Linee, percorsi e avvisi',ready:true},
  {id:'news',name:'Notizie e Comune',icon:'▤',description:'Resta aggiornato',ready:true},
  {id:'ztl',name:'Permessi ZTL',icon:'P',description:'Accedi al portale mobilità',ready:true},
  {id:'district',name:'Il mio quartiere',icon:'⌂',description:'Notizie, avvisi e iniziative',ready:true},
  {id:'explore',name:'Esplora',icon:'⌖',description:'La mappa delle attività',ready:true}
];
try { dismissed=JSON.parse(localStorage.getItem('verona-dismissed-v1')||'{}')||{}; } catch {}
if(typeof dismissed!=='object'||Array.isArray(dismissed))dismissed={};
function dayInRome(value) { return dayFormatter.format(new Date(value)); }
function eventDay(value) { if(!dayCache.has(value))dayCache.set(value,value.length===10?value:dayInRome(value));return dayCache.get(value); }
function occursOn(event, day) { return eventDay(event.startsAt) <= day && eventDay(event.endsAt) >= day; }
function shiftMonth(value, delta) { const [y,m] = value.split('-').map(Number); return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7); }
function visibleEvents() { const q = $('search').value.toLocaleLowerCase('it'); return events.filter(e => (!$('source').value || e.source === $('source').value) && (!onlySaved || ['interested','going'].includes(preferences[e.id])) && `${e.title} ${e.location||''}`.toLocaleLowerCase('it').includes(q)); }
function el(tag, value, cls) { const n=document.createElement(tag); n.textContent=value; if(cls)n.className=cls; return n; }
function formatDay(value, options) { return new Intl.DateTimeFormat('it-IT', {timeZone:'Europe/Rome', ...options}).format(new Date(value+'T12:00:00Z')); }
function save(id, state) {
  lastChoice=null;
  if(state) preferences[id]=state; else delete preferences[id];
  try { localStorage.setItem('verona-events-v1',JSON.stringify(preferences)); $('feedback').textContent=state==='going'?'Presenza confermata nel tuo calendario.':state?'Evento aggiunto al tuo calendario.':'Evento rimosso dal tuo calendario.'; }
  catch { $('feedback').textContent='Scelta valida per questa visita. Il browser non consente il salvataggio permanente.'; }
  if(view==='district')$('district-feedback').textContent=$('feedback').textContent;
  render();
}
function render() {
  $('page-heading').hidden=view==='home';
  $('app-shell').classList.toggle('home-layout',view==='home');
  const filtered=visibleEvents();
  $('month').textContent=formatDay(month+'-01',{month:'long',year:'numeric'});
  $('selected').textContent=formatDay(selected,{weekday:'long',day:'numeric',month:'long'});
  for(const [id,target] of [['home','home'],['discover','discover'],['news','news'],['all','calendar'],['saved','saved']]){
    const active=view===target||(target==='calendar'&&view==='eventmap');$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));
  }
  $('home-view').hidden=view!=='home';$('news-view').hidden=view!=='news';$('discover-view').hidden=view!=='discover';$('calendar-view').hidden=!['calendar','saved'].includes(view);
  $('bus-view').hidden=view!=='bus';
  $('event-map-view').hidden=view!=='eventmap';
  $('explore-view').hidden=view!=='explore';
  $('district-view').hidden=view!=='district';
  $('open-filters').hidden=['home','explore','district','news','bus'].includes(view);
  $('page-title').textContent=view==='home'?'':view==='explore'?'Esplora Verona':view==='bus'?'Autobus':view==='news'?'Notizie e Comune':view==='discover'?'Scopri Verona':onlySaved?'I tuoi salvati':'Il calendario';
  $('page-intro').textContent=view==='home'?'':view==='explore'?'Piccole scoperte, vicino a te.':view==='bus'?'ATV · percorsi e orari programmati':view==='news'?'Ultime pubblicazioni · Comune di Verona':view==='discover'?'Il tuo prossimo programma è qui.':onlySaved?'Da “mi interessa” a “ci vediamo lì”.':'Scegli un giorno. Trova qualcosa di bello.';
  $('filter-dot').hidden=!($('search').value||$('source').value||($('period').value&&$('period').value!=='30')||($('collection').value&&$('collection').value!=='local'));
  renderAgenda(filtered);
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
}
function renderEventFreshness(){
  const report=payload.importReport,box=$('event-source-status');box.replaceChildren();
  const sources=report?.sources||[...new Set(events.map(e=>e.source))].map(source=>({source,status:'ok',lastSuccessAt:events.filter(e=>e.source===source).map(e=>e.checkedAt).filter(Boolean).sort().at(-1)}));
  for(const source of sources){const date=source.lastSuccessAt?new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(source.lastSuccessAt)):'mai riuscito';box.append(el('p',source.source+' · Ultimo aggiornamento riuscito: '+date+(source.status==='error'?'. Ultimo tentativo non riuscito: dati precedenti conservati.':'.')));}
  const failed=sources.some(source=>source.status==='error'),stale=payload.updatedAt&&Date.now()-Date.parse(payload.updatedAt)>48*3600000;
  const warning=$('event-update-warning');warning.hidden=!failed&&!stale;warning.textContent=failed?'Una fonte non è stata aggiornata. Sono conservati i dati precedenti: dettagli in ⓘ.':stale?'La raccolta eventi risale a oltre due giorni fa. Verifica i dettagli sulla fonte ufficiale.':'';
  if(report?.checkedAt)box.append(el('p','Ultimo tentativo: '+new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(report.checkedAt))+'. La raccolta non rileva automaticamente tutte le cancellazioni o variazioni.','detail-note'));
}
function shiftDay(day,delta){return new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);}
function selectAgendaDay(day){selected=day;month=day.slice(0,7);$('feedback').textContent='';render();$('events').scrollTop=0;}
function focusAgendaDay(key,monthly){const button=Array.from($(monthly?'grid':'week-grid').children).find(b=>b.getAttribute('data-day')===key);button?.focus();}
function agendaDays(filtered,container,keys,monthly=false){
  container.replaceChildren();
  for(const key of keys){
    const matches=filtered.filter(e=>occursOn(e,key)),button=el('button','',monthly?'day':'week-day');button.type='button';
    button.classList.toggle('outside',!key.startsWith(month));button.classList.toggle('selected',key===selected);button.classList.toggle('today',key===today);
    button.setAttribute('data-day',key);button.setAttribute('aria-pressed',String(key===selected));button.setAttribute('aria-label',`${formatDay(key,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}, ${matches.length} eventi`);
    if(!monthly)button.append(el('span',formatDay(key,{weekday:'short'}),'weekday'));
    button.append(el('span',String(Number(key.slice(-2))),'number'));
    if(monthly&&matches.length)button.append(el('span','','event-chip'));
    if(!monthly)button.append(el('span',matches.length?String(matches.length):'–','day-count'));
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
  const monday=shiftDay(selected,-((new Date(selected+'T12:00:00Z').getUTCDay()+6)%7));
  $('agenda-month').textContent=formatDay(selected,{month:'long',year:'numeric'});
  $('week-range').textContent=formatDay(monday,{day:'numeric',month:'short'})+' – '+formatDay(shiftDay(monday,6),{day:'numeric',month:'short'});
  agendaDays(filtered,$('week-grid'),Array.from({length:7},(_,i)=>shiftDay(monday,i)));if($('month-dialog').open)renderMonth(filtered);
  const chips=$('agenda-filters');chips.replaceChildren();
  for(const id of ['search','source'])if($(id).value){const b=el('button',$(id).value+' ×');b.setAttribute('aria-label','Rimuovi filtro: '+$(id).value);b.onclick=()=>{$(id).value='';render()};chips.append(b)}chips.hidden=!chips.children.length;
  const group=e=>eventDay(e.startsAt)<selected?1:e.startsAt.length===10?2:0;
  const daily=filtered.filter(e=>occursOn(e,selected)).sort((a,b)=>group(a)-group(b)||a.startsAt.localeCompare(b.startsAt)||a.title.localeCompare(b.title,'it'));
  $('count').textContent=`${daily.length} ${daily.length===1?'appuntamento':'appuntamenti'}${onlySaved?' nel tuo calendario':''}`;
  const list=$('events');list.replaceChildren();
  if(!daily.length){
    const box=el('div','','agenda-empty');box.append(el('h3',onlySaved?'Non hai eventi salvati per questo giorno.':'Nessun evento per questo giorno.'),el('p',onlySaved?'Esplora gli eventi e salva i tuoi prossimi programmi.':'Prova una data diversa o modifica i filtri.'));
    if($('search').value||$('source').value){const reset=el('button','Rimuovi ricerca e filtri');reset.onclick=()=>{$('search').value='';$('source').value='';render()};box.append(reset)}
    const next=filtered.filter(e=>eventDay(e.startsAt)>selected).sort((a,b)=>a.startsAt.localeCompare(b.startsAt))[0];
    if(next){const b=el('button','Prossimi eventi · '+formatDay(eventDay(next.startsAt),{day:'numeric',month:'short'}));b.onclick=()=>selectAgendaDay(eventDay(next.startsAt));box.append(b)}
    const discover=el('button',onlySaved?'Scopri eventi da salvare':'Sfoglia gli eventi');discover.onclick=()=>setView('discover');box.append(discover);list.append(box);
  }
  for(const e of daily){
    const card=el('article','','event-card'),meta=el('div','','agenda-meta'),state=preferences[e.id];meta.append(el('span',agendaTime(e),'agenda-time'));
    if(state)meta.append(el('span',state==='going'?'✓ Partecipi':'♡ Ti interessa','agenda-state'+(state==='going'?' going':'' )));
    card.append(meta,el('h3',e.title),el('p',e.location||'Sede da verificare sulla fonte'),el('span',e.source,'source'));
    const actions=el('div','','actions'),saveButton=el('button',state?'✓ Salvato':'♡ Salva',state?'chosen':'');
    saveButton.setAttribute('aria-label',(state?'Gestisci evento salvato: ':'Salva: ')+e.title);saveButton.onclick=()=>{if(state)openDetails(e);else{save(e.id,'interested');$('events').focus()}};
    const detail=el('button','Dettagli →');detail.setAttribute('aria-label','Dettagli: '+e.title);detail.onclick=()=>openDetails(e);
    actions.append(saveButton,detail);card.append(actions);list.append(card);
  }
}
function currentDistrict(){return districtChoices.find(c=>c.value===districtChoice)||null;}
function districtMatch(item){const chosen=currentDistrict();if(!chosen)return null;return (item.districtMatches||[]).find(m=>m.id===chosen.district.id&&(m.explicit||!chosen.quarter||m.quarters.includes(chosen.quarter)))||null;}
function districtRows(){
  const q=$('district-search').value.trim().toLocaleLowerCase('it'),isEvent=districtMode==='events';
  return (isEvent?events:newsItems).filter(i=>{
    if(isEvent&&(i.endsAt.length===10?eventDay(i.endsAt)<today:Date.parse(i.endsAt)<Date.now()))return false;
    if(districtMode==='city'?(i.districtMatches||[]).length>0:!districtMatch(i))return false;
    if(districtMode==='news'&&i.sourceKey!=='notizie'||districtMode==='notices'&&i.sourceKey!=='avvisi')return false;
    if(districtSaved&&!(isEvent?['interested','going'].includes(preferences[i.id]):newsBookmarks[i.id]))return false;
    return `${i.title} ${i.summary||''} ${i.location||''}`.toLocaleLowerCase('it').includes(q);
  }).sort((a,b)=>isEvent?a.startsAt.localeCompare(b.startsAt):b.publishedOn.localeCompare(a.publishedOn));
}
function districtReason(item){const m=districtMatch(item);return m?.explicit?`Circoscrizione ${m.id} indicata nel testo`:m?`Nome della zona nella ${districtMode==='events'?'sede':'pubblicazione'}: ${m.quarters.join(', ')}`:'Zona non indicata nella pubblicazione';}
function openDistrictChoice(){
  const select=$('district-choice');select.replaceChildren();const empty=el('option','Scegli una zona…');empty.value='';select.append(empty);
  for(const d of districtsData.items){const group=el('optgroup','');group.label=`Circoscrizione ${d.id} · ${d.name}`;for(const c of districtChoices.filter(c=>c.district.id===d.id)){const option=el('option',c.name);option.value=c.value;group.append(option);}select.append(group);}
  select.value=districtChoice;$('apply-district').disabled=!districtChoice;$('district-dialog').showModal();
}
function applyDistrict(value){
  if(value&&!districtChoices.some(c=>c.value===value))return;
  districtChoice=value;$('district-feedback').textContent='';
  try{localStorage.setItem('verona-district-v1',JSON.stringify(value));}catch{$('district-feedback').textContent='Zona selezionata per questa visita. Il browser non consente il salvataggio.';}
  $('district-dialog').close();$('district-search').value='';districtSaved=false;if(view==='news')newsMode='zone';render();$(view==='news'?'news-zone':'district-zone').focus();
}
function renderDistrict(){
  const chosen=currentDistrict(),isEvent=districtMode==='events';
  $('district-name').textContent=chosen?(chosen.quarter||chosen.district.name):'La tua zona, ogni giorno.';
  $('district-area').textContent=chosen?`Circoscrizione ${chosen.district.id} · ${chosen.district.name}`:'Scegli il tuo quartiere a Verona';
  $('district-change').textContent=chosen?'Cambia →':'Scegli →';
  $('district-saved').classList.toggle('active',districtSaved);$('district-saved').setAttribute('aria-pressed',String(districtSaved));
  for(const [id,mode]of [['district-news','news'],['district-notices','notices'],['district-events','events'],['district-city','city']]){$(id).classList.toggle('active',districtMode===mode);$(id).setAttribute('aria-pressed',String(districtMode===mode));}
  $('district-office').href=chosen?chosen.district.sourceUrl:districtsData.sourceUrl;
  $('district-office').textContent=chosen?'La circoscrizione ↗':'Le circoscrizioni ↗';
  const updated=isEvent?payload.updatedAt:newsData.updatedAt;
  $('district-updated').textContent=updated?'Dati del '+formatDay(dayInRome(updated),{day:'numeric',month:'short'}):'Dati non disponibili';
  const list=$('district-list');list.replaceChildren();
  if(!chosen&&districtMode!=='city'){
    $('district-summary').textContent='';
    const card=el('div','','district-onboarding');const b=el('button','Scegli il mio quartiere');b.onclick=openDistrictChoice;
    card.append(el('span','⌂','district-symbol'),el('h2','Partiamo da dove sei.'),el('p','Segui le notizie, gli avvisi e gli eventi che citano il tuo quartiere o la sua circoscrizione.'),b,el('p','Puoi cambiare zona in ogni momento.'));list.append(card);return;
  }
  const rows=districtRows();
  $('district-summary').textContent=`${rows.length} ${isEvent?'appuntamenti futuri':'pubblicazioni'}${districtSaved?' salvati':''} · `+(districtMode==='city'?'Dal Comune, senza zona indicata. Non necessariamente riferite al tuo quartiere.':isEvent?'Zona ricavata dalla sede riportata. Verifica i dettagli.':'Quartiere e circoscrizione citati nei testi. Raccolta parziale.');
  if(!isEvent&&newsData.sources?.some(s=>s.status==='error'))$('district-summary').textContent+=' Aggiornamento incompleto: verifica la fonte.';
  if(!rows.length){const card=el('div','','district-onboarding');card.append(el('h2',districtSaved?'Nessun contenuto salvato.':'Per ora non ci sono risultati.'),el('p',districtSaved?'Salva una notizia o un evento per ritrovarlo qui.':'La raccolta può non includere tutte le iniziative della zona. Prova un’altra scheda o cambia ricerca.'));const b=el('button',districtSaved?'Mostra tutti':$('district-search').value?'Azzera ricerca':'Leggi dal Comune');b.onclick=()=>{if(districtSaved)districtSaved=false;else if($('district-search').value)$('district-search').value='';else districtMode='city';render()};card.append(b);list.append(card);return;}
  for(const item of rows){
    const card=el('article','','news-card'),meta=el('div','','news-card-meta');
    meta.append(el('span',isEvent?'Evento':item.kind,'news-kind'),el('span',isEvent?eventWhen(item):formatDay(item.publishedOn,{day:'numeric',month:'short',year:'numeric'})));
    const title=el('button',item.title,'news-title');title.onclick=()=>isEvent?openDetails(item):openNews(item);
    card.append(meta,title,el('p',isEvent?(item.location||'Consulta la sede sulla fonte'):item.summary),el('p',districtReason(item),'district-match'));
    if(isEvent){const actions=el('div','','actions');const state=preferences[item.id];for(const [label,value]of [['Mi interessa','interested'],['Partecipo','going']]){const b=el('button',(state===value?'✓ ':'')+label,state===value?'chosen':'');b.setAttribute('aria-pressed',String(state===value));b.onclick=()=>save(item.id,state===value?(value==='going'?'interested':null):value);actions.append(b);}if(state){const remove=el('button','Rimuovi');remove.onclick=()=>save(item.id,null);actions.append(remove);}card.append(actions);}
    else{const bottom=el('div','','news-card-bottom');bottom.append(el('span','Comune di Verona','news-category'),newsSaveButton(item));card.append(bottom);}
    list.append(card);
  }
}
function eventPosition(e){const p=e.coordinates;if(e.mapDisabled||!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.lat<44.5||p.lat>46.3||p.lon<10||p.lon>12)return null;return p;}
function eventMapEvents(){const days=Number($('event-map-period').value||1);const end=new Date(Date.parse(selected+'T12:00:00Z')+(days-1)*86400000).toISOString().slice(0,10);return visibleEvents().filter(e=>eventDay(e.startsAt)<=end&&eventDay(e.endsAt)>=selected&&(!eventMapSaved||['interested','going'].includes(preferences[e.id])));}
function openEventMap(event=null){if(view!=='eventmap')eventMapReturn={view:['calendar','saved'].includes(view)?view:'calendar',selected,search:$('search').value,source:$('source').value,scroll:$('events').scrollTop||0};if(event){selected=eventDay(event.startsAt);month=selected.slice(0,7);eventMapFocus=event.id;eventMapSaved=false;$('search').value='';$('source').value='';$('event-map-period').value='1';}else eventMapFocus=null;setView('eventmap');}
function renderEventMap(){
  $('event-map-date').value=selected;$('event-map-saved').classList.toggle('active',eventMapSaved);$('event-map-saved').setAttribute('aria-pressed',String(eventMapSaved));
  const all=eventMapEvents(),mapped=all.filter(e=>eventPosition(e)),groups=new Map();
  for(const e of mapped){const p=eventPosition(e),key=`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
  $('event-map-count').textContent=`${mapped.length} appuntamenti · ${groups.size} luoghi · ${all.length-mapped.length} senza posizione certa`;
  $('event-map-unlocated').hidden=all.length===mapped.length;$('event-map-unlocated').textContent=`Vedi nel calendario anche i ${all.length-mapped.length} senza posizione →`;
  const message=$('events-map-message');
  if(typeof L==='undefined'){message.textContent='Mappa non disponibile. Gli eventi restano consultabili nel calendario.';return;}
  if(!eventMap){eventMap=L.map('events-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer(placesData.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{message.textContent='Le strade non si caricano. Controlla la connessione o usa il calendario.';}).addTo(eventMap);eventMapLayer=L.layerGroup().addTo(eventMap);}
  eventMap.invalidateSize();
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
function filteredPlaces(){const q=$('explore-search').value.trim().toLocaleLowerCase('it');return places.filter(p=>(!$('explore-category').value||p.category===$('explore-category').value)&&(!exploreSaved||placeFavorites[p.id])&&`${p.name} ${p.address||''}`.toLocaleLowerCase('it').includes(q));}
function togglePlace(id){if(placeFavorites[id])delete placeFavorites[id];else placeFavorites[id]=true;try{localStorage.setItem('verona-places-v1',JSON.stringify(placeFavorites));$('explore-feedback').textContent=placeFavorites[id]?'Attività salvata nei preferiti.':'Attività rimossa dai preferiti.';}catch{$('explore-feedback').textContent='Scelta disponibile per questa visita. Il browser non consente il salvataggio.';}render();}
function placeStar(place){const b=el('button',placeFavorites[place.id]?'★':'☆','bus-favorite'+(placeFavorites[place.id]?' chosen':''));b.type='button';b.setAttribute('aria-label',`${placeFavorites[place.id]?'Rimuovi dai':'Aggiungi ai'} preferiti: ${place.name}`);b.setAttribute('aria-pressed',String(Boolean(placeFavorites[place.id])));b.onclick=()=>togglePlace(place.id);return b;}
function renderExplore(){
  const matches=filteredPlaces();
  $('explore-map-tab').classList.toggle('active',exploreMode==='map');$('explore-list-tab').classList.toggle('active',exploreMode==='list');
  $('explore-map-tab').setAttribute('aria-pressed',String(exploreMode==='map'));$('explore-list-tab').setAttribute('aria-pressed',String(exploreMode==='list'));
  $('explore-saved').classList.toggle('active',exploreSaved);$('explore-saved').setAttribute('aria-pressed',String(exploreSaved));
  $('places-map').hidden=exploreMode!=='map';$('places-list').hidden=exploreMode!=='list';$('places-map-message').hidden=exploreMode!=='map';
  $('explore-count').textContent=`${matches.length} attività${exploreSaved?' preferite':''} · ${placesData.updatedAt?'raccolta '+formatDay(dayInRome(placesData.updatedAt),{day:'numeric',month:'short'}):'raccolta non disponibile'}${placesData.status==='error'?' · aggiornamento non riuscito':''}`;
  const list=$('places-list');list.replaceChildren();
  if(!matches.length)list.append(el('p',exploreSaved?'Nessun preferito con questi filtri. Salva un’attività con la stella.':'Nessuna attività trovata. Prova un’altra categoria o una ricerca diversa.','place-empty'));
  for(const p of matches.slice(0,placesShown)){const card=el('article','','place-card'),open=el('button','','place-open');open.type='button';open.append(el('span',p.category,'place-category'),el('strong',p.name),el('p',p.address||'Indirizzo non indicato · posizione sulla mappa'));open.onclick=()=>openPlace(p);card.append(open,placeStar(p));list.append(card);}
  if(matches.length>placesShown){const more=el('button','Mostra altre attività','places-more');more.onclick=()=>{placesShown+=60;renderExplore()};list.append(more);}
  if(exploreMode==='map')renderPlacesMap(matches);
}
function renderPlacesMap(matches){
  const message=$('places-map-message');
  if(typeof L==='undefined'){message.textContent='Mappa non disponibile. Apri Lista per consultare le attività.';return;}
  if(!placeMap){placeMap=L.map('places-map',{preferCanvas:true}).setView([45.4384,10.9916],13);L.tileLayer(placesData.tileUrl||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',updateWhenIdle:true}).on('tileerror',()=>{message.textContent='Le strade non si caricano: controlla la connessione oppure usa Lista.';}).addTo(placeMap);placeLayer=L.layerGroup().addTo(placeMap);}
  placeMap.invalidateSize();
  const signature=matches.map(p=>p.id).join(',');if(signature===placeMapSignature)return;
  placeMapSignature=signature;placeLayer.clearLayers();message.textContent=matches.length?'':'Nessuna attività con questi filtri. Puoi cambiare categoria o ricerca.';
  const colors={'Bar e caffè':'#a16c42','Ristoranti':'#ab635b','Negozi':'#536e9b','Artigiani':'#897043','Farmacie':'#4c896c','Sport':'#83719c','Servizi':'#5c7f7d'};
  for(const p of matches){const popup=el('div','','map-popup');popup.append(el('strong',p.name),el('span',p.category));const b=el('button','Apri la scheda →');b.onclick=()=>openPlace(p);popup.append(b);L.circleMarker([p.lat,p.lon],{radius:7,color:'#fff',weight:2,fillColor:colors[p.category]||'#507447',fillOpacity:.95}).bindPopup(popup).addTo(placeLayer);}
  if(matches.length)placeMap.fitBounds(matches.map(p=>[p.lat,p.lon]),{padding:[25,25],maxZoom:16});
}
function openPlace(p){
  placeReturnFocus=document.activeElement;const content=$('place-detail-content');content.replaceChildren();const title=el('h2',p.name);title.id='place-detail-title';
  content.append(el('span',p.category,'source'),title,el('p',p.address||'Indirizzo non disponibile. Usa la posizione sulla mappa.'),el('p','Dati della community OpenStreetMap, non ancora verificati dal titolare.','detail-note'));
  if(p.openingHours)content.append(el('h3','Orari riportati nella fonte'),el('p',p.openingHours,'place-hours'));else content.append(el('p','Orari non disponibili. Verifica direttamente con l’attività.','detail-note'));
  if(p.wheelchair)content.append(el('p',`Accesso in sedia a rotelle indicato nella fonte: ${{yes:'sì',no:'no',limited:'limitato'}[p.wheelchair]}. Da verificare con l’attività.`,'detail-note'));
  const links=el('div','','place-links');const addLink=(label,url)=>{const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a)};
  addLink('Indicazioni per arrivare ↗',`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`);
  if(p.website){try{const u=new URL(p.website);if(['https:','http:'].includes(u.protocol))addLink('Sito dell’attività ↗',u.href);}catch{}}
  if(p.phone){const phone=p.phone.split(';')[0].replace(/[^+\d]/g,'');if(phone){const a=el('a',`Chiama ${p.phone}`);a.href='tel:'+phone;links.append(a);}}
  addLink('Scheda OpenStreetMap ↗',p.sourceUrl);content.append(links,placeStar(p),el('p',`Fonte: © OpenStreetMap contributors · ODbL. Raccolta del ${formatDay(dayInRome(p.checkedAt),{day:'numeric',month:'long',year:'numeric'})}. Dati e orari possono essere incompleti o cambiati.`,'detail-note'));
  const star=content.children[content.children.length-2];star.onclick=()=>{togglePlace(p.id);star.textContent=placeFavorites[p.id]?'★':'☆';star.setAttribute('aria-pressed',String(Boolean(placeFavorites[p.id])));star.setAttribute('aria-label',`${placeFavorites[p.id]?'Rimuovi dai':'Aggiungi ai'} preferiti: ${p.name}`);star.classList.toggle('chosen',Boolean(placeFavorites[p.id]));};
  $('place-detail-dialog').showModal();
}
function openService(service){
  if(service.id==='ztl'){$('ztl-dialog').showModal();return;}
  if(service.ready)setView(service.id==='events'?'discover':service.id);
}
function renderHome(){
  $('home-date').textContent=formatDay(today,{weekday:'long',day:'numeric',month:'long'});
  const todayCount=new Set(events.filter(e=>occursOn(e,today)).map(e=>e.sourceUrl)).size;
  $('home-today').textContent=`${todayCount} eventi oggi →`;
  $('services').replaceChildren();
  for(const service of services){
    const tile=el('button','','service-tile'+(service.ready?' ready':''));tile.type='button';tile.setAttribute('aria-label',service.name+(service.ready?'':' · in preparazione'));tile.setAttribute('data-service',service.id);
    const icon=el('span',service.icon,'service-icon');icon.setAttribute('aria-hidden','true');
    tile.append(icon,el('span',service.name,'service-name'),el('span',service.id==='district'&&currentDistrict()?(currentDistrict().quarter||currentDistrict().district.name):service.description,'service-description'));
    if(!service.ready)tile.append(el('span','PRESTO','service-badge'));
    tile.onclick=()=>openService(service);$('services').append(tile);
  }
  const featured=events.filter(e=>e.localVerified&&(e.endsAt.length===10?eventDay(e.endsAt)>=today:Date.parse(e.endsAt)>=Date.now())).sort((a,b)=>a.startsAt.localeCompare(b.startsAt))[0];
  $('home-featured').replaceChildren();
  if(featured){const button=el('button','','home-event');button.type='button';button.append(el('span',eventWhen(featured),'home-event-date'),el('strong',featured.title),el('span',featured.location||'Verona','home-event-place'));button.onclick=()=>openDetails(featured);$('home-featured').append(button);}
  else{const button=el('button','Trova un evento nel calendario →','home-event');button.onclick=()=>setView('calendar');$('home-featured').append(button);}
  const total=events.filter(e=>['interested','going'].includes(preferences[e.id])&&eventDay(e.endsAt)>=today).length;
  $('home-programs').textContent=total?`I tuoi programmi (${total}) →`:'I tuoi programmi →';
  const latest=newsItems[0];$('home-news-title').textContent=latest?`Dal Comune · ${latest.title}`:'Le ultime dal Comune →';
}
function filteredNews(){
  const q=$('news-search').value.trim().toLocaleLowerCase('it');
  return newsItems.filter(i=>(newsMode!=='zone'||districtMatch(i))&&(newsMode!=='saved'||newsBookmarks[i.id])&&(!newsFilters.type||i.sourceKey===newsFilters.type)&&(!newsFilters.category||i.category===newsFilters.category)&&`${i.title} ${i.summary||''}`.toLocaleLowerCase('it').includes(q));
}
function newsTopic(value){return {'Mobilità':'Mobilità e lavori','Servizi':'Servizi e uffici','Comunità':'Famiglie e comunità','Bandi e opportunità':'Contributi e opportunità','Cultura e tempo libero':'Vita cittadina','Dal Comune':'Altre comunicazioni'}[value]||value;}
function newsZoneLabel(item){const matches=item.districtMatches||[];return matches.length?matches.map(m=>m.explicit?`Circoscrizione ${m.id}`:m.quarters.join(', ')).join(' · '):'Zona non indicata';}
function openNewsFilters(){$('news-category').value=newsFilters.category;$('news-type').value=newsFilters.type;$('news-filters-dialog').showModal();}
function busMatches(line){const q=$('bus-search').value.toLocaleLowerCase('it').trim();return (!$('bus-service').value||line.service===$('bus-service').value)&&(busMode!=='favorites'||busFavorites[line.id])&&(line.number+' '+line.route+' '+line.serviceLabel).toLocaleLowerCase('it').includes(q);}
function relatedBusAlerts(line){return busData.alerts.filter(a=>a.lines.includes(line.number));}
function busFavoriteNumbers(){return new Set(busData.lines.filter(line=>busFavorites[line.id]).map(line=>line.number));}
function setBusMode(mode){const bucket=busMode==='alerts'?'alerts':'lines';busQueries[bucket]=$('bus-search').value;busMode=mode;$('bus-search').value=busQueries[mode==='alerts'?'alerts':'lines'];if(mode==='alerts')busAlertScope=busFavoriteNumbers().size?'mine':'all';$('bus-feedback').textContent='';render();$('bus-list').scrollTop=0;}
function busStar(line){const button=el('button',busFavorites[line.id]?'★':'☆','bus-favorite'+(busFavorites[line.id]?' chosen':''));button.type='button';button.setAttribute('aria-pressed',String(Boolean(busFavorites[line.id])));button.setAttribute('aria-label',(busFavorites[line.id]?'Rimuovi dalle tue linee: ':'Aggiungi alle tue linee: ')+line.number+', '+line.serviceLabel);button.onclick=()=>toggleBus(line.id);return button;}
function toggleBus(id){if(busFavorites[id])delete busFavorites[id];else busFavorites[id]=true;try{localStorage.setItem('verona-bus-v1',JSON.stringify(busFavorites));$('bus-feedback').textContent=busFavorites[id]?'Linea aggiunta alle tue linee.':'Linea rimossa dalle tue linee.';}catch{$('bus-feedback').textContent='Scelta disponibile per questa visita. Salvataggio permanente non consentito dal browser.';}render();if(view==='bus'&&!$('bus-detail-dialog').open)$('bus-list').focus();}
function officialBusLink(url,label,cls='detail-link'){try{const parsed=new URL(url);if(parsed.origin==='https://www.atv.verona.it'){const a=el('a',label,cls);a.href=parsed.href;a.target='_blank';a.rel='noopener noreferrer';return a;}}catch{}return el('p','Collegamento non disponibile.');}
function busPublicationCard(item,line=null){const card=el('article','','bus-alert');card.append(el('small',(item.serviceAlert?'Avviso di servizio':'Notizia ATV')+' · Pubblicato '+formatDay(dayInRome(item.publishedAt),{day:'numeric',month:'short',year:'numeric'})));const button=el('button',item.title);button.onclick=()=>openBusAlert(item,line);card.append(button);return card;}
function busEmpty(list,title,note,label,action){const box=el('div','','bus-empty'),button=el('button',label);button.onclick=action;box.append(el('h3',title),el('p',note),button);list.append(box);}
function filteredBusAlerts(){const q=$('bus-search').value.trim().toLocaleLowerCase('it'),numbers=busFavoriteNumbers();return busData.alerts.filter(a=>(a.title+' '+a.lines.join(' ')).toLocaleLowerCase('it').includes(q)&&(busAlertScope==='all'||!a.lines.length||a.lines.some(n=>numbers.has(n))));}
function renderBus(){
  const alerts=busMode==='alerts',numbers=busFavoriteNumbers();if(!numbers.size)busAlertScope='all';
  for(const [id,mode]of [['bus-lines','lines'],['bus-favorites','favorites'],['bus-alerts','alerts']]){$(id).classList.toggle('active',busMode===mode);$(id).setAttribute('aria-pressed',String(busMode===mode));}
  $('bus-service-tools').hidden=alerts;$('bus-alert-tools').hidden=!alerts;$('bus-alert-mine').disabled=!numbers.size;
  for(const [id,scope]of [['bus-alert-mine','mine'],['bus-alert-all','all']])$(id).setAttribute('aria-pressed',String(busAlertScope===scope));
  $('bus-search').placeholder=alerts?'Cerca negli avvisi ATV…':'Numero linea o destinazione…';
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
    const actions=el('div','','bus-card-actions'),detail=el('button','Percorso e avvisi');detail.onclick=()=>openBusLine(line);detail.setAttribute('aria-label','Percorso e avvisi linea '+line.number+', '+line.serviceLabel);const timetable=officialBusLink(line.timetableUrl,'Orari PDF ↗','bus-timetable');timetable.setAttribute('aria-label','Orari PDF linea '+line.number+', '+line.serviceLabel+' · sito ATV');actions.append(timetable,detail);
    card.append(open,busStar(line),actions);list.append(card);
  }
}
function renderBusUpdates(){const q=$('bus-updates-search').value.trim().toLocaleLowerCase('it'),items=(busData.updates||[]).filter(a=>(a.title+' '+a.lines.join(' ')).toLocaleLowerCase('it').includes(q));$('bus-updates-count').textContent=items.length+' pubblicazioni ATV';const list=$('bus-updates-list');list.replaceChildren();for(const item of items)list.append(busPublicationCard(item));if(!items.length&&!q){const box=el('div','','bus-empty');box.append(el('h3','Pubblicazioni non disponibili.'),officialBusLink('https://www.atv.verona.it/','Consulta il sito ATV ↗'));list.append(box);return;}if(!items.length)busEmpty(list,'Nessuna pubblicazione trovata.','Prova una ricerca diversa.','Azzera ricerca',()=>{$('bus-updates-search').value='';renderBusUpdates()});}
function openBusMore(){const box=$('bus-source-status');box.replaceChildren();for(const source of busData.sources){const name={urban:'Feriale',evening:'Serale',holiday:'Festivo',rss:'Pubblicazioni ATV'}[source.key]||source.key,last=source.lastSuccessAt||busData.lines.filter(line=>line.service===source.key).map(line=>line.checkedAt).sort()[0]||(source.key==='rss'?(busData.updates||[])[0]?.checkedAt:null);box.append(el('p',name+' · Ultimo successo: '+(last?formatDay(dayInRome(last),{day:'numeric',month:'short',year:'numeric'}):'non disponibile')+(source.status==='error'?' · Ultimo tentativo fallito: dati precedenti conservati.':''),'bus-source-row'));}$('bus-more-dialog').showModal();}
function openBusLine(line){
  if(!$('bus-detail-dialog').open)busReturnFocus=document.activeElement;const content=$('bus-detail-content');content.replaceChildren();const title=el('h2','Linea '+line.number);title.id='bus-detail-title';
  content.append(title,el('span',line.serviceLabel,'source'),officialBusLink(line.timetableUrl,'Apri gli orari ufficiali PDF ↗'));
  for(const direction of line.directions||[{label:'Percorso indicato da ATV',path:line.route}]){const section=el('section','','bus-route-section');section.append(el('h3',direction.label),el('p',direction.path,'bus-route'));content.append(section);}
  content.append(el('p','Percorso sintetico dalla scheda ATV, non elenco completo delle fermate. Consulta il PDF per giorni di servizio, orari e note. Non sono arrivi in tempo reale.','detail-note'),officialBusLink(line.sourceUrl,'Scheda della linea sul sito ATV ↗','bus-secondary-link'));
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
  render();
}
function newsSaveButton(item){const button=el('button',newsBookmarks[item.id]?'✓ Salvata':'Salva','news-bookmark'+(newsBookmarks[item.id]?' chosen':''));button.type='button';button.setAttribute('aria-pressed',String(Boolean(newsBookmarks[item.id])));button.setAttribute('aria-label',`${newsBookmarks[item.id]?'Rimuovi':'Salva'}: ${item.title}`);button.onclick=()=>toggleNews(item.id);return button;}
function renderNews(){
  const items=filteredNews(),chosen=currentDistrict();
  for(const [id,mode] of [['news-all','all'],['news-zone-tab','zone'],['news-saved','saved']]){$(id).classList.toggle('active',newsMode===mode);$(id).setAttribute('aria-pressed',String(newsMode===mode));}
  $('news-zone').textContent=chosen?'⌖ '+(chosen.quarter||`Circoscrizione ${chosen.district.id}`):'⌖ Scegli zona';
  const filters=$('news-active-filters');filters.replaceChildren();
  for(const [key,label]of [['category',newsTopic(newsFilters.category)],['type',newsFilters.type==='avvisi'?'Avvisi':'Notizie']]){if(!newsFilters[key])continue;const b=el('button',label+' ×');b.setAttribute('aria-label','Rimuovi filtro: '+label);b.onclick=()=>{newsFilters[key]='';render()};filters.append(b);}
  filters.hidden=!filters.children.length;$('news-open-filters').textContent=filters.children.length?`Filtri (${filters.children.length})`:'Filtri';
  $('news-summary').textContent=`${items.length} pubblicazioni${newsMode==='zone'&&chosen?' · '+(chosen.quarter||chosen.district.name):newsMode==='saved'?' salvate':''} · Raccolta ${newsData.updatedAt?formatDay(dayInRome(newsData.updatedAt),{day:'numeric',month:'short'}):'non disponibile'}`;
  $('news-refresh-note').textContent=newsData.sources?.some(s=>s.status==='error')?'Una fonte non è stata aggiornata: sono mostrati anche dati precedenti.':'';
  const list=$('news-list');list.replaceChildren();
  if(!newsItems.length){$('news-summary').textContent='Raccolta non disponibile';const box=el('div','','news-empty'),link=el('a','Leggi sul sito del Comune ↗','detail-link');link.href='https://www.comune.verona.it/Novita/Notizie';link.target='_blank';link.rel='noopener noreferrer';box.append(el('h3','Nessuna comunicazione disponibile.'),el('p','Puoi consultare le pubblicazioni direttamente sulla fonte ufficiale.'),link);list.append(box);return;}
  if(newsMode==='zone'&&!chosen){$('news-summary').textContent='Notizie e avvisi che citano il quartiere o la sua circoscrizione.';const box=el('div','','news-empty'),b=el('button','Scegli il mio quartiere');b.onclick=openDistrictChoice;box.append(el('h3','Qual è la tua zona?'),el('p','Usiamo la stessa scelta del Mio quartiere. Le comunicazioni senza zona restano nella vista Tutte.'),b);list.append(box);return;}
  if(!items.length){const filtered=Boolean($('news-search').value.trim()||newsFilters.category||newsFilters.type),box=el('div','','news-empty');
    box.append(el('h3',newsMode==='saved'?'Nessuna notizia salvata con questi filtri.':'Nessun risultato per ora.'),el('p',filtered?'Prova a rimuovere i filtri o cambiare ricerca.':newsMode==='zone'?'La raccolta può non includere tutte le comunicazioni della zona. In Tutte trovi anche quelle senza zona indicata.':'Apri Tutte per consultare le comunicazioni e salvarle.'));
    const b=el('button',filtered?'Azzera ricerca e filtri':'Mostra tutte le comunicazioni');b.onclick=()=>{if(filtered){$('news-search').value='';newsFilters={category:'',type:''};}else newsMode='all';render()};box.append(b);list.append(box);return;
  }
  for(const item of items){
    const card=el('article','','news-card'),meta=el('div','','news-card-meta');
    meta.append(el('span',item.kind,'news-kind'+(item.kind==='Avviso'?' notice':'')),el('span','Pubblicata '+formatDay(item.publishedOn,{day:'numeric',month:'short',year:'numeric'})));
    const title=el('button',item.title,'news-title');title.type='button';title.setAttribute('aria-label','Leggi: '+item.title);title.onclick=()=>openNews(item);
    const tags=el('div','','news-tags');tags.append(el('span',newsTopic(item.category),'news-topic'),el('span',newsZoneLabel(item)));
    const bottom=el('div','','news-card-actions'),read=el('button','Dettagli →','news-read');read.setAttribute('aria-label','Dettagli: '+item.title);read.onclick=()=>openNews(item);bottom.append(read,newsSaveButton(item));
    card.append(meta,title,el('p',item.summary||'Leggi la comunicazione sulla fonte ufficiale.'),tags,bottom);list.append(card);
  }
}
function openNews(item){
  newsReturnFocus=document.activeElement;
  const content=$('news-detail-content');content.replaceChildren();
  const title=el('h2',item.title);title.id='news-detail-title';
  content.append(el('span',`Comune di Verona · ${item.kind} · Pubblicata il ${formatDay(item.publishedOn,{day:'numeric',month:'long',year:'numeric'})}`,'news-source-label'),title);
  const tags=el('div','','news-tags');tags.append(el('span',newsTopic(item.category),'news-topic'),el('span',newsZoneLabel(item)));content.append(tags,el('p',item.summary||'Leggi la pubblicazione completa sulla fonte ufficiale.'),el('p','La data indicata è quella di pubblicazione. Consulta la fonte per periodi di validità, scadenze e aggiornamenti.','detail-note'));
  try{const url=new URL(item.sourceUrl);if(url.origin==='https://www.comune.verona.it'){const link=el('a','Leggi sul sito del Comune ↗','detail-link');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';content.append(link)}}catch{}
  const saveButton=newsSaveButton(item);saveButton.onclick=()=>{toggleNews(item.id);saveButton.textContent=newsBookmarks[item.id]?'✓ Salvata':'Salva';saveButton.setAttribute('aria-pressed',String(Boolean(newsBookmarks[item.id])));saveButton.setAttribute('aria-label',`${newsBookmarks[item.id]?'Rimuovi':'Salva'}: ${item.title}`);saveButton.classList.toggle('chosen',Boolean(newsBookmarks[item.id]));};content.append(saveButton);
  const provenance=el('details','','news-provenance');provenance.append(el('summary','Fonte e aggiornamento'),el('p',`Sintesi dalla pagina comunale, raccolta il ${formatDay(dayInRome(item.checkedAt),{day:'numeric',month:'long',year:'numeric'})}. Argomento assegnato automaticamente dall’app. Le zone sono riconosciute dai riferimenti nei testi e possono essere incomplete.`));
  const license=el('a','Comune di Verona · CC BY 4.0 salvo eccezioni','news-source-label');license.href=item.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';provenance.append(license);content.append(provenance);
  $('news-detail-dialog').showModal();
}
function setView(next) {
  if(next==='bus'&&!busVisited){busVisited=true;busMode=busData.lines.some(line=>busFavorites[line.id])?'favorites':'lines';}
  view=next;onlySaved=next==='saved';
  // Aprendo i salvati, mostra il prossimo appuntamento anziché un giorno vuoto.
  if(onlySaved&&!savedVisited){savedVisited=true;const future=events.filter(e=>['interested','going'].includes(preferences[e.id])&&(e.endsAt.length===10?eventDay(e.endsAt)>=today:Date.parse(e.endsAt)>=Date.now())).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));if(future.length){selected=eventDay(future[0].startsAt)<today?today:eventDay(future[0].startsAt);month=selected.slice(0,7);}}
  render();
}
function discoveryEvents() {
  const now=Date.now();const period=$('period').value||'30';
  const until=period==='all'?'9999-12-31':new Date(Date.parse(today+'T12:00:00Z')+(Number(period)-1)*86400000).toISOString().slice(0,10);
  const savedUrls=new Set(events.filter(e=>['interested','going'].includes(preferences[e.id])&&eventDay(e.endsAt)>=today).map(e=>e.sourceUrl));
  const unique=new Map();
  for(const e of visibleEvents()) {
    if(eventDay(e.endsAt)<today||(e.endsAt.length>10&&Date.parse(e.endsAt)<now)||eventDay(e.startsAt)>until)continue;
    if(($('collection').value||'local')==='local'&&!e.localVerified)continue;
    if(dismissed[e.sourceUrl]||savedUrls.has(e.sourceUrl)||unique.has(e.sourceUrl))continue;
    unique.set(e.sourceUrl,e);
  }
  return [...unique.values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
function persistChoices() {
  try {localStorage.setItem('verona-events-v1',JSON.stringify(preferences));localStorage.setItem('verona-dismissed-v1',JSON.stringify(dismissed));return true;}
  catch {return false;}
}
function chooseDiscovery(action) {
  const e=currentDiscovery;if(!e)return;
  lastChoice={id:e.id,url:e.sourceUrl,previous:preferences[e.id],dismissed:dismissed[e.sourceUrl]};
  if(action==='interested')preferences[e.id]='interested';else dismissed[e.sourceUrl]=true;
  const stored=persistChoices();
  $('discovery-feedback').textContent=(action==='interested'?'Evento aggiunto al tuo calendario.':'Evento passato. Puoi annullare la scelta.')+(stored?'':' Salvataggio disponibile solo per questa visita.');
  render();
}
function undoDiscovery() {
  if(!lastChoice)return;
  if(lastChoice.previous)preferences[lastChoice.id]=lastChoice.previous;else delete preferences[lastChoice.id];
  if(lastChoice.dismissed)dismissed[lastChoice.url]=lastChoice.dismissed;else delete dismissed[lastChoice.url];
  lastChoice=null;const stored=persistChoices();$('discovery-feedback').textContent='Ultima scelta annullata.'+(stored?'':' Salvataggio disponibile solo per questa visita.');render();
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
  if(e.startsAt.length>10)label+=' · '+new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(e.startsAt));
  if(eventDay(e.startsAt)!==eventDay(e.endsAt))label+=' → '+formatDay(eventDay(e.endsAt),{day:'numeric',month:'short'});
  return label;
}
function openDetails(e) {
  detailReturnFocus=document.activeElement;
  const content=$('detail-content');content.replaceChildren();
  const title=el('h2',e.title);title.id='detail-title';
  content.append(el('span',e.source,'source'),title,el('p',eventWhen(e)),el('p',e.location||'Sede da verificare sulla fonte ufficiale.'),el('p',e.summary||'I dettagli e il programma completo sono disponibili sulla pagina ufficiale dell’evento.'),el('p',e.priceLabel||'Prezzo e condizioni di accesso da verificare.'));
  if(e.localVerified)content.append(el('p',`Luogo controllato sulla fonte il ${formatDay(e.reviewedOn,{day:'numeric',month:'long',year:'numeric'})}.`,'detail-note'));
  const point=eventPosition(e);
  if(point){const mapButton=el('button','⌖ Vedi sulla mappa','dialog-save event-map-detail-button');mapButton.onclick=()=>{closeDetails();openEventMap(e)};const directions=el('a','Indicazioni per arrivare ↗','bus-secondary-link');directions.href=`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`;directions.target='_blank';directions.rel='noopener noreferrer';content.append(mapButton,directions,el('p','Punto indicato dalla fonte. Per manifestazioni diffuse e percorsi, verifica il luogo esatto nel programma.','detail-note'));}
  content.append(el('p','Eventuali altre date sono nel calendario. Verifica aggiornamenti e disponibilità prima di partire.','detail-note'));
  try{const url=new URL(e.sourceUrl);if(url.protocol==='https:'){const link=el('a','Apri il programma ufficiale ↗','detail-link');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';content.append(link)}}catch{}
  const button=el('button',['interested','going'].includes(preferences[e.id])?'Già nel tuo calendario':'♡ Aggiungi al mio calendario','dialog-save');
  button.disabled=['interested','going'].includes(preferences[e.id]);
  button.onclick=()=>{closeDetails();if(currentDiscovery?.id===e.id)chooseDiscovery('interested');else save(e.id,'interested');};content.append(button);
  const state=preferences[e.id];if(state){const presence=el('button',state==='going'?'✓ Partecipi · annulla conferma':'Conferma: partecipo','dialog-save event-presence');presence.onclick=()=>{closeDetails();save(e.id,state==='going'?'interested':'going')};const remove=el('button','Rimuovi dai salvati','dialog-save event-remove');remove.onclick=()=>{closeDetails();save(e.id,null)};content.append(presence,remove);}
  content.append(el('p','Salvare l’evento o confermare la presenza non acquista biglietti e non effettua prenotazioni.','detail-note'));
  $('detail-dialog').showModal();
}
function closeDetails() {$('detail-dialog').close();}
function renderDiscovery() {
  const queue=discoveryEvents();currentDiscovery=queue[0]||null;
  $('discovery-count').textContent=`${queue.length} ${queue.length===1?'evento da scoprire':'eventi da scoprire'}`;
  $('undo').disabled=!lastChoice;$('like').disabled=!currentDiscovery;$('skip').disabled=!currentDiscovery;
  const deck=$('deck');deck.replaceChildren();
  if(!currentDiscovery){
    const empty=el('div','','deck-empty');empty.append(el('h3','Per ora è tutto.'),el('p','Hai visto gli eventi disponibili con questi filtri. Puoi cambiare periodo o esplorare il catalogo completo.'));
    const button=el('button','Esplora il catalogo completo');button.onclick=()=>{$('collection').value='all';$('period').value='all';$('source').value='';$('search').value='';render()};empty.append(button);deck.append(empty);return;
  }
  const e=currentDiscovery,p= presentation(e),card=el('article','','discover-card');
  const cover=el('div','',`card-cover theme-${p.theme}`);cover.setAttribute('aria-hidden','true');cover.append(el('span','Verona · da vivere','cover-label'),el('div','','cover-art'),el('span',p.label,'cover-type'));
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
$('home').onclick=()=>setView('home');$('discover').onclick=()=>setView('discover');$('all').onclick=()=>setView('calendar');$('saved').onclick=()=>setView('saved');$('search').oninput=()=>{if(!filterSnapshot)render()};$('source').onchange=()=>{if(!filterSnapshot)render()};
$('period').onchange=()=>{if(!filterSnapshot)render()};$('collection').onchange=()=>{if(!filterSnapshot)render()};$('like').onclick=()=>chooseDiscovery('interested');$('skip').onclick=()=>chooseDiscovery('skip');$('undo').onclick=undoDiscovery;
$('close-detail').onclick=closeDetails;
$('detail-dialog').addEventListener('close',()=>{if(detailReturnFocus?.isConnected)detailReturnFocus.focus();else $(view==='home'?'home':view==='district'?'district-zone':view==='eventmap'?'event-map-back':view==='discover'?'like':['calendar','saved'].includes(view)?'events':'all').focus()});
$('home-today').onclick=()=>{$('search').value='';$('source').value='';selected=today;month=today.slice(0,7);setView('calendar')};
$('home-programs').onclick=()=>setView('saved');
$('close-ztl').onclick=()=>$('ztl-dialog').close();
$('ztl-dialog').addEventListener('close',()=>$('home').focus());
$('open-filters').onclick=()=>{if(view==='news')openNewsFilters();else if(view==='bus')openBusMore();else{filterSnapshot=Object.fromEntries(['search','source','period','collection'].map(id=>[id,$(id).value]));$('event-period-field').hidden=$('event-collection-field').hidden=view!=='discover';$('filters-dialog').showModal()}};
$('close-filters').onclick=()=>$('filters-dialog').close();
$('apply-filters').onclick=()=>{filterSnapshot=null;render();$('filters-dialog').close()};
$('reset-filters').onclick=()=>{$('search').value='';$('source').value='';$('period').value='30';$('collection').value='local'};
$('filters-dialog').addEventListener('close',()=>{if(filterSnapshot){for(const [id,value]of Object.entries(filterSnapshot))$(id).value=value;filterSnapshot=null;render()}$('open-filters').focus()});
$('open-info').onclick=()=>$('info-dialog').showModal();$('close-info').onclick=()=>$('info-dialog').close();
$('home-news').onclick=()=>setView('news');
$('news').onclick=()=>setView('news');
for(const [id,mode] of [['news-all','all'],['news-zone-tab','zone'],['news-saved','saved']])$(id).onclick=()=>{newsMode=mode;$('news-feedback').textContent='';render()};
$('close-news-detail').onclick=()=>$('news-detail-dialog').close();
$('news-detail-dialog').addEventListener('close',()=>{if(newsReturnFocus?.isConnected)newsReturnFocus.focus();else $(view==='district'?'district-zone':'news').focus()});
$('news-search').oninput=render;$('news-open-filters').onclick=openNewsFilters;$('news-zone').onclick=openDistrictChoice;
$('close-news-filters').onclick=()=>$('news-filters-dialog').close();
$('apply-news-filters').onclick=()=>{newsFilters={category:$('news-category').value,type:$('news-type').value};render();$('news-filters-dialog').close()};
$('reset-news-filters').onclick=()=>{$('news-category').value='';$('news-type').value=''};
$('bus-back').onclick=()=>setView('home');$('bus-search').oninput=render;$('bus-service').onchange=render;
for(const [id,mode]of [['bus-lines','lines'],['bus-favorites','favorites'],['bus-alerts','alerts']])$(id).onclick=()=>setBusMode(mode);
$('bus-more').onclick=$('bus-alert-more').onclick=openBusMore;$('close-bus-more').onclick=()=>$('bus-more-dialog').close();$('bus-more-dialog').addEventListener('close',()=>$(busMode==='alerts'?'bus-alert-more':'bus-more').focus());
$('bus-alert-mine').onclick=()=>{busAlertScope='mine';render()};$('bus-alert-all').onclick=()=>{busAlertScope='all';render()};
$('bus-updates').onclick=()=>{$('bus-more-dialog').close();renderBusUpdates();$('bus-updates-dialog').showModal()};$('close-bus-updates').onclick=()=>$('bus-updates-dialog').close();$('bus-updates-search').oninput=renderBusUpdates;$('bus-updates-dialog').addEventListener('close',()=>$(busMode==='alerts'?'bus-alert-more':'bus-more').focus());
$('close-bus-detail').onclick=()=>$('bus-detail-dialog').close();$('bus-detail-dialog').addEventListener('close',()=>{if(busReturnFocus?.isConnected)busReturnFocus.focus();else $('bus-list').focus()});
$('discover-event-map').onclick=()=>{eventMapSaved=false;openEventMap()};
$('calendar-event-map').onclick=()=>{eventMapSaved=onlySaved;openEventMap()};
$('event-map-back').onclick=()=>{if(eventMapReturn){selected=eventMapReturn.selected;month=selected.slice(0,7);$('search').value=eventMapReturn.search;$('source').value=eventMapReturn.source;}setView(eventMapReturn?.view||'calendar');$('events').scrollTop=eventMapReturn?.scroll||0;$('calendar-event-map').focus()};
$('event-map-unlocated').onclick=()=>{const day=selected;setView(eventMapReturn?.view||'calendar');selectAgendaDay(day)};
$('event-map-date').onchange=()=>{const value=$('event-map-date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value){$('event-map-date').value=selected;return;}selected=value;month=value.slice(0,7);eventMapFocus=null;render()};
$('event-map-period').onchange=()=>{eventMapFocus=null;render()};
$('event-map-saved').onclick=()=>{eventMapSaved=!eventMapSaved;eventMapFocus=null;render()};
$('explore-back').onclick=()=>setView('home');$('explore-map-tab').onclick=()=>{exploreMode='map';render()};$('explore-list-tab').onclick=()=>{exploreMode='list';render()};
$('explore-search').oninput=()=>{placesShown=60;render()};$('explore-category').onchange=()=>{placesShown=60;render()};$('explore-saved').onclick=()=>{exploreSaved=!exploreSaved;placesShown=60;render()};
$('close-place-detail').onclick=()=>$('place-detail-dialog').close();$('place-detail-dialog').addEventListener('close',()=>{if(placeReturnFocus?.isConnected)placeReturnFocus.focus();else $('explore-list-tab').focus()});
$('district-back').onclick=()=>setView('home');$('district-zone').onclick=openDistrictChoice;
$('close-district').onclick=()=>$('district-dialog').close();
$('district-dialog').addEventListener('close',()=>$(view==='news'?'news-zone':'district-zone').focus());
$('apply-district').onclick=()=>{if($('district-choice').value)applyDistrict($('district-choice').value)};
$('district-choice').onchange=()=>{$('apply-district').disabled=!districtChoices.some(c=>c.value===$('district-choice').value)};
$('clear-district').onclick=()=>applyDistrict('');
$('district-search').oninput=render;
$('district-saved').onclick=()=>{districtSaved=!districtSaved;$('district-feedback').textContent='';render()};
for(const [id,mode]of [['district-news','news'],['district-notices','notices'],['district-events','events'],['district-city','city']])$(id).onclick=()=>{districtMode=mode;$('district-feedback').textContent='';render()};
render();
