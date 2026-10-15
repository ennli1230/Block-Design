import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpFormProviderAdapter, HttpFormActionAdapter } from './forms.ts';

const request={providerId:'cms',formRef:{id:'contact',version:'1'},actionId:'contact',kind:'submit',values:{email:'a@example.com'},context:{},submissionId:'same-request'};
test('form HTTP adapters keep routes and per-request auth in the host and forward locale and idempotency',async()=>{
  const calls=[];let token='first';const fetcher=async(url,init)=>{calls.push({url,init});return Response.json(init.method==='POST'?{kind:'accepted',receiptId:'one'}:{items:[],nextCursor:null});};
  const options={baseUrl:'https://cms.example/editor',fetcher,headers:()=>({Authorization:'Bearer '+token})};
  await new HttpFormProviderAdapter({...options,providerId:'cms'}).listForms({contentLocale:{locale:'tr',fallback:{mode:'none'}}});
  token='second';const result=await new HttpFormActionAdapter({...options,adapterId:'cms'}).execute(request);
  assert.match(calls[0].url,/\/forms\?locale=tr$/);assert.equal(calls[1].init.headers.get('Authorization'),'Bearer second');assert.equal(calls[1].init.headers.get('Idempotency-Key'),'same-request');assert.equal(result.receiptId,'one');assert.equal(JSON.stringify(request).includes('Bearer'),false);
});
test('422 field errors and changed schemas are results; unavailable POSTs are never retried or cached',async()=>{
  for(const [status,body] of [[422,{kind:'validationError',fieldErrors:{email:['Geçersiz']}}],[409,{kind:'schemaChanged',message:'Güncelleyin'}]]){
    const adapter=new HttpFormActionAdapter({baseUrl:'/api',adapterId:'cms',fetcher:async()=>Response.json(body,{status})});assert.equal((await adapter.execute(request)).kind,body.kind);
  }
  let count=0;const adapter=new HttpFormActionAdapter({baseUrl:'/api',adapterId:'cms',fetcher:async()=>{count++;throw new TypeError('offline');}});
  await assert.rejects(adapter.execute(request),/offline/);assert.equal(count,1);
});
test('successful HTTP status without a recognized result does not mean a successful submission',async()=>{
  const adapter=new HttpFormActionAdapter({baseUrl:'/api',adapterId:'cms',fetcher:async()=>Response.json({ok:true})});await assert.rejects(adapter.execute(request),/tanınmayan/);
});
