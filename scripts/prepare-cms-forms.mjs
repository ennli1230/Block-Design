import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createCmsFormDefinition } from '@blockdesign/core';
const base = new URL('../apps/demo/public/cms-forms/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', base), 'utf8'));
const demoFormDefinitions = await Promise.all(catalog.items.map(({ref}) => readFile(new URL(`${ref.id}/${ref.version}.json`, base), 'utf8').then(JSON.parse)));
const output=new URL('../.tools/cms-forms.json',import.meta.url);
await mkdir(new URL('../.tools/',import.meta.url),{recursive:true});
await writeFile(output,JSON.stringify({block:createCmsFormDefinition({id:'system.scalanova-tr',version:'1.0.0'}),forms:demoFormDefinitions},null,2));
console.log('CMS form migration manifest prepared.');
