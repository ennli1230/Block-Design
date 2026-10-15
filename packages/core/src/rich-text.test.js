import assert from "node:assert/strict";
import test from "node:test";
import { parseRichText } from "./rich-text.ts";
import { applyTemplateData } from "./schema.ts";
test("rich text preserves a small formatting subset without accepting scripts, event attributes or unsafe links", () => {
  const nodes = parseRichText(
    '<p>Hello <strong>world</strong> &amp; <a href="https://example.com" onclick="evil()">link</a><img src=x onerror=evil()><a href="javascript:evil()">bad</a><script>evil()</script></p>',
  );
  const text = JSON.stringify(nodes);
  assert.match(text, /strong/);
  assert.match(text, /https:\/\/example.com/);
  assert.doesNotMatch(
    text,
    /onclick|onerror|javascript:|"tagName":"script"|"tagName":"img"/,
  );
  assert.match(text, /Hello/);
});
test("safeRichText maps canonical formatting nodes while ordinary text stays literal", () => {
  const template = {
    tagName: "div",
    attributes: { "data-bd-node": "copy" },
    components: [],
  };
  const field = {
    key: "body",
    fieldId: "body",
    label: "Body",
    type: "richText",
    required: false,
    defaultValue: "",
    mappingTarget: { nodeId: "copy", operation: "safeRichText" },
  };
  const output = applyTemplateData(template, [field], [], {
    body: "<strong>bold</strong>",
  });
  assert.equal(output.components[0].tagName, "strong");
  const plain = applyTemplateData(
    template,
    [{ ...field, mappingTarget: { nodeId: "copy", operation: "text" } }],
    [],
    { body: "<strong>bold</strong>" },
  );
  assert.equal(plain.components[0].content, "<strong>bold</strong>");
});
