<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import type { FieldDefinition, JsonValue } from "@blockdesign/contracts";
import type { FieldEditorPlugin } from "./extensions";
const props = defineProps<{
  renderer: FieldEditorPlugin;
  field: FieldDefinition;
  value: JsonValue;
  disabled?: boolean | undefined;
}>();
const emit = defineEmits<{ update: [value: JsonValue] }>();
const host = ref<HTMLElement | null>(null);
let stop: (() => void) | undefined;
function mount() {
  stop?.();
  if (host.value)
    stop = props.renderer.mount(
      host.value,
      props.field,
      props.value,
      (value) => {
        if (!props.disabled) emit("update", value);
      },
    );
}
onMounted(mount);
watch(
  () => props.value,
  () => {
    if (!host.value) return;
    if (props.renderer.update) props.renderer.update(host.value, props.value);
    else mount();
  },
);
watch(() => props.renderer, mount);
onBeforeUnmount(() => stop?.());
</script>
<template>
  <fieldset
    :disabled="disabled"
    style="border: 0; padding: 0; margin: 0; min-width: 0"
  >
    <div ref="host" />
  </fieldset>
</template>
