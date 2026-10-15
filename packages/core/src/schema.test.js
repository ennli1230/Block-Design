import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTemplateData,
  cloneBlockInstance,
  createEmptyDocument,
  makeInstance,
  normalizeRepeaterRows,
  resolveDocumentSources,
  validateBlock,
  validateDocument,
} from "./index.ts";
import { menuWidget } from "./composable.ts";

test('false native boolean attributes are absent so unselected options stay unselected', () => {
  const template={tagName:'option',attributes:{'data-bd-node':'option',selected:true},components:['Efes']};
  const field={fieldId:'selected',key:'selected',label:'Seçili',type:'boolean',defaultValue:false,mappingTarget:{nodeId:'option',operation:'attribute',property:'selected'}};
  assert.equal('selected' in applyTemplateData(template,[field],[],{selected:false}).attributes,false);
  assert.equal(applyTemplateData(template,[field],[],{selected:true}).attributes.selected,true);
  assert.equal(template.attributes.selected,true);
});

test('mixed text segment updates preserve nested links and emphasis without adding wrapper elements', () => {
  const template={tagName:'p',attributes:{'data-bd-node':'copy'},components:[{type:'textnode',content:'Başlangıç '},{tagName:'strong',attributes:{'data-bd-node':'emphasis'},components:[{type:'textnode',content:'önemli'}]},{type:'textnode',content:' ve '},{tagName:'a',attributes:{href:'/iletisim'},components:['bağlantı']}]};
  const field={fieldId:'copy.lead',key:'lead',label:'Metin',type:'text',required:false,defaultValue:'Başlangıç ',mappingTarget:{nodeId:'copy',operation:'textSegment',property:'0'}};
  const result=applyTemplateData(template,[field],[],{lead:'Yeni metin '});
  assert.equal(result.components[0].content,'Yeni metin ');assert.equal(result.components[1].tagName,'strong');assert.equal(result.components[3].attributes.href,'/iletisim');assert.equal(result.components.length,4);assert.equal(template.components[0].content,'Başlangıç ');
});

function collect(value, attribute) {
  if (Array.isArray(value))
    return value.flatMap((item) => collect(item, attribute));
  if (!value || typeof value !== "object") return [];
  return [
    ...(value.attributes?.[attribute] !== undefined
      ? [value.attributes[attribute]]
      : []),
    ...collect(value.components ?? [], attribute),
  ];
}

test("menu rendering replaces both levels of authored samples while preserving per-item URLs", () => {
  const instance = makeInstance(menuWidget);
  const original = structuredClone(menuWidget.componentTemplate);
  const output = applyTemplateData(
    menuWidget.componentTemplate,
    menuWidget.fields,
    menuWidget.repeaters,
    instance.manualData,
  );
  assert.deepEqual(collect(output, "href"), ["/", "/hakkimizda", "/ekibimiz"]);
  assert.equal(collect(output, "data-bd-item").length, 3);
  assert.deepEqual(menuWidget.componentTemplate, original);
  const copy = cloneBlockInstance(instance, menuWidget);
  assert.notEqual(
    copy.manualData.items[1].children[0].__id,
    instance.manualData.items[1].children[0].__id,
  );
  copy.manualData.items[1].children[0].label = "Changed";
  assert.equal(instance.manualData.items[1].children[0].label, "Ekibimiz");
});

test("API-sourced menu children use the nested schema, keep stable identities and preserve the manual draft", async () => {
  const instance = makeInstance(menuWidget);
  instance.sourceBindings = [
    {
      bindingId: "menu-source",
      target: { scope: "repeater", id: "menu.items" },
      mode: "selection",
      providerId: "cms",
      collectionId: "menus",
      schemaVersion: "1",
      recordRefs: ["about"],
      groupRef: null,
      query: null,
      fieldMappings: [
        { from: "label", to: "label" },
        { from: "url", to: "url" },
        { from: "children", to: "children" },
      ],
    },
  ];
  const provider = {
    providerId: "cms",
    capabilities: { supported: ["resolveRecords"] },
    getSchema: async () => ({ capabilities: { recordSelection: true } }),
    resolveRecords: async () => [
      {
        recordId: "about",
        record: {
          recordId: "about",
          collectionId: "menus",
          values: {
            label: "About",
            url: "/about",
            children: [{ id: "team", label: "Team", url: "/team" }],
          },
        },
      },
    ],
  };
  const doc = createEmptyDocument();
  doc.blocks = [instance];
  const map = new Map([
    [`${menuWidget.ref.id}@${menuWidget.ref.version}`, menuWidget],
  ]);
  const before = structuredClone(doc);
  const first = await resolveDocumentSources(doc, map, [provider]);
  const second = await resolveDocumentSources(doc, map, [provider]);
  assert.deepEqual(first.issues, []);
  assert.deepEqual(
    first.document.blocks[0].manualData,
    second.document.blocks[0].manualData,
  );
  assert.equal(
    first.document.blocks[0].manualData.items[0].children[0].label,
    "Team",
  );
  assert.deepEqual(doc, before);
  assert.deepEqual(validateBlock(first.document.blocks[0], menuWidget), []);
});

test("duplicate nested item identities and unsafe submenu URLs prevent a valid save", () => {
  const instance = makeInstance(menuWidget);
  const child = instance.manualData.items[1].children[0];
  instance.manualData.items[1].children.push({
    ...child,
    url: "javascript:alert(1)",
  });
  const issues = validateBlock(instance, menuWidget);
  assert.ok(issues.some((issue) => issue.code === "REPEATER_ITEM_ID_INVALID"));
  assert.ok(issues.some((issue) => issue.code === "UNSAFE_URL"));
});

test("explicit hierarchical schemas enforce depth instead of silently flattening deep menus", () => {
  let schema = structuredClone(menuWidget.repeaters[0]);
  let current = schema;
  for (let i = 0; i < 9; i++) {
    const child = {
      ...structuredClone(menuWidget.repeaters[0]),
      key: "children",
      childRepeaters: [],
    };
    current.childRepeaters = [child];
    current = child;
  }
  assert.throws(
    () =>
      normalizeRepeaterRows(
        [
          {
            label: "Root",
            url: "/",
            children: [{ label: "Child", url: "/child" }],
          },
        ],
        schema,
      ),
    /düzey/,
  );
});

test("shared header sources render nested menus in saved GrapesJS frame documents without mutating them", async () => {
  const region = {
    ref: { id: "header-menu", version: "1.0.0" },
    designSystemRef: menuWidget.designSystemRef,
    name: "Header",
    region: "header",
    componentTemplate: {
      tagName: "header",
      attributes: { "data-bd-node": "header" },
      components: [menuWidget.componentTemplate],
    },
    fields: [],
    repeaters: menuWidget.repeaters,
    defaultData: menuWidget.defaultData,
    sourceBindings: [
      {
        bindingId: "header-source",
        target: { scope: "repeater", id: "menu.items" },
        mode: "selection",
        providerId: "cms",
        collectionId: "menus",
        schemaVersion: "1",
        recordRefs: ["about"],
        groupRef: null,
        query: null,
        fieldMappings: [
          { from: "label", to: "label" },
          { from: "url", to: "url" },
          { from: "children", to: "children" },
        ],
      },
    ],
  };
  const doc = createEmptyDocument();
  doc.projectData = {
    pages: [
      {
        frames: [
          {
            component: {
              type: "wrapper",
              components: [
                {
                  tagName: "header",
                  attributes: { "data-bd-region-ref": "header-menu@1.0.0" },
                  components: [],
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const before = structuredClone(doc);
  const provider = {
    providerId: "cms",
    capabilities: { supported: ["resolveRecords"] },
    getSchema: async () => ({ capabilities: { recordSelection: true } }),
    resolveRecords: async () => [
      {
        recordId: "about",
        record: {
          recordId: "about",
          collectionId: "menus",
          values: {
            label: "About",
            url: "/about",
            children: [{ id: "contact", label: "Contact", url: "/contact" }],
          },
        },
      },
    ],
  };
  const result = await resolveDocumentSources(
    doc,
    new Map(),
    [provider],
    [region],
  );
  assert.deepEqual(result.issues, []);
  assert.ok(
    collect(
      result.document.projectData.pages[0].frames[0].component,
      "href",
    ).includes("/contact"),
  );
  assert.deepEqual(doc, before);
});

test("legacy document envelopes remain readable and future versions are rejected", () => {
  const doc = createEmptyDocument();
  doc.documentVersion = 1;
  assert.deepEqual(validateDocument(doc, new Map()), []);
  doc.documentVersion = 999;
  assert.ok(
    validateDocument(doc, new Map()).some(
      (issue) => issue.code === "UNSUPPORTED_DOCUMENT_VERSION",
    ),
  );
});

test("malformed nested source records produce a report instead of crashing the editor", async () => {
  const instance = makeInstance(menuWidget);
  instance.sourceBindings = [
    {
      bindingId: "broken-menu",
      target: { scope: "repeater", id: "menu.items" },
      mode: "selection",
      providerId: "cms",
      collectionId: "menus",
      schemaVersion: "1",
      recordRefs: ["about"],
      groupRef: null,
      query: null,
      fieldMappings: [{ from: "children", to: "children" }],
    },
  ];
  const doc = createEmptyDocument();
  doc.blocks = [instance];
  const provider = {
    providerId: "cms",
    capabilities: { supported: ["resolveRecords"] },
    getSchema: async () => ({ capabilities: { recordSelection: true } }),
    resolveRecords: async () => [
      {
        recordId: "about",
        record: {
          recordId: "about",
          collectionId: "menus",
          values: { children: ["invalid"] },
        },
      },
    ],
  };
  const result = await resolveDocumentSources(
    doc,
    new Map([[`${menuWidget.ref.id}@${menuWidget.ref.version}`, menuWidget]]),
    [provider],
  );
  assert.ok(
    result.issues.some((issue) => issue.code === "SOURCE_FIELD_TYPE_INVALID"),
  );
});
