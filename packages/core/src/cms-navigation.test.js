import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDocument, isSafeUrl } from "./index.ts";
import { resolveDocumentSources } from "./sources.ts";
import { menuWidget } from "./composable.ts";
import {
  validateRepeaterRows,
  validateFieldValue,
  applyTemplateData,
} from "./index.ts";

function menuScenario(records, groupRef = "cms-footer-94") {
  const region = {
    ref: { id: "cms-footer", version: "1" },
    designSystemRef: menuWidget.designSystemRef,
    name: "CMS footer",
    region: "footer",
    componentTemplate: {
      tagName: "footer",
      attributes: { "data-bd-node": "footer" },
      components: [menuWidget.componentTemplate],
    },
    fields: [],
    repeaters: menuWidget.repeaters,
    defaultData: menuWidget.defaultData,
    sourceBindings: [
      {
        bindingId: "binding.cms-footer",
        target: { scope: "repeater", id: "menu.items" },
        mode: "selection",
        providerId: "custom-cms",
        collectionId: "cms-navigation",
        recordRefs: [],
        groupRef,
        schemaVersion: "1",
        query: null,
        fieldMappings: [
          { from: "title", to: "label" },
          { from: "permalink", to: "url" },
          { from: "subitems", to: "children" },
        ],
      },
    ],
    archived: false,
  };
  const document = createEmptyDocument();
  document.sharedRegionRefs = [region.ref];
  const provider = {
    providerId: "custom-cms",
    capabilities: { supported: ["resolveRecords", "recordGroups"] },
    getSchema: async () => ({
      capabilities: { recordGroups: true, recordSelection: true },
    }),
    resolveGroup: async (_, id) => {
      assert.equal(id, groupRef);
      return records;
    },
    resolveRecords: async () => {
      throw Error("Unexpected individual record lookup");
    },
  };
  return {
    document,
    region,
    provider,
    resolve: () =>
      resolveDocumentSources(document, new Map(), [provider], [region]),
  };
}

test("opaque CMS item identifiers do not collide when punctuation differs", async () => {
  const scenario = menuScenario(
    ["42/a", "42?a"].map((recordId, index) => ({
      recordId,
      collectionId: "cms-navigation",
      values: {
        title: "Menu " + index,
        permalink: "/item-" + index,
        subitems: [],
      },
    })),
  );
  const result = await scenario.resolve();
  const rows = result.document.sharedRegionData["cms-footer@1"].items;
  assert.notEqual(rows[0].__id, rows[1].__id);
  assert.deepEqual(
    validateRepeaterRows(
      rows,
      menuWidget.repeaters[0],
      validateFieldValue,
      "items",
    ),
    [],
  );
});

test("empty CMS menus remove authored examples and arbitrary group IDs retain provider order", async () => {
  const empty = menuScenario([], "database-menu-999");
  const result = await empty.resolve();
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.document.sharedRegionData["cms-footer@1"].items, []);
  const tree = applyTemplateData(
    empty.region.componentTemplate,
    empty.region.fields,
    empty.region.repeaters,
    result.document.sharedRegionData["cms-footer@1"],
  );
  assert.ok(!JSON.stringify(tree).includes('menu-link"'));
  const scenario = menuScenario(
    ["last", "first"].map((recordId) => ({
      recordId,
      collectionId: "cms-navigation",
      values: { title: recordId, permalink: "/" + recordId, subitems: [] },
    })),
  );
  const resolved = await scenario.resolve();
  assert.deepEqual(
    resolved.document.sharedRegionData["cms-footer@1"].items.map(
      (row) => row.label,
    ),
    ["last", "first"],
  );
});

test("explicit child field mappings override parent aliases from a different CMS schema", async () => {
  const scenario = menuScenario([
    {
      recordId: "about",
      collectionId: "cms-navigation",
      values: {
        title: "About",
        permalink: "/about",
        subitems: [
          { id: "team", child_title: "Team", child_url: "/about/team" },
        ],
      },
    },
  ]);
  scenario.region.sourceBindings[0].fieldMappings.push(
    { from: "child_title", to: "children.label" },
    { from: "child_url", to: "children.url" },
  );
  const result = await scenario.resolve();
  assert.deepEqual(result.issues, []);
  const row = result.document.sharedRegionData["cms-footer@1"].items[0];
  assert.equal(row.label, "About");
  assert.equal(row.children[0].label, "Team");
  assert.equal(row.children[0].url, "/about/team");
  scenario.region.sourceBindings[0].target = {
    scope: "block",
    id: "cms-footer",
  };
  const blockResult = await scenario.resolve();
  assert.deepEqual(blockResult.issues, []);
  assert.equal(
    blockResult.document.sharedRegionData["cms-footer@1"].items[0].children[0]
      .url,
    "/about/team",
  );
});

test("only pinned shared regions resolve; an unrelated broken CMS menu cannot block this page", async () => {
  const base = {
    designSystemRef: menuWidget.designSystemRef,
    name: "Header",
    region: "header",
    componentTemplate: {
      tagName: "header",
      attributes: { "data-bd-node": "header" },
      components: [],
    },
    fields: [],
    repeaters: [],
    defaultData: {},
    archived: false,
  };
  const pinned = { ...base, ref: { id: "header", version: "1" } };
  const unrelated = {
    ...base,
    ref: { id: "other-header", version: "2" },
    sourceBindings: [
      {
        bindingId: "broken",
        target: { scope: "block", id: "other-header" },
        mode: "selection",
        providerId: "missing",
        collectionId: "missing",
        recordRefs: [],
        groupRef: "4",
        fieldMappings: [],
        query: null,
      },
    ],
  };
  const document = createEmptyDocument();
  document.sharedRegionRefs = [pinned.ref];
  const result = await resolveDocumentSources(
    document,
    new Map(),
    [],
    [pinned, unrelated],
  );
  assert.deepEqual(result.issues, []);
  const missing = await resolveDocumentSources(
    document,
    new Map(),
    [],
    [unrelated],
  );
  assert.equal(missing.issues[0].code, "SOURCE_REGION_MISSING");
  assert.ok(!missing.issues.some((issue) => issue.bindingId === "broken"));
  assert.equal(
    (await resolveDocumentSources(document, new Map(), [], [])).issues[0].code,
    "SOURCE_REGION_MISSING",
  );
});

test("CMS menu group ID resolves without record lookup and keeps its manual draft unchanged", async () => {
  const binding = {
    bindingId: "footer-4",
    target: { scope: "repeater", id: "menu.items" },
    mode: "selection",
    providerId: "cms",
    collectionId: "menus",
    recordRefs: [],
    groupRef: "4",
    schemaVersion: "1",
    query: null,
    fieldMappings: [
      { from: "label", to: "label" },
      { from: "url", to: "url" },
      { from: "children", to: "children" },
    ],
  };
  const region = {
    ref: { id: "footer", version: "1" },
    designSystemRef: menuWidget.designSystemRef,
    name: "Footer",
    region: "footer",
    componentTemplate: {
      tagName: "footer",
      attributes: { "data-bd-node": "footer" },
      components: [menuWidget.componentTemplate],
    },
    fields: [],
    repeaters: menuWidget.repeaters,
    defaultData: menuWidget.defaultData,
    sourceBindings: [binding],
    archived: false,
  };
  const document = createEmptyDocument();
  document.sharedRegionRefs = [region.ref];
  document.sharedRegionData = {
    "footer@1": structuredClone(region.defaultData),
  };
  const before = structuredClone(document);
  let group;
  const provider = {
    providerId: "cms",
    capabilities: { supported: ["resolveRecords", "recordGroups"] },
    getSchema: async () => ({
      capabilities: { recordGroups: true, recordSelection: true },
    }),
    resolveGroup: async (collection, id) => {
      group = id;
      return [
        {
          recordId: "legal",
          collectionId: collection,
          values: { label: "KVKK", url: "/kvkk", children: [] },
        },
      ];
    },
    resolveRecords: async () => {
      throw Error("group selection must not look up all records");
    },
  };
  const result = await resolveDocumentSources(
    document,
    new Map(),
    [provider],
    [region],
  );
  assert.deepEqual(result.issues, []);
  assert.equal(group, "4");
  assert.deepEqual(document, before);
  assert.equal(
    result.document.sharedRegionData["footer@1"].items[0].label,
    "KVKK",
  );
  provider.resolveGroup = async () => [
    {
      recordId: "bad",
      collectionId: "menus",
      values: {
        label: "Unsafe",
        url: "javascript:alert(1)",
        children: [
          { id: "bad-child", label: "Child", url: "javascript:alert(2)" },
        ],
      },
    },
  ];
  const unsafe = await resolveDocumentSources(
    document,
    new Map(),
    [provider],
    [region],
  );
  assert.ok(
    unsafe.issues.some((issue) => issue.code === "SOURCE_FIELD_TYPE_INVALID"),
  );
  assert.deepEqual(document, before);
  assert.equal(isSafeUrl("tel:+902561234567"), true);
});
