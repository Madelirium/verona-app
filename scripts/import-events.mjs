import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {collectEvents} from './event-sync.mjs';

export async function importEvents() {
  await mkdir('data',{recursive:true});let previous={events:[]};
  try{previous=JSON.parse(await readFile('data/events.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const data=await collectEvents({previous,from:process.env.EVENTS_FROM});
  // Catalogo e stato delle fonti vengono sostituiti insieme.
  await writeFile('data/events.json.tmp',JSON.stringify(data,null,2)+'\n');
  await rename('data/events.json.tmp','data/events.json');
  await writeFile('data/import-report.json.tmp',JSON.stringify(data.importReport,null,2)+'\n');
  await rename('data/import-report.json.tmp','data/import-report.json');
  console.log(JSON.stringify(data.importReport,null,2));return data.importReport;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scripts/import-events.mjs')) {
  const report=await importEvents();if(report.status!=='ok')process.exitCode=1;
}
