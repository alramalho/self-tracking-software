"use client";

import React, { useState, useEffect } from "react";
import PlansRenderer from "@/components/PlansRenderer";
import { useSession } from "@clerk/nextjs";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useRouter, useSearchParams } from "next/navigation";
import AINotification from "@/components/AINotification";
import { useAIMessageCache } from "@/hooks/useAIMessageCache";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useUpgrade } from "@/contexts/UpgradeContext";
import GenericLoader from "@/components/GenericLoader";

const PlansPage: React.FC = () => {
  const { isSignedIn } = useSession();
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const { setShowUpgradePopover } = useUpgrade();
  const searchParams = useSearchParams();
  const selectedPlanFromUrl = searchParams.get('selectedPlan');
  // const { message: aiMessage, messageId, isDismissed, dismiss, timestamp } = useAIMessageCache('plan');

  // useEffect(() => {
  //   if (aiMessage && !isDismissed) {
  //     setShouldShowNotification(true);
  //   }
  // }, [aiMessage, isDismissed]);


  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <h1 className="text-3xl font-light text-gray-800 mb-6">
          welcome to tracking.so
        </h1>
        <Link
          href="/signin"
          className="bg-black text-white font-normal py-2 px-6 rounded hover:bg-gray-800 transition-colors duration-200"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <GenericLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">
        Welcome
        {userData.user?.name ? `, ${userData.user.name}` : ""}. Here are your
        active plans:
      </h1>

      {/* {shouldShowNotification && (
        <AINotification
          message={aiMessage}
          createdAt={new Date(timestamp).toISOString()}
          onDismiss={() => {
            setShouldShowNotification(false);
            dismiss();
          }}
          onClick={() => {
            setShouldShowNotification(false);
            router.push(
              `/ai?assistantType=plan-creation&messageId=${messageId}&messageText=${aiMessage}`
            );
          }}
          preview={!isAIEnabled}
        />
      )} */}

      <PlansRenderer initialSelectedPlanId={selectedPlanFromUrl} />
    </div>
  );
};

export default PlansPage;
