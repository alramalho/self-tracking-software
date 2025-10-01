import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendations } from "@/contexts/recommendations";
import React from "react";

export const RecommendedUsers: React.FC = () => {
  const {
    recommendations,
    users: recommendedUsers,
    plans: recommendedPlans,
    isLoadingRecommendations,
  } = useRecommendations();

  const userRecommendations = recommendations
    .filter((rec) => rec.recommendationObjectType === "USER");

  const deduplicatedRecommendations = userRecommendations.reduce((acc, rec) => {
    const existing = acc.find(r => r.recommendationObjectId === rec.recommendationObjectId);
    if (!existing || rec.score > existing.score) {
      return acc.filter(r => r.recommendationObjectId !== rec.recommendationObjectId).concat(rec);
    }
    return acc;
  }, [] as typeof userRecommendations);

  if (isLoadingRecommendations) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {deduplicatedRecommendations.map((recommendation) => {
        const user = recommendedUsers.find(
          (user) => user.id === recommendation.recommendationObjectId
        );
        if (!user || !user.id) {
          return null;
        }
        const plan = recommendedPlans
          ?.filter((plan) => plan.userId === user.id)
          .sort((a, b) => {
            if (a.sortOrder !== null && b.sortOrder !== null) {
              return a.sortOrder - b.sortOrder;
            }
            if (a.sortOrder !== null && b.sortOrder === null) return -1;
            if (a.sortOrder === null && b.sortOrder !== null) return 1;
            return (
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
            );
          })[0];

        const score = recommendation.score;

        return (
          <div
            key={user.id}
            className="bg-white/50 p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.username || ""}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    user.name?.[0] || "U"
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{user.name || user.username}</h3>
                  <p className="text-sm text-gray-600">@{user.username}</p>
                </div>
              </div>
              <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {Math.round(score * 100)}% match
              </div>
            </div>
            {plan && (
              <div className="text-sm text-gray-700">
                <span className="mr-2">{plan.emoji}</span>
                {plan.goal}
              </div>
            )}
            {/* TODO: Add full UserCard with streaks, friend request button when migrated */}
          </div>
        );
      })}
    </div>
  );
};