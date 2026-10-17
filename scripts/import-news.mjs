import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {newsSources,parseNews,mergeNews} from './news.mjs';
import {romeDay} from './parsers.mjs';
import {buildCalendar} from './build-calendar.mjs';
const root=new URL('../',import.meta.url),checkedAt=new Date().toISOString(),to=romeDay();
const from=new Date(Date.parse(to+'T12:00:00Z')-90*86400000).toISOString().slice(0,10);
await mkdir(new URL('data/',root),{recursive:true});
let previous={items:[]};
try{previous=JSON.parse(await readFile(new URL('data/news.json',root),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const report={checkedAt,from,to,scope:'Prime due pagine per fonte, pubblicazioni negli ultimi 90 giorni. Non è un archivio completo.',sources:[]};
let items=[];
for(const source of newsSources){
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
    items.push(...imported);report.sources.push({source:source.key,status:'ok',count:imported.length});
  }catch(error){const retained=previous.items.filter(i=>i.sourceKey===source.key);items.push(...retained);report.sources.push({source:source.key,status:'error',error:error.message,retained:retained.length});process.exitCode=1;}
}
const data={updatedAt:checkedAt,scope:report.scope,items:mergeNews(items),sources:report.sources};
await writeFile(new URL('data/news.json.tmp',root),JSON.stringify(data,null,2)+'\n');
await rename(new URL('data/news.json.tmp',root),new URL('data/news.json',root));
await writeFile(new URL('data/news-import-report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
await buildCalendar();
