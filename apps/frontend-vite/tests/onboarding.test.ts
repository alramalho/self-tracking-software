import assert from "node:assert/strict";
import { test } from "node:test";
import type { DesignOption, OnboardingDraft, PlanDesign } from "@tsw/prisma/follow-through";
import {
  applyLighter,
  lighterPlan,
  scoreAt,
  whyQuestion,
} from "../src/components/onboarding/confidence/confidence.ts";
import {
  acceptContext,
  acceptGoal,
  baselineFrom,
  canSkipQuestion,
  closeTarget,
  coachOf,
  designedFacts,
  finishRequest,
  isResumable,
  newDraft,
  previousAnswer,
  reopenStage,
  screenFor,
  showsWelcome,
  startInterview,
} from "../src/components/onboarding/model.ts";
import { paywallCta, savingVsWeekly } from "../src/components/onboarding/paywall/plans.ts";
import type { CoachingPlan } from "../src/components/onboarding/types.ts";

const route = (id: "steady" | "focused", daysMin: number, daysMax: number): DesignOption => ({
  id,
  coach: id === "steady" ? "Helly" : "Oli",
  daysMin,
  daysMax,
  estimatedWeeks: id === "steady" ? 20 : 16,
  finishingDate: id === "steady" ? "2027-02-21" : "2027-01-24",
  rationale: "",
  assumptions: [],
  phases: [],
  sessions: [
    {
      date: "2026-10-05",
      activity: "running",
      quantity: 3,
      title: "Easy run",
      descriptiveGuide: "",
      targets: { durationMinutes: 29, effort: "easy", pace: null, exercise: null, sets: null, reps: null, loadKg: null, restSeconds: null, progressMeasure: "" },
    },
  ],
});

const design = (overrides: Partial<PlanDesign> = {}): PlanDesign => ({
  orientation: "OUTCOME",
  goalSpec: { metric: null, value: null, unit: null, text: null, chosenByUser: false },
  baseline: { text: "Twice a week, 5 km", measurements: [] },
  activities: [{ key: "running", title: "Running", measure: "kilometers", emoji: "🏃" }],
  preferredDays: 4,
  coachNote: null,
  fixedDate: null,
  asked: [],
  options: [route("steady", 3, 4), route("focused", 4, 5)],
  selected: "focused",
  startDate: "2026-10-05",
  ...overrides,
});

const draftAt = (overrides: Partial<OnboardingDraft>): OnboardingDraft => {
  const base = newDraft("plan-1", "Finish my first half marathon");
  return { ...base, interview: startInterview(base), ...overrides };
};

test("a saved draft reopens on the same screen, on web as in the app", () => {
  const interview = startInterview(newDraft("x"));
  assert.deepEqual(screenFor(draftAt({ step: "interview-finish" })), { name: "paywall" });
  assert.deepEqual(screenFor(draftAt({ step: "confidence" })), { name: "confidence" });
  assert.deepEqual(screenFor(draftAt({ step: "coaching-tour-2" })), { name: "coach", step: 2 });
  assert.deepEqual(screenFor(draftAt({ step: "interview", interview: { ...interview, stage: "motivation" } })), { name: "question", stage: "motivation" });
  assert.deepEqual(screenFor(draftAt({ step: "interview", interview: { ...interview, stage: "rhythm" }, design: design() })), { name: "design" });
  assert.deepEqual(screenFor(draftAt({ step: "interview", interview: { ...interview, stage: "review" }, design: design() })), { name: "circle" });
  assert.deepEqual(
    screenFor(draftAt({ step: "interview", interview: { ...interview, stage: "review" }, design: design(), circle: { choice: "solo", wantsPace: true, wantsNearby: false, wantsAge: false } })),
    { name: "confidence" },
  );
});

test("finished drafts and old interview drafts without a design start again", () => {
  const interview = startInterview(newDraft("x"));
  assert.equal(isResumable(draftAt({ createdPlanId: "plan-1" })), false);
  assert.equal(isResumable(draftAt({ interview: { ...interview, stage: "support" } })), false);
  assert.equal(isResumable(draftAt({ interview: { ...interview, stage: "baseline" } })), true);
  assert.equal(isResumable(draftAt({ interview: { ...interview, stage: "review" }, design: design() })), true);
});

test("going back keeps what was typed, and answering again replaces it", () => {
  let state = acceptGoal(startInterview(newDraft("x")), "Finish my first half marathon", "How much do you run now?");
  assert.equal(state.question.title, "How much do you run now?");
  state = acceptContext(state, "Twice a week");
  assert.equal(state.stage, "motivation");
  const back = reopenStage(state, "baseline");
  assert.equal(back.stage, "baseline");
  assert.equal(back.question.title, "How much do you run now?");
  assert.ok(!back.confirmed.includes("baseline"));
  assert.equal(previousAnswer(state, "baseline"), "Twice a week");
  const again = acceptContext(back, "Three times a week");
  assert.equal(again.turns.filter((turn) => turn.stage === "baseline").length, 1);
  assert.equal(again.facts.baseline, "Three times a week");
});

test("an outcome needs a starting point; a habit's and the reason can be skipped", () => {
  assert.equal(canSkipQuestion("baseline", design()), false);
  assert.equal(canSkipQuestion("baseline", design({ orientation: "CONSISTENCY" })), true);
  assert.equal(canSkipQuestion("motivation", design()), true);
  assert.equal(canSkipQuestion("goal", design({ orientation: "CONSISTENCY" })), false);
});

test("a chosen route sets the weekly target, finish date, first step and coach", () => {
  const facts = designedFacts(design());
  assert.equal(facts.frequency, 4);
  assert.equal(facts.targetDate, "2027-01-24");
  assert.equal(facts.coachingRole, "training");
  assert.match(facts.nextStep, /^Easy run: 3 kilometers on 2026-10-05/);
  assert.equal(coachOf(design(), "Helly"), "Oli");

  const habit = designedFacts(design({ orientation: "CONSISTENCY", options: [], selected: null, preferredDays: 3 }));
  assert.equal(habit.frequency, 3);
  assert.equal(habit.targetDate, null);
  assert.equal(habit.coachingRole, "consistency");
  assert.equal(coachOf(design({ options: [], selected: null }), "Helly"), "Helly");
});

test("free tracking finishes without coaching, check-ins or the weekly review", () => {
  const request = finishRequest(
    draftAt({
      coaching: { role: "training", followUps: true, dataAccess: { workouts: true, sleep: false } },
      preferences: { coaching: true, reminder: false, reminderMinutes: 30, dayReminderTime: "09:00", checkIn: true, checkInTime: "10:00", weeklyReview: true, reviewDay: 0, reviewTime: "18:00" },
    }),
    false,
  );
  assert.equal(request.draft.wantsCoaching, false);
  assert.equal(request.draft.coaching?.role, "tracking");
  assert.deepEqual([request.preferences.coaching, request.preferences.checkIn, request.preferences.weeklyReview], [false, false, false]);
  assert.equal(finishRequest(draftAt({ preferences: request.preferences }), true).preferences.coaching, true);
});

test("an unsure score offers Helly's route or one time fewer, then asks what would make it a 7", () => {
  assert.equal(whyQuestion(8), "Why an 8, and not a 5?");
  assert.equal(whyQuestion(7), "Why a 7, and not a 4?");
  assert.equal(whyQuestion(5), "What would make it a 7?");
  const lighter = lighterPlan(design());
  assert.deepEqual(lighter, { kind: "other-route", route: "steady", daysMin: 3, daysMax: 4 });
  assert.equal(applyLighter(design(), lighter!).selected, "steady");
  assert.equal(lighterPlan(design({ selected: "steady" })), null);
  assert.deepEqual(lighterPlan(design({ orientation: "CONSISTENCY", options: [], selected: null, preferredDays: 4 })), { kind: "fewer-days", days: 3 });
  assert.equal(lighterPlan(design({ orientation: "CONSISTENCY", options: [], selected: null, preferredDays: 1 })), null);
});

test("the dial maps the left end to 1 and the right end to 10", () => {
  assert.equal(scoreAt(0, 100, 150, 100), 1);
  assert.equal(scoreAt(300, 100, 150, 100), 10);
  assert.equal(scoreAt(150, 0, 150, 100), 5);
});

test("the paywall shows the trial in the button and the saving against weekly", () => {
  const plan = (id: CoachingPlan["id"], amount: number, interval: string, intervalCount: number, trialDays = 0): CoachingPlan => ({
    id,
    amount,
    interval,
    intervalCount,
    trialDays,
    currency: "eur",
  });
  const weekly = plan("weekly", 499, "week", 1);
  const quarterly = plan("quarterly", 2499, "month", 3, 7);
  assert.equal(paywallCta(quarterly), "Start my 7 free days");
  assert.equal(paywallCta(weekly), "Start coaching");
  assert.equal(savingVsWeekly(quarterly, [quarterly, weekly]), 61);
  assert.equal(savingVsWeekly(weekly, [quarterly, weekly]), 0);
});

test("creating a plan in the app skips the welcome and closes back to the plans", () => {
  assert.equal(showsWelcome("", "onboarding"), true);
  assert.equal(showsWelcome("Run a half marathon", "onboarding"), false);
  assert.equal(showsWelcome("", "create"), false);
  assert.equal(closeTarget("create", true), "/plans");
  assert.equal(closeTarget("onboarding", true), "/");
  assert.equal(closeTarget("onboarding", false), null);
});

test("numbers from the logs stay with the starting point only while its text is unchanged", () => {
  const logged = {
    text: "Running: 9 sessions in the last 4 weeks, about 2.3 a week.",
    measurements: [{ metric: "sessions_per_week", value: 2.3, unit: "per week", sourceQuote: "from your logs, last 4 weeks" }],
  };
  assert.deepEqual(baselineFrom(`${logged.text}  `, logged), { text: logged.text, measurements: logged.measurements });
  assert.deepEqual(baselineFrom("I run twice a week", logged), { text: "I run twice a week", measurements: [] });
  assert.deepEqual(baselineFrom("I run twice a week", null).measurements, []);
});
