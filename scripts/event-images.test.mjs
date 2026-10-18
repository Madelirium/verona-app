import test from 'node:test';
import assert from 'node:assert/strict';
import {parseComuneImage,attachComuneImages} from './event-images.mjs';

function resource(){return {metadata:{id:17,classIdentifier:'image'},data:{'ita-IT':{name:'Locandina',author:'Autrice',caption:'<p>Programma</p>',license:['Creative Commons Attribution 4.0 International (CC BY 4.0)'],image:{url:'https://s3-eu-west-1.amazonaws.com/static.opencity.opencontent.it/var/verona/storage/images/evento.png',mime_type:'image/png',width:'900',height:'1600'}}}};}

test('Le immagini attribuite al Comune con licenza sconosciuta conservano lo stato non verificato',()=>{
  const data=resource(),fields=data.data['ita-IT'];fields.author='Comune di Verona';fields.license=['Licenza sconosciuta'];
  const image=parseComuneImage(data);assert.equal(image.license,'Licenza non specificata');assert.equal(image.licenseUrl,null);assert.equal(image.rightsStatus,'unverified');assert.deepEqual(image.sourceLicense,['Licenza sconosciuta']);
  fields.author='Autore esterno';assert.equal(parseComuneImage(data),null);
  fields.author='Comune di Verona';fields.license=['Licenza proprietaria'];assert.equal(parseComuneImage(data),null);
});
test('Le immagini mantengono attribuzione, licenza e proporzioni della fonte ufficiale',()=>{
  const image=parseComuneImage(resource());assert.equal(image.author,'Autrice');assert.equal(image.caption,'Programma');assert.equal(image.license,'CC BY 4.0');assert.equal(image.height,1600);
  assert.equal(image.sourceUrl,'https://www.comune.verona.it/api/opendata/v2/content/read/17');
  for(const url of ['javascript:alert(1)','https://example.com/foto.jpg','https://s3-eu-west-1.amazonaws.com/altro/foto.png','https://utente@www.comune.verona.it/foto.png']){const data=resource();data.data['ita-IT'].image.url=url;assert.equal(parseComuneImage(data),null);}
  const restricted=resource();restricted.data['ita-IT'].license=[];assert.equal(parseComuneImage(restricted),null);
  const pdf=resource();pdf.data['ita-IT'].image.mime_type='application/pdf';assert.equal(parseComuneImage(pdf),null);
});
test('Le ricorrenze condividono una sola lettura; errori immagine non cancellano eventi',async()=>{
  let calls=0;const events=[{id:'a',imageId:17},{id:'b',imageId:17},{id:'c',imageId:18},{id:'d'}],errors=[];
  const result=await attachComuneImages(events,async id=>{calls++;if(id===18)throw Error('Offline');return resource()},{onError:id=>errors.push(id)});
  assert.equal(calls,2);assert.equal(result.length,4);assert.equal(result[0].image.url,result[1].image.url);assert.equal(result[2].image,null);assert.equal(result[3].image,null);assert.deepEqual(errors,[18]);
  assert.equal((await attachComuneImages([{imageId:19}],async()=>resource()))[0].image,null);
});
