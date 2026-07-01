import type { Recommendation } from "@tsw/prisma";
import type {
  PartnerRecommendation,
  PartnerRecommendationFilterOptions,
} from "./types";

export const ONBOARDING_PARTNER_MATCH_MIN_COUNT = 6;
export const SATISFACTORY_PARTNER_MATCH_MIN_SCORE = 0.25;

const getRelativeToPlanId = (metadata: unknown): string | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const value = (metadata as Record<string, unknown>).relativeToPlanId;
  return typeof value === "string" ? value : undefined;
};

export const getDedupedUserRecommendations = (
  recommendations: Recommendation[],
  options: PartnerRecommendationFilterOptions = {}
): PartnerRecommendation[] => {
  const userRecommendations = recommendations.filter((recommendation) => {
    if (recommendation.recommendationObjectType !== "USER") return false;
    if (options.minScore != null && recommendation.score < options.minScore) {
      return false;
    }
    if (options.selectedPlanId) {
      return (
        getRelativeToPlanId(recommendation.metadata) === options.selectedPlanId
      );
    }

    return true;
  });

  return userRecommendations.reduce<PartnerRecommendation[]>(
    (dedupedRecommendations, recommendation) => {
      const existingRecommendation = dedupedRecommendations.find(
        (candidate) =>
          candidate.recommendationObjectId ===
          recommendation.recommendationObjectId
      );

      if (
        !existingRecommendation ||
        recommendation.score > existingRecommendation.score
      ) {
        return dedupedRecommendations
          .filter(
            (candidate) =>
              candidate.recommendationObjectId !==
              recommendation.recommendationObjectId
          )
          .concat(recommendation);
      }

      return dedupedRecommendations;
    },
    []
  );
};
