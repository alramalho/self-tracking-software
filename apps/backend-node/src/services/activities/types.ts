import type { Activity } from "@tsw/prisma";

/** How we know two activities are the same habit. */
export type DuplicateMatch = "name" | "meaning";

export type ActivityWithCount = Activity & { entryCount: number };

/** One side's logs are multiplied by `factor` to count in `to`, e.g. Hiking's hours into minutes. */
export type LogConversion = { activityId: string; from: string; to: string; factor: number };

/** What merging the pair would do, shown before the person confirms. */
export type MergeSuggestion = {
  match: DuplicateMatch;
  keep: Activity;
  remove: Activity;
  entriesToMove: number;
  plansToUpdate: number;
  conversion: LogConversion | null;
};
