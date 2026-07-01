import type { Recommendation } from "@tsw/prisma";

export type PartnerRecommendationFilterOptions = {
  selectedPlanId?: string | null;
  minScore?: number;
};

export type PartnerRecommendation = Recommendation;
