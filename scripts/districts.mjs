// Quartieri e associazioni verificati nelle due pagine dell'Ufficio Decentramento.
const base='https://www.comune.verona.it/Amministrazione/Organi-di-governo/Circoscrizioni/';
export const districtCatalog={checkedOn:'2026-10-17',sourceUrl:'https://www.comune.verona.it/Amministrazione/Aree-amministrative-e-Direzioni/Ufficio-Decentramento',items:[
  {id:'1',name:'Centro storico',slug:'Centro-storico',quarters:['Città antica','Cittadella','San Zeno','Veronetta']},
  {id:'2',name:'Nord-ovest',slug:'Nord-ovest',quarters:['Avesa','Borgo Trento','Parona','Ponte Crencano','Quinzano','Valdonega']},
  {id:'3',name:'Ovest',slug:'Ovest',quarters:['Borgo Milano','San Massimo']},
  {id:'4',name:'Sud-ovest',slug:'Sud-ovest',quarters:['Golosine','Santa Lucia']},
  {id:'5',name:'Sud',slug:'Sud',quarters:['Borgo Roma',"Ca’ di David"]},
  {id:'6',name:'Est',slug:'Est',quarters:['Borgo Venezia']},
  {id:'7',name:'Sud-est',slug:'Sud-est',quarters:['Porto San Pancrazio','San Michele']},
  {id:'8',name:'Nord-est',slug:'Nord-est',quarters:['Mizzole','Montorio','Quinto','Santa Maria in Stelle']}
].map(d=>({...d,sourceUrl:base+`Circoscrizione-${d.id}-${d.slug}`}))};
function normalize(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function explicitDistricts(value){
  // Il numero di una commissione non è il numero della circoscrizione.
  const direct=[...value.matchAll(/\bcircoscrizione\s*(?:n\.?\s*)?([1-8])\b/gi)].map(m=>m[1]);
  const ordinal=[...value.matchAll(/\b([1-8])\s*[ª^°]\s*circoscrizione\b/gi)].map(m=>m[1]);
  return [...new Set([...direct,...ordinal])];
}
const aliases={'Ca’ di David':['Ca di David','Cadidavid'],'San Michele':['San Michele Extra'],'Quinto':['Quinto di Valpantena']};
export function districtMatches(value=''){
  const explicit=explicitDistricts(value),text=' '+normalize(value)+' ';
  return districtCatalog.items.map(d=>({id:d.id,explicit:explicit.includes(d.id),quarters:d.quarters.filter(q=>{
    if(q==='Quinto')return text.includes(' quinto di valpantena ')||/ (?:a|di|quartiere) quinto /.test(text);
    if(q==='San Zeno'&&text.includes(' san zeno di montagna ')&&!text.replaceAll(' san zeno di montagna ',' ').includes(' san zeno '))return false;
    return [q,...aliases[q]||[]].some(term=>text.includes(' '+normalize(term)+' '));
  })})).filter(m=>m.explicit||m.quarters.length);
}
