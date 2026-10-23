import {readFile} from 'node:fs/promises';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requestTripDetail} from './bus-stop-extraction.mjs';
import {importPublicResponse,digest} from './bus-bot-storage.mjs';

const args=process.argv.slice(2);
if(args.length!==2)throw new Error('Uso: node scripts/import-bus-trip-cache.mjs manifest.json rapporto-precedente.json');
const manifest=JSON.parse(await readFile(args[0],'utf8')),report=JSON.parse(await readFile(args[1],'utf8'));
if(!Array.isArray(manifest)||!Array.isArray(report.results)||manifest.length!==report.results.length)throw new Error('Manifest e rapporto non corrispondono');
const root=fileURLToPath(new URL('../.local/atv-bot/trips-v1/',import.meta.url));
let imported=0;
for(const [index,item]of manifest.entries()){
  const previous=report.results[index];
  if(previous.status!=='matched'||digest(previous.expected)!==digest(item.expected))throw new Error('Passaggio precedente non verificato: '+index);
  const path=join(dirname(args[1]),`response-${index+1}.json`),data=JSON.parse(await readFile(path,'utf8'));
  let request;
  const result=await requestTripDetail({...item,fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify(data),{status:200});}});
  if(result.status!=='matched')throw new Error('Risposta originale discordante: '+index);
  const saved=await importPublicResponse(root,request.url,request.options,data,{collectedAt:report.checkedAt,source:{path:relative(process.cwd(),path),hash:digest(data)}});
  if(saved)imported++;
}
console.log(JSON.stringify({checked:manifest.length,imported,networkRequests:0}));
