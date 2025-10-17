import {
  PlanOutlineType,
  PlanState,
  type Plan as PrismaPlan,
  type PlanMilestone as PrismaPlanMilestone,
} from "../generated/prisma";

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

export type PlanProgressState = {
  achievement: {
    streak: number;
    completedWeeks: number;
    incompleteWeeks: number;
    totalWeeks: number;
  };
  currentWeekStats: {
    numActiveDaysInTheWeek: number;
    numLeftDaysInTheWeek: number;
    numActiveDaysLeftInTheWeek: number;
    daysCompletedThisWeek: number;
  };
  habitAchievement: {
    progressValue: number;
    maxValue: number;
    isAchieved: boolean;
    progressPercentage: number;
  };
  lifestyleAchievement: {
    progressValue: number;
    maxValue: number;
    isAchieved: boolean;
    progressPercentage: number;
  };
  weeks: Array<{
    startDate: Date;
    activities: any[];
    completedActivities: any[];
    plannedActivities: number | any[];
    weekActivities: any[];
    isCompleted: boolean;
  }>;
  currentWeekState: PlanState | undefined | null;
} | null;

export type PlanProgressData = {
  plan: {
    emoji: string;
    goal: string;
    id: string;
    type: PlanOutlineType;
  };
} & NonNullable<PlanProgressState>;

export type Plan = Omit<PrismaPlan, "milestones" | "progressState"> & {
  milestones: PlanMilestone[];
  progressState: PlanProgressState;
  embedding: number[] | null;
};
