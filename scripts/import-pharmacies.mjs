import {readFile,writeFile,mkdir,rename,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {refreshPharmacies} from './pharmacy-refresh.mjs';
import {romeDay} from './parsers.mjs';
const root=new URL('../',import.meta.url),now=new Date().toISOString(),day=process.argv.find(arg=>arg.startsWith('--from='))?.slice(7)||romeDay(new Date(now));
let previous=null;try{previous=JSON.parse(await readFile(new URL('data/pharmacies.json',root),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(new URL('.local/pharmacies/',root),{recursive:true});
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(40000),headers:{'User-Agent':'VeronaLocalApp/0.1 (official pharmacy duty calendar reader)'}});if(!response.ok)throw Error('HTTP '+response.status+' dalla fonte '+new URL(url).hostname);return response;}
const result=await refreshPharmacies({now,day,previous,
  fetchPage:async()=>await (await get('https://www.ordinefarmacisti.vr.it/turni-farmacie/')).text(),
  fetchPdf:async url=>Buffer.from(await (await get(url)).arrayBuffer()),
  extractPdf:async(bytes,sha256)=>{
    const path=new URL('.local/pharmacies/'+sha256+'.pdf',root);await writeFile(path,bytes);
    try{return JSON.parse(execFileSync(process.env.PHARMACY_PYTHON||'python3',[fileURLToPath(new URL('extract-pharmacy-pdf.py',import.meta.url)),fileURLToPath(path)],{encoding:'utf8',maxBuffer:5e6,timeout:30000,windowsHide:true}));}
    catch(error){throw Error('Lettore PDF non disponibile o estrazione fallita ('+(error.code||error.status||'formato non riconosciuto')+').');}
  },
  loadPositions:async()=>{const query='[out:json][timeout:30];nwr["amenity"="pharmacy"](45.0,10.4,46.0,11.7);out center tags;';return await (await get('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query))).json();}
});
async function atomicWrite(file,value){const target=new URL(file,root);await writeFile(new URL(file+'.tmp',root),JSON.stringify(value,null,2)+'\n');await rename(new URL(file+'.tmp',root),target);}
if(result.data)await atomicWrite('data/pharmacies.json',result.data);
await atomicWrite('data/pharmacy-import-report.json',result.report);
for(const warning of result.report.warnings)console.warn((process.env.GITHUB_ACTIONS?'::warning::':'')+warning);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'\n### Aggiornamento farmacie\n\nEsito: '+result.report.status+'. '+(result.report.coverage?'Copertura fino al '+result.report.coverage.endsAt+'.':'Dati precedenti conservati.')+'\n');
if(!result.data){console.error(result.report.error);process.exitCode=1;}
else console.log('Farmacie: '+result.data.periods.length+' periodi verificati, '+result.report.items.filter(item=>item.extraction==='parsed').length+' PDF estratti, copertura fino al '+result.report.coverage.endsAt+'.');

