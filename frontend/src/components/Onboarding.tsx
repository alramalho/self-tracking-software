"use client";

import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import { Plan, useUserPlan } from "@/contexts/UserPlanContext";
import PlanRenderer from "./PlanRenderer";

interface OnboardingProps {
  isNewPlan?: boolean;
  onComplete?: (plan: Plan) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({
  isNewPlan = false,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [finishingDate, setFinishingDate] = useState<Date | undefined>(
    undefined
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planDescription, setPlanDescription] = useState("");
  const api = useApiWithAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(
    undefined
  );
  const { plans: userPlans, user } = useUserPlan();

  useEffect(() => {
    if (!isNewPlan && userPlans.length > 0) {
      toast.success("You already have a plan");
      router.push("/");
    }
  }, [isNewPlan, userPlans]);

  useEffect(() => {
    // Load user data when component mounts
    try {
      if (user && user.name) {
        setName(user.name);
        setStep(1); // Skip name step if user already has a name
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Error loading user data");
    }
  }, [user]);

  const handleGeneratePlans = async () => {
    setIsGenerating(true);
    try {
      console.log({
        planData: {
          goal,
          finishingDate: finishingDate?.toISOString(),
          planDescription: planDescription.trim() || undefined,
          emoji: selectedEmoji,
        },
      });
      const response = await api.post("/api/generate-plans", {
        goal,
        finishingDate: finishingDate?.toISOString().split("T")[0],
        planDescription: planDescription.trim() || undefined,
        emoji: selectedEmoji,
      });

      setPlans(response.data.plans);
      setStep(4);
    } catch (error) {
      console.error("Error generating plan:", error);
      toast.error("Failed to generate plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlanSelection = async (plan: Plan) => {
    try {
      if (plan) {
        await api.post("/api/select-plan", { ...plan, emoji: selectedEmoji });
        if (onComplete) {
          onComplete(plan);
        } else {
          router.push("/profile");
        }
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
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {isNewPlan ? "Plan Name" : "What is your name?"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isNewPlan ? "Enter plan name" : "Enter your name"}
                className="mb-4"
              />
              <Button
                className="w-full"
                onClick={() => {
                  if (!isNewPlan) {
                    api.post("/api/user", { name });
                  }
                  setStep(1);
                }}
                disabled={!name.trim()}
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );
      case 1:
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>What goal do you want to accomplish?</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                id="goal"
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Enter your goal"
                className="mb-4"
              />
              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!goal.trim()}
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Choose an emoji for your plan (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                id="emoji"
                type="text"
                value={selectedEmoji}
                onChange={(e) => setSelectedEmoji(e.target.value)}
                placeholder="Enter an emoji"
                className="mb-4"
                maxLength={2}
              />
              <Button className="w-full" onClick={() => setStep(3)}>
                Next
              </Button>
            </CardContent>
          </Card>
        );
      case 3:
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Do you have a finishing date? (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <DatePicker
                selected={finishingDate}
                onSelect={(date: Date | undefined) => setFinishingDate(date)}
              />
              <Button
                className="w-full mt-4"
                onClick={handleGeneratePlans}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <div className="flex flex-col items-center justify-center h-screen">
                      <Loader2 className="h-6 w-6 animate-spin mb-2" />
                      <span className="text-center">Generating Plans...</span>
                    </div>
                  </>
                ) : (
                  "Generate Plans"
                )}
              </Button>
            </CardContent>
          </Card>
        );
      case 4:
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Review Your Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
                placeholder="Enter additional plan description (optional)"
                className="mb-4"
              />
              <Button
                className="w-full mb-4"
                onClick={handleGeneratePlans}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating Plans...
                  </>
                ) : (
                  "Regenerate Plans"
                )}
              </Button>

              {plans.map((plan) => (
                <div key={plan.id} className="mb-6 border p-4 rounded-md">
                  <PlanRenderer
                    title={`${name} - ${plan.intensity} intensity`}
                    plan={plan}
                  />
                  <Button
                    className="w-full mt-4"
                    onClick={() => handlePlanSelection(plan)}
                  >
                    Select Plan
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8">
        {isNewPlan ? "Create New Plan" : "Welcome to the Self Tracking App! Let's get you started."}
      </h1>
      {isLoading ? (
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
