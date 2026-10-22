var weatherReady=false;
const weatherFeed='https://www.arpa.veneto.it/risorse/data-bollettini/meteo/bollettini/it/xml/bollettino_widget.xml';
const weatherAreas={'14':'Verona e pedemontana','15':'Area del Garda'};
let weatherData=null,weatherArea='14',weatherLoading=false,weatherFailed=false,weatherFocus=null;
var eventWeatherPreview=null;
let weatherEventContext=null,weatherPanelArea=null;
function weatherDateValid(day){return /^\d{4}-\d{2}-\d{2}$/.test(day||'')&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
function weatherTemperature(value){
  if(typeof value!=='string'||!/^[-+]?\d{1,2}(?:[.,]\d)?(?:\/[-+]?\d{1,2}(?:[.,]\d)?)?$/.test(value))return '';
  const numbers=value.split('/').map(number=>Number(number.replace(',','.')));
  return numbers.every(number=>number>=-60&&number<=65)&&numbers[0]<=numbers.at(-1)?value.replace('/','–')+' °C':'';
}
function validWeather(data){
  return Boolean(data&&weatherDateValid(data.day)&&/^\d{2}:\d{2}$/.test(data.time)&&Number(data.time.slice(0,2))<24&&Number(data.time.slice(3))<60&&Number.isFinite(Date.parse(data.fetchedAt))&&Array.isArray(data.zones)&&data.zones.length===2&&Object.keys(weatherAreas).every(id=>data.zones.some(zone=>zone.id===id&&Array.isArray(zone.days)&&zone.days.length>0&&zone.days.length<=20&&zone.days.every(row=>weatherDateValid(row.day)&&['am','pm','all'].includes(row.period)&&typeof row.sky==='string'&&row.sky.length>0&&row.sky.length<=300&&typeof row.rain==='string'&&row.rain.length<=300&&typeof row.min==='string'&&typeof row.max==='string'&&(row.probability===null||Number.isInteger(row.probability)&&row.probability>=0&&row.probability<=100)))));
}
function parseWeatherXML(xml){
  if(typeof xml!=='string'||xml.length>250000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Bollettino non valido');
  const doc=new DOMParser().parseFromString(xml,'text/xml'),root=doc.documentElement;
  if(doc.querySelector('parsererror')||root?.tagName!=='bulletin')throw Error('XML non valido');
  const data={day:root.getAttribute('date'),time:root.getAttribute('time'),fetchedAt:new Date().toISOString(),zones:[]};
  for(const [id,name]of Object.entries(weatherAreas)){
    const area=doc.querySelector('meteogram[zoneid="'+id+'"]');if(!area||area.getAttribute('name')!==name)throw Error('Area non riconosciuta');
    const days=[...area.querySelectorAll('days > day')].map(node=>{
      const temp=[...node.querySelectorAll('temp')].find(item=>!item.getAttribute('meters')),sky=node.querySelector('sky'),rain=node.querySelector('rain'),percentage=rain?.getAttribute('perc')||'';
      return {day:node.getAttribute('date'),period:node.getAttribute('time'),sky:sky?.textContent.trim()||'',rain:rain?.textContent.trim()||'',probability:/^\d{1,3}%$/.test(percentage)?Number(percentage.slice(0,-1)):null,min:temp?.getAttribute('min')||'',max:temp?.getAttribute('max')||''};
    });data.zones.push({id,days});
  }
  if(!validWeather(data))throw Error('Dati incompleti');return data;
}
function weatherState(now=new Date(),area=weatherArea){
  if(!validWeather(weatherData))return {usable:false,rows:[],stale:false};
  const day=dayInRome(now),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',hourCycle:'h23'}).format(now));
  const ageDays=(Date.parse(day)-Date.parse(weatherData.day))/86400000;
  const stale=ageDays>1||ageDays<0||Date.parse(weatherData.fetchedAt)>now.getTime()+600000;
  const rows=(weatherData.zones.find(zone=>zone.id===area)?.days||[]).filter(row=>row.day>=day&&!(row.day===day&&row.period==='am'&&hour>=12));
  return {usable:!stale&&rows.length>0,rows,stale};
}
function renderWeatherHeader(){
  if(!weatherReady)return;
  const state=weatherState(),row=state.rows[0],place=weatherArea==='15'?'Garda':'Verona';
  $('home-weather-label').textContent='Meteo '+place;
  const maximum=row&&weatherTemperature(row.max);
  const nextDay=row&&row.day!==dayInRome(new Date())?formatDay(row.day,{weekday:'short'})+' · ':'';
  $('home-weather-value').textContent=state.usable?(weatherFailed?'Dati salvati →':maximum?nextDay+'Max '+maximum+' →':'Previsioni →'):weatherLoading?'Caricamento…':weatherData?'Da aggiornare →':'Apri previsioni →';
  $('home-weather').setAttribute('aria-label','Previsioni per '+weatherAreas[weatherArea]+(state.usable?' · '+row.sky+(maximum?' · massima '+maximum:''):'')+' · Apri meteo');
}
function renderWeather(){
  renderWeatherHeader();$('weather-area').value=weatherPanelArea||weatherArea;$('weather-refresh').disabled=weatherLoading;
  const state=weatherState(new Date(),weatherPanelArea||weatherArea),list=$('weather-days');list.replaceChildren();
  const rows=weatherEventContext?state.rows.filter(row=>eventWeatherRowMatches(row,weatherEventContext)):state.rows;
  $('weather-event-context').hidden=!weatherEventContext;$('weather-all-days').hidden=!weatherEventContext;
  $('weather-context-bar').hidden=!weatherEventContext;
  $('weather-event-context').textContent=weatherEventContext?'Per '+weatherEventContext.title+' · '+formatDay(weatherEventContext.day,{day:'numeric',month:'long'}):'';
  $('weather-status').textContent=weatherLoading?'Aggiornamento delle previsioni…':weatherFailed?(state.usable?'Aggiornamento non riuscito. Mostriamo l’ultimo bollettino disponibile.':'Meteo non disponibile: riprova o consulta ARPAV.'):weatherData&&!state.usable?'Bollettino da aggiornare. Consulta ARPAV per le previsioni attuali.':'';
  $('weather-issued').textContent=weatherData?'Bollettino ARPAV del '+formatDay(weatherData.day,{day:'numeric',month:'long',year:'numeric'})+' · ore '+weatherData.time:'';
  if(state.usable)for(const row of rows){
    const card=el('article','','weather-day');card.append(el('h3',formatDay(row.day,{weekday:'long',day:'numeric',month:'short'})+' · '+({am:'mattina',pm:'pomeriggio / sera',all:'giornata'}[row.period])),el('strong',row.sky));
    const min=weatherTemperature(row.min),max=weatherTemperature(row.max);card.append(el('p',[min?'Min '+min:'',max?'Max '+max:''].filter(Boolean).join(' · ')||'Temperature non indicate nel bollettino'));
    card.append(el('p','Precipitazioni: '+(row.rain||'non indicate')+(row.probability!==null?' · probabilità '+row.probability+'%':'')));list.append(card);
  }
  if(!state.usable&&!weatherLoading)list.append(el('p','Le previsioni saranno mostrate quando sarà disponibile un bollettino valido.','weather-empty'));
  else if(state.usable&&!rows.length)list.append(el('p','Il bollettino attuale non copre il giorno o la fascia dell’evento. Puoi consultare tutti i giorni disponibili.','weather-empty'));
  renderEventWeatherPreview();
}
async function loadWeather(force=false){
  if(weatherLoading)return;
  const age=weatherData?Date.now()-Date.parse(weatherData.fetchedAt):Infinity;
  if(!force&&weatherState().usable&&age>=0&&age<3600000){renderWeather();return;}
  weatherLoading=true;renderWeather();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(weatherFeed,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('HTTP '+response.status);const next=parseWeatherXML(await response.text());if(!validWeather(next))throw Error('Bollettino incompleto');weatherData=next;weatherFailed=false;try{localStorage.setItem('verona-weather-v1',JSON.stringify(next));}catch{}}
  catch{weatherFailed=true;}
  finally{clearTimeout(timer);weatherLoading=false;renderWeather();}
}
function openWeather(context=null){weatherEventContext=context;weatherPanelArea=context?.area||weatherArea;weatherFocus=document.activeElement;renderWeather();$('weather-dialog').showModal();$('weather-close').focus();return loadWeather();}
try{const saved=JSON.parse(localStorage.getItem('verona-weather-v1')||'null');if(validWeather(saved))weatherData=saved;const area=localStorage.getItem('verona-weather-area-v1');if(weatherAreas[area])weatherArea=area;}catch{}
$('home-weather').onclick=()=>openWeather();
$('weather-close').onclick=()=>$('weather-dialog').close();
$('weather-dialog').addEventListener('close',()=>{if(weatherFocus?.isConnected)weatherFocus.focus();});
$('weather-area').onchange=()=>{if(!weatherAreas[$('weather-area').value])return;weatherEventContext=null;weatherPanelArea=weatherArea=$('weather-area').value;try{localStorage.setItem('verona-weather-area-v1',weatherArea);}catch{}renderWeather();};
$('weather-all-days').onclick=()=>{weatherEventContext=null;renderWeather();};
$('weather-refresh').onclick=()=>loadWeather(true);
weatherReady=true;renderWeather();if(typeof fetch==='function')loadWeather();
document.addEventListener?.('visibilitychange',()=>{if(!document.hidden&&view==='home')loadWeather();});

function eventWeatherArea(event){
  const point=eventPosition(event),place=event.location||'';
  // Non è un confine amministrativo: richiediamo anche una sede esplicitamente a Verona.
  if(!point||point.lat<45.38||point.lat>45.49||point.lon<10.91||point.lon>11.08||/provincia|itinerario|sedi varie/i.test(place))return null;
  return event.areaConfirmed&&event.area==='Verona'||/\b371\d{2}\s+Verona\b/i.test(place)||/(?:^|[\s·,–-])Verona\s*$/i.test(place)?'14':null;
}
function eventWeatherContext(event){
  const area=eventWeatherArea(event);if(!area)return null;
  const start=eventDay(event.startsAt),end=eventDay(event.endsAt),nowDay=dayInRome(new Date());
  if(end<nowDay||event.endsAt.length>10&&Date.parse(event.endsAt)>Date.parse(event.startsAt)&&Date.parse(event.endsAt)<=Date.now())return null;
  const day=selected>=start&&selected<=end&&selected>=nowDay?selected:start>=nowDay?start:nowDay;
  const periods=[];
  if(event.datePrecision!=='date'&&event.startsAt.length>10){
    const minute=value=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));return Number(parts.find(part=>part.type==='hour').value)*60+Number(parts.find(part=>part.type==='minute').value);};
    const from=day===start?minute(event.startsAt):0;
    const knownEnd=Date.parse(event.endsAt)>Date.parse(event.startsAt),to=knownEnd?(day===end?minute(event.endsAt):1440):day===start?from:1440;
    if(knownEnd&&day===end&&to===0)return null;
    if(from<720)periods.push('am');if(to>720||from>=720)periods.push('pm');
  }
  return {area,day,periods,title:event.title};
}
function eventWeatherRowMatches(row,context){return row.day===context.day&&(!context.periods.length||row.period==='all'||context.periods.includes(row.period));}
function clearEventWeatherPreview(){eventWeatherPreview=null;}
function appendEventWeather(content,event){
  clearEventWeatherPreview();const context=eventWeatherContext(event);if(!context)return;
  const box=el('section','','event-weather-preview');box.hidden=true;content.append(box);eventWeatherPreview={box,context};renderEventWeatherPreview();loadWeather();
}
function renderEventWeatherPreview(){
  if(!eventWeatherPreview)return;
  const {box,context}=eventWeatherPreview,state=weatherState(new Date(),context.area),rows=state.rows.filter(row=>eventWeatherRowMatches(row,context));
  box.hidden=!state.usable||!rows.length;if(box.hidden)return;
  // Non sostituire il pulsante mentre è focalizzato durante un aggiornamento.
  let button=box.children[0];if(!button){button=el('button','','event-weather-open');button.type='button';button.onclick=()=>openWeather(context);box.append(button);}button.replaceChildren();
  button.append(el('span','Meteo per l’evento · '+formatDay(context.day,{day:'numeric',month:'short'}),'home-row-label'));
  for(const row of rows){const min=weatherTemperature(row.min),max=weatherTemperature(row.max);button.append(el('strong',({am:'Mattina',pm:'Pomeriggio / sera',all:'Giornata'}[row.period])+': '+row.sky),el('span',[min?'Min '+min:'',max?'Max '+max:'',row.probability!==null?'Probabilità pioggia '+row.probability+'%':''].filter(Boolean).join(' · '),'event-weather-summary'));}
  button.append(el('small',(weatherFailed?'Bollettino salvato · ':'')+weatherAreas[context.area]+' · ARPAV · Dettagli →'));
}
