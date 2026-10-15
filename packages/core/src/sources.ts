import { applySharedRegions } from './templates.ts';
import type { BlockDefinitionVersion, ContentLocaleContext, ContentProviderAdapter, ContentRecord, EditorDocument, FieldDefinition, JsonValue, ProviderCollection, SourceBinding, RepeaterDefinition, SharedRegionDefinition } from '@blockdesign/contracts';
import { documentLocaleContext, normalizeLocale } from './localization.ts';
import { validateFieldValue } from './field-values.ts';
import { contextualQuery } from './collections.ts';

export interface SourceResolution {
  document: EditorDocument;
  issues: Array<{ code: string; message: string; bindingId: string; severity?: 'warning' | 'error' }>;
}

/** Resolve provider-backed data into an ephemeral document copy. The saved document is never mutated. */
export async function resolveDocumentSources(
  input: EditorDocument,
  definitions: Map<string, BlockDefinitionVersion>,
  providers: ContentProviderAdapter[],
  regions: SharedRegionDefinition[] = [],
  localeDefaults?: { defaultLocale?: string; fallback?: ContentLocaleContext['fallback']; requireProviderLocaleDeclaration?: boolean; context?: import('@blockdesign/contracts').RequestContext | undefined },
): Promise<SourceResolution> {
  const document = structuredClone(input);
  const issues: SourceResolution['issues'] = [];
  const providerMap = new Map(providers.map((provider) => [provider.providerId, provider]));
  const defaultLocale = localeDefaults?.defaultLocale ?? 'tr';
  const sourceRow = (values: Record<string, JsonValue>, schema: RepeaterDefinition, binding: SourceBinding, id: string, prefix = '', depth = 0): Record<string, JsonValue> => {
    if (depth >= 8) { issues.push({code:'SOURCE_DEPTH_INVALID',message:'Kaynak listesi en fazla 8 düzey olabilir.',bindingId:binding.bindingId,severity:'error'}); return {__id:id}; }
    const row: Record<string, JsonValue> = { __id: id };
    const relativePrefix = depth ? prefix.split('.').slice(-depth).join('.') : '';
    for (const field of schema.itemFields) {
      row[field.key] = structuredClone(field.defaultValue);
      // A nested path is more specific than a parent field with the same leaf key.
      const mapping = [prefix ? `${prefix}.${field.key}` : '', relativePrefix ? `${relativePrefix}.${field.key}` : '', `${schema.repeaterId}.${field.key}`, field.fieldId, field.key]
        .filter(Boolean).map(target => binding.fieldMappings.find(item => item.to === target)).find(Boolean);
      if (!mapping) { if(depth>0 && values[field.key] !== undefined && matchesFieldType(field,values[field.key]!))row[field.key]=structuredClone(values[field.key]!); continue; }
      const value = readPath(values, mapping.from);
      if (value === undefined) issues.push({ code: 'SOURCE_FIELD_MISSING', message: `Kaynak kaydında “${mapping.from}” alanı yok.`, bindingId: binding.bindingId });
      else if (!matchesFieldType(field, value)) issues.push({ code: 'SOURCE_FIELD_TYPE_INVALID', message: `“${mapping.from}” değeri “${field.label}” alan türüyle uyumlu değil.`, bindingId: binding.bindingId });
      else row[field.key] = structuredClone(value);
    }
    for (const child of schema.childRepeaters ?? []) {
      const mapping = [prefix ? `${prefix}.${child.key}` : '', relativePrefix ? `${relativePrefix}.${child.key}` : '', child.key]
        .filter(Boolean).map(target => binding.fieldMappings.find(item => item.to === target)).find(Boolean);
      const raw = readPath(values, mapping?.from ?? child.key) ?? [];
      if (!Array.isArray(raw)) { issues.push({ code: 'SOURCE_FIELD_TYPE_INVALID', message: `“${child.label}” kaynağı bir liste olmalı.`, bindingId: binding.bindingId }); row[child.key] = []; continue; }
      if (raw.length < child.minItems || raw.length > child.maxItems) issues.push({ code: 'SOURCE_LIMIT', message: `“${child.label}” alt listesi sınırları aşıyor.`, bindingId: binding.bindingId });
      row[child.key] = raw.slice(0,child.maxItems).map((item,index) => {
        if (!item || Array.isArray(item) || typeof item !== 'object') { issues.push({code:'SOURCE_FIELD_TYPE_INVALID',message:'Alt menü kaydı bir nesne olmalı.',bindingId:binding.bindingId}); return {__id:`${id}-invalid-${index}`}; }
        return sourceRow(item, child, binding, `${id}-${safeId(String(item.id ?? item.recordId ?? index))}`, prefix ? `${prefix}.${child.key}` : child.key, depth + 1);
      });
    }
    return row;
  };
  for (const block of document.blocks) {
    const definition = definitions.get(`${block.definitionRef.id}@${block.definitionRef.version}`);
    if (!definition) continue;
    // A block binding provides the fallback data set. Explicit field and repeater
    // bindings, including an explicit manual choice, take precedence over it.
    const bindings = [...block.sourceBindings].sort((left, right) => Number(right.target.scope === 'block') - Number(left.target.scope === 'block'));
    for (const binding of bindings) {
      if (binding.mode === 'manual') continue;
      const localeContext = documentLocaleContext(document, localeDefaults?.defaultLocale ?? 'tr', localeDefaults?.fallback ?? { mode: 'none' }, binding.locale);
      const configuredTargets = definition.sourceCapabilities.target;
      const supportedTargets = Array.isArray(configuredTargets) ? configuredTargets : [configuredTargets];
      if (!definition.sourceCapabilities.modes.includes(binding.mode) || !supportedTargets.includes(binding.target.scope)) {
        issues.push({ code: 'SOURCE_UNSUPPORTED', message: 'Bu blok sürümü seçilen kaynak modunu veya bağlama alanını desteklemiyor.', bindingId: binding.bindingId, severity: 'error' });
        continue;
      }
      const provider = binding.providerId ? providerMap.get(binding.providerId) : undefined;
      if (!provider || !binding.collectionId) {
        issues.push({ code: 'SOURCE_UNAVAILABLE', message: 'İçerik sağlayıcısı veya koleksiyon kullanılamıyor.', bindingId: binding.bindingId, severity: 'error' });
        continue;
      }
      let records: ContentRecord[];
      try {
        records = binding.mode === 'selection'
          ? await resolveSelection(provider, binding, localeContext, defaultLocale, localeDefaults?.requireProviderLocaleDeclaration ?? false, localeDefaults?.context)
          : await resolveQuery(provider, binding, localeContext, defaultLocale, localeDefaults?.requireProviderLocaleDeclaration ?? false, localeDefaults?.context);
        for (const record of records) {
          const localeResolution = record.localeResolution;
          if (localeResolution && localeResolution.requestedLocale !== localeContext.locale) {
            issues.push({ code: 'SOURCE_LOCALE_MISMATCH', message: `Kaynak “${record.recordId}” istenen ${localeContext.locale} dilinde dönmedi.`, bindingId: binding.bindingId, severity: 'error' });
          } else if (localeResolution?.usedFallback) {
            issues.push({ code: 'SOURCE_LOCALE_FALLBACK', message: `“${record.recordId}” içeriği ${localeResolution.resolvedLocale} dilinden gösteriliyor.`, bindingId: binding.bindingId, severity: 'warning' });
          }
        }
      } catch (error) {
        issues.push({ code: 'SOURCE_RESOLUTION_FAILED', message: error instanceof Error ? error.message : 'İçerik kaynağı çözümlenemedi.', bindingId: binding.bindingId, severity: 'error' });
        continue;
      }
      if (binding.target.scope === 'block') {
        const specificTargets = new Set(block.sourceBindings.filter((item) => item.target.scope !== 'block').map((item) => `${item.target.scope}:${item.target.id}`));
        const scalarFields = definition.fields.filter((field) => !specificTargets.has(`field:${field.fieldId}`) && !specificTargets.has(`field:${field.key}`));
        const repeaters = definition.repeaters.filter((repeater) => !specificTargets.has(`repeater:${repeater.repeaterId}`) && !specificTargets.has(`repeater:${repeater.key}`));
        const firstRecord = records[0];
        if ((scalarFields.length || repeaters.length) && !firstRecord) {
          issues.push({ code: 'SOURCE_RECORD_MISSING', message: 'Blok kaynağı için bir kayıt seçilmedi veya sorgu kayıt döndürmedi.', bindingId: binding.bindingId });
          continue;
        }
        for (const field of scalarFields) {
          const mapping = binding.fieldMappings.find((item) => item.to === field.key || item.to === field.fieldId);
          if (!mapping) continue;
          const value = readPath(firstRecord!.values, mapping.from);
          if (value === undefined) issues.push({ code: 'SOURCE_FIELD_MISSING', message: `Kaynak kaydında “${mapping.from}” alanı yok.`, bindingId: binding.bindingId });
          else if (!matchesFieldType(field, value)) issues.push({ code: 'SOURCE_FIELD_TYPE_INVALID', message: `“${mapping.from}” değeri “${field.label}” alan türüyle uyumlu değil.`, bindingId: binding.bindingId });
          else block.manualData[field.key] = structuredClone(value);
        }
        for (const repeater of repeaters) {
          if (records.length < repeater.minItems || records.length > repeater.maxItems) {
            issues.push({ code: 'SOURCE_LIMIT', message: `Kaynak “${repeater.label}” için ${repeater.minItems}–${repeater.maxItems} kayıt sağlamalı; ${records.length} döndürdü.`, bindingId: binding.bindingId });
          }
          block.manualData[repeater.key] = records.slice(0, repeater.maxItems).map((record) => sourceRow(record.values, repeater, binding, `source-${safeId(binding.bindingId)}-${safeId(record.recordId)}`, repeater.key));        }
        continue;
      }
        const repeater = binding.target.scope === 'repeater'
          ? definition.repeaters.find((item) => item.repeaterId === binding.target.id || item.key === binding.target.id)
          : undefined;
        if (binding.target.scope === 'repeater' && !repeater) {
          issues.push({ code: 'SOURCE_TARGET_MISSING', message: 'Kaynak bağının işaret ettiği tekrarlayıcı bu blok sürümünde bulunamadı.', bindingId: binding.bindingId });
          continue;
        }
        if (repeater) {
          if (records.length < repeater.minItems || records.length > repeater.maxItems) {
            issues.push({ code: 'SOURCE_LIMIT', message: `Kaynak “${repeater.label}” için ${repeater.minItems}–${repeater.maxItems} kayıt sağlamalı; ${records.length} döndürdü.`, bindingId: binding.bindingId });
          }
          const rows = records.slice(0, repeater.maxItems).map((record) => sourceRow(record.values, repeater, binding, `source-${safeId(binding.bindingId)}-${safeId(record.recordId)}`));
          block.manualData[repeater.key] = rows;
        } else if (binding.target.scope === 'field') {
          const mapping = binding.fieldMappings[0];
          const field = definition.fields.find((item) => item.fieldId === binding.target.id || item.key === binding.target.id);
          const record = records[0];
          if (!field) {
            issues.push({ code: 'SOURCE_TARGET_MISSING', message: 'Kaynak bağının işaret ettiği alan bu blok sürümünde bulunamadı.', bindingId: binding.bindingId });
          } else if (!record) {
            issues.push({ code: 'SOURCE_RECORD_MISSING', message: 'Alan kaynağı için bir kayıt seçilmedi veya sorgu kayıt döndürmedi.', bindingId: binding.bindingId });
          } else if (mapping) {
            const value = readPath(record.values, mapping.from);
            if (value === undefined) issues.push({ code: 'SOURCE_FIELD_MISSING', message: `Kaynak kaydında “${mapping.from}” alanı yok.`, bindingId: binding.bindingId });
            else if (!matchesFieldType(field, value)) issues.push({ code: 'SOURCE_FIELD_TYPE_INVALID', message: `“${mapping.from}” değeri “${field.label}” alan türüyle uyumlu değil.`, bindingId: binding.bindingId });
            else block.manualData[field.key] = structuredClone(value);
          }
        }
    }
  }
  if (regions.length || document.sharedRegionRefs.length) {
    // Catalogs also contain archived and unrelated region versions. Resolve only this page's pins.
    const pins = new Set(document.sharedRegionRefs.map(ref => `${ref.id}@${ref.version}`));
    const collectPins = (value: JsonValue): void => {
      if (Array.isArray(value)) { value.forEach(collectPins); return; }
      if (!value || typeof value !== 'object') return;
      const attributes = value.attributes;
      if (attributes && !Array.isArray(attributes) && typeof attributes === 'object' && typeof attributes['data-bd-region-ref'] === 'string') pins.add(attributes['data-bd-region-ref']);
      Object.values(value).forEach(collectPins);
    };
    collectPins(document.projectData);
    const activeRegions = regions.filter(region => pins.has(`${region.ref.id}@${region.ref.version}`));
    for (const pin of pins) if (!activeRegions.some(region => `${region.ref.id}@${region.ref.version}` === pin)) issues.push({code:'SOURCE_REGION_MISSING',message:`Sabitlenmiş ortak bölge bulunamadı: ${pin}`,bindingId:pin,severity:'error'});
    const definitions = new Map<string, BlockDefinitionVersion>();
    const regionBlocks = activeRegions.map((region) => {
      definitions.set(`${region.ref.id}@${region.ref.version}`, { ...region, preview: 'custom', description: '', category: 'Bölgeler', repeaters: region.repeaters ?? [], defaultData: region.defaultData ?? {}, stylePolicy: { allowedProperties: [], structuralEdits: false }, sourceCapabilities: { modes: ['manual','selection','query'], target: ['block','field','repeater'] } });
      return { instanceId: region.ref.id, definitionRef: region.ref, variant: null, manualData: { ...structuredClone(region.defaultData ?? {}), ...structuredClone(document.sharedRegionData?.[`${region.ref.id}@${region.ref.version}`] ?? {}) }, sourceBindings: region.sourceBindings ?? [], styleOverrides: {} };
    });
    const resolved = await resolveDocumentSources({ ...document, blocks: regionBlocks, sharedRegionRefs: [], projectData: {} }, definitions, providers, [], localeDefaults);
    const values = Object.fromEntries(resolved.document.blocks.map((block) => [`${block.definitionRef.id}@${block.definitionRef.version}`, block.manualData]));
    document.sharedRegionData = {...document.sharedRegionData,...values};
    document.projectData = applySharedRegions(document.projectData, activeRegions, values);
    issues.push(...resolved.issues);
  }
  return { document, issues: issues.map(issue => ({ ...issue, severity: issue.severity ?? 'error' })) };
}

async function resolveSelection(provider: ContentProviderAdapter, binding: SourceBinding, localeContext: ContentLocaleContext, defaultLocale: string, requireLocaleDeclaration: boolean, requestContext?: import('@blockdesign/contracts').RequestContext) {
  const context = { ...requestContext, contentLocale: localeContext };
  if (!provider.capabilities.supported.includes('resolveRecords')) throw new Error('Sağlayıcı kayıt çözümlemeyi desteklemiyor.');
  const collection = await provider.getSchema(binding.collectionId!, context);
  if (binding.schemaVersion && collection.schemaVersion && binding.schemaVersion !== collection.schemaVersion) throw new Error('CMS şeması değişti; kaynak alanlarını yeniden eşle.');
  assertLocaleSupport(collection, localeContext, defaultLocale, requireLocaleDeclaration);
  if (!collection.capabilities.recordSelection && binding.recordRefs.length) throw new Error('Bu koleksiyon tekil kayıt seçimini desteklemiyor.');
  let groupRecords: ContentRecord[] = [];
  if (binding.groupRef) {
    if (!collection.capabilities.recordGroups || !provider.capabilities.supported.includes('recordGroups') || !provider.resolveGroup) throw new Error('Sağlayıcı kayıt grubu çözümlemeyi desteklemiyor.');
    groupRecords = await provider.resolveGroup(binding.collectionId!, binding.groupRef, context);
  }
  const resolved = binding.recordRefs.length ? await provider.resolveRecords(binding.collectionId!, binding.recordRefs, context) : [];
  const byId = new Map(resolved.map((item) => [item.recordId, item]));
  const selected = binding.recordRefs.flatMap((id) => {
    const item = byId.get(id);
    if (!item?.record) throw new Error(item?.error?.message ?? `“${id}” kaydı bulunamadı.`);
    return [item.record];
  });
  const unique = new Map<string, ContentRecord>();
  for (const record of [...groupRecords, ...selected]) unique.set(record.recordId, record);
  return [...unique.values()];
}

async function resolveQuery(provider: ContentProviderAdapter, binding: SourceBinding, localeContext: ContentLocaleContext, defaultLocale: string, requireLocaleDeclaration: boolean, requestContext?: import('@blockdesign/contracts').RequestContext) {
  const context = { ...requestContext, contentLocale: localeContext };
  if (!provider.query || !binding.query || !provider.capabilities.supported.includes('query')) throw new Error('Sağlayıcı otomatik sorguyu desteklemiyor.');
  if (!binding.query.limit || binding.query.limit < 1) throw new Error('Otomatik sorgu için 1 veya daha fazla kayıt sınırı gerekli.');
  const collection = await provider.getSchema(binding.collectionId!, context);
  if (binding.schemaVersion && collection.schemaVersion && binding.schemaVersion !== collection.schemaVersion) throw new Error('CMS şeması değişti; kaynak alanlarını yeniden eşle.');
  assertLocaleSupport(collection, localeContext, defaultLocale, requireLocaleDeclaration);
  const capability = collection.capabilities.query;
  if (!capability) throw new Error('Bu koleksiyon otomatik sorguyu desteklemiyor.');
  if (binding.query.limit > capability.maxLimit) throw new Error(`Sorgu sınırı ${capability.maxLimit} değerini aşamaz.`);
  for (const filter of binding.query.filters) {
    const field = capability.filterFields.find((item) => item.fieldId === filter.fieldId);
    if (!field || !field.operators.includes(filter.operator)) throw new Error(`“${filter.fieldId}” alanında “${filter.operator}” filtresi desteklenmiyor.`);
  }
  if (binding.query.sort && !capability.sortFields.includes(binding.query.sort.fieldId)) throw new Error(`“${binding.query.sort.fieldId}” alanına göre sıralama desteklenmiyor.`);
  return (await provider.query(binding.collectionId!, contextualQuery(binding.query, context), context)).items;
}

function assertLocaleSupport(collection: ProviderCollection, locale: ContentLocaleContext, defaultLocale: string, requireDeclaration: boolean): void {
  const support = collection.localization;
  if (support?.mode === 'neutral') return;
  if (support?.mode === 'translated') {
    const supported = support.supportedLocales?.map(value => normalizeLocale(value).toLowerCase());
    if (!supported?.length || localeSupported(supported, locale.locale)) return;
    if (locale.fallback.mode === 'locale' && localeSupported(supported, locale.fallback.locale)) return;
    throw new Error(`“${collection.label}” kaynağı ${locale.locale} dilini desteklemiyor.`);
  }
  if (!requireDeclaration && locale.locale.toLowerCase() === defaultLocale.toLowerCase()) return;
  throw new Error(`“${collection.label}” kaynağı ${locale.locale} dili için çeviri desteğini bildirmiyor.`);
}

function localeSupported(supported: string[], locale: string): boolean {
  const normalized = normalizeLocale(locale).toLowerCase();
  return supported.includes(normalized) || supported.includes(normalized.split('-', 1)[0]!);
}

function matchesFieldType(field: FieldDefinition, value: JsonValue): boolean {
  if (validateFieldValue(field, value, 'source').length) return false;
  if (value === null) return true;
  if (['text', 'textarea', 'richText', 'url', 'image', 'video', 'select', 'color'].includes(field.type)) return typeof value === 'string';
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (field.type === 'boolean') return typeof value === 'boolean';
  return false;
}

function readPath(values: Record<string, JsonValue>, path: string): JsonValue | undefined {
  return path.split('.').reduce<JsonValue | undefined>((value, segment) => {
    if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
    return value[segment];
  }, values);
}

// Escape every non-alphanumeric UTF-16 unit, including '_' and the '-' separator.
// Unlike replacing punctuation with '-', this preserves opaque CMS identity.
function safeId(value: string): string { return value.replace(/[^a-zA-Z0-9]/g, character => '_' + character.charCodeAt(0).toString(16).padStart(4, '0')); }
