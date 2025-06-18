"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useOnboarding } from "../OnboardingContext";
import { NextButton } from "../../page";

export const WelcomeStep = () => {
  const { completeStep } = useOnboarding();

  const handleGetStarted = () => {
    completeStep("welcome");
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <img
            src="/icons/icon-transparent.png"
            alt="Tracking Software Logo"
            className="w-32 h-32 mx-auto"
          />
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome to your{" "}
            <span className="text-blue-500 break-normal text-nowrap">
              tracking.so<span className="text-blue-300">ftware</span>
            </span>
          </h2>
        </div>
        <p className="mt-2 text-md text-gray-600">
          The most effective app to improve your lifestyle.
        </p>
      </div>
      <div className="mx-auto w-fit">
        <NextButton name="Start" onClick={handleGetStarted} />
      </div>
    </div>
  );
};
