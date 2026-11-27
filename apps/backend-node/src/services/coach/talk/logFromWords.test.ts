import { describe, expect, it } from "vitest";
import { keepSure } from "./logFromWords";

const session = (over: object = {}) => ({
  activityId: "chinese",
  title: "Chinese",
  measure: "minutes",
  quantity: 60,
  date: "2026-11-27",
  confidence: 0.95,
  ...over,
});

describe("keepSure", () => {
  it("shows the card when the extractor and Jev are both sure", () => {
    expect(keepSure([session(), session({ date: "2026-11-26" })], 0.97)).toHaveLength(2);
  });

  it("all or nothing: one doubtful session hides the whole card", () => {
    expect(keepSure([session(), session({ date: "2026-11-26", confidence: 0.6 })], 0.97)).toEqual([]);
    expect(keepSure([session(), session({ date: "2026-11-25", estimatedFrom: "30 minutes" })], 0.97)).toEqual([]);
  });

  it("Jev doubting the list, or not answering, hides it", () => {
    expect(keepSure([session()], 0.4)).toEqual([]);
    expect(keepSure([session()], 0)).toEqual([]);
  });
});
