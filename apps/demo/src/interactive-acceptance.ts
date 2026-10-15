import {
  mountInteractive,
  tabsWidget,
  modalWidget,
  galleryWidget,
  makeInstance,
  mountCollection,
  loadCollectionPage,
} from "@blockdesign/core";
import {
  renderBlockMarkup,
  behaviorExportDependencies,
} from "@blockdesign/grapesjs-bridge";
import { collectionExport, createCollectionBehavior } from "@blockdesign/editor/runtime";
import { mountEditor } from "@blockdesign/editor";
import { createEmptyDocument } from "@blockdesign/core";
import { definition } from "./interactive-fixture";
import type {
  ContentProviderAdapter,
  SourceBinding,
} from "@blockdesign/contracts";
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
const fixtures = document.querySelector<HTMLElement>("#fixtures")!,
  results = document.querySelector("#results")!;
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 30));
document.querySelector<HTMLButtonElement>("#run")!.onclick = async function () {
  const button = this as HTMLButtonElement;
  button.disabled = true;
  fixtures.replaceChildren();
  results.replaceChildren();
  let passed = 0,
    total = 0;
  const run = async (name: string, test: () => Promise<void>) => {
    total++;
    const li = document.createElement("li");
    results.append(li);
    try {
      await test();
      li.textContent = "GEÇTİ · " + name;
      passed++;
    } catch (error) {
      li.textContent =
        "KALDI · " +
        name +
        ": " +
        (error instanceof Error ? error.message : String(error));
    }
  };
  const add = (html: string) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    fixtures.append(host);
    return host.firstElementChild as HTMLElement;
  };
  await run(
    "Sekmeler: ok tuşları, ARIA, bağımsız örnekler ve cleanup",
    async () => {
      const a = add(renderBlockMarkup(makeInstance(tabsWidget), tabsWidget)),
        b = add(renderBlockMarkup(makeInstance(tabsWidget), tabsWidget));
      const stop = mountInteractive(a),
        stopB = mountInteractive(b);
      const tabs = a.querySelectorAll<HTMLElement>("[data-bd-tab]");
      tabs[0]!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      assert(
        tabs[1]!.getAttribute("aria-selected") === "true",
        "İkinci sekme seçilmedi",
      );
      assert(document.activeElement === tabs[1], "Odak taşınmadı");
      assert(
        b.querySelector("[data-bd-tab]")?.getAttribute("aria-selected") ===
          "true",
        "Diğer örnek değişti",
      );
      stop();
      stopB();
      assert(!tabs[0]!.hasAttribute("role"), "Özgün nitelikler geri gelmedi");
    },
  );
  await run(
    "Modal: native odak sınırı, açma, Escape ve odağı geri verme",
    async () => {
      const root = add(
        renderBlockMarkup(makeInstance(modalWidget), modalWidget),
      );
      const stop = mountInteractive(root);
      const trigger = root.querySelector<HTMLElement>("[data-bd-modal-open]")!,
        dialog = root.querySelector("dialog")!;
      trigger.focus();
      trigger.click();
      assert(dialog.open, "Modal açılmadı");
      trigger.focus();
      assert(
        document.activeElement !== trigger,
        "Modal açıkken odak arka plana kaçtı",
      );
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
      assert(!dialog.open, "Modal kapanmadı");
      assert(document.activeElement === trigger, "Tetikleyiciye dönülmedi");
      stop();
    },
  );
  await run(
    "Galeri: görsel değiştirme, alternatif metin ve yeniden mount",
    async () => {
      const block = makeInstance(galleryWidget);
      block.manualData.items = [
        {
          __id: "one",
          image: "/scalanova-tour/assets/images/priene.jpg",
          alt: "Priene",
        },
        {
          __id: "two",
          image: "/scalanova-tour/assets/images/kusadasi-coast.jpg",
          alt: "Kuşadası",
        },
      ];
      const root = add(renderBlockMarkup(block, galleryWidget));
      let stop = mountInteractive(root);
      root.querySelector<HTMLElement>("[data-bd-gallery-item]")!.click();
      const dialog = root.querySelector("dialog")!;
      assert(dialog.open, "Galeri açılmadı");
      dialog.querySelectorAll("button")[1]!.click();
      assert(
        dialog.querySelector("img")!.alt === "Kuşadası",
        "İkinci görsel gelmedi",
      );
      stop();
      stop = mountInteractive(root);
      assert(root.querySelectorAll("dialog").length === 1, "Dialog çoğaldı");
      stop();
    },
  );
  await run(
    "Canlı liste: cursor, filtre sıfırlama, route bağlamı ve eski yanıt koruması",
    async () => {
      const binding: SourceBinding = {
        bindingId: "acceptance-list",
        target: { scope: "repeater", id: definition.repeaters[0]!.repeaterId },
        mode: "query",
        providerId: "test",
        collectionId: "posts",
        schemaVersion: "1",
        recordRefs: [],
        groupRef: null,
        query: {
          filters: [
            {
              fieldId: "category",
              operator: "eq",
              value: { $context: "page.route.category" },
            },
          ],
          sort: null,
          limit: 1,
        },
        fieldMappings: [
          { from: "title", to: "title" },
          { from: "body", to: "body" },
          { from: "image", to: "image" },
          { from: "url", to: "url" },
        ],
        live: {
          filters: [
            { fieldId: "title", label: "Başlık", operator: "contains" },
          ],
          syncUrl: false,
        },
      };
      const block = makeInstance(definition);
      block.sourceBindings = [binding];
      const root = add(renderBlockMarkup(block, definition));
      const config = JSON.parse(root.getAttribute("data-bd-collection")!)[0];
      const calls: Array<{ cursor: string | undefined; filter: string }> = [];
      let delayed: ((value: unknown) => void) | undefined;
      const provider = {
        providerId: "test",
        capabilities: { supported: ["queryPage"] },
        getSchema: async () => ({
          schemaVersion: "1",
          capabilities: {
            query: {
              maxLimit: 10,
              filterFields: [
                { fieldId: "category", operators: ["eq"] },
                { fieldId: "title", operators: ["contains"] },
              ],
              sortFields: [],
            },
          },
        }),
        queryPage: async (
          _id: string,
          query: NonNullable<SourceBinding["query"]>,
          cursor?: string,
        ) => {
          assert(
            query.filters[0]!.value === "culture",
            "Route bağlamı kayboldu",
          );
          const filter = String(
            query.filters.find((f) => f.fieldId === "title")?.value ?? "",
          );
          calls.push({ cursor, filter });
          if (filter === "slow")
            return new Promise((resolve) => {
              delayed = resolve;
            });
          return {
            items: [
              {
                recordId: cursor ?? "one",
                collectionId: "posts",
                values: {
                  title: filter || (cursor ? "İkinci sayfa" : "İlk sayfa"),
                  body: "Özet",
                  image: "",
                  url: "/detail",
                },
              },
            ],
            nextCursor: cursor || filter ? null : "opaque/2",
          };
        },
      } as unknown as ContentProviderAdapter;
      const stop = mountCollection(root, config, {
        syncUrl: false,
        load: (values, cursor, signal) =>
          loadCollectionPage([provider], binding, values, cursor, {
            signal,
            page: { route: { category: "culture" } },
          }),
      });
      await tick();
      root
        .querySelectorAll<HTMLButtonElement>(
          ".bd-collection-controls button",
        )[1]!
        .click();
      await tick();
      assert(root.textContent?.includes("İkinci sayfa"), "Sonraki sayfa yok");
      const input = root.querySelector<HTMLInputElement>(
          ".bd-collection-filters input",
        )!,
        form = root.querySelector("form")!;
      input.value = "slow";
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
      input.value = "fresh";
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
      delayed?.({
        items: [{ recordId: "late", values: { title: "ESKİ" } }],
        nextCursor: null,
      });
      await tick();
      assert(
        root.textContent?.includes("fresh") &&
          !root.textContent?.includes("ESKİ"),
        "Eski yanıt yeni filtreyi ezdi",
      );
      assert(
        calls.at(-1)?.cursor === undefined,
        "Filtre sayfalama konumunu sıfırlamadı",
      );
      stop();
      assert(!root.querySelector("form"), "Cleanup kontrolleri kaldırmadı");
      assert(!root.querySelector('[aria-busy]'), "Cleanup aria-busy niteliğini kaldırmadı");
      let category = "culture";
      const categories: unknown[] = [];
      const behavior = createCollectionBehavior([{
        ...provider,
        queryPage: async (_id, query) => {
          categories.push(query.filters[0]!.value);
          return { items: [], nextCursor: null };
        },
      }], () => ({ page: { route: { category } } }));
      const cleanup = behavior.mount(root);
      await tick();
      behavior.update?.(root);
      await tick();
      assert(categories.length === 1, "Değişmeyen bağlam yeniden yüklendi");
      category = "nature";
      behavior.update?.(root);
      await tick();
      assert(categories.join(',') === 'culture,nature', "Yeni route bağlamı sorguya aktarılmadı");
      if (typeof cleanup === 'function') cleanup();
    },
  );
  await run(
    "Bağımsız HTML: sekmeler ve modal editör runtime’ı olmadan çalışır",
    async () => {
      const markup =
        renderBlockMarkup(makeInstance(tabsWidget), tabsWidget) +
        renderBlockMarkup(makeInstance(modalWidget), modalWidget);
      const output = behaviorExportDependencies([], markup);
      const frame = document.createElement("iframe");
      fixtures.append(frame);
      await new Promise<void>((resolve) => {
        frame.onload = () => resolve();
        frame.srcdoc =
          '<!doctype html><html lang="tr"><head><style>' +
          output.css +
          "</style></head><body>" +
          markup +
          "<script>" +
          output.js +
          "</" +
          "script></body></html>";
      });
      const doc = frame.contentDocument!;
      doc.querySelectorAll<HTMLElement>("[data-bd-tab]")[1]!.click();
      assert(
        doc.querySelectorAll("[data-bd-tabpanel]")[0]!.hasAttribute("hidden"),
        "Export sekmeleri çalışmadı",
      );
      doc.querySelector<HTMLElement>("[data-bd-modal-open]")!.click();
      assert(doc.querySelector("dialog")!.open, "Export modal çalışmadı");
    },
  );
  await run(
    "Yayın bağlantısı yoksa canlı liste sessiz başarı sayılmaz",
    async () => {
      const output = collectionExport(
        '<section data-bd-collection="[]"></section>',
      );
      assert(
        output.issues[0]?.code === "COLLECTION_PUBLICATION_UNCONFIGURED",
        "Eksik yayın bağlantısı raporlanmadı",
      );
    },
  );
  await run(
    "Bağımsız canlı liste: public CMS isteği, filtre ve sonraki cursor",
    async () => {
      const block = makeInstance(definition);
      block.sourceBindings = [
        {
          bindingId: "public-list",
          locale: { mode: "fixed", locale: "en" },
          target: { scope: "repeater", id: "cards.items" },
          mode: "query",
          providerId: "cms",
          collectionId: "posts",
          schemaVersion: "1",
          recordRefs: [],
          groupRef: null,
          query: {
            filters: [
              {
                fieldId: "category",
                operator: "eq",
                value: { $context: "page.route.category" },
              },
            ],
            sort: null,
            limit: 1,
          },
          fieldMappings: [
            { from: "title", to: "title" },
            { from: "body", to: "body" },
            { from: "url", to: "url" },
          ],
          live: {
            filters: [
              { fieldId: "price", label: "Fiyat", operator: "gt" },
            ],
            syncUrl: false,
          },
        },
      ];
      const html = renderBlockMarkup(block, definition);
      const output = collectionExport(html, {
        baseUrl: "/public",
        context: { page: { route: { category: "culture" } }, contentLocale: { locale: "tr", fallback: { mode: "none" } } },
      });
      const frame = document.createElement("iframe");
      fixtures.append(frame);
      await new Promise<void>((resolve) => {
        frame.onload = () => resolve();
        frame.srcdoc =
          "<!doctype html><html><body>" +
          html +
          '<script>window.fetch=async(url,input)=>{if(new URL(url).searchParams.get("locale")!=="en")throw Error("fixed URL locale missing");if(!input.body)return {ok:true,json:async()=>({schemaVersion:"1",fields:[{fieldId:"price",valueType:"number"}],capabilities:{query:{maxLimit:10,filterFields:[{fieldId:"category",operators:["eq"]},{fieldId:"price",operators:["gt"]}],sortFields:[]}}})};const query=JSON.parse(input.body);if(query.contentLocale.locale!=="en")throw Error("fixed body locale missing");if(query.filters[0].value!=="culture")throw Error("route missing");const price=query.filters.find(f=>f.fieldId==="price");if(price&&typeof price.value!=="number")throw Error("numeric filter missing");return {ok:true,json:async()=>({items:[{recordId:query.cursor||"one",values:{title:price?"Fiyat "+price.value:query.cursor?"Yayın ikinci sayfa":"Yayın ilk sayfa",body:"Özet",url:"/detail"}}],nextCursor:query.cursor?null:"next/opaque"})};};</' +
          "script><script>" +
          output.js +
          "</" +
          "script></body></html>";
      });
      await tick();
      const doc = frame.contentDocument!;
      assert(
        doc.body.textContent?.includes("Yayın ilk sayfa"),
        "Public liste açılmadı: " + doc.body.textContent,
      );
      doc
        .querySelectorAll<HTMLButtonElement>(
          ".bd-collection-controls button",
        )[1]!
        .click();
      await tick();
      assert(
        doc.body.textContent?.includes("Yayın ikinci sayfa"),
        "Public cursor çalışmadı",
      );
      const price = doc.querySelector<HTMLInputElement>('input')!;
      price.value = "42";
      doc.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await tick();
      assert(doc.body.textContent?.includes("Fiyat 42"), "Public sayısal filtre dönüştürülmedi");
      price.value = "invalid";
      doc.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await tick();
      assert(doc.body.textContent?.includes("Sayısal filtre geçersiz"), "Geçersiz sayısal filtre reddedilmedi");
    },
  );
  await run(
    "Gömülü kayıt: host URL’si ve başka editörün yerel anahtarı korunur",
    async () => {
      const before = location.href,
        local = localStorage.getItem("blockdesign:last-document");
      const host = document.createElement("div");
      host.style.height = "500px";
      fixtures.append(host);
      let calls = 0;
      const editor = mountEditor(host, {
        appearance: "embedded",
        includeDemoBlocks: false,
        storageAdapter: {
          capabilities: { supported: ["save"] },
          load: async () => {
            throw Error("unexpected load");
          },
          save: async () => ({
            documentId: "embedded-test-" + ++calls,
            revision: "1",
            savedAt: new Date().toISOString(),
          }),
        },
      });
      try {
        await editor.ready;
        await editor.save();
        assert(location.href === before, "Host URL değişti");
        assert(
          localStorage.getItem("blockdesign:last-document") === local,
          "Global son belge anahtarı değişti",
        );
      } finally {
        await editor.destroy();
        host.remove();
      }
    },
  );
  await run("Otomatik kayıt ve yeniden açılışta taslak kurtarma", async () => {
    const recoveryKey = "blockdesign:test:" + crypto.randomUUID();
    let saved: import("@blockdesign/contracts").EditorDocument = {
      ...createEmptyDocument(),
      documentId: "autosave-test",
      revision: "1",
    };
    let saves = 0;
    const storage = {
      capabilities: { supported: ["save", "load"] },
      load: async () => structuredClone(saved),
      save: async (
        doc: import("@blockdesign/contracts").EditorDocument,
        expected: string | null,
      ) => {
        assert(
          expected === saved.revision,
          "Yanlış revision ile otomatik kayıt",
        );
        saved = {
          ...structuredClone(doc),
          revision: String(Number(saved.revision) + 1),
        };
        saves++;
        return {
          documentId: "autosave-test",
          revision: saved.revision!,
          savedAt: new Date().toISOString(),
        };
      },
    };
    const host = document.createElement("div");
    host.style.height = "500px";
    fixtures.append(host);
    let editor = mountEditor(host, {
      appearance: "embedded",
      initialDocument: saved,
      storageAdapter: storage,
      autosave: { debounceMs: 300 },
      recovery: { key: recoveryKey },
    });
    const titleInput = () => {
      const label = [...host.querySelectorAll("label")].find(
        (label) => label.textContent?.trim() === "Sayfa başlığı",
      );
      assert(label, "SEO başlık alanı bulunamadı");
      return label!.querySelector("input")!;
    };
    try {
      await editor.ready;
      const input = titleInput();
      input.value = "Otomatik kaydedilen başlık";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 420));
      assert(saves === 1, "Otomatik kayıt çalışmadı");
      assert(
        !localStorage.getItem(recoveryKey),
        "Kaydedilen taslak temizlenmedi",
      );
      input.value = "Kurtarılacak başlık";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
      await editor.destroy();
      assert(localStorage.getItem(recoveryKey), "Kurtarma taslağı yok");
      editor = mountEditor(host, {
        appearance: "embedded",
        initialDocument: saved,
        storageAdapter: storage,
        recovery: { key: recoveryKey },
      });
      await editor.ready;
      const recover = [...host.querySelectorAll("button")].find(
        (button) => button.textContent === "Taslağı geri getir",
      );
      assert(recover, "Kurtarma eylemi sunulmadı");
      recover!.click();
      await tick();
      assert(
        (await editor.getDocument()).editorState.seo &&
          JSON.stringify((await editor.getDocument()).editorState.seo).includes(
            "Kurtarılacak başlık",
          ),
        "Taslak geri gelmedi",
      );
    } finally {
      await editor.destroy();
      localStorage.removeItem(recoveryKey);
      host.remove();
    }
  });
  await run(
    "Sayfa geçmişi: eski sürüm güncel revision üzerinde yeni taslak olur",
    async () => {
      const current = {
        ...createEmptyDocument(),
        documentId: "history-test",
        revision: "2",
      };
      current.editorState.seo = { title: "Güncel" };
      const old = {
        ...structuredClone(current),
        revision: "1",
        editorState: { seo: { title: "Eski" } },
      };
      let expected: string | null = null;
      const host = document.createElement("div");
      host.style.height = "500px";
      fixtures.append(host);
      const editor = mountEditor(host, {
        appearance: "embedded",
        initialDocument: current,
        storageAdapter: {
          capabilities: { supported: ["save", "load"] },
          load: async () => current,
          listRevisions: async () => ({
            items: [{ revision: "1", savedAt: new Date().toISOString() }],
            nextCursor: null,
          }),
          loadRevision: async () => old,
          save: async (_doc, revision) => {
            expected = revision;
            return {
              documentId: "history-test",
              revision: "3",
              savedAt: new Date().toISOString(),
            };
          },
        },
      });
      const click = async (text: string) => {
        const button = [...host.querySelectorAll("button")].find((button) =>
          button.textContent?.includes(text),
        );
        assert(button, "Geçmiş düğmesi yok: " + text);
        button!.click();
        await tick();
      };
      try {
        await editor.ready;
        await click("Sayfa geçmişi");
        await click("Sürüm 1");
        await click("Bu sürümü taslağa al");
        const doc = await editor.getDocument();
        assert(
          doc.revision === "2",
          "Restore eski revision ile üzerine yazacak",
        );
        assert(
          JSON.stringify(doc.editorState.seo).includes("Eski"),
          "Eski içerik yüklenmedi",
        );
        await editor.save();
        assert(expected === "2", "Restore çakışma kontrolünü atladı");
      } finally {
        await editor.destroy();
        host.remove();
      }
    },
  );
  await run(
    "Geç tamamlanan kayıt yeni açılan belgeyi değiştiremez",
    async () => {
      const host = document.createElement("div");
      host.style.height = "500px";
      fixtures.append(host);
      const first = {
        ...createEmptyDocument(),
        documentId: "slow-save",
        revision: "1",
      };
      const second = {
        ...createEmptyDocument(),
        documentId: "next-page",
        revision: "7",
      };
      let finish:
        | ((value: import("@blockdesign/contracts").SaveResult) => void)
        | undefined;
      const editor = mountEditor(host, {
        appearance: "embedded",
        initialDocument: first,
        storageAdapter: {
          capabilities: { supported: ["save", "load"] },
          load: async () => first,
          save: async () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        },
      });
      try {
        await editor.ready;
        const saving = editor.save();
        await tick();
        await editor.loadDocument(second);
        finish!({
          documentId: "slow-save",
          revision: "2",
          savedAt: new Date().toISOString(),
        });
        await saving;
        const active = await editor.getDocument();
        assert(
          active.documentId === "next-page" && active.revision === "7",
          "Eski kayıt yanıtı yeni sayfayı ezdi",
        );
      } finally {
        await editor.destroy();
        host.remove();
      }
    },
  );
  const done = document.createElement("p");
  done.textContent = `${passed}/${total} test geçti`;
  results.append(done);
  button.disabled = false;
};
