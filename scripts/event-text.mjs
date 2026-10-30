// Plain source text only. Do not import contact/organizer fields into event cards.
export function text(value = '') {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', ndash: '–', egrave: 'è', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì' };
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, key) => {
    if (key.startsWith('#')) { const n = key[1] === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return entities[key] ?? m;
  }).replace(/\s+/g, ' ').trim();
}

export function publicEventText(value,limit=1200){
  const clean=text(String(value??'').slice(0,100000)
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|svg|iframe|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' '));
  const safe=clean.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[contatto sulla fonte]')
    .replace(/https?:\/\/[^\s<>]+/gi,'[link sulla fonte]')
    .replace(/(?<!\d)(?:\+39[\s.-]*)?3\d{2}(?:[\s./-]*\d){7}(?!\d)/g,value=>/^\d{5}\s*[-–]\s*\d{5}$/.test(value)?value:'[contatto sulla fonte]')
    .replace(/(?:\+39\s*)?\b\d{9,11}\b/g,'[contatto sulla fonte]')
    .replace(/\b0\d{1,3}(?:[ ./-]+\d{2,4}){2,3}\b/g,value=>value.replace(/\D/g,'').length>=9?'[contatto sulla fonte]':value)
    .replace(/\b0\d{1,3}[ ./-]+\d{5,8}\b/g,'[contatto sulla fonte]');
  if(safe.length<=limit)return safe;
  const end=safe.lastIndexOf(' ',limit-1);
  return safe.slice(0,end>limit*.7?end:limit-1).trimEnd()+'…';
}

export function eventSentences(value){
  return String(value??'').slice(0,100000).replace(/<\/(?:p|li|div|h[1-6])\s*>/gi,'\n').replace(/<br\s*\/?\s*>/gi,' ')
    .split(/\n+|(?<=[.!?;])\s+(?=[A-ZÀ-Ý])/u).map(s=>publicEventText(s,100000)).filter(Boolean);
}

export const conditionRules=[
  ['registration',/iscrizion|iscriver|iscrivi|iscritt/i],
  ['booking',/prenot/i],
  ['capacity',/posti.{0,30}(?:limitat|esaur)|numero (?:massimo|chiuso)|esaurimento/i],
  ['audience',/rivolt[oaie]|riservat[oaie]|baby\s*parking|età prescolare|maggiorenn|minorenni/i]
];
export function conditionFamilies(value){const clean=text(value);return conditionRules.filter(([,pattern])=>pattern.test(clean)).map(([code])=>code);}
function conditionExcerpt(value){
  if(value.length<=480)return value;
  const position=value.search(/obblig|necessari|iscrizion|iscriver|iscrivi|prenot|baby\s*parking|maggiorenn|posti.{0,30}(?:limitat|esaur)/i);
  const start=Math.max(0,position-80);
  return (start?'… ':'')+publicEventText(value.slice(start),start?478:480);
}

export function comuneDetails(data){
  const abstract=publicEventText(data.event_abstract,450),description=publicEventText(data.description,1200);
  const audience=Array.isArray(data.target_audience)?data.target_audience.filter(v=>typeof v==='string').map(v=>publicEventText(v,80)).slice(0,12):[];
  const about=publicEventText(data.about_target_audience,450);
  const ages=Array.isArray(data.typical_age_range)?data.typical_age_range.filter(v=>typeof v==='string').map(v=>publicEventText(v,80)).slice(0,8):[];
  const conditions=eventSentences(data.description).filter(s=>conditionFamilies(s).length||/necessari|obbligatori|accesso|partecipazione|ingresso/i.test(s));
  // Prioritize requirements over introductory prose and scan before truncating.
  conditions.sort((a,b)=>Number(/obblig|necessari|baby\s*parking|maggiorenn/i.test(b))-Number(/obblig|necessari|baby\s*parking|maggiorenn/i.test(a)));
  const notes=[publicEventText(data.cost_notes,600),about,ages.length?'Età indicata dalla fonte: '+ages.join(', ')+'.':'',...conditions.map(conditionExcerpt),audience.length?'Destinatari indicati dalla fonte: '+audience.join(', ')+'.':''];
  const accessNotes=publicEventText([...new Set(notes.filter(Boolean))].join(' '),1800);
  const missing=conditionFamilies([data.cost_notes,data.description,data.about_target_audience].join(' ')).filter(code=>!conditionFamilies(accessNotes).includes(code));
  return {...abstract||description?{summary:publicEventText([abstract,description&&description!==abstract?description:''].filter(Boolean).join(' '),1600)}:{},...audience.length?{targetAudience:audience}:{},...accessNotes?{accessNotes:accessNotes+(missing.length?' Sintesi delle condizioni incompleta: verifica il programma ufficiale.':'')}:{},...missing.length?{contentIssues:missing.map(code=>'condition-not-retained:'+code)}:{}};
}
