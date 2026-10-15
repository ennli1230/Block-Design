import type {
  BlockDefinitionVersion,
  BlockInstance,
} from "@blockdesign/contracts";

export function blockSettingsVersion(
  definition: BlockDefinitionVersion,
  instance: BlockInstance,
  name: string,
  version: string,
  useInstanceDefaults: boolean,
): BlockDefinitionVersion {
  if (!name.trim()) throw new Error("Blok adı gerekli.");
  const next = structuredClone(definition);
  next.ref.version = version;
  next.name = name.trim();
  if (useInstanceDefaults) {
    next.defaultData = structuredClone(instance.manualData);
    next.defaultSourceBindings = instance.sourceBindings.map((binding) => ({
      ...structuredClone(binding),
      target:
        binding.target.scope === "block"
          ? { scope: "block", id: definition.ref.id }
          : structuredClone(binding.target),
    }));
  }
  return next;
}
