import {text} from './parsers.mjs';

function civilDay(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function extractNewsTiming(item,resource=null){
  if(resource&&String(resource.metadata?.id)!==item.id.replace('comune-news-',''))throw Error('Identità comunicazione inattesa');
  const fields=resource?.data?.['ita-IT']||{},content=[item.title,item.summary,text(fields.body||'')].join('\n').replace(/\b(ore\s+\d{1,2})\.(\d{2})\b/gi,'$1:$2'),months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const dates=/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b|\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})\b/gi;
  const found=[];
  for(const match of content.matchAll(dates)){
    const prefix=content.slice(Math.max(0,match.index-160),match.index),cue=prefix.match(/(?:\bentro(?:\s+e\s+non\s+oltre)?|\bscadenza|\btermine\s+(?:di\s+)?presentazione|\bprorogat[oa]\s+al)([^.!?\n]{0,120})$/i);
    if(!cue)continue;
    const gap=cue[1].replace(/\b(?:il|le|ore|alle|del|di|al|e|non|oltre|domenica|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|presentazione|delle|dei|domande|candidature|proposte|iscrizioni|osservazioni|è|fissato|fissata)\b/gi,'').replace(/\d{1,2}(?:[.:]\d{2})?/g,'').replace(/[\s:–—,-]/g,'');
    if(gap)continue;
    const day=match[3]?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:`${match[6]}-${String(months.indexOf(match[5].toLowerCase())+1).padStart(2,'0')}-${match[4].padStart(2,'0')}`;
    if(!civilDay(day))continue;
    const clock=(cue[1].match(/\bore\s+(\d{1,2})(?:[.:](\d{2}))?/i)||content.slice(match.index+match[0].length,match.index+match[0].length+42).match(/^\s*(?:alle\s+)?ore\s+(\d{1,2})(?:[.:](\d{2}))?/i));
    if(clock&&(Number(clock[1])>23||Number(clock[2]||0)>59))continue;
    const time=clock?clock[1].padStart(2,'0')+':'+(clock[2]||'00'):null;
    found.push({day,time,evidence:(cue[0]+match[0]+(clock&&content.slice(match.index+match[0].length).startsWith(clock[0])?clock[0]:'')).trim().slice(0,220)});
  }
  const days=new Set(found.map(value=>value.day)),clocks=new Set(found.map(value=>value.time).filter(Boolean));
  const deadline=days.size===1&&clocks.size<=1?{...found[0],time:[...clocks][0]||null}:null;
  const publicationExpiresOn=typeof fields.dead_line==='string'&&civilDay(fields.dead_line.slice(0,10))?fields.dead_line.slice(0,10):null;
  const withdrawn=/^(?:revoca|revocato|revocata|annullamento|annullato|annullata|ritiro)\b/i.test(item.title.trim());
  return {deadline,ambiguous:days.size>1||clocks.size>1,publicationExpiresOn,withdrawn,method:deadline?'explicit-text':'not-established',sourceUpdatedAt:resource?.metadata?.modified||null};
}

// Standalone helpers are also embedded in the frontend. No inferred year/time.
export function newsDeadlineInstant(deadline){
  if(!deadline?.day||!deadline.time)return null;
  const expected=deadline.day+' '+deadline.time,formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const candidates=['+01:00','+02:00'].map(offset=>new Date(deadline.day+'T'+deadline.time+':00'+offset)).filter(date=>{if(!Number.isFinite(date.getTime()))return false;const parts=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`===expected;});
  return candidates.length===1?candidates[0].toISOString():null;
}
export function newsValidity(item,now=new Date()){
  const timing=item.timing||{},deadline=timing.deadline,day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  if(timing.withdrawn)return {state:'withdrawn',label:'Revoca / annullamento',deadline:null};
  if(deadline){const instant=newsDeadlineInstant(deadline),expired=deadline.day<day||(instant&&new Date(now).getTime()>=Date.parse(instant));if(!expired&&deadline.time&&!instant)return {state:'unknown',label:'Orario da verificare',deadline};return {state:expired?'expired':'open',label:expired?'Scadenza conclusa':deadline.day===day?'Scade oggi':'Scadenza aperta',deadline};}
  if(timing.publicationExpiresOn&&timing.publicationExpiresOn<day)return {state:'expired',label:'Pubblicazione scaduta',deadline:null};
  return {state:item.kind==='Avviso'?'unknown':'informative',label:item.kind==='Avviso'?'Validità da verificare':'Notizia informativa',deadline:null};
}
export function newsPastSeason(item,day){
  const value=item.title+' '+(item.summary||''),year=Number(day.slice(0,4)),month=Number(day.slice(5,7));
  return [...value.matchAll(/\b(primavera|estate|autunno|inverno)\s+(20\d{2})\b/gi)].some(match=>Number(match[2])<year||(Number(match[2])===year&&month>({primavera:6,estate:9,autunno:12,inverno:3}[match[1].toLowerCase()])));
}

export async function attachNewsTiming(items,load,{onError=()=>{}}={}){
  const result=[];for(const item of items){try{const id=Number(item.id.replace('comune-news-','')),resource=await load(id);result.push({...item,timing:extractNewsTiming(item,resource)});}catch(error){onError(item.id,error);result.push({...item,timing:{...extractNewsTiming(item),detailUnavailable:true}});}}return result;
}
