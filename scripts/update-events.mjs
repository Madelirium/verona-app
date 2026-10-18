import {importEvents} from './import-events.mjs';
import {buildCalendar} from './build-calendar.mjs';

const report=await importEvents();
// Anche in caso di problemi, l'anteprima mostra i dati conservati e lo stato reale.
console.log(`Calendario pronto: ${await buildCalendar()} appuntamenti incorporati.`);
if(report.status==='error'||(report.status==='partial'&&!process.argv.includes('--allow-partial')))process.exitCode=1;
