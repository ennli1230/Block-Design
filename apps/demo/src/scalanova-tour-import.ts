import type { BlockDefinitionVersion, BlockInstance, ContentRecord, EditorDocument, FieldDefinition, JsonValue, PageTemplateDefinition, ProviderCollection, RepeaterDefinition, SharedRegionDefinition, SourceBinding, VersionRef } from '@blockdesign/contracts';
import { createPageFromTemplate, makeId, makeInstance } from '@blockdesign/core';
import { ScalanovaTourContentProvider } from './scalanova-tour-content-provider';
import type { DemoBaseView } from './workspace';

const DESIGN_SYSTEM: VersionRef = { id: 'system.studio-neutral', version: '1.0.0' };
const HEADER_REF: VersionRef = { id: 'region.scalanova-tour-header', version: '1.0.0' };
const FOOTER_REF: VersionRef = { id: 'region.scalanova-tour-footer', version: '1.0.0' };
const TEMPLATE_REF: VersionRef = { id: 'template.scalanova-tour-tr', version: '1.0.0' };
export const SCALANOVA_IMPORT_VERSION = 4;
export const SCALANOVA_BASE_VIEW: DemoBaseView = {
  id: 'base-view.scalanova-tour-tr',
  name: 'Scala Nova · Türkçe',
  headerRef: HEADER_REF,
  footerRef: FOOTER_REF,
  updatedAt: new Date().toISOString(),
};
export const SCALANOVA_STYLESHEET = '/scalanova-tour/assets/css/styles.css';

export const PAGE_PATHS = [
  'tr/index.html',
  'tr/acente-ve-belgeler/index.html',
  'tr/aktiviteler/index.html',
  'tr/aktiviteler/balon-turu/index.html',
  'tr/aktiviteler/tekne-gezisi/index.html',
  'tr/aktiviteler/yamac-parasutu/index.html',
  'tr/aktiviteler/yeme-icme-sarap/index.html',
  'tr/b2b/index.html',
  'tr/cerez-politikasi/index.html',
  'tr/destinasyonlar/index.html',
  'tr/destinasyonlar/didim/index.html',
  'tr/destinasyonlar/efes/index.html',
  'tr/destinasyonlar/kusadasi/index.html',
  'tr/destinasyonlar/milet/index.html',
  'tr/destinasyonlar/pamukkale/index.html',
  'tr/destinasyonlar/priene/index.html',
  'tr/destinasyonlar/selcuk/index.html',
  'tr/destinasyonlar/sirince/index.html',
  'tr/erisilebilirlik/index.html',
  'tr/hakkimizda/index.html',
  'tr/iletisim/index.html',
  'tr/kisiye-ozel/index.html',
  'tr/kullanim-kosullari/index.html',
  'tr/kvkk-aydinlatma/index.html',
  'tr/liman-turlari/index.html',
  'tr/rehber/index.html',
  'tr/rehber/efes-gezisine-hazirlik/index.html',
  'tr/rehber/kusadasi-kruvaziyer-turu-planlama/index.html',
  'tr/rehber/kusadasinda-bir-gun/index.html',
  'tr/transferler/index.html',
  'tr/turlar/index.html',
  'tr/turlar/efes-ozel-turu/index.html',
] as const;

type FieldPath = { field: FieldDefinition; path: number[]; attribute?: string; textIndex?:number };
type SectionBlock = { definition: BlockDefinitionVersion; data: Record<string, JsonValue> };
type ImportedPage = { path: string; title: string; document: EditorDocument };
export interface ScalanovaTourSeed {
  regions: SharedRegionDefinition[];
  blocks: BlockDefinitionVersion[];
  template: PageTemplateDefinition;
  baseView: DemoBaseView;
  pages: ImportedPage[];
}

/** Reads the copied Turkish source pages and converts their meaningful main sections into editable blocks. */
export async function buildScalanovaTourSeed(fetcher: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<ScalanovaTourSeed> {
  const documents = await Promise.all(PAGE_PATHS.map(async (path) => {
    const response = await fetcher(`/scalanova-tour/${path}`);
    if (!response.ok) throw new Error(`Türkçe sayfa okunamadı (${path}, ${response.status}).`);
    const html = await response.text();
    return { path, document: new DOMParser().parseFromString(html, 'text/html') };
  }));
  const home = documents.find((item) => item.path === 'tr/index.html')!.document;
  const header = home.querySelector('header.site-header');
  const footer = home.querySelector('footer.site-footer');
  if (!header || !footer) throw new Error('Scala Nova ana sayfasında ortak header veya footer bulunamadı.');

  const headerRegion = createSharedRegion(header, 'header', HEADER_REF, 'Scala Nova header');
  const footerRegion = createSharedRegion(footer, 'footer', FOOTER_REF, 'Scala Nova footer');
  const template = createScalanovaTemplate([headerRegion, footerRegion]);
  const sectionDefinitions = new Map<string, BlockDefinitionVersion>();
  const pages: ImportedPage[] = [];
  for (const item of documents) {
    const main = item.document.querySelector('main');
    if (!main) throw new Error(`Ana içerik alanı bulunamadı: ${item.path}`);
    const title = pageTitle(item.document, item.path);
    const instances: BlockInstance[] = [];
    const sections = [...main.children].filter((element) => !isIgnoredElement(element) && Boolean(element.textContent?.trim()));
    for (const [index, element] of sections.entries()) {
      const converted = createSectionBlock(element, item.path, index + 1);
      const signature = definitionSignature(converted.definition);
      let definition = sectionDefinitions.get(signature);
      if (!definition) {
        definition = converted.definition;
        definition.ref = { id: `block.scalanova-tr-${await stableHash(signature)}`, version: '1.0.0' };
        sectionDefinitions.set(signature, definition);
      }
      const instance = makeInstance(definition);
      instance.manualData = structuredClone(converted.data);
      instances.push(instance);
    }
    if (!instances.length) throw new Error(`İçe aktarılabilir içerik bölümü bulunamadı: ${item.path}`);
    pages.push({ path: item.path, title, document: createImportedPage(title, item.path, instances, template) });
  }

  const blogDefinition = [...sectionDefinitions.values()].find((definition) => {
    const attributes = hasObject(definition.componentTemplate) && hasObject(definition.componentTemplate['attributes']) ? definition.componentTemplate['attributes'] : {};
    return typeof attributes['class'] === 'string' && attributes['class'].split(/\s+/).includes('home-journal');
  });
  const homePage = pages.find((page) => page.path === 'tr/index.html');
  const blogRepeater = blogDefinition?.repeaters[0];
  const blogBlock = blogDefinition && homePage?.document.blocks.find((block) => block.definitionRef.id === blogDefinition.ref.id && block.definitionRef.version === blogDefinition.ref.version);
  if (blogDefinition && blogRepeater && blogBlock) {
    const provider = new ScalanovaTourContentProvider();
    const collection = await provider.getSchema('scalanova-blog-posts');
    const records = (await provider.query(collection.collectionId, {
      filters: [], sort: { fieldId: 'publishedAt', direction: 'desc' }, limit: 3,
    })).items;
    const rows = blogBlock.manualData[blogRepeater.key];
    const fieldMappings = rows && Array.isArray(rows)
      ? sourceFieldMappings(blogRepeater, rows as Record<string, JsonValue>[], records, collection)
      : [];
    if (!fieldMappings.some((mapping) => mapping.from === 'title') || !fieldMappings.some((mapping) => mapping.from === 'url')) {
      throw new Error('Ana sayfa blog tekrarlayıcısının başlık ve bağlantı alanları otomatik kaynağa eşlenemedi.');
    }
    const binding: SourceBinding = {
      bindingId: 'binding.scalanova.home-blog-query',
      target: { scope: 'repeater', id: blogRepeater.repeaterId },
      mode: 'query',
      providerId: provider.providerId,
      collectionId: collection.collectionId,
      schemaVersion: collection.schemaVersion,
      recordRefs: [],
      groupRef: null,
      query: { filters: [], sort: { fieldId: 'publishedAt', direction: 'desc' }, limit: 3 },
      fieldMappings,
    };
    blogBlock.sourceBindings = [binding];
  }

  return {
    regions: [headerRegion, footerRegion],
    blocks: [...sectionDefinitions.values()],
    template,
    baseView: structuredClone(SCALANOVA_BASE_VIEW),
    pages,
  };
}

function createSharedRegion(element: Element, region: 'header' | 'footer', ref: VersionRef, name: string): SharedRegionDefinition {
  const fields: FieldPath[] = [];
  const template = componentFromElement(element, '1', 'tr/index.html', fields, [], false, new Set(), true);
  return {
    ref: structuredClone(ref),
    designSystemRef: structuredClone(DESIGN_SYSTEM),
    name,
    region,
    componentTemplate: template,
    fields: fields.map((item) => item.field),
    archived: false,
  };
}

function createSectionBlock(element: Element, pagePath: string, sectionIndex: number): SectionBlock {
  const fields: FieldPath[] = [];
  const repeaters: RepeaterDefinition[] = [];
  const defaultData: Record<string, JsonValue> = {};
  const componentTemplate = componentFromElement(element, '1', pagePath, fields, repeaters, true, new Set(), true, defaultData);
  if (!componentTemplate || Array.isArray(componentTemplate) || typeof componentTemplate !== 'object') throw new Error(`Bölüm bloğu hazırlanamadı: ${pagePath} (${sectionIndex}).`);
  const rootAttributes = componentTemplate['attributes'];
  if (rootAttributes && !Array.isArray(rootAttributes) && typeof rootAttributes === 'object') {
    rootAttributes['data-bd-import'] = 'scalanova-tour-tr';
    rootAttributes['data-bd-container'] = 'true';
  }
  const blockName = blockLabel(element);
  const definition: BlockDefinitionVersion = {
    ref: { id: `block.scalanova-tr-pending-${sectionIndex}`, version: '1.0.0' },
    designSystemRef: structuredClone(DESIGN_SYSTEM),
    name: blockName,
    description: 'Scala Nova Türkçe sayfasından içe aktarıldı. Metin, görsel ve tekrar eden öğeler düzenlenebilir.',
    category: blockCategory(element),
    preview: 'custom',
    componentTemplate,
    fields: fields.map((item) => item.field),
    repeaters,
    defaultData,
    stylePolicy: { allowedProperties: ['color', 'background-color', 'padding', 'margin', 'text-align', 'font-size', 'font-weight', 'line-height', 'border-radius', 'display', 'grid-template-columns', 'gap', 'width', 'max-width'], structuralEdits: true },
    sourceCapabilities: {
      modes: element.classList.contains('home-journal') ? ['manual', 'selection', 'query'] : ['manual'],
      target: ['block', 'field', 'repeater'],
    },
    archived: false,
  };
  return { definition, data: defaultData };
}

function componentFromElement(
  element: Element,
  nodePath: string,
  pagePath: string,
  fields: FieldPath[],
  repeaters: RepeaterDefinition[],
  allowRepeaters: boolean,
  dynamicAttributes: Set<string>,
  isBlockRoot: boolean,
  defaultData: Record<string, JsonValue> = {},
  relativePath: number[] = [],
): JsonValue {
  const tag = element.localName.toLowerCase();
  if (isIgnoredElement(element)) return { type: 'textnode', content: '' };
  const nodeId = `sn-${nodePath}`;
  const attributes = safeAttributes(element, pagePath);
  attributes['data-bd-node'] = nodeId;
  if (isBlockRoot) attributes['data-bd-container'] = 'true';

  const component: Record<string, JsonValue> = { type: 'default', tagName: tag, attributes, components: [] };
  const inlineStyle = safeInlineStyles(element);
  if (Object.keys(inlineStyle).length) component['style'] = inlineStyle;

  for (const attribute of mappedAttributes(attributes, tag, dynamicAttributes)) {
    const value = attributes[attribute];
    if (typeof value !== 'string' && typeof value !== 'boolean') continue;
    const key = `f_${nodePath.replaceAll('-', '_')}_${attribute.replaceAll('-', '_')}`;
    const field: FieldDefinition = {
      fieldId: `field.scalanova.${key}`,
      key,
      label: attributeLabel(attribute, tag, element),
      type: fieldType(attribute, tag, String(value)),
      required: false,
      defaultValue: value,
      mappingTarget: { nodeId, operation: 'attribute', property: attribute },
    };
    fields.push({ field, path: [...relativePath], attribute });
    defaultData[key] = value;
  }

  const children = [...element.children];
  const groups = new Map<number, { items: Element[] }>();
  const groupedIndices = new Set<number>();
  if (allowRepeaters) {
    let index = 0;
    while (index < children.length) {
      const repeated = findRepeatedRun(children, index);
      if (!repeated) { index += 1; continue; }
      groups.set(index, repeated);
      repeated.items.slice(1).forEach((item) => groupedIndices.add(children.indexOf(item)));
      index += repeated.items.length;
    }
  }

  const childComponents: JsonValue[] = [];
  const directText = normalizeText([...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? '').join(''));
  if (!children.length && directText) {
    const key = `f_${nodePath.replaceAll('-', '_')}_text`;
    const field: FieldDefinition = {
      fieldId: `field.scalanova.${key}`,
      key,
      label: textFieldLabel(tag),
      type: 'text',
      required: false,
      defaultValue: directText,
      mappingTarget: { nodeId, operation: 'text' },
    };
    fields.push({ field, path: [...relativePath] });
    defaultData[key] = directText;
    childComponents.push({ type: 'textnode', content: directText });
  } else {
    let elementIndex = 0;
    for (const childNode of [...element.childNodes]) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        const text = normalizeText(childNode.textContent ?? '');
        if (text) {
          const key=`f_${nodePath.replaceAll('-','_')}_segment_${childComponents.length}`;
          const field:FieldDefinition={fieldId:'field.scalanova.'+key,key,label:textFieldLabel(tag)+' · '+(childComponents.length+1),type:'text',required:false,defaultValue:childNode.textContent??'',mappingTarget:{nodeId,operation:'textSegment',property:String(childComponents.length)}};
          fields.push({field,path:[...relativePath],textIndex:[...element.childNodes].indexOf(childNode)});defaultData[key]=field.defaultValue;
          childComponents.push({ type: 'textnode', content: childNode.textContent ?? '' });
        }
        continue;
      }
      if (childNode.nodeType !== Node.ELEMENT_NODE) continue;
      const child = childNode as Element;
      const repeated = groups.get(elementIndex);
      if (repeated) {
        const repeaterIndex = repeaters.length + 1;
        const repeaterKey = `items_${repeaterIndex}`;
        const repeaterId = `repeater.scalanova.${nodePath.replaceAll('-', '.')}.${repeaterIndex}`;
        const sample = repeated.items[0]!;
        const sampleFields: FieldPath[] = [];
        const classChanges = repeated.items.some((item) => item.getAttribute('class') !== sample.getAttribute('class'));
        const itemNodeId = `sn-${nodePath}-r${repeaterIndex}`;
        const dynamic = classChanges ? new Set(['class']) : new Set<string>();
        if(sample.localName==='option')dynamic.add('selected');
        const itemTemplate = componentFromElement(sample, `${nodePath}-r${repeaterIndex}`, pagePath, sampleFields, [], false, dynamic, false, {}, []);
        const rows = repeated.items.map((item) => {
          const row: Record<string, JsonValue> = { __id: makeId('scalanova-item') };
          for (const fieldPath of sampleFields) {
            const target = elementAtPath(item, fieldPath.path);
            row[fieldPath.field.key] = fieldPath.attribute ? mappedAttributeValue(target, fieldPath.attribute, pagePath) : fieldPath.textIndex!==undefined ? target?.childNodes[fieldPath.textIndex]?.textContent??'' : normalizeText(target?.textContent ?? '');
          }
          return row;
        });
        repeaters.push({
          repeaterId,
          key: repeaterKey,
          label: repeatedLabel(sample),
          minItems: 0,
          maxItems: Math.max(50, rows.length),
          itemFields: sampleFields.map((item) => item.field),
          mappingTarget: { containerNodeId: nodeId, itemNodeId },
          nesting: 'none',
        });
        defaultData[repeaterKey] = rows;
        childComponents.push(itemTemplate);
        elementIndex += 1;
        continue;
      }
      if (!groupedIndices.has(elementIndex)) {
        childComponents.push(componentFromElement(child, `${nodePath}-${elementIndex + 1}`, pagePath, fields, repeaters, allowRepeaters, new Set(), false, defaultData, [...relativePath, elementIndex]));
      }
      elementIndex += 1;
    }
  }
  component['components'] = childComponents;
  return component as JsonValue;
}

function findRepeatedRun(children: Element[], start: number): { items: Element[] } | null {
  const first = children[start];
  if (!first) return null;
  const signature = elementShape(first);
  const run: Element[] = [first];
  for (let index = start + 1; index < children.length; index += 1) {
    if (elementShape(children[index]!) !== signature) break;
    run.push(children[index]!);
  }
  if (run.length < 2 && !first.matches('details, article[class], li, [data-hero-slide]')) return null;
  const tag = first.localName.toLowerCase();
  const hasSharedClass = Boolean(normalizeClasses(first.getAttribute('class') ?? ''));
  if (!['article', 'li', 'details', 'figure', 'blockquote', 'a', 'option'].includes(tag) && !hasSharedClass) return null;
  return { items: run };
}

function elementShape(element: Element): string {
  const classes = normalizeClasses(element.getAttribute('class') ?? '');
  return `${element.localName.toLowerCase()}|${classes}|${[...element.children].map(elementShape).join(';')}|${element.children.length ? 'children' : (element.textContent?.trim() ? 'text' : 'empty')}`;
}

function normalizeClasses(value: string): string {
  return value.split(/\s+/).filter(Boolean).filter((name) => !/^(?:is-|has-)(?:active|current|selected|visible|expanded)$/.test(name) && !/(?:--|-)featured$/.test(name)).sort().join(' ');
}

function mappedAttributes(attributes: Record<string, JsonValue>, tag: string, dynamicAttributes: Set<string>): string[] {
  const names = new Set(['href', 'src', 'alt', 'title', 'id', 'placeholder', 'value', 'aria-label', 'aria-hidden', 'data-category']);
  for (const attribute of dynamicAttributes) names.add(attribute);
  if (tag === 'img') names.add('src');
  return [...names].filter((name) => name in attributes && (typeof attributes[name] === 'string' || typeof attributes[name] === 'boolean'));
}

function mappedAttributeValue(element: Element | null, attribute: string, pagePath: string): JsonValue {
  if (!element) return '';
  if (attribute === 'href' || attribute === 'src') return normalizeUrl(element.getAttribute(attribute) ?? '', pagePath, attribute);
  if (['inert', 'hidden', 'disabled', 'required', 'checked', 'selected', 'multiple'].includes(attribute)) return element.hasAttribute(attribute);
  return element.getAttribute(attribute) ?? '';
}

function elementAtPath(root: Element, path: number[]): Element | null {
  let current: Element | null = root;
  for (const index of path) current = current?.children.item(index) ?? null;
  return current;
}

function safeAttributes(element: Element, pagePath: string): Record<string, JsonValue> {
  const attributes: Record<string, JsonValue> = {};
  for (const source of [...element.attributes]) {
    const name = source.name.toLowerCase();
    if (name.startsWith('on') || name === 'srcdoc' || name === 'srcset' || name === 'contenteditable' || name === 'formaction' || name.startsWith('data-bd-')) continue;
    if (name === 'action' || name === 'method') continue;
    if (name === 'style') continue;
    let value: string | boolean = source.value;
    if (name === 'href' || name === 'src' || name === 'poster') {
      value = normalizeUrl(source.value, pagePath, name);
      if (!value) continue;
    }
    if (name === 'value' && element.localName === 'option' && /(?:\/|\.html)/.test(source.value)) value = normalizeUrl(source.value, pagePath, 'href');
    if (['disabled', 'required', 'checked', 'selected', 'multiple', 'open', 'inert', 'hidden', 'controls', 'loop', 'muted', 'novalidate'].includes(name)) value = true;
    attributes[name] = value;
  }
  if (element.localName.toLowerCase() === 'form') attributes['novalidate'] = true;
  if (attributes['target'] === '_blank') attributes['rel'] = 'noopener noreferrer';
  return attributes;
}

function safeInlineStyles(element: Element): Record<string, JsonValue> {
  const style = (element as HTMLElement).style;
  const result: Record<string, JsonValue> = {};
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    const value = style.getPropertyValue(property).trim();
    if (/url\s*\(|expression\s*\(|javascript:|vbscript:/i.test(value)) continue;
    if (/^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i.test(property) && value) result[property] = value;
  }
  return result;
}

function normalizeUrl(value: string, pagePath: string, attribute: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('data:image/')) return trimmed;
  if (/^(?:javascript|vbscript|data:text\/html):/i.test(trimmed) || trimmed.startsWith('//')) return '';
  if (/^(?:https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed === '/') return '/scalanova-tour/tr/';
  if (trimmed.startsWith('/tr/')) return `/scalanova-tour${trimmed}`;
  if (trimmed.startsWith('/assets/')) return `/scalanova-tour${trimmed}`;
  try {
    const resolved = new URL(trimmed, `http://localhost:5174/scalanova-tour/${pagePath}`);
    if (attribute === 'href' && resolved.origin === 'http://localhost:5174') return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    if (attribute !== 'href' && resolved.origin === 'http://localhost:5174') return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.href : '';
  } catch {
    return '';
  }
}

function createImportedPage(title: string, path: string, blocks: BlockInstance[], template: PageTemplateDefinition): EditorDocument {
  const document = createPageFromTemplate(template);
  document.blocks = blocks;
  document.documentKind = 'page';
  document.templateRef = structuredClone(TEMPLATE_REF);
  document.sharedRegionRefs = [structuredClone(HEADER_REF), structuredClone(FOOTER_REF)];
  document.sharedRegionData = {};
  document.editorState = {
    viewport: 'desktop',
    workspaceStage: 'page',
    workspaceBaseViewId: SCALANOVA_BASE_VIEW.id,
    workspaceImportedFrom: `/scalanova-tour/${path}`,
    workspaceImportedVersion: SCALANOVA_IMPORT_VERSION,
  };
  const first = document.projectData['pages'];
  const page = Array.isArray(first) ? first[0] : null;
  if (!page || Array.isArray(page) || typeof page !== 'object') throw new Error(`Sayfa şablonu hazırlanamadı: ${path}`);
  page['name'] = title;
  const root = page['component'];
  if (!root || Array.isArray(root) || typeof root !== 'object') throw new Error(`Sayfa içeriği hazırlanamadı: ${path}`);
  const slot = findNode(root, (node) => node['tagName'] === 'main' && hasAttribute(node, 'data-bd-template-slot', 'content-main'));
  if (!slot) throw new Error(`Şablonda içerik alanı bulunamadı: ${path}`);
  slot['components'] = blocks.map((block) => ({
    type: 'default',
    tagName: 'div',
    attributes: { 'data-bd-placeholder-id': block.instanceId, 'data-bd-placeholder-definition': `${block.definitionRef.id}@${block.definitionRef.version}` },
    components: [],
  }));
  return document;
}

function createScalanovaTemplate(regions: SharedRegionDefinition[]): PageTemplateDefinition {
  const header = regions.find((item) => item.region === 'header');
  const footer = regions.find((item) => item.region === 'footer');
  const layout: JsonValue = {
    pages: [{
      name: 'Scala Nova sayfası',
      component: {
        type: 'wrapper',
        components: [
          regionElement('header', header?.componentTemplate ?? { type: 'default', tagName: 'header', attributes: { class: 'site-header' }, components: [] }, HEADER_REF),
          { type: 'default', tagName: 'main', attributes: { id: 'main-content', 'data-bd-node': 'content-main', 'data-bd-template-slot': 'content-main' }, components: [] },
          regionElement('footer', footer?.componentTemplate ?? { type: 'default', tagName: 'footer', attributes: { class: 'site-footer' }, components: [] }, FOOTER_REF),
        ],
      },
    }],
  };
  return {
    ref: structuredClone(TEMPLATE_REF),
    designSystemRef: structuredClone(DESIGN_SYSTEM),
    name: 'Scala Nova · Türkçe sayfalar',
    description: 'İçe aktarılan Türkçe sayfalar için kilitli header/footer ve düzenlenebilir içerik alanı.',
    baseViewId: SCALANOVA_BASE_VIEW.id,
    blocks: [],
    layout,
    contentSlotId: 'content-main',
    sharedRegionRefs: [structuredClone(HEADER_REF), structuredClone(FOOTER_REF)],
    allowedBlockCategories: [],
    mandatoryBlockIds: [],
    archived: false,
  };
}

function regionElement(tagName: 'header' | 'footer', template: JsonValue, ref: VersionRef): JsonValue {
  const component = structuredClone(template);
  if (component && !Array.isArray(component) && typeof component === 'object') {
    const attributes = hasObject(component['attributes']) ? component['attributes'] : {};
    component['tagName'] = tagName;
    component['attributes'] = { ...attributes, 'data-bd-region-ref': `${ref.id}@${ref.version}`, 'data-bd-locked': 'true' };
  }
  return component;
}

function findNode(root: JsonValue, predicate: (node: Record<string, JsonValue>) => boolean): Record<string, JsonValue> | null {
  if (Array.isArray(root)) {
    for (const item of root) { const result = findNode(item, predicate); if (result) return result; }
    return null;
  }
  if (!root || typeof root !== 'object') return null;
  if (predicate(root as Record<string, JsonValue>)) return root as Record<string, JsonValue>;
  const children = root['components'];
  return Array.isArray(children) ? findNode(children, predicate) : null;
}

function hasAttribute(node: Record<string, JsonValue>, key: string, value: string): boolean {
  return hasObject(node['attributes']) && node['attributes'][key] === value;
}

function hasObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return Boolean(value && !Array.isArray(value) && typeof value === 'object');
}

function pageTitle(document: Document, path: string): string {
  const heading = document.querySelector('main h1');
  if (heading) {
    const h1 = [...heading.childNodes].map((node) => node.nodeType === Node.ELEMENT_NODE ? ` ${node.textContent ?? ''} ` : node.textContent ?? '').join('');
    if (h1.trim()) return normalizeText(h1);
  }
  const title = document.title.replace(/\s*[|·-]\s*Scala Nova\s*$/i, '').trim();
  return title || path.replace(/\/index\.html$/, '').split('/').at(-1) || 'Scala Nova sayfası';
}

function blockCategory(element: Element): string {
  const classes = `${element.className} ${element.querySelector('[class]')?.getAttribute('class') ?? ''}`.toLocaleLowerCase('en-US');
  if (classes.includes('faq')) return 'SSS';
  if (classes.includes('legal')) return 'Yasal bilgiler';
  if (classes.includes('journal') || classes.includes('guide')) return 'Rehber';
  if (classes.includes('destination')) return 'Destinasyonlar';
  if (classes.includes('activity')) return 'Aktiviteler';
  if (classes.includes('contact') || classes.includes('form')) return 'İletişim';
  if (classes.includes('hero') || classes.includes('journey')) return 'Tanıtım';
  if (classes.includes('tour') || classes.includes('service')) return 'Turlar ve hizmetler';
  return 'İçerik';
}

function blockLabel(element: Element): string {
  const classes = `${element.className} ${element.querySelector('[class]')?.getAttribute('class') ?? ''}`.toLocaleLowerCase('en-US');
  if (classes.includes('seo-faq') || classes.includes('faq')) return 'Sık sorulan sorular bölümü';
  if (classes.includes('legal-layout')) return 'Yasal metin ve ilgili bağlantılar';
  if (classes.includes('page-hero') || classes.includes('tour-detail-title')) return 'Sayfa tanıtım alanı';
  if (classes.includes('hero-slider')) return 'Ana sayfa görsel alanı';
  if (classes.includes('home-journal') || classes.includes('journal-index') || classes.includes('journal-more')) return 'Rehber yazıları';
  if (classes.includes('contact-band') || classes.includes('journal-cta')) return 'İletişim çağrısı';
  if (classes.includes('destination-grid') || classes.includes('service-grid') || classes.includes('activity-list')) return 'Kart listesi';
  if (classes.includes('journey-strip')) return 'Yolculuk tanıtım şeridi';
  if (classes.includes('seo-overview')) return 'Bilgi ve iç bağlantılar';
  if (classes.includes('content-form') || classes.includes('partner-form')) return 'İletişim formu';
  const category = blockCategory(element);
  return `${category} bölümü`;
}

function repeatedLabel(element: Element): string {
  const tag = element.localName.toLowerCase();
  if (tag === 'details') return 'Sorular';
  if (tag === 'figure') return 'Görseller';
  if (tag === 'li') return 'Liste öğeleri';
  if (tag === 'article') return 'Kartlar';
  return 'Tekrarlanan öğeler';
}

function attributeLabel(attribute: string, tag: string, element: Element): string {
  const labels: Record<string, string> = {
    href: 'Bağlantı adresi', src: tag === 'img' ? 'Görsel' : 'Kaynak adresi', alt: 'Görsel açıklaması', title: 'Başlık niteliği',
    id: 'Bölüm bağlantı kimliği', placeholder: 'Yer tutucu metin', value: 'Varsayılan değer', 'aria-label': 'Erişilebilir ad',
    'aria-hidden': 'Ekran okuyucudan gizle', 'data-category': 'Kategori', class: 'Görünüm sınıfları',
  };
  const text = normalizeText(element.textContent ?? '');
  return labels[attribute] ?? `${text.slice(0, 30) || tag} · ${attribute}`;
}

function fieldType(attribute: string, tag: string, value: string): FieldDefinition['type'] {
  if(['selected','checked','disabled','required','open','inert','hidden','multiple'].includes(attribute))return 'boolean';
  if (attribute === 'src' && tag === 'img' && !value.startsWith('data:')) return 'image';
  if (attribute === 'href' && (/^(?:https?:|mailto:|\/|#)/i.test(value))) return 'url';
  return 'text';
}

function textFieldLabel(tag: string): string {
  if (/^h[1-6]$/.test(tag)) return 'Başlık';
  if (tag === 'a') return 'Bağlantı metni';
  if (tag === 'button') return 'Buton metni';
  if (tag === 'summary') return 'Soru';
  if (tag === 'label') return 'Alan etiketi';
  if (tag === 'option') return 'Seçenek';
  if (tag === 'li') return 'Liste metni';
  return 'Metin';
}

function isIgnoredElement(element: Element): boolean {
  return ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'foreignobject'].includes(element.localName.toLowerCase());
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function definitionSignature(definition: BlockDefinitionVersion): string {
  const fields = definition.fields.map(fieldShape);
  const repeaters = definition.repeaters.map((repeater) => ({
    key: repeater.key,
    ...(repeater.mappingTarget ? { mappingTarget: repeater.mappingTarget } : {}),
    fields: repeater.itemFields.map(fieldShape),
  }));
  const signature: Record<string, JsonValue> = { component: normalizedComponent(definition.componentTemplate, definition), fields, repeaters };
  if (definition.sourceCapabilities.modes.some((mode) => mode !== 'manual')) signature['sourceModes'] = definition.sourceCapabilities.modes;
  return JSON.stringify(signature);
}

function sourceFieldMappings(repeater: RepeaterDefinition, rows: Record<string, JsonValue>[], records: ContentRecord[], collection: ProviderCollection): SourceBinding['fieldMappings'] {
  if (rows.length !== records.length || !rows.length) return [];
  return repeater.itemFields.flatMap((field) => {
    const match = collection.fields.find((providerField) => rows.every((row, index) => {
      const sourceValue = records[index]?.values[providerField.fieldId];
      return row[field.key] !== undefined && sourceValue !== undefined && JSON.stringify(row[field.key]) === JSON.stringify(sourceValue);
    }));
    return match ? [{ from: match.fieldId, to: field.key }] : [];
  });
}

function fieldShape(field: FieldDefinition): JsonValue {
  return { key: field.key, type: field.type, mappingTarget: field.mappingTarget as unknown as JsonValue };
}

function normalizedComponent(value: JsonValue, definition: BlockDefinitionVersion): JsonValue {
  if (Array.isArray(value)) return value.map((item) => normalizedComponent(item, definition));
  if (!value || typeof value !== 'object') return value;
  if (value['type'] === 'textnode') return { type: 'textnode', content: '$text' };
  const attributes = hasObject(value['attributes']) ? value['attributes'] : {};
  const fields = [...definition.fields, ...definition.repeaters.flatMap((item) => item.itemFields)];
  const dynamic = new Set(fields.filter((field) => field.mappingTarget.operation === 'attribute').map((field) => `${field.mappingTarget.nodeId}:${field.mappingTarget.property}`));
  const normalizedAttributes = Object.fromEntries(Object.entries(attributes).map(([name, attributeValue]) => {
    const nodeId = typeof attributes['data-bd-node'] === 'string' ? attributes['data-bd-node'] : '';
    return [name, dynamic.has(`${nodeId}:${name}`) ? '$attribute' : attributeValue];
  }));
  const result: Record<string, JsonValue> = { ...value, attributes: normalizedAttributes };
  if (Array.isArray(value['components'])) result['components'] = value['components'].map((item) => normalizedComponent(item, definition));
  if (typeof value['content'] === 'string') result['content'] = '$text';
  return result;
}

async function stableHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].slice(0, 8).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Conversion helpers reused by the reviewed, explicitly triggered atomic import.
export { createSectionBlock, componentFromElement, safeAttributes, definitionSignature, stableHash, isIgnoredElement };

