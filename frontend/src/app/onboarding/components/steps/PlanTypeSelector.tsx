"use client";

import React from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { useOnboarding } from "../OnboardingContext";
import { PlanType } from "@/contexts/UserGlobalContext";

export const PlanTypeSelector = () => {
  const { completeStep, setPlanType, planType } = useOnboarding();

  const handlePlanSelect = (selectedType: PlanType) => {
    completeStep("plan-type-selection", { planType: selectedType });
  };

  const planOptions = [
    {
      id: "timesPerWeek" as const,
      title: "Times per Week",
      description: "Set how many times per week you want to do activities",
      icon: CalendarDays,
    },
    {
      id: "specific" as const,
      title: "Custom Plan",
      description: "AI will generate a personalized schedule for you",
      icon: Sparkles,
    },
  ];

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <CalendarDays className="w-20 h-20 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
            Choose Your Plan Type
          </h2>
        </div>
        <p className="text-md text-gray-600">
          How would you like to structure your activities?
        </p>
      </div>

      <div className="space-y-4">
        {planOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = planType === option.id;
          
          console.log({
            planType,
            optionId: option.id,
            isSelected,
          });
          return (
            <button
              key={option.id}
              onClick={() => handlePlanSelect(option.id)}
              className={`w-full p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isSelected ? "bg-blue-500" : "bg-gray-100"
                }`}>
                  <Icon className={`w-6 h-6 ${
                    isSelected ? "text-white" : "text-gray-600"
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${
                    isSelected ? "text-blue-900" : "text-gray-900"
                  }`}>
                    {option.title}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    isSelected ? "text-blue-700" : "text-gray-600"
                  }`}>
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
