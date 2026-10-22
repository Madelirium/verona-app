// Shared by the browser and the publication check. Service dates are in Rome.
export function datasetStatus(data={},options={}){
  const now=new Date(options.now??Date.now()),day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  const sources=data.sources||[],failed=[...sources.filter(source=>source.status==='error'),...(data.status==='error'?[data]:[])];
  const date=value=>{const instant=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(instant)&&instant<=now.getTime()?value:null;};
  const updatedAt=date(data.updatedAt||data.publicationTimestamp),maxAgeHours=options.maxAgeHours;
  const stale=value=>Boolean(maxAgeHours&&(!date(value)||now-Date.parse(value)>maxAgeHours*3600000));
  const oldSources=sources.filter(source=>stale(source.lastSuccessAt));
  let state='current',message='Raccolta recente. La validità delle singole informazioni va verificata sulla fonte.';
  if(options.calendar){
    if(!validDay(data.validFrom)||!validDay(data.validTo)||data.validFrom>data.validTo){state='unknown';message='Validità degli orari non disponibile: consulta ATV.';}
    else if(day<data.validFrom){state='future';message='Orari non ancora validi: disponibili dal '+data.validFrom.split('-').reverse().join('/')+'. Consulta ATV per oggi.';}
    else if(day>data.validTo){state='expired';message='Orari scaduti il '+data.validTo.split('-').reverse().join('/')+'. Consulta ATV prima di partire.';}
    else{const daysLeft=Math.round((Date.parse(data.validTo)-Date.parse(day))/86400000);state=daysLeft<=7?'expiring':'current';message=daysLeft===0?'Orari validi fino a oggi. Per domani serve un archivio aggiornato.':daysLeft<=7?'Orari validi ancora '+daysLeft+(daysLeft===1?' giorno':' giorni')+'. Dopo il '+data.validTo.split('-').reverse().join('/')+' serve un archivio aggiornato.':'Orari validi per oggi, fino al '+data.validTo.split('-').reverse().join('/')+'.';}
  }else if(failed.length){state='partial';message='Ultimo aggiornamento incompleto: sono conservati anche dati precedenti.';}
  else if(!updatedAt){state='unknown';message='Data dell’ultimo aggiornamento non disponibile.';}
  else if(stale(updatedAt)||oldSources.length){state='stale';message='Alcuni dati non vengono aggiornati da oltre '+(maxAgeHours===48?'due giorni':maxAgeHours+' ore')+'. Verifica la fonte.';}
  else if(!maxAgeHours){state='snapshot';message='Catalogo aggiornato periodicamente; non indica disponibilità in tempo reale.';}
  return {state,message,updatedAt,day,validFrom:data.validFrom||null,validTo:data.validTo||null,failedSources:failed.length,staleSources:oldSources.length};
}
