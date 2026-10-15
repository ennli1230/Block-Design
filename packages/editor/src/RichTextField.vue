<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { parseRichText } from "@blockdesign/core";
import type { JsonValue } from "@blockdesign/contracts";
const props = defineProps<{
  value: string;
  label: string;
  disabled?: boolean | undefined;
}>();
const emit = defineEmits<{ update: [value: string] }>();
const root = ref<HTMLElement | null>(null),
  url = ref(""),
  error = ref("");
let range: Range | null = null;
function nodes(value: JsonValue): Node {
  const doc = root.value!.ownerDocument;
  if (!value || Array.isArray(value) || typeof value !== "object")
    return doc.createTextNode(String(value ?? ""));
  if (value.type === "textnode")
    return doc.createTextNode(String(value.content ?? ""));
  const el = doc.createElement(String(value.tagName));
  const attrs = value.attributes;
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs))
    for (const [key, val] of Object.entries(attrs))
      el.setAttribute(key, String(val));
  for (const child of Array.isArray(value.components) ? value.components : [])
    el.append(nodes(child));
  return el;
}
function refresh() {
  if (root.value && root.value.ownerDocument.activeElement !== root.value)
    root.value.replaceChildren(...parseRichText(props.value).map(nodes));
}
function remember() {
  const selection = root.value?.ownerDocument.getSelection();
  if (
    selection?.rangeCount &&
    root.value?.contains(selection.getRangeAt(0).commonAncestorContainer)
  )
    range = selection.getRangeAt(0).cloneRange();
}
function changed() {
  if (!props.disabled && root.value) emit("update", root.value.innerHTML);
  remember();
}
function format(tag: string) {
  if (
    props.disabled ||
    !root.value ||
    !range ||
    !root.value.contains(range.commonAncestorContainer)
  )
    return;
  error.value = "";
  if (tag === "a") {
    try {
      const parsed = new URL(url.value, root.value.ownerDocument.baseURI);
      if (!["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol))
        throw Error();
    } catch {
      error.value = "Geçerli bir bağlantı gir.";
      return;
    }
  }
  const doc = root.value.ownerDocument;
  const el = doc.createElement(tag);
  if (tag === "a") el.setAttribute("href", url.value);
  el.append(range.extractContents());
  range.insertNode(el);
  range.selectNodeContents(el);
  const selection = doc.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  root.value.focus();
  changed();
}
function paste(event: ClipboardEvent) {
  event.preventDefault();
  if (props.disabled) return;
  remember();
  if (range) {
    range.deleteContents();
    range.insertNode(
      root.value!.ownerDocument.createTextNode(
        event.clipboardData?.getData("text/plain") ?? "",
      ),
    );
    changed();
  }
}
onMounted(refresh);
watch(() => props.value, refresh);
</script>
<template>
  <div class="bd-rich-text">
    <div
      role="group"
      :aria-label="label + ' biçimlendirme'"
      class="bd-asset-actions"
    >
      <button
        type="button"
        :disabled="disabled"
        @mousedown.prevent
        @click="format('strong')"
      >
        Kalın</button
      ><button
        type="button"
        :disabled="disabled"
        @mousedown.prevent
        @click="format('em')"
      >
        İtalik</button
      ><input
        v-model="url"
        type="url"
        aria-label="Bağlantı adresi"
        placeholder="https://"
        :disabled="disabled"
      /><button
        type="button"
        :disabled="disabled"
        @mousedown.prevent
        @click="format('a')"
      >
        Bağlantı ekle
      </button>
    </div>
    <div
      ref="root"
      :contenteditable="!disabled"
      role="textbox"
      aria-multiline="true"
      :aria-label="label"
      class="bd-rich-text-input"
      @input="changed"
      @mouseup="remember"
      @keyup="remember"
      @paste="paste"
      @drop.prevent
    />
    <p v-if="error" class="bd-field-error" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.bd-rich-text-input {
  min-height: 110px;
  padding: 12px;
  border: 1px solid #89988d;
  border-radius: 4px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-size: 16px;
  line-height: 1.6;
}
.bd-rich-text-input:focus-visible {
  outline: 2px solid #416f5d;
  outline-offset: 3px;
}
.bd-rich-text-input :deep(p) {
  margin: 0 0 8px;
}
</style>
