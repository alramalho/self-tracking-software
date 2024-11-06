"use client";

import Onboarding from "@/components/Onboarding";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "react-hot-toast";

export default function OnboardingPage() {
  const router = useRouter();
  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");

  useEffect(() => {
    if (hasLoadedUserData && userData && userData.plans?.length > 0) {
      router.push("/plans");
    }
  }, [userData, hasLoadedUserData, router]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Onboarding
        onComplete={() => {
          toast.success("Onboarding complete!");
          router.push("/profile/me");
        }}
      />
    </div>
  );
}
