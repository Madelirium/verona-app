import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {collectStopDay,requestStopWindow,compareStopDays,romeDayBounds,calibration} from './bus-stop-extraction.mjs';
import {withJobLock,checkpoint,cachedPublicFetcher,atomicJSON,runIdPattern} from './bus-bot-storage.mjs';

// Explicit one-stop/date operation. No bulk mode and no frontend data writes.
const args=process.argv.slice(2);
if(args.some(arg=>!/^--(?:stop=\d+|date=\d{4}-\d{2}-\d{2}|verify|resume=[\dTZ.\-]+)$/.test(arg)))throw new Error('Uso: node scripts/collect-bus-stop-day.mjs --stop=1974 --date=2026-10-25 [--verify] [--resume=ID]');
if(new Set(args.map(arg=>arg.split('=')[0])).size!==args.length)throw new Error('Opzioni duplicate');
const stopCode=args.find(arg=>arg.startsWith('--stop='))?.slice(7);
const date=args.find(arg=>arg.startsWith('--date='))?.slice(7);
if(!stopCode||!date)throw new Error('Specificare --stop e --date');
romeDayBounds(date);
const resume=args.find(arg=>arg.startsWith('--resume='))?.slice(9);
if(resume&&!runIdPattern.test(resume))throw new Error('Identificativo esecuzione non valido');
const runId=resume??new Date().toISOString().replaceAll(':','-');
const root=new URL(`../research/stop-days/${stopCode}/${date}/${runId}/`,import.meta.url);
await mkdir(root,{recursive:true});
await withJobLock(fileURLToPath(root),async()=>{
const job=await checkpoint(fileURLToPath(root),{version:2,stopCode,date,verify:args.includes('--verify')},{resume:!!resume});
console.log(JSON.stringify({runId,resume:!!resume}));
let sequence=0;
let phase='baseline';
const fetchers=new Map();
const rateState={lastRequest:0};
async function request(options){
  sequence++;
  if(!fetchers.has(phase))fetchers.set(phase,cachedPublicFetcher(join(fileURLToPath(root),'cache',phase),{rateState}));
  const result=await requestStopWindow({...options,fetcher:fetchers.get(phase)});
  console.log(JSON.stringify({phase,from:options.from,to:options.to,httpStatus:result.httpStatus,count:result.count}));
  return result;
}
const reference=stopCode===calibration.stopCode&&date===calibration.date?calibration:null;
async function scan(name,windowHours){
  phase=name;
  if(job.state.completed[name])return job.state.completed[name];
  const report=await collectStopDay({stopCode,date,reference,request,windowHours});
  await atomicJSON(fileURLToPath(new URL(name+'.json',root)),report);
  if(report.status==='ready-for-ui-comparison')await job.put(name,report);
  return report;
}
const baseline=await scan('baseline',8);
let verification=null,confirmation=null,comparison=null,initialComparison=null;
if(args.includes('--verify')&&baseline.status==='ready-for-ui-comparison'){
  phase='verification';
  verification=await scan('verification',4);
  comparison=compareStopDays(baseline,verification);
  if(!comparison.consistent && verification.status==='ready-for-ui-comparison'){
    initialComparison=comparison;
    phase='confirmation';
    confirmation=await scan('confirmation',2);
    comparison=compareStopDays(verification,confirmation);
  }
}
const latest=confirmation??verification??baseline;
const issues=[...baseline.coverageIssues,...(verification?.coverageIssues ?? []),...(confirmation?.coverageIssues ?? [])];
if(comparison?.consistent===false)issues.push('Le ultime due scansioni non coincidono');
const status=issues.length?'incomplete':comparison?.consistent?'repeatable':'awaiting-second-scan';
const summary={checkedAt:new Date().toISOString(),source:'ATV / myCicero',stopCode,date,dayHours:baseline.dayHours,complete:false,status,stop:baseline.windows.find(w=>w.stop)?.stop ?? null,requests:sequence,departureCount:latest.departureCount,lines:[...new Set(latest.departures.map(d=>d.line))],first:latest.departures.at(0)?.time ?? null,last:latest.departures.at(-1)?.time ?? null,comparison,initialComparison,issues,reportDirectory:root.pathname};
summary.runId=runId;summary.resumed=!!resume;
summary.networkRequests=[...fetchers.values()].reduce((n,f)=>n+f.stats.network,0);
summary.cacheHits=[...fetchers.values()].reduce((n,f)=>n+f.stats.hits,0);
await atomicJSON(fileURLToPath(new URL('summary.json',root)),summary);
const quote=value=>'"'+String(value ?? '').replaceAll('"','""')+'"';
await writeFile(new URL('departures.csv',root),'date,stop,line,time,trip,destination,realTime\n'+latest.departures.map(d=>[d.date,d.stopCode,d.line,d.time,d.tripId,d.destination,d.realTime].map(quote).join(',')).join('\n')+'\n');
console.log(JSON.stringify(summary,null,2));
if(status==='incomplete')process.exitCode=2;
});
