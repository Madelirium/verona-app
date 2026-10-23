import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {invitationTarget,renderInvitationPage} from './brand-pages.mjs';

test('Invito con anteprima: conserva gioco e stanza su dominio, anteprima Wi-Fi e sottocartella Pages',()=>{
  for(const base of ['https://veronaintasca.it/','http://192.168.1.27:4173/','https://madelirium.github.io/verona-app/'])for(const game of ['briscola','forza4']){
    const url=base+'inviti/'+game+'/?stanza=abc234';
    assert.equal(invitationTarget(url,game),base+'?'+game+'=ABC234');
    const html=renderInvitationPage(game);let redirect,button={};
    runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{URL,location:{href:url,replace:value=>redirect=value},document:{getElementById:()=>button}});
    assert.equal(redirect,base+'?'+game+'=ABC234');assert.equal(button.href,redirect);
    assert.match(html,new RegExp('og:image" content="https://veronaintasca.it/assets/brand/invito-'+game+'\\.jpg'));
    assert.match(html,/og:image:width" content="1200"/);assert.ok(!html.includes('ABC234'));
  }
});

test('Inviti: codici assenti o errati non diventano destinazioni arbitrarie',()=>{
  for(const query of ['', '?stanza=XYZ', '?stanza=https://evil.example','?stanza=%3Cscript%3E&next=https://evil.example'])assert.equal(invitationTarget('https://veronaintasca.it/inviti/briscola/'+query,'briscola'),'https://veronaintasca.it/');
  assert.throws(()=>renderInvitationPage('unknown'));assert.throws(()=>invitationTarget('https://veronaintasca.it/','unknown'));
});

test('Identità app: icone installabili reali, logo leggero e anteprime distinte generate nella build',async()=>{
  const root=new URL('../public/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
  assert.equal(manifest.name,'Verona in Tasca');assert.equal(manifest.start_url,'./');assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons){const png=await readFile(new URL(icon.src,root));assert.equal(png.subarray(1,4).toString(),'PNG');const size=Number(icon.sizes.split('x')[0]);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
  assert.ok((await readFile(new URL('assets/brand/logo-header.webp',root))).length<50000);
  for(const game of ['briscola','forza4']){assert.equal(await readFile(new URL('inviti/'+game+'/index.html',root),'utf8'),renderInvitationPage(game));assert.ok((await readFile(new URL('assets/brand/invito-'+game+'.jpg',root))).length<300000);}
  const html=await readFile(new URL('index.html',root),'utf8');assert.match(html,/<title>Verona in Tasca/);assert.match(html,/alt="Verona in Tasca"/);
});
