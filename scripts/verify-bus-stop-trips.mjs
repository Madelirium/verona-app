import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {requestTripDetail} from './bus-stop-extraction.mjs';
import {withJobLock,checkpoint,cachedPublicFetcher,atomicJSON,runIdPattern,digest,readJSON} from './bus-bot-storage.mjs';

const args=process.argv.slice(2);
if(!args[0]||args.slice(1).some(arg=>!/^--(?:resume=[\dTZ.\-]+|fresh)$/.test(arg))||new Set(args.slice(1).map(arg=>arg.split('=')[0])).size!==args.length-1)throw new Error('Uso: node scripts/verify-bus-stop-trips.mjs manifest.json [--resume=ID | --fresh]');
const resume=args.find(arg=>arg.startsWith('--resume='))?.slice(9);
const fresh=args.includes('--fresh');
if(resume&&(!runIdPattern.test(resume)||fresh))throw new Error('Ripresa non valida o incompatibile con --fresh');
const manifest=JSON.parse(await readFile(args[0],'utf8'));
if(!Array.isArray(manifest)||!manifest.length||manifest.length>150)throw new Error('Manifest da 1 a 150 passaggi');
const runId=resume??new Date().toISOString().replaceAll(':','-');
const root=new URL(`../research/trip-check/${runId}/`,import.meta.url);
await mkdir(root,{recursive:true});
await withJobLock(fileURLToPath(root),async()=>{
const effectiveFresh=resume?(await readJSON(fileURLToPath(new URL('checkpoint.json',root))))?.identity.fresh:fresh;
const job=await checkpoint(fileURLToPath(root),{version:2,manifestHash:digest(manifest),fresh:effectiveFresh},{resume:!!resume});
const fetcher=cachedPublicFetcher(fileURLToPath(new URL('../.local/atv-bot/trips-v1/',import.meta.url)),{refresh:effectiveFresh,freshSince:job.state.createdAt});
console.log(JSON.stringify({runId,resume:!!resume,fresh}));
const results=[];
let checkpointHits=0;
for(const [index,item] of manifest.entries()){
  if(job.state.completed[index]){results.push(job.state.completed[index]);checkpointHits++;continue;}
  let result;
  try{
    result=await requestTripDetail({...item,fetcher});
  }catch(error){result={status:'request-error',message:error.message};}
  results.push({expected:item.expected,...result});
  if(result.status==='matched')await job.put(index,results.at(-1));
  await atomicJSON(fileURLToPath(new URL('progress.json',root)),{checkedAt:new Date().toISOString(),planned:manifest.length,results});
  if((index+1)%10===0 || result.status!=='matched')console.log(JSON.stringify({checked:index+1,planned:manifest.length,matched:results.filter(r=>r.status==='matched').length,lastStatus:result.status}));
  if(result.httpStatus!==200)break;
}
const summary={checkedAt:new Date().toISOString(),method:'Confronto elenco fermata / dettaglio corsa ufficiale',complete:false,networkCoverageCertified:false,planned:manifest.length,checked:results.length,matched:results.filter(r=>r.status==='matched').length,results};
summary.runId=runId;summary.networkRequests=fetcher.stats.network;summary.cacheHits=fetcher.stats.hits;summary.resumed=!!resume;
summary.checkpointHits=checkpointHits;
await atomicJSON(fileURLToPath(new URL('report.json',root)),summary);
console.log(JSON.stringify({directory:root.pathname,planned:summary.planned,checked:summary.checked,matched:summary.matched}));
if(summary.matched!==summary.planned)process.exitCode=2;
});
