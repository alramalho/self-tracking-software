import { test } from "node:test";
import assert from "node:assert/strict";
import type { DesignOption, PlanDesign } from "@tsw/prisma/follow-through";
import {
  applyLighter,
  confidenceFor,
  confidenceLabel,
  lighterMessage,
  lighterPlan,
  voiceLevel,
  whyQuestion,
} from "../src/features/onboarding/design/confidence";

const route = (id: "steady" | "focused", coach: "Helly" | "Oli", daysMin: number, daysMax: number) =>
  ({ id, coach, daysMin, daysMax }) as DesignOption;

const design = (patch: Partial<PlanDesign>) =>
  ({ orientation: "OUTCOME", preferredDays: 4, options: [route("steady", "Helly", 3, 4), route("focused", "Oli", 4, 5)], selected: "focused", ...patch }) as PlanDesign;

test("sure of it: asks why it isn't lower", () => {
  assert.equal(whyQuestion(7), "Why a 7, and not a 4?");
  assert.equal(whyQuestion(8), "Why an 8, and not a 5?");
  assert.equal(whyQuestion(10), "Why a 10, and not a 7?");
});

test("still unsure: asks what would get them to sure", () => {
  assert.equal(whyQuestion(6), "What would make it a 7?");
  assert.equal(whyQuestion(1), "What would make it a 7?");
});

test("labels the dial in plain words", () => {
  assert.deepEqual([1, 4, 7, 10].map(confidenceLabel), ["Not sure yet", "Somewhat sure", "Pretty sure", "Certain"]);
});

test("someone unsure of Oli's route is offered Helly's", () => {
  assert.deepEqual(lighterPlan(design({})), { kind: "other-route", route: "steady", daysMin: 3, daysMax: 4 });
});

test("Helly's route is already the lighter one: fewer days would mean new weeks, so nothing is offered", () => {
  assert.equal(lighterPlan(design({ selected: "steady" })), null);
});

test("taking the lighter plan switches the route, or lowers the habit's weekly number", () => {
  assert.equal(applyLighter(design({}), { kind: "other-route", route: "steady", daysMin: 3, daysMax: 4 }).selected, "steady");
  assert.equal(applyLighter(design({ orientation: "CONSISTENCY" }), { kind: "fewer-days", days: 3 }).preferredDays, 3);
});

test("a habit gets one time fewer a week, never below one", () => {
  assert.deepEqual(lighterPlan(design({ orientation: "CONSISTENCY", options: [], selected: null, preferredDays: 3 })), { kind: "fewer-days", days: 2 });
  assert.equal(lighterPlan(design({ orientation: "CONSISTENCY", options: [], selected: null, preferredDays: 1 })), null);
});

test("the offer names what changes", () => {
  assert.match(lighterMessage({ kind: "other-route", route: "steady", daysMin: 3, daysMax: 4 }), /^Helly’s route gets you there with 3–4 days a week/);
  assert.match(lighterMessage({ kind: "fewer-days", days: 1 }), /^How about 1 time a week\?/);
});

test("stores the score with the person's words and the question they answered", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  assert.deepEqual(confidenceFor(8, "  I've done it before ", whyQuestion(8), now), {
    score: 8,
    why: "I've done it before",
    question: "Why an 8, and not a 5?",
    askedAt: "2026-10-15T10:00:00.000Z",
  });
});

test("voice level maps decibels to 0–1", () => {
  assert.equal(voiceLevel(undefined), 0);
  assert.equal(voiceLevel(-160), 0);
  assert.equal(voiceLevel(0), 1);
  assert.ok(voiceLevel(-25) > 0.4 && voiceLevel(-25) < 0.7);
});
