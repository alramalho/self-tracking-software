import type { Prisma } from "@tsw/prisma";

// Generic activity context excludes health-derived records. Explicit per-plan
// consent uses the separate, field-limited coach/monitoring/context.ts path.
export const healthSafeActivityFilter = {
  source: {
    notIn: [
      "apple_health",
      "apple_health_linked",
      "garmin_connect",
      "garmin_connect_linked",
    ],
  },
  healthWorkoutReconciliations: { none: {} },
} satisfies Prisma.ActivityEntryWhereInput;
