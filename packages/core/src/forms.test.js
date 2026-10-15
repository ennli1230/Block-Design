import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFormDefinition, validateFormValues, validateFormBinding, formSchemaDiff, loadFormOptions, createCmsFormDefinition } from './forms.ts';

const definition=()=>({ref:{id:'contact',version:'1'},label:'İletişim',locale:'tr',fields:[{fieldId:'email',label:'E-posta',type:'email',validation:{required:true}},{fieldId:'guests',label:'Kişi',type:'number',validation:{min:1,max:20}},{fieldId:'consent',label:'Onay',type:'checkbox',validation:{required:true}}],action:{adapterId:'cms',actionId:'contact',kind:'submit',label:'Gönder'}});
test('CMS form schemas reject unsupported fields, duplicate IDs, malformed rules and dependency cycles',()=>{
  validateFormDefinition(definition());
  for(const mutate of [f=>f.fields[0].type='file',f=>f.fields.push(f.fields[0]),f=>f.fields[0].validation.required='yes',f=>f.fields[1].defaultValue='2',f=>f.fields[0].fieldId='__proto__']){
    const form=definition();mutate(form);assert.throws(()=>validateFormDefinition(form));
  }
  const form=definition();form.fields=[{fieldId:'a',type:'select',label:'A',options:{providerId:'cms',collectionId:'items',labelField:'label',dependencies:[{fieldId:'b',filterField:'parent'}]}},{fieldId:'b',type:'select',label:'B',options:{providerId:'cms',collectionId:'items',labelField:'label',dependencies:[{fieldId:'a',filterField:'parent'}]}}];
  assert.throws(()=>validateFormDefinition(form),/Döngüsel/);
});
test('visitor values validate required, email, bounds, date and source option membership',()=>{
  assert.deepEqual(Object.keys(validateFormValues(definition(),{email:' ',guests:21,consent:false})),['email','guests','consent']);
  assert.deepEqual(validateFormValues(definition(),{email:'a@example.com',guests:2,consent:true}),{});
  const form=definition();form.fields=[{fieldId:'date',type:'date',label:'Tarih'},{fieldId:'tour',type:'select',label:'Tur',options:[]}];
  assert.deepEqual(Object.keys(validateFormValues(form,{date:'2026-02-31',tour:'deleted'})),['date','tour']);
});
test('form schema changes use stable IDs and do not mutate the pinned definition',()=>{
  const before=definition(),after=structuredClone(before);after.ref.version='2';after.fields[0].label='E-posta adresiniz';after.fields.pop();after.fields.push({fieldId:'message',type:'textarea',label:'Mesaj'});
  assert.deepEqual(formSchemaDiff(before,after),{added:['message'],removed:['consent'],changed:['email']});assert.equal(before.fields[0].label,'E-posta');
});
test('one form definition can bind to different schemas and does not store visitor values',()=>{
  const block=createCmsFormDefinition({id:'system.test',version:'1'});assert.deepEqual(block.fields,[]);assert.deepEqual(block.defaultData,{});
  const binding={providerId:'cms',formRef:{id:'contact',version:'1'},appearance:'stacked',contextBindings:[{key:'tour-id',value:'efes'}]};validateFormBinding(binding);
  assert.throws(()=>validateFormBinding({...binding,contextBindings:[{key:'__proto__',value:'x'}]}));
});
const field={fieldId:'tour',type:'select',label:'Tur',options:{providerId:'cms',collectionId:'tours',labelField:'name',dependencies:[{fieldId:'destination',filterField:'destinationId'}]}};
const provider=(overrides={})=>({providerId:'cms',capabilities:{supported:['query']},getSchema:async()=>({fields:[{fieldId:'name'}],capabilities:{search:true,query:{filterFields:[{fieldId:'destinationId',operators:['eq']}],maxLimit:50}}}),query:async()=>({items:[{recordId:'efes-tour',values:{name:'Efes turu'}}],nextCursor:null}),search:async()=>({items:[],nextCursor:null}),resolveRecords:async()=>[],...overrides});
test('dependent option sources require supported filters and never silently truncate results',async()=>{
  assert.deepEqual(await loadFormOptions(field,{destination:''},[provider()]),{items:[],nextCursor:null});
  let query;const result=await loadFormOptions(field,{destination:'efes'},[provider({query:async(_id,input)=>{query=input;return {items:[{recordId:'one',values:{name:'Bir'}}],nextCursor:null};}})]);
  assert.deepEqual(query.filters,[{fieldId:'destinationId',operator:'eq',value:'efes'}]);assert.equal(result.items[0].label,'Bir');
  await assert.rejects(loadFormOptions(field,{destination:'efes'},[provider({query:async()=>({items:[],nextCursor:'more'})})]),/sığmıyor/);
  await assert.rejects(loadFormOptions(field,{destination:'efes'},[provider({getSchema:async()=>({fields:[{fieldId:'name'}],capabilities:{query:null}})})]),/desteklemiyor/);
});
test('a selected remote option is resolved even when it is outside the first search page',async()=>{
  const source={...field,options:{...field.options,dependencies:[]}};
  const result=await loadFormOptions(source,{tour:'selected'},[provider({resolveRecords:async()=>[{record:{recordId:'selected',values:{name:'Seçili'}}}]})]);
  assert.deepEqual(result.items,[{value:'selected',label:'Seçili'}]);
});
