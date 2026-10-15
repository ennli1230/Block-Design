<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import type {
  FormBinding,
  FormDefinition,
  FormSummary,
} from "@blockdesign/contracts";
import {
  loadFormOptions,
  mountCmsForm,
  validateFormDefinition,
  validateFormValues,
} from "@blockdesign/core";
import { CMS_FORM_CSS } from "@blockdesign/editor/forms";
import {
  CMS_FORMS_BASE,
  DemoCmsFormProvider,
  DemoFormOptionsProvider,
} from "./cms-forms";

const emit = defineEmits<{ openPage: [formId: string] }>();
const provider = new DemoCmsFormProvider();
const optionsProvider = new DemoFormOptionsProvider();
const catalog = shallowRef<FormSummary[]>([]);
const selected = ref("transfer");
const definition = shallowRef<FormDefinition | null>(null);
const root = ref<HTMLElement | null>(null);
const loading = ref(true),
  error = ref("");
const jsonUrl = computed(() =>
  definition.value
    ? `${CMS_FORMS_BASE}/${definition.value.ref.id}/${definition.value.ref.version}.json`
    : "",
);
let stop: (() => void) | undefined;
let request: AbortController | undefined;
const style = document.createElement("style");
style.textContent = CMS_FORM_CSS;

async function loadCatalog() {
  request?.abort();
  request = new AbortController();
  loading.value = true;
  error.value = "";
  try {
    catalog.value = (
      await provider.listForms({ signal: request.signal })
    ).items;
    if (!catalog.value.some((item) => item.ref.id === selected.value))
      selected.value = catalog.value[0]?.ref.id ?? "";
  } catch (cause) {
    if (!request.signal.aborted)
      error.value =
        cause instanceof Error ? cause.message : "Formlar yüklenemedi.";
  } finally {
    loading.value = false;
    await nextTick();
    showForm();
  }
}

function showForm() {
  stop?.();
  definition.value = null;
  const item = catalog.value.find((form) => form.ref.id === selected.value);
  if (!root.value || !item) return;
  const binding: FormBinding = {
    providerId: provider.providerId,
    formRef: item.ref,
    appearance: item.ref.id === "search" ? "inline-search" : "stacked",
    contextBindings: [],
  };
  root.value.setAttribute("data-bd-form-binding", JSON.stringify(binding));
  stop = mountCmsForm(root.value, {
    mode: "preview",
    async definition(binding, signal) {
      const value = await provider.getDefinition(binding.formRef, { signal });
      if (!signal.aborted) definition.value = value;
      return value;
    },
    options: (field, values, query, cursor, signal) =>
      loadFormOptions(
        field,
        values,
        [optionsProvider],
        { signal },
        query,
        cursor,
      ),
    validateDefinition: validateFormDefinition,
    validateValues: validateFormValues,
    execute: async () => {
      throw new Error("Bu ekran yalnızca önizleme içindir.");
    },
  });
}

watch(selected, () => {
  void nextTick(showForm);
});
onMounted(() => {
  document.head.append(style);
  void loadCatalog();
});
onBeforeUnmount(() => {
  request?.abort();
  stop?.();
  style.remove();
});
</script>

<template>
  <section class="form-examples">
    <div class="screen-heading">
      <div>
        <h1>Form örnekleri</h1>
        <p>
          CMS’den gelen tanımı seç, oluşan formu dene. Alanlar, zorunluluklar ve
          seçenekler JSON kaynağından yüklenir.
        </p>
      </div>
    </div>
    <p v-if="loading" role="status">Form kataloğu yükleniyor…</p>
    <div v-else-if="error" class="workspace-alert" role="alert">
      {{ error }}
      <button type="button" class="text-action" @click="loadCatalog">
        Yeniden dene
      </button>
    </div>
    <template v-else-if="catalog.length">
      <div class="form-example-selector">
        <label for="example-form"
          >Form seçin<select id="example-form" v-model="selected">
            <option
              v-for="item in catalog"
              :key="item.ref.id + item.ref.version"
              :value="item.ref.id"
            >
              {{ item.label }}
            </option>
          </select></label
        >
        <button
          type="button"
          class="solid-button"
          @click="emit('openPage', selected)"
        >
          Sayfada düzenle
        </button>
      </div>
      <div class="form-example-meta">
        <span
          >Örnek CMS · JSON<span v-if="definition">
            · v{{ definition.ref.version }} ·
            {{ definition.fields.length }} alan</span
          ></span
        ><a v-if="jsonUrl" :href="jsonUrl" target="_blank" rel="noopener"
          >JSON kaynağını aç</a
        >
      </div>
      <p class="form-example-notice">
        Deneme alanı. Bilgiler gönderilmez veya kaydedilmez. * işaretli alanlar
        zorunludur.
      </p>
      <div
        ref="root"
        class="form-example-preview"
        data-bd-cms-form="true"
      ></div>
      <details v-if="definition" class="form-example-json">
        <summary>Formun JSON tanımını göster</summary>
        <pre><code>{{ JSON.stringify(definition, null, 2) }}</code></pre>
      </details>
    </template>
    <p v-else role="status">Kaynakta kullanılabilir form bulunamadı.</p>
  </section>
</template>

<style scoped>
.form-example-selector {
  display: flex;
  align-items: end;
  gap: 16px;
  padding: 20px 0 24px;
  border-top: 1px solid var(--workspace-border);
}
.form-example-selector label {
  display: grid;
  gap: 8px;
  flex: 1;
  max-width: 430px;
  font-size: 13px;
  font-weight: 600;
}
.form-example-selector select {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  background: #fff;
  color: #27362e;
  border: 1px solid #89988d;
  border-radius: 4px;
  font-size: 15px;
}
.form-example-selector button {
  min-height: 44px;
  font-size: 12px;
}
.form-example-meta {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #4e5e54;
}
.form-example-meta a {
  color: #315d4a;
  text-underline-offset: 3px;
}
.form-example-notice {
  margin: 14px 0 24px;
  color: #4e5e54;
  font-size: 13px;
  line-height: 1.6;
}
.form-example-preview {
  max-width: 800px;
  padding: 28px;
  background: #fff;
  border: 1px solid var(--workspace-border);
  border-radius: 6px;
}
.form-example-json {
  margin-top: 26px;
  font-size: 13px;
}
.form-example-json summary {
  width: fit-content;
  min-height: 32px;
  cursor: pointer;
  color: #315d4a;
}
.form-example-json pre {
  max-height: 460px;
  overflow: auto;
  padding: 18px;
  background: #edf1ec;
  font-size: 12px;
  line-height: 1.6;
  tab-size: 2;
}
@media (max-width: 640px) {
  .form-example-selector {
    flex-direction: column;
    align-items: stretch;
  }
  .form-example-selector label {
    max-width: none;
  }
  .form-example-preview {
    padding: 20px 16px;
  }
}
</style>
