"use client";

import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { Loader2 } from "lucide-react";
import { ApiPlan, GeneratedPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useNotifications } from "@/hooks/useNotifications";
import NameStep from "./NameStep";
import UsernameStep from "./UsernameStep";
import GoalStep from "./GoalStep";
import EmojiStep from "./EmojiStep";
import FinishingDateStep from "./FinishingDateStep";
import PlanGenerationStep from "./PlanGenerationStep";
import InviteStep from "./InviteStep";
import NotificationStep from "./NotificationStep";
import toast from "react-hot-toast";

interface OnboardingProps {
  isNewPlan?: boolean;
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({
  isNewPlan = false,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [goal, setGoal] = useState("");
  const [finishingDate, setFinishingDate] = useState<Date | undefined>(
    undefined
  );
  const [generatedPlans, setGeneratedPlans] = useState<GeneratedPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ApiPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planDescription, setPlanDescription] = useState("");
  const api = useApiWithAuth();
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const { requestPermission, isPushGranted } = useNotifications();

  useEffect(() => {
    try {
      if (userData && step < 2) {
        if (userData.user?.name) {
          setName(userData.user.name);
          setStep(1);
        }
        if (userData.user?.username) {
          setUsername(userData.user.username);
          setStep(2);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Error loading user data");
    }
  }, [userData]);

  const checkUsername = async (username: string) => {
    if (!username.trim()) {
      setIsUsernameAvailable(true);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const response = await api.get(`/check-username/${username}`);
      setIsUsernameAvailable(!response.data.exists);
    } catch (error) {
      console.error("Error checking username:", error);
      toast.error("Failed to check username availability");
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleGeneratePlans = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post("/generate-plans", {
        goal,
        finishingDate: finishingDate?.toISOString().split("T")[0],
        planDescription: planDescription.trim() || undefined,
        emoji: selectedEmoji,
      });

      setGeneratedPlans(response.data.plans);
    } catch (error) {
      console.error("Error generating plan:", error);
      toast.error("Failed to generate plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlanSelection = async (plan: GeneratedPlan) => {
    console.log({ planToBeCreated: plan });
    try {
      if (plan) {
        const response = await api.post("/create-plan", {
          ...plan,
          emoji: selectedEmoji,
        });
        const createdPlan = response.data.plan;
        const createdActivities = response.data.activities;
        setSelectedPlan(createdPlan);
        userDataQuery.refetch();
        setStep(6);
      }
    } catch (error) {
      console.error("Plan creation error:", error);
      toast.error("Failed to create plan. Please try again.");
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <NameStep
            name={name}
            setName={setName}
            onNext={() => setStep(1)}
            isNewPlan={isNewPlan}
            api={api}
            userDataQuery={userDataQuery}
          />
        );
      case 1:
        return (
          <UsernameStep
            username={username}
            setUsername={setUsername}
            isUsernameAvailable={isUsernameAvailable}
            isCheckingUsername={isCheckingUsername}
            onNext={() => setStep(2)}
            api={api}
            userDataQuery={userDataQuery}
          />
        );
      case 2:
        return (
          <GoalStep
            goal={goal}
            setGoal={setGoal}
            onNext={() => setStep(3)}
          />
        );
      case 3:
        return (
          <EmojiStep
            selectedEmoji={selectedEmoji}
            setSelectedEmoji={setSelectedEmoji}
            onNext={() => setStep(4)}
          />
        );
      case 4:
        return (
          <FinishingDateStep
            finishingDate={finishingDate}
            setFinishingDate={setFinishingDate}
            onNext={() => setStep(5)}
          />
        );
      case 5:
        return (
          <PlanGenerationStep
            planDescription={planDescription}
            setPlanDescription={setPlanDescription}
            handleGeneratePlans={handleGeneratePlans}
            isGenerating={isGenerating}
            generatedPlans={generatedPlans}
            handlePlanSelection={handlePlanSelection}
            name={name}
          />
        );
      case 6:
        return (
          <InviteStep
            selectedPlan={selectedPlan}
            onNext={() => setStep(7)}
            userDataQuery={userDataQuery}
          />
        );
      case 7:
        return (
          <NotificationStep
            onComplete={onComplete}
            requestPermission={requestPermission}
            isPushGranted={isPushGranted}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8">
        {isNewPlan
          ? "Create New Plan"
          : "Welcome to the Self Tracking App! Let's get you started."}
      </h1>
      {userDataQuery.isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin">
          Loading your progress..
        </Loader2>
      ) : (
        renderStep()
      )}
    </div>
  );
};

export default Onboarding;
