import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {collectCalibrationDay,probeStop} from './bus-stop-extraction.mjs';

const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--verify'))throw new Error('Uso: node scripts/collect-santini-day.mjs [--verify]');
const verify=args.includes('--verify');
const previous=verify?JSON.parse(await readFile(new URL('../research/santini-day/report.json',import.meta.url),'utf8')):null;
await mkdir(new URL('../research/santini-day/',import.meta.url),{recursive:true});
let sequence=0;
const report=await collectCalibrationDay({windowHours:verify?4:8,request:async options=>{
  if(sequence)await new Promise(resolve=>setTimeout(resolve,1500));
  sequence++;
  return probeStop({...options,fetcher:async(...args)=>{
    const response=await fetch(...args);
    if(response.ok)await writeFile(new URL(`../research/santini-day/${verify?'verify-':''}response-${sequence}.json`,import.meta.url),JSON.stringify(await response.clone().json(),null,2)+'\n');
    return response;
  }});
}});
if(previous){
  const key=d=>`${d.stopCode}|${d.line}|${d.tripId}|${d.destination}|${d.instant}`;
  const a=new Set(previous.departures.map(key)),b=new Set(report.departures.map(key));
  report.comparison={previousCount:a.size,currentCount:b.size,missing:[...a].filter(k=>!b.has(k)),additional:[...b].filter(k=>!a.has(k))};
  if(report.comparison.missing.length||report.comparison.additional.length){report.status='incomplete';report.coverageIssues.push('Le due scansioni non coincidono');}
}
const reportName=report.status==='incomplete'?'failed-attempt':verify?'verification-4h':'report';
await writeFile(new URL(`../research/santini-day/${reportName}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,complete:report.complete,requests:report.requests,count:report.departureCount,issues:report.coverageIssues,missing:report.missingReferenceTimes,windows:report.windows.map(w=>({from:w.from,to:w.to,count:w.count})),departures:report.departures.map(d=>({time:d.time,line:d.line,trip:d.tripId}))},null,2));
if(report.status==='incomplete')process.exitCode=2;
