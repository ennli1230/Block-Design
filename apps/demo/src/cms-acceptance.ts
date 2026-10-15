import { renderPageDocument } from "@blockdesign/editor";
import {
  HttpBlockLibraryAdapter,
  HttpContentProviderAdapter,
  HttpDesignSystemAdapter,
  HttpSharedRegionAdapter,
  HttpStorageAdapter,
  HttpTemplateAdapter,
} from "@blockdesign/adapters";
import { resolveDocumentSources } from "@blockdesign/core";
import { DemoCmsFormProvider, DemoFormOptionsProvider } from "./cms-forms";
import { ScalanovaTourContentProvider } from "./scalanova-tour-content-provider";
import { scalanovaBehaviors } from "./scalanova-runtime";
import type {
  EditorDocument,
  SharedRegionDefinition,
} from "@blockdesign/contracts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const results = document.querySelector<HTMLOListElement>("#results")!,
  fixtures = document.querySelector<HTMLElement>("#fixtures")!;
document.querySelector<HTMLButtonElement>("#run")!.onclick = async function () {
  const button = this as HTMLButtonElement;
  button.disabled = true;
  results.replaceChildren();
  fixtures.replaceChildren();
  const run = async (name: string, test: () => Promise<void>) => {
    const row = document.createElement("li");
    results.append(row);
    try {
      await test();
      row.textContent = "GEÇTİ · " + name;
    } catch (error) {
      row.textContent = "KALDI · " + name + " · " + String(error);
      throw error;
    }
  };
  const http = { baseUrl: "/api/v1" },
    provider = new HttpContentProviderAdapter(http),
    regionsAdapter = new HttpSharedRegionAdapter(http);
  let documentRecord: EditorDocument,
    regions: SharedRegionDefinition[],
    output: Awaited<ReturnType<typeof renderPageDocument>>,
    frame: HTMLIFrameElement;
  try {
    await run(
      "Veritabanındaki menü ID 4 ve header alt menüleri çözülür",
      async () => {
        const groups = await provider.listGroups!("cms-menus", {
          contentLocale: { locale: "tr", fallback: { mode: "none" } },
        });
        assert(groups.length === 4, "4 menü bekleniyor");
        const legal = await provider.resolveGroup!("cms-menus", "4");
        assert(
          legal.length === 5 &&
            legal.some((item) => String(item.values.url).includes("kvkk")),
          "ID4 yasal menüsü yanlış",
        );
        const header = await provider.resolveGroup!("cms-menus", "1");
        assert(
          Array.isArray(header[0]?.values.children) &&
            header[0].values.children.length === 2,
          "CMS alt menüleri kayıp",
        );
        documentRecord = await new HttpStorageAdapter(http).load(
          "9738cc9fb1c3f371d6459ba8ae7d6335",
        );
        regions = (
          await regionsAdapter.list({
            designSystemRef: documentRecord.designSystemRef,
            includeArchived: true,
          })
        ).items;
      },
    );
    await run(
      "Eksik CMS menüsü hatadır; manuel taslak verisi değişmez",
      async () => {
        const before = JSON.stringify(documentRecord);
        const broken = structuredClone(regions);
        for (const region of broken)
          for (const binding of region.sourceBindings ?? [])
            binding.providerId = "missing-cms";
        const result = await resolveDocumentSources(
          documentRecord,
          new Map(),
          [],
          broken,
        );
        assert(
          result.issues.some((issue) => issue.code === "SOURCE_UNAVAILABLE"),
          "Eksik CMS gizlendi",
        );
        assert(
          JSON.stringify(documentRecord) === before,
          "Manuel taslak değişti",
        );
      },
    );
    await run(
      "Gerçek HTML çıktısı doğru CMS header/footer öğelerini içerir",
      async () => {
        output = await renderPageDocument(documentRecord, {
          http,
          storageAdapter: new HttpStorageAdapter(http),
          blockLibraryAdapter: new HttpBlockLibraryAdapter(http),
          sharedRegionAdapter: regionsAdapter,
          templateAdapter: new HttpTemplateAdapter(http),
          designSystemAdapter: new HttpDesignSystemAdapter(http),
          contentProviders: [
            provider,
            new ScalanovaTourContentProvider(),
            new DemoFormOptionsProvider(),
          ],
          forms: { providers: [new DemoCmsFormProvider()] },
          behaviorPlugins: scalanovaBehaviors,
          localization: {
            defaultLocale: "tr",
            uiLocale: "tr",
            locales: [{ code: "tr", label: "Türkçe", direction: "ltr" }],
            fallback: { mode: "none" },
            strictExport: true,
          },
        });
        const sourceErrors = output.issues.filter((issue) =>
          issue.code.startsWith("SOURCE_"),
        );
        assert(!sourceErrors.length, JSON.stringify(sourceErrors));
        const html = new DOMParser().parseFromString(output.html, "text/html");
        assert(
          html.querySelector("header [data-nav-submenu] a")?.textContent ===
            "Özel turlar",
          "Alt menü HTML eşlemesi yanlış",
        );
        const links = [...html.querySelectorAll("footer a")];
        assert(
          links.some(
            (link) =>
              link.textContent === "B2B iş ortaklığı" &&
              link.getAttribute("href") === "/scalanova-tour/tr/b2b/",
          ),
          "Footer kurumsal menüsü yanlış",
        );
        assert(
          links.filter((link) =>
            link.getAttribute("href")?.includes("/kvkk-aydinlatma/"),
          ).length === 1,
          "Footer yasal menüsü yinelendi",
        );
        assert(
          output.issues.some((issue) => issue.code.includes("FORM_")),
          "Yayın form bağlantısı eksikliği görünür olmalı",
        );
      },
    );
    await run(
      "Bağımsız çıktıda hamburger ve CMS alt menüsü açılır, Escape ile kapanır",
      async () => {
        frame = document.createElement("iframe");
        frame.title = "CMS menü çıktısı";
        frame.style.cssText = "width:390px;height:650px;border:1px solid #ccc";
        fixtures.append(frame);
        const loaded = new Promise<void>(
          (resolve) => (frame.onload = () => resolve()),
        );
        frame.srcdoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${output.css}</style></head><body>${output.html}<script>${output.js.replace(/<\/script/gi, "<\\/script")}<\/script></body></html>`;
        await loaded;
        const doc = frame.contentDocument!,
          toggle = doc.querySelector<HTMLButtonElement>("[data-menu-toggle]")!,
          nav = doc.querySelector<HTMLElement>("[data-nav-links]")!;
        assert(toggle, "Hamburger düğmesi kayıp");
        toggle.click();
        assert(
          toggle.getAttribute("aria-expanded") === "true" &&
            nav.classList.contains("is-open"),
          "Hamburger açılmadı",
        );
        const subToggle = doc.querySelector<HTMLButtonElement>(
            "[data-nav-subtoggle]:not([hidden])",
          )!,
          sub = doc.getElementById(subToggle.getAttribute("aria-controls")!)!;
        assert(
          sub.querySelectorAll("a").length === 2,
          "CMS alt menüleri eksik",
        );
        subToggle.click();
        assert(sub.hidden === false, "Alt menü açılmadı");
        subToggle.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        assert(sub.hasAttribute("hidden"), "Escape alt menüyü kapatmadı");
        nav.querySelector<HTMLAnchorElement>("a")!.focus();
        nav.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        assert(
          toggle.getAttribute("aria-expanded") === "false",
          "Escape hamburgeri kapatmadı",
        );
        assert(
          doc.activeElement === toggle,
          "Escape sonrası klavye odağı hamburger düğmesine dönmedi",
        );
        assert(
          doc.querySelectorAll("footer a").length >= 15,
          "Footer bağlantıları kayıp",
        );
      },
    );
    const done = document.createElement("p");
    done.textContent = "4/4 CMS testi geçti";
    results.after(done);
  } catch {
    /* The failing result remains visible. */
  } finally {
    button.disabled = false;
  }
};
