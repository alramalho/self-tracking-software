import { describe, expect, it } from "vitest";
import { scoreSleep, sleepNights, clockDistance } from "./model";
import type { SleepSample } from "./types";
const NOW = new Date("2026-09-20T12:00:00Z");
function sample(
  day: number,
  stage = "asleep_core",
  minutes = 480,
): SleepSample {
  const startAt = new Date(Date.UTC(2026, 8, day, 23));
  return {
    id: `${day}-${stage}`,
    stage,
    startAt,
    endAt: new Date(startAt.getTime() + minutes * 60000),
    sourceBundleId: "com.apple.health",
    sourceName: "Apple Watch",
    sourceProductType: "Watch",
    timezone: "UTC",
  };
}
const history = () => Array.from({ length: 8 }, (_, i) => sample(i + 1));
describe("sleep v0", () => {
  it("waits for seven previous nights, then scores an uninterrupted regular eight-hour night", () => {
    const result = scoreSleep(history(), NOW);
    expect(result[0].total).toBeNull();
    expect(result[0].status).toBe("learning");
    expect(result[7]).toMatchObject({
      total: 100,
      durationPoints: 50,
      consistencyPoints: 30,
      interruptionPoints: 20,
      baselineNights: 7,
    });
  });
  it("uses the wake date and never splits a sleep at midnight", () => {
    expect(sleepNights([sample(1)])[0]).toMatchObject({
      date: "2026-09-02",
      asleepMinutes: 480,
    });
  });
  it("does not double-count duplicate or competing source records", () => {
    const base = sample(1);
    expect(
      sleepNights([
        base,
        { ...base, id: "copy" },
        { ...base, id: "other", sourceBundleId: "other.tracker" },
      ]),
    ).toHaveLength(1);
    expect(sleepNights([base, { ...base, id: "copy" }])[0].asleepMinutes).toBe(
      480,
    );
  });
  it("subtracts recorded wake time even when it overlaps a broad asleep sample", () => {
    const base = sample(8),
      awake = {
        ...base,
        id: "awake",
        stage: "awake",
        startAt: new Date("2026-09-09T02:00:00Z"),
        endAt: new Date("2026-09-09T02:20:00Z"),
      };
    const score = scoreSleep([...history(), awake], NOW).at(-1)!;
    expect(score.asleepMinutes).toBe(460);
    expect(score.awakeMinutes).toBe(20);
    expect(score.awakenings).toBe(1);
    expect(score.total!).toBeLessThan(100);
  });
  it("merges adjacent awake samples into one sustained interruption", () => {
    const base = sample(8);
    const wake = [0, 1].map((i) => ({
      ...base,
      id: `wake${i}`,
      stage: "awake",
      startAt: new Date(Date.UTC(2026, 8, 9, 2, i * 5)),
      endAt: new Date(Date.UTC(2026, 8, 9, 2, (i + 1) * 5)),
    }));
    expect(scoreSleep([...history(), ...wake], NOW).at(-1)?.awakenings).toBe(1);
  });
  it("does not invent a continuity score from an unspecified sleep-only interval", () => {
    const result = scoreSleep(
      [...history().slice(0, 7), sample(8, "asleep_unspecified")],
      NOW,
    ).at(-1)!;
    expect(result).toMatchObject({
      status: "incomplete",
      interruptionPoints: null,
      total: null,
    });
  });
  it("marks a data gap as unknown rather than adding an awakening", () => {
    const first = sample(8, "asleep_core", 180);
    const second = {
      ...first,
      id: "second",
      startAt: new Date("2026-09-09T03:00:00Z"),
      endAt: new Date("2026-09-09T07:00:00Z"),
    };
    const result = scoreSleep(
      [...history().slice(0, 7), first, second],
      NOW,
    ).at(-1)!;
    expect(result).toMatchObject({
      total: null,
      status: "incomplete",
      awakeMinutes: 0,
    });
  });
  it("handles midnight as a circular bedtime", () => {
    expect(clockDistance(1430, 10)).toBe(20);
  });
  it("resets the usable baseline after travel to another timezone", () => {
    const changed = { ...sample(8), timezone: "America/New_York" };
    expect(
      scoreSleep([...history().slice(0, 7), changed], NOW).at(-1)?.status,
    ).toBe("learning");
  });
  it("excludes stale history and sleeps still in progress", () => {
    expect(
      scoreSleep(history(), new Date("2026-09-02T07:10:00Z")),
    ).toHaveLength(0);
    expect(
      scoreSleep([sample(1), sample(29)], new Date("2026-10-02"))[1]
        .baselineNights,
    ).toBe(0);
  });
  it("does not let a daytime nap replace the primary eight-hour sleep", () => {
    const nap = {
      ...sample(2),
      id: "nap",
      startAt: new Date("2026-09-02T14:00:00Z"),
      endAt: new Date("2026-09-02T15:30:00Z"),
    };
    expect(sleepNights([sample(1), nap])[0].asleepMinutes).toBe(480);
  });
  it("keeps a very short night substantially below a full night", () => {
    const short = scoreSleep(
      [...history().slice(0, 7), sample(8, "asleep_core", 240)],
      NOW,
    ).at(-1)!;
    expect(short.durationPoints).toBe(13);
    expect(short.total).toBe(63);
  });
});
