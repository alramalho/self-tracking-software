"use client";

import { Skeleton } from "@/components/ui/skeleton";
import UserCard from "@/components/UserCard";
import { useActivities } from "@/contexts/activities";
import { usePlans } from "@/contexts/plans";
import { useRecommendations } from "@/contexts/recommendations";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn, isActivePlan } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { User } from "@tsw/prisma";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";

export const ApSearchComponent: React.FC = () => {
  const { currentUser, isLoadingCurrentUser } = useCurrentUser();
  const { plans, isLoadingPlans } = usePlans();
  const currentPlan = plans && plans.length > 0 ? plans?.reduce((min, plan) =>
    !min ||
    (plan.sortOrder !== null &&
      (min.sortOrder === null || plan.sortOrder < min.sortOrder))
      ? plan
      : min
  ) : null;

  const {
    recommendations,
    users: recommendedUsers,
    plans: recommendedPlans,
    isLoadingRecommendations,
  } = useRecommendations();
  const { activities, activityEntries } = useActivities();
  const [isProfileExpanded, setIsProfileExpanded] = useState(true);

  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const userScores = recommendations
    .filter((rec) => rec.recommendationObjectType === "USER")
    .reduce((acc, rec) => {
      acc[rec.recommendationObjectId] = rec.score;
      return acc;
    }, {} as Record<string, number>);

  if (isLoadingRecommendations || isLoadingCurrentUser || isLoadingPlans) {
    return (
      <div className="space-y-6 mt-4">
        <div>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 justify-items-center">
            <Skeleton className="h-48 w-full max-w-sm rounded-lg" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="space-y-6 mt-4">
        {currentUser && (
          <div>
            <button
              onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              className="flex items-center gap-2 w-full text-left mb-4 hover:opacity-70 transition-opacity"
            >
              <h2 className="text-lg font-semibold">Your profile</h2>
              {isProfileExpanded ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            <AnimatePresence>
              {isProfileExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="pt-2"
                >
                  <div className="grid grid-cols-1 justify-items-center">
                    <UserCard
                      user={currentUser}
                      plan={{emoji: currentPlan?.emoji || undefined, goal: currentPlan?.goal || ""}}
                      plans={plans?.filter((p) => isActivePlan(p)) || []}
                      activities={activities || []}
                      activityEntries={activityEntries || []}
                      showFriendRequest={false}
                      showScore={false}
                      showStreaks={false}
                      className={`max-w-sm ring-1 ${cn(
                        variants.ringBright,
                        variants.card.softGlassBg
                      )}`}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
      </div>
    </>
  );
};
