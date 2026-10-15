import type {
  BlockDefinitionVersion,
  BlockInstance,
  ContentProviderAdapter,
  ContentLocaleContext,
  FieldDefinition,
  RepeaterDefinition,
  SourceBinding,
} from "@blockdesign/contracts";
import { createEmptyDocument } from "@blockdesign/core";
import { resolvePreviewDocument } from "./preview-document.ts";

export function effectiveSourceBinding(
  block: BlockInstance,
  target: FieldDefinition | RepeaterDefinition,
): SourceBinding | null {
  const scope = "fieldId" in target ? "field" : "repeater";
  const id = "fieldId" in target ? target.fieldId : target.repeaterId;
  const specific = block.sourceBindings.find(
    (binding) =>
      binding.target.scope === scope &&
      [id, target.key].includes(binding.target.id),
  );
  if (specific) return specific;
  const fallback = block.sourceBindings.find(
    (binding) => binding.target.scope === "block",
  );
  return fallback &&
    (scope === "repeater" ||
      fallback.fieldMappings.some((mapping) =>
        [id, target.key].includes(mapping.to),
      ))
    ? fallback
    : null;
}
export function mergeSourcePreview(
  block: BlockInstance,
  definition: BlockDefinitionVersion,
  resolved?: BlockInstance,
): BlockInstance {
  if (
    !resolved ||
    resolved.definitionRef.id !== block.definitionRef.id ||
    resolved.definitionRef.version !== block.definitionRef.version
  )
    return block;
  const manualData = { ...block.manualData };
  for (const target of [...definition.fields, ...definition.repeaters]) {
    const binding = effectiveSourceBinding(block, target);
    if (
      binding &&
      binding.mode !== "manual" &&
      resolved.manualData[target.key] !== undefined
    )
      manualData[target.key] = resolved.manualData[target.key]!;
  }
  return { ...block, manualData };
}
export function bindingMatchesTarget(
  binding: SourceBinding,
  target: SourceBinding["target"],
): boolean {
  return (
    binding.target.scope === target.scope &&
    (target.scope === "block" || binding.target.id === target.id)
  );
}
export function preferredSourceTarget(
  targets: SourceBinding["target"][],
  bindings: SourceBinding[],
): string {
  return (
    targets.find((target) =>
      bindings.some(
        (binding) =>
          binding.mode !== "manual" && bindingMatchesTarget(binding, target),
      ),
    )?.id ??
    targets[0]?.id ??
    ""
  );
}
export async function resolveBlockSourcePreview(
  block: BlockInstance,
  definition: BlockDefinitionVersion,
  providers: ContentProviderAdapter[],
  locale: ContentLocaleContext = { locale: 'tr', fallback: { mode: 'none' } },
  localeDefaults?: { defaultLocale?: string; fallback?: ContentLocaleContext['fallback']; requireProviderLocaleDeclaration?: boolean },
) {
  const document = createEmptyDocument();
  document.localization = { locale: locale.locale };
  document.blocks = [structuredClone(block)];
  const result = await resolvePreviewDocument(
    document,
    new Map([[`${definition.ref.id}@${definition.ref.version}`, definition]]),
    providers,
    [],
    localeDefaults ?? { defaultLocale: locale.locale, fallback: locale.fallback },
  );
  return { block: result.document.blocks[0]!, issues: result.issues };
}
/** Ignore delayed provider responses superseded by a newer selection. */
export function createSourcePreviewResolver(
  resolve = resolveBlockSourcePreview,
) {
  const requests = new Map<string, number>();
  let epoch = 0;
  return {
    async request(
      block: BlockInstance,
      definition: BlockDefinitionVersion,
      providers: ContentProviderAdapter[],
      locale: ContentLocaleContext = { locale: 'tr', fallback: { mode: 'none' } },
      localeDefaults?: { defaultLocale?: string; fallback?: ContentLocaleContext['fallback']; requireProviderLocaleDeclaration?: boolean },
    ) {
      const sequence = (requests.get(block.instanceId) ?? 0) + 1,
        startedEpoch = epoch;
      requests.set(block.instanceId, sequence);
      const result = await resolve(block, definition, providers, locale, localeDefaults);
      return epoch === startedEpoch &&
        requests.get(block.instanceId) === sequence
        ? result
        : null;
    },
    invalidate(id: string) {
      requests.set(id, (requests.get(id) ?? 0) + 1);
    },
    clear() {
      epoch++;
      requests.clear();
    },
  };
}
