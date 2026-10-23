// Read-only discovery and calibration. This module never replaces app timetables.
export const stopEndpoint = 'https://www.mycicero.it/OTPProxy/host.ashx?url=momoservice/json/GetArriviPartenzePalina2';
export const calibration = Object.freeze({stopCode:'1974', date:'2026-10-19', expectedTimes:['05:30','05:50','06:10','06:26','06:48','07:08','07:28','07:38','07:48']});

export function inventoryStops(catalog) {
  const candidates = new Map();
  let withoutNumericCode = 0;
  for (const route of catalog.routes) for (const stop of route.stops) {
    const code = String(stop.ref ?? '').trim();
    if (!/^\d+$/.test(code)) { withoutNumericCode++; continue; }
    if (!candidates.has(code)) candidates.set(code,{code,names:new Set(),osmIds:new Set(),lines:new Set()});
    const item=candidates.get(code);
    item.names.add(stop.name); item.osmIds.add(stop.id); item.lines.add(route.lineId);
  }
  const stops=[...candidates.values()].map(item=>({...item,names:[...item.names].sort(),osmIds:[...item.osmIds].sort(),lines:[...item.lines].sort(),identityVerified:false})).sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true}));
  return {scope:'Solo fermate delle mappe OSM locali, non l’intera rete ATV',routeCount:catalog.routes.length,lineCount:new Set(catalog.routes.map(route=>route.lineId)).size,occurrences:catalog.routes.reduce((n,r)=>n+r.stops.length,0),withoutNumericCode,uniqueCodes:stops.length,multipleOsmIds:stops.filter(s=>s.osmIds.length>1).length,stops};
}

export function momoDate(iso) {
  const date=new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('Data non valida');
  const offset=new Intl.DateTimeFormat('en',{timeZone:'Europe/Rome',timeZoneName:'longOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName').value.replace('GMT','').replace(':','') || '+0000';
  return `/Date(${date.getTime()}${offset})/`;
}

export function romeDayBounds(date) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)throw new Error('Data di servizio non valida');
  function midnight(day){
    const utc=Date.parse(day+'T00:00:00Z');let instant=utc;
    for(let i=0;i<3;i++){
      const offset=new Intl.DateTimeFormat('en',{timeZone:'Europe/Rome',timeZoneName:'longOffset'}).formatToParts(new Date(instant)).find(p=>p.type==='timeZoneName').value;
      const match=/GMT([+-])(\d{2}):(\d{2})/.exec(offset);
      if(!match)throw new Error('Fuso Europe/Rome non disponibile');
      instant=utc-(match[1]==='+'?1:-1)*(Number(match[2])*60+Number(match[3]))*60000;
    }
    return instant;
  }
  const next=new Date(Date.parse(date)+86400000).toISOString().slice(0,10);
  return {start:midnight(date),end:midnight(next)};
}

export function parseStopResponse(data,stopCode) {
  if (data?.StatusCode!==200 || data?.Tipo!==0 || String(data.Oggetto?.Fermata?.Codice)!==stopCode || !Array.isArray(data.Oggetto?.Passaggi)) return {status:'blocked',reason:'Risposta non valida o fermata diversa',count:0,complete:false};
  const rows=data.Oggetto.Passaggi;
  const departures=rows.map(row=> {
    const match=/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(row.DataOraPassaggio ?? '');
    if (!match) return null;
    const instant=new Date(Number(match[1]));
    if(!Number.isFinite(instant.getTime())) return null;
    return {stopCode:String(row.CodiceFermata ?? ''),line:row.Percorso?.Linea?.Codice ?? null,tripId:row.Corsa?.ID_Corsa ?? row.Id ?? null,destination:row.CapolineaArrivo?.Descrizione ?? null,terminalCode:row.CapolineaArrivo?.Codice ?? null,stopSequence:row.NumFermata??null,instant:instant.toISOString(),date:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant),time:new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(instant),realTime:row.isPassaggioRealTime ?? null};
  }).filter(Boolean);
  return {status:'parsed',count:rows.length,departures,complete:false,stop:{code:data.Oggetto.Fermata.Codice,name:data.Oggetto.Fermata.Descrizione,coordinates:data.Oggetto.Fermata.Coordinate}};
}

function assessReference(result) {
  if(!Array.isArray(result.departures))return result;
  const times=result.departures.filter(row=>row.date===calibration.date && row.stopCode===calibration.stopCode && row.line==='24' && row.realTime===false).map(row=>row.time.slice(0,5));
  const missing=calibration.expectedTimes.filter(time=>!times.includes(time));
  return {...result,status:missing.length?'blocked':'sample-matched',reason:missing.length?'La richiesta non riproduce il campione osservato nel portale':'Campione riprodotto; copertura giornaliera e riutilizzo ancora da verificare',missing};
}

export function assessCalibration(data) { return assessReference(parseStopResponse(data,calibration.stopCode)); }

function publicRequestToken(now){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  const stamp=`${parts.month}-${parts.day}-${parts.year} ${parts.hour}:${parts.minute}`;
  // Same anonymous request check generated by the public portal; never logged.
  const checksum=[...`plusmomo${stamp}`].reduce((n,c)=>n+c.charCodeAt(0),0);
  return Buffer.from(stamp+checksum).toString('base64');
}

export async function requestStopWindow({stopCode,date,fetcher=fetch,now=new Date(),from,to}={}) {
  if(!/^\d+$/.test(stopCode))throw new Error('Codice fermata non valido');
  const {start,end}=romeDayBounds(date);
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(to)<=Date.parse(from)) throw new Error('Intervallo non valido');
  if(Date.parse(from)<start || Date.parse(to)>end)throw new Error('Intervallo fuori dalla giornata richiesta');
  const body={CodAzienda:'ATV',CodFermata:stopCode,CodiceLinea:null,DevicePosition:null,Giorno:momoDate(new Date(start)),IdDevice:'DEBUG',IdSistema:'OTP_NE',Lingua:'it',MaxNumeroPassaggi:{NumeroRisultati:20},MaxNumeroPassaggiLinee:{NumeroRisultati:0},OraDa:momoDate(from),OraA:momoDate(to),SecurityToken:publicRequestToken(now)};
  const response=await fetcher(stopEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Client:'tpwebportal-atv;5.5.4','Ignore-MOMO-Type':'true',Culture:'it-IT'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if (!response.ok) return {status:'blocked',reason:`HTTP ${response.status}; nessun tentativo alternativo automatico`,httpStatus:response.status,complete:false};
  const data=await response.json();
  return {...parseStopResponse(data,stopCode),httpStatus:response.status};
}

export async function probeStop(options={}) {
  return assessReference(await requestStopWindow({stopCode:calibration.stopCode,date:calibration.date,from:'2026-10-19T00:00:00+02:00',to:'2026-10-19T08:00:00+02:00',...options}));
}

// Bounded one-stop experiment, deliberately separate from production data.
export async function collectStopDay({stopCode,date,reference=null,request=requestStopWindow,maxRequests=24,windowHours=8}={}) {
  if(!/^\d+$/.test(stopCode))throw new Error('Codice fermata non valido');
  if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>100)throw new Error('Budget da 1 a 100 richieste');
  if(!Number.isInteger(windowHours)||windowHours<1||windowHours>8)throw new Error('Finestra da 1 a 8 ore');
  const {start,end}=romeDayBounds(date);
  const windows=[],leaves=[],issues=[];
  async function visit(from,to) {
    if(windows.length>=maxRequests){issues.push('Budget richieste esaurito');return;}
    const result=await request({stopCode,date,from:new Date(from).toISOString(),to:new Date(to).toISOString()});
    const window={from:new Date(from).toISOString(),to:new Date(to).toISOString(),...result};windows.push(window);
    if(result.httpStatus!==200 || !Array.isArray(result.departures) || String(result.stop?.code)!==stopCode){issues.push('Risposta non valida: raccolta interrotta');throw new Error(issues.at(-1));}
    if(result.departures.length!==result.count)issues.push('Alcuni passaggi non sono decodificabili');
    if(result.departures.some(d=>d.stopCode!==stopCode || !Number.isFinite(Date.parse(d.instant)) || Date.parse(d.instant)<from || Date.parse(d.instant)>to || d.date!==date))issues.push('Passaggi fuori fermata o intervallo');
    if(result.count>=20){
      if(to-from<=60000){issues.push('Intervallo saturo anche a un minuto');return;}
      const middle=Math.floor((from+to)/2);
      await visit(from,middle);await visit(middle,to);
    } else leaves.push(window);
  }
  try{for(let from=start;from<end;from+=windowHours*3600000)await visit(from,Math.min(end,from+windowHours*3600000));}catch(error){if(!issues.includes(error.message))issues.push(error.message);}
  const departures=[...new Map(leaves.flatMap(w=>w.departures).filter(d=>Date.parse(d.instant)>=start && Date.parse(d.instant)<end).map(d=>[`${d.stopCode}|${d.line}|${d.tripId}|${d.destination}|${d.instant}`,d])).values()].sort((a,b)=>a.instant.localeCompare(b.instant));
  if(departures.some(d=>!d.tripId || d.realTime!==false))issues.push('Identificativo corsa o natura programmata non verificati');
  if(!departures.length)issues.push('Nessun passaggio: assenza di servizio da verificare');
  const missing=(reference?.expectedTimes ?? []).filter(time=>!departures.some(d=>d.line===(reference.line ?? '24') && d.date===date && d.time.slice(0,5)===time));
  if(missing.length)issues.push('Campione del portale non riprodotto');
  return {checkedAt:new Date().toISOString(),stopCode,date,timezone:'Europe/Rome',dayHours:(end-start)/3600000,complete:false,status:issues.length?'incomplete':'ready-for-ui-comparison',requests:windows.length,coverageIssues:[...new Set(issues)],missingReferenceTimes:missing,departureCount:departures.length,departures,windows};
}

export function collectCalibrationDay(options={}) {return collectStopDay({stopCode:calibration.stopCode,date:calibration.date,reference:calibration,...options});}

export function compareStopDays(previous,current){
  if(previous.stopCode!==current.stopCode||previous.date!==current.date)throw new Error('Confronto tra fermate o date diverse');
  const key=d=>`${d.stopCode}|${d.line}|${d.tripId}|${d.destination}|${d.instant}|${d.realTime}`;
  const a=new Set(previous.departures.map(key)),b=new Set(current.departures.map(key));
  return {previousCount:a.size,currentCount:b.size,missing:[...a].filter(k=>!b.has(k)),additional:[...b].filter(k=>!a.has(k)),consistent:previous.status==='ready-for-ui-comparison'&&current.status==='ready-for-ui-comparison'&&a.size>0&&a.size===b.size&&[...a].every(k=>b.has(k))};
}

export function compareTripDeparture(data,expected){
  const trip=data?.Oggetto;
  if(data?.Tipo!==0 || data?.StatusCode!==200 || !Array.isArray(trip?.Fermate))return {status:'invalid-response'};
  if(String(trip.Linea?.Codice)!==expected.line || (trip.Corsa?.ID_Corsa ?? trip.Corsa?.Codice)!==expected.tripId)return {status:'wrong-trip-or-line'};
  if(trip.Fermate.at(-1)?.Localita?.Descrizione!==expected.destination)return {status:'wrong-destination'};
  const rows=trip.Fermate.filter(row=>String(row.Localita?.Codice)===expected.stopCode);
  const instants=rows.map(row=>{
    const match=/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(row.OrarioPartenzaProgrammato ?? '');
    const millis=match?Number(match[1]):NaN;
    return Number.isFinite(millis)&&Math.abs(millis)<=8640000000000000?new Date(millis).toISOString():null;
  });
  if(!rows.length)return {status:'missing-stop'};
  if(!instants.includes(expected.instant))return {status:'different-time',expected:expected.instant,observed:instants};
  return {status:'matched',instant:expected.instant,stopOccurrences:rows.length};
}

export function scheduledTripStop(data,expected){
  const comparison=compareTripDeparture(data,expected);
  if(!['matched','different-time'].includes(comparison.status))return {status:comparison.status};
  let rows=data.Oggetto.Fermate.filter(row=>String(row.Localita?.Codice)===expected.stopCode);
  if(rows.length>1&&Number.isInteger(expected.stopSequence))rows=rows.filter(row=>row.Numero===expected.stopSequence);
  if(rows.length!==1)return {status:'ambiguous-stop'};
  const match=/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(rows[0].OrarioPartenzaProgrammato??'');
  const value=match?Number(match[1]):NaN;
  if(!Number.isFinite(value)||Math.abs(value)>8640000000000000)return {status:'missing-programmed-time'};
  const date=new Date(value);
  return {status:'scheduled',departure:{...expected,sourceInstant:expected.instant,sourceRealTime:expected.realTime,instant:date.toISOString(),date:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(date),time:new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date),realTime:false,timeSource:'trip-programmed'}};
}

export async function requestTripDetail({expected,terminalCode,fetcher=fetch,now=new Date(),includeScheduled=false}={}){
  const match=/^ATV#1:(\d+_\d+)$/.exec(expected.tripId ?? '');
  if(!match || !/^\d+$/.test(terminalCode))throw new Error('Identificativi corsa non validi');
  const body={CodiceAzienda:'ATV',CodicePercorso:match[1],Giorno:momoDate(new Date(romeDayBounds(expected.date).start)),IdCorsa:expected.tripId,IdSistema:'OTP_NE',IdStazioneDiscesa:null,IdStazioneSalita:terminalCode,Lingua:'it',SecurityToken:publicRequestToken(now)};
  const response=await fetcher(stopEndpoint.replace('GetArriviPartenzePalina2','GetFermateCorsa2'),{method:'POST',headers:{'Content-Type':'application/json',Client:'tpwebportal-atv;5.5.4',Culture:'it-IT'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok)return {status:'http-error',httpStatus:response.status};
  const data=await response.json();
  return {...compareTripDeparture(data,expected),httpStatus:response.status,...(includeScheduled?{scheduled:scheduledTripStop(data,expected)}:{})};
}
