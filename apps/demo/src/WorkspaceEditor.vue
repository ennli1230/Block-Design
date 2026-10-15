<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { BlockDefinitionVersion, EditorDocument, LocalizationAdapter, LocalizationOptions, PageLocaleVariant, VersionRef } from '@blockdesign/contracts';
import { mountEditor, type EditorHandle, type MountEditorOptions, type EditorWorkspaceStage } from '@blockdesign/editor';

const props = defineProps<{
  stage: EditorWorkspaceStage;
  label: string;
  initialDocument: EditorDocument;
  adapters: Pick<MountEditorOptions, 'storageAdapter' | 'blockLibraryAdapter' | 'blockLibraryDesignSystemRefs' | 'contentProviders' | 'forms' | 'assetAdapter' | 'templateAdapter' | 'sharedRegionAdapter' | 'designSystemAdapter' | 'http' | 'canvas'>;
  localization?: LocalizationOptions | undefined;
  localizationAdapter?: LocalizationAdapter | undefined;
  onLocaleChangeRequested?: ((locale: string, variant: PageLocaleVariant | null) => Promise<EditorDocument | null>) | undefined;
  onCreateLocaleVariant?: ((locale: string, source: EditorDocument) => Promise<EditorDocument | null>) | undefined;
  baseViewId?: string | undefined;
  baseViewName?: string | undefined;
  templateName?: string | undefined;
  existingTemplateRef?: VersionRef | undefined;
  existingBlockDefinition?: BlockDefinitionVersion | undefined;
  regionKind?: 'header' | 'footer' | undefined;
  regionRef?: VersionRef | undefined;
}>();

const emit = defineEmits<{
  back: [];
  saved: [];
  'catalog-saved': [event: { kind: 'block' | 'template' | 'shared-region'; ref: VersionRef }];
}>();

const root = ref<HTMLElement | null>(null);
const backError = ref('');
let handle: EditorHandle | null = null;

onMounted(async () => {
  if (!root.value) return;
  const options: MountEditorOptions = {
    ...props.adapters,
    includeDemoBlocks: false,
    ...(props.localization ? { localization: props.localization } : {}),
    ...(props.localizationAdapter ? { localizationAdapter: props.localizationAdapter } : {}),
    ...(props.onLocaleChangeRequested ? { onLocaleChangeRequested: props.onLocaleChangeRequested } : {}),
    ...(props.onCreateLocaleVariant ? { onCreateLocaleVariant: props.onCreateLocaleVariant } : {}),
    initialDocument: structuredClone(props.initialDocument),
    workspaceStage: props.stage,
    workspaceLabel: props.label,
    ...(props.baseViewId ? { workspaceBaseViewId: props.baseViewId } : {}),
    ...(props.baseViewName ? { workspaceBaseViewName: props.baseViewName } : {}),
    ...(props.templateName !== undefined ? { workspaceTemplateName: props.templateName } : {}),
    ...(props.existingTemplateRef ? { workspaceExistingTemplateRef: structuredClone(props.existingTemplateRef) } : {}),
    ...(props.existingBlockDefinition ? { workspaceExistingBlockDefinition: structuredClone(props.existingBlockDefinition) } : {}),
    ...(props.regionKind ? { workspaceSharedRegionKind: props.regionKind } : {}),
    ...(props.regionRef ? { initialSharedRegionRef: structuredClone(props.regionRef) } : {}),
    mode: props.stage === 'page' ? 'content' : 'designer',
    onSave: () => emit('saved'),
    onCatalogSave: (kind, ref) => emit('catalog-saved', { kind, ref: structuredClone(ref) }),
  };
  handle = mountEditor(root.value, options);
  try { await handle.ready; } catch { /* EditorShell renders its own load error. */ }
});

onBeforeUnmount(() => { void handle?.destroy(); handle = null; });

async function goBack(): Promise<void> {
  if (!handle) { emit('back'); return; }
  backError.value = '';
  try {
    await handle.save();
    emit('back');
  } catch (error) {
    backError.value = error instanceof Error
      ? `Dönmeden önce açık taslağı kaydet veya iptal et. ${error.message}`
      : 'Dönmeden önce açık taslağı kaydet veya iptal et.';
  }
}

function discardAndBack(): void {
  backError.value = '';
  emit('back');
}
</script>

<template>
  <div class="workspace-editor">
    <div class="workspace-editor-bar">
      <button class="workspace-back" type="button" @click="goBack">Yönetime dön</button>
      <strong>{{ label }}</strong>
      <span class="workspace-editor-hint">Değişiklikleri kaydetmeden ayrılma</span>
    </div>
    <div v-if="backError" class="workspace-back-error" role="alert">
      <p>{{ backError }}</p>
      <button class="workspace-back-discard" type="button" @click="discardAndBack">Değişiklikleri at ve dön</button>
    </div>
    <div ref="root" class="workspace-editor-root" />
  </div>
</template>
