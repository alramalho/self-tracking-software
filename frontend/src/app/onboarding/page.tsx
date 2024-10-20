"use client";

import Onboarding from "@/components/Onboarding";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Onboarding onComplete={() => router.push("/profile/me")} />
    </div>
  );
}
