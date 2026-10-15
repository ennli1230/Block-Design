<script setup lang="ts">
import { computed, ref } from "vue";
import type { JsonValue } from "@blockdesign/contracts";
import {
  DEFAULT_PREVIEW_BEHAVIORS,
  type PreviewBehaviorPlugin,
} from "@blockdesign/grapesjs-bridge";
import FieldEditor from "./FieldEditor.vue";
import { useUiText } from "./ui-i18n";
const uiText = useUiText();
const props = defineProps<{
  plugins: PreviewBehaviorPlugin[];
  nodeId: string | null;
}>();
const emit = defineEmits<{
  apply: [plugin: PreviewBehaviorPlugin, values: Record<string, JsonValue>];
  role: [attribute: string];
}>();
const selected = ref(""),
  values = ref<Record<string, JsonValue>>({}),
  role = ref("");
const plugins = computed(() => [
  ...DEFAULT_PREVIEW_BEHAVIORS,
  ...props.plugins,
]);
const plugin = computed(() =>
  plugins.value.find((p) => p.id === selected.value),
);
</script>
<template>
  <details class="bd-schema-tool">
    <summary>{{ uiText('Etkileşim') }}</summary>
    <div class="bd-schema-row-body">
      <p class="bd-draft-hint"> {{ uiText('Tuvalde bir kapsayıcı seçip davranışını bağla.') }} </p>
      <label class="bd-field-control"
        ><span class="bd-field-label">{{ uiText('Kayıtlı davranış') }}</span
        ><select v-model="selected">
          <option value="">{{ uiText('Davranış seç') }}</option>
          <option v-for="p in plugins" :key="p.id" :value="p.id">
            {{ p.id }}
          </option>
        </select></label
      >
      <template v-if="plugin"
        ><FieldEditor
          v-for="field in plugin.settings ?? []"
          :key="field.fieldId"
          :field="field"
          :value="values[field.key] ?? field.defaultValue"
          @update="values[field.key] = $event"
        /><button
          type="button"
          class="bd-outline-button"
          :disabled="!nodeId"
          @click="emit('apply', plugin, values)"
        > {{ uiText('Seçili kapsayıcıya davranışı bağla') }} </button>
        <label v-if="plugin.roles?.length" class="bd-field-control"
          ><span class="bd-field-label">{{ uiText('Seçili alt öğenin rolü') }}</span
          ><select v-model="role">
            <option value="">{{ uiText('Rol seç') }}</option>
            <option
              v-for="r in plugin.roles"
              :key="r.attribute"
              :value="r.attribute"
            >
              {{ r.label }}
            </option>
          </select></label
        ><button
          v-if="plugin.roles?.length"
          type="button"
          class="bd-outline-button"
          :disabled="!nodeId || !role"
          @click="emit('role', role)"
        > {{ uiText('Seçili öğeyi bu role bağla') }} </button>
      </template>
    </div>
  </details>
</template>
