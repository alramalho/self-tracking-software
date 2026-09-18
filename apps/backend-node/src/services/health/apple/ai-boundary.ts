import type { Prisma } from "@tsw/prisma";

// Health-derived data stays available to the user but out of external AI context.
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
