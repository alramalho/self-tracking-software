"use client";

import Onboarding from "@/components/Onboarding";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export default function OnboardingPage() {
  const router = useRouter();

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
