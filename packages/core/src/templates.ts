import type { BlockInstance, EditorDocument, JsonValue, PageTemplateDefinition, SharedRegionDefinition, VersionRef } from '@blockdesign/contracts';
import { applyTemplateData } from './schema.ts';

const DESIGN_SYSTEM: VersionRef = { id: 'system.studio-neutral', version: '1.0.0' };

const headerRef: VersionRef = { id: 'region.studio-header', version: '1.0.0' };
const footerRef: VersionRef = { id: 'region.studio-footer', version: '1.0.0' };

export const defaultSharedRegions: SharedRegionDefinition[] = [
  {
    ref: headerRef, designSystemRef: DESIGN_SYSTEM, name: 'Studio header', region: 'header', archived: false,
    fields: [
      { fieldId: 'field.header.brand', key: 'brand', label: 'Marka adı', type: 'text', required: true, defaultValue: 'studio', mappingTarget: { nodeId: 'header-brand', operation: 'text' } },
      { fieldId: 'field.header.home', key: 'homeUrl', label: 'Marka bağlantısı', type: 'url', required: true, defaultValue: '/', mappingTarget: { nodeId: 'header-brand', operation: 'attribute', property: 'href' } },
      { fieldId: 'field.header.link1.label', key: 'firstLinkLabel', label: 'İlk bağlantı adı', type: 'text', required: true, defaultValue: 'Keşfet', mappingTarget: { nodeId: 'header-link-1', operation: 'text' } },
      { fieldId: 'field.header.link1.url', key: 'firstLinkUrl', label: 'İlk bağlantı adresi', type: 'url', required: true, defaultValue: '#icerik', mappingTarget: { nodeId: 'header-link-1', operation: 'attribute', property: 'href' } },
      { fieldId: 'field.header.link2.label', key: 'secondLinkLabel', label: 'İkinci bağlantı adı', type: 'text', required: true, defaultValue: 'Hakkında', mappingTarget: { nodeId: 'header-link-2', operation: 'text' } },
      { fieldId: 'field.header.link2.url', key: 'secondLinkUrl', label: 'İkinci bağlantı adresi', type: 'url', required: true, defaultValue: '#hakkinda', mappingTarget: { nodeId: 'header-link-2', operation: 'attribute', property: 'href' } },
    ],
    componentTemplate: { type: 'default', tagName: 'header', attributes: { class: 'bd-site-header' }, components: [
      { type: 'default', tagName: 'a', attributes: { href: '/', class: 'bd-site-logo', 'data-bd-node': 'header-brand' }, components: ['studio'] },
      { type: 'default', tagName: 'nav', attributes: { 'aria-label': 'Ana gezinme' }, components: [
        { type: 'default', tagName: 'a', attributes: { href: '#icerik', 'data-bd-node': 'header-link-1' }, components: ['Keşfet'] },
        { type: 'default', tagName: 'a', attributes: { href: '#hakkinda', 'data-bd-node': 'header-link-2' }, components: ['Hakkında'] },
      ] },
    ] },
  },
  {
    ref: footerRef, designSystemRef: DESIGN_SYSTEM, name: 'Studio footer', region: 'footer', archived: false,
    fields: [{ fieldId: 'field.footer.copyright', key: 'copyright', label: 'Alt bilgi metni', type: 'text', required: true, defaultValue: '© Studio', mappingTarget: { nodeId: 'footer-copy', operation: 'text' } }],
    componentTemplate: { type: 'default', tagName: 'footer', attributes: { class: 'bd-site-footer' }, components: [
      { type: 'default', tagName: 'p', attributes: { 'data-bd-node': 'footer-copy' }, components: ['© Studio'] },
    ] },
  },
];

export const defaultPageTemplate: PageTemplateDefinition = {
  ref: { id: 'template.studio-site', version: '1.0.0' },
  designSystemRef: DESIGN_SYSTEM,
  name: 'Studio sayfası',
  description: 'Kilitli header ve footer ile geniş içerik alanı.',
  contentSlotId: 'content-main',
  sharedRegionRefs: [headerRef, footerRef],
  allowedBlockCategories: [],
  mandatoryBlockIds: [],
  archived: false,
  layout: {
    pages: [{ name: 'Yeni sayfa', component: { type: 'wrapper', components: [
      { type: 'default', tagName: 'header', attributes: { class: 'bd-site-header', 'data-bd-region-ref': 'region.studio-header@1.0.0', 'data-bd-locked': 'true' }, components: [
        { type: 'default', tagName: 'a', attributes: { href: '/', class: 'bd-site-logo', 'data-bd-node': 'header-brand' }, components: ['studio'] },
        { type: 'default', tagName: 'nav', attributes: { 'aria-label': 'Ana gezinme' }, components: [
          { type: 'default', tagName: 'a', attributes: { href: '#icerik', 'data-bd-node': 'header-link-1' }, components: ['Keşfet'] },
          { type: 'default', tagName: 'a', attributes: { href: '#hakkinda', 'data-bd-node': 'header-link-2' }, components: ['Hakkında'] },
        ] },
      ] },
      { type: 'default', tagName: 'main', attributes: { id: 'icerik', 'data-bd-template-slot': 'content-main', 'data-bd-node': 'content-main' }, components: [] },
      { type: 'default', tagName: 'footer', attributes: { class: 'bd-site-footer', 'data-bd-region-ref': 'region.studio-footer@1.0.0', 'data-bd-locked': 'true' }, components: [
        { type: 'default', tagName: 'p', attributes: { 'data-bd-node': 'footer-copy' }, components: ['© Studio'] },
      ] },
    ] } }],
  } as JsonValue,
};

export function createPageFromTemplate(template: PageTemplateDefinition): EditorDocument {
  const copiedBlocks = cloneTemplateBlocks(template.blocks ?? []);
  const document: EditorDocument = {
    documentVersion: 1, documentKind: 'page', engine: 'grapesjs', engineVersion: '0.23.6', revision: null,
    designSystemRef: structuredClone(template.designSystemRef), templateRef: null, sharedRegionRefs: [],
    sharedRegionData: {},
    blocks: copiedBlocks.blocks,
    projectData: { pages: [{ name: 'Page', component: { type: 'wrapper', components: [] } }] }, editorState: { viewport: 'desktop' },
  };
  document.templateRef = structuredClone(template.ref);
  document.sharedRegionRefs = structuredClone(template.sharedRegionRefs);
  document.projectData = remapTemplateBlockReferences(structuredClone(template.layout), copiedBlocks.ids) as Record<string, JsonValue>;
  return document;
}

export function createTemplateFromDocument(name: string, document: EditorDocument, templateId: string, includeContentBlocks = false): PageTemplateDefinition {
  const layout = includeContentBlocks ? structuredClone(document.projectData) : stripBlockPlaceholders(structuredClone(document.projectData));
  return {
    ref: { id: templateId, version: '1.0.0' },
    designSystemRef: structuredClone(document.designSystemRef),
    name,
    description: 'Editör belgesinden kaydedilen sayfa şablonu.',
    ...(includeContentBlocks ? { blocks: structuredClone(document.blocks) } : {}),
    layout,
    contentSlotId: 'content-main',
    sharedRegionRefs: structuredClone(document.sharedRegionRefs),
    allowedBlockCategories: [],
    mandatoryBlockIds: [],
    archived: false,
  };
}

function cloneTemplateBlocks(blocks: BlockInstance[]): { blocks: BlockInstance[]; ids: Map<string, string> } {
  const ids = new Map(blocks.map((block) => [block.instanceId, createTemplateIdentity('block')]));
  const copied = blocks.map((block) => {
    const manualData = structuredClone(block.manualData);
    const freshen=(value:JsonValue):void=>{if(Array.isArray(value)){value.forEach(freshen);return;}if(!value||typeof value!=='object')return;if(typeof value.__id==='string')value.__id=createTemplateIdentity('item');Object.values(value).forEach(freshen);};
    freshen(manualData);
    return {
      ...structuredClone(block),
      instanceId: ids.get(block.instanceId)!,
      manualData,
      sourceBindings: block.sourceBindings.map((binding) => ({ ...structuredClone(binding), bindingId: createTemplateIdentity('binding') })),
    };
  });
  return { blocks: copied, ids };
}

function remapTemplateBlockReferences(value: JsonValue, ids: Map<string, string>): JsonValue {
  if (Array.isArray(value)) return value.map((item) => remapTemplateBlockReferences(item, ids));
  if (!value || typeof value !== 'object') return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, remapTemplateBlockReferences(child, ids)])) as Record<string, JsonValue>;
  const attributes = next['attributes'];
  if (attributes && !Array.isArray(attributes) && typeof attributes === 'object') {
    for (const key of ['data-bd-placeholder-id', 'data-bd-block-id']) {
      const current = attributes[key];
      if (typeof current === 'string' && ids.has(current)) attributes[key] = ids.get(current)!;
    }
  }
  return next;
}

function createTemplateIdentity(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

export function applySharedRegions(projectData: Record<string, JsonValue>, regions: SharedRegionDefinition[], data: Record<string, Record<string, JsonValue>> = {}): Record<string, JsonValue> {
  const next = structuredClone(projectData);
  const pages = next['pages'];
  if (!Array.isArray(pages)) return next;
  for (const page of pages) {
    if (!page || Array.isArray(page) || typeof page !== 'object') continue;
    if (Array.isArray(page.frames)) {
      for (const frame of page.frames) {
        if (!frame || Array.isArray(frame) || typeof frame !== 'object' || !frame.component) continue;
        const resolved = applySharedRegions({ pages: [{ component: frame.component }] }, regions, data);
        const resolvedPage = (resolved.pages as Record<string,JsonValue>[])[0];
        if (resolvedPage?.component) frame.component = resolvedPage.component;
      }
    }
    const component = page['component'];
    if (!component || Array.isArray(component) || typeof component !== 'object') continue;
    const components = component['components'];
    if (!Array.isArray(components)) continue;
    component['components'] = components.map((child) => {
      if (!child || Array.isArray(child) || typeof child !== 'object') return child;
      const childAttributes = child['attributes'];
      const pinnedRef = childAttributes && !Array.isArray(childAttributes) && typeof childAttributes === 'object' && typeof childAttributes['data-bd-region-ref'] === 'string'
        ? childAttributes['data-bd-region-ref'] as string
        : '';
      const pinned = pinnedRef ? regions.find((item) => `${item.ref.id}@${item.ref.version}` === pinnedRef) : undefined;
      const region = pinned
        ? pinned
        : regions.find((item) => item.region !== 'custom' && child['tagName'] === item.region);
      if (!region) return child;
      const values = { ...region.defaultData, ...data[`${region.ref.id}@${region.ref.version}`] };
      const root = region.repeaters?.length ? applyTemplateData(region.componentTemplate, region.fields, region.repeaters, values) : applyRegionFields(region.componentTemplate,region.fields,values);
      if (!root || Array.isArray(root) || typeof root !== 'object') return child;
      const currentAttributes = root['attributes'];
      const nextAttributes = currentAttributes && !Array.isArray(currentAttributes) && typeof currentAttributes === 'object' ? currentAttributes : {};
      root['attributes'] = { ...nextAttributes, 'data-bd-region-ref': `${region.ref.id}@${region.ref.version}`, 'data-bd-locked': 'true' };
      return root;
    });
  }
  return next;
}

export function migrateSharedRegionValues(previous: SharedRegionDefinition, next: SharedRegionDefinition, values: Record<string, JsonValue>): { values: Record<string, JsonValue>; carried: string[]; initialized: string[]; incompatible: string[]; removed: string[] } {
  const previousFields = new Map(previous.fields.map((field) => [field.key, field]));
  const nextKeys = new Set(next.fields.map((field) => field.key));
  const result: Record<string, JsonValue> = {};
  const carried: string[] = [];
  const initialized: string[] = [];
  const incompatible: string[] = [];
  for (const field of next.fields) {
    const oldField = previousFields.get(field.key);
    if (!oldField || !(field.key in values)) {
      result[field.key] = structuredClone(field.defaultValue);
      initialized.push(field.key);
      continue;
    }
    const value = values[field.key]!;
    if (compatibleRegionValue(field, value)) {
      result[field.key] = structuredClone(value);
      carried.push(field.key);
    } else {
      result[field.key] = structuredClone(field.defaultValue);
      incompatible.push(field.key);
    }
  }
  for (const repeater of next.repeaters ?? []) result[repeater.key] = structuredClone(values[repeater.key] ?? next.defaultData?.[repeater.key] ?? []);
  return { values: result, carried, initialized, incompatible, removed: previous.fields.filter((field) => !nextKeys.has(field.key)).map((field) => field.key) };
}

function compatibleRegionValue(field: SharedRegionDefinition['fields'][number], value: JsonValue): boolean {
  switch (field.type) {
    case 'number': return typeof value === 'number' && Number.isFinite(value) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
    case 'boolean': return typeof value === 'boolean';
    case 'select': return typeof value === 'string' && (!field.options?.length || field.options.some((option) => option.value === value));
    default: return typeof value === 'string';
  }
}

function applyRegionFields(component: JsonValue, fields: SharedRegionDefinition['fields'], values: Record<string, JsonValue>): JsonValue {
  const root = structuredClone(component);
  const apply = (node: JsonValue): void => {
    if (Array.isArray(node)) { node.forEach(apply); return; }
    if (!node || typeof node !== 'object') return;
    const attributes = node['attributes'];
    const nodeId = attributes && !Array.isArray(attributes) && typeof attributes === 'object' ? attributes['data-bd-node'] : undefined;
    if (typeof nodeId === 'string') {
      for (const field of fields.filter((item) => item.mappingTarget.nodeId === nodeId)) {
        const value = values[field.key] ?? field.defaultValue;
        if (field.mappingTarget.operation === 'text' || field.mappingTarget.operation === 'safeRichText') {
          node['components'] = [String(value ?? '')];
          delete node['content'];
        } else if (field.mappingTarget.operation === 'attribute' && field.mappingTarget.property) {
          const current = node['attributes'];
          const next = current && !Array.isArray(current) && typeof current === 'object' ? current : {};
          next[field.mappingTarget.property] = value;
          node['attributes'] = next;
        } else if (field.mappingTarget.operation === 'style' && field.mappingTarget.property) {
          const current = node['style'];
          const next = current && !Array.isArray(current) && typeof current === 'object' ? current : {};
          next[field.mappingTarget.property] = value;
          node['style'] = next;
        } else if (field.mappingTarget.operation === 'booleanVisibility') {
          const current = node['attributes'];
          const next = current && !Array.isArray(current) && typeof current === 'object' ? { ...current } : {};
          if (value === true) next['hidden'] = true; else delete next['hidden'];
          node['attributes'] = next;
        }
      }
    }
    Object.values(node).forEach(apply);
  };
  apply(root);
  return root;
}

export function templateAllowsCategory(template: PageTemplateDefinition | null, category: string): boolean {
  return !template || template.allowedBlockCategories.length === 0 || template.allowedBlockCategories.includes(category);
}

export function missingMandatoryBlockIds(template: PageTemplateDefinition | null, blocks: EditorDocument['blocks']): string[] {
  if (!template) return [];
  return template.mandatoryBlockIds.filter((id) => !blocks.some((block) => block.definitionRef.id === id));
}

function stripBlockPlaceholders(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stripBlockPlaceholders).filter((item) => item !== null);
  if (!value || typeof value !== 'object') return value;
  const attributes = value['attributes'];
  if (attributes && !Array.isArray(attributes) && typeof attributes === 'object'
    && ('data-bd-placeholder-id' in attributes || 'data-bd-placeholder-definition' in attributes || 'data-bd-block-id' in attributes)) return null;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, stripBlockPlaceholders(child)])) as JsonValue;
}
