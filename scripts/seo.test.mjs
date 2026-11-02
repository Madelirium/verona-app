import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildSeo,siteUrl} from './build-seo.mjs';

test('SEO: sitemap lists only canonical existing Home, robots allows crawling',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'verona-seo-'));
  try{
    await buildSeo(pathToFileURL(dir+'/'));
    const xml=await readFile(join(dir,'sitemap.xml'),'utf8'),robots=await readFile(join(dir,'robots.txt'),'utf8');
    assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),[siteUrl]);
    assert.ok(!xml.includes('lastmod'));assert.match(robots,/Allow: \//);assert.ok(robots.includes('Sitemap: '+siteUrl+'sitemap.xml'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('SEO: generated Home declares one canonical and valid WebSite data',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  assert.ok(html.includes('rel="canonical" href="'+siteUrl+'"'));
  const blocks=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  assert.ok(blocks.some(b=>b['@type']==='WebSite'&&b.url===siteUrl));
  assert.ok(!/name="robots"[^>]*noindex/.test(html));
  const workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  for(const file of ['robots.txt','sitemap.xml'])assert.ok(workflow.includes('cp public/'+file+' _site/'+file));
});
