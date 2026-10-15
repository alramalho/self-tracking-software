import { describe, expect, it } from "vitest";
import {
  activityNameKey,
  canCombine,
  chooseActivityToKeep,
  conversionFactor,
  findNameTwin,
  mergeConversion,
} from "@tsw/prisma/activity-duplicates";

const activity = (id: string, title: string, measure = "minutes") => ({
  id,
  title,
  emoji: "🏃",
  measure,
});

describe("the activity name rule", () => {
  it("treats word forms of the same habit as one name", () => {
    for (const [a, b] of [
      ["Hike", "Hiking"],
      ["Swimming", "swim"],
      ["Running", "Runs"],
      ["Cycling", "cycle"],
      ["Dance", "Dancing"],
      ["Surf", "  surfing!"],
      ["Stretching", "Stretches"],
      ["Yoga session", "yoga"],
    ])
      expect(activityNameKey(a), `${a} / ${b}`).toBe(activityNameKey(b));
  });

  it("keeps different habits apart", () => {
    for (const [a, b] of [
      ["Hiking", "Hike training"],
      ["Writing", "Music writing"],
      ["Surf", "Swimming"],
      ["Running", "Trail running"],
      ["Class", "Classical guitar"],
    ])
      expect(activityNameKey(a), `${a} / ${b}`).not.toBe(activityNameKey(b));
  });

  it("finds an existing activity with the same name, never the activity itself", () => {
    const list = [activity("hike", "Hike"), activity("surf", "Surf")];
    expect(findNameTwin("Hiking", list)?.id).toBe("hike");
    expect(findNameTwin("Hike", list, "hike")).toBeUndefined();
    expect(findNameTwin("Swimming", list)).toBeUndefined();
  });

  it("waits for a few letters before matching", () => {
    expect(findNameTwin("Hi", [activity("hi", "hi")])).toBeUndefined();
  });

  it("only adds logs together when they count the same thing", () => {
    expect(canCombine(activity("a", "x", "minutes"), activity("b", "y", "min"))).toBe(true);
    expect(canCombine(activity("a", "x", "Kilometers"), activity("b", "y", "km"))).toBe(true);
    expect(canCombine(activity("a", "x", "times"), activity("b", "y", "sessions"))).toBe(true);
    expect(canCombine(activity("a", "x", "hours"), activity("b", "y", "minutes"))).toBe(true);
    expect(canCombine(activity("a", "x", "minutes"), activity("b", "y", "km"))).toBe(false);
    expect(canCombine(activity("a", "x", "pages"), activity("b", "y", "minutes"))).toBe(false);
  });

  it("converts only into the smaller unit, so logs stay whole numbers", () => {
    expect(conversionFactor("hours", "minutes")).toBe(60);
    expect(conversionFactor("hr", "seconds")).toBe(3600);
    expect(conversionFactor("km", "meters")).toBe(1000);
    expect(conversionFactor("miles", "yards")).toBe(1760);
    expect(conversionFactor("minutes", "hours")).toBeUndefined();
    // Miles and kilometers don't convert exactly, so they never merge.
    expect(conversionFactor("miles", "km")).toBeUndefined();
    expect(conversionFactor("km", "miles")).toBeUndefined();
  });

  it("converts whichever side is counted in the larger unit", () => {
    const hikeMinutes = activity("hike", "Hike", "minutes");
    const hikingHours = activity("hiking", "Hiking", "hours");
    expect(mergeConversion(hikeMinutes, hikingHours)).toMatchObject({
      activity: { id: "hiking" },
      from: "hours",
      to: "minutes",
      factor: 60,
    });
    expect(mergeConversion(hikingHours, hikeMinutes)).toMatchObject({
      activity: { id: "hiking" },
      to: "minutes",
    });
    expect(mergeConversion(hikeMinutes, activity("b", "y", "min"))).toBeNull();
    expect(mergeConversion(hikeMinutes, activity("b", "y", "km"))).toBeUndefined();
  });

  it("keeps the activity with more logs, then the older one", () => {
    const older = { id: "older", createdAt: "2026-01-01", entryCount: 3 };
    const newer = { id: "newer", createdAt: "2026-06-01", entryCount: 12 };
    expect(chooseActivityToKeep(older, newer)[0].id).toBe("newer");
    expect(chooseActivityToKeep(newer, { ...older, entryCount: 12 })[0].id).toBe("older");
  });
});
