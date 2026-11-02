import {writeFile} from 'node:fs/promises';

export const siteUrl='https://veronaintasca.it/';
export async function buildSeo(publicRoot=new URL('../public/',import.meta.url)){
  // Only real, canonical public pages belong here. App states and invitations do not.
  await writeFile(new URL('robots.txt',publicRoot),`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
  await writeFile(new URL('sitemap.xml',publicRoot),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}</loc></url></urlset>\n`);
}
