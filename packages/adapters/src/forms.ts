import type {
  FormActionAdapter,
  FormActionRequest,
  FormActionResult,
  FormDefinition,
  FormProviderAdapter,
  FormSummary,
  PageResult,
  RequestContext,
  VersionRef,
} from "@blockdesign/contracts";

export interface FormHttpOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  headers?: () => HeadersInit;
  timeoutMs?: number;
}

async function formRequest(
  options: FormHttpOptions,
  path: string,
  init: RequestInit,
  context?: RequestContext,
): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const stop = () => controller.abort(context?.signal?.reason);
  if (context?.signal?.aborted) stop();
  else context?.signal?.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error("Form bağlantısı zaman aşımına uğradı.")),
    options.timeoutMs ?? 20000,
  );
  const headers = new Headers(options.headers?.());
  headers.set("Accept", "application/json");
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const params = new URLSearchParams();
  if (context?.contentLocale?.locale)
    params.set("locale", context.contentLocale.locale);
  try {
    const response = await (options.fetcher ?? globalThis.fetch)(
      options.baseUrl.replace(/\/$/, "") +
        path +
        (params.size ? (path.includes("?") ? "&" : "?") + params : ""),
      {
        ...init,
        headers,
        signal: controller.signal,
        credentials: "same-origin",
      },
    );
    const body: unknown = await response.json();
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted && !context?.signal?.aborted)
      throw new Error("Form bağlantısı zaman aşımına uğradı.");
    throw error;
  } finally {
    clearTimeout(timer);
    context?.signal?.removeEventListener("abort", stop);
  }
}

export class HttpFormProviderAdapter implements FormProviderAdapter {
  readonly capabilities = { supported: ["listForms", "readSchema"] };
  readonly providerId: string;
  private readonly options: FormHttpOptions & { providerId: string };
  constructor(options: FormHttpOptions & { providerId: string }) {
    this.options = options;
    this.providerId = options.providerId;
  }
  async listForms(
    context?: RequestContext,
    cursor?: string,
  ): Promise<PageResult<FormSummary>> {
    const { response, body } = await formRequest(
      this.options,
      "/forms" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      {},
      context,
    );
    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !Array.isArray((body as PageResult<FormSummary>).items)
    )
      throw new Error("CMS form kataloğu alınamadı.");
    return body as PageResult<FormSummary>;
  }
  async getDefinition(
    ref: VersionRef,
    context?: RequestContext,
  ): Promise<FormDefinition> {
    const { response, body } = await formRequest(
      this.options,
      `/forms/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`,
      {},
      context,
    );
    if (!response.ok)
      throw new Error(
        response.status === 409 || response.status === 410
          ? "Form şeması değişti; bağlantıyı güncelleyin."
          : "CMS form tanımı alınamadı (" + response.status + ").",
      );
    if (!body || typeof body !== "object")
      throw new Error("CMS form tanımı JSON nesnesi olmalı.");
    return body as FormDefinition;
  }
}

export function validateFormActionResult(body: unknown): FormActionResult {
  if (!body || typeof body !== "object")
    throw new Error("Form işlemi geçersiz yanıt verdi.");
  const result = body as FormActionResult;
  if (
    result.kind === "accepted" &&
    typeof result.receiptId === "string" &&
    (result.message === undefined || typeof result.message === "string")
  )
    return result;
  if (result.kind === "redirect" && typeof result.url === "string")
    return result;
  if (result.kind === "schemaChanged" && typeof result.message === "string")
    return result;
  if (
    result.kind === "validationError" &&
    result.fieldErrors &&
    typeof result.fieldErrors === "object" &&
    !Array.isArray(result.fieldErrors) &&
    Object.values(result.fieldErrors).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    )
  )
    return result;
  throw new Error("Form işlemi tanınmayan bir sonuç döndürdü.");
}

/** POST failures never fall back to browser-local storage or an automatic retry. */
export class HttpFormActionAdapter implements FormActionAdapter {
  readonly capabilities = { supported: ["submit", "search", "idempotency"] };
  readonly adapterId: string;
  private readonly options: FormHttpOptions & { adapterId: string };
  constructor(options: FormHttpOptions & { adapterId: string }) {
    this.options = options;
    this.adapterId = options.adapterId;
  }
  async execute(
    input: FormActionRequest,
    context?: RequestContext,
  ): Promise<FormActionResult> {
    const { response, body } = await formRequest(
      this.options,
      `/forms/${encodeURIComponent(input.formRef.id)}/versions/${encodeURIComponent(input.formRef.version)}/submissions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": input.submissionId,
        },
        body: JSON.stringify(input),
      },
      context,
    );
    const result = validateFormActionResult(body);
    if (
      response.ok ||
      (response.status === 422 && result.kind === "validationError") ||
      ([409, 410].includes(response.status) && result.kind === "schemaChanged")
    )
      return result;
    throw new Error("Form işlemi başarısız oldu (" + response.status + ").");
  }
}
