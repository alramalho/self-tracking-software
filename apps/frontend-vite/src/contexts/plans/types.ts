import { Activity, PlanSession, Prisma } from "@tsw/prisma";
import { PlanMilestone } from "@tsw/prisma/types";
import { createContext } from "react";
import { PlanWithRelations } from "./service";

export type CompletePlan = PlanWithRelations & {
  milestones: PlanMilestone[];
};

export interface PlansContextType {
  plans: CompletePlan[] | undefined;
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
}

export const PlansContext = createContext<PlansContextType | undefined>(undefined);