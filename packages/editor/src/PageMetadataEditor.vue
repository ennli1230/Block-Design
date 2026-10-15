<script setup lang="ts">
import { ref } from "vue";
import type { JsonValue } from "@blockdesign/contracts";
import { useUiText } from "./ui-i18n";
const props = defineProps<{
  value: Record<string, JsonValue>;
  disabled?: boolean;
}>();
const emit = defineEmits<{ update: [value: Record<string, JsonValue>] }>();
const uiText = useUiText();
const error = ref("");
function put(key: string, value: JsonValue) {
  emit("update", { ...props.value, [key]: value });
}
function json(event: Event) {
  try {
    const raw = (event.target as HTMLTextAreaElement).value;
    const value = raw.trim() ? JSON.parse(raw) : null;
    if (value !== null && typeof value !== "object")
      throw new Error("JSON nesnesi veya liste gir.");
    error.value = "";
    put("structuredData", value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "JSON geçersiz.";
  }
}
</script>
<template>
  <details class="bd-schema-tool">
    <summary>{{ uiText("Sayfa ve SEO ayarları") }}</summary>
    <div class="bd-schema-row-body">
      <label
        v-for="field in [
          { key: 'title', label: 'Sayfa başlığı' },
          { key: 'description', label: 'Sayfa açıklaması' },
          { key: 'canonical', label: 'Canonical URL' },
          { key: 'robots', label: 'Robots' },
          { key: 'ogTitle', label: 'Paylaşım başlığı' },
          { key: 'ogDescription', label: 'Paylaşım açıklaması' },
          { key: 'ogImage', label: 'Paylaşım görseli' },
        ]"
        :key="field.key"
        class="bd-field-control"
        ><span class="bd-field-label">{{ uiText(field.label) }}</span
        ><input
          :value="String(value[field.key] ?? '')"
          :disabled="disabled"
          @input="
            put(field.key, ($event.target as HTMLInputElement).value)
          " /></label
      ><label class="bd-field-control"
        ><span class="bd-field-label">{{
          uiText("Yapılandırılmış veri (JSON-LD)")
        }}</span
        ><textarea
          :disabled="disabled"
          :value="
            value.structuredData
              ? JSON.stringify(value.structuredData, null, 2)
              : ''
          "
          @change="json"
        />
      </label>
      <p v-if="error" role="alert" class="bd-field-error">{{ error }}</p>
    </div>
  </details>
</template>
