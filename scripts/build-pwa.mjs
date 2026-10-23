import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function buildPwa(root=new URL('../public/',import.meta.url)){
  const template=await readFile(new URL('sw.template.js',root),'utf8');
  const hash=createHash('sha256').update(template);
  for(const path of ['index.html','manifest.webmanifest','assets/brand/logo-header.webp','assets/brand/icon-32.png','assets/brand/icon-180.png','assets/brand/icon-192.png','assets/brand/icon-512.png'])hash.update(await readFile(new URL(path,root)));
  await writeFile(new URL('sw.js',root),template.replace('__PWA_VERSION__',hash.digest('hex').slice(0,20)));
}
