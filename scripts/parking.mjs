export const parkingSource='https://www.comune.verona.it/Amministrazione/Documenti-e-dati/Dataset/Parcheggi-a-Verona';
export const parkingCsv='https://www.comune.verona.it/customexport/dataset-csv_resource-10720';
export function parkingWebsite(value){
  try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;for(const key of [...url.searchParams.keys()])if(/^(utm_|gclid$|gad|fbclid$)/i.test(key))url.searchParams.delete(key);return url.href;}catch{return null;}
}
export function parseParking(csv){
  const rows=[];let row=[],field='',quoted=false;
  const input=String(csv).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else if(!quoted&&field){throw Error('CSV parcheggi: virgolette non valide');}else quoted=!quoted;}
    else if(!quoted&&(c===','||c==='\n')){row.push(field.trim());field='';if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}
    else field+=c;
  }
  if(quoted)throw Error('CSV parcheggi incompleto');if(field||row.length){row.push(field.trim());if(row.some(Boolean))rows.push(row);}
  const headers=['Prog','Nome parcheggio','Indirizzo','Tipologia','Contatti','Sito web','Latitudine e longitudine'];
  if(JSON.stringify(rows.shift())!==JSON.stringify(headers))throw Error('Struttura CSV parcheggi cambiata');
  const ids=new Set();return rows.map(values=>{
    if(values.length!==headers.length)throw Error('Riga CSV parcheggi incompleta');
    const [id,name,address,type,contact,website,position]=values,[lat,lon]=position.split(',').map(Number);
    if(!/^\d+$/.test(id)||ids.has(id)||!name||position.split(',').length!==2||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<45.2||lat>45.7||lon<10.7||lon>11.3)throw Error('Parcheggio con identificativo o coordinate non validi');
    ids.add(id);return {id:'comune-parking-'+id,name,address,type,typeKey:type==='libero'?'free':type==='a pagamento'?'paid':'unknown',contact,website:parkingWebsite(website),lat,lon};
  }).sort((a,b)=>a.name.localeCompare(b.name,'it'));
}
export function parkingSnapshot(csv,previous,checkedAt){
  const items=parseParking(csv);if(!items.length||(previous?.items?.length&&items.length<previous.items.length/2))throw Error('Catalogo parcheggi vuoto o ridotto oltre la soglia: dati precedenti conservati');
  return {updatedAt:checkedAt,lastAttemptAt:checkedAt,status:'ok',source:'Comune di Verona',sourceUrl:parkingSource,csvUrl:parkingCsv,license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',scope:'Principali parcheggi del dataset comunale; elenco non esaustivo. Nessun dato di disponibilità in tempo reale.',items};
}
