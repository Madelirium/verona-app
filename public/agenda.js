// Civil dates and source metadata drive the agenda; no inferred opening hours.
let agendaRange='day',agendaShowAll=false;
const agendaFilterIds=['agenda-category','agenda-time','agenda-price','agenda-zone'];
function agendaBand(e){if(e.startsAt.length===10||eventDay(e.startsAt)!==eventDay(e.endsAt))return 'period';const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',hourCycle:'h23'}).format(new Date(e.startsAt)));return hour<12?'morning':hour<18?'afternoon':'evening';}
function agendaFree(e){return e.price===0||/^(?:gratuito|gratuita|ingresso gratuito|ingresso libero|accesso libero)\s*[.!]?$/i.test((e.priceLabel||'').trim());}
function agendaMatches(e){return (!$('agenda-category').value||(e.category||[]).includes($('agenda-category').value))&&(!$('agenda-time').value||agendaBand(e)===$('agenda-time').value)&&(!$('agenda-price').value||agendaFree(e))&&(!$('agenda-zone').value||($('agenda-zone').value==='my-zone'?Boolean(districtMatch(e)):(e.districtMatches||[]).some(match=>String(match.id)===$('agenda-zone').value)));}
function agendaWeekend(day=today){const weekday=new Date(day+'T12:00:00Z').getUTCDay(),saturday=shiftDay(day,weekday===0?-1:6-weekday);return [saturday,shiftDay(saturday,1)];}
function agendaDaysSelected(){return agendaRange==='weekend'?[selected,shiftDay(selected,1)]:[selected];}
function agendaCompare(a,b){return Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.title.localeCompare(b.title,'it');}
function agendaAlreadyStarted(e,day=selected,now=Date.now()){return day===today&&agendaBand(e)!=='period'&&Date.parse(e.startsAt)<=now;}
function agendaStillUseful(e,day=selected,now=Date.now()){const knownEnd=e.endsAt.length>10&&Date.parse(e.endsAt)>Date.parse(e.startsAt);return !agendaAlreadyStarted(e,day,now)||!knownEnd||Date.parse(e.endsAt)>now;}
function captureAgendaState(){return {range:agendaRange,showAll:agendaShowAll,filters:Object.fromEntries(agendaFilterIds.map(id=>[id,$(id).value]))};}
function restoreAgendaState(state){if(!state)return;agendaRange=state.range;agendaShowAll=state.showAll;for(const [id,value]of Object.entries(state.filters))$(id).value=value;}
function agendaConflicts(e){if(agendaBand(e)==='period'||Date.parse(e.endsAt)<=Date.parse(e.startsAt))return [];return savedEvents().filter(other=>other.id!==e.id&&agendaBand(other)!=='period'&&Date.parse(other.endsAt)>Date.parse(other.startsAt)&&Date.parse(e.startsAt)<Date.parse(other.endsAt)&&Date.parse(other.startsAt)<Date.parse(e.endsAt));}
function agendaSelection(kind){agendaRange=kind==='weekend'?'weekend':'day';selected=kind==='weekend'?agendaWeekend()[0]:kind==='tomorrow'?shiftDay(today,1):today;month=selected.slice(0,7);agendaShowAll=false;render();$('events').scrollTop=0;}
function agendaFilterChips(){
  const chips=$('agenda-filters');for(const id of agendaFilterIds)if($(id).value){const selectedOption=Array.from($(id).children).find(option=>option.value===$(id).value),button=el('button',(selectedOption?.textContent||$(id).value)+' ×');button.setAttribute('aria-label','Rimuovi filtro: '+(selectedOption?.textContent||$(id).value));button.onclick=()=>{$(id).value='';render();};chips.append(button);}chips.hidden=!chips.children.length;
  if(['calendar','saved','eventmap'].includes(view))$('filter-dot').hidden=!($('search').value||$('source').value||agendaFilterIds.some(id=>$(id).value));
}
function agendaCard(e,day,past=false){
  const card=el('article','','event-card agenda-rich-card'),state=preferences[e.id],meta=el('div','','agenda-meta'),timed=agendaBand(e)!=='period';
  const clock=timed?new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(e.startsAt)):e.startsAt.length===10&&eventDay(e.startsAt)===eventDay(e.endsAt)?'Orario da verificare':'Nel periodo';
  meta.append(el('span',past?eventWhen(e):clock,'agenda-time'));if(state)meta.append(el('span',state==='going'?(past?'✓ Confermato':'✓ Partecipi'):(past?'♡ Ti interessava':'♡ Salvato'),'agenda-state'+(state==='going'?' going':'')));card.append(meta);
  const body=el('div','','agenda-card-body'),text=el('div','','agenda-card-copy'),title=el('h3'),open=el('button',e.title,'agenda-title-button');open.onclick=()=>openDetails(e);open.setAttribute('data-focus-key','event-open-'+e.id+'-'+day);open.setAttribute('aria-label','Dettagli: '+e.title);title.append(open);text.append(title,el('p',e.location||'Luogo da verificare','agenda-place'));
  if(!timed&&eventDay(e.startsAt)!==eventDay(e.endsAt))text.append(el('small','Fino al '+formatDay(eventDay(e.endsAt),{day:'numeric',month:'short'})+' · verifica i giorni nel programma','agenda-period-note'));
  const tags=el('div','','agenda-tags');if(e.category?.length)tags.append(el('span',e.category[0]));if(agendaFree(e))tags.append(el('span','Gratuito','agenda-free'));else if(e.priceLabel&&!/verificare|non indicat|consult/i.test(e.priceLabel))tags.append(el('span',e.priceLabel));if(agendaAlreadyStarted(e,day)&&Date.parse(e.endsAt)>Date.now())tags.append(el('span','Già iniziato'));else if(agendaAlreadyStarted(e,day)&&Date.parse(e.endsAt)<=Date.parse(e.startsAt))tags.append(el('span','Fine non indicata'));
  text.append(tags);body.append(text);const image=eventImage(e);if(image){const thumb=makeEventImage(e,'event-thumbnail');thumb.loading='lazy';body.append(thumb);}card.append(body);
  const savedReview=savedEventReviewFor(e);if(savedReview?.message)card.append(el('p',savedReview.message,'detail-note'));
  const footer=el('div','','agenda-card-footer'),saveButton=el('button',state?'✓ Salvato':'♡ Salva',state?'chosen':'');saveButton.setAttribute('data-focus-key','event-save-'+e.id+'-'+day);saveButton.setAttribute('aria-label',(state?'Gestisci evento salvato: ':'Salva: ')+e.title);saveButton.onclick=()=>{const scroll=$('events').scrollTop||0;if(state)openDetails(e);else{save(e.id,'interested');$('events').scrollTop=scroll;}};
  const detail=el('button','Apri →');detail.setAttribute('data-focus-key','event-read-'+e.id+'-'+day);detail.setAttribute('aria-label','Apri evento: '+e.title);detail.onclick=open.onclick;footer.append(saveButton,detail);card.append(footer);
  const credit=el('small',image?eventImageCredit(image)+' · Crediti nei dettagli':e.source,'agenda-credit');card.append(credit);
  if(onlySaved&&!past){const conflicts=agendaConflicts(e);if(conflicts.length)card.append(el('p','Orario sovrapposto a '+conflicts.map(item=>item.title).join(', ')+'. Verifica il tuo programma.','agenda-conflict'));}
  return card;
}
function renderEnhancedAgenda(filtered,past){
  agendaFilterChips();$('agenda-shortcuts').hidden=past;
  for(const [id,active]of [['today',agendaRange==='day'&&selected===today],['agenda-tomorrow',agendaRange==='day'&&selected===shiftDay(today,1)],['agenda-weekend',agendaRange==='weekend']])$(id).setAttribute('aria-pressed',String(active));
  $('agenda-day-mode').hidden=past||agendaRange!=='day'||selected!==today;$('agenda-day-mode').textContent=agendaShowAll?'Tutta la giornata':'Da adesso';$('agenda-day-mode').setAttribute('aria-pressed',String(!agendaShowAll));
  const days=agendaDaysSelected(),list=$('events');list.replaceChildren();let total=0,saved=0;
  const deadlineCount=appendPersonalDeadlines(list,days,past);
  if(past){$('selected').textContent='Eventi passati';const rows=[...filtered].sort((a,b)=>Date.parse(b.endsAt)-Date.parse(a.endsAt));for(const e of rows)list.append(agendaCard(e,eventDay(e.startsAt),true));total=rows.length;}
  else{
    $('selected').textContent=agendaRange==='weekend'?'Weekend · '+formatDay(selected,{day:'numeric',month:'short'})+'–'+formatDay(shiftDay(selected,1),{day:'numeric',month:'short'}):selected===today?'Oggi · '+formatDay(selected,{day:'numeric',month:'long'}):formatDay(selected,{weekday:'long',day:'numeric',month:'long'});
    const seen=new Set(),rowsByDay=days.map(day=>({day,rows:filtered.filter(e=>occursOn(e,day)).sort(agendaCompare)}));
    for(const {rows}of rowsByDay)for(const e of rows)if(!seen.has(e.id)){seen.add(e.id);total++;if(isSavedEvent(e))saved++;}
    const suggestion=!onlySaved?rowsByDay.flatMap(({day,rows})=>rows.filter(e=>day>=today&&(day!==today||Date.parse(e.startsAt)>Date.now())&&eventPosition(e)&&agendaBand(e)!=='period').map(e=>({e,day}))).sort((a,b)=>agendaCompare(a.e,b.e))[0]:null;
    if(suggestion){const box=el('button','','agenda-suggestion');box.append(el('small',agendaRange==='weekend'?'Un’idea per il weekend':'Un’idea per questa giornata'),el('strong',suggestion.e.title),el('span',eventWhen(suggestion.e)+' →'));box.setAttribute('aria-label','Un’idea: '+suggestion.e.title+', '+eventWhen(suggestion.e)+'. Prossimo evento con posizione disponibile');box.onclick=()=>openDetails(suggestion.e);list.append(box);}
    for(const {day,rows}of rowsByDay){
      if(agendaRange==='weekend')list.append(el('h3',formatDay(day,{weekday:'long',day:'numeric',month:'long'}),'agenda-date-heading'));
      const upcoming=rows.filter(e=>agendaShowAll||agendaStillUseful(e,day)),hidden=rows.length-upcoming.length;
      const groups=[['morning','Mattina'],['afternoon','Pomeriggio'],['evening','Sera'],['period','Mostre, rassegne e orari da verificare']];
      for(const [key,label]of groups){const items=upcoming.filter(e=>agendaBand(e)===key);if(!items.length)continue;list.append(el('h3',label,'agenda-group-heading'));for(const e of items)list.append(agendaCard(e,day));}
      if(!rows.length&&agendaRange==='weekend')list.append(el('p','Nessun evento raccolto con questi filtri per questa data.','agenda-day-empty'));
      if(hidden){const show=el('button',hidden+' eventi già terminati · mostra tutta la giornata','agenda-show-past');show.onclick=()=>{agendaShowAll=true;render();};list.append(show);}
    }
  }
  $('count').textContent=total+' '+(total===1?'appuntamento':'appuntamenti')+(saved?' · '+saved+' salvati':'')+(agendaRange==='weekend'&&!past?' distinti':'')+(deadlineCount?' · '+deadlineCount+(deadlineCount===1?' scadenza':' scadenze'):'');
  if(!total&&!deadlineCount){const box=el('div','','agenda-empty');box.append(el('h3',past?'Non hai ancora eventi o scadenze passati.':onlySaved?'Nessun programma salvato per queste date.':'Nessun evento raccolto con questi filtri.'),el('p','Puoi cambiare giorno, rimuovere i filtri o esplorare altre proposte.'));
    const reset=el('button','Rimuovi filtri');reset.onclick=()=>{for(const id of ['search','source',...agendaFilterIds])$(id).value='';render();};box.append(reset);
    const next=filtered.filter(e=>eventDay(e.endsAt)>selected).map(e=>eventDay(e.startsAt)>selected?eventDay(e.startsAt):shiftDay(selected,1)).sort()[0];if(next){const button=el('button','Prossimi eventi · '+formatDay(next,{day:'numeric',month:'short'}));button.onclick=()=>selectAgendaDay(next);box.append(button);}list.append(box);
  }
}
function agendaIcs(e,now=new Date()){
  const text=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,'),utc=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const allDay=e.startsAt.length===10,lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Verona//Eventi//IT','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+encodeURIComponent(e.id)+'@verona-app.local','DTSTAMP:'+utc(now)];
  if(allDay){lines.push('DTSTART;VALUE=DATE:'+eventDay(e.startsAt).replaceAll('-',''),'DTEND;VALUE=DATE:'+shiftDay(eventDay(e.endsAt),1).replaceAll('-',''));}
  else{lines.push('DTSTART:'+utc(e.startsAt));if(e.endsAt.length>10&&Date.parse(e.endsAt)>Date.parse(e.startsAt))lines.push('DTEND:'+utc(e.endsAt));}
  lines.push('SUMMARY:'+text(e.title),'LOCATION:'+text(e.location),'DESCRIPTION:'+text((e.summary||'Consulta il programma ufficiale.')+(e.recordType!=='deadline'&&agendaBand(e)==='period'?'\nPeriodo indicato dalla fonte: verifica giorni e orari effettivi.':'')+'\nFonte: '+e.source+'\n'+(e.sourceUrl||'')));
  try{const url=new URL(e.sourceUrl);if(url.protocol==='https:')lines.push('URL:'+url.href);}catch{}
  lines.push('END:VEVENT','END:VCALENDAR');
  return lines.map(line=>{let out='',row='',bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>75){out+=row+'\r\n';row=' ';bytes=1;}row+=char;bytes+=n;}return out+row;}).join('\r\n')+'\r\n';
}
function appendAgendaExport(content,e){
  const button=el('button','Aggiungi al calendario del telefono · .ics','dialog-save agenda-export'),feedback=el('p','','detail-note');feedback.setAttribute('role','status');
  button.onclick=()=>{try{const url=URL.createObjectURL(new Blob([agendaIcs(e)],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='verona-'+String(e.id).replace(/[^a-z0-9_-]/gi,'-').slice(0,70)+'.ics';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback.textContent='File .ics pronto: aprilo con il calendario del telefono. Le modifiche future all’evento non si sincronizzano automaticamente.';}catch{feedback.textContent='Esportazione non disponibile in questo browser. Puoi consultare il programma ufficiale.';}};content.append(button,feedback);
}
const categories=[...new Set(events.flatMap(e=>e.category||[]))].sort((a,b)=>a.localeCompare(b,'it'));for(const value of categories){const option=el('option',value);option.value=value;$('agenda-category').append(option);}
for(const district of districtsData.items){const option=el('option','Circoscrizione '+district.id);option.value=String(district.id);$('agenda-zone').append(option);}
$('today').onclick=()=>agendaSelection('today');$('agenda-tomorrow').onclick=()=>agendaSelection('tomorrow');$('agenda-weekend').onclick=()=>agendaSelection('weekend');$('agenda-day-mode').onclick=()=>{agendaShowAll=!agendaShowAll;render();};
for(const [id,delta]of [['week-prev',-7],['week-next',7]])$(id).onclick=()=>{selected=shiftDay(selected,delta);month=selected.slice(0,7);render();$('events').scrollTop=0;};
$('agenda-open-filters').onclick=()=>$('open-filters').onclick();
const originalOpenFilters=$('open-filters').onclick,originalResetFilters=$('reset-filters').onclick;
$('open-filters').onclick=()=>{originalOpenFilters();const active=['calendar','saved','eventmap'].includes(view);$('agenda-filter-fields').hidden=!active;if(active&&filterSnapshot)for(const id of agendaFilterIds)filterSnapshot[id]=$(id).value;};
$('reset-filters').onclick=()=>{originalResetFilters();for(const id of agendaFilterIds)$(id).value='';};
$('calendar-event-map').onclick=()=>{eventMapSaved=onlySaved;$('event-map-period').value=agendaRange==='weekend'?'2':'1';openEventMap();};
agendaReady=true;
// Refresh only the active day, without interrupting an open panel or draft filters.
if(typeof document.addEventListener==='function'){
  const update=()=>{if(document.visibilityState!=='hidden'&&['calendar','saved'].includes(view)&&!filterSnapshot&&!$('detail-dialog').open&&!$('month-dialog').open){const scroll=$('events').scrollTop||0;refreshSavedDay();render();$('events').scrollTop=scroll;}};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')update();});
  const tick=()=>setTimeout(()=>{update();tick();},60000);tick();
}

function renderInlineMonth(filtered){
 const first=month+'-01',offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7,days=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
 $('inline-month-title').replaceChildren(el('span',formatDay(first,{month:'long'})),el('span',' '+month.slice(0,4),'inline-month-year'));
 const grid=$('inline-month-grid');grid.replaceChildren();
 for(let i=0;i<Math.ceil((offset+days)/7)*7;i++){
  const day=shiftDay(first,i-offset),rows=filtered.filter(e=>occursOn(e,day)),saved=rows.filter(isSavedEvent).length,button=el('button','','inline-month-day');
  button.type='button';button.setAttribute('data-day',day);button.setAttribute('aria-pressed',String(day===selected));button.setAttribute('tabindex',day===selected?'0':'-1');
  button.classList.toggle('outside',!day.startsWith(month));button.classList.toggle('today',day===today);button.classList.toggle('selected',day===selected);
  button.setAttribute('aria-label',formatDay(day,{weekday:'long',day:'numeric',month:'long',year:'numeric'})+', '+rows.length+' eventi'+(saved?', '+saved+' salvati':''));
  button.append(el('span',String(Number(day.slice(-2))),'inline-day-number'),el('span',saved?'♥':rows.length?'•':'','inline-day-indicator'+(saved?' has-saved':'')));
  button.onclick=()=>{selectAgendaDay(day);focusInlineDay(day);};
  button.addEventListener('keydown',event=>{
   let target;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
   if(delta)target=shiftDay(day,delta);
   if(event.key==='Home')target=shiftDay(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
   if(event.key==='End')target=shiftDay(day,6-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
   if(['PageUp','PageDown'].includes(event.key)){event.preventDefault();changeInlineMonth(event.key==='PageUp'?-1:1);focusInlineDay(selected);return;}
   if(target){event.preventDefault();selectAgendaDay(target);focusInlineDay(target);}
  });grid.append(button);
 }
}
function focusInlineDay(day){Array.from($('inline-month-grid').children).find(button=>button.getAttribute('data-day')===day)?.focus({preventScroll:true});}
function changeInlineMonth(delta){
 const next=shiftMonth(month,delta),last=new Date(Date.UTC(Number(next.slice(0,4)),Number(next.slice(5)),0)).getUTCDate();
 selectAgendaDay(next+'-'+String(Math.min(Number(selected.slice(-2)),last)).padStart(2,'0'));
}
$('inline-month-prev').onclick=()=>changeInlineMonth(-1);$('inline-month-next').onclick=()=>changeInlineMonth(1);
$('inline-month-today').onclick=()=>agendaSelection('today');
$('inline-month-filters').onclick=()=>$('open-filters').onclick();
$('inline-month-map').onclick=()=>{$('filters-dialog').close();$('calendar-event-map').onclick();};
