import type {
  ContentRecord,
  PageResult,
  RepeaterDefinition,
  SourceBinding,
} from "../../contracts/src/index.ts";

export interface CollectionRuntimeConfig {
  binding: SourceBinding;
  schema: RepeaterDefinition;
  templates: Record<string, string>;
}
export interface CollectionRuntimeServices {
  load(
    values: Record<string, string>,
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<PageResult<ContentRecord>>;
  syncUrl?: boolean;
}

/** Self-contained so the same implementation can be embedded in standalone HTML. */
export function mountCollection(
  root: HTMLElement,
  config: CollectionRuntimeConfig,
  services: CollectionRuntimeServices,
): () => void {
  const doc = root.ownerDocument,
    win = doc.defaultView!;
  const node = (scope: ParentNode, id: string): HTMLElement | undefined =>
    [...scope.querySelectorAll<HTMLElement>("[data-bd-node]")].find(
      (el) => el.dataset.bdNode === id,
    );
  const container = config.schema.mappingTarget
    ? node(root, config.schema.mappingTarget.containerNodeId)
    : undefined;
  if (!container) throw new Error("Canlı liste kapsayıcısı bulunamadı.");
  const original = container.innerHTML;
  const originalBusy = container.getAttribute("aria-busy");
  const form = doc.createElement("form"),
    status = doc.createElement("p"),
    controls = doc.createElement("div");
  form.className = "bd-collection-filters";
  controls.className = "bd-collection-controls";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const namespace = "bd." + config.binding.bindingId + ".";
  const fields = new Map<string, HTMLInputElement>();
  for (const filter of config.binding.live?.filters ?? []) {
    const label = doc.createElement("label"),
      input = doc.createElement("input"),
      span = doc.createElement("span");
    span.textContent = filter.label;
    input.name = filter.fieldId;
    input.type = "search";
    input.maxLength = 300;
    label.append(span, input);
    form.append(label);
    fields.set(filter.fieldId, input);
  }
  const button = (text: string) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = text;
    return b;
  };
  const apply = button("Filtrele"),
    prev = button("Önceki"),
    next = button("Sonraki"),
    retry = button("Yeniden dene");
  apply.type = "submit";
  if (fields.size) form.append(apply);
  retry.hidden = true;
  controls.append(prev, next, retry);
  container.before(form);
  container.after(status, controls);
  let stopped = false,
    sequence = 0,
    abort: AbortController | undefined,
    current: string | undefined,
    nextCursor: string | null = null;
  let previous: Array<string | undefined> = [];
  const sync =
    services.syncUrl !== false && config.binding.live?.syncUrl !== false;
  function readUrl() {
    const url = new URL(win.location.href);
    for (const [key, input] of fields)
      input.value = url.searchParams.get(namespace + key) ?? "";
    current = url.searchParams.get(namespace + "cursor") ?? undefined;
    const saved = win.history.state?.[namespace]?.previous;
    previous =
      Array.isArray(saved) &&
      saved.every((value) => value === undefined || typeof value === "string")
        ? saved
        : [];
  }
  function writeUrl() {
    if (!sync) return;
    const url = new URL(win.location.href);
    for (const [key, input] of fields) {
      if (input.value.trim())
        url.searchParams.set(namespace + key, input.value.trim());
      else url.searchParams.delete(namespace + key);
    }
    if (current) url.searchParams.set(namespace + "cursor", current);
    else url.searchParams.delete(namespace + "cursor");
    const state =
      win.history.state && typeof win.history.state === "object"
        ? win.history.state
        : {};
    win.history.pushState(
      { ...state, [namespace]: { previous: [...previous] } },
      "",
      url,
    );
  }
  const path = (value: unknown, key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (item, part) =>
          item && typeof item === "object" && Object.hasOwn(item, part)
            ? (item as Record<string, unknown>)[part]
            : undefined,
        value,
      );
  const safeUrl = (value: string) => {
    if (/[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith("//"))
      return false;
    try {
      return ["http:", "https:", "mailto:", "tel:"].includes(
        new URL(value, doc.baseURI).protocol,
      );
    } catch {
      return false;
    }
  };
  function row(
    values: Record<string, unknown>,
    schema: RepeaterDefinition,
    id: string,
    depth = 0,
    prefix = schema.key,
  ): HTMLElement {
    if (depth >= 8) throw new Error("Liste derinliği desteklenmiyor.");
    const template = doc.createElement("template");
    template.innerHTML = config.templates[schema.repeaterId] ?? "";
    const item = template.content.firstElementChild as HTMLElement | null;
    if (!item) throw new Error("Liste öğesi şablonu bulunamadı.");
    const targets = (id: string) =>
      [item, ...item.querySelectorAll<HTMLElement>("[data-bd-node]")].filter(
        (el) => el.dataset.bdNode === id,
      );
    item.dataset.bdItem = id;
    const relativePrefix = depth
      ? prefix.split(".").slice(-depth).join(".")
      : "";
    for (const field of schema.itemFields) {
      const mapping = [
        prefix ? prefix + "." + field.key : "",
        relativePrefix ? relativePrefix + "." + field.key : "",
        schema.repeaterId + "." + field.key,
        field.fieldId,
        field.key,
      ]
        .filter(Boolean)
        .map((key) => config.binding.fieldMappings.find((m) => m.to === key))
        .find(Boolean);
      const value = mapping
        ? path(values, mapping.from)
        : (values[field.key] ?? field.defaultValue);
      if (value !== null && value !== undefined && typeof value === "object")
        throw new Error("Liste alanı metin veya sayı olmalı.");
      if (
        field.required &&
        (value === null || value === undefined || value === "")
      )
        throw new Error("Gerekli liste alanı eksik: " + field.label);
      if (value !== null && value !== undefined && value !== "") {
        if (
          field.type === "number" &&
          (typeof value !== "number" || !Number.isFinite(value))
        )
          throw new Error("Liste sayısal alanı geçersiz: " + field.label);
        if (field.type === "boolean" && typeof value !== "boolean")
          throw new Error("Liste mantıksal alanı geçersiz: " + field.label);
        if (
          !["number", "boolean"].includes(field.type) &&
          typeof value !== "string"
        )
          throw new Error("Liste metin alanı geçersiz: " + field.label);
        const size = typeof value === "number" ? value : String(value).length;
        if (
          (field.min !== undefined && size < field.min) ||
          (field.max !== undefined && size > field.max)
        )
          throw new Error("Liste alanı sınırları geçersiz: " + field.label);
        if (
          ["url", "image", "video"].includes(field.type) &&
          !safeUrl(String(value))
        )
          throw new Error("Liste bağlantısı geçersiz.");
      }
      for (const el of targets(field.mappingTarget.nodeId)) {
        const text = String(value ?? ""),
          operation = field.mappingTarget.operation,
          property = field.mappingTarget.property ?? "";
        if (operation === "attribute") {
          if (
            !/^(href|src|alt|title|target|rel|aria-label|width|height)$/.test(
              property,
            )
          )
            throw new Error(
              "Canlı listede desteklenmeyen nitelik: " + property,
            );
          if (
            (property === "href" || property === "src") &&
            text &&
            !safeUrl(text)
          )
            throw new Error("Liste bağlantısı geçersiz.");
          el.setAttribute(property, text);
          if (property === "target" && text === "_blank")
            el.setAttribute("rel", "noopener noreferrer");
        } else if (operation === "booleanVisibility")
          el.hidden = value === true;
        else if (operation === "safeRichText") {
          const source = doc.createElement("template");
          source.innerHTML = text;
          const clean = (value: Node): Node => {
            if (value.nodeType === 3)
              return doc.createTextNode(value.textContent ?? "");
            const tag = (value as Element).tagName?.toLowerCase();
            const target =
              tag &&
              [
                "p",
                "br",
                "strong",
                "em",
                "b",
                "i",
                "u",
                "a",
                "ul",
                "ol",
                "li",
                "blockquote",
              ].includes(tag)
                ? doc.createElement(tag)
                : doc.createDocumentFragment();
            if (tag === "a" && target.nodeType === 1) {
              const href = (value as Element).getAttribute("href");
              if (href && safeUrl(href))
                (target as Element).setAttribute("href", href);
            }
            for (const child of value.childNodes)
              target.appendChild(clean(child));
            return target;
          };
          el.replaceChildren(...[...source.content.childNodes].map(clean));
        } else if (operation === "text") el.textContent = text;
        else if (operation === "textSegment" && /^\d+$/.test(property)) {
          const child = el.childNodes[Number(property)];
          if (child?.nodeType !== 3)
            throw new Error("Liste metin parçası bulunamadı.");
          child.textContent = text;
        } else
          throw new Error(
            "Canlı listede bu alan eşlemesi desteklenmiyor: " + operation,
          );
      }
    }
    for (const child of schema.childRepeaters ?? []) {
      const target = child.mappingTarget
        ? targets(child.mappingTarget.containerNodeId)[0]
        : undefined;
      if (!target) throw new Error("Alt liste kapsayıcısı bulunamadı.");
      const mapping =
        config.binding.fieldMappings.find(
          (m) => m.to === (prefix ? prefix + "." + child.key : child.key),
        ) ??
        config.binding.fieldMappings.find(
          (m) =>
            m.to ===
            (relativePrefix ? relativePrefix + "." + child.key : child.key),
        ) ??
        config.binding.fieldMappings.find((m) => m.to === child.key);
      const raw = path(values, mapping?.from ?? child.key) ?? [];
      if (!Array.isArray(raw) || raw.length > child.maxItems)
        throw new Error("Alt liste sınırı geçersiz.");
      target.replaceChildren(
        ...raw.map((value, index) => {
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error("Alt liste kaydı geçersiz.");
          return row(
            value,
            child,
            id + "-" + index,
            depth + 1,
            prefix ? prefix + "." + child.key : child.key,
          );
        }),
      );
    }
    // Every clone owns its DOM IDs and references, even when the template uses authored IDs.
    const ids = new Map<string, string>();
    for (const el of [item, ...item.querySelectorAll<HTMLElement>("[id]")])
      if (el.id) {
        const old = el.id;
        el.id =
          "bd-row-" +
          encodeURIComponent(config.binding.bindingId) +
          "-" +
          encodeURIComponent(id) +
          "-" +
          old;
        ids.set(old, el.id);
      }
    for (const el of [item, ...item.querySelectorAll<HTMLElement>("*")])
      for (const name of [
        "for",
        "aria-controls",
        "aria-labelledby",
        "aria-describedby",
        "href",
      ]) {
        const value = el.getAttribute(name);
        if (value)
          el.setAttribute(
            name,
            name === "href" && value.startsWith("#")
              ? "#" + (ids.get(value.slice(1)) ?? value.slice(1))
              : value
                  .split(" ")
                  .map((x) => ids.get(x) ?? x)
                  .join(" "),
          );
      }
    return item;
  }
  function paintBusy(busy: boolean) {
    container!.setAttribute("aria-busy", String(busy));
    apply.disabled = busy;
    prev.disabled = busy || (!previous.length && !current);
    prev.textContent = current && !previous.length ? "İlk sayfa" : "Önceki";
    next.disabled = busy || !nextCursor;
    retry.disabled = busy;
  }
  async function load() {
    const started = ++sequence;
    abort?.abort();
    abort = new AbortController();
    paintBusy(true);
    status.textContent = "Yükleniyor…";
    retry.hidden = true;
    try {
      const values = Object.fromEntries(
        [...fields].map(([key, input]) => [key, input.value]),
      );
      const result = await services.load(values, current, abort.signal);
      if (stopped || sequence !== started) return;
      if (
        !Array.isArray(result.items) ||
        result.items.length > (config.binding.query?.limit ?? 0) ||
        (result.nextCursor !== null && typeof result.nextCursor !== "string") ||
        (current && result.nextCursor === current)
      )
        throw new Error("CMS sayfalama yanıtı geçersiz.");
      const seen = new Set<string>();
      const rows = result.items.map((record) => {
        if (
          !record ||
          typeof record.recordId !== "string" ||
          seen.has(record.recordId) ||
          !record.values ||
          typeof record.values !== "object"
        )
          throw new Error("CMS liste kaydı geçersiz.");
        seen.add(record.recordId);
        return row(record.values, config.schema, record.recordId);
      });
      container!.replaceChildren(...rows);
      nextCursor = result.nextCursor;
      status.textContent = rows.length
        ? `${rows.length} kayıt gösteriliyor.`
        : "Sonuç bulunamadı.";
    } catch (error) {
      if (stopped || sequence !== started) return;
      status.textContent =
        error instanceof Error ? error.message : "Liste yüklenemedi.";
      retry.hidden = false;
      nextCursor = null;
    } finally {
      if (!stopped && sequence === started) paintBusy(false);
    }
  }
  const submit = (event: Event) => {
    event.preventDefault();
    current = undefined;
    previous = [];
    writeUrl();
    void load();
  };
  const forward = () => {
    if (!nextCursor) return;
    previous.push(current);
    current = nextCursor;
    writeUrl();
    void load();
  };
  const backward = () => {
    if (!previous.length && !current) return;
    current = previous.pop();
    writeUrl();
    void load();
  };
  const refresh = () => {
    void load();
  };
  const pop = () => {
    readUrl();
    void load();
  };
  if (sync) {
    readUrl();
    win.addEventListener("popstate", pop);
  }
  form.addEventListener("submit", submit);
  next.addEventListener("click", forward);
  prev.addEventListener("click", backward);
  retry.addEventListener("click", refresh);
  void load();
  return () => {
    stopped = true;
    ++sequence;
    abort?.abort();
    win.removeEventListener("popstate", pop);
    form.removeEventListener("submit", submit);
    next.removeEventListener("click", forward);
    prev.removeEventListener("click", backward);
    retry.removeEventListener("click", refresh);
    form.remove();
    status.remove();
    controls.remove();
    container.innerHTML = original;
    if (originalBusy === null) container.removeAttribute("aria-busy");
    else container.setAttribute("aria-busy", originalBusy);
  };
}
