// Editorial classification from links in the official ATV suburban directory.
// Timetables continue to come exclusively from the imported official archive.
import {readFile,writeFile} from 'node:fs/promises';
const source='https://www.atv.verona.it/orari_linee_bus_extraurbani';
const response=await fetch(source);if(!response.ok)throw Error('ATV: HTTP '+response.status);
const html=await response.text();
const urls=[...new Set([...html.matchAll(/href=['"](http:\/\/tech\.atv\.verona\.it\/atv_www\/orari_extraurb\/orari\/atv_localita_[A-Z]\.html)['"]/g)].map(match=>match[1]))];
if(urls.length<20)throw Error('Indice località ATV non riconosciuto');
const references=new Map(),missingPages=[];let cursor=0;
await Promise.all(Array.from({length:3},async()=>{while(cursor<urls.length){const url=urls[cursor++],result=await fetch(url,{signal:AbortSignal.timeout(20000)});if(result.status===404){missingPages.push(url);continue;}if(!result.ok)throw Error(url+': HTTP '+result.status);const text=new TextDecoder('windows-1252').decode(await result.arrayBuffer());
  for(const match of text.matchAll(/<a\b[^>]*href=["'][^"']*\/pdf\/([A-Za-z0-9]+)\.pdf["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const number=match[2].replace(/<[^>]*>/g,'').trim().toUpperCase();if(!number||number!==match[1].toUpperCase())continue;
    if(!references.has(number))references.set(number,new Set());references.get(number).add(url);
  }
}}));
const official=JSON.parse(await readFile(new URL('../data/bus-official.json',import.meta.url),'utf8'));
const sheets=JSON.parse(await readFile(new URL('../data/bus.json',import.meta.url),'utf8'));
const urban=new Set(sheets.lines.filter(line=>['urban','evening','holiday'].includes(line.service)).map(line=>line.number));
const lines={};for(const line of official.lines)if(references.has(line.number)&&!urban.has(line.number))lines[line.number]={category:'extraurban',sources:[...references.get(line.number)].sort()};
if(Object.keys(lines).length<50)throw Error('Copertura extraurbana inattesa: nessun aggiornamento salvato');
const data={source,checkedAt:new Date().toISOString(),missingPages:missingPages.sort(),method:'Explicit numbered timetable links in the official suburban destination directory; intersected with the imported NeTEx lines. Lines also appearing in the imported urban sheets retain their urban classification. Missing directory pages are reported; unmatched lines remain unclassified.',lines};
await writeFile(new URL('../data/bus-categories.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log('Classificate '+Object.keys(lines).length+' linee extraurbane su '+official.lines.length+' linee importate; '+(urls.length-missingPages.length)+' indici ATV letti, '+missingPages.length+' non disponibili.');
