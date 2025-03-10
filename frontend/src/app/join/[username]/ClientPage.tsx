"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useApiWithAuth } from "@/api";
import {
  User,
  Activity,
  ApiPlan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";

export default function ClientPage() {
  const params = useParams();
  console.log("[ClientPage] Rendering with params:", params);

  const router = useRouter();
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: currentUser } = useCurrentUserDataQuery();
  const { isSignedIn } = useUser();
  const [inviterData, setInviterData] = useState<{
    user: User;
    plans: ApiPlan[];
    activities: Activity[];
  } | null>(null);
  const [isLoadingInviterData, setIsLoadingInviterData] = useState(true);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const searchParams = useSearchParams();
  const referrer = searchParams.get("referrer");

  // Add initial mount logging
  useEffect(() => {
    console.log("[ClientPage] Component mounted with initial state:", {
      isSignedIn,
      hasLoadedUserData,
      currentUser: !!currentUser,
      params,
      referrer,
    });
  }, []);

  console.log("[ClientPage] Current state:", {
    isSignedIn,
    hasLoadedUserData,
    currentUser,
    isLoadingInviterData,
    isSendingRequest,
    referrer,
  });

  const areFriends = currentUser?.user?.friend_ids?.includes(
    inviterData?.user?.id || ""
  );

  useEffect(() => {
    console.log("[ClientPage] useEffect triggered for fetching user data");

    const fetchUserData = async () => {
      console.log(
        "[ClientPage] Fetching user data for username:",
        params.username
      );
      try {
        const response = await api.get(`/get-user-profile/${params.username}`);
        console.log(
          "[ClientPage] Successfully fetched user data:",
          response.data
        );
        if (!response.data) {
          throw new Error("No data received from API");
        }
        setInviterData(response.data);
      } catch (error) {
        console.error("[ClientPage] Error fetching user data:", error);
        toast.error("Failed to load user profile. Please try again.");
        setInviterData(null);
      } finally {
        console.log("[ClientPage] Finished loading user data");
        setIsLoadingInviterData(false);
      }
    };

    if (params.username) {
      fetchUserData();
    } else {
      console.error("[ClientPage] No username provided in params");
      setIsLoadingInviterData(false);
    }
  }, [params.username]);

  if (isLoadingInviterData || (isSignedIn && !hasLoadedUserData)) {
    console.log("[ClientPage] Showing loading state:", {
      isLoadingInviterData,
      isSignedIn,
      hasLoadedUserData,
    });
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Profile</p>
      </div>
    );
  }

  if (!inviterData) {
    console.error("[ClientPage] No inviter data found");
    return <div>Error: User profile not found</div>;
  }

  const handleSendFriendRequest = async () => {
    console.log(
      "[ClientPage] Attempting to send friend request to:",
      inviterData.user?.id
    );
    try {
      setIsSendingRequest(true);
      await api.post(`/send-friend-request/${inviterData.user?.id}`);
      console.log("[ClientPage] Friend request sent successfully");
      toast.success("Friend request sent successfully!");
      router.push(`/`);
    } catch (error) {
      console.error("[ClientPage] Error sending friend request:", error);
      toast.error("Failed to send friend request. Please try again.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAction = async () => {
    console.log("[ClientPage] handleAction triggered:", {
      isSignedIn,
      referrer,
      currentUser: !!currentUser,
      inviterData: !!inviterData,
    });

    if (!isSignedIn) {
      const redirectUrl = `/signup?redirect_url=/join/${params.username}&referrer=${params.username}`;
      console.log(
        "[ClientPage] User not signed in, redirecting to:",
        redirectUrl
      );
      router.push(redirectUrl);
      return;
    } else if (referrer) {
      console.log("[ClientPage] Handling referral for:", referrer);
      try {
        await api.post(`/handle-referral/${referrer}`);
        console.log("[ClientPage] Referral handled successfully");
      } catch (error) {
        console.error("[ClientPage] Error handling referral:", error);
      }
    }
    handleSendFriendRequest();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Profile Header */}
        <div className="flex flex-col items-center space-y-4">
          <Avatar className="w-24 h-24">
            <AvatarImage
              src={inviterData.user?.picture}
              alt={inviterData.user?.name}
            />
            <AvatarFallback>{inviterData.user?.name?.[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-medium text-center">
            Join {inviterData.user?.name} on tracking.so
          </h1>
          {areFriends && (
            <span className="text-gray-500 text-center mt-6">
              You are already friends with {inviterData.user?.name}!
            </span>
          )}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-8">
          {/* Plans Column */}
          <div>
            <h2 className="text-xl font-medium mb-4">Plans</h2>
            <div className="grid gap-3">
              {inviterData.plans.map((plan: ApiPlan, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-white rounded-lg border"
                >
                  <span className="text-2xl">{plan.emoji}</span>
                  <span className="font-medium">{plan.goal}</span>
                </div>
              ))}
              {inviterData.plans.length === 0 && (
                <p className="text-gray-500 text-center">No active plans</p>
              )}
            </div>
          </div>

          {/* Activities Column */}
          <div>
            <h2 className="text-xl font-medium mb-4">Activities</h2>
            <div className="grid gap-3">
              {inviterData.activities.map(
                (activity: Activity, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 bg-white rounded-lg border"
                  >
                    <span className="text-2xl">{activity.emoji}</span>
                    <span className="font-medium">{activity.title}</span>
                  </div>
                )
              )}
              {inviterData.activities.length === 0 && (
                <p className="text-gray-500 text-center">No activities yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {areFriends ? (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => router.push(`/profile/${params.username}`)}
              className="w-full max-w-md bg-black text-white"
            >
              View {inviterData.user?.name}&apos;s profile
            </Button>
          </div>
        ) : (
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleAction}
              className="w-full max-w-md bg-black text-white"
              disabled={isSendingRequest}
            >
              {isSendingRequest ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSignedIn ? (
                "Connect with " + inviterData.user?.name
              ) : (
                "Register to connect"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
