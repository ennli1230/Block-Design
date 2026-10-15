import type {
  FormActionResult,
  FormBinding,
  FormDefinition,
  FormField,
  FormOption,
  FormValues,
  PageResult,
} from "@blockdesign/contracts";

export interface CmsFormServices {
  messages?: Record<string,string>;
  mode: "editor" | "preview" | "published";
  allowPreviewSubmission?: boolean;
  submissionUnavailable?: string;
  definition(
    binding: FormBinding,
    signal: AbortSignal,
  ): Promise<FormDefinition>;
  options(
    field: FormField,
    values: FormValues,
    query: string,
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<PageResult<FormOption>>;
  execute(
    definition: FormDefinition,
    binding: FormBinding,
    values: FormValues,
    submissionId: string,
    signal: AbortSignal,
  ): Promise<FormActionResult>;
  validateDefinition(value: unknown): void;
  validateValues(
    definition: FormDefinition,
    values: FormValues,
    options: Record<string, FormOption[]>,
  ): Record<string, string[]>;
  navigate?(url: string): void;
}

/** DOM-only, self-contained runtime. Values live in this closure and never in the editor model. */
export function mountCmsForm(
  root: HTMLElement,
  services: CmsFormServices,
): () => void {
  const doc = root.ownerDocument;
  const english:Record<string,string>={
    'Form yükleniyor…':'Loading form…','Form bağlantısı başarısız oldu.':'The form could not be loaded.','Özellikler panelinden CMS form kaynağını seçin.':'Select a CMS form in the properties panel.','Seçin':'Choose','Seçenekler yükleniyor…':'Loading options…','Bu seçim için seçenek bulunamadı.':'No options found for this selection.','Daha fazla seçenek':'More options','Yeniden dene':'Try again','Ara':'Search','İşaretli alanları kontrol edin.':'Check the highlighted fields.','Gönderiliyor…':'Submitting…','Önizleme: bilgiler gönderilmez ve kaydedilmez.':'Preview: information is not submitted or stored.','Alanlar CMS tarafından yönetilir. Denemek için Önizle’yi açın.':'Fields are managed by the CMS. Open Preview to try the form.','Başvurunuz alındı. Referans: ':'Your submission was received. Reference: ',' Bilgiler bu oturumda korunuyor; yeniden deneyebilirsiniz.':' Your information is kept in this session. You can try again.'
  };
  const t=(source:string)=>services.messages?.[source]??(doc.documentElement.lang.toLowerCase().startsWith('en')?english[source]??source:source);
  const uuid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 15) | 64;
    bytes[8] = (bytes[8]! & 63) | 128;
    const hex = [...bytes]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const original = [...root.childNodes];
  const abort = new AbortController();
  const requests = new Map<string, AbortController>();
  let disposed = false,
    submitting = false,
    completed = false;
  let submissionId = "",
    fingerprint = "";
  const values: FormValues = {},
    optionValues: Record<string, FormOption[]> = {};
  const pending = new Set<string>(),
    failed = new Set<string>();
  const fields = new Map<string, HTMLElement>(),
    errors = new Map<string, HTMLElement>();
  const controls = new Map<
    string,
    Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  >();
  const counters = new Map<string, number>();
  const texts = (tag: string, text = "", className = "") => {
    const node = doc.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  };
  const status = texts("p", t("Form yükleniyor…"), "bd-cms-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  root.replaceChildren(status);
  const instanceId = "cms-" + (root.getAttribute("data-bd-block-id") ?? uuid());
  const failMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("Form bağlantısı başarısız oldu.");
  void (async () => {
    const raw = root.getAttribute("data-bd-form-binding");
    if (!raw) {
      status.textContent = t("Özellikler panelinden CMS form kaynağını seçin.");
      return;
    }
    const binding = JSON.parse(raw) as FormBinding;
    const definition = await services.definition(binding, abort.signal);
    if (disposed) return;
    services.validateDefinition(definition);
    if (
      definition.ref.id !== binding.formRef.id ||
      definition.ref.version !== binding.formRef.version
    )
      throw new Error(
        t("CMS istenen form sürümünü döndürmedi. Form bağlantısını güncelleyin."),
      );
    const form = doc.createElement("form");
    form.noValidate = true;
    form.className = "bd-cms-generated";
    form.setAttribute("aria-label", definition.label);
    form.dataset.appearance = binding.appearance;
    form.dataset.columns = String(definition.layout?.columns ?? 1);
    const title = texts("h3", definition.label, "bd-cms-title");
    const grid = texts("div", "", "bd-cms-grid");
    const actions = texts("div", "", "bd-cms-actions");
    const submit = doc.createElement("button");
    submit.type = "submit";
    submit.className = "button bd-cms-submit";
    submit.textContent = definition.action.label;
    actions.append(submit);
    form.append(title, grid, actions, status);
    root.replaceChildren(form);
    const updateDisabled = () => {
      const blocked = services.mode === "editor" || submitting || completed;
      submit.disabled =
        blocked ||
        pending.size > 0 ||
        failed.size > 0 ||
        Boolean(services.submissionUnavailable);
      for (const field of definition.fields) {
        const deps =
          field.options && !Array.isArray(field.options)
            ? (field.options.dependencies ?? [])
            : [];
        const missing = deps.some(
          (d) =>
            values[d.fieldId] === null ||
            values[d.fieldId] === undefined ||
            values[d.fieldId] === "",
        );
        for (const control of controls.get(field.fieldId) ?? [])
          control.disabled =
            blocked ||
            pending.has(field.fieldId) ||
            failed.has(field.fieldId) ||
            missing;
      }
    };
    const showErrors = (messages: Record<string, string[]>) => {
      for (const field of definition.fields) {
        const text = messages[field.fieldId]?.join(" ") ?? "";
        const node = errors.get(field.fieldId)!;
        node.textContent = text;
        node.hidden = !text;
        for (const control of controls.get(field.fieldId) ?? [])
          control.setAttribute("aria-invalid", text ? "true" : "false");
      }
    };
    const readControl = (
      field: FormField,
      control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    ) => {
      values[field.fieldId] =
        field.type === "checkbox"
          ? (control as HTMLInputElement).checked
          : field.type === "number"
            ? control.value === ""
              ? null
              : Number(control.value)
            : control.value;
    };
    const renderOptions = (field: FormField) => {
      const holder = fields.get(field.fieldId)!;
      if (field.type === "select") {
        const control = controls.get(field.fieldId)![0] as HTMLSelectElement;
        const placeholder = doc.createElement("option");
        placeholder.value = "";
        placeholder.textContent = field.placeholder ?? t("Seçin");
        control.replaceChildren(
          placeholder,
          ...(optionValues[field.fieldId] ?? []).map((option) => {
            const node = doc.createElement("option");
            node.value = option.value;
            node.textContent = option.label;
            return node;
          }),
        );
        control.value = String(values[field.fieldId] ?? "");
      } else {
        const group = holder.querySelector("[data-cms-radio]")!;
        group.replaceChildren();
        const list: HTMLInputElement[] = [];
        for (const [index, option] of (
          optionValues[field.fieldId] ?? []
        ).entries()) {
          const label = texts("label", "", "bd-cms-choice");
          const input = doc.createElement("input");
          input.type = "radio";
          input.id = instanceId + "-" + field.fieldId + "-" + index;
          input.name = instanceId + "-" + field.fieldId;
          input.value = option.value;
          input.checked = values[field.fieldId] === option.value;
          input.setAttribute(
            "aria-describedby",
            instanceId +
              "-" +
              field.fieldId +
              "-help " +
              instanceId +
              "-" +
              field.fieldId +
              "-error",
          );
          input.addEventListener("change", () => {
            readControl(field, input);
            changed(field.fieldId);
          });
          label.append(input, doc.createTextNode(option.label));
          group.append(label);
          list.push(input);
        }
        controls.set(field.fieldId, list);
      }
      updateDisabled();
    };
    const load = async (
      field: FormField,
      query = "",
      cursor?: string,
    ): Promise<void> => {
      const id = field.fieldId;
      requests.get(id)?.abort();
      const controller = new AbortController();
      requests.set(id, controller);
      const counter = (counters.get(id) ?? 0) + 1;
      counters.set(id, counter);
      pending.add(id);
      failed.delete(id);
      updateDisabled();
      const optionStatus = fields
        .get(id)!
        .querySelector<HTMLElement>("[data-cms-option-status]")!;
      optionStatus.textContent = t("Seçenekler yükleniyor…");
      try {
        const result = await services.options(
          field,
          { ...values },
          query,
          cursor,
          controller.signal,
        );
        if (disposed || counter !== counters.get(id)) return;
        const selected = (optionValues[id] ?? []).find(
          (option) => option.value === values[id],
        );
        const combined = cursor
          ? [...(optionValues[id] ?? []), ...result.items]
          : [...(selected ? [selected] : []), ...result.items];
        optionValues[id] = [
          ...new Map(combined.map((option) => [option.value, option])).values(),
        ];
        renderOptions(field);
        const missingDependency =
          field.options &&
          !Array.isArray(field.options) &&
          field.options.dependencies?.some(
            (dependency) =>
              values[dependency.fieldId] === undefined ||
              values[dependency.fieldId] === null ||
              values[dependency.fieldId] === "",
          );
        optionStatus.textContent =
          optionValues[id]!.length || missingDependency
            ? ""
            : t("Bu seçim için seçenek bulunamadı.");
        const more = fields
          .get(id)!
          .querySelector<HTMLButtonElement>("[data-cms-more]")!;
        more.textContent = t("Daha fazla seçenek");
        more.hidden = !result.nextCursor;
        more.onclick = () => {
          void load(field, query, result.nextCursor ?? undefined);
        };
      } catch (error) {
        if (disposed || counter !== counters.get(id)) return;
        failed.add(id);
        optionStatus.textContent = failMessage(error);
        const retry = fields
          .get(id)!
          .querySelector<HTMLButtonElement>("[data-cms-more]")!;
        retry.textContent = "Yeniden dene";
        retry.hidden = false;
        retry.onclick = () => {
          void load(field, query, cursor);
        };
      } finally {
        if (counter === counters.get(id)) {
          pending.delete(id);
          updateDisabled();
        }
      }
    };
    const changed = (id: string) => {
      completed = false;
      const clear = (parent: string) => {
        for (const field of definition.fields)
          if (
            field.options &&
            !Array.isArray(field.options) &&
            field.options.dependencies?.some((d) => d.fieldId === parent)
          ) {
            values[field.fieldId] = "";
            optionValues[field.fieldId] = [];
            renderOptions(field);
            clear(field.fieldId);
            void load(field);
          }
      };
      clear(id);
      showErrors({});
      updateDisabled();
    };
    for (const field of definition.fields) {
      const id = instanceId + "-" + field.fieldId;
      values[field.fieldId] =
        field.defaultValue ?? (field.type === "checkbox" ? false : "");
      const holder = texts(
        field.type === "radio" ? "fieldset" : "div",
        "",
        "bd-cms-field",
      );
      holder.dataset.span = String(field.layout?.span ?? 1);
      const label = texts(
        field.type === "radio" ? "legend" : "label",
        field.label + (field.validation?.required ? " *" : ""),
      );
      if (field.type !== "radio") label.setAttribute("for", id);
      holder.append(label);
      fields.set(field.fieldId, holder);
      const help = texts("p", field.help ?? "", "bd-cms-help");
      help.id = id + "-help";
      const error = texts("p", "", "bd-cms-error");
      error.id = id + "-error";
      error.hidden = true;
      error.setAttribute("role", "alert");
      errors.set(field.fieldId, error);
      if (field.type === "radio") {
        const group = texts("div", "", "bd-cms-choices");
        group.setAttribute("data-cms-radio", "");
        holder.append(group);
        controls.set(field.fieldId, []);
      } else {
        const control = doc.createElement(
          field.type === "textarea"
            ? "textarea"
            : field.type === "select"
              ? "select"
              : "input",
        ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (control.tagName === "INPUT")
          (control as HTMLInputElement).type = field.type;
        control.id = id;
        control.name = field.fieldId;
        control.required = Boolean(field.validation?.required);
        if (field.type === "checkbox")
          (control as HTMLInputElement).checked =
            values[field.fieldId] === true;
        else control.value = String(values[field.fieldId] ?? "");
        if (field.placeholder && field.type !== "select")
          control.setAttribute("placeholder", field.placeholder);
        for (const [name, value] of Object.entries(field.validation ?? {}))
          if (name !== "required")
            control.setAttribute(name.toLowerCase(), String(value));
        control.setAttribute("aria-describedby", help.id + " " + error.id);
        control.addEventListener("change", () => {
          readControl(field, control);
          changed(field.fieldId);
        });
        control.addEventListener("input", () => {
          readControl(field, control);
        });
        holder.append(control);
        controls.set(field.fieldId, [control]);
      }
      if (field.options) {
        if (!Array.isArray(field.options) && field.options.searchable) {
          const search = doc.createElement("input");
          search.type = "search";
          search.placeholder = t("Seçeneklerde ara");
          search.setAttribute(
            "aria-label",
            field.label + t(" seçeneklerinde ara"),
          );
          const button = doc.createElement("button");
          button.type = "button";
          button.textContent = "Ara";
          button.addEventListener("click", () => {
            void load(field, search.value);
          });
          holder.append(search, button);
        }
        const optionStatus = texts("p", "", "bd-cms-help");
        optionStatus.setAttribute("data-cms-option-status", "");
        optionStatus.setAttribute("role", "status");
        const more = doc.createElement("button");
        more.type = "button";
        more.textContent = t("Daha fazla seçenek");
        more.hidden = true;
        more.setAttribute("data-cms-more", "");
        holder.append(optionStatus, more);
      }
      holder.append(help, error);
      grid.append(holder);
    }
    for (const field of definition.fields)
      if (field.options) {
        if (Array.isArray(field.options)) {
          optionValues[field.fieldId] = field.options;
          renderOptions(field);
        } else void load(field);
      }
    status.textContent =
      services.submissionUnavailable ??
      (services.mode === "editor"
        ? t("Alanlar CMS tarafından yönetilir. Denemek için Önizle’yi açın.")
        : services.mode === "preview" && !services.allowPreviewSubmission
          ? t("Önizleme: bilgiler gönderilmez ve kaydedilmez.")
          : "");
    updateDisabled();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (
        services.submissionUnavailable ||
        services.mode === "editor" ||
        submitting ||
        completed ||
        pending.size ||
        failed.size
      )
        return;
      const messages = services.validateValues(
        definition,
        values,
        optionValues,
      );
      showErrors(messages);
      if (Object.keys(messages).length) {
        controls.get(Object.keys(messages)[0]!)?.[0]?.focus();
        status.textContent = t("İşaretli alanları kontrol edin.");
        return;
      }
      if (services.mode === "preview" && !services.allowPreviewSubmission) {
        status.textContent =
          t("Önizleme tamamlandı. Bilgiler gönderilmedi ve kaydedilmedi.");
        return;
      }
      const nextFingerprint = JSON.stringify({
        values,
        binding,
        action: definition.action,
      });
      if (fingerprint !== nextFingerprint) {
        submissionId = uuid();
        fingerprint = nextFingerprint;
      }
      submitting = true;
      status.textContent = t("Gönderiliyor…");
      updateDisabled();
      try {
        const result = await services.execute(
          definition,
          binding,
          { ...values },
          submissionId,
          abort.signal,
        );
        if (disposed) return;
        if (
          !result ||
          typeof result !== "object" ||
          (result.kind === "accepted" &&
            typeof result.receiptId !== "string") ||
          (result.kind === "validationError" &&
            (!result.fieldErrors ||
              typeof result.fieldErrors !== "object" ||
              !Object.values(result.fieldErrors).every(
                (messages) =>
                  Array.isArray(messages) &&
                  messages.every((message) => typeof message === "string"),
              ))) ||
          (result.kind === "schemaChanged" &&
            typeof result.message !== "string") ||
          (result.kind === "redirect" && typeof result.url !== "string")
        )
          throw new Error(t("Sunucu geçersiz bir form sonucu döndürdü."));
        if (result.kind === "validationError") {
          showErrors(result.fieldErrors);
          status.textContent =
            result.message ?? t("İşaretli alanları kontrol edin.");
          controls.get(Object.keys(result.fieldErrors)[0] ?? "")?.[0]?.focus();
        } else if (result.kind === "schemaChanged") {
          completed = true;
          status.textContent = result.message;
        } else if (result.kind === "accepted") {
          completed = true;
          status.textContent =
            result.message ??
            t("Başvurunuz alındı. Referans: ") + result.receiptId;
        } else if (result.kind === "redirect") {
          const url = new URL(result.url, doc.baseURI);
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.origin !== new URL(doc.baseURI).origin
          )
            throw new Error(t("Yönlendirme aynı site içinde olmalıdır."));
          completed = true;
          services.navigate
            ? services.navigate(url.href)
            : doc.defaultView?.location.assign(url.href);
        } else throw new Error(t("Sunucu tanınmayan bir form sonucu döndürdü."));
      } catch (error) {
        if (!disposed)
          status.textContent =
            failMessage(error) +
            " Bilgiler bu oturumda korunuyor; yeniden deneyebilirsiniz.";
      } finally {
        submitting = false;
        if (!disposed) updateDisabled();
      }
    });
  })().catch((error) => {
    if (!disposed) {
      status.textContent = failMessage(error);
      status.setAttribute("role", "alert");
    }
  });
  return () => {
    disposed = true;
    abort.abort();
    for (const request of requests.values()) request.abort();
    root.replaceChildren(...original);
  };
}
