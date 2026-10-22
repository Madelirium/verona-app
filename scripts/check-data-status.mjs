import {readFile,appendFile} from 'node:fs/promises';
import {datasetStatus} from './data-status.mjs';
import {pharmacyCoverage} from './pharmacy-refresh.mjs';
const root=new URL('../data/',import.meta.url);
const specs=[['Eventi','events.json',{maxAgeHours:48}],['Notizie','news.json',{maxAgeHours:48}],['Orari ATV','bus-official.json',{calendar:true}],['Luoghi','places.json',{}],['Parcheggi','parking.json',{}]];
const rows=[];
for(const [name,file,options] of specs){
  const data=JSON.parse(await readFile(new URL(file,root),'utf8'));
  if(file==='events.json')data.sources=JSON.parse(await readFile(new URL('import-report.json',root),'utf8')).sources;
  const status=datasetStatus(data,options),warning=!['current','snapshot'].includes(status.state);
  console.log((process.env.GITHUB_ACTIONS&&warning?'::warning::':'')+name+': '+status.message);
  rows.push('| '+name+' | '+status.state+' | '+status.message+' |');
}
const pharmacies=JSON.parse(await readFile(new URL('pharmacies.json',root),'utf8'));
try{const coverage=pharmacyCoverage(pharmacies,new Date().toISOString()),warning=coverage.remainingHours<72,message='Turni validi fino al '+coverage.endsAt+(warning?' · nuovi periodi attesi':''),state=warning?'ending':'current';console.log((process.env.GITHUB_ACTIONS&&warning?'::warning::':'')+'Farmacie: '+message);rows.push('| Farmacie | '+state+' | '+message+' |');}
catch(error){console.log((process.env.GITHUB_ACTIONS?'::warning::':'')+'Farmacie: '+error.message+'; nell’app restano i collegamenti ufficiali.');rows.push('| Farmacie | unavailable | Nessun turno valido per il momento corrente; collegamenti ufficiali disponibili. |');}
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'\n### Validità dei dati pubblicati\n\n| Catalogo | Stato | Dettaglio |\n| --- | --- | --- |\n'+rows.join('\n')+'\n');
