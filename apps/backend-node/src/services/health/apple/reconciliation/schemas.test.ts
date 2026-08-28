import { describe, expect, it } from "vitest";

import { workoutReconciliationRequestSchema } from "./schemas";

describe("workout reconciliation request schema", () => {
  it("requires an activity entry for link actions", () => {
    const result = workoutReconciliationRequestSchema.safeParse({
      decisions: [
        {
          healthWorkoutId: "health-workout",
          action: "link_keep",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate decisions for one Health workout", () => {
    const result = workoutReconciliationRequestSchema.safeParse({
      decisions: [
        { healthWorkoutId: "health-workout", action: "ignore" },
        { healthWorkoutId: "health-workout", action: "import_new" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts explicit import and ignore decisions", () => {
    const result = workoutReconciliationRequestSchema.safeParse({
      decisions: [
        { healthWorkoutId: "first", action: "import_new" },
        { healthWorkoutId: "second", action: "ignore" },
      ],
    });

    expect(result.success).toBe(true);
  });
});
