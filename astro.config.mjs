import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
const ids=JSON.parse(readFileSync(new URL('./src/data/models.json',import.meta.url))).map(m=>m.id);
const activePaths=new Set(['/', '/usage/', '/methodology/', '/privacy/', '/terms/', '/disclosure/', '/handbook/', ...ids.map(id=>`/model/${id}/`)]);
for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)activePaths.add(`/compare/${ids[i]}-vs-${ids[j]}/`);
export default defineConfig({
 site:'https://aicost.apexcraftweb.com',
 integrations:[tailwind(),sitemap({filter:page=>activePaths.has(new URL(page).pathname.replace(/\/?$/,'/'))})],
});
