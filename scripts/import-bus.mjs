import {readFile,writeFile,rename} from 'node:fs/promises';
import {collectBus} from './bus-sync.mjs';
import {buildCalendar} from './build-calendar.mjs';
const root=new URL('../',import.meta.url);
let previous={lines:[],alerts:[],sources:[]};try{previous=JSON.parse(await readFile(new URL('data/bus.json',root),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const data=await collectBus({previous});
await writeFile(new URL('data/bus.json.tmp',root),JSON.stringify(data,null,2)+'\n');await rename(new URL('data/bus.json.tmp',root),new URL('data/bus.json',root));
const report={checkedAt:data.checkedAt,status:data.status,sources:data.sources};
await writeFile(new URL('data/bus-import-report.json.tmp',root),JSON.stringify(report,null,2)+'\n');await rename(new URL('data/bus-import-report.json.tmp',root),new URL('data/bus-import-report.json',root));
await buildCalendar();console.log(JSON.stringify(report,null,2));
if(data.status==='error'||(data.status==='partial'&&!process.argv.includes('--allow-partial')))process.exitCode=1;
