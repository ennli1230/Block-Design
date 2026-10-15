import { writeFile, readFile } from 'node:fs/promises';
import { connectCmsMenuRegion } from '../apps/demo/src/cms-navigation.ts';
const endpoint = 'http://127.0.0.1:8080/api/v1/shared-regions?systemId=system.scalanova-tr&systemVersion=1.0.0&includeArchived=true';
const response = await fetch(endpoint);
if (!response.ok) throw new Error('Shared region catalog unavailable');
const { items } = await response.json();
const originals = items.filter(region => region.ref.version === '1.0.0');
if (originals.length !== 2) throw new Error('Expected original header and footer');
const regions = originals.map(connectCmsMenuRegion);
const groups = originals.flatMap(region => region.repeaters.flatMap((repeater,index) => {
  if (region.region === 'header' && index !== 0) return [];
  const id = region.region === 'header' ? '1' : String(index + 2);
  const label = region.region === 'header' ? 'Header ve hamburger menüsü · ID 1' : ['Footer · Hizmetler · ID 2','Footer · Kurumsal · ID 3','Footer · Yasal bağlantılar · ID 4'][index];
  const urlField = repeater.itemFields.find(field => field.mappingTarget.property === 'href');
  const textField = repeater.itemFields.find(field => field.mappingTarget.operation === 'text');
  const records = region.defaultData[repeater.key].map((row,index) => ({recordId:`menu-${id}-${index}`,collectionId:'cms-menus',values:{label:row[textField.key],url:row[urlField.key],children:[]}}));
  if(id==='1') records[0].values.children=[{id:'private-tours',label:'Özel turlar',url:'/scalanova-tour/tr/turlar/'},{id:'activities',label:'Aktiviteler',url:'/scalanova-tour/tr/aktiviteler/'}];
  if(id==='3') records.push({recordId:'menu-3-partner',collectionId:'cms-menus',values:{label:'B2B iş ortaklığı',url:'/scalanova-tour/tr/b2b/',children:[]}});
  // The old manual rows remain drafts; seed defaults make first mount coherent before CMS resolution.
  const next = regions.find(item=>item.ref.id===region.ref.id);
  next.defaultData[repeater.key] = records.map(record=>({__id:record.recordId,[textField.key]:record.values.label,[urlField.key]:record.values.url,...(id==='1'?{children:record.values.children.map(child=>({...child,__id:child.id}))}:{})}));
  return [{id,locale:'tr',label,records}];
}));
await writeFile(new URL('../.tools/cms-navigation.json',import.meta.url),JSON.stringify({regions,groups},null,2));
const migration = new URL('../server/internal/repository/migrations/005_cms_menus.sql',import.meta.url);
const schema = (await readFile(migration,'utf8')).split('-- Initial')[0].trim();
const quote = value => "'"+value.replaceAll("'","''")+"'";
await writeFile(migration, schema+'\n\n-- Initial CMS menu records copied from the imported Turkish source.\n'+groups.map(group=>`INSERT INTO cms_menus(id,locale,label,payload) VALUES (${quote(group.id)},${quote(group.locale)},${quote(group.label)},${quote(JSON.stringify(group.records))});`).join('\n')+'\n');
console.log('Prepared 4 database menus and 2 CMS-bound region versions.');
