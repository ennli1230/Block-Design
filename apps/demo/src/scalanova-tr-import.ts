import type {
  BlockDefinitionVersion,
  BlockInstance,
  EditorDocument,
  JsonValue,
  PageTemplateDefinition,
  SharedRegionDefinition,
  VersionRef,
} from "@blockdesign/contracts";
import {
  applyTemplateData,
  createEmptyDocument,
  makeInstance,
  validateDocument,
} from "@blockdesign/core";
import { createCmsFormDefinition } from "@blockdesign/core";
import {
  HttpBlockLibraryAdapter,
  HttpDesignSystemAdapter,
  HttpSharedRegionAdapter,
  HttpStorageAdapter,
  HttpTemplateAdapter,
  AdapterRequestError,
} from "@blockdesign/adapters";
import {
  PAGE_PATHS,
  createSectionBlock,
  safeAttributes,
  definitionSignature,
  stableHash,
  isIgnoredElement,
} from "./scalanova-tour-import";
import { saveBaseView } from "./workspace";
import { scalanovaBehaviors } from "./scalanova-runtime";
import { connectCmsMenuRegion } from './cms-navigation';

import { TR_SYSTEM } from './scalanova-constants';
export { TR_SYSTEM } from './scalanova-constants';
const HEADER: VersionRef = { id: "region.sn-tr.header", version: "1.1.0" },
  FOOTER: VersionRef = { id: "region.sn-tr.footer", version: "1.1.0" };
const BASE = "base-view.sn-tr";
const familyNames: Record<string, string> = {
  home: "Ana sayfa",
  list: "Liste sayfası",
  detail: "Detay sayfası",
  article: "Rehber yazısı",
  legal: "Yasal bilgiler",
  corporate: "Kurumsal ve talep",
};
function family(path: string) {
  if (path === "tr/index.html") return "home";
  if (
    /kvkk|cerez-politikasi|kullanim-kosullari|erisilebilirlik|acente-ve-belgeler/.test(
      path,
    )
  )
    return "legal";
  if (/^tr\/rehber\/[^/]+\//.test(path)) return "article";
  if (/^tr\/(?:destinasyonlar|turlar|aktiviteler)\/[^/]+\//.test(path))
    return "detail";
  if (
    /^tr\/(?:rehber|destinasyonlar|turlar|aktiviteler|liman-turlari)\/index/.test(
      path,
    )
  )
    return "list";
  return "corporate";
}
const listClasses =
  /\b(?:faq-list|service-grid|journal-grid|destination-grid|activity-list|place-list|tour-grid|stat-strip|seo-link-grid|recommended-track|recommended-grid|route-list|tour-facts|included-list|highlights-list|journal-toc|footer-legal)\b/;
function atomicKind(el: Element): string | null {
  if (el.matches("[data-hero-slider]")) return "Slider";
  if (el.localName === "form")
    return el.matches("[data-tour-search]") ? "Tur arama formu" : "Talep formu";
  if (el.classList.contains("faq-list")) return "Akordeon";
  if (listClasses.test(el.getAttribute("class") ?? "") || el.matches("ul,ol"))
    return "Liste";
  if (el.matches("nav") && !el.matches(".nav-shell")) return "Gezinme";
  if (/^h[1-6]$/.test(el.localName)) return "Başlık";
  if (el.localName === "p")
    return el.classList.contains("eyebrow") ? "Üst başlık" : "Açıklama";
  if (el.localName === "img" || el.localName === "figure") return "Görsel";
  if (el.localName === "a") return "Bağlantı";
  return null;
}
const textKinds = new Set(["Başlık", "Üst başlık", "Açıklama"]);
const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
const listNames: Record<string, string> = {
  "journal-grid": "Rehber kartları",
  "service-grid": "Hizmet kartları",
  "destination-grid": "Destinasyon kartları",
  "activity-list": "Aktivite kartları",
  "place-list": "Gezilecek yerler",
  "tour-grid": "Tur kartları",
  "stat-strip": "İstatistikler",
  "seo-link-grid": "İlgili sayfalar",
  "recommended-track": "Önerilen turlar",
  "recommended-grid": "Önerilen içerikler",
  "route-list": "Tur rotası",
  "tour-facts": "Tur bilgileri",
  "included-list": "Dahil olan hizmetler",
  "highlights-list": "Öne çıkanlar",
  "journal-toc": "İçindekiler",
};
function catalogName(el: Element, kind: string, path: string): string {
  if (kind === "Liste")
    return (
      Object.entries(listNames).find(([name]) =>
        el.classList.contains(name),
      )?.[1] ??
      (el.classList.contains("tour-visit-list")
        ? "Ziyaret noktaları"
        : el.classList.contains("clean-list--excluded")
          ? "Dahil olmayan hizmetler"
          : el.classList.contains("clean-list")
            ? "Dahil olan hizmetler"
            : el.classList.contains("route")
              ? "Ayrıntılı tur rotası"
              : el.localName === "ol"
                ? "Sıralı liste"
                : "Madde listesi")
    );
  if (kind === "Gezinme")
    return el.classList.contains("activity-breadcrumb")
      ? "Aktivite sayfa yolu"
      : el.classList.contains("destination-breadcrumbs")
        ? "Destinasyon sayfa yolu"
        : el.classList.contains("tour-breadcrumbs")
          ? "Tur sayfa yolu"
          : el.querySelectorAll("a").length > 2
            ? "Rehber yazısı sayfa yolu"
            : "Rehber sayfa yolu";
  if (kind === "Talep formu")
    return /b2b/.test(path)
      ? "Acente iş ortaklığı formu"
      : /iletisim/.test(path)
        ? "İletişim formu"
        : /kisiye-ozel/.test(path)
          ? "Kişiye özel seyahat formu"
          : /transferler/.test(path)
            ? "Transfer talep formu"
            : /liman-turlari/.test(path)
              ? "Liman turu talep formu"
              : "Tur rezervasyon formu";
  if (kind === "Bağlantı")
    return el.querySelector("img")
      ? "Görsel bağlantısı"
      : el.classList.contains("guide-card")
        ? "Rehber bağlantı kartı"
        : el.classList.contains("button--bronze")
          ? "Bronz eylem bağlantısı"
          : el.classList.contains("button")
            ? "Eylem bağlantısı"
            : el.classList.contains("text-link")
              ? "Ok bağlantılı metin"
              : "Satır içi bağlantı";
  if (kind === "Görsel")
    return el.classList.contains("destination-story-photo")
      ? "Fotoğraf ve açıklama"
      : el.classList.contains("journal-cover")
        ? "Rehber kapak görseli"
        : el.classList.contains("tour-overview-media")
          ? "Tur tanıtım görseli"
          : "Görsel";
  return kind;
}
function namespace(def: BlockDefinitionVersion) {
  const prefix = def.ref.id.replace(/\W/g, "-");
  const walk = (value: JsonValue): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    const attrs = value.attributes;
    if (
      attrs &&
      typeof attrs === "object" &&
      !Array.isArray(attrs) &&
      typeof attrs["data-bd-node"] === "string"
    )
      attrs["data-bd-node"] = prefix + ":" + attrs["data-bd-node"];
    if (value.components) walk(value.components);
  };
  walk(def.componentTemplate);
  def.fields.forEach(
    (f) => (f.mappingTarget.nodeId = prefix + ":" + f.mappingTarget.nodeId),
  );
  const rows = (items: BlockDefinitionVersion["repeaters"]) => {
    for (const r of items) {
      if (r.mappingTarget) {
        r.mappingTarget.containerNodeId =
          prefix + ":" + r.mappingTarget.containerNodeId;
        r.mappingTarget.itemNodeId = prefix + ":" + r.mappingTarget.itemNodeId;
      }
      r.itemFields.forEach(
        (f) => (f.mappingTarget.nodeId = prefix + ":" + f.mappingTarget.nodeId),
      );
      rows(r.childRepeaters ?? []);
    }
  };
  rows(def.repeaters);
}
function attrs(template: JsonValue): Record<string, JsonValue> {
  return (template as Record<string, JsonValue>).attributes as Record<
    string,
    JsonValue
  >;
}
function pinned(region: SharedRegionDefinition): JsonValue {
  const root = structuredClone(region.componentTemplate) as Record<
    string,
    JsonValue
  >;
  root.attributes = {
    ...attrs(root),
    "data-bd-region-ref": `${region.ref.id}@${region.ref.version}`,
    "data-bd-locked": "true",
  };
  return root;
}

export async function buildAtomicTrImport(
  progress: (message: string) => void = () => {},
) {
  const sources = [] as { path: string; doc: Document }[];
  for (const path of PAGE_PATHS) {
    const response = await fetch("/scalanova-tour/" + path);
    if (!response.ok) throw Error("Kaynak okunamadı: " + path);
    sources.push({
      path,
      doc: new DOMParser().parseFromString(await response.text(), "text/html"),
    });
  }
  const home = sources.find((s) => s.path === "tr/index.html")!;
  const regions: SharedRegionDefinition[] = [];
  for (const [tag, ref] of [
    ["header", HEADER],
    ["footer", FOOTER],
  ] as const) {
    const el = home.doc.querySelector(`${tag}.site-${tag}`);
    if (!el) throw Error("Ortak bölge eksik: " + tag);
    const converted = createSectionBlock(el, "tr/index.html", 0);
    converted.definition.ref = ref;
    namespace(converted.definition);
    const rootAttrs = attrs(converted.definition.componentTemplate);
    delete rootAttrs["data-bd-import"];
    delete rootAttrs["data-bd-container"];
    if (tag === "header") rootAttrs["data-sn-runtime"] = "true";
    regions.push(connectCmsMenuRegion({
      ref,
      designSystemRef: TR_SYSTEM,
      name: tag === "header" ? "Scala Nova · Header" : "Scala Nova · Footer",
      region: tag,
      componentTemplate: converted.definition.componentTemplate,
      fields: converted.definition.fields,
      repeaters: converted.definition.repeaters,
      defaultData: converted.data,
      sourceBindings: [],
      archived: false,
    }));
  }
  const definitions = new Map<string, BlockDefinitionVersion>(),
    templates = new Map<string, PageTemplateDefinition>(),
    pages: EditorDocument[] = [];
  for (const source of sources) {
    progress("HTML eşleniyor: " + source.path);
    const main = source.doc.querySelector("main");
    if (!main) throw Error("Ana içerik eksik: " + source.path);
    const instances: BlockInstance[] = [];
    function textBlock(kind: string, text: string): JsonValue {
      const signature = "text:" + kind;
      let definition = definitions.get(signature);
      if (!definition) {
        const id =
          kind === "Başlık"
            ? "heading"
            : kind === "Üst başlık"
              ? "eyebrow"
              : "description";
        const sample =
          kind === "Açıklama"
            ? lorem
            : kind === "Başlık"
              ? "Örnek başlık"
              : "Örnek üst başlık";
        definition = {
          ref: { id: "block.sn-tr." + id, version: "1.0.0" },
          designSystemRef: TR_SYSTEM,
          name: kind,
          category: "Metin",
          description:
            kind === "Açıklama"
              ? "Tüm paragraflarda kullanılan tek açıklama alanı."
              : "Sayfa yerleşiminin tipografisini kullanan ortak metin alanı.",
          preview: "custom",
          componentTemplate: {
            type: "default",
            tagName: "span",
            attributes: { "data-bd-node": "text" },
            components: [{ type: "textnode", content: sample }],
          },
          fields: [
            {
              fieldId: "field." + id,
              key: "text",
              label: kind,
              type: kind === "Açıklama" ? "textarea" : "text",
              required: false,
              defaultValue: sample,
              mappingTarget: { nodeId: "text", operation: "text" },
            },
          ],
          repeaters: [],
          defaultData: { text: sample },
          stylePolicy: {
            allowedProperties: [
              "color",
              "font-size",
              "font-weight",
              "line-height",
              "text-align",
            ],
            structuralEdits: false,
          },
          sourceCapabilities: {
            modes: ["manual", "selection"],
            target: ["field"],
          },
          archived: false,
        };
        namespace(definition);
        definitions.set(signature, definition);
      }
      const instance = makeInstance(definition);
      instance.manualData = { text };
      instances.push(instance);
      return {
        type: "default",
        tagName: "span",
        attributes: {
          "data-bd-placeholder-id": instance.instanceId,
          "data-bd-placeholder-definition": `${definition.ref.id}@${definition.ref.version}`,
        },
        components: [],
      };
    }
    // Typography belongs to the source layout; text values share one catalog schema.
    // Keep inline emphasis and links as layout nodes, including mixed paragraphs.
    async function textLayout(
      el: Element,
      kind: string,
      path: string,
    ): Promise<JsonValue> {
      const children: JsonValue[] = [];
      let index = 0;
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const value = child.textContent ?? "";
          children.push(
            value.trim()
              ? textBlock(kind, value)
              : { type: "textnode", content: value },
          );
        } else if (child instanceof Element && !isIgnoredElement(child))
          children.push(await textLayout(child, kind, path + "-" + ++index));
      }
      const attributes = safeAttributes(el, source.path);
      attributes["data-bd-node"] = "layout:" + source.path + ":" + path;
      return {
        type: "default",
        tagName: el.localName,
        attributes,
        components: children,
      };
    }
    async function convert(el: Element, path = "1"): Promise<JsonValue> {
      if (el.localName === "form") {
        let definition = definitions.get("cms-form");
        if (!definition) {
          definition = createCmsFormDefinition(TR_SYSTEM);
          definitions.set("cms-form", definition);
        }
        const instance = makeInstance(definition);
        const id = el.matches("[data-tour-search]")
          ? "search"
          : /b2b/.test(source.path)
            ? "partner"
            : /iletisim/.test(source.path)
              ? "contact"
              : /kisiye-ozel/.test(source.path)
                ? "travel"
                : /transferler/.test(source.path)
                  ? "transfer"
                  : /liman-turlari/.test(source.path)
                    ? "shore"
                    : "booking";
        instance.formBinding = {
          providerId: "demo-cms",
          formRef: { id, version: "1.1.0" },
          appearance: id === "search" ? "inline-search" : "stacked",
          contextBindings: [],
        };
        instances.push(instance);
        const shell = safeAttributes(el, source.path);
        delete shell["data-demo-form"];
        delete shell["data-tour-search"];
        return {
          type: "default",
          tagName: "div",
          attributes: shell,
          style: { display: "block" },
          components: [
            {
              type: "default",
              tagName: "div",
              attributes: {
                "data-bd-placeholder-id": instance.instanceId,
                "data-bd-placeholder-definition": `${definition.ref.id}@${definition.ref.version}`,
              },
              components: [],
            },
          ],
        };
      }
      const kind = atomicKind(el);
      if (kind && textKinds.has(kind)) return textLayout(el, kind, path);
      if (kind) {
        const { definition, data } = createSectionBlock(
          el,
          source.path,
          instances.length + 1,
        );
        definition.designSystemRef = TR_SYSTEM;
        definition.name = kind;
        if (el.localName === "img") {
          // Fetch priority is a loading hint, not a different kind of image block.
          attrs(definition.componentTemplate).loading = "lazy";
          delete attrs(definition.componentTemplate).fetchpriority;
        }
        definition.name = catalogName(el, kind, source.path);
        definition.category = kind.includes("formu")
          ? "Formlar"
          : kind === "Slider" || kind === "Görsel"
            ? "Medya"
            : kind === "Akordeon"
              ? "Etkileşim"
              : kind === "Liste" || el.classList.contains("guide-card")
                ? "Kartlar ve listeler"
                : "Gezinme ve eylemler";
        definition.description = `Scala Nova ${definition.name.toLocaleLowerCase("tr-TR")} öğesi. Yerleşim sayfa şablonundadır; içerik bu alanlardan yönetilir.`;
        definition.stylePolicy = {
          allowedProperties: [
            "color",
            "background-color",
            "background-image",
            "padding",
            "margin",
            "font-size",
            "font-weight",
            "text-align",
            "border",
            "border-radius",
            "gap",
            "width",
            "max-width",
            "min-height",
          ],
          structuralEdits: false,
        };
        definition.sourceCapabilities = {
          modes: ["manual", "selection", "query"],
          target: ["block", "field", "repeater"],
        };
        delete attrs(definition.componentTemplate)["data-bd-container"];
        // Preserve original cross-component anchors (forms and route panels).
        attrs(definition.componentTemplate)["data-bd-import"] =
          "scalanova-tour-tr";
        if (kind === "Slider") {
          attrs(definition.componentTemplate)["data-sn-slider"] = "true";
          definition.behavior = {
            pluginId: "scalanova.hero",
            settings: structuredClone(
              scalanovaBehaviors.find((p) => p.id === "scalanova.hero")!
                .settings!,
            ),
          };
        }
        const signature = kind + ":" + definitionSignature(definition);
        let existing = definitions.get(signature);
        if (!existing) {
          definition.ref = {
            id: "block.sn-tr." + (await stableHash(signature)),
            version: "1.0.0",
          };
          namespace(definition);
          definitions.set(signature, definition);
          existing = definition;
        }
        const instance = makeInstance(existing);
        instance.manualData = structuredClone(data);
        instances.push(instance);
        return {
          type: "default",
          tagName: el.localName,
          attributes: {
            "data-bd-placeholder-id": instance.instanceId,
            "data-bd-placeholder-definition": `${existing.ref.id}@${existing.ref.version}`,
          },
          components: [],
        };
      }
      const attributes = safeAttributes(el, source.path);
      attributes["data-bd-node"] = "layout:" + source.path + ":" + path;
      if (el.matches("section,article,main,div"))
        attributes["data-bd-container"] = "true";
      const children: JsonValue[] = [];
      let index = 0;
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (child.textContent)
            children.push({ type: "textnode", content: child.textContent });
        } else if (child instanceof Element && !isIgnoredElement(child))
          children.push(await convert(child, path + "-" + ++index));
      }
      return {
        type: "default",
        tagName: el.localName,
        attributes,
        components: children,
      };
    }
    const mainTemplate = await convert(main);
    attrs(mainTemplate)["data-bd-template-slot"] = "content-main";
    const pageFamily = family(source.path),
      title = source.doc.title.replace(/\s*[|·]\s*Scala Nova.*$/, "").trim();
    let template = templates.get(pageFamily);
    if (!template) {
      template = {
        ref: { id: "template.sn-tr." + pageFamily, version: "1.3.0" },
        designSystemRef: TR_SYSTEM,
        name: "Scala Nova · " + familyNames[pageFamily],
        description: "Ortak header/footer ve bağımsız içerik bileşenleri.",
        baseViewId: BASE,
        blocks: structuredClone(instances),
        layout: {
          pages: [
            {
              name: title,
              component: {
                type: "wrapper",
                components: [
                  pinned(regions[0]!),
                  structuredClone(mainTemplate),
                  pinned(regions[1]!),
                ],
              },
            },
          ],
        },
        contentSlotId: "content-main",
        sharedRegionRefs: [HEADER, FOOTER],
        allowedBlockCategories: [],
        mandatoryBlockIds: [],
        archived: false,
      };
      templates.set(pageFamily, template);
    }
    const document = createEmptyDocument();
    document.designSystemRef = TR_SYSTEM;
    document.templateRef = template.ref;
    document.sharedRegionRefs = [HEADER, FOOTER];
    document.blocks = instances;
    document.projectData = {
      pages: [
        {
          name: title,
          component: {
            type: "wrapper",
            components: [
              pinned(regions[0]!),
              mainTemplate,
              pinned(regions[1]!),
            ],
          },
        },
      ],
    };
    document.sharedRegionData = Object.fromEntries(
      regions.map((r) => {
        const el = source.doc.querySelector(`${r.region}.site-${r.region}`);
        return [
          `${r.ref.id}@${r.ref.version}`,
          el
            ? createSectionBlock(el, source.path, 0).data
            : structuredClone(r.defaultData ?? {}),
        ];
      }),
    );
    document.localization = {
      locale: "tr",
      pageGroupId: "page.sn-tr." + source.path.replace(/[^a-z0-9]+/g, "-"),
    };
    document.editorState = {
      viewport: "desktop",
      workspaceStage: "page",
      workspaceBaseViewId: BASE,
      workspaceImportedFrom: "/html/" + source.path,
      workspaceImportedVersion: 7,
      cmsFormMigration: 1,
      seo: {
        title: source.doc.title,
        description:
          source.doc
            .querySelector("meta[name=description]")
            ?.getAttribute("content") ?? "",
        canonical:
          source.doc
            .querySelector("link[rel=canonical]")
            ?.getAttribute("href") ?? "",
      },
      sourceMainSections: main.children.length,
    };
    pages.push(document);
  }
  const definitionMap = new Map(
    [...definitions.values()].map((d) => [`${d.ref.id}@${d.ref.version}`, d]),
  );
  for (const [index, page] of pages.entries()) {
    const issues = validateDocument(page, definitionMap);
    if (issues.length) throw Error(issues.map((i) => i.message).join("\n"));
    const instances = new Map(
      page.blocks.map((block) => [block.instanceId, block]),
    );
    function hydrate(value: JsonValue): JsonValue {
      if (Array.isArray(value)) return value.map(hydrate);
      if (!value || typeof value !== "object") return value;
      const attributes = value.attributes as
        | Record<string, JsonValue>
        | undefined;
      const id = attributes?.["data-bd-placeholder-id"];
      if (typeof id === "string") {
        const block = instances.get(id)!;
        const def = definitionMap.get(
          `${block.definitionRef.id}@${block.definitionRef.version}`,
        )!;
        return applyTemplateData(
          def.componentTemplate,
          def.fields,
          def.repeaters,
          block.manualData,
        );
      }
      return {
        ...value,
        ...(value.components ? { components: hydrate(value.components) } : {}),
      };
    }
    const project = page.projectData.pages as Record<string, JsonValue>[];
    const wrapper = project[0]!.component as Record<string, JsonValue>;
    const main = (wrapper.components as JsonValue[])[1]!;
    function modelText(value: JsonValue): string {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return value.map(modelText).join("");
      if (!value || typeof value !== "object") return "";
      if (
        value.attributes &&
        typeof value.attributes === "object" &&
        !Array.isArray(value.attributes) &&
        value.attributes["data-bd-cms-form"]
      )
        return "";
      return typeof value.content === "string"
        ? value.content
        : modelText(value.components ?? []);
    }
    // Source whitespace between separate cards is not visible text content.
    const normalize = (value: string) => value.replace(/\s+/g, "");
    const sourceMain = sources[index]!.doc.querySelector("main")!.cloneNode(
      true,
    ) as Element;
    sourceMain.querySelectorAll("form").forEach((form) => form.remove());
    const actual = normalize(modelText(hydrate(main))),
      expected = normalize(sourceMain.textContent ?? "");
    if (actual !== expected) {
      let at = 0;
      while (
        actual[at] === expected[at] &&
        at < Math.min(actual.length, expected.length)
      )
        at++;
      throw Error(
        "İçerik bütünlüğü kontrolü başarısız: " +
          sources[index]!.path +
          " · " +
          at +
          " · kaynak: " +
          expected.slice(Math.max(0, at - 45), at + 85) +
          " · çıktı: " +
          actual.slice(Math.max(0, at - 45), at + 85),
      );
    }
  }
  return {
    regions,
    blocks: [...definitions.values()],
    templates: [...templates.values()],
    pages,
  };
}

/** Explicit one-time import; HTTP only, no offline fallback and no startup seeding. */
export async function importAtomicTr(
  progress: (message: string) => void = () => {},
) {
  const bundle = await buildAtomicTrImport(progress),
    http = { baseUrl: "/api/v1" };
  const library = new HttpBlockLibraryAdapter(http),
    regions = new HttpSharedRegionAdapter(http),
    templates = new HttpTemplateAdapter(http),
    storage = new HttpStorageAdapter(http),
    design = new HttpDesignSystemAdapter(http);
  async function once(operation: () => Promise<unknown>) {
    try {
      await operation();
    } catch (error) {
      if (!(error instanceof AdapterRequestError && error.status === 409))
        throw error;
    }
  }
  const current = await design.load(TR_SYSTEM);
  if (current.revision === null)
    await design.save(
      {
        ref: TR_SYSTEM,
        name: "Scala Nova · Türkçe",
        commonCss: "",
        stylesheets: ["/scalanova-tour/assets/css/styles.css"],
        revision: null,
      },
      null,
    );
  for (const region of bundle.regions)
    await once(() => regions.create!(region));
  for (const block of bundle.blocks) await once(() => library.create!(block));
  for (const template of bundle.templates)
    await once(() => templates.create!(template));
  const existingPages: EditorDocument[] = [];
  let cursor = "";
  do {
    const response = await fetch(
      `/api/v1/documents?systemId=${TR_SYSTEM.id}&systemVersion=${TR_SYSTEM.version}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
    );
    if (!response.ok) throw Error("API sayfa listesi alınamadı.");
    const listed = (await response.json()) as {
      items: EditorDocument[];
      nextCursor: string | null;
    };
    existingPages.push(...listed.items);
    cursor = listed.nextCursor ?? "";
  } while (cursor);
  const result: EditorDocument[] = [];
  for (const [index, page] of bundle.pages.entries()) {
    const path = String(page.editorState.workspaceImportedFrom);
    const existing = existingPages.find(
      (p) => p.editorState.workspaceImportedFrom === path,
    );
    if (existing) {
      result.push(existing);
      continue;
    }
    progress(`Kaydediliyor: ${index + 1}/${bundle.pages.length}`);
    const saved = await storage.save(page, null);
    page.documentId = saved.documentId;
    page.revision = saved.revision;
    result.push(page);
    localStorage.setItem(
      "blockdesign:document:" + page.documentId,
      JSON.stringify(page),
    );
  }
  saveBaseView(localStorage, {
    id: BASE,
    name: "Scala Nova · Türkçe",
    headerRef: HEADER,
    footerRef: FOOTER,
    designSystemRef: TR_SYSTEM,
    updatedAt: new Date().toISOString(),
  });
  for (const page of result)
    localStorage.setItem(
      "blockdesign:document:" + page.documentId,
      JSON.stringify(page),
    );
  const currentIds = new Set(result.map((page) => page.documentId));
  const stale: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith("blockdesign:document:")) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const page = JSON.parse(raw) as EditorDocument;
      if (
        page.designSystemRef?.id === TR_SYSTEM.id &&
        !currentIds.has(page.documentId)
      )
        stale[key] = raw;
    } catch {}
  }
  if (Object.keys(stale).length) {
    localStorage.setItem(
      "blockdesign:backup:tr-import-replaced:" + Date.now(),
      JSON.stringify(stale),
    );
    Object.keys(stale).forEach((key) => localStorage.removeItem(key));
  }
  return {
    pages: result,
    blocks: bundle.blocks,
    templates: bundle.templates,
    regions: bundle.regions,
  };
}
