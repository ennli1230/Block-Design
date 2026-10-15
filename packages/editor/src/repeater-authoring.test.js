import assert from "node:assert/strict";
import test from "node:test";
import { applyTemplateData, findTemplateNode } from "@blockdesign/core";
import {
  completeRepeaterFields,
  inferRepeaterSelection,
  repeaterItems,
  seedRepeaterRows,
} from "./repeater-authoring.ts";

const node = (tagName, id, components = [], attributes = {}) => ({
  tagName,
  attributes: { "data-bd-node": id, ...attributes },
  components,
});
const text = (content) => ({ type: "textnode", content });
function cards() {
  const card = (id, title, image, url) =>
    node(
      "article",
      id,
      [
        node("img", `${id}-image`, [], { src: image, alt: `${title} görseli` }),
        node(
          "div",
          `${id}-body`,
          [
            node("h3", `${id}-title`, [text(title)]),
            node("p", `${id}-description`, [text(`${title} açıklaması`)]),
            node("a", `${id}-link`, [text("Rotayı incele")], { href: url }),
          ],
          { class: "route-copy" },
        ),
      ],
      { class: "route-card" },
    );
  return node("section", "section", [
    node("h2", "section-title", [text("Kısa kaçamaklar")]),
    node(
      "div",
      "grid",
      [
        text("\n  "),
        card("first", "Kapadokya", "/kapadokya.jpg", "/kapadokya"),
        text("\n"),
        card("second", "Kaçkarlar", "/kackarlar.jpg", "/kackarlar"),
      ],
      { class: "route-grid" },
    ),
  ]);
}
const titleField = {
  fieldId: "card-title",
  key: "title",
  label: "Kart başlığı",
  type: "text",
  required: false,
  defaultValue: "Kapadokya",
  mappingTarget: { nodeId: "first-title", operation: "text" },
};

test("selecting a card, its image, or the grid finds the card collection rather than card internals", () => {
  for (const selected of ["first", "first-image", "first-title", "grid"]) {
    assert.deepEqual(inferRepeaterSelection(cards(), selected), {
      containerNodeId: "grid",
      itemNodeId: "first",
      count: 2,
    });
  }
  assert.equal(inferRepeaterSelection(cards(), "section-title"), null);
});

test("conversion preserves both existing cards, images, links and section content in rendered output", () => {
  const template = cards(),
    before = structuredClone(template);
  const fields = completeRepeaterFields(template, "first", [titleField]);
  assert.equal(
    fields.filter((field) => field.mappingTarget.nodeId === "first-title")
      .length,
    1,
  );
  assert.equal(
    fields.find((field) => field.key === "title").fieldId,
    "card-title",
  );
  const rows = seedRepeaterRows(template, "grid", "first", fields);
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.__id)).size, 2);
  const repeater = {
    repeaterId: "cards",
    key: "cards",
    label: "Kartlar",
    minItems: 0,
    maxItems: 100,
    itemFields: fields,
    nesting: "none",
    mappingTarget: {
      containerNodeId: "grid",
      itemNodeId: "first",
      replaceChildren: true,
    },
  };
  const rendered = applyTemplateData(template, [], [repeater], { cards: rows });
  const renderedItems = findTemplateNode(rendered, "grid").components;
  assert.equal(renderedItems.length, 2);
  assert.equal(
    findTemplateNode(rendered, "section-title").components[0].content,
    "Kısa kaçamaklar",
  );
  assert.deepEqual(
    renderedItems.map(
      (item) => findTemplateNode(item, "first-title").components[0].content,
    ),
    ["Kapadokya", "Kaçkarlar"],
  );
  assert.deepEqual(
    renderedItems.map(
      (item) => findTemplateNode(item, "first-image").attributes.src,
    ),
    ["/kapadokya.jpg", "/kackarlar.jpg"],
  );
  assert.deepEqual(
    renderedItems.map(
      (item) => findTemplateNode(item, "first-link").attributes.href,
    ),
    ["/kapadokya", "/kackarlar"],
  );
  assert.deepEqual(template, before);
});

test("choosing the second card as sample keeps DOM order and uses edited sample values only for that card", () => {
  const template = cards();
  const fields = completeRepeaterFields(template, "second", []);
  const title = fields.find(
    (field) => field.mappingTarget.nodeId === "second-title",
  );
  const rows = seedRepeaterRows(template, "grid", "second", fields, {
    [title.key]: "Yeni Kaçkarlar başlığı",
  });
  assert.deepEqual(
    rows.map((row) => row[title.key]),
    ["Kapadokya", "Yeni Kaçkarlar başlığı"],
  );
});

test("rejects using a card itself or a heading-containing section as the list container", () => {
  assert.throws(
    () => repeaterItems(cards(), "first", "first-image"),
    /farklı öğeler/,
  );
  assert.throws(
    () => repeaterItems(cards(), "section", "grid"),
    /farklı öğeler/,
  );
  assert.throws(
    () =>
      seedRepeaterRows(cards(), "grid", "first", [
        {
          ...titleField,
          mappingTarget: { nodeId: "section-title", operation: "text" },
        },
      ]),
    /örnek kartın içinde/,
  );
});

test("a collection with a single template card can still become a repeater", () => {
  const template = cards();
  findTemplateNode(template, "grid").components = [
    findTemplateNode(template, "first"),
  ];
  assert.deepEqual(inferRepeaterSelection(template, "first-title"), {
    containerNodeId: "grid",
    itemNodeId: "first",
    count: 1,
  });
});
