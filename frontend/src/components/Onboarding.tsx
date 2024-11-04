"use client";

import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import toast from "react-hot-toast";
import {
  Check,
  X,
  Loader2,
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  BellIcon,
} from "lucide-react";
import UserSearch, { UserSearchResult } from "./UserSearch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import {
  ApiPlan,
  convertGeneratedPlanToApiPlan,
  GeneratedPlan,
  Plan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import GeneratedPlanRenderer from "./GeneratedPlanRenderer";
import { useNotifications } from "@/hooks/useNotifications";
import InviteButton from "./InviteButton";

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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");
  const { userData, fetchUserData, setUserData } = useUserPlan();
  const { plans: userPlans = [], user } = userData["me"] || {};
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [selectedPlanLoading, setSelectedPlanLoading] = useState(false);
  const { requestPermission, isPushGranted } = useNotifications();

  useEffect(() => {
    try {
      if (user && step < 2) {
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
      const response = await api.get(`/check-username/${username}`);
      setIsUsernameAvailable(!response.data.exists);
    } catch (error) {
      console.error("Error checking username:", error);
      toast.error("Failed to check username availability");
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value.toLowerCase();
    setUsername(newUsername);
    checkUsername(newUsername);
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
      setStep(6);
    } catch (error) {
      console.error("Error generating plan:", error);
      toast.error("Failed to generate plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlanSelection = async (plan: GeneratedPlan) => {
    console.log({planToBeCreated: plan }) 
    try {
      if (plan) {
        const response = await api.post("/create-plan", {
          ...plan,
          emoji: selectedEmoji,
        });
        const createdPlan = response.data.plan;
        const createdActivities = response.data.activities;
        setSelectedPlan(createdPlan);
        setUserData("me", {
          ...userData["me"],
          plans: [...userData["me"].plans, createdPlan],
          activities: [...userData["me"].activities, ...createdActivities],
        });
        setStep(7); // Move to the invitation step
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
                    api.post("/update-user", { name });
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
              <CardTitle>Choose a username</CardTitle>
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
                    api.post("/update-user", { username });
                    setUserData("me", {
                      ...userData["me"],
                      // @ts-ignore
                      user: { ...userData["me"].user, username },
                    });
                  }
                  setStep(2);
                }}
                disabled={username.trim() === "" || !isUsernameAvailable}
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
                onClick={() => {
                  setStep(3);
                  setSelectedEmoji(""); // Clear the emoji when moving to the next step
                }}
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
                disablePastDates={true}
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
                placeholder="I want my plan to include just one 'gym' activity measured in sessions and one 'running' activity measured in kilometers"
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
                ) : generatedPlans.length > 0 ? (
                  "Regenerate Plans"
                ) : (
                  "Generate Plans"
                )}
              </Button>
              {generatedPlans.length > 0 && (
                <Button
                  className="w-full mt-4"
                  onClick={() => setStep(6)}
                  variant="outline"
                >
                  <ChevronRight className="mr-2 h-4 w-4" />
                  See plans again
                </Button>
              )}
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
              {generatedPlans.map((plan) => (
                <div key={plan.id} className="mb-6 border p-4 rounded-md">
                  <GeneratedPlanRenderer
                    title={`${name} - ${plan.intensity} intensity`}
                    plan={plan}
                  />
                  <Button
                    className="w-full mt-4"
                    onClick={() => {
                      setSelectedPlanLoading(true);
                      handlePlanSelection(plan)
                    }}
                  >
                    {selectedPlanLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckIcon className="mr-2 h-4 w-4" />}
                    Select and Create Plan
                  </Button>
                </div>
              ))}
              <Button
                className="w-full mt-4"
                onClick={() => setStep(5)}
                variant="outline"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Edit Plan Description
              </Button>
            </CardContent>
          </Card>
        );
      case 7:
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                Challenge People to do it with you! (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InviteButton
                embedded={true}
                planId={selectedPlan!.id!}
                onInviteSuccess={() => {
                  fetchUserData({ forceUpdate: true });
                }}
              />
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setStep(8)}
              >
                <ChevronRight className="mr-2 h-4 w-4" />
                Skip
              </Button>
            </CardContent>
          </Card>
        );
      case 8:
        if (isPushGranted) {
          onComplete();
          return <></>;
        }

        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Enable the Integrated Experience</CardTitle>
              <CardDescription>
                Get notifications to stay on top of your friends&apos; progress and receive proactive engagement from our AI coach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                You can always adjust notification settings in your profile later.
              </div>
              <Button 
                className="w-full"
                onClick={() => {
                  onComplete();
                  requestPermission();
                }}
              >
                <BellIcon className="mr-2 h-4 w-4" />
                Enable Notifications
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
