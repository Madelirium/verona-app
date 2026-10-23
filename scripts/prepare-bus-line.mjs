import {readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildLinePlan} from './bus-line-plan.mjs';
import {atomicJSON} from './bus-bot-storage.mjs';

const args=process.argv.slice(2);
if(args.some(arg=>!/^--(?:from=\d{4}-\d{2}-\d{2}|line=\d+)$/.test(arg)))throw new Error('Uso: node scripts/prepare-bus-line.mjs --line=24 --from=2026-10-19');
const line=args.find(a=>a.startsWith('--line='))?.slice(7)??'24',from=args.find(a=>a.startsWith('--from='))?.slice(7)??'2026-10-19';
const catalog=JSON.parse(await readFile(new URL('../data/bus-routes.json',import.meta.url),'utf8'));
const root=new URL('../.local/atv-bot/trips-v1/',import.meta.url);
const entries=[];
for(const name of(await readdir(root)).filter(name=>name.endsWith('.json')))entries.push(JSON.parse(await readFile(new URL(name,root),'utf8')));
const plan=buildLinePlan({catalog,entries,line,from});
const path=fileURLToPath(new URL(`../data/bus-line-${line}-plan.json`,import.meta.url));
await atomicJSON(path,plan);
console.log(JSON.stringify({path,...plan.summary,dates:plan.dates},null,2));
