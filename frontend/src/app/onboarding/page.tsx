"use client";

import Onboarding from "@/components/Onboarding";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8">Welcome to the Onboarding Process</h1>
      <Onboarding />
    </div>
  );
}