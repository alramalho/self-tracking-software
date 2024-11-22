"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import CreatePlanCardJourney from "@/components/CreatePlanCardJourney";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import ActivityEditor from "@/components/ActivityEditor";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";

export default function OnboardingPage() {
  const router = useRouter();

  const [hasReadInstructions, setHasReadInstructions] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const { refetchUserData } = useUserPlan();

  const handleSaveActivity = async (activity: Activity) => {
    await refetchUserData();
    toast.success("Activity created successfully!");
    router.push("/profile/me");
  };

  return (
    <>
      <FloatingActionMenu className="z-[70]" />
      {showEditor && (
        <ActivityEditor
          onClose={() => setShowEditor(false)}
          onSave={handleSaveActivity}
        />
      )}
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 relative z-[60]">
        {hasReadInstructions ? (
          <CreatePlanCardJourney
            onComplete={() => {
              toast.success("Onboarding complete!");
              router.push("/profile/me");
            }}
          />
        ) : (
          <div className="text-center">
            <div className="flex flex-row items-center justify-center gap-5">
              <span className="text-[60px] animate-wiggle">👋</span>
              <span className="text-3xl font-bold font-mono">Hey!</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              Welcome to your{" "}
              <span className="text-blue-500 break-normal text-nowrap">
                tracking.so<span className="text-blue-300">ftware</span>
              </span>
            </h2>
            <p className="mt-5 text-md text-gray-600">
              Here you can track your plans and activities alongside your friends.
              <br />
            </p>
            <p className="mt-2 text-md text-gray-600">
              Let&apos;s start your journey by
            </p>
            <Button className="mt-4" onClick={() => setHasReadInstructions(true)}>
              Creating your first plan
            </Button>
            <p className="mt-4 text-sm text-gray-600">
              Or if you don&apos;t have an exact plan in mind, you can just
            </p>
            <Button variant="secondary" className="mt-2 border-2 border-gray-300" onClick={() => setShowEditor(true)}>
              Create your first activity
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
