import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  InterviewState,
  InterviewResult,
} from "@tsw/prisma/follow-through";
const generate = vi.hoisted(() => vi.fn());
vi.mock("../../../aiService", () => ({
  aiService: { generateStructuredResponse: generate },
}));
const realistic = vi.hoisted(() => vi.fn());
vi.mock("./guidance", () => ({ goalLooksRealistic: realistic }));
import { interview, enforceInterviewResult } from "./service";
import { interviewRequestSchema } from "./schema";
import type { InterviewContext } from "./types";
const state: InterviewState = {
  version: 1,
  stage: "goal",
  confirmed: [],
  turns: [],
  question: { title: "What do you want to achieve?", purpose: "", options: [] },
  facts: {
    goal: "",
    goalReason: "",
    baseline: "",
    emoji: "🎯",
    activityTitle: "",
    measure: "sessions",
    frequency: 3,
    commitment: "WEEKLY",
    weekdays: [],
    time: null,
    targetDate: null,
    resourceName: "",
    resourceUrl: "",
    nextStep: "",
    recommendation: "tracking",
    recommendationReason: "",
    wantsCoaching: false,
  },
};
function result(): InterviewResult {
  return {
    accepted: true,
    summary: "A regular reading habit.",
    checks: [
      { label: "Concrete goal", passed: true, detail: "Read for pleasure." },
    ],
    question: state.question,
    nextQuestion: {
      title: "What are you reading now?",
      purpose: "Start from your actual routine.",
      options: [],
    },
    facts: { ...state.facts, goal: "Read regularly", goalReason: "To relax" },
  };
}
beforeEach(() => {
  generate.mockReset();
  realistic.mockReset();
  realistic.mockResolvedValue(true);
});
describe("onboarding interview gate", () => {
  it("uses the full conversation and does not advance a rejected answer after repeated attempts", async () => {
    const rejected = {
      ...result(),
      accepted: false,
      checks: [
        {
          label: "Relevant answer",
          passed: false,
          detail: "Please describe an actual goal.",
        },
      ],
    };
    generate.mockResolvedValue(rejected);
    const history = Array.from({ length: 12 }, () => ({
      stage: "goal" as const,
      question: "Your goal?",
      answer: "asdf",
      feedback: "Try a real goal",
      accepted: false,
    }));
    expect(
      (
        await interview({
          state: { ...state, turns: history },
          answer: "asdf",
          timezone: "Europe/Lisbon",
        })
      ).accepted,
    ).toBe(false);
    expect(
      JSON.parse(generate.mock.calls[0][0].prompt).state.turns,
    ).toHaveLength(12);
  });
  it("fails closed when the AI is unavailable", async () => {
    generate.mockRejectedValue(new Error("AI unavailable"));
    await expect(
      interview({ state, answer: "Read to relax", timezone: "Europe/Lisbon" }),
    ).rejects.toThrow("AI unavailable");
  });
  it("does not accept failed checks even if the model marks the whole response accepted", () => {
    const value = result();
    value.checks[0].passed = false;
    expect(enforceInterviewResult(state, value).accepted).toBe(false);
  });
  it("keeps optional context non-blocking and marks it for the improvement choice", () => {
    const value = result();
    value.accepted = false;
    value.checks = [
      {
        label: "Why it matters",
        passed: false,
        required: false,
        detail: "You can add the personal reason if you want.",
      },
    ];
    const enforced = enforceInterviewResult(state, value);
    expect(enforced.accepted).toBe(true);
    expect(enforced.needsImprovement).toBe(true);
    expect(enforced.summary).toBe("A regular reading habit.");
  });
  it("replaces a success-worded summary when a failed check overrides acceptance", () => {
    const value = result();
    value.summary = "Thanks for clarifying: you can run 10 km comfortably.";
    value.checks = [
      {
        label: "Concrete starting point",
        passed: false,
        detail: "Tell me the pace you can hold for the whole distance.",
      },
    ];
    value.question = {
      title: "What practice fits your week?",
      purpose: "Next stage.",
      options: [],
    };
    const enforced = enforceInterviewResult(state, value);
    expect(enforced.accepted).toBe(false);
    expect(enforced.summary).toBe(
      "Tell me the pace you can hold for the whole distance.",
    );
    expect(enforced.summary).not.toMatch(/thanks for clarifying/i);
    // The next-stage question cannot stay beside a "needs one more detail" screen.
    expect(enforced.question.title).toBe(
      "Tell me the pace you can hold for the whole distance.",
    );
    expect(enforced.nextQuestion.title).toBe(
      "Tell me the pace you can hold for the whole distance.",
    );
  });
  it("still asks for a concrete detail when a failed check carries no detail", () => {
    const value = result();
    value.checks = [{ label: "", passed: false, detail: "" }];
    const enforced = enforceInterviewResult(state, value);
    expect(enforced.accepted).toBe(false);
    expect(enforced.summary).toBe(
      "I need one more concrete detail before this fits your plan.",
    );
  });
  it("does not require a baseline before continuing", () => {
    const value = result();
    value.facts.baseline = "";
    expect(() =>
      enforceInterviewResult({ ...state, stage: "rhythm" }, value),
    ).not.toThrow();
  });
  it("rejects malformed structured output", async () => {
    generate.mockResolvedValue({ accepted: true });
    await expect(
      interview({ state, answer: "Read", timezone: "UTC" }),
    ).rejects.toThrow();
  });
  it("does not accept a proposed non-https resource", () => {
    const value = result();
    value.facts.resourceUrl = "javascript:alert(1)";
    expect(() => enforceInterviewResult(state, value)).toThrow("resource link");
  });
  it("requires a real activity and next step before review", () => {
    const value = result();
    value.facts.baseline = "Beginner";
    expect(() =>
      enforceInterviewResult({ ...state, stage: "support" }, value),
    ).toThrow("activity is incomplete");
  });
  it("asks for an explicit plan coaching choice after the weekly target", () => {
    const value = result();
    const checked = enforceInterviewResult(
      { ...state, stage: "rhythm" },
      value,
    );
    expect(checked.nextQuestion).toEqual({
      title: "Would you like coaching for this plan?",
      purpose:
        "A coach can help shape sessions and suggest adjustments. Or you can track your own plan for free.",
      options: ["Yes, coach this plan", "No, just track it"],
    });
  });
  it.each([
    ["Yes, coach this plan", true],
    ["No, just track it", false],
    ["Help me shape a plan", true],
    ["I know my plan — just tracking", false],
  ])("keeps the selected support branch for %s", (answer, wantsCoaching) => {
    const value = result();
    Object.assign(value.facts, {
      activityTitle: "Reading",
      measure: "pages",
      nextStep: "Read a chapter",
      wantsCoaching: !wantsCoaching,
    });
    const checked = enforceInterviewResult(
      { ...state, stage: "support" },
      value,
      answer,
    );
    expect(checked.facts.wantsCoaching).toBe(wantsCoaching);
  });
  it("gives free tracking an action that does not depend on a coach", () => {
    const value = result();
    Object.assign(value.facts, {
      activityTitle: "Running",
      measure: "kilometers",
      nextStep:
        "Agree a first week with your coach before increasing your running.",
      wantsCoaching: true,
    });
    const checked = enforceInterviewResult(
      { ...state, stage: "support" },
      value,
      "No, just track it",
    );
    expect(checked.facts.wantsCoaching).toBe(false);
    expect(checked.facts.nextStep).toBe("Log your next running session.");
  });
  it("preserves a free plan's independent first step through review", () => {
    const value = result();
    Object.assign(value.facts, {
      activityTitle: "Running",
      measure: "kilometers",
      nextStep: "Log your next easy run.",
      wantsCoaching: false,
    });
    const checked = enforceInterviewResult(
      { ...state, stage: "review" },
      value,
      "This feels right",
    );
    expect(checked.facts.nextStep).toBe("Log your next easy run.");
  });
  it("repairs a coach-dependent first step repeated at free-plan review", () => {
    const value = result();
    Object.assign(value.facts, {
      activityTitle: "Running",
      measure: "kilometers",
      nextStep: "Ask your coach to set the first week.",
      wantsCoaching: false,
    });
    const checked = enforceInterviewResult(
      { ...state, stage: "review" },
      value,
      "This feels right",
    );
    expect(checked.facts.nextStep).toBe("Log your next running session.");
  });
  it("rejects days that exceed the weekly target", () => {
    const value = result();
    Object.assign(value.facts, {
      commitment: "DAYS",
      frequency: 1,
      weekdays: [1, 2],
    });
    expect(() => enforceInterviewResult(state, value)).toThrow("weekly target");
  });
  it("bounds the conversational request without truncating or accepting excessive answers", () => {
    expect(
      interviewRequestSchema.safeParse({
        state,
        answer: "a".repeat(1501),
        timezone: "UTC",
      }).success,
    ).toBe(false);
  });
  it("passes existing activity context without replacing the model question", async () => {
    generate.mockResolvedValue(result());
    const activityContext: InterviewContext = {
      existingActivities: [
        {
          title: "Running",
          measure: "kilometers",
          entryCount: 18,
          lastLoggedAt: "2026-09-15",
        },
      ],
    };
    const input = {
      state: {
        ...state,
        facts: { ...state.facts, activityTitle: "Running" },
      },
      answer: "I want to run a half marathon",
      timezone: "Europe/Lisbon",
    };

    const response = await interview(input, activityContext);

    expect(response.nextQuestion.title).toBe("What are you reading now?");
    expect(response.nextQuestion.options).toEqual([]);
    expect(JSON.parse(generate.mock.calls[0][0].prompt).appContext).toEqual(
      activityContext,
    );
  });
  it("moves from weekly target to coaching choice without imposing session duration", async () => {
    generate.mockResolvedValue({
      ...result(),
      facts: {
        ...state.facts,
        goal: "Run a half marathon",
        baseline: "I can run 10 km comfortably",
      },
    });

    const response = await interview(
      {
        state: { ...state, stage: "rhythm" },
        answer: "Three times a week, with flexible session structure",
        timezone: "Europe/Lisbon",
      },
      { existingActivities: [] },
    );

    expect(response.nextQuestion.title).toBe(
      "Would you like coaching for this plan?",
    );
    expect(
      response.nextQuestion.options.every((option) => !/minute/i.test(option)),
    ).toBe(true);
  });
  it("does not preserve a model-supplied session duration in interview facts", async () => {
    generate.mockResolvedValue({
      ...result(),
      facts: { ...result().facts, durationMinutes: 60 },
    });

    const response = await interview({
      state,
      answer: "Read to relax",
      timezone: "Europe/Lisbon",
    });

    expect("durationMinutes" in response.facts).toBe(false);
  });
  it("pushes back once on a clearly unrealistic deadline, then respects the person's choice", async () => {
    const lose20kg = {
      ...result(),
      facts: {
        ...state.facts,
        goal: "Lose 20 kg",
        baseline: "95 kg, no training",
        targetDate: "2026-10-24",
      },
    };
    generate.mockResolvedValue(lose20kg);
    realistic.mockResolvedValue(false);
    const rhythm = { ...state, stage: "rhythm" as const };

    const first = await interview({ state: rhythm, answer: "4 times a week", timezone: "UTC" });
    expect(first.accepted).toBe(false);
    expect(first.question.title).toMatch(/unrealistic/);
    expect(first.question.options).toContain("Keep it as it is");

    const insisted = await interview({
      state: {
        ...rhythm,
        turns: [{ stage: "rhythm", question: first.question.title, answer: "4 times a week", feedback: first.summary, accepted: false }],
      },
      answer: "Keep it as it is",
      timezone: "UTC",
    });
    expect(insisted.accepted).toBe(true);
    expect(realistic).toHaveBeenCalledTimes(1);
  });
  it("does not run the realism check without a target date", async () => {
    generate.mockResolvedValue(result());
    await interview({ state: { ...state, stage: "rhythm" }, answer: "3 times a week", timezone: "UTC" });
    expect(realistic).not.toHaveBeenCalled();
  });
});
