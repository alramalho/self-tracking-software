import type { RecommendedUsersResponse } from "@/contexts/recommendations";
import type { AxiosInstance } from "axios";
import {
  ONBOARDING_PARTNER_MATCH_MIN_COUNT,
  SATISFACTORY_PARTNER_MATCH_MIN_SCORE,
  getDedupedUserRecommendations,
} from "./partnerRecommendationFilters";

type ShouldShowOnboardingPartnerStepParams = {
  api: AxiosInstance;
  planId: string;
  refetchRecommendations?: () => Promise<unknown> | unknown;
};

export const shouldShowOnboardingPartnerStep = async ({
  api,
  planId,
  refetchRecommendations,
}: ShouldShowOnboardingPartnerStepParams): Promise<boolean> => {
  await api.post("/users/compute-recommendations", { planId });
  await refetchRecommendations?.();

  const response = await api.get<RecommendedUsersResponse>(
    "/users/recommended-users"
  );
  const matchingRecommendations = getDedupedUserRecommendations(
    response.data.recommendations,
    {
      selectedPlanId: planId,
      minScore: SATISFACTORY_PARTNER_MATCH_MIN_SCORE,
    }
  );

  return matchingRecommendations.length >= ONBOARDING_PARTNER_MATCH_MIN_COUNT;
};
