"use client";

import { Skeleton } from "@/components/ui/skeleton";
import UserCard from "@/components/UserCard";
import { useRecommendations } from "@/contexts/recommendations";
import { User } from "@tsw/prisma";
import React from "react";

export const RecommendedUsers: React.FC = () => {
  const {
    recommendations,
    users: recommendedUsers,
    plans: recommendedPlans,
    isLoadingRecommendations,
  } = useRecommendations();

  const userScores = recommendations
    .filter((rec) => rec.recommendationObjectType === "USER")
    .reduce((acc, rec) => {
      acc[rec.recommendationObjectId] = rec.score;
      return acc;
    }, {} as Record<string, number>);

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
      {recommendations.map((recommendation) => {
        const user = recommendedUsers.find(
          (user) => user.id === recommendation.recommendationObjectId
        );
        if (!user || !user.id) {
          return null;
        }
        const plan = recommendedPlans
          ?.filter((plan) => plan.userId === user.id)
          .sort((a, b) => {
            // Sort by sortOrder, with nulls last, then by createdAt
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
        return (
          <UserCard
            key={user.id}
            user={{...user, name: user.name || undefined} as User}
            score={userScores[user.id] || 0}
            plan={{emoji: plan?.emoji || undefined, goal: plan?.goal || ""}}
            plans={recommendedPlans?.filter((p) => p.userId === user.id) || []}
            showFriendRequest={true}
            showScore={true}
            showStreaks={true}
            className={`bg-white/50`}
          />
        );
      })}
    </div>
  );
};