import { describe, expect, it } from "vitest";
import {
  hiddenActivityIds,
  logsShownToOthers,
  planShownToOthers,
} from "./visibility";

const plan = (visibility: any, ...ids: string[]) => ({
  visibility,
  activities: ids.map((id) => ({ id })),
});

describe("plan visibility", () => {
  it("hides the plan for LOGS_ONLY and PRIVATE, the logs only for PRIVATE", () => {
    expect(planShownToOthers("PUBLIC")).toBe(true);
    expect(planShownToOthers("FRIENDS")).toBe(true);
    expect(planShownToOthers("LOGS_ONLY")).toBe(false);
    expect(planShownToOthers("PRIVATE")).toBe(false);
    expect(logsShownToOthers("LOGS_ONLY")).toBe(true);
    expect(logsShownToOthers("PRIVATE")).toBe(false);
  });

  it("hides an activity's logs only when every plan with it hides them", () => {
    const hidden = hiddenActivityIds([
      plan("PRIVATE", "chinese", "reading"),
      plan("PUBLIC", "reading", "running"),
      plan("LOGS_ONLY", "flashcards"),
      plan("PRIVATE", "flashcards"),
    ]);
    expect([...hidden]).toEqual(["chinese"]);
  });

  it("leaves activities outside any plan visible", () => {
    expect(hiddenActivityIds([]).size).toBe(0);
  });
});
