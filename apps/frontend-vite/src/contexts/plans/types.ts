import { type Activity, type PlanSession, Prisma } from "@tsw/prisma";
import { type PlanMilestone, type PlanProgressData } from "@tsw/prisma/types";
import { createContext } from "react";
import { type PlanWithRelations } from "./service";

export type CompletePlan = PlanWithRelations & {
  milestones: PlanMilestone[];
  estimatedWeeks?: number | null;
};

export interface PlansContextType {
  plans: (CompletePlan & { progress: PlanProgressData })[] | undefined;
  isLoadingPlans: boolean;
  updatePlans: (data: {
    updates: Array<{ planId: string; updates: Prisma.PlanUpdateInput }>;
    muteNotifications?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  isUpdatingPlans: boolean;
  modifyManualMilestone: (data: {
    milestoneId: string;
    delta: number;
  }) => Promise<void>;
  isModifyingManualMilestone: boolean;
  upsertPlan: (data: {
    planId: string;
    updates: Prisma.PlanUpdateInput & {
      sessions?: Partial<PlanSession>[];
      milestones?: PlanMilestone[];
      activities?: Activity[];
    };
    muteNotifications?: boolean;
  }) => Promise<void>;
  isUpsertingPlan: boolean;
  clearCoachSuggestedSessionsInPlan: (planId: string) => Promise<void>;
  isClearingCoachSuggestedSessionsInPlan: boolean;
  upgradeCoachSuggestedSessionsToPlanSessions: (
    planId: string
  ) => Promise<void>;
  isUpgradingCoachSuggestedSessionsToPlanSessions: boolean;
  leavePlanGroup: (planId: string) => Promise<void>;
  isLeavingPlanGroup: boolean;
  deletePlan: (planId: string) => Promise<void>;
  isDeletingPlan: boolean;
  uploadPlanBackgroundImage: (file: File) => Promise<string>;
  isUploadingPlanBackgroundImage: boolean;
}

export const PlansContext = createContext<PlansContextType | undefined>(
  undefined
);
