import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyTemplateData, validateDocument, validateFieldValue, validateRepeaterRows } from '@blockdesign/core';
import { resolveDocumentSources } from '../packages/core/src/sources.ts';
import { HttpContentProviderAdapter } from '@blockdesign/adapters';
import { ScalanovaTourContentProvider } from '../apps/demo/src/scalanova-tour-content-provider.ts';

const base='http://127.0.0.1:8080/api/v1';
async function get(path) {const response=await fetch(base+path);if(!response.ok)throw Error(path+': '+response.status);return response.json();}
const query='?systemId=system.scalanova-tr&systemVersion=1.0.0&includeArchived=true';
const [blockCatalog,regionCatalog,templateCatalog]=await Promise.all(['blocks','shared-regions','templates'].map(path=>get('/'+path+query)));
const definitions=new Map(blockCatalog.items.map(item=>[item.ref.id+'@'+item.ref.version,item]));
const templates=new Map(templateCatalog.items.map(item=>[item.ref.id+'@'+item.ref.version,item]));
const regions=regionCatalog.items;
let documents=[],cursor='';do{const page=await get('/documents'+query+(cursor?'&cursor='+encodeURIComponent(cursor):''));documents.push(...page.items);cursor=page.nextCursor??'';}while(cursor);
const report={date:new Date().toISOString(),pages:documents.length,importedPages:documents.filter(document=>document.editorState.workspaceImportedFrom).length,blockDefinitions:definitions.size,activeRegions:regions.filter(region=>!region.archived).length,menuGroups:await get('/content/collections/cms-menus/groups?locale=tr'),counts:{links:0,images:0,forms:0},issues:[],warnings:[]};
const providers=[new HttpContentProviderAdapter({baseUrl:base}),new ScalanovaTourContentProvider()];
const fileChecks=new Map();
async function localFile(url) {
  if(!fileChecks.has(url)) fileChecks.set(url,(async()=>{
    if(!url.startsWith('/scalanova-tour/'))return true;
    const path=resolve('apps/demo/public','.'+url.split(/[?#]/)[0]+(url.split(/[?#]/)[0].endsWith('/')?'index.html':''));
    try{await access(path);return true}catch{return false}
  })());return fileChecks.get(url);
}
function children(value) {return value&&typeof value==='object'&&!Array.isArray(value)?value:undefined;}
function walk(value,visit) {if(Array.isArray(value)){value.forEach(child=>walk(child,visit));return;}if(!children(value))return;visit(value);for(const [key,child]of Object.entries(value))if(key==='components'||key==='pages'||key==='frames'||key==='component')walk(child,visit);}
function expand(value,document) {
  if(Array.isArray(value))return value.map(child=>expand(child,document));if(!children(value))return value;
  const attrs=children(value.attributes)??{};const id=attrs['data-bd-placeholder-id']??attrs['data-bd-block-id'];
  const block=id?document.blocks.find(block=>block.instanceId===id):undefined;
  if(block){const definition=definitions.get(block.definitionRef.id+'@'+block.definitionRef.version);if(definition)return applyTemplateData(definition.componentTemplate,definition.fields,definition.repeaters,block.manualData);}
  return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,expand(child,document)]));
}
for(const document of documents){
  const source=document.editorState.workspaceImportedFrom??document.documentId;
  const issue=(code,message)=>report.issues.push({source,code,message});
  for(const error of validateDocument(document,definitions))issue(error.code,error.message);
  for(const ref of document.sharedRegionRefs){const region=regions.find(region=>region.ref.id===ref.id&&region.ref.version===ref.version);if(!region){issue('SHARED_REGION_MISSING',JSON.stringify(ref));continue;}const values={...region.defaultData,...document.sharedRegionData?.[ref.id+'@'+ref.version]};for(const field of region.fields)for(const error of validateFieldValue(field,values[field.key],field.key))issue(error.code,error.message);for(const repeater of region.repeaters??[])for(const error of validateRepeaterRows(values[repeater.key],repeater,validateFieldValue,repeater.key))issue(error.code,error.message);}
  if(document.templateRef&&!templates.has(document.templateRef.id+'@'+document.templateRef.version))issue('TEMPLATE_MISSING',JSON.stringify(document.templateRef));
  const resolution=await resolveDocumentSources(document,definitions,providers,regions,{defaultLocale:'tr',fallback:{mode:'none'},requireProviderLocaleDeclaration:true});
  for(const error of resolution.issues)(error.severity==='warning'?report.warnings:report.issues).push({source,...error});
  const tree=expand(resolution.document.projectData,resolution.document),ids=new Set(),targets=[],links=[],images=[];
  walk(tree,node=>{const attrs=children(node.attributes)??{};if(typeof attrs.id==='string'){if(ids.has(attrs.id))issue('DUPLICATE_HTML_ID',attrs.id);ids.add(attrs.id);}if(typeof attrs['aria-controls']==='string')targets.push(...attrs['aria-controls'].split(/\s+/));if(node.tagName==='a'&&typeof attrs.href==='string')links.push(attrs.href);if(node.tagName==='img'&&typeof attrs.src==='string')images.push(attrs.src);});
  for(const target of targets)if(!ids.has(target))issue('ARIA_TARGET_MISSING',target);
  for(const href of links){report.counts.links++;if(href.startsWith('#')&&href!=='#'&&!ids.has(href.slice(1)))issue('ANCHOR_TARGET_MISSING',href);if(!(await localFile(href)))issue('LINK_FILE_MISSING',href);}
  for(const src of images){report.counts.images++;if(!(await localFile(src)))issue('IMAGE_FILE_MISSING',src);}
  for(const block of document.blocks)if(block.formBinding){report.counts.forms++;const ref=block.formBinding.formRef;try{await access(resolve('apps/demo/public/cms-forms',ref.id,ref.version+'.json'));}catch{issue('FORM_SCHEMA_MISSING',JSON.stringify(ref));}}
}
await mkdir('docs/audits',{recursive:true});
await writeFile('docs/audits/cms-readiness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,issues:report.issues.slice(0,30),warnings:report.warnings.slice(0,5)},null,2));
if(report.issues.length)process.exitCode=1;
