import { validateFieldValue } from './field-values.ts';
export { validateFieldValue, isSafeUrl } from './field-values.ts';
import { normalizeRepeaterRows, validateRepeaterRows } from './schema.ts';
import { validateFormBinding as checkFormBinding } from './forms.ts';
export { validateFormDefinition, validateFormValues, validateFormBinding, formSchemaDiff, loadFormOptions, createCmsFormDefinition, CMS_FORM_ID } from './forms.ts';
export { mountCmsForm } from './form-runtime.ts';
export type { CmsFormServices } from './form-runtime.ts';
import type {
  AdapterError,
  BlockDefinitionVersion,
  BlockInstance,
  EditorDocument,
  FieldDefinition,
  JsonValue,
  RepeaterDefinition,
  VersionRef,
} from '@blockdesign/contracts';

export const DOCUMENT_VERSION = 3;
export { contextualQuery, loadCollectionPage } from './collections.ts';
export { mountCollection } from './collection-runtime.ts';
export { mountInteractive } from './interactive-runtime.ts';
export { parseRichText } from './rich-text.ts';
export { tabsWidget, modalWidget, galleryWidget, interactiveWidgets } from './interactive-widgets.ts';
export type { CollectionRuntimeConfig, CollectionRuntimeServices } from './collection-runtime.ts';
export const ENGINE_VERSION = '0.23.6';
export const DESIGN_SYSTEM: VersionRef = { id: 'system.studio-neutral', version: '1.0.0' };

export function makeId(prefix = 'id'): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

export function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

export function makeManualBinding(scope: 'block' | 'field' | 'repeater', id: string) {
  return {
    bindingId: makeId('binding'),
    target: { scope, id },
    mode: 'manual' as const,
    providerId: null,
    collectionId: null,
    schemaVersion: null,
    recordRefs: [],
    groupRef: null,
    query: null,
    fieldMappings: [],
  };
}

export function createEmptyDocument(): EditorDocument {
  return {
    documentVersion: DOCUMENT_VERSION,
    documentKind: 'page',
    engine: 'grapesjs',
    engineVersion: ENGINE_VERSION,
    revision: null,
    designSystemRef: cloneJson(DESIGN_SYSTEM),
    templateRef: null,
    sharedRegionRefs: [],
    sharedRegionData: {},
    blocks: [],
    projectData: { pages: [{ name: 'Page', component: { type: 'wrapper', components: [] } }] },
    editorState: { viewport: 'desktop' },
    localization: { locale: 'tr' },
  };
}

export function validateDocument(document: EditorDocument, definitions: Map<string, BlockDefinitionVersion>): AdapterError[] {
  const issues: AdapterError[] = [];
  if (![1,2,DOCUMENT_VERSION].includes(document.documentVersion)) {
    issues.push({ code: 'UNSUPPORTED_DOCUMENT_VERSION', message: `Belge sürümü ${document.documentVersion} desteklenmiyor.`, path: 'documentVersion', recoverable: false });
    return issues;
  }
  if (document.engine !== 'grapesjs' || !document.projectData || typeof document.projectData !== 'object') {
    issues.push({ code: 'INVALID_DOCUMENT', message: 'Editör belgesi eksik veya tanınmayan bir görsel motoru içeriyor.', path: 'projectData', recoverable: false });
    return issues;
  }
  const seenInstances = new Set<string>();
  for (const [blockIndex, block] of document.blocks.entries()) {
    if (seenInstances.has(block.instanceId)) {
      issues.push({ code: 'DUPLICATE_BLOCK_INSTANCE', message: 'Belgede blok örneği kimliği yineleniyor.', path: `blocks.${blockIndex}.instanceId`, recoverable: true });
    }
    seenInstances.add(block.instanceId);
    const definition = definitions.get(versionKey(block.definitionRef));
    if (!definition) {
      issues.push({ code: 'DEFINITION_MISSING', message: `“${block.definitionRef.id}” blok tanımının sürümü yüklenemedi.`, path: `blocks.${blockIndex}.definitionRef`, recoverable: true });
      continue;
    }
    issues.push(...validateBlock(block, definition, `blocks.${blockIndex}`));
  }
  return issues;
}

function versionKey(ref: VersionRef): string {
  return `${ref.id}@${ref.version}`;
}

export function validateBlock(block: BlockInstance, definition: BlockDefinitionVersion, basePath = 'block'): AdapterError[] {
  const issues: AdapterError[] = [];
  if(block.formBinding){try{if(definition.ref.id!=='blockdesign.cms-form')throw new Error('Form bağlantısı yalnızca CMS Formu bileşenine eklenebilir.');checkFormBinding(block.formBinding);}catch(error){issues.push({code:'INVALID_FORM_BINDING',message:error instanceof Error?error.message:'Form bağlantısı geçersiz.',path:basePath+'.formBinding',recoverable:true});}}
  const keys = new Set(definition.fields.map((field) => field.key));
  for (const field of definition.fields) {
    issues.push(...validateFieldValue(field, block.manualData[field.key], `${basePath}.manualData.${field.key}`));
  }
  for (const setting of definition.behavior?.settings ?? []) issues.push(...validateFieldValue(setting,block.behaviorSettings?.[setting.key] ?? setting.defaultValue,`${basePath}.behaviorSettings.${setting.key}`));
  for (const repeater of definition.repeaters) issues.push(...validateRepeaterRows(block.manualData[repeater.key], repeater, validateFieldValue, `${basePath}.manualData.${repeater.key}`));
  for (const key of Object.keys(block.manualData)) {
    if (!keys.has(key) && !definition.repeaters.some((repeater) => repeater.key === key)) {
      issues.push({ code: 'UNKNOWN_FIELD', message: `“${key}” alanı bu blok sürümünde tanımlı değil.`, path: `${basePath}.manualData.${key}`, recoverable: false });
    }
  }
  return issues;
}

export function makeInstance(definition: BlockDefinitionVersion): BlockInstance {
  const manualData = cloneJson(definition.defaultData);
  for (const repeater of definition.repeaters) manualData[repeater.key] = normalizeRepeaterRows(manualData[repeater.key], repeater, true);
  return {
    instanceId: makeId('block'),
    definitionRef: cloneJson(definition.ref),
    variant: null,
    manualData,
    sourceBindings: (definition.defaultSourceBindings ?? []).map((binding) => ({ ...cloneJson(binding), bindingId: makeId('binding') })),
    styleOverrides: {},
    behaviorSettings: Object.fromEntries((definition.behavior?.settings ?? []).map(field=>[field.key,cloneJson(field.defaultValue)])),
  };
}

/** Clone a block's current content while giving the copy independent identities. */
export function cloneBlockInstance(block: BlockInstance, definition: BlockDefinitionVersion): BlockInstance {
  const copy = cloneJson(block);
  copy.instanceId = makeId('block');
  for (const repeater of definition.repeaters) copy.manualData[repeater.key] = normalizeRepeaterRows(copy.manualData[repeater.key], repeater, true);
  copy.sourceBindings = copy.sourceBindings.map((binding) => ({ ...binding, bindingId: makeId('binding') }));
  return copy;
}

export { resolveDocumentSources } from './sources.ts';
export { normalizeLocale, validLocale, documentLocaleContext, normalizeLocalizationOptions, migrateDocumentLocalization } from './localization.ts';
export { applySharedRegions, createPageFromTemplate, createTemplateFromDocument, defaultPageTemplate, defaultSharedRegions, migrateSharedRegionValues, missingMandatoryBlockIds, templateAllowsCategory } from './templates.ts';

export function fieldValue(block: BlockInstance, field: FieldDefinition): JsonValue {
  return block.manualData[field.key] ?? field.defaultValue;
}

export function setFieldValue(block: BlockInstance, field: FieldDefinition, value: JsonValue): BlockInstance {
  return { ...block, manualData: { ...block.manualData, [field.key]: value } };
}

export type RepeaterOperation =
  | { type: 'add'; values?: Record<string, JsonValue> }
  | { type: 'duplicate'; itemId: string }
  | { type: 'remove'; itemId: string }
  | { type: 'move'; itemId: string; direction: -1 | 1 };

export function updateRepeater(
  block: BlockInstance,
  definition: RepeaterDefinition,
  operation: RepeaterOperation,
): BlockInstance {
  const current = block.manualData[definition.key];
  const rows: Array<Record<string, JsonValue>> = Array.isArray(current)
    ? current.map((row) => ({ ...(row as Record<string, JsonValue>) }))
    : [];
  if (operation.type === 'add') {
    if (rows.length >= definition.maxItems) throw new Error(`En fazla ${definition.maxItems} öğe ekleyebilirsin.`);
    const next: Record<string, JsonValue> = { __id: makeId('item') };
    for (const field of definition.itemFields) next[field.key] = operation.values?.[field.key] ?? field.defaultValue;
    for (const child of definition.childRepeaters ?? []) next[child.key] = [];
    rows.push(next);
  } else {
    const index = rows.findIndex((row) => row.__id === operation.itemId);
    if (index === -1) throw new Error('Düzenlenecek repeater öğesi bulunamadı.');
    switch (operation.type) {
      case 'duplicate': {
        if (rows.length >= definition.maxItems) throw new Error(`En fazla ${definition.maxItems} öğe ekleyebilirsin.`);
        rows.splice(index + 1, 0, normalizeRepeaterRows([rows[index]!], definition, true)[0]!);
        break;
      }
      case 'remove': {
        if (rows.length - 1 < definition.minItems) throw new Error(`Listede en az ${definition.minItems} öğe bulunmalı.`);
        rows.splice(index, 1);
        break;
      }
      case 'move': {
        const destination = index + operation.direction;
        if (destination < 0 || destination >= rows.length) return block;
        [rows[index], rows[destination]] = [rows[destination]!, rows[index]!];
        break;
      }
    }
  }
  const nextBlock = { ...block, manualData: { ...block.manualData, [definition.key]: rows } };
  if (rows.length < definition.minItems || rows.length > definition.maxItems) {
    throw new Error(`“${definition.label}” listesi ${definition.minItems} ile ${definition.maxItems} öğe arasında olmalı.`);
  }
  for (const [itemIndex, row] of rows.entries()) {
    for (const field of definition.itemFields) {
      const issues = validateFieldValue(field, row[field.key], `${definition.key}.${itemIndex}.${field.key}`);
      if (issues.length) throw new Error(issues[0]!.message);
    }
  }
  return nextBlock;
}

export function mapDomIdentityReferences(fragment: HTMLElement, prefix: string): void {
  const map = new Map<string, string>();
  for (const element of [fragment, ...fragment.querySelectorAll<HTMLElement>('[id]')]) {
    if (!element.id) continue;
    const replacement = `${prefix}-${element.id}`;
    map.set(element.id, replacement);
    element.id = replacement;
  }
  for (const element of fragment.querySelectorAll<HTMLElement>('[for], [aria-controls], [aria-labelledby], [aria-describedby], [href^="#"]')) {
    for (const attribute of ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'href']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = attribute === 'href' && value.startsWith('#') ? `#${map.get(value.slice(1)) ?? `${prefix}-${value.slice(1)}`}` : value.split(/\s+/).map((token) => map.get(token) ?? token).join(' ');
      element.setAttribute(attribute, next);
    }
  }
}

export { applyTemplateData, findTemplateNode, normalizeRepeaterRows, validateRepeaterRows, MAX_LIST_DEPTH } from './schema.ts';

export { EDITABLE_STYLE_PROPERTIES, safeStyleValue, allowedStyleOverrides } from './styles.ts';

export { composableDefinitions, COMPOSABLE_CSS, accordionWidget, menuWidget, languageWidget } from './composable.ts';

export { SECTION_VARIANT_CSS } from './composable.ts';

export { AUTHORING_HINT_CSS } from './composable.ts';
