import { test } from "node:test";
import assert from "node:assert/strict";
import { messageReferences } from "../src/features/messages/entities/references";
import type { Message } from "../src/features/messages/types";
const message: Message = {
  id: "test",
  role: "COACH",
  content: "",
  createdAt: "2026-09-13",
  planReplacements: [
    {
      textToReplace: "train weekly",
      plan: { id: "p", goal: "train weekly", emoji: "💪" },
    },
  ],
};
test("legacy plan replacement includes surrounding emoji and markdown exactly once", () => {
  const content = 'Review **"💪 train weekly"** then rest.';
  const result = messageReferences(content, message);
  assert.equal(result.length, 1);
  assert.equal(
    content.slice(result[0].start, result[0].end),
    '**"💪 train weekly"**',
  );
});
test("DSL takes precedence over duplicate legacy metadata; repeated mentions keep their position", () => {
  const result = messageReferences(
    "{{plan:p|train weekly}} and {{plan:p|train weekly}}",
    message,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].reference.kind, "plan");
  assert.ok(result[1].start >= result[0].end);
});
test("metric has priority over overlapping plan text", () => {
  const result = messageReferences("train weekly", {
    ...message,
    metricReplacement: {
      textToReplace: "train weekly",
      metric: { id: "m", title: "Mood" },
      rating: 3,
    },
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].reference.kind, "metric");
});
