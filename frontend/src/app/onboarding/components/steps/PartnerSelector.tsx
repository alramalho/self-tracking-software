"use client";

import React from "react";
import { PersonStanding, UserRoundPlus } from "lucide-react";
import { useOnboarding } from "../OnboardingContext";
import { withFadeUpAnimation } from "../../lib";

const OptionCard = ({
  isSelected,
  onClick,
  icon,
  title,
  description,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string | React.ReactNode;
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-blue-100" : "bg-gray-100"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3
            className={`text-lg font-semibold ${
              isSelected ? "text-blue-900" : "text-gray-900"
            }`}
          >
            {title}
          </h3>
          <p
            className={`text-sm mt-1 ${
              isSelected ? "text-blue-700" : "text-gray-600"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </button>
  );
};

const PartnerTypeSelector = () => {
  const { completeStep, partnerType, setPartnerType } = useOnboarding();

  const handlePlanSelect = (selectedType: "human" | "ai") => {
    completeStep(
      "partner-selection",
      { partnerType: selectedType },
      { nextStep: `${selectedType}-partner-finder` }
    );
  };

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <PersonStanding className="w-20 h-20 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
            Let&apos;s get you a partner.
          </h2>
        </div>
        <p className="text-md text-gray-600">
          Research shows having a partner significantly improves success rates,
          which is why this is an important step in your journey.
        </p>
        <p className="text-lg font-semibold text-gray-600">
          You have two options:
        </p>
      </div>

      <div className="space-y-4">
        <OptionCard
          isSelected={partnerType === "human"}
          onClick={() => handlePlanSelect("human")}
          icon={<UserRoundPlus className="w-6 h-6" />}
          title="Person"
          description={
            <>
              <p>Find me a human partner</p>
            </>
          }
        />
        <OptionCard
          isSelected={partnerType === "ai"}
          onClick={() => handlePlanSelect("ai")}
          icon={
            <img
              src="/images/jarvis_logo_transparent.png"
              className="w-9 h-9"
            />
          }
          title="AI"
          description={
            <>
              <p>I want personalized AI coaching</p>
            </>
          }
        />
      </div>
    </div>
  );
};

export default withFadeUpAnimation(PartnerTypeSelector);