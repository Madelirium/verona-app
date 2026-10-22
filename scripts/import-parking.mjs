import {readFile,writeFile,rename} from 'node:fs/promises';
import {parkingCsv,parkingSnapshot} from './parking.mjs';
import {buildCalendar} from './build-calendar.mjs';
const target=new URL('../data/parking.json',import.meta.url),temporary=new URL('../data/parking.json.tmp',import.meta.url),checkedAt=new Date().toISOString();
let previous;try{previous=JSON.parse(await readFile(target,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
try{
  const response=await fetch(parkingCsv,{headers:{'User-Agent':'VeronaApp/1.0 (Comune open-data parking catalogue)'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('CSV parcheggi HTTP '+response.status);
  const text=await response.text();if(text.length>2000000)throw Error('CSV parcheggi troppo grande');
  const data=parkingSnapshot(text,previous,checkedAt);
  await writeFile(temporary,JSON.stringify(data,null,2)+'\n');await rename(temporary,target);
  console.log('Parcheggi importati: '+data.items.length);
}catch(error){
  if(previous){await writeFile(temporary,JSON.stringify({...previous,status:'error',lastAttemptAt:checkedAt,error:error.message},null,2)+'\n');await rename(temporary,target);}
  console.error('Parcheggi: '+error.message);process.exitCode=1;
}
await buildCalendar();
