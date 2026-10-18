import test from 'node:test';
import assert from 'node:assert/strict';
import {attachNewsImages} from './news-images.mjs';

test('Le notizie risolvono le immagini ufficiali condivise mantenendo autore e licenza',async()=>{
  const calls=[];
  const image={metadata:{id:9,classIdentifier:'image'},data:{'ita-IT':{name:'Foto',author:'Comune',license:['Creative Commons Attribution 4.0 International (CC BY 4.0)'],image:{url:'https://www.comune.verona.it/foto.jpg',mime_type:'image/jpeg'}}}};
  const result=await attachNewsImages([{id:'comune-news-1'},{id:'comune-news-2'}],async id=>{calls.push(id);return id===9?image:{metadata:{id},data:{'ita-IT':{image:[{id:9,classIdentifier:'image'}]}}};});
  assert.deepEqual(calls,[1,2,9]);assert.equal(result[0].image.author,'Comune');assert.equal(result[0].image.url,result[1].image.url);
});

test('Immagini mancanti, risorse errate ed errori di rete non eliminano notizie',async()=>{
  const items=[{id:'comune-news-1'},{id:'comune-news-2'},{id:'comune-news-3'},{id:'errato'}],errors=[];
  const result=await attachNewsImages(items,async id=>{if(id===1)throw Error('Offline');return {metadata:{id:id===2?99:id},data:{'ita-IT':{}}};},{onError:id=>errors.push(id)});
  assert.equal(result.length,4);assert.ok(result.every(item=>item.image===null));assert.equal(errors.length,3);
});
