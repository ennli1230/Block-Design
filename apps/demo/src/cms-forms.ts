import type {
  ContentProviderAdapter,
  ContentRecord,
  FormActionAdapter,
  FormActionRequest,
  FormActionResult,
  FormDefinition,
  FormProviderAdapter,
  FormSummary,
  PageResult,
  RequestContext,
  SourceBinding,
  VersionRef,
} from "@blockdesign/contracts";
import { validateFormDefinition, validateFormValues } from "@blockdesign/core";

export const CMS_FORMS_BASE = "/cms-forms";
export const CURRENT_FORM_VERSION = "1.1.0";

/** Public JSON fixtures use the same versioned contract expected from any CMS. */
async function readJson(
  path: string,
  context?: RequestContext,
): Promise<unknown> {
  context?.signal?.throwIfAborted();
  const locale = context?.contentLocale?.locale ?? "tr";
  if (!locale.toLowerCase().startsWith("tr"))
    throw new Error("Örnek CMS bu dili desteklemiyor: " + locale);
  const response = await fetch(CMS_FORMS_BASE + path, {
    headers: { Accept: "application/json" },
    ...(context?.signal ? { signal: context.signal } : {}),
  });
  if (!response.ok)
    throw new Error("CMS JSON kaynağı alınamadı (" + response.status + ").");
  return response.json();
}

export class DemoCmsFormProvider implements FormProviderAdapter {
  readonly providerId = "demo-cms";
  readonly capabilities = { supported: ["listForms", "readSchema"] };
  async listForms(
    context?: RequestContext,
    cursor?: string,
  ): Promise<PageResult<FormSummary>> {
    if (cursor) throw new Error("Örnek katalog tek sayfadan oluşur.");
    const catalog = (await readJson(
      "/catalog.json",
      context,
    )) as PageResult<FormSummary>;
    if (
      !catalog ||
      !Array.isArray(catalog.items) ||
      catalog.nextCursor !== null ||
      catalog.items.some(
        (item) =>
          !item.ref?.id || !item.ref.version || typeof item.label !== "string",
      )
    )
      throw new Error("CMS form kataloğu geçersiz.");
    return catalog;
  }
  async getDefinition(
    ref: VersionRef,
    context?: RequestContext,
  ): Promise<FormDefinition> {
    const definition = await readJson(
      `/${encodeURIComponent(ref.id)}/${encodeURIComponent(ref.version)}.json`,
      context,
    );
    validateFormDefinition(definition);
    if (definition.ref.id !== ref.id || definition.ref.version !== ref.version)
      throw new Error("CMS istenen form sürümünü döndürmedi.");
    return definition;
  }
}

async function readOptionRecords(
  context?: RequestContext,
): Promise<Record<string, ContentRecord[]>> {
  const data = (await readJson("/options.json", context)) as Record<
    string,
    ContentRecord[]
  >;
  if (
    !data ||
    !["destinations", "tours"].every(
      (id) =>
        Array.isArray(data[id]) &&
        data[id]!.every(
          (row) =>
            typeof row.recordId === "string" &&
            row.collectionId === id &&
            typeof row.values?.label === "string",
        ),
    )
  )
    throw new Error("CMS seçenek verisi geçersiz.");
  return data;
}
export class DemoFormOptionsProvider implements ContentProviderAdapter {
  readonly providerId = "demo-form-options";
  readonly capabilities = { supported: ["search", "query", "pagination"] };
  async listCollections() {
    return Promise.all(
      ["destinations", "tours"].map((id) => this.getSchema(id)),
    );
  }
  async getSchema(collectionId: string) {
    if (!["destinations", "tours"].includes(collectionId))
      throw new Error("Seçenek koleksiyonu bulunamadı.");
    return {
      collectionId,
      label: collectionId,
      schemaVersion: "1",
      fields: [
        {
          fieldId: "label",
          label: "Ad",
          valueType: "text" as const,
          required: true,
          nullable: false,
        },
        ...(collectionId === "tours"
          ? [
              {
                fieldId: "destinationId",
                label: "Destinasyon",
                valueType: "text" as const,
                required: true,
                nullable: false,
              },
            ]
          : []),
      ],
      capabilities: {
        search: true,
        recordSelection: true,
        recordGroups: false,
        query: {
          filterFields: [{ fieldId: "destinationId", operators: ["eq"] }],
          sortFields: [],
          maxLimit: 50,
        },
      },
    };
  }
  async search(
    id: string,
    query: string,
    cursor?: string,
    context?: RequestContext,
  ) {
    context?.signal?.throwIfAborted();
    const offset = Number(cursor ?? 0);
    if (!Number.isInteger(offset) || offset < 0)
      throw new Error("Geçersiz cursor.");
    const records = await readOptionRecords(context);
    const rows = (records[id] ?? []).filter((record) =>
      String(record.values.label)
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
    );
    return {
      items: structuredClone(rows.slice(offset, offset + 2)),
      nextCursor: offset + 2 < rows.length ? String(offset + 2) : null,
    };
  }
  async query(
    id: string,
    query: NonNullable<SourceBinding["query"]>,
    context?: RequestContext,
  ) {
    context?.signal?.throwIfAborted();
    if (
      query.filters.some(
        (filter) =>
          filter.fieldId !== "destinationId" || filter.operator !== "eq",
      )
    )
      throw new Error("Desteklenmeyen seçenek filtresi.");
    const records = await readOptionRecords(context);
    return {
      items: structuredClone(
        (records[id] ?? [])
          .filter((record) =>
            query.filters.every(
              (filter) => record.values[filter.fieldId] === filter.value,
            ),
          )
          .slice(0, query.limit ?? 50),
      ),
      nextCursor: null,
    };
  }
  async resolveRecords(id: string, refs: string[], context?: RequestContext) {
    const records = await readOptionRecords(context);
    return refs.map((recordId) => ({
      recordId,
      record: structuredClone(
        records[id]?.find((row) => row.recordId === recordId) ?? null,
      ),
    }));
  }
}

/** Test adapter only. The editor's preview does not call this unless explicitly enabled. */
export class DemoCmsFormAction implements FormActionAdapter {
  readonly adapterId = "demo-cms";
  readonly capabilities = { supported: ["submit", "search", "idempotency"] };
  private readonly results = new Map<
    string,
    { fingerprint: string; result: FormActionResult }
  >();
  async execute(
    input: FormActionRequest,
    context?: RequestContext,
  ): Promise<FormActionResult> {
    const definition = await new DemoCmsFormProvider().getDefinition(
      input.formRef,
      context,
    );
    if (
      input.providerId !== "demo-cms" ||
      input.actionId !== definition.action.actionId ||
      input.kind !== definition.action.kind
    )
      throw new Error("Form işlemi eşleşmiyor.");
    const fingerprint = JSON.stringify({ ...input, submissionId: undefined });
    const existing = this.results.get(input.submissionId);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new Error("Aynı işlem kimliği farklı veriyle kullanılamaz.");
      return structuredClone(existing.result);
    }
    const records = await readOptionRecords(context);
    const fieldErrors = validateFormValues(definition, input.values, {
      destination: records.destinations!.map((row) => ({
        value: row.recordId,
        label: String(row.values.label),
      })),
      tour: records
        .tours!.filter(
          (row) => row.values.destinationId === input.values.destination,
        )
        .map((row) => ({
          value: row.recordId,
          label: String(row.values.label),
        })),
    });
    if (Object.keys(fieldErrors).length)
      return { kind: "validationError", fieldErrors };
    const result: FormActionResult =
      definition.action.kind === "search"
        ? { kind: "redirect", url: "/scalanova-tour/tr/turlar/" }
        : {
            kind: "accepted",
            receiptId: "demo-" + crypto.randomUUID(),
            message:
              "Demo başvurusu doğrulandı. Harici CMS’ye kayıt yapılmadı.",
          };
    this.results.set(input.submissionId, { fingerprint, result });
    return structuredClone(result);
  }
}
