import assert from "node:assert/strict";
import test from "node:test";
import { makeInstance } from "@blockdesign/core";
import { MemoryBlockLibraryAdapter } from "@blockdesign/adapters";
import {
  bindingMatchesTarget,
  createSourcePreviewResolver,
  effectiveSourceBinding,
  mergeSourcePreview,
  preferredSourceTarget,
  resolveBlockSourcePreview,
} from "./source-preview.ts";
import { blockSettingsVersion } from "./block-settings.ts";
import {
  definition,
  provider,
  records,
  sourceBinding,
} from "./test-fixtures/source-preview.js";

test("live preview renders all selected repeater records while retaining manual instance data", async () => {
  const block = makeInstance(definition);
  block.sourceBindings = [sourceBinding()];
  const original = structuredClone(block);
  const result = await resolveBlockSourcePreview(block, definition, [provider]);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    result.block.manualData.items.map((row) => row.title),
    records.map((record) => record.values.title),
  );
  assert.deepEqual(block, original);
});
test("whole-block source works despite an authoring root id, and explicit manual binding takes precedence", async () => {
  const block = makeInstance(definition);
  block.sourceBindings = [sourceBinding("block")];
  assert.equal(
    bindingMatchesTarget(block.sourceBindings[0], {
      scope: "block",
      id: definition.ref.id,
    }),
    true,
  );
  assert.equal(
    preferredSourceTarget(
      [
        { scope: "field", id: "heading" },
        { scope: "block", id: definition.ref.id },
      ],
      block.sourceBindings,
    ),
    definition.ref.id,
  );
  const result = await resolveBlockSourcePreview(block, definition, [provider]);
  assert.equal(result.block.manualData.items.length, 3);
  block.sourceBindings.push({ ...sourceBinding(), mode: "manual" });
  assert.equal(
    effectiveSourceBinding(block, definition.repeaters[0]).mode,
    "manual",
  );
  const manual = await resolveBlockSourcePreview(block, definition, [provider]);
  assert.deepEqual(manual.block.manualData, block.manualData);
});
test("failed sources keep the manual canvas content and return an actionable issue", async () => {
  const block = makeInstance(definition);
  block.sourceBindings = [sourceBinding()];
  const result = await resolveBlockSourcePreview(block, definition, []);
  assert.deepEqual(result.block.manualData, block.manualData);
  assert.equal(result.issues[0].code, "SOURCE_UNAVAILABLE");
});
test("an older, slow provider response cannot override a newer source selection", async () => {
  const pending = [];
  const resolver = createSourcePreviewResolver(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const block = makeInstance(definition);
  const old = resolver.request(block, definition, []),
    newer = resolver.request(block, definition, []);
  pending[1]({ block, issues: [], marker: "new" });
  assert.equal((await newer).marker, "new");
  pending[0]({ block, issues: [], marker: "old" });
  assert.equal(await old, null);
});
test("live projections do not mask a concurrently edited manual field or an explicit manual repeater", () => {
  const def = {
    ...definition,
    fields: [
      {
        fieldId: "heading",
        key: "heading",
        label: "Başlık",
        type: "text",
        required: false,
        defaultValue: "",
        mappingTarget: { nodeId: "heading", operation: "text" },
      },
    ],
  };
  const block = makeInstance(def);
  block.manualData.heading = "Yeni manuel başlık";
  block.sourceBindings = [sourceBinding()];
  const resolved = structuredClone(block);
  resolved.manualData.heading = "Eski manuel başlık";
  resolved.manualData.items = [];
  assert.equal(
    mergeSourcePreview(block, def, resolved).manualData.heading,
    "Yeni manuel başlık",
  );
  block.sourceBindings[0].mode = "manual";
  assert.deepEqual(
    mergeSourcePreview(block, def, resolved).manualData.items,
    block.manualData.items,
  );
});
test("renamed catalog version persists default source settings and reinserted blocks resolve them", async () => {
  const block = makeInstance(definition);
  block.sourceBindings = [sourceBinding("block")];
  const library = new MemoryBlockLibraryAdapter([definition]);
  const next = blockSettingsVersion(
    definition,
    block,
    " Blog kartları ",
    "1.0.1",
    true,
  );
  const saved = await library.getVersion(await library.create(next));
  assert.equal(saved.name, "Blog kartları");
  assert.equal(
    (await library.getVersion(definition.ref)).name,
    "Hafta sonu rotaları",
  );
  assert.deepEqual(saved.defaultData, block.manualData);
  assert.equal(saved.defaultSourceBindings[0].target.id, definition.ref.id);
  const reinserted = makeInstance(saved);
  assert.equal(
    (await resolveBlockSourcePreview(reinserted, saved, [provider])).block
      .manualData.items.length,
    3,
  );
});
test("renaming from a page keeps catalog defaults rather than capturing page-specific content", () => {
  const block = makeInstance(definition);
  block.manualData.items = [];
  block.sourceBindings = [sourceBinding()];
  const next = blockSettingsVersion(
    definition,
    block,
    "Yeni ad",
    "1.0.1",
    false,
  );
  assert.deepEqual(next.defaultData, definition.defaultData);
  assert.deepEqual(
    next.defaultSourceBindings,
    definition.defaultSourceBindings,
  );
  assert.throws(
    () => blockSettingsVersion(definition, block, " ", "1.0.1", false),
    /Blok adı gerekli/,
  );
});
