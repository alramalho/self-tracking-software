import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FailureCoalescer } from "./failureCoalescer";

describe("FailureCoalescer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("alerts once per endpoint and summarizes the repeats when the window closes", () => {
    const onRepeatedFailures = vi.fn();
    const coalescer = new FailureCoalescer(onRepeatedFailures, 60_000);
    const endpoint = "POST /onboarding/check-plan-goal";

    const alerted = [1, 2, 3, 4, 5, 6].map(() =>
      coalescer.shouldAlert(endpoint, 500, "meena"),
    );
    coalescer.shouldAlert(endpoint, 500, "alex");

    expect(alerted).toEqual([true, false, false, false, false, false]);
    expect(onRepeatedFailures).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);

    expect(onRepeatedFailures).toHaveBeenCalledWith({
      endpoint,
      statusCode: 500,
      count: 6,
      usernames: ["meena", "alex"],
      windowMinutes: 1,
    });
    expect(coalescer.shouldAlert(endpoint, 500, "meena")).toBe(true);
  });

  it("stays quiet when a failure is not repeated, and keeps endpoints separate", () => {
    const onRepeatedFailures = vi.fn();
    const coalescer = new FailureCoalescer(onRepeatedFailures, 60_000);

    expect(coalescer.shouldAlert("POST /a", 500, "u")).toBe(true);
    expect(coalescer.shouldAlert("POST /b", 500, "u")).toBe(true);
    expect(coalescer.shouldAlert("POST /a", 502, "u")).toBe(true);

    vi.advanceTimersByTime(60_000);
    expect(onRepeatedFailures).not.toHaveBeenCalled();
  });
});
