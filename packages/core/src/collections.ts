import type {
  ContentProviderAdapter,
  ContentRecord,
  JsonValue,
  PageResult,
  RequestContext,
  SourceBinding,
} from "../../contracts/src/index.ts";

/** Resolve only explicitly marked values against host-owned context; never execute expressions. */
export function contextualQuery(
  query: NonNullable<SourceBinding["query"]>,
  context?: RequestContext,
): NonNullable<SourceBinding["query"]> {
  return {
    ...structuredClone(query),
    filters: query.filters.map((filter) => {
      const value = filter.value;
      if (
        !value ||
        Array.isArray(value) ||
        typeof value !== "object" ||
        !Object.hasOwn(value, "$context")
      )
        return structuredClone(filter);
      const path = value["$context"];
      if (
        typeof path !== "string" ||
        !/^(page\.(documentId|siteId|recordId|route\.[\w-]+)|contentLocale\.locale)$/.test(
          path,
        )
      )
        throw new Error("Geçersiz sayfa bağlamı alanı.");
      let found: unknown = context;
      for (const key of path.split("."))
        found =
          found && typeof found === "object" && Object.hasOwn(found, key)
            ? (found as Record<string, unknown>)[key]
            : undefined;
      if (!["string", "number", "boolean"].includes(typeof found))
        throw new Error(`Sayfa bağlamı bulunamadı: ${path}`);
      return { ...filter, value: found as JsonValue };
    }),
  };
}

export async function loadCollectionPage(
  providers: ContentProviderAdapter[],
  binding: SourceBinding,
  values: Record<string, string>,
  cursor?: string,
  context?: RequestContext,
  resolveQuery: typeof contextualQuery = contextualQuery,
): Promise<PageResult<ContentRecord>> {
  if (
    binding.mode !== "query" ||
    binding.target.scope !== "repeater" ||
    !binding.query ||
    !binding.live ||
    !binding.collectionId
  )
    throw new Error("Canlı liste için sorguya bağlı bir liste seç.");
  if (binding.locale?.mode === "fixed")
    context = {
      ...context,
      contentLocale: {
        locale: binding.locale.locale,
        fallback: context?.contentLocale?.fallback ?? { mode: "none" },
      },
    };
  const provider = providers.find((p) => p.providerId === binding.providerId);
  if (
    !provider?.queryPage ||
    !provider.capabilities.supported.includes("queryPage")
  )
    throw new Error("CMS sağlayıcısı sayfalı sorguyu desteklemiyor.");
  const schema = await provider.getSchema(binding.collectionId, context);
  if (
    schema.localization?.mode === "translated" &&
    schema.localization.supportedLocales?.length &&
    context?.contentLocale
  ) {
    const supports = (locale: string) =>
      schema.localization!.supportedLocales!.some(
        (code) =>
          code.toLowerCase() === locale.toLowerCase() ||
          code.toLowerCase() === locale.toLowerCase().split("-")[0],
      );
    if (
      !supports(context.contentLocale.locale) &&
      !(
        context.contentLocale.fallback.mode === "locale" &&
        supports(context.contentLocale.fallback.locale)
      )
    )
      throw new Error("Canlı liste istenen dili desteklemiyor.");
  }
  if (
    binding.schemaVersion &&
    schema.schemaVersion &&
    binding.schemaVersion !== schema.schemaVersion
  )
    throw new Error("CMS şeması değişti; liste alanlarını yeniden eşle.");
  const capability = schema.capabilities.query;
  const query = resolveQuery(binding.query, context);
  if (
    !capability ||
    !Number.isInteger(query.limit) ||
    !query.limit ||
    query.limit < 1 ||
    query.limit > capability.maxLimit
  )
    throw new Error("Liste sayfa boyutu desteklenmiyor.");
  for (const key of Object.keys(values))
    if (!binding.live.filters.some((f) => f.fieldId === key))
      throw new Error(`Ziyaretçi filtresine izin verilmiyor: ${key}`);
  for (const filter of binding.live.filters) {
    if (
      !capability.filterFields.some(
        (f) =>
          f.fieldId === filter.fieldId && f.operators.includes(filter.operator),
      )
    )
      throw new Error(`CMS bu filtreyi desteklemiyor: ${filter.fieldId}`);
    const value = values[filter.fieldId]?.trim();
    if (value) {
      if (value.length > 300) throw new Error("Ziyaretçi filtresi çok uzun.");
      const field = schema.fields?.find((f) => f.fieldId === filter.fieldId);
      const parsed = field?.valueType === "number" ? Number(value) : value;
      if (typeof parsed === "number" && !Number.isFinite(parsed))
        throw new Error("Sayısal filtre geçersiz.");
      query.filters.push({
        fieldId: filter.fieldId,
        operator: filter.operator,
        value: parsed,
      });
    }
  }
  for (const filter of query.filters)
    if (
      !capability.filterFields.some(
        (f) =>
          f.fieldId === filter.fieldId && f.operators.includes(filter.operator),
      )
    )
      throw new Error("Sorgu filtresi desteklenmiyor.");
  if (query.sort && !capability.sortFields.includes(query.sort.fieldId))
    throw new Error("Sorgu sıralaması desteklenmiyor.");
  const result = await provider.queryPage(
    binding.collectionId,
    query,
    cursor,
    context,
  );
  if (
    !Array.isArray(result.items) ||
    result.items.length > query.limit ||
    (result.nextCursor !== null && typeof result.nextCursor !== "string")
  )
    throw new Error("CMS sayfalama yanıtı geçersiz.");
  if (cursor && result.nextCursor === cursor)
    throw new Error("CMS aynı sayfalama anahtarını tekrar döndürdü.");
  return result;
}
