<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import type {
  FieldDefinition,
  JsonValue,
  RepeaterDefinition,
} from "@blockdesign/contracts";
import { findTemplateNode, makeId } from "@blockdesign/core";
import Icon from "./Icon.vue";
import { useUiText } from "./ui-i18n";
const uiText = useUiText();
const t = inject<(key: string, fallback: string, values?: Record<string, string | number>) => string>("blockdesign:translate", (_key, fallback) => fallback);
import {
  completeRepeaterFields,
  inferRepeaterSelection,
  readTemplateFieldValue,
  repeaterItems,
  seedRepeaterRows,
} from "./repeater-authoring";
const props = defineProps<{
  template: JsonValue;
  fields: FieldDefinition[];
  repeaters: RepeaterDefinition[];
  values: Record<string, JsonValue>;
  selectedNodeId?: string | null;
  view: "fields" | "lists";
}>();
const emit = defineEmits<{
  update: [
    schema: {
      fields: FieldDefinition[];
      repeaters: RepeaterDefinition[];
      values: Record<string, JsonValue>;
    },
  ];
  select: [nodeId: string];
  lists: [];
}>();
const targetId = ref(""),
  label = ref(""),
  key = ref(""),
  type = ref<FieldDefinition["type"]>("text"),
  property = ref(""),
  scope = ref("");
const containerId = ref(""),
  sampleId = ref(""),
  parentId = ref(""),
  listLabel = ref(uiText("Öğeler")),
  listKey = ref(""),
  min = ref(0),
  max = ref(100),
  error = ref("");
const listCreateOpen = ref(!props.repeaters.length);
const createdListId = ref("");
const success = ref("");
const slug = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const nodes = computed(() => {
  const result: {
    id: string;
    label: string;
    tag: string;
    parent: string | null;
    depth: number;
  }[] = [];
  function walk(value: JsonValue, parent: string | null, depth: number) {
    if (!value || Array.isArray(value) || typeof value !== "object") return;
    const attrs = value.attributes as Record<string, JsonValue> | undefined;
    const id =
      typeof attrs?.["data-bd-node"] === "string"
        ? attrs["data-bd-node"]
        : null;
    const tag = String(value.tagName ?? "div");
    const text = JSON.stringify(value.components ?? value.content ?? "")
      .replace(/<[^>]+>/g, "")
      .slice(0, 45);
    if (id)
      result.push({
        id,
        label: `${"— ".repeat(depth)}${tag}${attrs?.id ? ` #${attrs.id}` : ""}${attrs?.class ? ` .${String(attrs.class).split(" ")[0]}` : ""}${text && !text.startsWith("[{") ? ` ${text}` : ""}`,
        tag,
        parent,
        depth,
      });
    if (Array.isArray(value.components))
      value.components.forEach((child) => walk(child, id ?? parent, depth + 1));
  }
  walk(props.template, null, 0);
  return result;
});
const schemas = computed(() => {
  const result: { schema: RepeaterDefinition; path: RepeaterDefinition[] }[] =
    [];
  function walk(items: RepeaterDefinition[], path: RepeaterDefinition[]) {
    for (const schema of items) {
      const next = [...path, schema];
      result.push({ schema, path: next });
      walk(schema.childRepeaters ?? [], next);
    }
  }
  walk(props.repeaters, []);
  return result;
});
const selectedNode = computed(() =>
  nodes.value.find((node) => node.id === targetId.value),
);
const repeaterSuggestion = computed(() => {
  const suggestion = inferRepeaterSelection(props.template, targetId.value);
  return suggestion &&
    !schemas.value.some(
      (item) =>
        item.schema.mappingTarget?.containerNodeId ===
        suggestion.containerNodeId,
    )
    ? suggestion
    : null;
});
const listPreview = computed(() => {
  if (!containerId.value || !sampleId.value) return null;
  try {
    const items = repeaterItems(
      props.template,
      containerId.value,
      sampleId.value,
    );
    const sample = findTemplateNode(props.template, sampleId.value)!;
    const sourceFields = parentId.value
      ? (findSchema(props.repeaters, parentId.value)?.itemFields ?? [])
      : props.fields;
    const mapped = sourceFields.filter((field) =>
      findTemplateNode(sample, field.mappingTarget.nodeId),
    );
    return {
      count: items.length,
      fields: completeRepeaterFields(props.template, sampleId.value, mapped)
        .length,
      error: "",
    };
  } catch (cause) {
    return {
      count: 0,
      fields: 0,
      error:
        cause instanceof Error ? cause.message : "Öğe seçimini kontrol et.",
    };
  }
});
function prepareRepeater() {
  const suggestion = repeaterSuggestion.value;
  if (!suggestion) return;
  containerId.value = suggestion.containerNodeId;
  sampleId.value = suggestion.itemNodeId;
  parentId.value =
    schemas.value
      .filter(
        (item) =>
          item.schema.mappingTarget &&
          findTemplateNode(
            findTemplateNode(
              props.template,
              item.schema.mappingTarget.itemNodeId,
            )!,
            suggestion.containerNodeId,
          ),
      )
      .sort((a, b) => b.path.length - a.path.length)[0]?.schema.repeaterId ??
    "";
  if (
    listLabel.value === "Öğeler" &&
    findTemplateNode(props.template, suggestion.itemNodeId)?.tagName ===
      "article"
  )
    listLabel.value = uiText("Kartlar");
  listCreateOpen.value = true;
  success.value = "";
  emit("lists");
}
const typeLabels = computed<Record<FieldDefinition["type"], string>>(() => ({
  text: uiText("Metin"),
  textarea: uiText("Açıklama"),
  url: uiText("Bağlantı"),
  image: uiText("Görsel"),
  video: uiText("Video"),
  number: uiText("Sayı"),
  boolean: uiText("Gizleme"),
  color: uiText("Renk"),
  select: uiText("Seçenek"),
  richText: uiText("Zengin metin"),
}));
watch(
  () => props.selectedNodeId,
  (id) => {
    targetId.value = id && nodes.value.some((n) => n.id === id) ? id : "";
  },
  { immediate: true },
);
watch(
  targetId,
  (id) => {
    const tag = nodes.value.find((node) => node.id === id)?.tag;
    type.value =
      tag === "img"
        ? "image"
        : tag === "a"
          ? "url"
          : tag === "video"
            ? "video"
            : "text";
    const match = schemas.value
      .filter(
        (item) =>
          item.schema.mappingTarget &&
          findTemplateNode(
            findTemplateNode(
              props.template,
              item.schema.mappingTarget.itemNodeId,
            )!,
            id,
          ),
      )
      .sort((a, b) => b.path.length - a.path.length)[0];
    scope.value = match?.schema.repeaterId ?? "";
  },
  { immediate: true },
);
watch(type, () => {
  property.value = "";
});
watch(
  () => props.view,
  (view) => {
    error.value = "";
    if (view === "lists" && !containerId.value && repeaterSuggestion.value)
      prepareRepeater();
  },
);
watch(containerId, (id) => {
  const children = nodes.value.filter((node) => node.parent === id);
  const current = nodes.value.find(
    (node) => node.id === targetId.value && node.parent === id,
  );
  if (current) sampleId.value = current.id;
  else if (!children.some((node) => node.id === sampleId.value))
    sampleId.value = children[0]?.id ?? "";
});
function select(id: string) {
  targetId.value = id;
  emit("select", id);
}
function findSchema(
  items: RepeaterDefinition[],
  id: string,
): RepeaterDefinition | undefined {
  for (const item of items) {
    if (item.repeaterId === id) return item;
    const child = findSchema(item.childRepeaters ?? [], id);
    if (child) return child;
  }
}
function updateScope(
  values: Record<string, JsonValue>,
  path: RepeaterDefinition[],
  fn: (row: Record<string, JsonValue>) => void,
) {
  if (!path.length) {
    fn(values);
    return;
  }
  const [head, ...rest] = path;
  const rows = values[head!.key];
  if (Array.isArray(rows))
    for (const row of rows)
      if (row && typeof row === "object" && !Array.isArray(row))
        updateScope(row, rest, fn);
}
function nodeValue(field: FieldDefinition): JsonValue {
  return readTemplateFieldValue(props.template, field);
}
function addField() {
  error.value = "";
  const id = targetId.value;
  if (!id || !findTemplateNode(props.template, id)) {
    error.value = uiText('Tuvalden veya öğe listesinden bir hedef seç.');
    return;
  }
  const name = label.value.trim(),
    fieldKey = slug(key.value || name);
  if (!name || !fieldKey) {
    error.value = uiText('Alan adı ve anahtarı gerekli.');
    return;
  }
  const fields = structuredClone(props.fields),
    repeaters = structuredClone(props.repeaters),
    values = structuredClone(props.values);
  const schema = scope.value ? findSchema(repeaters, scope.value) : undefined;
  const targetFields = schema ? schema.itemFields : fields;
  if (targetFields.some((f) => f.key === fieldKey)) {
    error.value = uiText('Bu anahtar seçilen kapsamda zaten var.');
    return;
  }
  if (
    schema &&
    !findTemplateNode(
      findTemplateNode(props.template, schema.mappingTarget!.itemNodeId)!,
      id,
    )
  ) {
    error.value = uiText('Hedef, seçilen listenin örnek öğesinin içinde olmalı.');
    return;
  }
  const operation: FieldDefinition["mappingTarget"]["operation"] =
    type.value === "boolean"
      ? "booleanVisibility"
      : type.value === "color"
        ? "style"
        : ["image", "video", "url"].includes(type.value) || property.value
          ? "attribute"
          : "text";
  const prop =
    property.value.trim() ||
    (type.value === "url"
      ? "href"
      : type.value === "color"
        ? "background-color"
        : "src");
  if (operation === "attribute" && /^(?:on|style$|srcdoc$)/i.test(prop)) {
    error.value = uiText('Bu HTML niteliği alan olarak kullanılamaz.');
    return;
  }
  const field: FieldDefinition = {
    fieldId: makeId("field"),
    key: fieldKey,
    label: name,
    type: type.value,
    required: false,
    defaultValue: "",
    mappingTarget: {
      nodeId: id,
      operation,
      ...(operation === "attribute" || operation === "style"
        ? { property: prop }
        : {}),
    },
  };
  field.defaultValue = nodeValue(field);
  if (field.type === "number")
    field.defaultValue = Number(field.defaultValue) || 0;
  targetFields.push(field);
  const path =
    schemas.value.find((s) => s.schema.repeaterId === scope.value)?.path ?? [];
  updateScope(values, path, (row) => {
    row[field.key] = structuredClone(field.defaultValue);
  });
  emit("update", { fields, repeaters, values });
  label.value = "";
  key.value = "";
}
function addList() {
  error.value = "";
  const container = findTemplateNode(props.template, containerId.value),
    sample = findTemplateNode(props.template, sampleId.value);
  const sampleInfo = nodes.value.find((n) => n.id === sampleId.value);
  if (!container || !sample || sampleInfo?.parent !== containerId.value) {
    error.value = uiText('Liste kapsayıcısını ve doğrudan içindeki örnek öğeyi seç.');
    return;
  }
  const fieldKey = slug(listKey.value || listLabel.value);
  if (
    !fieldKey ||
    !listLabel.value.trim() ||
    min.value < 0 ||
    max.value < min.value ||
    max.value > 500
  ) {
    error.value = uiText('Liste adı, anahtarı ve 0–500 arası sınırları kontrol et.');
    return;
  }
  const fields = structuredClone(props.fields),
    repeaters = structuredClone(props.repeaters),
    values = structuredClone(props.values);
  const parent = parentId.value
    ? findSchema(repeaters, parentId.value)
    : undefined;
  if (
    parent &&
    (!findTemplateNode(
      findTemplateNode(props.template, parent.mappingTarget!.itemNodeId)!,
      containerId.value,
    ) ||
      schemas.value.find((s) => s.schema.repeaterId === parentId.value)!.path
        .length >= 7)
  ) {
    error.value =
      uiText('Alt liste üst listenin örnek öğesi içinde olmalı; en fazla 8 düzey desteklenir.');
    return;
  }
  const destination = parent ? (parent.childRepeaters ??= []) : repeaters;
  if (destination.some((r) => r.key === fieldKey)) {
    error.value =
      uiText('Bu adla bir liste var. Adı veya gelişmiş ayarlardaki veri anahtarını değiştir.');
    return;
  }
  const candidates = parent ? parent.itemFields : fields;
  const moved = candidates.filter((f) =>
    Boolean(findTemplateNode(sample, f.mappingTarget.nodeId)),
  );
  if (
    schemas.value.some(
      (item) =>
        item.schema.mappingTarget?.containerNodeId === containerId.value,
    )
  ) {
    error.value =
      uiText('Bu kapsayıcı zaten bir listeye bağlı. Tanımlı listeyi kullan.');
    return;
  }
  let itemFields: FieldDefinition[], rows: Record<string, JsonValue>[];
  try {
    itemFields = completeRepeaterFields(props.template, sampleId.value, moved);
    rows = seedRepeaterRows(
      props.template,
      containerId.value,
      sampleId.value,
      itemFields,
      parent ? {} : values,
    );
    if (rows.length > max.value || rows.length < min.value)
      throw new Error(t("repeater.containerCount", "Kapsayıcıda {count} öğe var. Gelişmiş ayarlardaki öğe sınırlarını kontrol et.", { count: rows.length }));
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : uiText("Liste oluşturulamadı.");
    return;
  }
  if (parent)
    parent.itemFields = parent.itemFields.filter((f) => !moved.includes(f));
  else
    for (const f of moved) {
      fields.splice(fields.indexOf(f), 1);
      delete values[f.key];
    }
  const schema: RepeaterDefinition = {
    repeaterId: makeId("repeater"),
    key: fieldKey,
    label: listLabel.value.trim(),
    minItems: min.value,
    maxItems: max.value,
    itemFields,
    nesting: "none",
    mappingTarget: {
      containerNodeId: containerId.value,
      itemNodeId: sampleId.value,
      replaceChildren: true,
    },
  };
  destination.push(schema);
  if (parent) parent.nesting = "children";
  const path =
    schemas.value.find((s) => s.schema.repeaterId === parentId.value)?.path ??
    [];
  updateScope(values, path, (value) => {
    value[fieldKey] = structuredClone(rows);
  });
  emit("update", { fields, repeaters, values });
  scope.value = schema.repeaterId;
  createdListId.value = schema.repeaterId;
  listCreateOpen.value = false;
  success.value = t("repeater.created", "{name} oluşturuldu: {items} öğe, {fields} alan.", { name: schema.label, items: rows.length, fields: itemFields.length });
}
function removeField(id: string, scopeId = "") {
  const fields = structuredClone(props.fields),
    repeaters = structuredClone(props.repeaters),
    values = structuredClone(props.values);
  const schema = scopeId ? findSchema(repeaters, scopeId) : null;
  const list = schema?.itemFields ?? fields;
  const f = list.find((f) => f.fieldId === id);
  if (!f) return;
  list.splice(list.indexOf(f), 1);
  updateScope(
    values,
    schemas.value.find((s) => s.schema.repeaterId === scopeId)?.path ?? [],
    (row) => {
      delete row[f.key];
    },
  );
  emit("update", { fields, repeaters, values });
}
function removeList(id: string) {
  const entry = schemas.value.find((item) => item.schema.repeaterId === id);
  if (!entry) return;
  const fields = structuredClone(props.fields),
    repeaters = structuredClone(props.repeaters),
    values = structuredClone(props.values);
  const parentPath = entry.path.slice(0, -1);
  const parent = parentPath.length
    ? findSchema(repeaters, parentPath.at(-1)!.repeaterId)
    : undefined;
  const lists = parent?.childRepeaters ?? repeaters;
  const index = lists.findIndex((item) => item.repeaterId === id);
  if (index < 0) return;
  lists.splice(index, 1);
  if (parent && !lists.length) parent.nesting = "none";
  updateScope(values, parentPath, (row) => {
    delete row[entry.schema.key];
  });
  scope.value = "";
  emit("update", { fields, repeaters, values });
}
</script>
<template>
  <section class="bd-schema-designer" :aria-label="uiText('Alan ve liste eşleme')">
    <div v-show="view === 'fields'">
      <h3 class="bd-authoring-title">{{ uiText('Alan ekle') }}</h3>
      <div v-if="repeaterSuggestion" class="bd-repeater-shortcut">
        <button
          type="button"
          class="bd-outline-button"
          @click="prepareRepeater"
        >
          <Icon name="rows" /> {{ uiText('Seçili kartları repeater yap') }} </button>
        <span>{{ repeaterSuggestion.count }} {{ uiText('öğe bulundu') }}</span>
      </div>
      <p v-if="!selectedNode" class="bd-authoring-notice"> {{ uiText('Tuvalden veya üstteki listeden bir öğe seç.') }} </p>
      <form class="bd-authoring-form" @submit.prevent="addField">
        <fieldset :disabled="!selectedNode">
          <label class="bd-field-control"
            ><span class="bd-field-label">{{ uiText('Alan adı') }}</span
            ><input v-model="label" :placeholder="uiText('Örn. Kart başlığı')"
          /></label>
          <label class="bd-field-control"
            ><span class="bd-field-label">{{ uiText('Alan türü') }}</span
            ><select v-model="type">
              <option value="text">{{ uiText('Metin') }}</option>
              <option value="textarea">{{ uiText('Açıklama') }}</option>
              <option value="url">{{ uiText('Bağlantı') }}</option>
              <option value="image">{{ uiText('Görsel / logo / ikon') }}</option>
              <option value="video">{{ uiText('Video') }}</option>
              <option value="number">{{ uiText('Sayı') }}</option>
              <option value="boolean">{{ uiText('Gizleme') }}</option>
              <option value="color">{{ uiText('Arka plan rengi') }}</option>
            </select></label
          >
          <label v-if="schemas.length" class="bd-field-control"
            ><span class="bd-field-label">{{ uiText('Alan kapsamı') }}</span
            ><select v-model="scope">
              <option value="">{{ uiText('Bölümün kendisi') }}</option>
              <option
                v-for="item in schemas"
                :key="item.schema.repeaterId"
                :value="item.schema.repeaterId"
              >
                {{ item.path.map((p) => p.label).join(" / ") }} {{ uiText('öğesi') }} </option>
            </select></label
          >
          <details class="bd-authoring-advanced">
            <summary>{{ uiText('Gelişmiş ayarlar') }}</summary>
            <div class="bd-schema-row-body">
              <label class="bd-field-control"
                ><span class="bd-field-label">{{ uiText('Veri anahtarı') }}</span
                ><input
                  v-model="key"
                  :placeholder="slug(label) || uiText('Alan adından oluşturulur')"
              /></label>
              <label
                v-if="['url', 'image', 'video', 'color'].includes(type)"
                class="bd-field-control"
                ><span class="bd-field-label">{{ uiText('HTML niteliği / stil') }}</span
                ><input
                  v-model="property"
                  :placeholder="
                    type === 'url'
                      ? 'href'
                      : type === 'color'
                        ? 'background-color'
                        : 'src'
                  "
              /></label>
            </div>
          </details>
          <button
            type="submit"
            class="bd-outline-button"
            :disabled="!selectedNode || !label.trim()"
          >
            <Icon name="plus" /> {{ uiText('Seçili öğeyi alan yap') }} </button>
        </fieldset>
      </form>
      <p v-if="error" class="bd-field-error" role="alert">{{ error }}</p>
      <details v-if="fields.length" class="bd-schema-tool bd-mapped-group" open>
        <summary> {{ uiText('Bölüm alanları') }} <span class="bd-authoring-count">{{ fields.length }}</span>
        </summary>
        <div class="bd-mapped-fields">
          <div
            v-for="field in fields"
            :key="field.fieldId"
            class="bd-mapped-field"
          >
            <button
              type="button"
              class="bd-mapped-field-select"
              @click="select(field.mappingTarget.nodeId)"
            >
              <span>{{ field.label }}</span
              ><small>{{ typeLabels[field.type] }}</small>
            </button>
            <button
              type="button"
              class="bd-square-small"
              :aria-label="`${field.label} eşlemesini kaldır`"
              @click="removeField(field.fieldId)"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
      </details>
      <details
        v-for="item in schemas"
        :key="item.schema.repeaterId"
        class="bd-schema-tool bd-mapped-group"
      >
        <summary>
          {{ item.path.map((p) => p.label).join(" / ") }} {{ uiText('alanları') }} <span class="bd-authoring-count">{{
            item.schema.itemFields.length
          }}</span>
        </summary>
        <div class="bd-mapped-fields">
          <div
            v-for="field in item.schema.itemFields"
            :key="field.fieldId"
            class="bd-mapped-field"
          >
            <button
              type="button"
              class="bd-mapped-field-select"
              @click="select(field.mappingTarget.nodeId)"
            >
              <span>{{ field.label }}</span
              ><small>{{ typeLabels[field.type] }}</small>
            </button>
            <button
              type="button"
              class="bd-square-small"
              :aria-label="`${field.label} eşlemesini kaldır`"
              @click="removeField(field.fieldId, item.schema.repeaterId)"
            >
              <Icon name="close" />
            </button>
          </div>
          <p v-if="!item.schema.itemFields.length" class="bd-authoring-notice"> {{ uiText('Örnek öğeyi seçip bu listeye bir alan ekle.') }} </p>
        </div>
      </details>
    </div>
    <div v-show="view === 'lists'">
      <h3 class="bd-authoring-title">{{ uiText('Repeater / liste') }}</h3>
      <p class="bd-authoring-notice"> {{ uiText('Bir kartı tanımla, içerikte istediğin kadar çoğalt.') }} </p>
      <details
        class="bd-schema-tool bd-list-create"
        :open="listCreateOpen"
        @toggle="listCreateOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary>{{ uiText('Repeater ekle') }}</summary>
        <form
          class="bd-authoring-form bd-schema-row-body"
          @submit.prevent="addList"
        >
          <label class="bd-field-control"
            ><span class="bd-field-label">{{ uiText('Liste adı') }}</span
            ><input v-model="listLabel" :placeholder="uiText('Örn. Kartlar')"
          /></label>
          <label class="bd-field-control"
            ><span class="bd-field-label">{{ uiText('Liste kapsayıcısı') }}</span
            ><select v-model="containerId">
              <option value="">{{ uiText('Kartları saran öğeyi seç') }}</option>
              <option v-for="node in nodes" :key="node.id" :value="node.id">
                {{ node.label }}
              </option>
            </select></label
          >
          <button
            type="button"
            class="bd-authoring-text-button"
            v-if="repeaterSuggestion"
            @click="prepareRepeater"
          > {{ uiText('Seçili karttan otomatik doldur') }} </button>
          <label class="bd-field-control"
            ><span class="bd-field-label">{{ uiText('Tekrarlanacak örnek öğe') }}</span
            ><select v-model="sampleId" :disabled="!containerId">
              <option value="">{{ uiText('Bir kart / liste öğesi seç') }}</option>
              <option
                v-for="node in nodes.filter((n) => n.parent === containerId)"
                :key="node.id"
                :value="node.id"
              >
                {{ node.label }}
              </option>
            </select></label
          >
          <label v-if="schemas.length" class="bd-field-control"
            ><span class="bd-field-label">{{ uiText('Üst liste') }}</span
            ><select v-model="parentId">
              <option value="">{{ uiText('Ana liste') }}</option>
              <option
                v-for="item in schemas"
                :key="item.schema.repeaterId"
                :value="item.schema.repeaterId"
              >
                {{ item.path.map((p) => p.label).join(" / ") }}
              </option>
            </select></label
          >
          <details class="bd-authoring-advanced">
            <summary>{{ uiText('Gelişmiş ayarlar') }}</summary>
            <div class="bd-schema-row-body">
              <label class="bd-field-control"
                ><span class="bd-field-label">{{ uiText('Liste anahtarı') }}</span
                ><input
                  v-model="listKey"
                  :placeholder="slug(listLabel) || uiText('Liste adından oluşturulur')"
              /></label>
              <div class="bd-schema-limits">
                <label class="bd-field-control"
                  ><span class="bd-field-label">{{ uiText('En az öğe') }}</span
                  ><input v-model.number="min" type="number" min="0"
                /></label>
                <label class="bd-field-control"
                  ><span class="bd-field-label">{{ uiText('En fazla öğe') }}</span
                  ><input v-model.number="max" type="number" min="1" max="500"
                /></label>
              </div>
            </div>
          </details>
          <p
            v-if="listPreview"
            :class="
              listPreview.error ? 'bd-field-error' : 'bd-authoring-notice'
            "
            :role="listPreview.error ? 'alert' : undefined"
          >
            {{
              listPreview.error ||
              `${listPreview.count} ${uiText('öğe')} · ${listPreview.fields} ${uiText('alan')} · ${uiText('listeye aktarılacak.')}`
            }}
          </p>
          <button
            type="submit"
            class="bd-outline-button"
            :disabled="
              !containerId ||
              !sampleId ||
              !listLabel.trim() ||
              !listPreview ||
              Boolean(listPreview.error)
            "
          >
            <Icon name="plus" />
            {{ parentId ? uiText("Alt repeater oluştur") : uiText("Repeater oluştur") }}
          </button>
        </form>
      </details>
      <p v-if="error" class="bd-field-error" role="alert">{{ error }}</p>
      <p v-if="success" class="bd-authoring-notice" role="status">
        {{ success }}
      </p>
      <details
        v-for="item in schemas"
        :key="item.schema.repeaterId"
        class="bd-schema-tool bd-mapped-group"
        :open="item.schema.repeaterId === createdListId"
      >
        <summary>
          {{ item.path.map((p) => p.label).join(" / ") }}
          <span class="bd-authoring-count"
            >{{ item.schema.itemFields.length }} {{ uiText('alan') }}</span
          >
        </summary>
        <div class="bd-schema-row-body">
          <div
            v-for="field in item.schema.itemFields"
            :key="field.fieldId"
            class="bd-mapped-field"
          >
            <button
              type="button"
              class="bd-mapped-field-select"
              @click="select(field.mappingTarget.nodeId)"
            >
              <span>{{ field.label }}</span
              ><small>{{ typeLabels[field.type] }}</small>
            </button>
          </div>
          <p v-if="!item.schema.itemFields.length" class="bd-authoring-notice"> {{ uiText('Örnek öğeyi seç; Alanlar sekmesinden alan ekle.') }} </p>
          <button
            type="button"
            class="bd-authoring-text-button bd-authoring-danger"
            :aria-label="`${item.schema.label} listesini kaldır`"
            @click="removeList(item.schema.repeaterId)"
          > {{ uiText('Liste eşlemesini kaldır') }} </button>
        </div>
      </details>
    </div>
  </section>
</template>
