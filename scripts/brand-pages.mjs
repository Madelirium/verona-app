import {mkdir,writeFile} from 'node:fs/promises';

const site='https://veronaintasca.it/';
export function invitationTarget(href,game){
  if(!['briscola','forza4'].includes(game))throw Error('Gioco non valido');
  const source=new URL(href),target=new URL('../../',source);
  const code=(source.searchParams.get('stanza')||'').toUpperCase();
  if(/^[A-Z2-9]{6}$/.test(code))target.searchParams.set(game,code);
  return target.href;
}
export function renderInvitationPage(game){
  if(!['briscola','forza4'].includes(game))throw Error('Gioco non valido');
  const title=game==='briscola'?'Briscola':'Forza 4';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invito a ${title} · Verona in Tasca</title><meta name="description" content="Sfida i tuoi amici con un tap. Apri l’invito e unisciti alla partita."><meta property="og:type" content="website"><meta property="og:site_name" content="Verona in Tasca"><meta property="og:title" content="Ti invito a giocare a ${title}"><meta property="og:description" content="Apri l’invito e unisciti alla partita. Basta un soprannome, senza registrazione."><meta property="og:url" content="${site}inviti/${game}/"><meta property="og:image" content="${site}assets/brand/invito-${game}.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Invito a giocare a ${title} a Verona"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${site}assets/brand/invito-${game}.jpg"><link rel="icon" type="image/png" href="../../assets/brand/icon-32.png"><style>body{font:18px/1.6 system-ui,sans-serif;background:#eeeae2;color:#1e2d43;margin:0;padding:24px}main{max-width:600px;margin:8vh auto}img{width:100%;height:auto;border-radius:16px}a{display:block;background:#254f78;color:white;padding:14px;border-radius:12px;text-align:center;text-decoration:none;min-height:24px}</style></head><body><main><img src="../../assets/brand/invito-${game}.jpg" alt="Invito a ${title}" width="1200" height="630"><h1>Una partita a ${title}?</h1><p>Ti accompagniamo al tavolo. Se l’app non si apre, usa il pulsante.</p><a id="open-game" href="../../">Apri Verona in Tasca</a></main><script>const target=(${invitationTarget.toString()})(location.href,'${game}');document.getElementById('open-game').href=target;location.replace(target);</script></body></html>`;
}
export async function buildBrandPages(publicRoot=new URL('../public/',import.meta.url)){
  for(const game of ['briscola','forza4']){
    const folder=new URL('inviti/'+game+'/',publicRoot);await mkdir(folder,{recursive:true});
    await writeFile(new URL('index.html',folder),renderInvitationPage(game));
  }
  await writeFile(new URL('manifest.webmanifest',publicRoot),JSON.stringify({id:'./',name:'Verona in Tasca',short_name:'Verona in Tasca',description:'La città sempre con te. Eventi, mobilità e servizi a Verona.',lang:'it',start_url:'./',scope:'./',display:'standalone',background_color:'#eeeae2',theme_color:'#eeeae2',icons:[192,512].map(size=>({src:'assets/brand/icon-'+size+'.png',sizes:size+'x'+size,type:'image/png',purpose:'any'}))},null,2)+'\n');
}
