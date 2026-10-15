import test from "node:test";
import assert from "node:assert/strict";
import { stopEditingInteractions } from "./preview.ts";

function interactionEvent(type, target) {
  const calls = { prevented: false, stopped: false, immediate: false };
  return {
    calls,
    event: {
      type,
      target,
      preventDefault() {
        calls.prevented = true;
      },
      stopPropagation() {
        calls.stopped = true;
      },
      stopImmediatePropagation() {
        calls.immediate = true;
      },
    },
  };
}

test("preview disclosure uses iframe-safe target detection and toggles details", () => {
  const details = { open: false };
  const summary = {
    closest: (selector) => (selector === "details" ? details : null),
  };
  const target = {
    nodeType: 1,
    closest: (selector) => (selector === "summary" ? summary : null),
  };
  const { event, calls } = interactionEvent("click", target);

  stopEditingInteractions(event, true);

  assert.equal(details.open, true);
  assert.deepEqual(calls, { prevented: true, stopped: false, immediate: true });
});

test("preview suppresses edit selection on disclosure press without cancelling it", () => {
  const target = {
    nodeType: 1,
    closest: (selector) => (selector === "summary" ? {} : null),
  };
  const { event, calls } = interactionEvent("mousedown", target);

  stopEditingInteractions(event, true);

  assert.deepEqual(calls, {
    prevented: false,
    stopped: true,
    immediate: false,
  });
});

test("editing prevents anchor and summary activation in the canvas", () => {
  const anchor = {
    nodeType: 1,
    closest: (selector) => (selector === "a, summary" ? {} : null),
  };
  const { event, calls } = interactionEvent("click", anchor);

  stopEditingInteractions(event, false);

  assert.equal(calls.prevented, true);
});
