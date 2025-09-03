"use client";

import { Button } from "@/components/ui/button";
import { WheelPicker, WheelPickerOption, WheelPickerWrapper } from "@/components/ui/wheel-picker";
import { useCurrentUser } from "@/contexts/users";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { withFadeUpAnimation } from "../../lib";
import { useOnboarding } from "../OnboardingContext";

const WelcomeStep = () => {
  const { completeStep } = useOnboarding();
  const [selectedAge, setSelectedAge] = useState("25");
  const { updateUser } = useCurrentUser();

  const ageOptions: WheelPickerOption[] = Array.from({ length: 83 }, (_, i) => ({
    label: (i + 18).toString(),
    value: (i + 18).toString(),
  }));

  const handleGetStarted = async () => {
    try {
      await updateUser({ age: parseInt(selectedAge) });
      completeStep("welcome");
    } catch (error) {
      console.error("Error updating user age:", error);
      completeStep("welcome");
    }
  };

  return (
    <div className="w-full max-w-md space-y-5">
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
      
      <div className="space-y-3">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            What&apos;s your age?
          </h3>
          {/* <p className="text-sm text-gray-600">
            This helps us personalize your experience
          </p> */}
        </div>
        
        <WheelPickerWrapper className="mx-auto max-w-xs h-48">
          <WheelPicker
            options={ageOptions}
            value={selectedAge}
            onValueChange={setSelectedAge}
          />
        </WheelPickerWrapper>
      </div>
      
      <div className="mx-auto w-fit">
        <Button
          size="lg"
          className="w-full rounded-xl"
          onClick={handleGetStarted}
        >
          Start
          <ArrowRight size={20} className="ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(WelcomeStep);