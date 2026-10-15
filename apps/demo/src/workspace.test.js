import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageFromTemplate, defaultPageTemplate } from '@blockdesign/core';
import { resetLegacyScalanovaCache, listSavedWorkspacePages, loadBaseViews, updateBaseViewRegion } from './workspace.ts';

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('a clean workspace stays empty without an explicitly requested seed view', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(loadBaseViews(storage), []);
  assert.equal(storage.length, 0);
});

test('legacy import reset backs up dependent cached records and leaves unrelated documents intact', () => {
  const storage=new MemoryStorage();
  storage.setItem('blockdesign:document:old','{"editorState":{"workspaceImportedFrom":"/scalanova-tour/tr/index.html"}}');
  storage.setItem('blockdesign:document:copy','{"blocks":[{"definitionRef":{"id":"block.scalanova-tr-example"}}]}');
  storage.setItem('blockdesign:document:other','{"title":"Independent"}');
  assert.equal(resetLegacyScalanovaCache(storage),2);
  assert.equal(storage.getItem('blockdesign:document:old'),null);
  assert.equal(storage.getItem('blockdesign:document:other'),'{"title":"Independent"}');
  const backup=JSON.parse(storage.getItem('blockdesign:backup:scalanova-reset-20261012-go-cleared'));
  assert.ok(backup['blockdesign:document:old']);
  storage.setItem('blockdesign:document:new','{"path":"/scalanova-tour/tr/new"}');
  assert.equal(resetLegacyScalanovaCache(storage),0);
  assert.ok(storage.getItem('blockdesign:document:new'));
});

test('pages created from a template are independent and only page documents appear in the page list', () => {
  const first = createPageFromTemplate(defaultPageTemplate);
  const second = createPageFromTemplate(defaultPageTemplate);
  first.documentId = 'page-one'; first.revision = '1';
  second.documentId = 'page-two'; second.revision = '1';
  first.editorState.workspaceStage = 'page';
  second.editorState.workspaceStage = 'page';

  const firstPage = first.projectData.pages[0];
  const secondPage = second.projectData.pages[0];
  assert.ok(firstPage && typeof firstPage === 'object' && !Array.isArray(firstPage));
  assert.ok(secondPage && typeof secondPage === 'object' && !Array.isArray(secondPage));
  firstPage.name = 'Ana sayfa';
  firstPage.component.components.push({ type: 'default', tagName: 'section', components: ['İlk sayfaya özel'] });

  assert.equal(secondPage.name, 'Yeni sayfa');
  assert.equal(secondPage.component.components.length, 3);

  const storage = new MemoryStorage();
  storage.setItem('blockdesign:document:page-one', JSON.stringify(first));
  storage.setItem('blockdesign:document:page-two', JSON.stringify(second));
  const templateDraft = createPageFromTemplate(defaultPageTemplate);
  templateDraft.documentId = 'template-draft'; templateDraft.revision = '1';
  templateDraft.editorState.workspaceStage = 'template';
  storage.setItem('blockdesign:document:template-draft', JSON.stringify(templateDraft));
  const blockDraft = createPageFromTemplate(defaultPageTemplate);
  blockDraft.documentId = 'block-draft'; blockDraft.revision = '1'; blockDraft.documentKind = 'blockDraft';
  storage.setItem('blockdesign:document:block-draft', JSON.stringify(blockDraft));

  assert.deepEqual(listSavedWorkspacePages(storage).map((item) => item.title), ['Ana sayfa', 'Yeni sayfa']);
});

test('editing a base view updates only its selected versioned region', () => {
  const storage = new MemoryStorage();
  const initialHeader = { id: 'region.studio-header', version: '1.0.0' };
  const initialFooter = { id: 'region.studio-footer', version: '1.0.0' };
  const [first] = loadBaseViews(storage, { id: 'view.one', name: 'Birinci', headerRef: initialHeader, footerRef: initialFooter });
  const second = { ...first, id: 'view.two', name: 'İkinci' };
  const changed = updateBaseViewRegion(storage, first, 'header', { id: 'region.studio-header', version: '1.0.1' });

  assert.equal(changed.headerRef.version, '1.0.1');
  assert.equal(changed.footerRef.version, initialFooter.version);
  assert.equal(second.headerRef.version, initialHeader.version);
  assert.equal(JSON.parse(storage.getItem('blockdesign:base-view:view.one')).headerRef.version, '1.0.1');
});
