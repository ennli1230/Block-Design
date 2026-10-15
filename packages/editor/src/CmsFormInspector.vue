<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import type {
  FormBinding,
  FormDefinition,
  FormProviderAdapter,
  FormSummary,
  RequestContext,
} from "@blockdesign/contracts";
import {
  formSchemaDiff,
  validateFormBinding,
  validateFormDefinition,
} from "@blockdesign/core";

const props = defineProps<{
  binding?: FormBinding | undefined;
  providers: FormProviderAdapter[];
  context: RequestContext;
  disabled?: boolean;
}>();
const emit = defineEmits<{ update: [binding: FormBinding] }>();
const providerId = ref(""),
  choice = ref(""),
  appearance = ref<FormBinding["appearance"]>("stacked");
const forms = shallowRef<FormSummary[]>([]),
  candidate = shallowRef<FormDefinition | null>(null),
  previous = shallowRef<FormDefinition | null>(null);
const contextEntries = ref<Array<{ key: string; value: string }>>([]);
const busy = ref(false),
  error = ref("");
let generation = 0,
  controller: AbortController | null = null;
const key = (ref: FormSummary["ref"]) => ref.id + "@" + ref.version;
const diff = computed(() =>
  previous.value &&
  candidate.value &&
  previous.value.ref.id === candidate.value.ref.id &&
  previous.value.ref.version !== candidate.value.ref.version
    ? formSchemaDiff(previous.value, candidate.value)
    : null,
);
async function loadCatalog() {
  const version = ++generation;
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  candidate.value = null;
  try {
    const provider = props.providers.find(
      (p) => p.providerId === providerId.value,
    );
    if (!provider) throw new Error("Form sağlayıcısı bağlı değil.");
    const items: FormSummary[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await provider.listForms(
        { ...props.context, signal: controller.signal },
        cursor,
      );
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
      if (cursor && seen.has(cursor))
        throw new Error("Form kataloğunda sayfalama döngüsü var.");
      if (cursor) seen.add(cursor);
    } while (cursor);
    if (version !== generation) return;
    forms.value = [
      ...new Map(items.map((item) => [key(item.ref), item])).values(),
    ];
    if (
      props.binding?.providerId === providerId.value &&
      !forms.value.some((item) => key(item.ref) === key(props.binding!.formRef))
    )
      forms.value.unshift({
        ref: props.binding.formRef,
        label: "Bağlı form sürümü",
      });
    if (!forms.value.some((item) => key(item.ref) === choice.value))
      choice.value = "";
  } catch (cause) {
    if (version === generation)
      error.value =
        cause instanceof Error ? cause.message : "Katalog yüklenemedi.";
  } finally {
    if (version === generation) busy.value = false;
  }
  if (version === generation && choice.value) await loadDefinition();
}
async function loadDefinition() {
  const version = ++generation;
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  candidate.value = null;
  previous.value = null;
  try {
    const provider = props.providers.find(
        (p) => p.providerId === providerId.value,
      ),
      summary = forms.value.find((item) => key(item.ref) === choice.value);
    if (!provider || !summary) return;
    const definition = await provider.getDefinition(summary.ref, {
      ...props.context,
      signal: controller.signal,
    });
    validateFormDefinition(definition);
    if (key(definition.ref) !== key(summary.ref))
      throw new Error("CMS istenen form sürümünü döndürmedi.");
    let old: FormDefinition | null = null;
    if (
      props.binding?.providerId === providerId.value &&
      props.binding.formRef.id === definition.ref.id &&
      props.binding.formRef.version !== definition.ref.version
    ) {
      old = await provider.getDefinition(props.binding.formRef, {
        ...props.context,
        signal: controller.signal,
      });
      validateFormDefinition(old);
    }
    if (version === generation) {
      candidate.value = definition;
      previous.value = old;
    }
  } catch (cause) {
    if (version === generation)
      error.value =
        cause instanceof Error ? cause.message : "Form tanımı yüklenemedi.";
  } finally {
    if (version === generation) busy.value = false;
  }
}
function apply() {
  if (!candidate.value || props.disabled) return;
  try {
    const binding: FormBinding = {
      providerId: providerId.value,
      formRef: candidate.value.ref,
      appearance: appearance.value,
      contextBindings: contextEntries.value.map((item) => ({ ...item })),
    };
    validateFormBinding(binding);
    emit("update", binding);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Bağlantı geçersiz.";
  }
}
watch(
  () => [props.binding, props.context.contentLocale?.locale] as const,
  () => {
    providerId.value =
      props.binding?.providerId ?? props.providers[0]?.providerId ?? "";
    choice.value = props.binding ? key(props.binding.formRef) : "";
    appearance.value = props.binding?.appearance ?? "stacked";
    contextEntries.value = (props.binding?.contextBindings ?? []).map(
      (item) => ({ key: item.key, value: String(item.value) }),
    );
    void loadCatalog();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
  controller?.abort();
});
</script>

<template>
  <section class="bd-cms-inspector" aria-label="CMS form bağlantısı">
    <h3>CMS form bağlantısı</h3>
    <p class="bd-draft-hint">
      Alanları ve kuralları CMS yönetir. Buradan formu ve görünümünü seçin.
    </p>
    <p v-if="!providers.length" class="bd-field-error" role="alert">
      Host uygulama bir form sağlayıcısı bağlamalı.
    </p>
    <label class="bd-field-control"
      ><span class="bd-field-label">Form kaynağı</span
      ><select
        v-model="providerId"
        :disabled="disabled"
        @change="
          choice = '';
          loadCatalog();
        "
      >
        <option value="">Kaynak seçin</option>
        <option
          v-for="provider in providers"
          :key="provider.providerId"
          :value="provider.providerId"
        >
          {{ provider.providerId }}
        </option>
      </select></label
    >
    <label class="bd-field-control"
      ><span class="bd-field-label">CMS formu ve sürümü</span
      ><select
        v-model="choice"
        :disabled="disabled || busy"
        @change="loadDefinition"
      >
        <option value="">Form seçin</option>
        <option
          v-for="form in forms"
          :key="key(form.ref)"
          :value="key(form.ref)"
        >
          {{ form.label }} · {{ form.ref.version }}
        </option>
      </select></label
    >
    <label class="bd-field-control"
      ><span class="bd-field-label">Form görünümü</span
      ><select v-model="appearance" :disabled="disabled">
        <option value="stacked">Standart form</option>
        <option value="inline-search">Yan yana arama</option>
      </select></label
    >
    <p v-if="busy" role="status">CMS form tanımı yükleniyor…</p>
    <p v-if="error" class="bd-field-error" role="alert">
      {{ error }}
      <button type="button" :disabled="disabled" @click="loadCatalog">
        Yeniden dene
      </button>
    </p>
    <template v-if="candidate">
      <p class="bd-draft-hint">
        {{ candidate.fields.length }} alan · {{ candidate.locale }} ·
        {{
          candidate.action.kind === "search"
            ? "Arama işlemi"
            : "Başvuru gönderimi"
        }}
      </p>
      <ul class="bd-cms-schema-list">
        <li v-for="field in candidate.fields" :key="field.fieldId">
          <b>{{ field.label }}</b
          ><span
            >{{ field.type
            }}{{ field.validation?.required ? " · Zorunlu" : "" }}</span
          >
        </li>
      </ul>
      <p v-if="diff" class="bd-version-diff">
        Şema değişikliği: {{ diff.added.length }} yeni,
        {{ diff.removed.length }} kaldırılan, {{ diff.changed.length }} değişen
        alan. Uyguladığınızda bağlı sürüm değişir.
      </p>
    </template>
    <details>
      <summary>Sayfa bağlamı</summary>
      <p class="bd-draft-hint">
        Tur kimliği gibi sabit bağlam değerleri. CMS bu değerleri sunucuda
        doğrular.
      </p>
      <div
        v-for="(entry, index) in contextEntries"
        :key="index"
        class="bd-cms-context"
      >
        <input
          v-model="entry.key"
          :disabled="disabled"
          aria-label="Bağlam anahtarı"
          placeholder="tour-id"
        /><input
          v-model="entry.value"
          :disabled="disabled"
          aria-label="Bağlam değeri"
          placeholder="efes"
        /><button
          type="button"
          :disabled="disabled"
          @click="contextEntries.splice(index, 1)"
        >
          Kaldır
        </button>
      </div>
      <button
        type="button"
        :disabled="disabled"
        @click="contextEntries.push({ key: '', value: '' })"
      >
        Bağlam ekle
      </button>
    </details>
    <button
      type="button"
      class="bd-outline-button"
      :disabled="disabled || busy || !candidate"
      @click="apply"
    >
      Form bağlantısını uygula
    </button>
  </section>
</template>
