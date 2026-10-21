import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {newsSources,parseNews,mergeNews,newsCollectionState} from './news.mjs';
import {romeDay} from './parsers.mjs';
import {buildCalendar} from './build-calendar.mjs';
import {attachNewsImages} from './news-images.mjs';
const root=new URL('../',import.meta.url),checkedAt=new Date().toISOString(),to=romeDay();
const from=new Date(Date.parse(to+'T12:00:00Z')-90*86400000).toISOString().slice(0,10);
await mkdir(new URL('data/',root),{recursive:true});
let previous={items:[]};
try{previous=JSON.parse(await readFile(new URL('data/news.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const report={checkedAt,from,to,scope:'Prime due pagine per fonte, pubblicazioni negli ultimi 90 giorni. Non è un archivio completo.',sources:[]};
let items=[];
const resources=new Map();
function loadResource(id){
  if(!resources.has(id))resources.set(id,(async()=>{
    await new Promise(resolve=>setTimeout(resolve,150));
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch('https://www.comune.verona.it/api/opendata/v2/content/read/'+id,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaLocal/0.2 (+https://github.com/Madelirium/verona-app)'}});
        if(!response.ok){if(attempt===0&&(response.status===429||response.status>=500)){await new Promise(resolve=>setTimeout(resolve,1000));continue;}throw Error('HTTP '+response.status);}
        return await response.json();
      }catch(error){if(attempt||/^HTTP 4/.test(error.message))throw error;await new Promise(resolve=>setTimeout(resolve,1000));}
    }
  })());
  return resources.get(id);
}
for(const source of newsSources){
  const lastSuccessAt=previous.sources?.find(s=>s.source===source.key)?.lastSuccessAt||previous.items.filter(i=>i.sourceKey===source.key).map(i=>i.checkedAt).filter(Boolean).sort().at(-1)||null;
  try{
    let imported=[];
    for(const offset of [0,24]){
      const url=source.url+(offset?`/(offset)/${offset}`:'');
      const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'VeronaLocalPrototype/0.1 (local development)'}});
      if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
      const html=await response.text();
      imported.push(...parseNews(html,source,{checkedAt,from,to}));
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    imported=mergeNews(imported);
    if(!imported.length)throw new Error('Nessuna pubblicazione recente: mantenuti i dati precedenti');
    imported=await attachNewsImages(imported,loadResource,{onError:(id,error)=>console.warn('Immagine notizia '+id+' non disponibile: '+error.message)});
    items.push(...imported);report.sources.push({source:source.key,status:'ok',count:imported.length,lastSuccessAt:checkedAt});
  }catch(error){const retained=previous.items.filter(i=>i.sourceKey===source.key);items.push(...retained);report.sources.push({source:source.key,status:'error',error:error.message,retained:retained.length,lastSuccessAt});}
}
const state=newsCollectionState(report.sources,checkedAt,previous.updatedAt||null);
report.status=state.status;
if(state.status==='error'||(state.status==='partial'&&!process.argv.includes('--allow-partial')))process.exitCode=1;
const data={...state,checkedAt,scope:report.scope,items:mergeNews(items),sources:report.sources};
await writeFile(new URL('data/news.json.tmp',root),JSON.stringify(data,null,2)+'\n');
await rename(new URL('data/news.json.tmp',root),new URL('data/news.json',root));
await writeFile(new URL('data/news-import-report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
await buildCalendar();
