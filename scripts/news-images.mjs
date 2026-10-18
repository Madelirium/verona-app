import {attachComuneImages} from './event-images.mjs';

export async function attachNewsImages(items,load,{onError=()=>{}}={}){
  const referenced=[];
  for(const item of items){
    const id=Number(item.id.match(/^comune-news-(\d+)$/)?.[1]);
    try{
      if(!Number.isSafeInteger(id)||id<=0)throw Error('Identificativo notizia non valido');
      const resource=await load(id);
      if(resource?.metadata?.id!==id)throw Error('Identità notizia inattesa');
      const ref=resource.data?.['ita-IT']?.image?.[0];
      const imageId=ref?.classIdentifier==='image'&&Number.isSafeInteger(ref.id)&&ref.id>0?ref.id:null;
      referenced.push({...item,imageId});
    }catch(error){onError(id,error);referenced.push({...item,imageId:null});}
  }
  return attachComuneImages(referenced,load,{onError});
}
