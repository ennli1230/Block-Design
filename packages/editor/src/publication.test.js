import assert from "node:assert/strict";
import test from "node:test";
import { assessPublication, assertPublishable } from "./publication.ts";
test("publication fails closed for unknown or blocking issues, while explicit warnings remain reviewable", () => {
  assert.equal(assessPublication({ issues: [] }).allowed, true);
  for (const code of [
    "FORM_PUBLICATION_UNCONFIGURED",
    "COLLECTION_PUBLICATION_UNCONFIGURED",
    "SOURCE_RESOLUTION_FAILED",
    "UNKNOWN",
  ]) {
    const output = { issues: [{ code, message: "needs attention" }] };
    assert.equal(assessPublication(output).allowed, false);
    assert.throws(() => assertPublishable(output), /needs attention/);
  }
  assert.equal(
    assessPublication({
      issues: [
        {
          code: "SOURCE_LOCALE_FALLBACK",
          message: "fallback",
          severity: "warning",
        },
      ],
    }).allowed,
    true,
  );
});
