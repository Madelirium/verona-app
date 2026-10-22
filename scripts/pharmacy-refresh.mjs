import {createHash} from 'node:crypto';
import {parsePharmacyPdf,attachPharmacyPositions,validatePharmacies,pharmacyPeriods} from './pharmacies.mjs';
export const pharmacySourceUrl='https://www.ordinefarmacisti.vr.it/turni-farmacie/';
export const pharmacyParserVersion=1;
export function pharmacyPdfLinks(html,day){
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)throw Error('Data raccolta non valida');
  const urls=new Set();
  for(const match of html.matchAll(/href=["']([^"']+)["']/gi)){
    let url;try{url=new URL(match[1].replaceAll('&amp;','&'),pharmacySourceUrl);}catch{continue;}
    if(url.origin!=='https://www.ordinefarmacisti.vr.it'||!url.pathname.toLowerCase().endsWith('.pdf'))continue;
    const dates=[...decodeURIComponent(url.pathname).matchAll(/(\d{2})\.(\d{2})\.(20\d{2})/g)];
    if(dates.length===2&&dates[1][3]+'-'+dates[1][2]+'-'+dates[1][1]>=day)urls.add(url.href);
  }
  if(!urls.size||urls.size>100)throw Error('Nessun calendario riconosciuto o elenco PDF inatteso');
  return [...urls].sort();
}
export function pharmacyCoverage(data,now,previous=null){
  validatePharmacies(data);const instant=Date.parse(now),active=pharmacyPeriods(data,now);if(active.length!==1)throw Error('Il calendario non copre il momento della raccolta');
  const future=data.periods.filter(period=>Date.parse(period.endsAt)>instant).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  for(let i=1;i<future.length;i++)if(Date.parse(future[i].startsAt)!==Date.parse(future[i-1].endsAt))throw Error('Manca un periodo tra i turni pubblicati');
  const last=future.at(-1),previousEnd=Math.max(0,...(previous?.periods||[]).map(period=>Date.parse(period.endsAt)).filter(Number.isFinite));
  if(Date.parse(last.endsAt)<previousEnd)throw Error('La nuova raccolta riduce la copertura già disponibile');
  return {currentPeriodId:active[0].id,startsAt:future[0].startsAt,endsAt:last.endsAt,remainingHours:Math.floor((Date.parse(last.endsAt)-instant)/3600000)};
}
export async function refreshPharmacies({now,day,previous=null,fetchPage,fetchPdf,extractPdf,loadPositions}){
  const report={sourceUrl:pharmacySourceUrl,attemptedAt:now,status:'error',items:[],warnings:[],error:null,preservedPrevious:Boolean(previous)};
  try{
    const links=pharmacyPdfLinks(await fetchPage(),day),periods=[];
    for(const url of links){
      const bytes=Buffer.from(await fetchPdf(url));if(bytes.length>5e6||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Risposta PDF non valida: '+url);
      const sha256=createHash('sha256').update(bytes).digest('hex'),cached=previous?.parserVersion===pharmacyParserVersion&&previous.periods.find(period=>period.sourceUrl===url&&period.sha256===sha256);
      const period=cached?structuredClone(cached):parsePharmacyPdf(await extractPdf(bytes,sha256),url,now);
      period.sha256=sha256;period.checkedAt=now;for(const item of period.items)item.checkedAt=now;periods.push(period);report.items.push({sourceUrl:url,sha256,count:period.items.length,extraction:cached?'unchanged':'parsed'});
    }
    periods.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
    const data={source:'Ordine dei Farmacisti della Provincia di Verona',sourceUrl:pharmacySourceUrl,checkedAt:now,status:'ok',parserVersion:pharmacyParserVersion,positionStatus:'unavailable',positionsCheckedAt:previous?.positionsCheckedAt||(previous?.positionStatus==='ok'?previous.checkedAt:null),scope:'Turni verificati nei PDF pubblicati dall’Ordine. Nessuna apertura in tempo reale o modalità su chiamata dedotta.',license:'Nessuna licenza aperta dichiarata per i PDF. Indice fattuale derivato con attribuzione; originali non ripubblicati.',positionLicense:'OpenStreetMap contributors · ODbL 1.0',positionLicenseUrl:'https://www.openstreetmap.org/copyright',farmamiaUrl:'https://farmamiaverona.it/',periods};
    report.coverage=pharmacyCoverage(data,now,previous);
    const known=new Map((previous?.periods||[]).flatMap(period=>period.items).map(item=>[item.id,item]));
    for(const period of periods)for(const item of period.items){const old=known.get(item.id);item.position=old?.address===item.address&&old?.city===item.city?structuredClone(old.position||null):null;}
    const refreshPositions=!data.positionsCheckedAt||Date.parse(now)-Date.parse(data.positionsCheckedAt)>=7*86400000||periods.some(period=>period.items.some(item=>!known.has(item.id)));
    if(loadPositions&&refreshPositions){try{const osm=await loadPositions();if(!Array.isArray(osm.elements)||!osm.elements.length||osm.remark)throw Error('Risposta OSM incompleta');for(const period of periods)for(const item of period.items)item.position=null;attachPharmacyPositions(periods,osm,now);data.positionStatus='ok';data.positionsCheckedAt=now;}catch(error){data.positionStatus='cached';report.warnings.push('Coordinate non aggiornate; conservati i punti già associati. '+error.message);}}
    else data.positionStatus=periods.some(period=>period.items.some(item=>item.position))?'cached':'unavailable';
    validatePharmacies(data);
    if(report.coverage.remainingHours<72)report.warnings.push('Copertura in esaurimento: restano meno di 72 ore di turni pubblicati.');
    report.status='ok';report.preservedPrevious=false;report.positionStatus=data.positionStatus;return {data,report};
  }catch(error){report.error=error.message;return {data:null,report};}
}
