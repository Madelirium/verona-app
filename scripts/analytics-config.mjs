export function analyticsConfig(env=process.env){
  if(env.ANALYTICS_ENABLED!=='true')return null;
  const website=(env.ANALYTICS_UMAMI_WEBSITE_ID||'').trim(),script=(env.ANALYTICS_UMAMI_SCRIPT_URL||'').trim();
  if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(website))throw Error('Impostare il Website ID pubblico Umami, non una chiave API.');
  const url=new URL(script);
  if(url.protocol!=='https:'||!/(^|\.)umami\.is$/.test(url.hostname)||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/script.js')throw Error('Usare l’URL HTTPS script.js fornito da Umami Cloud.');
  return {website,script:url.href,domains:['veronaintasca.it','www.veronaintasca.it']};
}
