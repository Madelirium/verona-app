import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {inventoryStops,probeStop,calibration,stopEndpoint} from './bus-stop-extraction.mjs';

const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--probe')) throw new Error('Uso: node scripts/inspect-bus-stop-source.mjs [--probe]');
const inventory=inventoryStops(JSON.parse(await readFile(new URL('../data/bus-routes.json',import.meta.url),'utf8')));
const report={checkedAt:new Date().toISOString(),source:stopEndpoint,complete:false,inventory,calibration:{...calibration,result:args.includes('--probe')?await probeStop():{status:'not-run'}}};
await mkdir(new URL('../research/',import.meta.url),{recursive:true});
await writeFile(new URL('../research/bus-stop-extraction-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,inventory:{...inventory,stops:undefined}},null,2));
if(report.calibration.result.status==='blocked') process.exitCode=2;
