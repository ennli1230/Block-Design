import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, mock, test } from "node:test";
import {
  DemoCmsFormProvider,
  DemoFormOptionsProvider,
  DemoCmsFormAction,
} from "./cms-forms.ts";
import {
  loadFormOptions,
  validateFormDefinition,
} from "../../../packages/core/src/forms.ts";

const base = new URL("../public/cms-forms/", import.meta.url);
function jsonFetch() {
  const calls = [];
  mock.method(globalThis, "fetch", async (url, init) => {
    calls.push(String(url));
    init?.signal?.throwIfAborted();
    assert.ok(String(url).startsWith("/cms-forms/"));
    try {
      return new Response(
        await readFile(new URL(String(url).slice("/cms-forms/".length), base)),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch {
      return new Response("{}", { status: 404 });
    }
  });
  return calls;
}
afterEach(() => mock.restoreAll());

test("the selector reads seven versioned JSON schemas, each with its original purpose", async () => {
  const calls = jsonFetch();
  const provider = new DemoCmsFormProvider();
  const catalog = await provider.listForms();
  assert.equal(catalog.items.length, 7);
  const schemas = await Promise.all(
    catalog.items.map((item) => provider.getDefinition(item.ref)),
  );
  for (const schema of schemas) validateFormDefinition(schema);
  const fields = Object.fromEntries(
    schemas.map((schema) => [
      schema.ref.id,
      schema.fields.map((field) => field.fieldId),
    ]),
  );
  assert.ok(fields.transfer.includes("pickup-time"));
  assert.ok(!fields.transfer.includes("tour"));
  assert.ok(fields.shore.includes("ship-name"));
  assert.ok(fields.partner.includes("company"));
  assert.ok(fields.travel.includes("pace"));
  assert.deepEqual(fields.search, ["destination", "tour"]);
  assert.ok(calls.includes("/cms-forms/transfer/1.1.0.json"));
  // Old pinned pages/templates remain readable; the current selector lists only new schemas.
  for (const item of catalog.items)
    validateFormDefinition(
      await provider.getDefinition({ id: item.ref.id, version: "1.0.0" }),
    );
});

test("remote JSON options filter tours by destination and support pagination and cancellation", async () => {
  jsonFetch();
  const provider = new DemoCmsFormProvider(),
    options = new DemoFormOptionsProvider();
  const booking = await provider.getDefinition({
    id: "booking",
    version: "1.1.0",
  });
  const tours = booking.fields.find((field) => field.fieldId === "tour");
  const efes = await loadFormOptions(tours, { destination: "efes" }, [options]);
  assert.deepEqual(
    efes.items.map((item) => item.value),
    ["efes-private", "efes-shore"],
  );
  const pamukkale = await loadFormOptions(tours, { destination: "pamukkale" }, [
    options,
  ]);
  assert.deepEqual(
    pamukkale.items.map((item) => item.value),
    ["pamukkale-private"],
  );
  assert.equal(
    (await options.search("destinations", "", "2")).items[0].recordId,
    "pamukkale",
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    provider.getDefinition(booking.ref, { signal: abort.signal }),
    { name: "AbortError" },
  );
  await assert.rejects(
    provider.getDefinition({ id: "missing", version: "1.1.0" }),
    /404/,
  );
});

test("the demo action validates against the fetched JSON definition", async () => {
  jsonFetch();
  const action = new DemoCmsFormAction();
  const input = {
    providerId: "demo-cms",
    formRef: { id: "transfer", version: "1.1.0" },
    actionId: "transfer",
    kind: "submit",
    context: {},
    submissionId: "transfer-test",
    values: {},
  };
  const invalid = await action.execute(input);
  assert.equal(invalid.kind, "validationError");
  assert.ok(invalid.fieldErrors.pickup);
  assert.ok(!invalid.fieldErrors.tour);
  const valid = {
    ...input,
    values: {
      pickup: "izmir-airport",
      dropoff: "Kuşadası oteli",
      "travel-date": "2027-06-20",
      "pickup-time": "14:30",
      guests: 2,
      email: "ornek@example.test",
      "flight-number": "",
    },
  };
  const result = await action.execute(valid);
  assert.equal(result.kind, "accepted");
  assert.deepEqual(await action.execute(valid), result);
});
