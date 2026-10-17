import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { sources, parseComune, parseFiere, romeDay, dedupe } from './parsers.mjs';

const from = process.env.EVENTS_FROM || romeDay();
if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || new Date(from).toISOString().slice(0,10) !== from) throw new Error('EVENTS_FROM non valida');
const checkedAt = new Date().toISOString();
const report = { checkedAt, from, sources: [] };
await mkdir('data', { recursive: true });
let previous = { events: [] };
try { previous = JSON.parse(await readFile('data/events.json', 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'VeronaEventsPrototype/0.1 (local development)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r;
}
async function comune() {
  let url = 'https://www.comune.verona.it/api/opendata/v2/content/search/' + encodeURIComponent('classes [event] sort [time_interval=>asc] limit 100');
  const hits = [], seen = new Set();
  while (url) {
    const next = new URL(url); next.protocol = 'https:';
    if (next.host !== 'www.comune.verona.it' || !next.pathname.startsWith('/api/opendata/v2/content/search/') || seen.has(next.href) || seen.size >= 30) throw new Error('Paginazione Comune inattesa');
    seen.add(next.href);
    const page = await (await get(next.href)).json();
    if (!Array.isArray(page.searchHits) || typeof page.totalCount !== 'number') throw new Error('Formato Comune inatteso');
    hits.push(...page.searchHits);
    url = page.nextPageQuery;
    if (!url && hits.length !== page.totalCount) throw new Error('Importazione Comune incompleta');
    if (url) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return parseComune(hits, { from, checkedAt });
}
async function fiere() {
  const year = Number(from.slice(0, 4));
  const events = [];
  // L'anno successivo è pubblicato in anticipo, quando disponibile.
  for (const y of [year, year + 1]) {
    const url = `https://www.veronafiere.it/calendario-fiere/calendario-italia-${y}/`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'VeronaEventsPrototype/0.1 (local development)' } });
    if (y > year && r.status === 404) continue;
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
    events.push(...parseFiere(await r.text(), { year: y, from, checkedAt }));
  }
  return events;
}
let events = [];
for (const [key, run] of [['comune', comune], ['fiere', fiere]]) {
  try {
    const imported = dedupe(await run());
    if (!imported.length) throw new Error('Nessun evento futuro: controllare la fonte prima di sostituire i dati');
    events.push(...imported);
    report.sources.push({ source: sources[key].name, status: 'ok', count: imported.length });
  } catch (error) {
    const retained = previous.events.filter(e => e.source === sources[key].name);
    events.push(...retained);
    report.sources.push({ source: sources[key].name, status: 'error', error: error.message, retained: retained.length });
    process.exitCode = 1;
  }
}
events = dedupe(events).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
await writeFile('data/events.json.tmp', JSON.stringify({ updatedAt: checkedAt, events }, null, 2) + '\n');
await rename('data/events.json.tmp', 'data/events.json');
await writeFile('data/import-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
