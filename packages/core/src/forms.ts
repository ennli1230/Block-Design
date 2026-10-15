import type {
  BlockDefinitionVersion,
  FormBinding,
  FormDefinition,
  FormField,
  FormOption,
  FormValues,
  VersionRef,
  ContentProviderAdapter,
  RequestContext,
} from "@blockdesign/contracts";

/** Self-contained so the same guard can be shipped with the standalone form runtime. */
export function validateFormDefinition(
  value: unknown,
): asserts value is FormDefinition {
  const fail = (message: string): never => {
    throw new Error("Form tanımı geçersiz: " + message);
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("JSON nesnesi gerekli.");
  const form = value as FormDefinition;
  const key = (s: unknown) =>
    typeof s === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(s) &&
    !["__proto__", "prototype", "constructor"].includes(s);
  if (
    !key(form.ref?.id) ||
    !key(form.ref?.version) ||
    typeof form.label !== "string" ||
    !form.label.trim() ||
    typeof form.locale !== "string"
  )
    fail("Kimlik, sürüm, ad veya dil eksik.");
  if (!Array.isArray(form.fields) || form.fields.length > 100)
    fail("En fazla 100 alan desteklenir.");
  if (form.layout && ![1, 2].includes(form.layout.columns))
    fail("Form sütun sayısı geçersiz.");
  if (
    !key(form.action?.adapterId) ||
    !key(form.action?.actionId) ||
    !["submit", "search"].includes(form.action?.kind) ||
    typeof form.action?.label !== "string"
  )
    fail("İşlem tanımı eksik.");
  const ids = new Set<string>();
  const types = [
    "text",
    "email",
    "tel",
    "textarea",
    "number",
    "date",
    "select",
    "radio",
    "checkbox",
  ];
  for (const field of form.fields) {
    if (!field || !key(field.fieldId) || ids.has(field.fieldId))
      fail("Alan kimliği eksik veya yineleniyor.");
    ids.add(field.fieldId);
    if (!types.includes(field.type))
      fail("Desteklenmeyen alan türü: " + field.type);
    if (typeof field.label !== "string" || !field.label.trim())
      fail("Alan etiketi eksik.");
    if (field.layout?.span !== undefined && ![1, 2].includes(field.layout.span))
      fail("Alan sütun genişliği geçersiz.");
    if (
      (field.help !== undefined && typeof field.help !== "string") ||
      (field.placeholder !== undefined && typeof field.placeholder !== "string")
    )
      fail("Alan metinleri geçersiz.");
    const rules = field.validation;
    if (rules) {
      if (rules.required !== undefined && typeof rules.required !== "boolean")
        fail("Zorunluluk geçersiz.");
      for (const name of ["minLength", "maxLength"] as const)
        if (
          rules[name] !== undefined &&
          (!Number.isInteger(rules[name]) || rules[name]! < 0)
        )
          fail("Uzunluk sınırı geçersiz.");
      for (const name of ["min", "max"] as const)
        if (
          rules[name] !== undefined &&
          !(field.type === "date"
            ? typeof rules[name] === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(String(rules[name]))
            : typeof rules[name] === "number" && Number.isFinite(rules[name]))
        )
          fail("Alan sınırı geçersiz.");
      if (
        (rules.minLength !== undefined &&
          rules.maxLength !== undefined &&
          rules.minLength > rules.maxLength) ||
        (rules.min !== undefined &&
          rules.max !== undefined &&
          rules.min > rules.max)
      )
        fail("Alan sınırları ters.");
    }
    if (
      field.defaultValue !== undefined &&
      field.defaultValue !== null &&
      !["string", "number", "boolean"].includes(typeof field.defaultValue)
    )
      fail("Başlangıç değeri geçersiz.");
    if (
      field.defaultValue !== undefined &&
      field.defaultValue !== null &&
      (field.type === "checkbox"
        ? typeof field.defaultValue !== "boolean"
        : field.type === "number"
          ? typeof field.defaultValue !== "number" ||
            !Number.isFinite(field.defaultValue)
          : typeof field.defaultValue !== "string")
    )
      fail("Başlangıç değerinin türü alanla eşleşmiyor.");
    if (field.options !== undefined) {
      if (!["select", "radio"].includes(field.type))
        fail("Bu alan seçenek desteklemiyor.");
      if (Array.isArray(field.options)) {
        const values = new Set();
        for (const option of field.options) {
          if (
            typeof option?.value !== "string" ||
            typeof option?.label !== "string" ||
            values.has(option.value)
          )
            fail("Seçenek kimlikleri geçersiz veya yineleniyor.");
          values.add(option.value);
        }
      } else {
        const source = field.options;
        if (
          !source ||
          !key(source.providerId) ||
          !key(source.collectionId) ||
          !key(source.labelField) ||
          (source.valueField !== undefined && !key(source.valueField))
        )
          fail("Seçenek kaynağı geçersiz.");
        if (
          source.dependencies !== undefined &&
          !Array.isArray(source.dependencies)
        )
          fail("Bağımlılık listesi geçersiz.");
        for (const dependency of source.dependencies ?? [])
          if (!key(dependency?.fieldId) || !key(dependency?.filterField))
            fail("Alan bağımlılığı geçersiz.");
        if (source.searchable && source.dependencies?.length)
          fail("Bağımlı seçeneklerde arama bu sürümde desteklenmiyor.");
      }
    } else if (["select", "radio"].includes(field.type))
      fail("Seçenek alanının kaynağı eksik.");
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) fail("Döngüsel alan bağımlılığı.");
    if (visited.has(id)) return;
    visiting.add(id);
    const field = form.fields.find((f) => f.fieldId === id)!;
    if (field.options && !Array.isArray(field.options))
      for (const dependency of field.options.dependencies ?? []) {
        if (!ids.has(dependency.fieldId)) fail("Bağımlı alan bulunamadı.");
        visit(dependency.fieldId);
      }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

export function validateFormValues(
  form: FormDefinition,
  values: FormValues,
  loaded: Record<string, FormOption[]> = {},
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const field of form.fields) {
    const value = values[field.fieldId];
    const rules = field.validation ?? {};
    const empty =
      value === null ||
      value === undefined ||
      (typeof value === "string" && !value.trim()) ||
      (field.type === "checkbox" && value !== true);
    let error = "";
    if (empty) {
      if (rules.required) error = "Bu alan zorunludur.";
    } else if (field.type === "checkbox" && typeof value !== "boolean")
      error = "Geçerli bir seçim yapın.";
    else if (
      field.type === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      error = "Geçerli bir sayı girin.";
    else if (
      field.type !== "number" &&
      field.type !== "checkbox" &&
      typeof value !== "string"
    )
      error = "Geçerli bir değer girin.";
    else if (
      field.type === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
    )
      error = "Geçerli bir e-posta adresi girin.";
    else if (
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ||
        !Number.isFinite(Date.parse(String(value))) ||
        new Date(String(value)).toISOString().slice(0, 10) !== value)
    )
      error = "Geçerli bir tarih girin.";
    else if (
      typeof value === "string" &&
      ((rules.minLength !== undefined && value.length < rules.minLength) ||
        (rules.maxLength !== undefined && value.length > rules.maxLength))
    )
      error = "Metin uzunluğu izin verilen aralıkta değil.";
    else if (
      (rules.min !== undefined && (value as number) < (rules.min as number)) ||
      (rules.max !== undefined && (value as number) > (rules.max as number))
    )
      error = "Değer izin verilen aralıkta değil.";
    if (!error && !empty && ["select", "radio"].includes(field.type)) {
      const options = Array.isArray(field.options)
        ? field.options
        : loaded[field.fieldId];
      if (!options || !options.some((o) => o.value === value))
        error = "Geçerli bir seçenek seçin.";
    }
    if (error) errors[field.fieldId] = [error];
  }
  return errors;
}

export function formSchemaDiff(previous: FormDefinition, next: FormDefinition) {
  return {
    added: next.fields
      .filter((f) => !previous.fields.some((p) => p.fieldId === f.fieldId))
      .map((f) => f.fieldId),
    removed: previous.fields
      .filter((f) => !next.fields.some((p) => p.fieldId === f.fieldId))
      .map((f) => f.fieldId),
    changed: next.fields
      .filter((f) => {
        const old = previous.fields.find((p) => p.fieldId === f.fieldId);
        return old && JSON.stringify(old) !== JSON.stringify(f);
      })
      .map((f) => f.fieldId),
  };
}

export async function loadFormOptions(
  field: FormField,
  values: FormValues,
  providers: ContentProviderAdapter[],
  context?: RequestContext,
  query = "",
  cursor?: string,
) {
  if (Array.isArray(field.options))
    return { items: field.options, nextCursor: null };
  const source = field.options;
  if (!source) throw new Error("Seçenek kaynağı yok.");
  const provider = providers.find((p) => p.providerId === source.providerId);
  if (!provider)
    throw new Error("Seçenek sağlayıcısı bağlı değil: " + source.providerId);
  const schema = await provider.getSchema(source.collectionId, context);
  if (
    !schema.fields.some((f) => f.fieldId === source.labelField) ||
    (source.valueField &&
      !schema.fields.some((f) => f.fieldId === source.valueField))
  )
    throw new Error("Seçenek alan eşlemesi geçersiz.");
  const dependencies = source.dependencies ?? [];
  if (
    dependencies.some(
      (d) =>
        values[d.fieldId] === undefined ||
        values[d.fieldId] === null ||
        values[d.fieldId] === "",
    )
  )
    return { items: [], nextCursor: null };
  let result;
  if (dependencies.length) {
    if (
      !provider.query ||
      !schema.capabilities.query ||
      dependencies.some(
        (d) =>
          !schema.capabilities.query!.filterFields.some(
            (f) => f.fieldId === d.filterField && f.operators.includes("eq"),
          ),
      )
    )
      throw new Error("Kaynak bağımlı filtreyi desteklemiyor.");
    if (cursor || query)
      throw new Error(
        "Bağımlı seçeneklerde arama veya sayfalama desteklenmiyor.",
      );
    result = await provider.query(
      source.collectionId,
      {
        filters: dependencies.map((d) => ({
          fieldId: d.filterField,
          operator: "eq" as const,
          value: values[d.fieldId]!,
        })),
        sort: null,
        limit: Math.min(50, schema.capabilities.query.maxLimit),
      },
      context,
    );
    if (result.nextCursor)
      throw new Error(
        "Seçenekler tek sonuç sayfasına sığmıyor; host seçenek kaynağı gerekiyor.",
      );
  } else {
    if (!schema.capabilities.search)
      throw new Error("Kaynak seçenek aramasını desteklemiyor.");
    result = await provider.search(source.collectionId, query, cursor, context);
  }
  const items: FormOption[] = result.items.map((record) => {
    const value = source.valueField
      ? record.values[source.valueField]
      : record.recordId;
    const label = record.values[source.labelField];
    if (typeof value !== "string" || typeof label !== "string")
      throw new Error("Seçenek değeri ve etiketi metin olmalı.");
    return { value, label };
  });
  const selected = values[field.fieldId];
  if (
    typeof selected === "string" &&
    selected &&
    !source.valueField &&
    !dependencies.length &&
    !items.some((option) => option.value === selected)
  ) {
    const resolved = await provider.resolveRecords(
      source.collectionId,
      [selected],
      context,
    );
    const record = resolved[0]?.record;
    if (record && typeof record.values[source.labelField] === "string")
      items.unshift({
        value: record.recordId,
        label: record.values[source.labelField] as string,
      });
  }
  if (new Set(items.map((o) => o.value)).size !== items.length)
    throw new Error("Seçenek kimliği yineleniyor.");
  return { items, nextCursor: result.nextCursor };
}

export const CMS_FORM_ID = "blockdesign.cms-form";
export function createCmsFormDefinition(
  designSystemRef: VersionRef,
): BlockDefinitionVersion {
  return {
    ref: { id: CMS_FORM_ID, version: "1.0.0" },
    designSystemRef,
    name: "CMS Formu",
    category: "Formlar",
    description:
      "Alanları, zorunlulukları ve seçenekleri bağlı CMS tarafından oluşturulan ortak form.",
    preview: "custom",
    componentTemplate: {
      type: "default",
      tagName: "div",
      attributes: { "data-bd-cms-form": "true", "data-bd-node": "cms-form" },
      components: [{ type: "textnode", content: "CMS form kaynağını seçin." }],
    },
    fields: [],
    repeaters: [],
    defaultData: {},
    stylePolicy: {
      allowedProperties: [
        "color",
        "background-color",
        "padding",
        "margin",
        "border",
        "border-radius",
        "max-width",
      ],
      structuralEdits: false,
    },
    sourceCapabilities: { modes: ["manual"], target: [] },
    archived: false,
  };
}

export function validateFormBinding(binding: FormBinding): void {
  if (
    !binding ||
    typeof binding.providerId !== "string" ||
    !binding.providerId ||
    typeof binding.formRef?.id !== "string" ||
    !binding.formRef.id ||
    typeof binding.formRef?.version !== "string" ||
    !binding.formRef.version ||
    !["stacked", "inline-search"].includes(binding.appearance) ||
    !Array.isArray(binding.contextBindings)
  )
    throw new Error("Form bağlantısı geçersiz.");
  const keys = new Set<string>();
  for (const item of binding.contextBindings) {
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(item.key) ||
      ["constructor", "prototype", "__proto__"].includes(item.key) ||
      keys.has(item.key) ||
      !["string", "number", "boolean"].includes(typeof item.value) ||
      (typeof item.value === "number" && !Number.isFinite(item.value))
    )
      throw new Error("Form bağlam eşlemesi geçersiz.");
    keys.add(item.key);
  }
}
