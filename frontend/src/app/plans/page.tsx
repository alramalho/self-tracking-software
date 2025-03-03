"use client";

import React, { useState, useEffect } from "react";
import PlansRenderer from "@/components/PlansRenderer";
import { useSession } from "@clerk/nextjs";
import Link from "next/link";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AINotification from "@/components/AINotification";
import { useAIMessageCache } from "@/hooks/useAIMessageCache";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";


const PlansPage: React.FC = () => {
  
  const { isSignedIn } = useSession();
  const { useCurrentUserDataQuery } = useUserPlan();
  const [showServerMessage, setShowServerMessage] = useState(false);
  const { data: userData } = useCurrentUserDataQuery();
  const [shouldShowNotification, setShouldShowNotification] = useState(false);
  const router = useRouter();

  const { isEnabled: isAIEnabled } = useFeatureFlag("ai-bot-access");
  const { message: aiMessage, messageId, isDismissed, dismiss } = useAIMessageCache('plan');

  useEffect(() => {
    if (aiMessage && !isDismissed) {
      setShouldShowNotification(true);
    }
  }, [aiMessage, isDismissed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

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
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <div className="flex flex-col items-start">
          <p className="text-left">Loading your data...</p>
          {showServerMessage && (
            <span className="text-gray-500 text-sm text-left">
              we run on cheap servers...<br/>
              <Link target="_blank" href="https://ko-fi.com/alexramalho" className="underline">donate?</Link>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Welcome
        {userData.user?.name ? `, ${userData.user.name}` : ""}. Here are your active plans:
      </h1>

      {shouldShowNotification && (
        <AINotification
          message={aiMessage}
          createdAt={new Date().toISOString()}
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
      )}

      <PlansRenderer />
    </div>
  );
};

export default PlansPage;
