import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=new URL('../public/vendor/',import.meta.url);await mkdir(folder,{recursive:true});
for(const [name,hash]of [['leaflet.css','p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='],['leaflet.js','20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=']]){
  const r=await fetch(`https://unpkg.com/leaflet@1.9.4/dist/${name}`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(r.status);
  const bytes=new Uint8Array(await r.arrayBuffer());if(createHash('sha256').update(bytes).digest('base64')!==hash)throw Error(`Integrità non valida: ${name}`);
  await writeFile(new URL(name,folder),bytes);console.log(name+' verificato');
}
const r=await fetch('https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE');if(!r.ok)throw Error('Licenza Leaflet non disponibile');await writeFile(new URL('leaflet.LICENSE',folder),await r.text());
