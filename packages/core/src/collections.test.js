import assert from "node:assert/strict";
import test from "node:test";
import { contextualQuery, loadCollectionPage } from "./collections.ts";
import { resolveDocumentSources } from "./sources.ts";
import { createEmptyDocument, makeInstance } from "./index.ts";
import { faqDefinition } from "./catalog.ts";

const binding = {
  bindingId: "listing",
  target: { scope: "repeater", id: "items" },
  mode: "query",
  providerId: "cms",
  collectionId: "posts",
  schemaVersion: "1",
  recordRefs: [],
  groupRef: null,
  fieldMappings: [],
  query: {
    filters: [
      {
        fieldId: "category",
        operator: "eq",
        value: { $context: "page.route.category" },
      },
    ],
    sort: { fieldId: "title", direction: "asc" },
    limit: 2,
  },
  live: {
    filters: [{ fieldId: "title", label: "Başlık", operator: "contains" }],
  },
};
function fixture() {
  const calls = [];
  const schema = {
    schemaVersion: "1",
    capabilities: {
      recordSelection: true,
      query: {
        maxLimit: 20,
        filterFields: [
          { fieldId: "category", operators: ["eq"] },
          { fieldId: "title", operators: ["contains"] },
        ],
        sortFields: ["title"],
      },
    },
  };
  return {
    calls,
    schema,
    provider: {
      providerId: "cms",
      capabilities: { supported: ["resolveRecords", "query", "queryPage"] },
      getSchema: async () => schema,
      queryPage: async (...args) => {
        calls.push(args);
        return { items: [], nextCursor: null };
      },
      query: async () => ({ items: [], nextCursor: null }),
      resolveRecords: async () => [],
    },
  };
}
test("paged CMS query preserves opaque cursor and host context, combines protected and visitor filters without mutating defaults", async () => {
  const f = fixture(),
    controller = new AbortController();
  await loadCollectionPage(
    [f.provider],
    binding,
    { title: "Efes" },
    "opaque/+42",
    {
      page: { siteId: "tenant-a", route: { category: "culture" } },
      signal: controller.signal,
    },
  );
  assert.deepEqual(f.calls[0][1].filters, [
    { fieldId: "category", operator: "eq", value: "culture" },
    { fieldId: "title", operator: "contains", value: "Efes" },
  ]);
  assert.equal(f.calls[0][2], "opaque/+42");
  assert.equal(f.calls[0][3].page.siteId, "tenant-a");
  assert.equal(f.calls[0][3].signal, controller.signal);
  assert.deepEqual(binding.query.filters[0].value, {
    $context: "page.route.category",
  });
});
test("visitor cannot inject arbitrary filters, schema changes or unsupported page sizes", async () => {
  const f = fixture(),
    context = { page: { route: { category: "culture" } } };
  await assert.rejects(
    loadCollectionPage(
      [f.provider],
      binding,
      { tenant: "other" },
      undefined,
      context,
    ),
    /izin verilmiyor/,
  );
  f.schema.schemaVersion = "2";
  await assert.rejects(
    loadCollectionPage([f.provider], binding, {}, undefined, context),
    /şeması değişti/,
  );
  f.schema.schemaVersion = "1";
  await assert.rejects(
    loadCollectionPage(
      [f.provider],
      { ...binding, query: { ...binding.query, limit: 100 } },
      {},
      undefined,
      context,
    ),
    /sayfa boyutu/,
  );
  assert.equal(f.calls.length, 0);
});
test("context references reject missing values and prototype/expression access", () => {
  assert.throws(() => contextualQuery(binding.query, {}), /bulunamadı/);
  for (const name of [
    "page.__proto__.siteId",
    "page.route.constructor",
    "window.location",
    "page.route.category()",
  ])
    assert.throws(() =>
      contextualQuery(
        {
          ...binding.query,
          filters: [
            { fieldId: "category", operator: "eq", value: { $context: name } },
          ],
        },
        {},
      ),
    );
});
test("both selected and queried sources report schema drift before applying data", async () => {
  for (const mode of ["selection", "query"]) {
    const f = fixture();
    f.schema.schemaVersion = "2";
    const doc = createEmptyDocument(),
      block = makeInstance(faqDefinition);
    block.sourceBindings = [
      {
        ...binding,
        target: { scope: "field", id: "faq.title" },
        mode,
        recordRefs: ["one"],
      },
    ];
    doc.blocks = [block];
    const result = await resolveDocumentSources(
      doc,
      new Map([
        [`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition],
      ]),
      [f.provider],
    );
    assert.equal(result.issues[0].code, "SOURCE_RESOLUTION_FAILED");
    assert.match(result.issues[0].message, /şeması değişti/);
    assert.deepEqual(result.document.blocks[0].manualData, block.manualData);
  }
});
test("a repeated pagination cursor is reported instead of looping", async () => {
  const f = fixture();
  f.provider.queryPage = async () => ({ items: [], nextCursor: "same" });
  await assert.rejects(
    loadCollectionPage([f.provider], binding, {}, "same", {
      page: { route: { category: "culture" } },
    }),
    /tekrar/,
  );
});
