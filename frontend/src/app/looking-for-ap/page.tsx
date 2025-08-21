"use client";

import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import UserCard from "@/components/UserCard";
import { CompletePlan, useUserPlan } from "@/contexts/UserGlobalContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import {
  CheckCircle,
  ScanFace,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";


const LookingForApPage: React.FC = () => {
  const router = useRouter();
  const { useCurrentUserDataQuery, refetchUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const api = useApiWithAuth();

  const { isPushGranted, requestPermission: requestNotificationPermission } =
    useNotifications();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const hasPlans =
    userData?.plans &&
    userData?.plans.length &&
    userData?.plans.length > 0;

  if (hasPlans && userData?.lookingForAp && isPushGranted) {
    router.push("/ap-search");
  }
  
  const userProfile = userData?.profile;
  const currentUser = userData;
  const currentPlan = userData?.plans?.[0]; // Get the first plan if available

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="flex flex-col items-center gap-2 text-center w-full">
        <ScanFace className={`w-20 h-20 mx-auto ${variants.text}`} />
        <h1 className="text-2xl font-bold">Hey {userData?.name?.includes(" ") ? userData?.name.split(" ")[0] : "there"}!</h1>
        <h1 className="text-xl font-bold">Let&apos;s find you a partner</h1>
        <p className="text-gray-500 text-sm">
          There&apos;s a few things you need to do to get started.
        </p>

        <div className="flex w-full flex-col gap-4 mt-6 text-left">
          <div className="flex flex-row items-center gap-3 p-4 border rounded-lg bg-white shadow-sm">
            <div
              className={`h-6 w-6 flex items-center justify-center rounded-full ${
                hasPlans
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {hasPlans ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <span className="text-lg font-semibold">1</span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Create a plan</h3>
              <p className="text-sm text-gray-500">
                You need at least one plan so your matches know what you&apos;re working on
              </p>
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

          <div className="flex flex-col gap-3 p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex flex-row items-center gap-3">
              <div
                className={`h-6 w-6 flex items-center justify-center rounded-full ${
                  userProfile
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {userProfile ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span className="text-lg font-semibold">2</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">
                  {userProfile ? "Here's your profile:" : "Complete your profile"}
                </h3>
                <p className="text-sm text-gray-500">
                  {userProfile
                    ? "This is how other users will see you"
                    : "Add a description to help find compatible partners"}
                </p>
              </div>
              <Button
                variant={userProfile ? "outline" : "default"}
                onClick={async () => {
                  await api.post("/users/update-user", {  
                    lookingForAp: true,
                  });
                  currentUserDataQuery.refetch();
                  router.push(
                    `/profile/${userData?.username}?activeView=editProfile&redirectTo=/looking-for-ap`
                  );
                }}
                className={userProfile ? "border-green-200 text-green-600" : ""}
              >
                {userProfile ? "Edit Profile" : "Add Description"}
              </Button>
            </div>
            
            {/* Show UserCard when profile exists */}
            {userProfile && currentUser && (
              <div className="mt-4">
                <UserCard
                  user={currentUser}
                  plan={currentPlan as CompletePlan}
                  plans={userData?.plans as CompletePlan[] || []}
                  activities={userData?.activities || []}
                  activityEntries={userData?.activityEntries || []}
                  showFriendRequest={false}
                  showScore={false}
                  showStreaks={true}
                  className="max-w-sm mx-auto bg-white/50"
                />
              </div>
            )}
          </div>

          <div className="flex flex-row items-center gap-3 p-4 border rounded-lg bg-white shadow-sm">
            <div
              className={`h-6 w-6 flex items-center justify-center rounded-full ${
                isPushGranted
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {isPushGranted ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <span className="text-lg font-semibold">3</span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Enable notifications</h3>
              <p className="text-sm text-gray-500">
                Get alerts when people send you a friend request
              </p>
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
};

export default LookingForApPage;
