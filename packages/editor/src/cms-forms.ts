import type {
  ContentProviderAdapter,
  FormBinding,
  FormDefinition,
  FormPublicationConfig,
  FormRuntimeOptions,
  RequestContext,
} from "@blockdesign/contracts";
import {
  loadFormOptions,
  mountCmsForm,
  validateFormDefinition,
  validateFormValues,
  type CmsFormServices,
} from "@blockdesign/core";
import type { PreviewBehaviorPlugin } from "@blockdesign/grapesjs-bridge";

export const CMS_FORM_CSS = `
[data-bd-cms-form]{min-width:0;width:100%;color:inherit}
.bd-cms-generated{display:grid;gap:20px;margin:0;font-family:inherit}
.bd-cms-title{font:inherit;font-size:1.4rem;font-weight:600;margin:0}
.bd-cms-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
.bd-cms-generated[data-columns="2"] .bd-cms-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.bd-cms-field{display:flex;flex-direction:column;gap:7px;min-width:0;border:0;margin:0;padding:0}
.bd-cms-field[data-span="2"]{grid-column:1/-1}
.bd-cms-field>label,.bd-cms-field>legend{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.bd-cms-field input:not([type=checkbox]):not([type=radio]),.bd-cms-field select,.bd-cms-field textarea{box-sizing:border-box;width:100%;min-width:0;min-height:44px;padding:10px 12px;border:1px solid #89988d;border-radius:4px;background:#fff;color:#27362e;font:inherit;font-size:16px}
.bd-cms-field textarea{min-height:110px;resize:vertical}
.bd-cms-field input[type=checkbox],.bd-cms-field input[type=radio]{width:20px;height:20px;accent-color:#416f5d}
.bd-cms-field>button{min-height:44px;padding:8px 12px;border:1px solid #89988d;border-radius:4px;background:#f5f7f4;color:#315d4a;font:inherit;font-size:14px;cursor:pointer}
.bd-cms-field>button:hover{background:#edf4ef}
.bd-cms-field [aria-invalid=true]{border-color:#a72d24!important}
.bd-cms-field input:focus-visible,.bd-cms-field select:focus-visible,.bd-cms-field textarea:focus-visible,.bd-cms-generated button:focus-visible{outline:2px solid #416f5d;outline-offset:3px}
.bd-cms-choice{display:flex;align-items:center;gap:8px;font-size:16px}
.bd-cms-help,.bd-cms-status,.bd-cms-error{margin:0;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
.bd-cms-help{color:#4e5e54}.bd-cms-help:empty,.bd-cms-status:empty{display:none}.bd-cms-error{color:#a72d24}
.bd-cms-error[hidden],.bd-cms-generated [hidden]{display:none!important}
.bd-cms-submit{min-height:44px;padding:11px 20px;border:1px solid #416f5d;border-radius:4px;background:#416f5d;color:#fff;font:inherit;cursor:pointer}
.bd-cms-generated button:disabled{opacity:.6;cursor:default}
.bd-cms-generated[data-appearance="inline-search"] .bd-cms-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
@media(max-width:600px){.bd-cms-generated[data-columns="2"] .bd-cms-grid{grid-template-columns:minmax(0,1fr)}}`;

export function createCmsFormBehavior(
  options: Omit<FormRuntimeOptions, "mode"> & {
    getContext?: () => RequestContext;
  },
): PreviewBehaviorPlugin {
  const active = new WeakMap<
    HTMLElement,
    { signature: string; stop: () => void }
  >();
  const mount = (
    root: HTMLElement,
    context?: { mode: "editor" | "preview" },
  ) => {
    const mode = context?.mode ?? "preview";
    const signature = mode + " " + root.getAttribute("data-bd-form-binding");
    if (active.get(root)?.signature === signature) return;
    active.get(root)?.stop();
    const services: CmsFormServices = {
      ...(options.messages?{messages:options.messages}:{}),
      mode,
      allowPreviewSubmission: options.allowPreviewSubmission ?? false,
      validateDefinition: validateFormDefinition,
      validateValues: validateFormValues,
      async definition(binding, signal) {
        const provider = options.providers.find(
          (p) => p.providerId === binding.providerId,
        );
        if (!provider)
          throw new Error(
            "Form sağlayıcısı bağlı değil: " + binding.providerId,
          );
        return provider.getDefinition(binding.formRef, {
          ...(options.getContext?.() ?? options.context),
          signal,
        });
      },
      options: (field, values, query, cursor, signal) =>
        loadFormOptions(
          field,
          values,
          options.contentProviders ?? [],
          { ...(options.getContext?.() ?? options.context), signal },
          query,
          cursor,
        ),
      async execute(definition, binding, values, submissionId, signal) {
        const adapter = options.actions?.find(
          (a) => a.adapterId === definition.action.adapterId,
        );
        if (
          !adapter ||
          !adapter.capabilities.supported.includes(definition.action.kind)
        )
          throw new Error("Form gönderim bağlantısı yapılandırılmadı.");
        return adapter.execute(
          {
            providerId: binding.providerId,
            formRef: binding.formRef,
            actionId: definition.action.actionId,
            kind: definition.action.kind,
            values,
            context: Object.fromEntries(
              binding.contextBindings.map((item) => [item.key, item.value]),
            ),
            submissionId,
          },
          { ...(options.getContext?.() ?? options.context), signal },
        );
      },
      ...(options.navigate ? { navigate: options.navigate } : {}),
    };
    const stop = mountCmsForm(root, services);
    active.set(root, { signature, stop });
  };
  return {
    id: "blockdesign.cms-form",
    selector: "[data-bd-cms-form]",
    runInEditor: true,
    css: CMS_FORM_CSS,
    mount(root, context) {
      mount(root, context);
      return () => {
        active.get(root)?.stop();
        active.delete(root);
      };
    },
    update: mount,
  };
}

/** Only public endpoint URLs and public pinned schemas are embedded in an export. */
export async function prepareCmsFormExport(
  html: string,
  options: {
    providers?: FormRuntimeOptions["providers"];
    publication?: FormPublicationConfig;
    context?: RequestContext;
  },
) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const roots = [
    ...template.content.querySelectorAll<HTMLElement>("[data-bd-cms-form]"),
  ];
  const issues: Array<{ code: string; message: string }> = [];
  if (!roots.length) return { html, js: "", issues };
  for (const root of roots) {
    try {
      const binding = JSON.parse(
        root.getAttribute("data-bd-form-binding") ?? "null",
      ) as FormBinding | null;
      if (!binding) throw new Error("CMS form kaynağı seçilmemiş.");
      const provider = options.providers?.find(
        (p) => p.providerId === binding.providerId,
      );
      if (!provider) throw new Error("CMS form sağlayıcısı bulunamadı.");
      const definition = await provider.getDefinition(
        binding.formRef,
        options.context,
      );
      validateFormDefinition(definition);
      if (
        definition.ref.id !== binding.formRef.id ||
        definition.ref.version !== binding.formRef.version
      )
        throw new Error("CMS form sürümü eşleşmiyor.");
      root.setAttribute("data-bd-form-definition", JSON.stringify(definition));
      root.textContent = "Form yükleniyor…";
    } catch (error) {
      root.textContent =
        error instanceof Error ? error.message : "Form çözümlenemedi.";
      issues.push({
        code: "FORM_SCHEMA_UNAVAILABLE",
        message: root.textContent,
      });
    }
  }
  if (!options.publication)
    issues.push({
      code: "FORM_PUBLICATION_UNCONFIGURED",
      message:
        "CMS formlarının yayın bağlantısı yok; çıktıda gönderim devre dışıdır.",
    });
  if (options.publication)
    for (const url of [
      options.publication.schemaBaseUrl,
      options.publication.actionBaseUrl,
      options.publication.contentBaseUrl,
    ].filter((u): u is string => Boolean(u)))
      if (
        !["http:", "https:"].includes(new URL(url, document.baseURI).protocol)
      )
        throw new Error("Form yayın bağlantısı HTTP(S) olmalı.");
  const config = JSON.stringify(options.publication ?? null).replace(
    /</g,
    "\\u003c",
  );
  const js = `(()=>{const mount=${mountCmsForm.toString()};const guard=${validateFormDefinition.toString()};const valuesGuard=${validateFormValues.toString()};const optionLoader=${loadFormOptions.toString()};(${publicFormBootstrap.toString()})(${config},mount,guard,valuesGuard,optionLoader);})();`;
  return { html: template.innerHTML, js, issues };
}

/** Self-contained HTTP bootstrap: no editor imports or private auth callbacks. */
function publicFormBootstrap(
  config: FormPublicationConfig | null,
  mount: typeof mountCmsForm,
  guard: typeof validateFormDefinition,
  valuesGuard: typeof validateFormValues,
  optionLoader: typeof loadFormOptions,
) {
  const active = new WeakMap<HTMLElement, () => void>();
  async function request(
    url: string,
    signal: AbortSignal | undefined,
    init: RequestInit = {},
  ) {
    const controller = new AbortController(),
      stop = () => controller.abort();
    signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(stop, 20000);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
      const body = await response.json();
      if (!response.ok && ![409, 410, 422].includes(response.status))
        throw new Error(
          "Form bağlantısı başarısız oldu (" + response.status + ").",
        );
      return body;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
    }
  }
  const elements = (scope: ParentNode, selector: string): HTMLElement[] => [
    ...((scope as Node).nodeType === 1 &&
    (scope as HTMLElement).matches(selector)
      ? [scope as HTMLElement]
      : []),
    ...scope.querySelectorAll<HTMLElement>(selector),
  ];
  const init = (scope: ParentNode = document) => {
    for (const root of elements(
      scope,
      "[data-bd-cms-form][data-bd-form-definition]",
    )) {
      if (active.has(root)) continue;
      const definition = JSON.parse(
        root.getAttribute("data-bd-form-definition")!,
      ) as FormDefinition;
      const providers: ContentProviderAdapter[] = [
        ...new Set(
          definition.fields.flatMap((field) =>
            field.options && !Array.isArray(field.options)
              ? [field.options.providerId]
              : [],
          ),
        ),
      ].map((providerId) => ({
        providerId,
        capabilities: { supported: ["search", "query"] },
        listCollections: async () => [],
        getSchema: (id, context) => {
          if (!config?.contentBaseUrl)
            throw new Error("Seçeneklerin yayın bağlantısı yapılandırılmadı.");
          return request(
            config.contentBaseUrl +
              `/content/collections/${encodeURIComponent(id)}?locale=${encodeURIComponent(definition.locale)}`,
            context?.signal,
          );
        },
        search: (id, query, cursor, context) =>
          request(
            config!.contentBaseUrl +
              `/content/collections/${encodeURIComponent(id)}/records?locale=${encodeURIComponent(definition.locale)}&q=${encodeURIComponent(query)}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
            context?.signal,
          ),
        query: (id, query, context) =>
          request(
            config!.contentBaseUrl +
              `/content/collections/${encodeURIComponent(id)}/query?locale=${encodeURIComponent(definition.locale)}`,
            context?.signal,
            { method: "POST", body: JSON.stringify(query) },
          ),
        resolveRecords: (id, refs, context) =>
          request(
            config!.contentBaseUrl +
              `/content/collections/${encodeURIComponent(id)}/resolve?locale=${encodeURIComponent(definition.locale)}`,
            context?.signal,
            { method: "POST", body: JSON.stringify({ recordRefs: refs }) },
          ),
      }));
      active.set(
        root,
        mount(root, {
          mode: "published",
          ...(config?.messages?{messages:config.messages}:{}),
          validateDefinition: guard,
          validateValues: valuesGuard,
          ...(config
            ? {}
            : {
                submissionUnavailable:
                  "Bu formun gönderim bağlantısı yapılandırılmadı.",
              }),
          definition: async () => definition,
          options: (field, values, query, cursor, signal) =>
            optionLoader(field, values, providers, { signal }, query, cursor),
          execute: async (form, binding, values, submissionId, signal) => {
            if (!config) throw new Error("Form yayın bağlantısı eksik.");
            return request(
              config.actionBaseUrl +
                `/forms/${encodeURIComponent(binding.formRef.id)}/versions/${encodeURIComponent(binding.formRef.version)}/submissions`,
              signal,
              {
                method: "POST",
                headers: { "Idempotency-Key": submissionId },
                body: JSON.stringify({
                  providerId: binding.providerId,
                  formRef: binding.formRef,
                  actionId: form.action.actionId,
                  kind: form.action.kind,
                  values,
                  context: Object.fromEntries(
                    binding.contextBindings.map((item) => [
                      item.key,
                      item.value,
                    ]),
                  ),
                  submissionId,
                }),
              },
            );
          },
        }),
      );
    }
  };
  const destroy = (scope: ParentNode = document) => {
    for (const root of elements(scope, "[data-bd-cms-form]")) {
      active.get(root)?.();
      active.delete(root);
    }
  };
  Object.assign(window, { BlockDesignForms: { init, destroy } });
  init();
}
