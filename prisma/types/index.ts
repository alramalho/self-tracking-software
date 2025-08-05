import {
  Plan as PrismaPlan,
  PlanMilestone as PrismaPlanMilestone,
} from "@prisma/client";

export type MilestoneCriteria = {
  junction: "AND" | "OR";
  items: Array<{
    activityId: string;
    quantity: number;
  }>;
} | null;

export type PlanMilestone = Omit<PrismaPlanMilestone, "criteria"> & {
  criteria: MilestoneCriteria;
};

export type Plan = Omit<PrismaPlan, "milestones"> & {
  milestones: PlanMilestone[];
};
