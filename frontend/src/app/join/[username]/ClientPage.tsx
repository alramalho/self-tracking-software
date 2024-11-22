"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useSession } from "@clerk/clerk-react";

export default function ClientPage({
  params,
}: {
  params: { username: string };
}) {
  const router = useRouter();
  const api = useApiWithAuth();
  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const currentUserQuery = useUserDataQuery("me");
  const { data: currentUser } = currentUserQuery;
  const { isSignedIn } = useSession();
  const [inviterData, setInviterData] = useState<{
    user: User;
    plans: ApiPlan[];
    activities: Activity[];
  } | null>(null);
  const [isLoadingInviterData, setIsLoadingInviterData] = useState(true);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const searchParams = useSearchParams();
  const referrer = searchParams.get("referrer");

  const areFriends = currentUser?.user?.friend_ids?.includes(
    inviterData?.user?.id || ""
  );

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await api.get(`/get-user-profile/${params.username}`);
        setInviterData(response.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setInviterData(null);
      } finally {
        setIsLoadingInviterData(false);
      }
    };

    fetchUserData();
  }, [params.username]);

  if (isLoadingInviterData || (isSignedIn && !hasLoadedUserData)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Profile</p>
      </div>
    );
  }

  if (!inviterData) {
    return <div>Error: User profile not found</div>;
  }

  const handleSendFriendRequest = async () => {
    try {
      setIsSendingRequest(true);
      await api.post(`/send-friend-request/${inviterData.user?.id}`);
      toast.success("Friend request sent successfully!");
      router.push(`/`);
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request. Please try again.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAction = async () => {
    if (!isSignedIn) {
      router.push(
        `/signup?redirect_url=/join/${params.username}&referrer=${params.username}`
      );
      return;
    } else if (referrer) {
      try {
        await api.post(`/handle-referral/${referrer}`);
      } catch (error) {
        console.error("Error handling referral:", error);
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
              View {inviterData.user?.name}'s profile
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
