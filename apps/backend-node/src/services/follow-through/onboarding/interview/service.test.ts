import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  InterviewState,
  InterviewResult,
} from "@tsw/prisma/follow-through";
const generate = vi.hoisted(() => vi.fn());
vi.mock("../../../aiService", () => ({
  aiService: { generateStructuredResponse: generate },
}));
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
    durationMinutes: 20,
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
  it("requires a baseline after the goal stage", () =>
    expect(() =>
      enforceInterviewResult({ ...state, stage: "baseline" }, result()),
    ).toThrow("fully understood"));
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
  it("uses existing activity context to ask for a plan target instead of current frequency", async () => {
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

    expect(response.nextQuestion.title).toBe(
      "What would help this running plan fit your current starting point?",
    );
    expect(JSON.parse(generate.mock.calls[0][0].prompt).appContext).toEqual(
      activityContext,
    );
  });
  it("removes an AI claim that known activity history cannot be inspected", async () => {
    generate.mockResolvedValue({
      ...result(),
      accepted: false,
      summary: "I can't access or inspect your running activities.",
      question: {
        title: "How often do you run?",
        purpose: "I need more detail.",
        options: [],
      },
      facts: {
        ...state.facts,
        activityTitle: "Running",
        baseline: "I run occasionally",
      },
    });

    const response = await interview(
      {
        state: {
          ...state,
          stage: "baseline",
          facts: { ...state.facts, activityTitle: "Running" },
        },
        answer: "I run occasionally",
        timezone: "Europe/Lisbon",
      },
      {
        existingActivities: [
          {
            title: "Running",
            measure: "kilometers",
            entryCount: 18,
            lastLoggedAt: "2026-09-15",
          },
        ],
      },
    );

    expect(response.summary).not.toMatch(/can't access|inspect/i);
    expect(response.question.title).not.toMatch(/how often do you run/i);
    expect(response.question.title).toMatch(/starting point/i);
  });
});
