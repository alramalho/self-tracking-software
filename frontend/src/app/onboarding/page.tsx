"use client";

import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { ScanFace } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DynamicUISuggester } from "@/components/DynamicUISuggester";
import { useApiWithAuth } from "@/api";

function IntroStep({ onNext }: { onNext: () => void }) {
  const [profile, setProfile] = useState(false);
  const [plan, setPlan] = useState(false);
  const [partner, setPartner] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const handleCheckedChange = (setter: (value: boolean) => void) => (checked: boolean) => {
    setter(checked);
  };

  const handleContinue = () => {
    setAttempted(true);
    if (profile && plan && partner) {
      onNext();
    }
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      <div className="text-center">
        <ScanFace size={100} className="mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4">
          Our goal is helping you be more consistent. <br /> We&apos;re serious about that, now are you?
        </h2>
        <p className="text-gray-600 mb-6">
          Here&apos;s what we&apos;ll help you go through now
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className={`flex items-start space-x-3`}>
            <Checkbox 
              id="profile" 
              checked={profile} 
              onCheckedChange={handleCheckedChange(setProfile)} 
            />
            <label htmlFor="profile" className="text-sm leading-tight cursor-pointer">
              Create a user profile with vision and anti-vision (25% increased chances of success)
            </label>
          </div>
          {attempted && !profile && (
            <p className="text-sm text-red-500 pl-7">This field is mandatory</p>
          )}
        </div>

        <div className="space-y-2">
          <div className={`flex items-start space-x-3`}>
            <Checkbox 
              id="plan" 
              checked={plan} 
              onCheckedChange={handleCheckedChange(setPlan)} 
            />
            <label htmlFor="plan" className="text-sm leading-tight cursor-pointer">
              Create your own actionable plan (55% chance increase)
            </label>
          </div>
          {attempted && !plan && (
            <p className="text-sm text-red-500 pl-7">This field is mandatory</p>
          )}
        </div>

        <div className="space-y-2">
          <div className={`flex items-start space-x-3`}>
            <Checkbox 
              id="partner" 
              checked={partner} 
              onCheckedChange={handleCheckedChange(setPartner)} 
            />
            <label htmlFor="partner" className="text-sm leading-tight cursor-pointer">
              Get you an accountability partner (95% chance increase)
            </label>
          </div>
          {attempted && !partner && (
            <p className="text-sm text-red-500 pl-7">This field is mandatory</p>
          )}
        </div>
      </div>

      <Button 
        className="w-full mt-6"
        onClick={handleContinue}
      >
        I understand, let&apos;s do it
      </Button>
    </div>
  );
}

function SecondStep({ onNext }: { onNext: () => void }) {
  const questionsChecks = {
    "What do you do": "What does the user do",
    "Your vision for yourself (who do you want to become)": "The user ideal vision for himself",
    "Your anti-vision": "The user ideal anti-vision for himself",
  };
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const api = useApiWithAuth();

  const renderChildrenContent = useCallback((data: {
    question_checks: Record<string, boolean>;
    message: string;
  }) => (
    <div>
      <Button disabled={!allQuestionsAnswered} className="w-full" onClick={onNext}>
        Next
      </Button>
    </div>
  ), [allQuestionsAnswered, onNext]);

  return (
    <DynamicUISuggester<{
      question_checks: Record<string, boolean>;
      message: string;
    }>
      initialMessage="Great! Now, tell us a bit about yourself."
      questionsChecks={questionsChecks}
      onSubmit={async (text) => {
        const response = await api.post("/ai/update-user-profile-from-questions", {
          message: text,
          question_checks: questionsChecks,
        });

        setAllQuestionsAnswered(
          Object.values(response.data.question_checks).every((value) => value)
        );

        return response.data;
      }}
      renderChildren={renderChildrenContent}
    />
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return <IntroStep onNext={() => setStep(2)} />;
      case 2:
        return <SecondStep onNext={() => setStep(3)} />;
      default:
        return <IntroStep onNext={() => setStep(2)} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[60]">
      <div className="h-full w-full" id="onboarding-page">
        <div className="min-h-full flex flex-col items-center p-4 max-w-4xl mx-auto">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
