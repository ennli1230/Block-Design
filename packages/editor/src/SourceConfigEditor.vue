<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from "vue";
import type {
  ContentProviderAdapter,
  ContentRecord,
  ContentRecordGroup,
  FieldDefinition,
  ProviderCollection,
  RepeaterDefinition,
  SourceBinding,
  LocaleDefinition,
  ContentLocaleContext,
} from "@blockdesign/contracts";
import { makeId } from "@blockdesign/core";
import { bindingMatchesTarget, preferredSourceTarget } from "./source-preview";
import { useUiText } from "./ui-i18n";
const props = defineProps<{
  providers: ContentProviderAdapter[];
  fields: FieldDefinition[];
  repeaters: RepeaterDefinition[];
  bindings: SourceBinding[];
  disabled?: boolean;
  blockId?: string;
  locales: LocaleDefinition[];
  currentLocale: string;
  defaultLocale: string;
  fallback: ContentLocaleContext["fallback"];
}>();
const t = inject<(key: string, fallback: string, values?: Record<string, string | number>) => string>("blockdesign:translate", (_key, fallback) => fallback);
const uiText = useUiText();
const emit = defineEmits<{ update: [bindings: SourceBinding[]] }>();
const filterField = ref(""),
  filterValue = ref("");
const contextPath=ref('page.recordId');
function toggleLive(enabled:boolean){if(enabled)put({live:{filters:[],syncUrl:true}});else if(binding.value){const next={...binding.value};delete next.live;emit('update',props.bindings.map(b=>b.bindingId===next.bindingId?next:b));}}
function toggleVisitorFilter(fieldId:string,checked:boolean){const capability=current.value?.collection.capabilities.query?.filterFields.find(f=>f.fieldId===fieldId);const operator=capability?.operators.find(op=>['eq','contains','gt','lt'].includes(op)) as 'eq'|'contains'|'gt'|'lt'|undefined;if(!binding.value?.live||!operator)return;put({live:{...binding.value.live,filters:[...binding.value.live.filters.filter(f=>f.fieldId!==fieldId),...(checked?[{fieldId,label:current.value?.collection.fields.find(f=>f.fieldId===fieldId)?.label??fieldId,operator}]:[])]}});}
function bindContext(){if(!binding.value?.query||!filterField.value)return;put({query:{...binding.value.query,filters:[{fieldId:filterField.value,operator:'eq',value:{$context:contextPath.value}}]}});}
const catalogs = ref<
    { provider: ContentProviderAdapter; collection: ProviderCollection }[]
  >([]),
  target = ref(""),
  search = ref(""),
  records = ref<ContentRecord[]>([]),
  groups = ref<ContentRecordGroup[]>([]),
  error = ref(""),
  busy = ref(false);
const targets = computed(() => [
  ...props.fields.map((f) => ({
    id: f.fieldId,
    label: f.label,
    scope: "field" as const,
    mappings: [{ key: f.key, label: f.label }],
  })),
  ...props.repeaters.map((r) => ({
    id: r.repeaterId,
    label: r.label,
    scope: "repeater" as const,
    mappings: [
      ...r.itemFields.map((f) => ({ key: f.key, label: f.label })),
      ...(r.childRepeaters ?? []).map((c) => ({
        key: c.key,
        label: `${c.label} · ${uiText('çocuk kayıt listesi')}`,
      })),
    ],
  })),
  ...(props.blockId
    ? [
        {
          id: props.blockId,
          label: uiText("Bütün bileşen"),
          scope: "block" as const,
          mappings: [
            ...props.fields.map((f) => ({ key: f.key, label: f.label })),
            ...props.repeaters.flatMap((r) => [
              ...r.itemFields.map((f) => ({
                key: r.key + "." + f.key,
                label: r.label + " · " + f.label,
              })),
              ...(r.childRepeaters ?? []).map((c) => ({
                key: r.key + "." + c.key,
                label: c.label + " · " + uiText("çocuk kayıt listesi"),
              })),
            ]),
          ],
        },
      ]
    : []),
]);
const chosen = computed(() => targets.value.find((t) => t.id === target.value));
const binding = computed(() =>
  chosen.value
    ? props.bindings.find((b) =>
        bindingMatchesTarget(b, {
          scope: chosen.value!.scope,
          id: target.value,
        }),
      )
    : undefined,
);
const requestContext = computed(() => ({ contentLocale: {
  locale: binding.value?.locale?.mode === "fixed" ? binding.value.locale.locale : props.currentLocale,
  fallback: props.fallback,
} }));
const localeIssue = computed(() => {
  if (!current.value) return "";
  const localization = current.value.collection.localization;
  if (localization?.mode === "neutral") return "";
  const supported = localization?.mode === "translated" ? localization.supportedLocales?.map(locale => locale.toLowerCase()) : undefined;
  const requested = requestContext.value.contentLocale.locale.toLowerCase();
  const supportedLocale = (locale: string) => Boolean(supported?.includes(locale.toLowerCase()) || supported?.includes(locale.toLowerCase().split("-", 1)[0] ?? locale.toLowerCase()));
  if (localization?.mode === "translated" && (!supported?.length || supportedLocale(requested))) return "";
  if (requestContext.value.contentLocale.fallback.mode === "locale" && supportedLocale(requestContext.value.contentLocale.fallback.locale)) return "";
  if (!localization && props.locales.length < 2 && requested === props.defaultLocale.toLowerCase()) return "";
  return t("source.localeUnsupported", `Bu koleksiyon ${requestContext.value.contentLocale.locale} dili için çeviri desteğini bildirmiyor.`, { locale: requestContext.value.contentLocale.locale });
});
watch(
  () => targets.value.map((t) => t.id).join("|"),
  () => {
    if (!targets.value.some((t) => t.id === target.value))
      target.value = preferredSourceTarget(
        targets.value.map((item) => ({ scope: item.scope, id: item.id })),
        props.bindings,
      );
  },
  { immediate: true },
);
watch(target, () => {
  records.value = [];
  groups.value = [];
  error.value = "";
});
const current = computed(() =>
  catalogs.value.find(
    (c) =>
      c.provider.providerId === binding.value?.providerId &&
      c.collection.collectionId === binding.value?.collectionId,
  ),
);
async function loadGroups(item = current.value) {
  groups.value = [];
  filterField.value = binding.value?.query?.filters[0]?.fieldId ?? "";
  filterValue.value = String(binding.value?.query?.filters[0]?.value ?? "");
  if (!item?.provider.listGroups || !item.collection.capabilities.recordGroups) return;
  if (localeIssue.value) { error.value = localeIssue.value; return; }
  try {
    const result = await item.provider.listGroups(item.collection.collectionId, requestContext.value);
    if (current.value === item) groups.value = result;
  } catch (e) {
    error.value = e instanceof Error ? e.message : uiText("Gruplar yüklenemedi.");
  }
}
watch([current, requestContext], ([item]) => { void loadGroups(item); }, { deep: true });
onMounted(async () => {
  for (const provider of props.providers) {
    try {
      const result = await provider.listCollections();
      catalogs.value.push(
        ...result.map((collection) => ({ provider, collection })),
      );
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Kaynak katalogları yüklenemedi.";
    }
  }
  if (!targets.value.some((item) => item.id === target.value))
    target.value = preferredSourceTarget(
      targets.value.map((item) => ({ scope: item.scope, id: item.id })),
      props.bindings,
    );
});
function put(change: Partial<SourceBinding>) {
  if (!chosen.value) return;
  const next: SourceBinding = {
    bindingId: binding.value?.bindingId ?? makeId("binding"),
    mode: "manual",
    providerId: null,
    collectionId: null,
    schemaVersion: null,
    recordRefs: [],
    groupRef: null,
    query: null,
    fieldMappings: [],
    ...binding.value,
    ...change,
    target: { scope: chosen.value.scope, id: chosen.value.id },
  };
  emit("update", [
    ...props.bindings.filter((b) => !bindingMatchesTarget(b, next.target)),
    next,
  ]);
}
async function collection(value: string) {
  const item = catalogs.value.find(
    (c) => `${c.provider.providerId}::${c.collection.collectionId}` === value,
  );
  records.value = [];
  groups.value = [];
  if (!item) {
    put({
      mode: "manual",
      providerId: null,
      collectionId: null,
      recordRefs: [],
      query: null,
    });
    return;
  }
  put({
    mode: "selection",
    providerId: item.provider.providerId,
    collectionId: item.collection.collectionId,
    schemaVersion: item.collection.schemaVersion,
    recordRefs: [],
    groupRef: null,
    query: null,
    fieldMappings: chosen.value!.mappings.flatMap((m) => {
      const leaf = m.key.split(".").at(-1);
      const aliases: Record<string, string> = {
        question: "title",
        answer: "body",
        description: "body",
        image: "cover",
      };
      const f =
        item.collection.fields.find((f) => f.fieldId === leaf) ??
        item.collection.fields.find((f) => f.fieldId === aliases[leaf ?? ""]);
      return f ? [{ from: f.fieldId, to: m.key }] : [];
    }),
  });
  if (item.provider.listGroups && item.collection.capabilities.recordGroups)
    groups.value = await item.provider.listGroups(item.collection.collectionId, requestContext.value);
}
async function load() {
  if (!current.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (localeIssue.value) throw new Error(localeIssue.value);
    records.value = (
      await current.value.provider.search(
        current.value.collection.collectionId,
        search.value,
        undefined,
        requestContext.value,
      )
    ).items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : uiText("Kayıtlar yüklenemedi.");
  } finally {
    busy.value = false;
  }
}
function mode(value: string) {
  if (value === "query") {
    const capability = current.value?.collection.capabilities.query;
    if (!capability) return;
    put({
      mode: "query",
      query: {
        filters: [],
        sort: null,
        limit:
          chosen.value?.scope === "field"
            ? 1
            : Math.min(10, capability.maxLimit),
      },
    });
  } else put({ mode: value as SourceBinding["mode"], query: null });
}
function select(id: string, checked: boolean) {
  if (chosen.value?.scope === "field") {
    put({ recordRefs: checked ? [id] : [] });
    return;
  }
  put({
    recordRefs: checked
      ? [...new Set([...(binding.value?.recordRefs ?? []), id])]
      : (binding.value?.recordRefs.filter((x) => x !== id) ?? []),
  });
}
function filter() {
  if (!binding.value?.query || !current.value) return;
  const capability =
    current.value.collection.capabilities.query?.filterFields.find(
      (f) => f.fieldId === filterField.value,
    );
  if (!capability) return;
  const field = current.value.collection.fields.find(
    (f) => f.fieldId === filterField.value,
  );
  const value =
    field?.valueType === "number"
      ? Number(filterValue.value)
      : filterValue.value;
  put({
    query: {
      ...binding.value.query,
      filters: filterField.value
        ? [
            {
              fieldId: filterField.value,
              operator: capability.operators.includes("eq")
                ? "eq"
                : (capability.operators[0] as "contains"),
              value,
            },
          ]
        : [],
    },
  });
}
function mapping(to: string, from: string) {
  put({
    fieldMappings: [
      ...(binding.value?.fieldMappings ?? []).filter((m) => m.to !== to),
      ...(from ? [{ from, to }] : []),
    ],
  });
}
</script>
<template>
  <details v-if="targets.length" class="bd-schema-tool">
    <summary>{{ t('source.dataSource', 'Veri kaynağı') }}</summary>
    <div class="bd-schema-row-body">
      <label class="bd-field-control"
        ><span class="bd-field-label">{{ t('source.target', 'Alan / liste') }}</span
        ><select v-model="target">
          <option v-for="t in targets" :key="t.id" :value="t.id">
            {{ t.label }}
          </option>
        </select></label
      >
      <label class="bd-field-control"
        ><span class="bd-field-label">{{ t('source.collection', 'Kaynak koleksiyonu') }}</span
        ><select
          :disabled="disabled"
          :value="
            current
              ? `${current.provider.providerId}::${current.collection.collectionId}`
              : ''
          "
          @change="
            collection(($event.target as HTMLSelectElement).value).catch(
              (e) => (error = String(e)),
            )
          "
        >
          <option value="">{{ t('source.manualContent', 'Manuel içerik') }}</option>
          <option
            v-for="c in catalogs"
            :key="`${c.provider.providerId}:${c.collection.collectionId}`"
            :value="`${c.provider.providerId}::${c.collection.collectionId}`"
          >
            {{ c.collection.label }}
          </option>
        </select></label
      >
      <template v-if="current">
        <details v-if="locales.length > 1" class="bd-source-locale-advanced">
          <summary>{{ t('source.advancedLocale', 'Gelişmiş dil ayarı') }}</summary>
          <label class="bd-field-control">
            <span class="bd-field-label">{{ t('source.locale', 'Kaynak dili') }}</span>
            <select :disabled="disabled" :value="binding?.locale?.mode === 'fixed' ? binding.locale.locale : 'inherit'" @change="put({ locale: ($event.target as HTMLSelectElement).value === 'inherit' ? { mode: 'inherit' } : { mode: 'fixed', locale: ($event.target as HTMLSelectElement).value } })">
              <option value="inherit">{{ t('source.inheritLocale', `Sayfa dilini kullan (${currentLocale})`, { locale: currentLocale }) }}</option>
              <option v-for="locale in locales" :key="locale.code" :value="locale.code">{{ locale.nativeLabel ?? locale.label }}</option>
            </select>
          </label>
          <p class="bd-draft-hint">{{ t('source.localeHelp', 'Bu kaynak yalnızca seçilen dilde çözülür. Diğer bloklar sayfa dilini izlemeye devam eder.') }}</p>
        </details>
        <label class="bd-field-control"
          ><span class="bd-field-label">{{ t('source.selectionMode', 'Veri seçimi') }}</span
          ><select
            :disabled="disabled"
            :value="binding?.mode"
            @change="mode(($event.target as HTMLSelectElement).value)"
          >
            <option value="manual">{{ t('source.useManualDraft', 'Manuel taslağı kullan') }}</option>
            <option
              v-if="current.collection.capabilities.recordSelection"
              value="selection"
            >
              {{ t('source.selectRecords', 'Kayıt / menü seç') }}
            </option>
            <option
              v-if="
                current.collection.capabilities.query && current.provider.query
              "
              value="query"
            >
              {{ t('source.query', 'Otomatik sorgu') }}
            </option>
          </select></label
        >
        <template v-if="binding?.mode === 'selection'"
          ><div class="bd-source-search">
            <input
              v-model="search"
              :aria-label="t('source.search', 'Kaynakta ara')"
              :placeholder="t('source.search', 'Kaynakta ara')"
              @keydown.enter.prevent="load"
            /><button type="button" :disabled="disabled || busy || Boolean(localeIssue)" @click="load">
              {{ busy ? t('source.loading', 'Yükleniyor…') : t('source.loadRecords', 'Kayıtları getir') }}
            </button>
          </div>
          <p v-if="localeIssue" class="bd-field-error" role="status">{{ localeIssue }}</p>
          <label v-if="groups.length" class="bd-field-control"
            ><span class="bd-field-label">{{ t('source.recordGroup', 'Kayıt grubu') }}</span
            ><select
              :disabled="disabled"
              :value="binding.groupRef ?? ''"
              @change="
                put({
                  groupRef: ($event.target as HTMLSelectElement).value || null,
                })
              "
            >
              <option value="">{{ t('source.noGroup', 'Grup seçme') }}</option>
              <option v-for="g in groups" :key="g.groupId" :value="g.groupId">
                {{ g.label }}
              </option>
            </select></label
          ><label
            v-for="record in records"
            :key="record.recordId"
            class="bd-toggle-row"
            ><input
              type="checkbox"
              :disabled="disabled"
              :checked="binding.recordRefs.includes(record.recordId)"
              @change="
                select(
                  record.recordId,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />{{
              record.values.title ?? record.values.label ?? record.recordId
            }}</label
          >
          <p v-if="binding.groupRef" class="bd-draft-hint">
            {{ t('source.selectedGroup', 'Seçilen menü / kayıt grubunun öğeleri CMS’den gelir.') }}
          </p>
          <p v-if="binding.recordRefs.length || !binding.groupRef" class="bd-draft-hint">
            {{ t('source.selectedRecords', `${binding.recordRefs.length} kayıt seçili. Liste sırası seçme sırasıdır.`, { count: binding.recordRefs.length }) }}
          </p></template
        >
        <template v-if="binding?.mode === 'query' && binding.query"
          >
          <template v-if="chosen?.scope==='repeater' && repeaters.find(r=>r.repeaterId===chosen?.id)?.mappingTarget">
            <label class="bd-toggle-row"><input type="checkbox" :disabled="disabled || !current.provider.queryPage || !current.provider.capabilities.supported.includes('queryPage')" :checked="Boolean(binding.live)" @change="toggleLive(($event.target as HTMLInputElement).checked)" />Canlı listede sayfalama ve filtreler</label>
            <p v-if="!current.provider.queryPage" class="bd-draft-hint">CMS sağlayıcısı sayfalı sorgu desteği sunmalı.</p>
            <template v-if="binding.live"><label v-for="f in current.collection.capabilities.query?.filterFields" :key="f.fieldId" class="bd-toggle-row"><input type="checkbox" :disabled="disabled" :checked="binding.live.filters.some(item=>item.fieldId===f.fieldId)" @change="toggleVisitorFilter(f.fieldId,($event.target as HTMLInputElement).checked)" />Ziyaretçi filtresi: {{ f.fieldId }}</label></template>
          </template>
          <label class="bd-field-control"
            ><span class="bd-field-label">{{ t('source.recordLimit', 'Kayıt sınırı') }}</span
            ><input
              type="number"
              min="1"
              :max="current.collection.capabilities.query?.maxLimit"
              :value="binding.query.limit"
              :disabled="disabled"
              @change="
                put({
                  query: {
                    ...binding!.query!,
                    limit: Number(($event.target as HTMLInputElement).value),
                  },
                })
              " /></label
          ><label class="bd-field-control"
            ><span class="bd-field-label">{{ t('source.sortField', 'Sıralama alanı') }}</span
            ><select
              :disabled="disabled"
              :value="binding.query.sort?.fieldId ?? ''"
              @change="
                put({
                  query: {
                    ...binding!.query!,
                    sort: ($event.target as HTMLSelectElement).value
                      ? {
                          fieldId: ($event.target as HTMLSelectElement).value,
                          direction: 'asc',
                        }
                      : null,
                  },
                })
              "
            >
              <option value="">{{ t('source.sourceOrder', 'Kaynak sırası') }}</option>
              <option
                v-for="f in current.collection.capabilities.query?.sortFields"
                :key="f"
                :value="f"
              >
                {{ f }}
              </option>
            </select></label
          ><label v-if="binding.query.sort" class="bd-field-control"
            ><span class="bd-field-label">{{ t('source.sortDirection', 'Sıralama yönü') }}</span
            ><select
              :value="binding.query.sort.direction"
              :disabled="disabled"
              @change="
                put({
                  query: {
                    ...binding!.query!,
                    sort: {
                      ...binding!.query!.sort!,
                      direction: ($event.target as HTMLSelectElement).value as
                        | 'asc'
                        | 'desc',
                    },
                  },
                })
              "
            >
              <option value="asc">{{ t('source.ascending', 'Artan') }}</option>
              <option value="desc">{{ t('source.descending', 'Azalan') }}</option>
            </select></label
          >
          <template
            v-if="current.collection.capabilities.query?.filterFields.length"
            ><label class="bd-field-control"
              ><span class="bd-field-label">{{ t('source.filterField', 'Filtre alanı') }}</span
              ><select v-model="filterField">
                <option value="">{{ t('source.chooseFilter', 'Filtre seç') }}</option>
                <option
                  v-for="f in current.collection.capabilities.query
                    .filterFields"
                  :key="f.fieldId"
                  :value="f.fieldId"
                >
                  {{ f.fieldId }}
                </option>
              </select></label
            ><label class="bd-field-control"
              ><span class="bd-field-label">{{ t('source.filterValue', 'Filtre değeri') }}</span
              ><input v-model="filterValue" /></label
            ><button
              type="button"
              class="bd-outline-button"
              :disabled="disabled"
              @click="filter"
            >
              {{ t('source.applyFilter', 'Filtreyi uygula') }}
            </button>
            <label class="bd-field-control"><span class="bd-field-label">Sayfa bağlamı alanı</span><input v-model="contextPath" placeholder="page.route.category" :disabled="disabled" /></label>
            <button type="button" class="bd-outline-button" :disabled="disabled || !filterField || !current.collection.capabilities.query?.filterFields.find(f=>f.fieldId===filterField)?.operators.includes('eq')" @click="bindContext">Filtreyi sayfa bağlamına bağla</button></template
          >
        </template>
        <label
          v-for="m in chosen?.mappings"
          :key="m.key"
          class="bd-field-control"
          ><span class="bd-field-label">{{ m.label }}</span
          ><select
            :disabled="disabled"
            :value="
              binding?.fieldMappings.find((f) => f.to === m.key)?.from ?? ''
            "
            @change="mapping(m.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ t('source.notMapped', 'Eşlenmedi') }}</option>
            <option
              v-for="f in current.collection.fields"
              :key="f.fieldId"
              :value="f.fieldId"
            >
              {{ f.label }}
            </option>
          </select></label
        >
        <p
          v-if="repeaters.some((repeater) => repeater.childRepeaters?.length)"
          class="bd-draft-hint"
        > {{ uiText('Alt liste anahtarları kaynaktaki öğelerle aynı olmalı.') }} </p>
      </template>
      <p v-if="error" class="bd-field-error" role="alert">{{ error }}</p>
    </div>
  </details>
</template>
