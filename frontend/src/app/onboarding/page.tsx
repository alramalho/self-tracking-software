"use client";

import Onboarding from "@/components/Onboarding";
import { convertPlanToApiPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const { userData, setUserData } = useUserPlan();
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Onboarding onComplete={() => router.push("/profile/me")} />
    </div>
  );
}
