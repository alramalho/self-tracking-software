"use client";

import React, { useState } from "react";
import { ApiPlan, User, useUserPlan } from "@/contexts/UserPlanContext";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Settings,
  UserPlus,
  ChartArea,
  UserRoundCheck,
  ScanFace,
  CheckCircle,
  Circle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import GenericLoader from "@/components/GenericLoader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import posthog from "posthog-js";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
interface UserCardProps {
  user: User;
  score: number;
  plan?: ApiPlan;
}

const UserCard: React.FC<UserCardProps> = ({ user, score, plan }) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData, isLoading: isLoadingUser } =
    useCurrentUserDataQuery();
  const currentUser = userData?.user;
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const api = useApiWithAuth();
  const router = useRouter();

  const handleSendFriendRequest = async () => {
    try {
      setIsSendingRequest(true);
      posthog.capture("ap_friend_request_sent", {
        sent_from_user_id: currentUser?.id,
        sent_from_user_username: currentUser?.username,
        sent_to_user_id: user.id,
        sent_to_user_username: user.username,
      });
      await api.post(`/send-friend-request/${user.id}`);
      toast.success("Friend request sent successfully!");
    } catch (error) {
      console.error("[ClientPage] Error sending friend request:", error);
      toast.error("Failed to send friend request. Please try again.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden p-4 border border-gray-200">
      <div className="flex items-center mb-4">
        <Avatar
          onClick={() => router.push(`/profile/${user.username}`)}
          className="w-14 h-14 mr-3"
        >
          <AvatarImage src={user?.picture} alt={user?.name} />
          <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
        </Avatar>
        <div onClick={() => router.push(`/profile/${user.username}`)}>
          <h3 className="font-semibold text-lg">{user.name || "Anonymous"}</h3>
          {user.username && <p className="text-gray-500">@{user.username}</p>}
          {user.timezone && (
            <p className="text-gray-500 text-sm line-clamp-3 mt-1">
              📍 {user.timezone.replace("_", " ")}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <span className="mt-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium text-nowrap">
            {Math.round(score * 100)}% match
          </span>
        </div>
      </div>

      <div className="mb-3">
        {user.profile ? (
          <p className="text-gray-700 line-clamp-3">{user.profile}</p>
        ) : (
          <p className="text-gray-500 italic">No description available</p>
        )}
      </div>

      <div className="flex items-center text-sm text-gray-500">
        {user.age && <span className="mr-3">{user.age} years old</span>}
      </div>

      {plan && (
        <div>
          <p className="text-gray-400 text-xs">Working on</p>
          <p>
            {plan.emoji && (
              <span className="font-bold text-3xl mr-2">{plan.emoji}</span>
            )}{" "}
            <span className="font-bold text-xl">{plan.goal}</span>
          </p>
        </div>
      )}

      <Button
        loading={isSendingRequest}
        disabled={isSendingRequest}
        className="w-full mt-4"
        onClick={handleSendFriendRequest}
      >
        <UserPlus className="mr-2" />
        Add Friend
      </Button>
    </div>
  );
};

const LookingForApPage: React.FC = () => {
  const router = useRouter();
  const { useRecommendedUsersQuery, useCurrentUserDataQuery } = useUserPlan();
  const { data: userData, isLoading: isLoadingUser } =
    useCurrentUserDataQuery();

  const { data: recommendationsData, isLoading: isLoadingRecommendations } =
    useRecommendedUsersQuery();

  const recommendedUsers = recommendationsData?.users || [];
  const recommendations = recommendationsData?.recommendations || [];
  const { isPushGranted, requestPermission: requestNotificationPermission } =
    useNotifications();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

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

  if ((userData?.user?.plan_ids && userData?.user?.plan_ids.length && userData?.user?.plan_ids.length === 0) || userData?.user?.looking_for_ap || !isPushGranted) {
    const hasPlans = userData?.user?.plan_ids && userData?.user?.plan_ids.length && userData?.user?.plan_ids.length > 0;
    const userProfile = userData?.user?.profile;
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center gap-2 text-center w-full">
          <ScanFace className={`w-20 h-20 mx-auto ${variants.text}`} />
          <h1 className="text-2xl font-bold">Hey there!</h1>
          <p className="text-gray-500 text-sm">
            In order to give you the best matches, you need to have at least one
            plan and your profile description filled in. You should also enable
            notifications to be notified when a potential partner is found.
          </p>

          <div className="flex w-full flex-col gap-4 mt-6 text-left">
            <div className="flex flex-row items-center gap-3 p-4 border rounded-lg bg-white shadow-sm">
              <div className={`h-6 w-6 flex items-center justify-center rounded-full ${hasPlans ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {hasPlans ? 
                  <CheckCircle className="w-5 h-5" /> : 
                  <span className="text-lg font-semibold">1</span>
                }
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Create a plan</h3>
                <p className="text-sm text-gray-500">You need at least one plan to find a partner</p>
              </div>
              <Button 
                variant={hasPlans ? "outline" : "default"} 
                onClick={() => {
                  if (hasPlans) {
                    router.push("/plans");
                  } else {
                    router.push("/create-new-plan");
                  }
                }}
                className={hasPlans ? "border-green-200 text-green-600" : ""}
              >
                {hasPlans ? "View Plans" : "Create Plan"}
              </Button>
            </div>

            <div className="flex flex-row items-center gap-3 p-4 border rounded-lg bg-white shadow-sm">
              <div className={`h-6 w-6 flex items-center justify-center rounded-full ${userProfile ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {userProfile ? 
                  <CheckCircle className="w-5 h-5" /> : 
                  <span className="text-lg font-semibold">2</span>
                }
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{userProfile ? "Here's your profile:" : "Complete your profile"}</h3>
                <p className="text-sm text-gray-500">{userProfile ? userProfile : "Add a description to help find compatible partners"}</p>
              </div>
              <Button 
                variant={userProfile ? "outline" : "default"} 
                onClick={() => router.push(`/profile/${userData?.user?.username}?activeView=editProfile`)}
                className={userProfile ? "border-green-200 text-green-600" : ""}
              >
                {userProfile ? "Edit Profile" : "Add Description"}
              </Button>
            </div>

            <div className="flex flex-row items-center gap-3 p-4 border rounded-lg bg-white shadow-sm">
              <div className={`h-6 w-6 flex items-center justify-center rounded-full ${isPushGranted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {isPushGranted ? 
                  <CheckCircle className="w-5 h-5" /> : 
                  <span className="text-lg font-semibold">3</span>
                }
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Enable notifications</h3>
                <p className="text-sm text-gray-500">Get alerts when potential partners are found</p>
              </div>
              <Button 
                variant={isPushGranted ? "outline" : "default"} 
                onClick={() => requestNotificationPermission()}
                className={isPushGranted ? "border-green-200 text-green-600" : ""}
              >
                {isPushGranted ? "Enabled" : "Enable Now"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
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

export default LookingForApPage;
