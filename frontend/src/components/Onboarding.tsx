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
import { Check, X, Loader2 } from "lucide-react";

import { Plan, useUserPlan } from "@/contexts/UserPlanContext";
import PlanRendererHeatmap from "./PlanRendererHeatmap";

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
  const [username, setUsername] = useState("");
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
  const { userData, fetchUserData, setUserData } = useUserPlan();
  const { plans: userPlans = [], user } = userData["me"] || {};
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  useEffect(() => {
    try {
      if (user) {
        if (user.name) {
          setName(user.name);
          setStep(1);
        }
        if (user.username) {
          setUsername(user.username);
          setStep(2);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Error loading user data");
    }
  }, [user]);

  const checkUsername = async (username: string) => {
    if (!username.trim()) {
      setIsUsernameAvailable(true);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const response = await api.get(`/api/check-username/${username}`);
      setIsUsernameAvailable(!response.data.exists);
    } catch (error) {
      console.error("Error checking username:", error);
      toast.error("Failed to check username availability");
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = (e.target.value).toLowerCase();
    setUsername(newUsername);
    checkUsername(newUsername);
  };

  const handleGeneratePlans = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post("/api/generate-plans", {
        goal,
        finishingDate: finishingDate?.toISOString().split("T")[0],
        planDescription: planDescription.trim() || undefined,
        emoji: selectedEmoji,
      });

      setPlans(response.data.plans);
      setStep(6);
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
        fetchUserData();
        if (onComplete) {
          onComplete(plan);
        } else {
          router.push("/profile/me");
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
              <CardTitle>What is your name?</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="mb-4"
              />
              <Button
                className="w-full"
                onClick={() => {
                  if (!isNewPlan) {
                    api.post("/api/update-user", { name });
                    setUserData("me", {
                      ...userData["me"],
                      // @ts-ignore
                      user: { ...userData["me"].user, name },
                    });
                    setStep(1);
                  }
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
              <CardTitle>Choose a username (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="Enter a username"
                className="mb-4"
              />
              {username.trim() !== "" && (
                <div className="flex items-center text-sm mb-4">
                  {isCheckingUsername ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <p>Checking username availability...</p>
                    </>
                  ) : isUsernameAvailable ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-lime-500" />
                      <p className="text-green-500">Username is available</p>
                    </>
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4 text-red-500" />
                      <p className="text-red-500">Username is already taken</p>
                    </>
                  )}
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => {
                  if (username.trim()) {
                    api.post("/api/update-user", { username });
                    setUserData("me", {
                      ...userData["me"],
                      // @ts-ignore
                      user: { ...userData["me"].user, username },
                    });
                  }
                  setStep(2);
                }}
                disabled={!isUsernameAvailable && username.trim() !== ""}
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
              <CardTitle>What goal do you want to accomplish?</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                id="goal"
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="I want to gain the habit to go to the gym 3 times a week on Mondays, Wednesdays and Tuesdays"
                className="mb-4"
              />
              <Button
                className="w-full"
                onClick={() => setStep(3)}
                disabled={!goal.trim()}
              >
                Next
              </Button>
            </CardContent>
          </Card>
        );
      case 3:
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
              <Button className="w-full" onClick={() => setStep(4)}>
                Next
              </Button>
            </CardContent>
          </Card>
        );
      case 4:
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
              <Button className="w-full mt-4" onClick={() => setStep(5)}>
                Next
              </Button>
            </CardContent>
          </Card>
        );
      case 5:
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Additional Plan Description (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
                placeholder="I want my plan to be with just a simple 'gym' activity measured in sessions"
                className="mb-4"
              />
              <Button
                className="w-full"
                onClick={handleGeneratePlans}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Plans...
                  </>
                ) : (
                  "Generate Plans"
                )}
              </Button>
            </CardContent>
          </Card>
        );
      case 6:
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Review Your Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {plans.map((plan) => (
                <div key={plan.id} className="mb-6 border p-4 rounded-md">
                  <PlanRendererHeatmap
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
              <Button
                className="w-full mt-4"
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
        {isNewPlan
          ? "Create New Plan"
          : "Welcome to the Self Tracking App! Let's get you started."}
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
