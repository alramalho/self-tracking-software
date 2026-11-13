import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/aiSdk", () => ({ generateObject: vi.fn() }));
vi.mock("../../utils/prisma", () => ({ prisma: {} }));
vi.mock("../sttService", () => ({ sttService: {} }));

import { normalizeExtraction, roundQuantity, VOICE_LOG_PROMPT } from "./extract";
import { voiceLogSamplesFile } from "./samples";
import { entryDescription } from "./service";
import type { VoiceLogModelOutput } from "./types";
import { cases } from "../../../scripts/voice-log-bench/cases";
import { score } from "../../../scripts/voice-log-bench/run";

const activities = [
  { activityId: "running", title: "running", emoji: "🏃", measure: "kilometers" },
  { activityId: "side", title: "work on side project", emoji: "💻", measure: "hours" },
];
const metrics = [{ metricId: "energy", title: "Energy", emoji: "⚡" }];

const run = (quantity: number, extra: Partial<VoiceLogModelOutput["activities"][number]> = {}) => ({
  activityId: "running",
  quantity,
  date: "2026-11-12",
  time: null,
  description: null,
  difficulty: null,
  estimatedFrom: null,
  confidence: 0.9,
  ...extra,
});

const output = (partial: Partial<VoiceLogModelOutput>): VoiceLogModelOutput => ({
  activities: [],
  metrics: [],
  note: null,
  unresolved: [],
  ...partial,
});

describe("roundQuantity", () => {
  it("rounds decimals to the whole number an entry stores", () => {
    expect(roundQuantity(5.4)).toBe(5);
    expect(roundQuantity(7.8)).toBe(8);
    expect(roundQuantity(21.1)).toBe(21);
  });

  it("refuses amounts that round to nothing or change too much", () => {
    expect(roundQuantity(0.3)).toBeNull();
    expect(roundQuantity(1.4)).toBe(1);
    expect(roundQuantity(0.6)).toBeNull(); // 1 is two thirds more than 0.6
  });
});

describe("normalizeExtraction", () => {
  it("keeps a decimal run instead of dropping it", () => {
    const result = normalizeExtraction(output({ activities: [run(5.4)] }), "Ran 5.4 km", "2026-11-12", activities, metrics);
    expect(result.activities).toEqual([expect.objectContaining({ activityId: "running", quantity: 5 })]);
  });

  it("sends an amount that can't be stored whole to unresolved", () => {
    const result = normalizeExtraction(
      output({ activities: [{ ...run(0.3), activityId: "side" }] }),
      "Twenty minutes on my side project",
      "2026-11-12",
      activities,
      metrics,
    );
    expect(result.activities).toEqual([]);
    expect(result.unresolved[0].reason).toMatch(/whole hours/);
  });

  it("adds up the same activity on the same day and keeps both details", () => {
    const result = normalizeExtraction(
      output({ activities: [run(3, { description: "morning" }), run(5, { description: "evening" })] }),
      "Two runs",
      "2026-11-12",
      activities,
      metrics,
    );
    expect(result.activities).toEqual([
      expect.objectContaining({ quantity: 8, description: "morning; evening" }),
    ]);
  });

  it("drops unknown ids and out-of-range ratings, and clamps confidence", () => {
    const result = normalizeExtraction(
      output({
        activities: [run(5, { activityId: "invented", confidence: 3 }), run(5, { confidence: 3 })],
        metrics: [
          { metricId: "energy", rating: 9, date: "2026-11-12", description: null, confidence: 1 },
          { metricId: "energy", rating: 4, date: "2026-11-12", description: null, confidence: 1 },
        ],
      }),
      "Ran 5 km, energy 4",
      "2026-11-12",
      activities,
      metrics,
    );
    expect(result.activities).toEqual([expect.objectContaining({ activityId: "running", confidence: 1 })]);
    expect(result.metrics.map((metric) => metric.rating)).toEqual([4]);
    expect(result.unresolved.map((item) => item.text)).toContain("invented");
  });

  it("describes what was logged when the model leaves the note empty", () => {
    const result = normalizeExtraction(
      output({ activities: [{ ...run(21), activityId: "side", quantity: 2, estimatedFrom: "two hours" }] }),
      "Long two hours on my side project",
      "2026-11-12",
      activities,
      metrics,
    );
    expect(result.note?.text).toBe("Logged work on side project: 2 hours (estimated from two hours).");
    expect(result.activities[0].estimatedFrom).toBe("two hours");
  });

  it("falls back to the transcript as the note", () => {
    const result = normalizeExtraction(output({}), "Feeling good", "2026-11-12", activities, metrics);
    expect(result.note).toEqual(expect.objectContaining({ text: "Feeling good", date: "2026-11-12" }));
  });
});

describe("voice-log prompt", () => {
  it("covers the failures the benchmark found", () => {
    expect(VOICE_LOG_PROMPT).toMatch(/Keep decimals/);
    expect(VOICE_LOG_PROMPT).toMatch(/Match by meaning/);
    expect(VOICE_LOG_PROMPT).toMatch(/lastLoggedOn/);
    expect(VOICE_LOG_PROMPT).toMatch(/"Long half an hour of reading" means "Log/);
    expect(VOICE_LOG_PROMPT).toMatch(/estimatedFrom/);
  });
});

describe("entryDescription", () => {
  it("keeps an estimate visible on the saved entry", () => {
    expect(entryDescription({ description: null, estimatedFrom: "30 minutes" })).toBe("Estimated from 30 minutes");
    expect(entryDescription({ description: "by the river", estimatedFrom: null })).toBe("by the river");
    expect(entryDescription({})).toBeNull();
  });
});

describe("voice-log samples", () => {
  it("writes next to the AI usage log unless turned off", () => {
    expect(voiceLogSamplesFile({ AI_USAGE_LOG: "/var/log/tracking/ai-usage.jsonl" })).toBe(
      "/var/log/tracking/voice-logs.jsonl",
    );
    expect(voiceLogSamplesFile({ AI_USAGE_LOG: "/x/ai.jsonl", VOICE_LOG_SAMPLES: "off" })).toBeNull();
    expect(voiceLogSamplesFile({})).toBeNull();
  });
});

describe("voice-log benchmark scoring", () => {
  const decimal = cases.find((c) => c.id === "run-decimal")!;
  const extraction = (quantity: number) =>
    normalizeExtraction(output({ activities: [run(quantity)] }), decimal.transcript, "2026-11-12", activities, metrics);

  it("passes the right answer and flags a wrong amount", () => {
    expect(score(decimal, extraction(5.4))).toEqual([]);
    expect(score(decimal, extraction(7))).toEqual(["running quantity 7 ≠ 5"]);
  });
});
