<script setup lang="ts">
import { computed, nextTick, ref, useId } from "vue";
import type {
  FieldDefinition,
  JsonValue,
  RepeaterDefinition,
} from "@blockdesign/contracts";
import SchemaDesigner from "./SchemaDesigner.vue";
import { useUiText } from "./ui-i18n";

defineProps<{
  template: JsonValue;
  fields: FieldDefinition[];
  repeaters: RepeaterDefinition[];
  values: Record<string, JsonValue>;
  selectedNodeId: string | null;
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
}>();
const uiText = useUiText();
type TabKey = "fields" | "lists" | "styles" | "settings";
const tabs = computed(() => [
  { key: "fields" as const, label: uiText("Alanlar") },
  { key: "lists" as const, label: uiText("Listeler") },
  { key: "styles" as const, label: uiText("Tasarım") },
  { key: "settings" as const, label: uiText("Ayarlar") },
]);
const activeTab = ref<TabKey>("fields");
const id = useId();
const panel = ref<HTMLDivElement | null>(null);
async function activate(key: TabKey) {
  activeTab.value = key;
  await nextTick();
  if (panel.value) panel.value.scrollTop = 0;
}
function navigate(event: KeyboardEvent, index: number) {
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.value.length;
  else if (event.key === "ArrowLeft")
    next = (index + tabs.value.length - 1) % tabs.value.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.value.length - 1;
  else return;
  event.preventDefault();
  const button = event.currentTarget as HTMLButtonElement;
  void activate(tabs.value[next]!.key);
  button.parentElement
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [next]?.focus();
}
</script>

<template>
  <div class="bd-authoring-inspector">
    <div class="bd-authoring-tabs" role="tablist" :aria-label="uiText('Blok düzenleme')">
      <button
        v-for="(tab, index) in tabs"
        :id="`${id}-${tab.key}`"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        :aria-controls="`${id}-panel`"
        :tabindex="activeTab === tab.key ? 0 : -1"
        @click="activate(tab.key)"
        @keydown="navigate($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div
      :id="`${id}-panel`"
      ref="panel"
      class="bd-inspector-scroll bd-region-authoring bd-authoring-body"
      role="tabpanel"
      :aria-labelledby="`${id}-${activeTab}`"
      tabindex="0"
    >
      <SchemaDesigner
        v-show="activeTab === 'fields' || activeTab === 'lists'"
        :view="activeTab === 'lists' ? 'lists' : 'fields'"
        :template="template"
        :fields="fields"
        :repeaters="repeaters"
        :values="values"
        :selected-node-id="selectedNodeId"
        @update="emit('update', $event)"
        @select="emit('select', $event)"
        @lists="activate('lists')"
      />
      <div v-show="activeTab === 'styles'" class="bd-authoring-section">
        <slot name="styles" />
      </div>
      <div v-show="activeTab === 'settings'" class="bd-authoring-section">
        <slot name="settings" />
      </div>
    </div>
    <div class="bd-authoring-footer"><slot name="actions" /></div>
  </div>
</template>
