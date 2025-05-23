"use client";

import React, { useState } from "react";
import { ApiPlan, User, useUserPlan } from "@/contexts/UserPlanContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import GenericLoader from "@/components/GenericLoader";
import { useNotifications } from "@/hooks/useNotifications";
import { posthog } from "posthog-js";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { getThemeVariants } from "@/utils/theme";
import { Textarea } from "@/components/ui/textarea";
import UserCard from "@/components/UserCard";

const ApSearchPage: React.FC = () => {
  const { useRecommendedUsersQuery } = useUserPlan();
  const { data: recommendationsData, isLoading: isLoadingRecommendations } =
    useRecommendedUsersQuery();
  const recommendedUsers = recommendationsData?.users || [];
  const recommendations = recommendationsData?.recommendations || [];
  const { isPushGranted, requestPermission: requestNotificationPermission } =
    useNotifications();
  const themeColors = useThemeColors();

  const userScores = recommendations
    .filter((rec) => rec.recommendation_object_type === "user")
    .reduce((acc, rec) => {
      acc[rec.recommendation_object_id] = rec.score;
      return acc;
    }, {} as Record<string, number>);

  if (isLoadingRecommendations) {
    return (
      <div className="flex justify-center items-center h-screen">
        <GenericLoader secondMessage="The first time you run this it might take a while. Hang tight!" />
      </div>
    );
  }
  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold">
        Recommended Accountability Partners
      </h1>
      <p className="text-gray-400 text-sm mt-2">
        We calculate your compatibility with other users based on your data and
        goals.
        <br />
        <span className="text-xs">
          If you think we could do anything better, please let us know!
        </span>
      </p>

      {recommendations.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No recommended users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {recommendations.map((recommendation) => {
            const user = recommendedUsers.find(
              (user) => user.id === recommendation.recommendation_object_id
            );
            if (!user) {
              return null;
            }
            const plan = recommendationsData?.plans.find((plan) => {
              if (user.plan_ids.length > 0) {
                return user.plan_ids[0] === plan.id;
              }
              return false;
            });
            return (
              <UserCard
                key={user.id}
                user={user}
                score={userScores[user.id] || 0}
                plan={plan}
                plans={recommendationsData?.plans.filter(p => user.plan_ids.includes(p.id)) || []}
                showFriendRequest={true}
                showScore={true}
                showStreaks={true}
              />
            );
          })}
        </div>
      )}

      {!isPushGranted && (
        <p className="text-gray-400 text-sm mt-4 px-4">
          Nothing of relevance yet?
          <br />{" "}
          <span
            className="underline cursor-pointer"
            onClick={() => requestNotificationPermission()}
          >
            Enable notifications
          </span>{" "}
          to be immediately notified when a potential partner is found.
        </p>
      )}
    </div>
  );
};

export default ApSearchPage;
