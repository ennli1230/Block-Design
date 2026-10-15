import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoBlockLibraryAdapter, DemoContentProvider, DemoContentProviderFallback, DemoDesignSystemAdapter, DemoSharedRegionAdapter, DemoTemplateAdapter, HttpAssetAdapter, HttpBlockLibraryAdapter, HttpContentProviderAdapter, HttpDesignSystemAdapter, HttpSharedRegionAdapter, HttpTemplateAdapter, LocalStorageBlockLibraryAdapter, LocalStorageDesignSystemAdapter, LocalStorageSharedRegionAdapter, LocalStorageTemplateAdapter } from './index.ts';
import { defaultPageTemplate, defaultSharedRegions } from '../../core/src/templates.ts';

class TestStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

test('HTTP paged query carries opaque cursor, page context and fresh auth without falling back',async()=>{let request;const adapter=new HttpContentProviderAdapter({headers:()=>({'X-Session':'test-session'}),fetcher:async(url,init)=>{request={url,init};return new Response(JSON.stringify({items:[],nextCursor:null}),{headers:{'Content-Type':'application/json'}});}});await adapter.queryPage('posts',{filters:[],sort:null,limit:2},'opaque/+cursor',{page:{siteId:'site-a',route:{category:'news'}}});const body=JSON.parse(request.init.body);assert.equal(body.cursor,'opaque/+cursor');assert.equal(body.page.siteId,'site-a');assert.equal(new Headers(request.init.headers).get('X-Session'),'test-session');const denied=new HttpContentProviderAdapter({fetcher:async()=>new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'No access'}}),{status:403})});await assert.rejects(denied.queryPage('posts',{filters:[],sort:null,limit:2}),/No access/);});
test('locale wrappers preserve pagination and localize values or canonical IDs',async()=>{const {TranslatedFieldsContentProviderAdapter,LocaleMappedContentProviderAdapter}=await import('./index.ts');let observed;const source={providerId:'cms',capabilities:{supported:['queryPage']},queryPage:async(id,query,cursor,context)=>{observed={cursor,context};return {items:[{recordId:'en-1',collectionId:'posts',values:{title:'TR',translations:{en:{title:'English'}}}}],nextCursor:'opaque-next'};}};const query={filters:[],sort:null,limit:1},context={contentLocale:{locale:'en',fallback:{mode:'none'}}};const translated=new TranslatedFieldsContentProviderAdapter(source,{baseLocale:'tr',queryLocaleAware:true});const result=await translated.queryPage('posts',query,'opaque-current',context);assert.equal(result.items[0].values.title,'English');assert.equal(result.nextCursor,'opaque-next');assert.equal(observed.cursor,'opaque-current');assert.equal(new TranslatedFieldsContentProviderAdapter(source,{baseLocale:'tr'}).capabilities.supported.includes('queryPage'),false);const mapped=new LocaleMappedContentProviderAdapter(source,{mapLocale:()=> 'en_US',mapRecordRef:(_,ref)=>'en-'+ref,canonicalRecordRef:(_,ref)=>ref.slice(3)});const mappedResult=await mapped.queryPage('posts',query,'opaque-current',context);assert.equal(observed.context.contentLocale.locale,'en_US');assert.equal(mappedResult.items[0].recordId,'1');assert.equal(mappedResult.nextCursor,'opaque-next');});

function definition(id = 'custom.faq') {
  return {
    ref: { id, version: '1.0.0' },
    designSystemRef: { id: 'system.studio-neutral', version: '1.0.0' },
    name: 'Özel SSS', description: 'Özel soru listesi', category: 'İçerik', preview: 'custom',
    componentTemplate: { type: 'default', tagName: 'section', attributes: {}, components: [] },
    fields: [], repeaters: [], defaultData: {},
    stylePolicy: { allowedProperties: [], structuralEdits: false },
    sourceCapabilities: { modes: ['manual'], target: 'block' }, archived: false,
  };
}

test('local block library preserves custom definitions across adapter instances and filters by design system', async () => {
  const storage = new TestStorage();
  const local = new LocalStorageBlockLibraryAdapter(storage);
  const saved = definition();
  await local.create(saved);

  const reloaded = new LocalStorageBlockLibraryAdapter(storage);
  const result = await reloaded.list({ designSystemRef: saved.designSystemRef });
  assert.deepEqual(result.items.map((item) => item.ref), [saved.ref]);
  assert.deepEqual(await reloaded.getVersion(saved.ref), saved);
  assert.equal((await reloaded.list({ designSystemRef: { id: 'other', version: '1.0.0' } })).items.length, 0);
});

test('demo block library falls back to local persistence when the reference API is unreachable', async () => {
  const storage = new TestStorage();
  const library = new DemoBlockLibraryAdapter({
    baseUrl: 'http://127.0.0.1:8080/api/v1',
    fetcher: async () => { throw new TypeError('network unavailable'); },
    storage,
  });
  const saved = definition('custom.banner');

  await library.create(saved);
  const result = await library.list({ designSystemRef: saved.designSystemRef });
  assert.equal(library.getStatus(), 'offline');
  assert.deepEqual(result.items.map((item) => item.ref), [saved.ref]);
  assert.deepEqual(await library.getVersion(saved.ref), saved);
  await library.archive(saved.ref, true);
  assert.equal((await library.list({ designSystemRef: saved.designSystemRef })).items.length, 0);
  assert.equal((await library.getVersion(saved.ref)).archived, true);
});

test('HTTP block adapter archives a pinned version through an explicit metadata update', async () => {
  let request;
  const adapter = new HttpBlockLibraryAdapter({
    baseUrl: '/api/v1',
    fetcher: async (url, init) => { request = { url, init, body: JSON.parse(String(init.body)) }; return Response.json({ archived: true }); },
  });
  await adapter.archive({ id: 'custom.faq', version: '1.2.3' }, true);
  assert.ok(adapter.capabilities.supported.includes('archive'));
  assert.equal(request.url, '/api/v1/blocks/custom.faq/versions/1.2.3');
  assert.equal(request.init.method, 'PATCH');
  assert.deepEqual(request.body, { archived: true });
});

test('HTTP block adapter requests permanent deletion through the reference-checked endpoint', async () => {
  let request;
  const adapter = new HttpBlockLibraryAdapter({ baseUrl: '/api/v1', fetcher: async (url, init) => { request = { url, init }; return new Response(null, { status: 204 }); } });
  await adapter.delete({ id: 'custom.faq', version: '1.2.3' });
  assert.equal(request.url, '/api/v1/blocks/custom.faq/versions/1.2.3');
  assert.equal(request.init.method, 'DELETE');
  assert.ok(adapter.capabilities.supported.includes('deleteUnused'));
});

test('local block deletion checks page and template references before removing the version', async () => {
  const storage = new TestStorage();
  const adapter = new LocalStorageBlockLibraryAdapter(storage);
  const saved = definition('custom.delete-safe');
  await adapter.create(saved);
  storage.setItem('blockdesign:document:page-1', JSON.stringify({ blocks: [{ definitionRef: saved.ref }] }));
  await assert.rejects(adapter.delete(saved.ref), (error) => error.status === 409 && error.code === 'VERSION_IN_USE');
  storage.removeItem('blockdesign:document:page-1');
  storage.setItem('blockdesign:template:template-1', JSON.stringify({ mandatoryBlockIds: [saved.ref.id] }));
  await assert.rejects(adapter.delete(saved.ref), (error) => error.status === 409 && error.code === 'VERSION_IN_USE');
  storage.removeItem('blockdesign:template:template-1');
  await adapter.delete(saved.ref);
  await assert.rejects(adapter.getVersion(saved.ref), (error) => error.status === 404);
});

test('offline-capable block adapter checks local references before deleting the remote version', async () => {
  const storage = new TestStorage();
  const library = new DemoBlockLibraryAdapter({ storage, fetcher: async () => { throw new TypeError('offline'); } });
  const saved = definition('custom.offline-safe');
  await library.create(saved);
  storage.setItem('blockdesign:document:page-2', JSON.stringify({ blocks: [{ definitionRef: saved.ref }] }));
  await assert.rejects(library.delete(saved.ref), (error) => error.status === 409 && error.code === 'VERSION_IN_USE');
  assert.equal((await library.getVersion(saved.ref)).ref.id, saved.ref.id);
});

test('demo block adapter can manage a browser-local version while the server is online', async () => {
  const storage = new TestStorage();
  const saved = definition('custom.local-only');
  await new LocalStorageBlockLibraryAdapter(storage).create(saved);
  const missing = () => Response.json({ error: { code: 'NOT_FOUND', message: 'missing', recoverable: true } }, { status: 404 });
  const adapter = new DemoBlockLibraryAdapter({ storage, fetcher: async () => missing() });
  assert.equal((await adapter.getVersion(saved.ref)).name, saved.name);
  await adapter.archive(saved.ref, true);
  assert.equal((await adapter.getVersion(saved.ref)).archived, true);
  await adapter.delete(saved.ref);
  await assert.rejects(adapter.getVersion(saved.ref), (error) => error.status === 404);
});

test('demo provider supports search, ordered record resolution, and capability-limited queries', async () => {
  const provider = new DemoContentProvider();
  const collections = await provider.listCollections();
  assert.ok(collections.some((item) => item.collectionId === 'slider'));
  const faq = collections.find((item) => item.collectionId === 'faq');
  assert.equal(faq.capabilities.recordSelection, true);
  assert.equal(faq.capabilities.recordGroups, true);
  assert.ok(faq.capabilities.query);
  const searched = await provider.search('faq', 'başlangıç');
  assert.equal(searched.items.length, 2);
  const selected = await provider.resolveRecords('faq', ['faq-save', 'faq-start']);
  assert.deepEqual(selected.map((item) => item.record.values.title), ['Sayfalar nasıl kaydedilir?', 'Nasıl başlayabilirim?']);
  const groups = await provider.listGroups('faq');
  assert.equal(groups[0].label, 'Başlangıç soruları');
  assert.deepEqual((await provider.resolveGroup('faq', groups[0].groupId)).map((item) => item.recordId), ['faq-start', 'faq-save']);
  const queried = await provider.query('faq', { filters: [{ fieldId: 'category', operator: 'eq', value: 'Başlangıç' }], sort: { fieldId: 'title', direction: 'asc' }, limit: 1 });
  assert.equal(queried.items.length, 1);
  await assert.rejects(provider.query('faq', { filters: [{ fieldId: 'body', operator: 'eq', value: 'x' }], sort: null, limit: 1 }), /filtre desteklenmiyor/);
});

test('reference HTTP provider falls back to demo records when the API is offline', async () => {
  const remote = new HttpContentProviderAdapter({ baseUrl: 'http://127.0.0.1:8080/api/v1', fetcher: async () => { throw new TypeError('offline'); } });
  const provider = new DemoContentProviderFallback(remote);
  const collections = await provider.listCollections();
  assert.equal(provider.getStatus(), 'offline');
  assert.deepEqual(collections.map((item) => item.collectionId), ['menus', 'languages', 'faq', 'cards', 'slider']);
  const result = await provider.query('faq', { filters: [{ fieldId: 'category', operator: 'eq', value: 'Başlangıç' }], sort: null, limit: 2 });
  assert.equal(result.items.length, 2);
  const groups = await provider.listGroups('faq');
  assert.equal(groups.length, 2);
  assert.equal((await provider.resolveGroup('faq', groups[0].groupId)).length, 2);
  const slider = await provider.getSchema('slider');
  assert.deepEqual(slider.fields.map((field) => field.fieldId), ['image', 'alt', 'title', 'description', 'url']);
  assert.deepEqual((await provider.resolveGroup('slider', 'slider.featured')).map((item) => item.recordId), ['slide-route', 'slide-design']);
});

test('local page templates preserve versions and archive without removing references', async () => {
  const storage = new TestStorage();
  const adapter = new LocalStorageTemplateAdapter(storage, [defaultPageTemplate]);
  const ref = defaultPageTemplate.ref;
  await adapter.archive(ref, true);
  assert.equal((await adapter.list({ designSystemRef: defaultPageTemplate.designSystemRef })).items.length, 0);
  assert.equal((await adapter.getVersion(ref)).archived, true);
  await adapter.archive(ref, false);
  assert.equal((await adapter.list({ designSystemRef: defaultPageTemplate.designSystemRef })).items.length, 1);
});

test('HTTP template adapter sends injected auth headers and supports version archive', async () => {
  const calls = [];
  const adapter = new HttpTemplateAdapter({
    baseUrl: 'https://backend.example/api/v1',
    headers: () => ({ Authorization: 'Bearer test-token' }),
    fetcher: async (url, init = {}) => { calls.push({ url, init }); return Response.json({ items: [], nextCursor: null }); },
  });
  const system = { id: 'system.demo', version: '1.0.0' };
  await adapter.list({ designSystemRef: system });
  await adapter.archive({ id: 'template.site', version: '1.0.0' }, true);
  assert.match(calls[0].url, /\/templates\?systemId=system.demo&systemVersion=1.0.0$/);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[1].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].init.body), { archived: true });
});

test('demo template adapter falls back to local versions when the reference API is offline', async () => {
  const storage = new TestStorage();
  const adapter = new DemoTemplateAdapter({
    baseUrl: 'http://127.0.0.1:8080/api/v1', storage, initial: [defaultPageTemplate],
    fetcher: async () => { throw new TypeError('offline'); },
  });
  const listed = await adapter.list({ designSystemRef: defaultPageTemplate.designSystemRef });
  assert.equal(adapter.getStatus(), 'offline');
  assert.deepEqual(listed.items.map((item) => item.ref), [defaultPageTemplate.ref]);
  const next = { ...structuredClone(defaultPageTemplate), ref: { id: 'template.campaign', version: '1.0.0' }, name: 'Campaign' };
  await adapter.create(next);
  assert.equal((await new DemoTemplateAdapter({ storage }).getVersion(next.ref)).name, 'Campaign');
});

test('shared region adapters retain versions and use a separate HTTP resource path', async () => {
  const storage = new TestStorage();
  const region = { ref: { id: 'region.header', version: '1.0.0' }, designSystemRef: { id: 'system.demo', version: '1.0.0' }, name: 'Header', region: 'header', componentTemplate: {}, fields: [], archived: false };
  const local = new LocalStorageSharedRegionAdapter(storage, [region]);
  assert.deepEqual((await local.list({ designSystemRef: region.designSystemRef })).items.map((item) => item.ref), [region.ref]);
  await local.archive(region.ref, true);
  assert.equal((await local.getVersion(region.ref)).archived, true);

  let request;
  const remote = new HttpSharedRegionAdapter({
    baseUrl: '/api/v1',
    fetcher: async (url, init) => { request = { url, init }; return Response.json(region); },
  });
  await remote.getVersion(region.ref);
  assert.equal(request.url, '/api/v1/shared-regions/region.header/versions/1.0.0');
});

test('demo shared-region adapter exposes seeded header/footer versions and offline writes', async () => {
  const storage = new TestStorage();
  const adapter = new DemoSharedRegionAdapter({ storage, initial: defaultSharedRegions, fetcher: async () => { throw new TypeError('offline'); } });
  const first = defaultSharedRegions[0];
  assert.equal((await adapter.list({ designSystemRef: first.designSystemRef })).items.length, 2);
  assert.equal(adapter.getStatus(), 'offline');
  await adapter.archive(first.ref, true);
  assert.equal((await new DemoSharedRegionAdapter({ storage }).getVersion(first.ref)).archived, true);
});

test('design-system asset manifest persists common CSS and rejects stale revision writes', async () => {
  const storage = new TestStorage();
  const ref = { id: 'system.brand', version: '1.0.0' };
  const adapter = new LocalStorageDesignSystemAdapter(storage);
  const fresh = await adapter.load(ref);
  assert.equal(fresh.commonCss, '');
  const first = await adapter.save({ ...fresh, name: 'Brand', commonCss: ':root { --brand: #345b4c; }', stylesheets: ['https://fonts.example.test/brand.css'] }, null);
  const loaded = await adapter.load(ref);
  assert.equal(loaded.commonCss, ':root { --brand: #345b4c; }');
  assert.equal(loaded.revision, first.revision);
  await assert.rejects(() => adapter.save({ ...loaded, commonCss: 'body { color: red; }' }, null), (error) => error.status === 409);
});

test('HTTP design-system manifest uses optimistic revision headers and decodes the remote resource', async () => {
  const calls = [];
  const ref = { id: 'system.remote', version: '2.0.0' };
  const manifest = { ref, name: 'Remote', commonCss: ':root { --brand: green; }', stylesheets: [], revision: '3' };
  const adapter = new HttpDesignSystemAdapter({
    baseUrl: 'https://backend.example/api/v1',
    headers: () => ({ Authorization: 'Bearer test-token' }),
    fetcher: async (url, init = {}) => {
      calls.push({ url, init });
      return init.method === 'PUT' ? Response.json({ revision: '4' }) : Response.json(manifest);
    },
  });
  assert.deepEqual(await adapter.load(ref), manifest);
  const saved = await adapter.save(manifest, '3');
  assert.deepEqual(saved, { revision: '4' });
  assert.match(calls[0].url, /\/design-systems\/system.remote\/versions\/2.0.0\/assets$/);
  assert.equal(calls[1].init.method, 'PUT');
  assert.equal(calls[1].init.headers.get('If-Match'), '"3"');
  assert.equal(calls[1].init.headers.get('Authorization'), 'Bearer test-token');
});

test('demo design-system manifest falls back to browser storage while the API is offline', async () => {
  const storage = new TestStorage();
  const adapter = new DemoDesignSystemAdapter({ storage, fetcher: async () => { throw new TypeError('offline'); } });
  const ref = { id: 'system.offline', version: '1.0.0' };
  const manifest = { ref, name: 'Offline', commonCss: 'body { color: green; }', stylesheets: [], revision: null };
  assert.equal((await adapter.load(ref)).revision, null);
  const saved = await adapter.save(manifest, null);
  assert.equal(saved.revision, '1');
  assert.equal((await new DemoDesignSystemAdapter({ storage }).load(ref)).commonCss, manifest.commonCss);
});

test('HTTP asset adapter searches, resolves, uploads and normalizes stable asset URLs', async () => {
  const calls = [];
  const record = { assetId: 'asset-123', url: 'assets/asset-123/content', mimeType: 'image/png', alt: 'Logo', width: 2, height: 1 };
  const adapter = new HttpAssetAdapter({
    baseUrl: 'https://backend.example/custom/api/v1',
    headers: () => ({ Authorization: 'Bearer test-token' }),
    fetcher: async (url, init = {}) => {
      calls.push({ url, init });
      if (init.method === 'POST') return Response.json(record, { status: 201 });
      if (url.includes('/assets?')) return Response.json({ items: [record], nextCursor: null });
      return Response.json(record);
    },
  });
  assert.equal((await adapter.search('logo')).items[0].url, 'https://backend.example/custom/api/v1/assets/asset-123/content');
  assert.equal((await adapter.resolve('asset-123')).assetId, 'asset-123');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' });
  const uploaded = await adapter.upload(file);
  assert.equal(uploaded.url, 'https://backend.example/custom/api/v1/assets/asset-123/content');
  assert.equal(calls[2].init.method, 'POST');
  assert.equal(calls[2].init.body.get('file').name, 'logo.png');
  assert.equal(calls[2].init.body.get('alt'), 'logo.png');
  assert.equal(calls[2].init.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[2].init.headers['Content-Type'], undefined);
});
