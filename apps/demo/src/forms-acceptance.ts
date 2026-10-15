import {
  createCmsFormDefinition,
  createEmptyDocument,
  makeInstance,
  mountCmsForm,
  validateFormDefinition,
  validateFormValues,
  type CmsFormServices,
} from "@blockdesign/core";
import { mountEditor } from "@blockdesign/editor";
import { prepareCmsFormExport, CMS_FORM_CSS } from '@blockdesign/editor/forms';
import type {
  FormBinding,
  FormDefinition,
  FormActionResult,
} from "@blockdesign/contracts";

const fixtures = document.querySelector<HTMLElement>("#fixtures")!,
  results = document.querySelector<HTMLOListElement>("#results")!;
const binding: FormBinding = {
  providerId: "test",
  formRef: { id: "contact", version: "1" },
  appearance: "stacked",
  contextBindings: [],
};
const schema = (): FormDefinition => ({
  ref: { id: "contact", version: "1" },
  label: "İletişim",
  locale: "tr",
  fields: [
    {
      fieldId: "email",
      type: "email",
      label: "E-posta",
      validation: { required: true },
    },
  ],
  action: {
    adapterId: "test",
    actionId: "contact",
    kind: "submit",
    label: "Gönder",
  },
});
const provider = {
  providerId: "test",
  capabilities: { supported: ["listForms", "readSchema"] },
  listForms: async () => ({
    items: [{ ref: binding.formRef, label: "İletişim" }],
    nextCursor: null,
  }),
  getDefinition: async () => schema(),
};
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function until(check: () => unknown, message: string) {
  const limit = Date.now() + 10000;
  while (!check()) {
    if (Date.now() > limit) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
function fixture() {
  const root = document.createElement("div");
  root.setAttribute("data-bd-cms-form", "true");
  root.setAttribute("data-bd-form-binding", JSON.stringify(binding));
  root.textContent = "Özgün yer tutucu";
  fixtures.append(root);
  return root;
}
function services(overrides: Partial<CmsFormServices> = {}): CmsFormServices {
  return {
    mode: "published",
    definition: async () => schema(),
    options: async () => ({ items: [], nextCursor: null }),
    execute: async () => ({ kind: "accepted", receiptId: "one" }),
    validateDefinition: validateFormDefinition,
    validateValues: validateFormValues,
    ...overrides,
  };
}
function fill(root: ParentNode, name: string, value: string) {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function submit(root: ParentNode) {
  root.querySelector("form")!.requestSubmit();
}

const tests: Array<[string, () => Promise<void>]> = [
  [
    "Geçersiz ziyaretçi verisi gönderilmez",
    async () => {
      const root = fixture();
      let count = 0;
      const stop = mountCmsForm(
        root,
        services({
          execute: async () => {
            count++;
            return { kind: "accepted", receiptId: "one" };
          },
        }),
      );
      await until(() => root.querySelector("input"), "Form açılmadı");
      fill(root, "email", "geçersiz");
      submit(root);
      assert(count === 0, "Geçersiz form gönderildi");
      assert(
        root.querySelector("[aria-invalid=true]"),
        "Alan hatası görünmüyor",
      );
      stop();
      root.remove();
    },
  ],
  [
    "Önizleme gerçek action adapterını çağırmaz",
    async () => {
      const root = fixture();
      let count = 0;
      const stop = mountCmsForm(
        root,
        services({
          mode: "preview",
          execute: async () => {
            count++;
            return { kind: "accepted", receiptId: "one" };
          },
        }),
      );
      await until(() => root.querySelector("input"), "Form açılmadı");
      fill(root, "email", "a@example.com");
      submit(root);
      assert(count === 0, "Önizleme gönderim yaptı");
      assert(
        root.textContent?.includes("gönderilmedi"),
        "Önizleme sonucu eksik",
      );
      stop();
      root.remove();
    },
  ],
  [
    "Çift tıklama engellenir; timeout sonrası aynı işlem kimliğiyle yeniden denenir",
    async () => {
      const root = fixture();
      const ids: string[] = [];
      let reject!: (reason: Error) => void;
      const stop = mountCmsForm(
        root,
        services({
          execute: async (_form, _binding, _values, id) => {
            ids.push(id);
            if (ids.length === 1)
              return new Promise<FormActionResult>((_resolve, no) => {
                reject = no;
              });
            return { kind: "accepted", receiptId: "one" };
          },
        }),
      );
      await until(() => root.querySelector("input"), "Form açılmadı");
      fill(root, "email", "a@example.com");
      submit(root);
      submit(root);
      assert(ids.length === 1, "Çift istek üretildi");
      reject(new Error("timeout"));
      await until(
        () => !root.querySelector<HTMLButtonElement>("[type=submit]")!.disabled,
        "Yeniden deneme açılmadı",
      );
      submit(root);
      await until(() => ids.length === 2, "İkinci deneme başlamadı");
      assert(ids[0] === ids[1], "İşlem kimliği değişti");
      await until(
        () => root.querySelector<HTMLButtonElement>("[type=submit]")!.disabled,
        "Başarı sonrası gönderim açık kaldı",
      );
      stop();
      root.remove();
    },
  ],
  [
    "Destinasyon değişiminde geç gelen eski tur yanıtı uygulanmaz",
    async () => {
      const root = fixture();
      let oldResolve!: (result: {
        items: Array<{ value: string; label: string }>;
        nextCursor: null;
      }) => void;
      const definition = schema();
      definition.fields = [
        {
          fieldId: "destination",
          type: "select",
          label: "Destinasyon",
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
        },
        {
          fieldId: "tour",
          type: "select",
          label: "Tur",
          options: {
            providerId: "test",
            collectionId: "tours",
            labelField: "label",
            dependencies: [
              { fieldId: "destination", filterField: "destinationId" },
            ],
          },
        },
      ];
      const stop = mountCmsForm(
        root,
        services({
          definition: async () => definition,
          options: async (_field, values) => {
            if (values.destination === "a")
              return new Promise((resolve) => {
                oldResolve = resolve;
              });
            return {
              items:
                values.destination === "b"
                  ? [{ value: "b-tour", label: "B turu" }]
                  : [],
              nextCursor: null,
            };
          },
        }),
      );
      await until(
        () => root.querySelector("[name=destination]"),
        "Seçenekler açılmadı",
      );
      fill(root, "destination", "a");
      fill(root, "destination", "b");
      await until(
        () => root.querySelector('[value="b-tour"]'),
        "Yeni seçenek gelmedi",
      );
      oldResolve({
        items: [{ value: "a-tour", label: "A turu" }],
        nextCursor: null,
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert(
        !root.querySelector('[value="a-tour"]'),
        "Eski yanıt yeni seçimi ezdi",
      );
      stop();
      root.remove();
    },
  ],
  [
    "Destroy sonrasında tamamlanan istek DOMu değiştiremez",
    async () => {
      const root = fixture();
      let resolve!: (form: FormDefinition) => void;
      const stop = mountCmsForm(
        root,
        services({
          definition: () =>
            new Promise((done) => {
              resolve = done;
            }),
        }),
      );
      stop();
      resolve(schema());
      await new Promise((done) => setTimeout(done, 20));
      assert(
        root.textContent === "Özgün yer tutucu",
        "Destroy sonrası DOM değişti",
      );
      root.remove();
    },
  ],
  [
    "Statik export ortak runtimeı açar ve eksik yayın bağlantısını görünür kılar",
    async () => {
      const root = fixture();
      const output = await prepareCmsFormExport(root.outerHTML, {
        providers: [provider],
      });
      assert(
        output.issues.some(
          (issue) => issue.code === "FORM_PUBLICATION_UNCONFIGURED",
        ),
        "Yayın uyarısı eksik",
      );
      const iframe = document.createElement("iframe");
      fixtures.append(iframe);
      iframe.srcdoc =
        `<!doctype html><html><head><style>${CMS_FORM_CSS}</style></head><body>${output.html}<script>${output.js}<\/script></body></html>`.replace(
          "<\\/script>",
          "</script>",
        );
      await until(
        () => iframe.contentDocument?.querySelector("input"),
        "Export runtimeı açılmadı",
      );
      assert(
        iframe.contentDocument!.querySelector<HTMLButtonElement>(
          "[type=submit]",
        )!.disabled,
        "Yapılandırılmamış export gönderime izin verdi",
      );
      iframe.remove();
      root.remove();
    },
  ],
  [
    "Editör belge snapshotına ziyaretçi değerleri yazılmaz",
    async () => {
      const host = document.createElement("div");
      host.style.height = "600px";
      fixtures.append(host);
      const definition = createCmsFormDefinition({
        id: "system.test",
        version: "1",
      });
      const pageDocument = createEmptyDocument();
      pageDocument.designSystemRef = definition.designSystemRef;
      const block = makeInstance(definition);
      block.formBinding = structuredClone(binding);
      pageDocument.blocks = [block];
      const library = {
        capabilities: { supported: ["list", "readVersion"] },
        list: async () => ({ items: [definition], nextCursor: null }),
        getVersion: async () => definition,
      };
      const handle = mountEditor(host, {
        appearance: "embedded",
        initialDocument: pageDocument,
        blockLibraryAdapter: library,
        contentProviders: [],
        forms: { providers: [provider] },
        mode: "content",
      });
      try {
        await handle.ready;
        await handle.setPreview(true);
        await until(
          () =>
            host
              .querySelector("iframe")
              ?.contentDocument?.querySelector("input[name=email]"),
          "Editör formu açılmadı",
        );
        const frame = host.querySelector("iframe")!.contentDocument!;
        fill(frame, "email", "private-visitor@example.test");
        const saved = JSON.stringify(await handle.getDocument());
        assert(
          !saved.includes("private-visitor@example.test"),
          "Ziyaretçi değeri belgeye sızdı",
        );
        assert(saved.includes("formBinding"), "Form bağlantısı kayboldu");
      } finally {
        await handle.destroy();
        host.remove();
      }
    },
  ],
];
document
  .querySelector<HTMLButtonElement>("#run")!
  .addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    results.replaceChildren();
    let passed = 0;
    for (const [name, run] of tests) {
      const li = document.createElement("li");
      results.append(li);
      try {
        await run();
        li.textContent = "GEÇTİ · " + name;
        passed++;
      } catch (error) {
        li.textContent =
          "BAŞARISIZ · " +
          name +
          " · " +
          (error instanceof Error ? error.message : String(error));
      }
    }
    const summary = document.createElement("p");
    summary.setAttribute("role", "status");
    summary.textContent = `${passed}/${tests.length} test geçti`;
    results.append(summary);
    button.disabled = false;
  });
