import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneBlockInstance, createEmptyDocument, makeInstance, resolveDocumentSources, updateRepeater, validateBlock, validateFieldValue } from './index.ts';
import { faqDefinition } from './catalog.ts';
import { applySharedRegions, createPageFromTemplate, createTemplateFromDocument, defaultPageTemplate, defaultSharedRegions, migrateSharedRegionValues, missingMandatoryBlockIds, templateAllowsCategory } from './templates.ts';

test('repeater operations preserve stable unique identities and independent block data', () => {
  const first = makeInstance(faqDefinition);
  const second = makeInstance(faqDefinition);
  const repeater = faqDefinition.repeaters[0];
  const initial = first.manualData[repeater.key];
  const withAdded = updateRepeater(first, repeater, { type: 'add', values: { question: 'Yeni soru', answer: 'Yeni yanıt' } });
  const added = withAdded.manualData[repeater.key];
  assert.equal(added.length, initial.length + 1);
  assert.notEqual(added.at(-1).__id, initial[0].__id);

  const withCopy = updateRepeater(withAdded, repeater, { type: 'duplicate', itemId: String(added[0].__id) });
  const copied = withCopy.manualData[repeater.key];
  assert.deepEqual(copied.slice(0, 2).map((row) => row.question), [added[0].question, added[0].question]);
  assert.notEqual(copied[0].__id, copied[1].__id);

  const moved = updateRepeater(withCopy, repeater, { type: 'move', itemId: String(copied[0].__id), direction: 1 });
  assert.equal(moved.manualData[repeater.key][1].__id, copied[0].__id);
  assert.equal(second.manualData[repeater.key].length, initial.length);
  assert.deepEqual(validateBlock(moved, faqDefinition), []);
});

test('cloning a block preserves its settings but gives it independent block, row, and source identities', () => {
  const source = makeInstance(faqDefinition);
  source.manualData.title = 'Özel başlık';
  source.sourceBindings = [{
    bindingId: 'binding-source', target: { scope: 'field', id: 'faq.title' }, mode: 'selection', providerId: 'demo', collectionId: 'faq', schemaVersion: '1',
    recordRefs: ['record-1'], groupRef: null, query: null, fieldMappings: [{ from: 'title', to: 'title' }],
  }];

  const copy = cloneBlockInstance(source, faqDefinition);

  assert.equal(copy.manualData.title, 'Özel başlık');
  assert.notEqual(copy.instanceId, source.instanceId);
  assert.deepEqual(copy.manualData.items.map((row) => row.question), source.manualData.items.map((row) => row.question));
  assert.ok(copy.manualData.items.every((row, index) => row.__id !== source.manualData.items[index].__id));
  assert.notEqual(copy.sourceBindings[0].bindingId, source.sourceBindings[0].bindingId);
  copy.manualData.title = 'Kopya başlığı';
  copy.manualData.items[0].question = 'Kopya sorusu';
  assert.equal(source.manualData.title, 'Özel başlık');
  assert.notEqual(source.manualData.items[0].question, copy.manualData.items[0].question);
});

test('repeater limits and required field checks reject invalid saves', () => {
  const repeater = faqDefinition.repeaters[0];
  const block = makeInstance(faqDefinition);
  const rows = block.manualData[repeater.key];
  const tooMany = { ...block, manualData: { ...block.manualData, [repeater.key]: Array.from({ length: repeater.maxItems + 1 }, (_, index) => ({ __id: `item-${index}`, question: 'Soru', answer: 'Yanıt' })) } };
  assert.ok(validateBlock(tooMany, faqDefinition).some((issue) => issue.code === 'REPEATER_LIMIT'));
  assert.equal(validateFieldValue(repeater.itemFields[0], '', 'question')[0]?.code, 'FIELD_REQUIRED');
  assert.ok(rows.length >= repeater.minItems);
});

test('query bindings resolve to an ephemeral repeater copy without replacing saved manual content', async () => {
  const document = createEmptyDocument();
  const block = makeInstance(faqDefinition);
  const original = structuredClone(block.manualData.items);
  block.sourceBindings = [{
    bindingId: 'binding-query', target: { scope: 'repeater', id: 'faq.items' }, mode: 'query', providerId: 'demo', collectionId: 'faq', schemaVersion: '1', recordRefs: [], groupRef: null,
    query: { filters: [{ fieldId: 'category', operator: 'eq', value: 'Başlangıç' }], sort: { fieldId: 'title', direction: 'asc' }, limit: 2 },
    fieldMappings: [{ from: 'title', to: 'question' }, { from: 'body', to: 'answer' }],
  }];
  document.blocks.push(block);
  const provider = {
    providerId: 'demo', capabilities: { supported: ['query'] },
    async getSchema() { return { capabilities: { recordSelection: true, recordGroups: true, query: { filterFields: [{ fieldId: 'category', operators: ['eq'] }], sortFields: ['title'], maxLimit: 10 } } }; },
    async query(_collectionId, query) {
      assert.equal(query.limit, 2);
      return { items: [
        { recordId: 'a', collectionId: 'faq', values: { title: 'A', body: 'Yanıt A' } },
        { recordId: 'b', collectionId: 'faq', values: { title: 'B', body: 'Yanıt B' } },
      ], nextCursor: null };
    },
  };
  const resolved = await resolveDocumentSources(document, new Map([[`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition]]), [provider]);
  assert.deepEqual(resolved.document.blocks[0].manualData.items.map((row) => row.question), ['A', 'B']);
  assert.equal(resolved.document.blocks[0].manualData.items[0].answer, 'Yanıt A');
  assert.deepEqual(document.blocks[0].manualData.items, original);
  assert.equal(resolved.issues.length, 0);
});

test('field bindings resolve one provider value without replacing the saved manual field', async () => {
  const document = createEmptyDocument();
  const block = makeInstance(faqDefinition);
  const manualTitle = block.manualData.title;
  block.sourceBindings = [{
    bindingId: 'binding-title', target: { scope: 'field', id: 'faq.title' }, mode: 'query', providerId: 'demo', collectionId: 'faq', schemaVersion: '1', recordRefs: [], groupRef: null,
    query: { filters: [], sort: null, limit: 1 }, fieldMappings: [{ from: 'title', to: 'title' }],
  }];
  document.blocks.push(block);
  const provider = {
    providerId: 'demo', capabilities: { supported: ['query'] },
    async getSchema() { return { capabilities: { recordSelection: true, recordGroups: true, query: { filterFields: [], sortFields: [], maxLimit: 10 } } }; },
    async query(_collectionId, query) {
      assert.equal(query.limit, 1);
      return { items: [{ recordId: 'record-1', collectionId: 'faq', values: { title: 'Sağlayıcı başlığı' } }], nextCursor: null };
    },
  };
  const resolved = await resolveDocumentSources(document, new Map([[`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition]]), [provider]);
  assert.equal(resolved.document.blocks[0].manualData.title, 'Sağlayıcı başlığı');
  assert.equal(document.blocks[0].manualData.title, manualTitle);
  assert.equal(resolved.issues.length, 0);
});

test('block bindings populate fields and repeaters while preserving manual data and explicit target overrides', async () => {
  const definition = structuredClone(faqDefinition);
  definition.sourceCapabilities.target = ['block', 'field', 'repeater'];
  const block = makeInstance(definition);
  const manualTitle = block.manualData.title;
  const manualItems = structuredClone(block.manualData.items);
  block.sourceBindings = [{
    bindingId: 'block-source', target: { scope: 'block', id: 'block' }, mode: 'query', providerId: 'demo', collectionId: 'faq', schemaVersion: '1', recordRefs: [], groupRef: null,
    query: { filters: [], sort: null, limit: 2 },
    fieldMappings: [{ from: 'title', to: 'title' }, { from: 'title', to: 'items.question' }, { from: 'body', to: 'items.answer' }],
  }, {
    bindingId: 'manual-title', target: { scope: 'field', id: 'title' }, mode: 'manual', providerId: null, collectionId: null, schemaVersion: null, recordRefs: [], groupRef: null, query: null, fieldMappings: [],
  }];
  const document = createEmptyDocument();
  document.blocks.push(block);
  const records = [
    { recordId: 'one', collectionId: 'faq', values: { title: 'Remote one', body: 'Answer one' } },
    { recordId: 'two', collectionId: 'faq', values: { title: 'Remote two', body: 'Answer two' } },
  ];
  const provider = {
    providerId: 'demo', capabilities: { supported: ['query'] },
    async getSchema() { return { capabilities: { query: { filterFields: [], sortFields: [], maxLimit: 10 } } }; },
    async query() { return { items: records, nextCursor: null }; },
  };
  const resolved = await resolveDocumentSources(document, new Map([[`${definition.ref.id}@${definition.ref.version}`, definition]]), [provider]);
  assert.equal(resolved.document.blocks[0].manualData.title, manualTitle, 'an explicit manual field binding wins over the block default');
  assert.deepEqual(resolved.document.blocks[0].manualData.items.map((row) => [row.question, row.answer]), [['Remote one', 'Answer one'], ['Remote two', 'Answer two']]);
  assert.equal(document.blocks[0].manualData.title, manualTitle);
  assert.deepEqual(document.blocks[0].manualData.items, manualItems);
});

test('selection bindings merge an ordered provider record group with selected records', async () => {
  const document = createEmptyDocument();
  const block = makeInstance(faqDefinition);
  block.sourceBindings = [{
    bindingId: 'binding-group', target: { scope: 'repeater', id: 'faq.items' }, mode: 'selection', providerId: 'demo', collectionId: 'faq', schemaVersion: '1', recordRefs: ['faq-backend'], groupRef: 'faq.getting-started', query: null,
    fieldMappings: [{ from: 'title', to: 'question' }, { from: 'body', to: 'answer' }],
  }];
  document.blocks.push(block);
  const makeRecord = (recordId, title) => ({ recordId, collectionId: 'faq', values: { title, body: `Yanıt: ${title}` } });
  const provider = {
    providerId: 'demo', capabilities: { supported: ['resolveRecords', 'recordGroups'] },
    async getSchema() { return { capabilities: { recordSelection: true, recordGroups: true, query: null } }; },
    async resolveGroup(_collectionId, groupId) {
      assert.equal(groupId, 'faq.getting-started');
      return [makeRecord('faq-start', 'Başla'), makeRecord('faq-save', 'Kaydet')];
    },
    async resolveRecords(_collectionId, recordRefs) {
      return recordRefs.map((recordId) => ({ recordId, record: makeRecord(recordId, 'Entegrasyon') }));
    },
  };
  const resolved = await resolveDocumentSources(document, new Map([[`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition]]), [provider]);
  assert.deepEqual(resolved.document.blocks[0].manualData.items.map((row) => row.question), ['Başla', 'Kaydet', 'Entegrasyon']);
  assert.equal(resolved.issues.length, 0);
});

test('source resolver rejects a query that exceeds provider capabilities', async () => {
  const document = createEmptyDocument();
  const block = makeInstance(faqDefinition);
  block.sourceBindings = [{
    bindingId: 'binding-invalid-query', target: { scope: 'repeater', id: 'faq.items' }, mode: 'query', providerId: 'demo', collectionId: 'faq', schemaVersion: '1', recordRefs: [], groupRef: null,
    query: { filters: [{ fieldId: 'hidden', operator: 'eq', value: 'x' }], sort: { fieldId: 'title', direction: 'asc' }, limit: 100 },
    fieldMappings: [{ from: 'title', to: 'question' }],
  }];
  document.blocks.push(block);
  let queryCalled = false;
  const provider = {
    providerId: 'demo', capabilities: { supported: ['query'] },
    async getSchema() { return { capabilities: { recordSelection: false, recordGroups: false, query: { filterFields: [], sortFields: ['title'], maxLimit: 5 } } }; },
    async query() { queryCalled = true; return { items: [], nextCursor: null }; },
  };
  const resolved = await resolveDocumentSources(document, new Map([[`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition]]), [provider]);
  assert.equal(queryCalled, false);
  assert.equal(resolved.issues[0]?.code, 'SOURCE_RESOLUTION_FAILED');
  assert.match(resolved.issues[0]?.message ?? '', /filtre|aşamaz/i);
});

test('source resolver reports values with the wrong destination field type', async () => {
  const document = createEmptyDocument();
  const block = makeInstance(faqDefinition);
  block.sourceBindings = [{
    bindingId: 'binding-invalid-field', target: { scope: 'field', id: 'faq.title' }, mode: 'selection', providerId: 'demo', collectionId: 'faq', schemaVersion: '1', recordRefs: ['record-1'], groupRef: null,
    query: null, fieldMappings: [{ from: 'enabled', to: 'title' }],
  }];
  document.blocks.push(block);
  const provider = {
    providerId: 'demo', capabilities: { supported: ['resolveRecords'] },
    async getSchema() { return { capabilities: { recordSelection: true, recordGroups: false, query: null } }; },
    async resolveRecords() { return [{ recordId: 'record-1', record: { recordId: 'record-1', collectionId: 'faq', values: { enabled: true } } }]; },
  };
  const resolved = await resolveDocumentSources(document, new Map([[`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition]]), [provider]);
  assert.equal(resolved.document.blocks[0].manualData.title, block.manualData.title);
  assert.equal(resolved.issues[0]?.code, 'SOURCE_FIELD_TYPE_INVALID');
});

test('page templates create locked header/footer slots and remove old page block instances when saved', () => {
  const page = createPageFromTemplate(defaultPageTemplate);
  assert.deepEqual(page.templateRef, defaultPageTemplate.ref);
  assert.deepEqual(page.sharedRegionRefs, defaultPageTemplate.sharedRegionRefs);
  const layout = page.projectData.pages[0].component;
  assert.equal(layout.components[0].attributes['data-bd-locked'], 'true');
  assert.equal(layout.components[1].attributes['data-bd-template-slot'], 'content-main');
  assert.equal(layout.components[2].attributes['data-bd-locked'], 'true');

  const document = { ...page, projectData: { pages: [{ name: 'Page', component: { type: 'wrapper', components: [
    layout.components[0], layout.components[1], { type: 'default', tagName: 'div', attributes: { 'data-bd-placeholder-id': 'old-block' }, components: [] }, layout.components[2],
  ] } }] } };
  const saved = createTemplateFromDocument('Test', document, 'template.test');
  assert.equal(saved.layout.pages[0].component.components.some((item) => item.attributes?.['data-bd-placeholder-id']), false);
});

test('workspace templates preserve authored blocks and give each new page independent block and repeater identities', () => {
  const page = createPageFromTemplate(defaultPageTemplate);
  const block = makeInstance(faqDefinition);
  page.blocks = [block];
  page.projectData.pages[0].component.components[1].components.push({
    type: 'default', tagName: 'div', attributes: { 'data-bd-placeholder-id': block.instanceId, 'data-bd-placeholder-definition': `${block.definitionRef.id}@${block.definitionRef.version}` }, components: [],
  });
  const saved = createTemplateFromDocument('Ana sayfa', page, 'template.home', true);
  assert.equal(saved.blocks.length, 1);
  assert.equal(saved.layout.pages[0].component.components[1].components[0].attributes['data-bd-placeholder-id'], block.instanceId);

  const first = createPageFromTemplate(saved);
  const second = createPageFromTemplate(saved);
  const firstBlock = first.blocks[0];
  const secondBlock = second.blocks[0];
  assert.notEqual(firstBlock.instanceId, block.instanceId);
  assert.notEqual(firstBlock.instanceId, secondBlock.instanceId);
  const repeater = faqDefinition.repeaters[0];
  assert.notEqual(firstBlock.manualData[repeater.key][0].__id, block.manualData[repeater.key][0].__id);
  firstBlock.manualData.title = 'Yalnızca ilk sayfada';
  const firstPlaceholder = first.projectData.pages[0].component.components[1].components[0];
  assert.equal(firstPlaceholder.attributes['data-bd-placeholder-id'], firstBlock.instanceId);
  assert.equal(secondBlock.manualData.title, block.manualData.title);
});

test('shared region application pins the selected header version and keeps its structure locked', () => {
  const page = createPageFromTemplate(defaultPageTemplate);
  const alternate = {
    ref: { id: 'region.brand-header', version: '2.1.0' },
    designSystemRef: defaultPageTemplate.designSystemRef,
    name: 'Brand header', region: 'header', fields: [], archived: false,
    componentTemplate: { type: 'default', tagName: 'header', attributes: { class: 'brand-header' }, components: [{ type: 'default', tagName: 'h1', components: ['Brand'] }] },
  };
  const next = applySharedRegions(page.projectData, [alternate]);
  const components = next.pages[0].component.components;
  assert.equal(components[0].attributes['data-bd-region-ref'], 'region.brand-header@2.1.0');
  assert.equal(components[0].attributes['data-bd-locked'], 'true');
  assert.equal(components[0].attributes.class, 'brand-header');
  assert.equal(components[1].attributes['data-bd-template-slot'], 'content-main');
});

test('shared region fields render from per-page values without mutating the version definition', () => {
  const page = createPageFromTemplate(defaultPageTemplate);
  const header = defaultSharedRegions.find((region) => region.region === 'header');
  assert.ok(header);
  const values = { [`${header.ref.id}@${header.ref.version}`]: { brand: 'Northstar', homeUrl: '/start', firstLinkLabel: 'Work', firstLinkUrl: '/work', secondLinkLabel: 'About', secondLinkUrl: '/about' } };
  const next = applySharedRegions(page.projectData, [header], values);
  const root = next.pages[0].component.components[0];
  const brand = root.components[0];
  assert.equal(brand.components[0], 'Northstar');
  assert.equal(brand.attributes.href, '/start');
  assert.equal(root.components[1].components[0].components[0], 'Work');
  assert.equal(header.componentTemplate.components[0].components[0], 'studio');
  assert.equal(applySharedRegions(page.projectData, [header]).pages[0].component.components[0].components[0].components[0], 'studio');
});

test('shared region version migration carries compatible values and reports fields that need review', () => {
  const previous = defaultSharedRegions.find((region) => region.region === 'header');
  assert.ok(previous);
  const next = structuredClone(previous);
  next.ref = { ...previous.ref, version: '1.0.1' };
  next.fields = [
    ...next.fields.filter((field) => field.key !== 'firstLinkLabel'),
    { fieldId: 'field.header.new-label', key: 'announcement', label: 'Duyuru', type: 'text', required: false, defaultValue: 'Yakında', mappingTarget: { nodeId: 'header-brand', operation: 'text' } },
  ];
  const values = { brand: 'Northstar', homeUrl: '/start', firstLinkLabel: 'Çalışma', firstLinkUrl: '/work', secondLinkLabel: 'About', secondLinkUrl: '/about' };
  const migration = migrateSharedRegionValues(previous, next, values);
  assert.equal(migration.values.brand, 'Northstar');
  assert.equal(migration.values.homeUrl, '/start');
  assert.equal(migration.values.announcement, 'Yakında');
  assert.deepEqual(migration.carried, ['brand', 'homeUrl', 'firstLinkUrl', 'secondLinkLabel', 'secondLinkUrl']);
  assert.deepEqual(migration.initialized, ['announcement']);
  assert.deepEqual(migration.removed, ['firstLinkLabel']);
  assert.deepEqual(values, { brand: 'Northstar', homeUrl: '/start', firstLinkLabel: 'Çalışma', firstLinkUrl: '/work', secondLinkLabel: 'About', secondLinkUrl: '/about' });
});

test('template rules enforce allowed categories and report missing mandatory block IDs', () => {
  const template = { ...defaultPageTemplate, allowedBlockCategories: ['İçerik'], mandatoryBlockIds: ['block.banner'] };
  const faqInstance = makeInstance(faqDefinition);
  assert.equal(templateAllowsCategory(template, 'İçerik'), true);
  assert.equal(templateAllowsCategory(template, 'Navigasyon'), false);
  assert.deepEqual(missingMandatoryBlockIds(template, [faqInstance]), ['block.banner']);
  assert.deepEqual(missingMandatoryBlockIds(template, [{ ...faqInstance, definitionRef: { id: 'block.banner', version: '2.0.0' } }]), []);
});
