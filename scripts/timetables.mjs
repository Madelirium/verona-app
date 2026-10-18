export function validateTimetables(data,manifest){
  if(data.kind!=='scheduled'||!Array.isArray(data.lines)||!Array.isArray(data.errors))throw Error('Catalogo orari non valido');
  const ids=new Set();let times=0;
  for(const line of data.lines){
    if(ids.has(line.lineId)||!line.blocks?.length)throw Error('Scheda oraria duplicata o vuota');ids.add(line.lineId);
    if(!/^[a-f0-9]{64}$/.test(line.sha256)||new URL(line.sourceUrl).origin!=='https://www.atv.verona.it')throw Error('Fonte oraria non valida');
    const snapshot=manifest?.items.find(item=>item.lineId===line.lineId);
    if(manifest&&(!snapshot||snapshot.sha256!==line.sha256||snapshot.sourceUrl!==line.sourceUrl))throw Error('PDF cambiato: estrarre e verificare la nuova raccolta prima di pubblicarla');
    for(const block of line.blocks){
      const n=block.tripIds.length;
      if(!n||new Set(block.tripIds.filter(Boolean)).size!==block.tripIds.filter(Boolean).length||!block.direction||!block.service||!Number.isInteger(block.page)||block.page<1)throw Error('Intestazione oraria non valida');
      if(block.validity.length!==n||block.tripNotes.length!==n||!block.stops.length)throw Error('Colonne orarie non allineate');
      let blockTimes=0;
      for(const stop of block.stops){
        if(!stop.name?.trim()||stop.times.length!==n||stop.marks.length!==n)throw Error('Fermata oraria non valida');
        for(let i=0;i<n;i++){
          const time=stop.times[i];if(time!==null&&!/^(?:[01]\d|2\d):[0-5]\d$/.test(time))throw Error('Ora non valida');
          if(!['','|'].includes(stop.marks[i])||(stop.marks[i]==='|'&&time!==null))throw Error('Passaggio senza fermata trasformato in orario');
          if(time!==null)blockTimes++;
        }
      }
      if(blockTimes!==block.timeCount)throw Error('Conteggio orari non corrispondente');times+=blockTimes;
    }
  }
  return {lines:ids.size,times};
}
