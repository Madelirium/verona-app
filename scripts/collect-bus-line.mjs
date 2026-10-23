import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {atomicJSON,cachedPublicFetcher,checkpoint,digest,readJSON,runIdPattern,withJobLock} from './bus-bot-storage.mjs';
import {collectStopDay,requestStopWindow,requestTripDetail,calibration} from './bus-stop-extraction.mjs';
import {collectLineStopDay} from './bus-line-batch.mjs';

const args=process.argv.slice(2);
if(args.some(arg=>!/^--(?:line=\d+|max-requests=\d+|resume=[\dTZ.\-]+)$/.test(arg))||new Set(args.map(a=>a.split('=')[0])).size!==args.length)throw new Error('Uso: node scripts/collect-bus-line.mjs --line=24 --max-requests=60 [--resume=ID]');
const line=args.find(a=>a.startsWith('--line='))?.slice(7)??'24';
const maxRequests=Number(args.find(a=>a.startsWith('--max-requests='))?.slice(15)??60);
const resume=args.find(a=>a.startsWith('--resume='))?.slice(9);
if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>200)throw new Error('Budget da 1 a 200 richieste per avvio');
if(resume&&!runIdPattern.test(resume))throw new Error('Identificativo ripresa non valido');
const plan=JSON.parse(await readFile(new URL(`../data/bus-line-${line}-plan.json`,import.meta.url),'utf8'));
if(plan.line!==line||plan.schemaVersion!==1||!Array.isArray(plan.jobs)||plan.jobs.some(j=>!/^\d+$/.test(j.stopCode)||!plan.dates.includes(j.date)))throw new Error('Piano non valido');
const runId=resume??new Date().toISOString().replaceAll(':','-');
const root=fileURLToPath(new URL(`../research/line-batch/${line}/${runId}/`,import.meta.url));
await mkdir(root,{recursive:true});
await withJobLock(root,async()=>{
  const job=await checkpoint(root,{version:1,line,planHash:digest(plan)},{resume:!!resume});
  if(!resume)await atomicJSON(join(root,'plan.json'),plan);
  console.log(JSON.stringify({runId,line,plannedStopDays:plan.jobs.length,maxRequests,resume:!!resume}));
  let networkRequests=0,budgetExhausted=false;
  const limitedFetch=async(...params)=>{if(networkRequests>=maxRequests){budgetExhausted=true;throw new Error('Budget rete esaurito');}networkRequests++;return fetch(...params);};
  const rateState={lastRequest:0},allFetchers=[];
  const tripFetcher=cachedPublicFetcher(fileURLToPath(new URL('../.local/atv-bot/trips-v1/',import.meta.url)),{fetcher:limitedFetch,rateState});allFetchers.push(tripFetcher);
  let last=null;
  for(const [index,item]of plan.jobs.entries()){
    const key=item.date+'_'+item.stopCode,jobKey='job:'+key;
    if(job.state.completed[jobKey])continue;
    const folder=join(root,'jobs',key);
    const result=await collectLineStopDay({line,
      scan:async(phase,windowHours)=>{
        const phaseKey=key+':'+phase,path=join(folder,phase+'.json');
        if(job.state.completed[phaseKey]){
          const existing=await readJSON(path);
          if(digest(existing)!==job.state.completed[phaseKey].hash)throw new Error('Rapporto fase non integro');
          return existing;
        }
        const fetcher=cachedPublicFetcher(join(folder,'cache',phase),{fetcher:limitedFetch,rateState});allFetchers.push(fetcher);
        const reference=item.stopCode===calibration.stopCode&&item.date===calibration.date?calibration:null;
        const report=await collectStopDay({...item,windowHours,reference,request:async options=>{
          const response=await requestStopWindow({...options,fetcher});
          for(let i=0;i<(response.departures?.length??0);i++){
            const expected=response.departures[i];
            if(expected.realTime!==true)continue;
            const detail=await requestTripDetail({expected,terminalCode:expected.terminalCode,fetcher:tripFetcher,includeScheduled:true});
            if(detail.httpStatus!==200||detail.scheduled?.status!=='scheduled')throw new Error('Orario programmato della corsa live non verificato');
            response.departures[i]=detail.scheduled.departure;
          }
          return response;
        }});
        await atomicJSON(path,report);
        // Never freeze a network failure as a completed scan.
        if(report.coverageIssues.every(issue=>issue==='Nessun passaggio: assenza di servizio da verificare'||issue==='Campione del portale non riprodotto'))await job.put(phaseKey,{hash:digest(report)});
        return report;
      },
      verify:expected=>requestTripDetail({expected,terminalCode:expected.terminalCode,fetcher:tripFetcher})
    });
    last={...item,status:result.status,halt:result.halt};
    await atomicJSON(join(folder,'report.json'),{...item,...result,checkedAt:new Date().toISOString()});
    console.log(JSON.stringify({job:index+1,total:plan.jobs.length,...last,networkRequests}));
    if(result.halt)break;
    await job.put(jobKey,{status:result.status,departures:result.departures?.length??0,checks:result.checks?.filter(c=>c.status==='matched').length??0});
    if(networkRequests>=maxRequests)break;
  }
  const completed=Object.entries(job.state.completed).filter(([key])=>key.startsWith('job:'));
  const statuses={};for(const [,value]of completed)statuses[value.status]=(statuses[value.status]??0)+1;
  const summary={checkedAt:new Date().toISOString(),runId,line,dates:plan.dates,complete:false,plannedStopDays:plan.jobs.length,finishedObservations:completed.length,remainingStopDays:plan.jobs.length-completed.length,statuses,networkRequests,networkBudget:maxRequests,budgetExhausted,cacheHits:allFetchers.reduce((n,f)=>n+f.stats.hits,0),last,status:last?.halt&&!budgetExhausted?'source-error':completed.length===plan.jobs.length?'observations-finished':'paused-with-checkpoint',reportDirectory:root};
  await atomicJSON(join(root,'summary.json'),summary);console.log(JSON.stringify(summary,null,2));
  if(last?.halt&&!budgetExhausted)process.exitCode=2;
});
