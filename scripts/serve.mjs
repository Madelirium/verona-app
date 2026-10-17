import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
const lan = process.argv.includes('--lan');
const wifi = Object.entries(networkInterfaces()).filter(([name]) => /wi-?fi|wireless|wlan/i.test(name)).flatMap(([,values]) => values).find(i => i.family === 'IPv4' && !i.internal);
if (lan && !wifi) throw new Error('Nessuna interfaccia Wi-Fi IPv4 disponibile. Collegare il computer al Wi-Fi e riprovare.');
const host = lan ? wifi.address : '127.0.0.1';
const routes = { '/': ['public/index.html', 'text/html; charset=utf-8'], '/data/events.json': ['data/events.json', 'application/json'], '/data/import-report.json': ['data/import-report.json', 'application/json'] };
createServer(async (req,res) => {
  const route = routes[new URL(req.url, 'http://localhost').pathname];
  if (!route || req.method !== 'GET') { res.writeHead(404).end(); return; }
  try { const body = await readFile(new URL('../'+route[0],import.meta.url)); res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }).end(body); }
  catch { res.writeHead(503).end('Calendario temporaneamente non disponibile. Riprova tra poco.'); }
}).listen(4173, host, () => console.log(`${lan ? 'Accesso Wi-Fi' : 'Anteprima'}: http://${host}:4173`));
