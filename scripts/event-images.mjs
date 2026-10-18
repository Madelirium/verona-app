import {text} from './parsers.mjs';

export function parseComuneImage(resource){
  if(resource?.metadata?.classIdentifier!=='image')return null;
  const d=resource.data?.['ita-IT'],file=d?.image;
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.mime_type))return null;
  const ccBy=d.license?.includes('Creative Commons Attribution 4.0 International (CC BY 4.0)');
  const unspecified=d.license?.length===1&&d.license[0]==='Licenza sconosciuta'&&text(d.author)==='Comune di Verona';
  if((!ccBy&&!unspecified)||d.proprietary_license)return null;
  let url;try{url=new URL(file.url)}catch{return null}
  if(url.protocol!=='https:'||url.username||url.password)return null;
  const allowed=url.hostname==='www.comune.verona.it'||(url.hostname==='s3-eu-west-1.amazonaws.com'&&url.pathname.startsWith('/static.opencity.opencontent.it/var/verona/'));
  if(!allowed)return null;
  const id=resource.metadata.id;if(!Number.isSafeInteger(id)||id<=0)return null;
  let sourceUrl='https://www.comune.verona.it/api/opendata/v2/content/read/'+id;
  try{const alias=new URL(resource.extradata?.['ita-IT']?.urlAlias||sourceUrl,'https://www.comune.verona.it');if(alias.origin==='https://www.comune.verona.it')sourceUrl=alias.href;}catch{}
  return {url:url.href,alt:text(file.alt||d.name||''),author:text(d.author||''),caption:text(d.caption||''),license:ccBy?'CC BY 4.0':'Licenza non specificata',licenseUrl:ccBy?'https://creativecommons.org/licenses/by/4.0/':null,rightsStatus:ccBy?'declared':'unverified',sourceLicense:[...d.license],sourceUrl,width:Number(file.width)||null,height:Number(file.height)||null};
}

export async function attachComuneImages(events,load,{onError=()=>{}}={}){
  const images=new Map();
  for(const id of new Set(events.map(event=>event.imageId).filter(Boolean))){
    try{const resource=await load(id);if(resource?.metadata?.id!==id)throw Error('Identità immagine inattesa');images.set(id,parseComuneImage(resource));}
    catch(error){onError(id,error);images.set(id,null);}
  }
  return events.map(event=>({...event,image:images.get(event.imageId)||null}));
}
