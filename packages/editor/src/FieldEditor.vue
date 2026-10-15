<script setup lang="ts">
import { ref, useId, watch, onBeforeUnmount, inject } from 'vue';
import type { AssetAdapter, AssetRecord, FieldDefinition, JsonValue } from '@blockdesign/contracts';
import Icon from './Icon.vue';
import CustomFieldEditor from './CustomFieldEditor.vue';
import RichTextField from './RichTextField.vue';
import type {FieldEditorPlugin} from './extensions';
import { useUiText } from './ui-i18n';

const props = defineProps<{ field: FieldDefinition; value: JsonValue; disabled?: boolean; error?: string; assetAdapter?: AssetAdapter | undefined }>();
const uiText = useUiText();
const customEditors=inject<Partial<Record<import('@blockdesign/contracts').FieldType,FieldEditorPlugin>>>('blockdesign:field-editors',{});
const emit = defineEmits<{ update: [value: JsonValue] }>();
const draft = ref(typeof props.value === 'string' ? props.value : String(props.value ?? ''));
const issueId = `bd-issue-${useId().replace(/:/g, '')}`;
const assets = ref<AssetRecord[]>([]);
const assetQuery = ref('');
const assetError = ref('');
const assetBusy = ref(false);
let assetRequest=0;let assetAbort:AbortController|undefined;
const assetCursor=ref<string|null>(null);
const acceptedTypes=Array.isArray(props.assetAdapter?.capabilities.constraints?.mimeTypes)?(props.assetAdapter!.capabilities.constraints!.mimeTypes as string[]).join(','):'image/*';
onBeforeUnmount(()=>{++assetRequest;assetAbort?.abort();});
watch(() => props.value, (value) => { draft.value = typeof value === 'string' ? value : String(value ?? ''); });

function update(value: string | number | boolean): void { emit('update', value); }

async function searchAssets(more=false): Promise<void> {
  if (!props.assetAdapter?.capabilities.supported.includes('search')) return;
  const request=++assetRequest;assetAbort?.abort();assetAbort=new AbortController();
  assetBusy.value = true; assetError.value = '';
  try { const page=await props.assetAdapter.search(assetQuery.value,{signal:assetAbort.signal,...(more&&assetCursor.value?{cursor:assetCursor.value}:{})});if(request!==assetRequest)return;assets.value=more?[...assets.value,...page.items.filter(item=>!assets.value.some(existing=>existing.assetId===item.assetId))]:page.items;assetCursor.value=page.nextCursor; }
  catch (error) { if(request===assetRequest)assetError.value = error instanceof Error ? error.message : uiText('Medya aranamadı.'); }
  finally { if(request===assetRequest)assetBusy.value = false; }
}

async function uploadAsset(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !props.assetAdapter?.upload || !props.assetAdapter.capabilities.supported.includes('upload')) return;
  const request=++assetRequest;assetAbort?.abort();assetAbort=new AbortController();
  assetBusy.value = true; assetError.value = '';
  try { const asset = await props.assetAdapter.upload(file,{signal:assetAbort.signal});if(request!==assetRequest)return; update(asset.url); assets.value = [asset, ...assets.value]; }
  catch (error) { if(request===assetRequest)assetError.value = error instanceof Error ? error.message : uiText('Medya yüklenemedi.'); }
  finally { if(request===assetRequest)assetBusy.value = false; (event.target as HTMLInputElement).value = ''; }
}
</script>

<template>
  <label class="bd-field-control">
    <span class="bd-field-label"><span>{{ field.label }}</span><span v-if="field.required" class="bd-required" :aria-label="uiText('Gerekli')">*</span></span>
    <CustomFieldEditor v-if="customEditors[field.type]" :renderer="customEditors[field.type]!" :field="field" :value="value" :disabled="disabled" @update="emit('update',$event)" />
    <RichTextField v-else-if="field.type==='richText'" :value="String(value??'')" :label="field.label" :disabled="disabled" @update="update" />
    <template v-else-if="field.type === 'textarea'">
      <textarea v-model="draft" :disabled="disabled" :maxlength="field.max" :aria-invalid="Boolean(error)" :aria-describedby="error ? issueId : undefined" :placeholder="field.label" @input="update(draft)" />
    </template>
    <template v-else-if="field.type === 'boolean'">
      <span class="bd-toggle-row"><input type="checkbox" :checked="Boolean(value)" :disabled="disabled" @change="update(($event.target as HTMLInputElement).checked)" /><span>{{ value ? uiText('Açık') : uiText('Kapalı') }}</span></span>
    </template>
    <template v-else-if="field.type === 'color'">
      <span class="bd-color-control"><input type="color" :value="typeof value === 'string' && value ? value : '#345b4c'" :disabled="disabled" @input="update(($event.target as HTMLInputElement).value)" /><input v-model="draft" :disabled="disabled" :aria-label="uiText('Renk kodu')" @input="update(draft)" /></span>
    </template>
    <template v-else-if="field.type === 'select'">
      <select :value="String(value ?? '')" :disabled="disabled" @change="update(($event.target as HTMLSelectElement).value)"><option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ option.label }}</option></select>
    </template>
    <template v-else>
      <template v-if="field.type === 'image' && assetAdapter">
        <span class="bd-input-wrap"><Icon name="image" /><input v-model="draft" type="url" :disabled="disabled" :aria-invalid="Boolean(error)" :aria-describedby="error ? issueId : undefined" :placeholder="field.label" @input="update(draft)" /></span>
        <div class="bd-asset-actions"><input v-model="assetQuery" :aria-label="uiText('Medyada ara')" :placeholder="uiText('Medya ara')" @keydown.enter.prevent="searchAssets()" /><button v-if="assetAdapter.capabilities.supported.includes('search')" :disabled="assetBusy || disabled" @click="searchAssets()">{{ assetBusy ? '…' : uiText('Ara') }}</button><label v-if="assetAdapter.upload && assetAdapter.capabilities.supported.includes('upload')" class="bd-asset-upload">{{ uiText('Yükle') }}<input type="file" :accept="acceptedTypes" :disabled="assetBusy || disabled" @change="uploadAsset" /></label></div>
        <div v-if="assets.length" class="bd-asset-results"><button v-for="asset in assets" :key="asset.assetId" :disabled="disabled" @click="update(asset.url)"><img :src="asset.url" :alt="asset.alt" /><span>{{ asset.alt || asset.assetId }}</span></button></div>
        <button v-if="assetCursor" type="button" :disabled="disabled || assetBusy" @click="searchAssets(true)">Daha fazla görsel</button>
        <span v-if="assetError" class="bd-field-error">{{ assetError }}</span>
      </template>
      <span v-else class="bd-input-wrap">
        <Icon v-if="field.type === 'image' || field.type === 'video'" :name="field.type === 'image' ? 'image' : 'external'" />
        <input v-model="draft" :type="field.type === 'number' ? 'number' : field.type === 'url' || field.type === 'image' || field.type === 'video' ? 'url' : 'text'" :min="field.min" :max="field.max" :maxlength="field.max" :disabled="disabled" :aria-invalid="Boolean(error)" :aria-describedby="error ? issueId : undefined" :placeholder="field.type === 'url' ? 'https://ornek.com' : field.label" @input="update(field.type === 'number' ? Number(draft) : draft)" />
      </span>
    </template>
    <span v-if="error" :id="issueId" class="bd-field-error">{{ error }}</span>
  </label>
</template>
