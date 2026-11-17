import type { Visibility } from "@tsw/prisma";

export type PlanWithActivities = {
  visibility: Visibility;
  activities: { id: string }[];
};
