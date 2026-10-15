<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  AssetAdapter,
  JsonValue,
  RepeaterDefinition,
} from "@blockdesign/contracts";
import { normalizeRepeaterRows, validateFieldValue } from "@blockdesign/core";
import FieldEditor from "./FieldEditor.vue";
import Icon from "./Icon.vue";
import { useUiText } from "./ui-i18n";
const uiText = useUiText();
const props = defineProps<{
  definition: RepeaterDefinition;
  value: JsonValue;
  assetAdapter?: AssetAdapter | undefined;
  disabled?: boolean;
  selectedId?: string | null;
  depth?: number;
}>();
const emit = defineEmits<{
  update: [value: JsonValue];
  select: [itemId: string, repeaterId: string];
}>();
const error = ref("");
const rows = computed(() =>
  normalizeRepeaterRows(props.value, props.definition),
);
function title(row: Record<string, JsonValue>) {
  const fields = props.definition.itemFields;
  const primary =
    fields.find(
      (field) =>
        ["title", "label", "name", "baslik"].includes(field.key) ||
        /^(başlık|ad|isim)$/i.test(field.label),
    ) ??
    fields.find(
      (field) =>
        field.type === "text" && field.mappingTarget.operation === "text",
    ) ??
    fields.find((field) => field.type === "textarea");
  return String(row[primary?.key ?? "label"] ?? uiText("Yeni öğe"));
}
function containsSelection(value: JsonValue): boolean {
  if (!props.selectedId) return false;
  if (Array.isArray(value)) return value.some(containsSelection);
  return Boolean(
    value &&
      typeof value === "object" &&
      (value.__id === props.selectedId ||
        Object.values(value).some(containsSelection)),
  );
}
function publish(next: Record<string, JsonValue>[]) {
  error.value = "";
  emit("update", next);
}
function field(index: number, key: string, value: JsonValue) {
  const next = structuredClone(rows.value);
  next[index]![key] = value;
  publish(next);
}
function add() {
  if (rows.value.length >= props.definition.maxItems) return;
  const row: Record<string, JsonValue> = {
    __id: `item_${crypto.randomUUID()}`,
  };
  for (const item of props.definition.itemFields)
    row[item.key] = structuredClone(item.defaultValue);
  for (const child of props.definition.childRepeaters ?? [])
    row[child.key] = [];
  publish([...rows.value, row]);
  emit("select", String(row.__id), props.definition.repeaterId);
}
function act(index: number, action: "up" | "down" | "copy" | "remove") {
  const next = structuredClone(rows.value);
  if (action === "remove") {
    if (next.length <= props.definition.minItems) return;
    next.splice(index, 1);
  }
  if (action === "copy") {
    if (next.length >= props.definition.maxItems) return;
    next.splice(
      index + 1,
      0,
      normalizeRepeaterRows([next[index]!], props.definition, true)[0]!,
    );
  }
  const target = action === "up" ? index - 1 : index + 1;
  if (action === "up" || action === "down") {
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
  }
  publish(next);
}
</script>
<template>
  <section
    class="bd-schema-list"
    :data-depth="depth ?? 0"
    :aria-label="definition.label"
  >
    <div class="bd-schema-list-heading">
      <strong>{{ definition.label }}</strong
      ><span>{{ rows.length }} / {{ definition.maxItems }}</span
      ><button
        type="button"
        class="bd-square-small"
        :disabled="disabled || rows.length >= definition.maxItems"
        :aria-label="uiText('Öğe ekle')"
        @click="add"
      >
        <Icon name="plus" />
      </button>
    </div>
    <p v-if="!rows.length" class="bd-draft-hint"> {{ uiText('Henüz öğe yok. + ile ilk öğeyi ekle.') }} </p>
    <details
      v-for="(row, index) in rows"
      :key="String(row.__id)"
      class="bd-schema-row"
      :open="containsSelection(row) || (!selectedId && index === 0)"
      @toggle="
        ($event.target as HTMLDetailsElement).open &&
        !containsSelection(row) &&
        emit('select', String(row.__id), definition.repeaterId)
      "
    >
      <summary>
        {{ title(row) }}<small>{{ index + 1 }}</small>
      </summary>
      <div class="bd-schema-row-body">
        <div class="bd-row-actions">
          <button
            type="button"
            :disabled="disabled || index === 0"
            :aria-label="uiText('Yukarı taşı')"
            @click="act(index, 'up')"
          >
            <Icon name="up" /></button
          ><button
            type="button"
            :disabled="disabled || index === rows.length - 1"
            :aria-label="uiText('Aşağı taşı')"
            @click="act(index, 'down')"
          >
            <Icon name="down" /></button
          ><button
            type="button"
            :disabled="disabled || rows.length >= definition.maxItems"
            :aria-label="uiText('Öğeyi çoğalt')"
            @click="act(index, 'copy')"
          >
            <Icon name="duplicate" /></button
          ><button
            type="button"
            :disabled="disabled || rows.length <= definition.minItems"
            :aria-label="uiText('Öğeyi sil')"
            @click="act(index, 'remove')"
          >
            <Icon name="trash" />
          </button>
        </div>
        <FieldEditor
          v-for="item in definition.itemFields"
          :key="item.fieldId"
          :field="item"
          :value="row[item.key] ?? item.defaultValue"
          :asset-adapter="assetAdapter"
          :disabled="Boolean(disabled)"
          :error="
            validateFieldValue(item, row[item.key], item.key)[0]?.message ?? ''
          "
          @update="field(index, item.key, $event)"
        />
        <RepeaterEditor
          v-for="child in definition.childRepeaters ?? []"
          :key="child.repeaterId"
          :definition="child"
          :value="row[child.key] ?? []"
          :asset-adapter="assetAdapter"
          :disabled="Boolean(disabled)"
          :selected-id="selectedId ?? null"
          :depth="(depth ?? 0) + 1"
          @update="field(index, child.key, $event)"
          @select="(id, repeater) => emit('select', id, repeater)"
        />
      </div>
    </details>
    <p v-if="error" class="bd-field-error">{{ error }}</p>
  </section>
</template>
