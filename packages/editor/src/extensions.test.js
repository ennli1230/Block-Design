import assert from "node:assert/strict";
import test from "node:test";
import { collectExtensions } from "./extensions.ts";
import { createPageHead } from "./page-metadata.ts";
test("extension registry rejects duplicate IDs, field editor collisions and unsupported API versions", () => {
  const extension = {
    id: "host.fields",
    version: "1.0.0",
    apiVersion: 1,
    fieldEditors: { text: { mount: () => () => {} } },
  };
  assert.throws(() => collectExtensions([extension, extension]), /kimliği/);
  assert.throws(
    () => collectExtensions([{ ...extension, apiVersion: 2 }]),
    /API/,
  );
  assert.throws(
    () => collectExtensions([extension, { ...extension, id: "other" }]),
    /iki editör/,
  );
  assert.ok(collectExtensions([extension]).fieldEditors.text);
});
test("extension validation cannot mutate the canonical document", () => {
  const doc = { title: "original" };
  const registry = collectExtensions([
    {
      id: "host.validation",
      version: "1.0.0",
      apiVersion: 1,
      validate: (input) => {
        input.title = "changed";
        return [{ code: "HOST_RULE", message: "Blocked", recoverable: true }];
      },
    },
  ]);
  assert.equal(registry.validate(doc)[0].code, "HOST_RULE");
  assert.equal(doc.title, "original");
});
test("SEO metadata escapes attributes and JSON-LD script boundaries and refuses active image URLs", () => {
  const head = createPageHead({
    title: "<title>",
    ogImage: "/image.jpg",
    robots: "noindex",
    structuredData: { name: "</script><script>evil()</script>" },
  });
  assert.match(head, /&lt;title&gt;/);
  assert.match(head, /og:image/);
  assert.match(head, /\\u003c/);
  assert.doesNotMatch(head, /<script>evil/);
  assert.throws(() => createPageHead({ ogImage: "javascript:evil()" }), /HTTP/);
});
