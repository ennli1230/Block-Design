import type {
  AdapterError,
  BlockDefinitionVersion,
  EditorDocument,
  FieldDefinition,
  FieldType,
  JsonValue,
} from "@blockdesign/contracts";
import type { PreviewBehaviorPlugin } from "@blockdesign/grapesjs-bridge";
export interface FieldEditorPlugin {
  mount(
    root: HTMLElement,
    field: FieldDefinition,
    value: JsonValue,
    onChange: (value: JsonValue) => void,
  ): () => void;
  update?(root: HTMLElement, value: JsonValue): void;
}
export interface EditorExtension {
  id: string;
  version: string;
  apiVersion: 1;
  blocks?: BlockDefinitionVersion[];
  behaviors?: PreviewBehaviorPlugin[];
  fieldEditors?: Partial<Record<FieldType, FieldEditorPlugin>>;
  validate?(document: EditorDocument): AdapterError[];
}
export function collectExtensions(extensions: EditorExtension[]) {
  const ids = new Set<string>(),
    refs = new Set<string>();
  const blocks: BlockDefinitionVersion[] = [],
    behaviors: PreviewBehaviorPlugin[] = [],
    fieldEditors: Partial<Record<FieldType, FieldEditorPlugin>> = {};
  for (const extension of extensions) {
    if (
      !extension.id.trim() ||
      ids.has(extension.id) ||
      extension.apiVersion !== 1 ||
      !/^\d+\.\d+\.\d+$/.test(extension.version)
    )
      throw new Error(
        "Eklenti kimliği veya API sürümü geçersiz: " + extension.id,
      );
    ids.add(extension.id);
    for (const block of extension.blocks ?? []) {
      const key = block.ref.id + "@" + block.ref.version;
      if (refs.has(key))
        throw new Error("Eklenti blok sürümü yineleniyor: " + key);
      refs.add(key);
      blocks.push(structuredClone(block));
    }
    behaviors.push(...(extension.behaviors ?? []));
    for (const [type, renderer] of Object.entries(
      extension.fieldEditors ?? {},
    )) {
      if (fieldEditors[type as FieldType])
        throw new Error("Aynı alan için iki editör kaydedilemez: " + type);
      fieldEditors[type as FieldType] = renderer;
    }
  }
  return {
    blocks,
    behaviors,
    fieldEditors,
    validate: (document: EditorDocument) =>
      extensions.flatMap(
        (extension) => extension.validate?.(structuredClone(document)) ?? [],
      ),
  };
}
