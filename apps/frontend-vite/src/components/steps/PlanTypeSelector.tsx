"use client";

import NumberInput from "@/components/plan-configuration/NumberInput";
import { PlanOutlineType } from "@tsw/prisma";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheckBig, LandPlot, SquareChartGantt } from "lucide-react";
import { useOnboarding } from "../OnboardingContext";

export const PlanTypeSelector = () => {
  const { completeStep, setPlanType, planType, planTimesPerWeek, setPlanTimesPerWeek } = useOnboarding();

  const handlePlanSelect = (selectedType: PlanOutlineType) => {
    if (selectedType === "SPECIFIC") {
      completeStep("plan-type-selector", { planType: selectedType });
    } else {
      setPlanType(selectedType);
    }
  };

  const handleContinue = () => {
    completeStep("plan-type-selector", { 
      planType: "TIMES_PER_WEEK",
      timesPerWeek: planTimesPerWeek,
    });
  };

  const planOptions = [
    {
      id: "TIMES_PER_WEEK" as const,
      title: "Times per Week",
      description: "Set how many times per week you want to do activities",
      icon: CircleCheckBig,
    },
    {
      id: "SPECIFIC" as const,
      title: "Custom Plan",
      description: "AI will generate a personalized schedule for you",
      icon: SquareChartGantt,
    },
  ];

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <LandPlot className="w-20 h-20 text-blue-600" />
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
          
          return (
            <div key={option.id} className={`rounded-xl border-2 transition-all duration-200 ${
              isSelected
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-200 bg-white"
            }`}>
              <button
                onClick={() => handlePlanSelect(option.id)}
                className={`w-full p-6 text-left ${
                  !isSelected ? "hover:border-gray-300 hover:bg-gray-50" : ""
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
              
              <AnimatePresence>
                {isSelected && option.id === "TIMES_PER_WEEK" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 space-y-4">
                      <div className="border-t border-blue-200 pt-4">
                        <NumberInput
                          title="Times per Week"
                          value={planTimesPerWeek}
                          onChange={setPlanTimesPerWeek}
                          min={1}
                          max={7}
                        />
                      </div>
                      <button
                        onClick={handleContinue}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
