import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url),collectedAt=new Date().toISOString();
const {lines}=JSON.parse(await readFile(new URL('data/bus.json',root),'utf8'));
let previous={items:[]};try{previous=JSON.parse(await readFile(new URL('data/bus-timetable-snapshots.json',root),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(new URL('.local/atv-timetables/',root),{recursive:true});
const items=[];
for(const line of lines){
  try{
    const url=new URL(line.timetableUrl);if(url.origin!=='https://www.atv.verona.it')throw Error('Fonte PDF inattesa');
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);
    if(Number(response.headers.get('content-length'))>10*1024*1024)throw Error('PDF troppo grande: verifica manuale');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>10*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Risposta PDF non valida');
    const sha256=createHash('sha256').update(bytes).digest('hex'),snapshotFile=`.local/atv-timetables/${sha256}.pdf`;
    await writeFile(new URL(snapshotFile+'.tmp',root),bytes);await rename(new URL(snapshotFile+'.tmp',root),new URL(snapshotFile,root));
    items.push({lineId:line.id,number:line.number,service:line.service,sourceUrl:line.timetableUrl,status:'ok',downloadedAt:new Date().toISOString(),snapshotFile,sha256,bytes:bytes.length});
    console.log(`${line.id}: PDF conservato (${bytes.length} byte)`);
  }catch(error){
    const old=previous.items.find(item=>item.lineId===line.id);
    items.push({...old,lineId:line.id,number:line.number,service:line.service,sourceUrl:line.timetableUrl,status:'error',error:error.message});
    console.error(`${line.id}: ${error.message}`);process.exitCode=1;
  }
  await new Promise(resolve=>setTimeout(resolve,700));
}
const succeeded=items.filter(item=>item.status==='ok').length;
const report={collectedAt,status:succeeded===items.length?'ok':succeeded?'partial':'error',scope:'Schede urbane presenti nel catalogo locale; non include tutte le linee extraurbane ATV.',items};
await writeFile(new URL('data/bus-timetable-snapshots.json.tmp',root),JSON.stringify(report,null,2)+'\n');
await rename(new URL('data/bus-timetable-snapshots.json.tmp',root),new URL('data/bus-timetable-snapshots.json',root));
console.log(`PDF raccolti: ${items.filter(item=>item.status==='ok').length}/${items.length}. Nessuna tabella oraria ancora pubblicata come dati.`);
