import { describe, expect, it, vi } from "vitest";
import { shouldReportWatchUse } from "./watchUsage";

vi.mock("./posthog", () => ({ captureServerEvent: vi.fn() }));

describe("watch usage reporting", () => {
  it("reports a user's watch use at most once a day", () => {
    const start = Date.UTC(2026, 8, 30, 8);
    expect(shouldReportWatchUse("watch-user", start)).toBe(true);
    expect(shouldReportWatchUse("watch-user", start + 60_000)).toBe(false);
    expect(shouldReportWatchUse("watch-user", start + 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("tracks each user separately", () => {
    const now = Date.UTC(2026, 8, 30, 9);
    expect(shouldReportWatchUse("first-watch-user", now)).toBe(true);
    expect(shouldReportWatchUse("second-watch-user", now)).toBe(true);
  });
});
