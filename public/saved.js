// One collection, backed by the existing stores. Calendar filters never hide saves.
var savedHubReady=true;
function savedHubCollections(){
  const programs=[...savedEvents().map(item=>({kind:'event',item,past:isPastSavedEvent(item),day:eventDay(item.startsAt)<today&&!isPastSavedEvent(item)?today:eventDay(item.startsAt)})),
    ...savedNewsDeadlines().map(item=>({kind:'deadline',item,past:['expired','withdrawn'].includes(newsValidity(item).state),day:item.timing.deadline.day}))];
  const time=row=>row.kind==='deadline'?row.item.timing.deadline.time||'00:00':row.item.startsAt.length>10?new Intl.DateTimeFormat('it',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(row.item.startsAt)):'00:00';
  programs.sort((a,b)=>a.day.localeCompare(b.day)||time(a).localeCompare(time(b))||a.item.title.localeCompare(b.item.title,'it'));
  return {programs,news:newsItems.filter(item=>newsBookmarks[item.id]).sort((a,b)=>b.publishedOn.localeCompare(a.publishedOn)),
    places:places.filter(item=>placeFavorites[item.id]).sort((a,b)=>a.name.localeCompare(b.name,'it')),
    bus:busCatalogLines().filter(busCatalogFavorite)};
}
function savedHubOpen(label,key,callback){const button=el('button',label,'saved-hub-open');button.setAttribute('data-focus-key','saved-open-'+key);button.onclick=callback;return button;}
function renderSavedHub(){
  const collections=savedHubCollections(),category=$('saved-category').value||'programs',query=$('saved-search').value.trim().toLocaleLowerCase('it'),past=savedMode==='past';
  const counts={programs:collections.programs.length,news:collections.news.length,places:collections.places.length,bus:collections.bus.length};
  for(const [key,label]of [['programs','Eventi e scadenze'],['news','Notizie'],['places','Luoghi'],['bus','Autobus']])$('saved-option-'+key).textContent=label+' ('+counts[key]+')';
  $('saved-program-tabs').hidden=category!=='programs';
  for(const [id,value]of [['saved-hub-upcoming','upcoming'],['saved-hub-past','past']]){$(id).setAttribute('aria-pressed',String(savedMode===value));$(id).textContent=(value==='past'?'Conclusi':'Prossimi')+' ('+collections.programs.filter(row=>row.past===(value==='past')).length+')';}
  const list=$('saved-list');list.replaceChildren();let rows=collections[category]||[];
  if(category==='programs')rows=rows.filter(row=>row.past===past);if(category==='programs'&&past)rows=[...rows].reverse();
  rows=rows.filter(row=>{const item=row.item||row;return ((item.title||item.name||'')+' '+(item.location||item.address||'')+' '+(item.number||'')).toLocaleLowerCase('it').includes(query);});
  $('saved-count').textContent=rows.length+(rows.length===1?' elemento':' elementi')+(category==='programs'?(past?(rows.length===1?' concluso':' conclusi'):' in programma'):(rows.length===1?' salvato':' salvati'));
  let lastDay='';
  for(const row of rows){
    const item=row.item||row,card=el('article','','saved-hub-card');
    if(category==='programs'){
      if(row.day!==lastDay){list.append(el('h2',formatDay(row.day,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),'saved-hub-day'));lastDay=row.day;}
      const deadline=row.kind==='deadline',status=deadline?newsValidity(item).label:preferences[item.id]==='going'?'Partecipi':'Ti interessa';
      const when=deadline?'Scadenza · '+(item.timing.deadline.time||'orario non indicato'):!past&&eventDay(item.startsAt)<today?'In corso · dal '+formatDay(eventDay(item.startsAt),{day:'numeric',month:'long'}):'Evento · '+(item.startsAt.length>10?new Intl.DateTimeFormat('it',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(item.startsAt)):'orario da verificare');
      card.append(el('p',when,'saved-hub-meta'),
        savedHubOpen(item.title,row.kind+'-'+item.id,()=>deadline?openNews(item):openDetails(item)),el('p',status,'saved-hub-status'));
      if(deadline&&item.needsReview)card.append(el('p','Data salvata da ricontrollare sulla fonte ufficiale.','saved-hub-meta'));
      if(!deadline){if(item.location)card.append(el('p',item.location,'saved-hub-meta'));if(eventDay(item.startsAt)!==eventDay(item.endsAt))card.append(el('p','Fino al '+formatDay(eventDay(item.endsAt),{day:'numeric',month:'long'}),'saved-hub-meta'));}
      if(deadline){const remove=el('button','Rimuovi scadenza','saved-hub-remove');remove.setAttribute('data-focus-key','saved-remove-deadline-'+item.id);remove.setAttribute('aria-label','Rimuovi scadenza: '+item.title);remove.onclick=()=>{toggleNewsDeadline(item);$('saved-feedback').textContent=$('news-feedback').textContent;};card.append(remove);}
    }else if(category==='news'){
      card.append(el('p',item.source+' · '+formatDay(item.publishedOn,{day:'numeric',month:'long'}),'saved-hub-meta'),savedHubOpen(item.title,'news-'+item.id,()=>openNews(item)),newsSaveButton(item));
    }else if(category==='places'){
      card.append(savedHubOpen(item.name,'place-'+item.id,()=>openPlace(item)),el('p',item.address||item.category||'Luogo a Verona','saved-hub-meta'),placeStar(item));
    }else{
      card.append(el('p','Linea '+item.number,'saved-hub-status'),savedHubOpen(busDisplayName(item.name),'bus-'+item.number,()=>officialBus.lines.some(line=>line.number===item.number)?openOfficialBus(item.number):openTimetable(item.sheets[0])),busCatalogStar(item));
    }
    list.append(card);
  }
  const unavailable=category==='news'?Object.keys(newsBookmarks).filter(id=>newsBookmarks[id]&&!newsItems.some(item=>item.id===id)).length:category==='places'?Object.keys(placeFavorites).filter(id=>placeFavorites[id]&&!places.some(item=>item.id===id)).length:0;
  if(unavailable)list.append(el('p',unavailable+(unavailable===1?' salvataggio non è presente nel catalogo attuale. Lo conserviamo su questo dispositivo.':' salvataggi non sono presenti nel catalogo attuale. Li conserviamo su questo dispositivo.'),'saved-hub-note'));
  if(!rows.length){const empty=el('div','','saved-hub-empty');empty.append(el('h2',query?'Nessun risultato':category==='programs'?(past?'Nessun programma concluso':'I tuoi prossimi programmi, qui'):'Ancora nessun salvataggio'),el('p',query?'Prova un altro nome o cancella la ricerca.':category==='programs'?'Salva gli eventi che ti interessano e le scadenze utili. Al termine passeranno tra i conclusi.':'Usa il pulsante Salva o la stella nelle altre sezioni.'));const action=el('button',query?'Cancella ricerca':category==='programs'?'Apri calendario':category==='news'?'Leggi le notizie':category==='places'?'Esplora i luoghi':'Cerca una linea');action.onclick=()=>{if(query){$('saved-search').value='';render();$('saved-search').focus();}else setView({programs:'calendar',news:'news',places:'explore',bus:'bus'}[category]);};empty.append(action);list.append(empty);}
}
$('saved-category').onchange=()=>{$('saved-search').value='';$('saved-feedback').textContent='';render();$('saved-list').scrollTop=0;};
$('saved-search').oninput=()=>{render();$('saved-list').scrollTop=0;};
for(const [id,mode]of [['saved-hub-upcoming','upcoming'],['saved-hub-past','past']])$(id).onclick=()=>{savedMode=mode;render();$('saved-list').scrollTop=0;};
if(view==='home')renderHome();
