"use client";

import React, { useState } from "react";
import { ApiPlan, User, useUserPlan } from "@/contexts/UserPlanContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import GenericLoader from "@/components/GenericLoader";
import { useNotifications } from "@/hooks/useNotifications";
import UserCard from "@/components/UserCard";
import { getThemeVariants } from "@/utils/theme";
import { cn } from "@/lib/utils";
import UserSearch from "./UserSearch";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { Info, Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export const ApSearchComponent: React.FC = () => {
  const { useRecommendedUsersQuery, useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserQuery;
  const currentUser = userData?.user;
  const currentPlan = userData?.plans[0];
  const api = useApiWithAuth();

  const { data: recommendationsData, isLoading: isLoadingRecommendations } =
    useRecommendedUsersQuery();
  const recommendedUsers = recommendationsData?.users || [];
  const recommendations = recommendationsData?.recommendations || [];
  const { isPushGranted, requestPermission: requestNotificationPermission } =
    useNotifications();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const userScores = recommendations
    .filter((rec) => rec.recommendationObjectType === "user")
    .reduce((acc, rec) => {
      acc[rec.recommendationObjectId] = rec.score;
      return acc;
    }, {} as Record<string, number>);

  const handleSendFriendRequest = async (userId: string) => {
    await toast.promise(
      (async () => {
        await api.post(`/users/send-friend-request/${userId}`);
        await currentUserQuery.refetch();
      })(),
      {
        loading: "Sending friend request...",
        success: "Friend request sent successfully",
        error: "Failed to send friend request",
      }
    );
  };

  if (isLoadingRecommendations) {
    return (
      <div className="flex justify-center items-center h-screen">
        <GenericLoader secondMessage="The first time you run this it might take a while. Hang tight!" />
      </div>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold mb-3">
        Recommended Accountability Partners{" "}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0 inline-flex align-text-top">
              <Info className="h-5 w-5 text-gray-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <p className="text-sm">
                We calculate your compatibility with other users based on your data and goals.
              </p>
              <p className="text-xs text-gray-500">
                If you think we could do anything better, please let us know!
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </h1>

      {recommendations.length === 0 ? (
        <div className="text-center pb-5">
          <p className="text-gray-500 text-lg text-left">
            😕 No recommended users found, you may still search for users manually
          </p>
          <br/>
          <UserSearch
            onUserClick={(user) => {
              handleSendFriendRequest(user.userId);
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {currentUser && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2 mx-auto w-full text-center text-gray-500">
                This is how your profile looks
              </h3>
              <UserCard
                user={currentUser}
                plan={currentPlan}
                plans={userData?.plans || []}
                activities={userData?.activities || []}
                activityEntries={userData?.activityEntries || []}
                showFriendRequest={false}
                showScore={false}
                showStreaks={false}
                className={`max-w-sm mx-auto ring-1 ${cn(
                  variants.ringBright,
                  variants.card.softGlassBg
                )}`}
              />
            </div>
          )}

          {recommendations.map((recommendation) => {
            const user = recommendedUsers.find(
              (user) => user.id === recommendation.recommendationObjectId
            );
            if (!user) {
              return null;
            }
            const plan = recommendationsData?.plans.find((plan) => {
              if (user.planIds.length > 0) {
                return user.planIds[0] === plan.id;
              }
              return false;
            });
            return (
              <UserCard
                key={user.id}
                user={user}
                score={userScores[user.id] || 0}
                plan={plan}
                plans={
                  recommendationsData?.plans.filter((p) =>
                    user.planIds.includes(p.id)
                  ) || []
                }
                showFriendRequest={true}
                showScore={true}
                showStreaks={true}
                className={`bg-white/50`}
              />
            );
          })}
        </div>
      )}
    </>
  );
};
