"use client";

import { Skeleton } from "@/components/ui/skeleton";
import UserCard from "@/components/UserCard";
import { useRecommendations } from "@/contexts/recommendations";
import { useCurrentUser } from "@/contexts/users";
import { User } from "@tsw/prisma";
import React from "react";

export const RecommendedUsers: React.FC = () => {
  const {
    recommendations,
    users: recommendedUsers,
    plans: recommendedPlans,
    isLoadingRecommendations,
  } = useRecommendations();
  const { currentUser } = useCurrentUser();

  const userRecommendations = recommendations
    .filter((rec) => rec.recommendationObjectType === "USER");

  const deduplicatedRecommendations = userRecommendations.reduce((acc, rec) => {
    const existing = acc.find(r => r.recommendationObjectId === rec.recommendationObjectId);
    if (!existing || rec.score > existing.score) {
      return acc.filter(r => r.recommendationObjectId !== rec.recommendationObjectId).concat(rec);
    }
    return acc;
  }, [] as typeof userRecommendations);

  const userScores = deduplicatedRecommendations
    .reduce((acc, rec) => {
      acc[rec.recommendationObjectId] = rec.score;
      return acc;
    }, {} as Record<string, number>);

  // Helper function to get connection status with a recommended user
  const getConnectionStatus = (userId: string): "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED" | null => {
    if (!currentUser) return null;
    
    // Check connections from current user to recommended user
    const connectionFrom = currentUser.connectionsFrom?.find(conn => conn.toId === userId);
    if (connectionFrom) return connectionFrom.status as any;
    
    // Check connections from recommended user to current user
    const connectionTo = currentUser.connectionsTo?.find(conn => conn.fromId === userId);
    if (connectionTo) return connectionTo.status as any;
    
    return null;
  };

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
            connectionStatus={getConnectionStatus(user.id)}
          />
        );
      })}
    </div>
  );
};