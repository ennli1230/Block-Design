<script setup lang="ts">
import { computed } from "vue";
import type { JsonValue } from "@blockdesign/contracts";
import { useUiText } from "./ui-i18n";
const uiText = useUiText();
const props = defineProps<{
  values: Record<string, JsonValue>;
  allowed: string[];
  disabled?: boolean;
  className?: string;
  allowClasses?: boolean;
}>();
const emit = defineEmits<{
  update: [property: string, value: string];
  classes: [value: string];
}>();
const groups = computed(() => [
  {
    label: uiText("Yüzey"),
    items: [
      ["background-color", uiText("Arka plan"), "color"],
      ["background-image", uiText("Arka plan görseli"), "text"],
      ["border", uiText("Kenarlık"), "text"],
      ["border-radius", uiText("Köşe yuvarlaklığı"), "text"],
    ],
  },
  {
    label: uiText("Yerleşim"),
    items: [
      ["padding", uiText("İç boşluk"), "text"],
      ["margin", uiText("Dış boşluk"), "text"],
      ["gap", uiText("Öğeler arası boşluk"), "text"],
      ["width", uiText("Genişlik"), "text"],
      ["max-width", uiText("En fazla genişlik"), "text"],
      ["min-height", uiText("En az yükseklik"), "text"],
    ],
  },
  {
    label: uiText("Yazı"),
    items: [
      ["color", uiText("Metin rengi"), "color"],
      ["font-size", uiText("Yazı boyutu"), "text"],
      ["font-weight", uiText("Yazı kalınlığı"), "text"],
      ["text-align", uiText("Hizalama"), "text"],
    ],
  },
]);
function value(key: string) {
  return String(props.values[key] ?? "");
}
</script>
<template>
  <section class="bd-node-style-editor" :aria-label="uiText('Seçili öğenin stilleri')">
    <p v-if="!allowed.length" class="bd-authoring-notice"> {{ uiText('Bu öğe için düzenlenebilir stil tanımlı değil.') }} </p>
    <details
      v-for="(group, index) in groups.filter((group) =>
        group.items.some((item) => allowed.includes(item[0]!)),
      )"
      :key="group.label"
      class="bd-style-control-group"
      :open="index === 0"
    >
      <summary>{{ group.label }}</summary>
      <div class="bd-style-control-fields">
        <label
          v-for="item in group.items.filter((item) =>
            allowed.includes(item[0]!),
          )"
          :key="item[0]"
          class="bd-field-control"
          ><span class="bd-field-label">{{ item[1] }}</span
          ><span v-if="item[2] === 'color'" class="bd-color-control"
            ><input
              type="color"
              :disabled="disabled"
              :value="
                /^#[\da-f]{6}$/i.test(value(item[0]!))
                  ? value(item[0]!)
                  : '#ffffff'
              "
              @input="
                emit(
                  'update',
                  item[0]!,
                  ($event.target as HTMLInputElement).value,
                )
              " /><input
              :aria-label="item[1] + ' kodu'"
              :value="value(item[0]!)"
              :disabled="disabled"
              :placeholder="uiText('Varsayılan')"
              @input="
                emit(
                  'update',
                  item[0]!,
                  ($event.target as HTMLInputElement).value,
                )
              " /></span
          ><input
            v-else
            :value="value(item[0]!)"
            :disabled="disabled"
            :placeholder="
              item[0] === 'background-image' ? 'url(https://...)' : 'Varsayılan'
            "
            @input="
              emit(
                'update',
                item[0]!,
                ($event.target as HTMLInputElement).value,
              )
            "
        /></label>
      </div>
    </details>
    <details v-if="allowClasses" class="bd-authoring-advanced">
      <summary>{{ uiText('Gelişmiş ayarlar') }}</summary>
      <div class="bd-schema-row-body">
        <label class="bd-field-control"
          ><span class="bd-field-label">{{ uiText('CSS sınıfları') }}</span
          ><input
            :value="className"
            :disabled="disabled"
            :placeholder="uiText('Örn. section section-light')"
            @change="
              emit('classes', ($event.target as HTMLInputElement).value)
            "
        /></label>
        <p class="bd-authoring-notice"> {{ uiText('Ölçülerde px, rem veya % kullanabilirsin.') }} </p>
      </div>
    </details>
  </section>
</template>
