import { text } from './parsers.mjs';
import { explicitDistricts } from './districts.mjs';
export const newsSources=[
  {key:'notizie',kind:'Notizia',url:'https://www.comune.verona.it/Novita/Notizie'},
  {key:'avvisi',kind:'Avviso',url:'https://www.comune.verona.it/Novita/Avvisi'}
];
export function classifyNews(title,summary){
  const value=`${title} ${summary}`.toLowerCase();
  if(/viabil|tangenzial|autovelox|circolazion|carreggiat|divieti.*sosta|traffico|cantier/.test(value))return 'Mobilità';
  if(/contribut|bando|concorso|domande|selezione|affidamento/.test(value))return 'Bandi e opportunità';
  if(/sportell|uffici|anagra|sospensione|servizio.*telefonic/.test(value))return 'Servizi';
  if(/famigli|genitori|bambin|scuol|social|anzian/.test(value))return 'Comunità';
  if(/mostra|festival|cinema|cultur|spettacol|arte|incontro|sport|camminat/.test(value))return 'Cultura e tempo libero';
  return 'Dal Comune';
}
export function parseNews(html,source,{checkedAt,from,to}){
  const chunks=html.split(/<div\b[^>]*data-object_id="(\d+)"[^>]*>/i);
  if(chunks.length<3)throw new Error('Struttura delle pubblicazioni comunali non riconosciuta');
  const items=[];
  for(let i=1;i<chunks.length;i+=2){
    const id=chunks[i],chunk=chunks[i+1];
    const title=text(chunk.match(/<h3\b[^>]*class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    const date=chunk.match(/Data di pubblicazione:<\/strong>\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    const links=[...chunk.matchAll(/<a\b([^>]+)>/gi)];
    const rawUrl=links.find(m=>/class="[^"]*read-more/.test(m[1]))?.[1].match(/href="([^"]+)"/i)?.[1];
    if(!title||!date||!rawUrl)throw new Error(`Scheda comunale incompleta: ${id}`);
    const publishedOn=`${date[3]}-${date[2]}-${date[1]}`;
    if(!Number.isFinite(Date.parse(publishedOn))||new Date(publishedOn).toISOString().slice(0,10)!==publishedOn)throw new Error('Data comunale non valida');
    const url=new URL(text(rawUrl),source.url);
    if(url.origin!=='https://www.comune.verona.it'||!url.pathname.startsWith('/Novita/'))throw new Error('Link notizia inatteso');
    if(publishedOn<from||publishedOn>to)continue;
    const description=chunk.match(/<div\b[^>]*class="[^"]*text-paragraph-card[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]||'';
    const summary=text(description.split(/<strong>\s*Data di pubblicazione:/i)[0]).slice(0,700);
    const zone=explicitDistricts(`${title} ${summary}`)[0];
    items.push({id:`comune-news-${id}`,title,summary,publishedOn,checkedAt,source:'Comune di Verona',sourceUrl:url.href,sourceKey:source.key,kind:source.kind,category:classifyNews(title,summary),categoryMethod:'automatic',area:zone?`Circoscrizione ${zone}`:null,license:'CC BY 4.0 salvo eccezioni',licenseUrl:'https://www.comune.verona.it/Note-legali'});
  }
  return items;
}
export function mergeNews(items){return [...new Map(items.map(i=>[i.id,i])).values()].sort((a,b)=>b.publishedOn.localeCompare(a.publishedOn)||a.title.localeCompare(b.title,'it'));}

export function newsCollectionState(sources,checkedAt,previousUpdatedAt=null){
  const succeeded=sources.filter(source=>source.status==='ok').length;
  return {status:succeeded===sources.length&&succeeded>0?'ok':succeeded?'partial':'error',updatedAt:succeeded?checkedAt:previousUpdatedAt};
}
