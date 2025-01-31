"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, ApiPlan, useUserPlan } from "@/contexts/UserPlanContext";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import ActivityItem from "@/components/plan-configuration/ActivityItem";
import { ProgressDots } from "@/components/ProgressDots";
import { UserPlus, Bell, Check } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import PlanConfigurationForm from "@/components/plan-configuration/PlanConfigurationForm";

// Just add UI-specific fields to ApiPlan
interface PredefinedPlan
  extends Omit<ApiPlan, "id" | "user_id" | "created_at"> {
  description: string;
  activities: Activity[];
}

const PREDEFINED_PLANS: Record<string, PredefinedPlan> = {
  getFit: {
    goal: "Get Fit",
    emoji: "🏋️",
    description: "Track your fitness journey with gym workouts and running",
    times_per_week: 3,
    outline_type: "times_per_week",
    duration_type: "lifestyle",
    finishing_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    activities: [
      {
        id: "gym",
        title: "Gym",
        measure: "minutes",
        emoji: "💪",
      } as Activity,
      {
        id: "running",
        title: "Running",
        measure: "km",
        emoji: "🏃",
      } as Activity,
    ],
    sessions: [],
    activity_ids: [],
  },
  readBooks: {
    goal: "Read 12 Books",
    emoji: "📖",
    description: "Read one book per month for a year",
    times_per_week: 5,
    outline_type: "times_per_week",
    duration_type: "habit",
    activities: [
      {
        id: "reading",
        title: "Reading",
        measure: "minutes",
        emoji: "📚",
      } as Activity,
    ],
    milestones: Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i + 1);
      return {
        date: date.toISOString().split("T")[0],
        description: `Book ${i + 1}`,
      };
    }),
    sessions: [],
    activity_ids: [],
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const api = useApiWithAuth();
  const [step, setStep] = useState(1);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>();
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const { requestPermission, isPushGranted } = useNotifications();
  const { share, isSupported: isShareSupported } = useShare();
  const [copied, copyToClipboard] = useClipboard();
  const [isLoading, setIsLoading] = useState(false);
  const [isCustomPlan, setIsCustomPlan] = useState(false);

  useEffect(() => {
    // Find the scrollable container and scroll it to top
    const container = document.querySelector('#onboarding-page');
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  const handleCreatePredefinedPlan = async () => {
    setIsLoading(true);
    if (!selectedPlanKey) {
      toast.error("Please select a plan first");
      return;
    }

    const plan = PREDEFINED_PLANS[selectedPlanKey];

    try {
      // Create activities first
      const activitiesPromises = plan.activities.map((activity) =>
        api.post("/upsert-activity", {
          title: activity.title,
          measure: activity.measure,
          emoji: activity.emoji,
        })
      );

      const activitiesResponses = await Promise.all(activitiesPromises);
      const activityIds = activitiesResponses.map(
        (response) => response.data.id
      );

      // Create the plan with the activity IDs
      const apiPlan: Omit<ApiPlan, "id" | "user_id"> = {
        goal: plan.goal,
        emoji: plan.emoji,
        outline_type: "times_per_week" as const,
        times_per_week: plan.times_per_week,
        duration_type: plan.duration_type,
        activity_ids: activityIds,
        milestones: plan.milestones,
        sessions: [],
        created_at: new Date().toISOString(),
      };

      await api.post("/create-plan", apiPlan);
      toast.success(`Created plan successfully!`);
      userDataQuery.refetch();
      setStep(3);
    } catch (error) {
      console.error("Plan creation error:", error);
      toast.error("Failed to create plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteFriends = async () => {
    try {
      const link = `https://app.tracking.so/join/${userDataQuery.data?.user?.username}`;
      if (isShareSupported) {
        const success = await share(link);
        if (!success) throw new Error("Failed to share");
      } else {
        const success = await copyToClipboard(link);
        if (!success) throw new Error("Failed to copy");
      }
      toast.success("Link copied! Share it with your friends");
    } catch (error) {
      console.error("Failed to share/copy link");
      toast.error("Failed to share link");
    }
  };

  const handleCustomPlanConfirm = async (plan: ApiPlan) => {
    try {
      await api.post("/create-plan", plan);
      toast.success("Created custom plan successfully!");
      userDataQuery.refetch();
      setStep(3);
    } catch (error) {
      console.error("Plan creation error:", error);
      toast.error("Failed to create plan. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[60]">
      <div className="h-full w-full overflow-y-auto" id="onboarding-page">
        <div className="min-h-full flex flex-col items-center p-4 max-w-4xl mx-auto">
          <ProgressDots current={step} max={3} />

          {step === 1 ? (
            <>
              {/* Welcome text */}
              <div className="text-center mb-12">
                <div className="flex flex-row items-center justify-center gap-5 mb-4">
                  <span className="text-[60px] animate-wiggle">👋</span>
                  <span className="text-3xl font-bold font-mono">Hey!</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                  Welcome to your{" "}
                  <span className="text-blue-500 break-normal text-nowrap">
                    tracking.so<span className="text-blue-300">ftware</span>
                  </span>
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  Let&apos;s get started with a pre-configured plan
                </p>
              </div>

              {/* Plan cards */}
              <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl">
                {Object.entries(PREDEFINED_PLANS).map(([key, plan]) => (
                  <Card
                    key={key}
                    className={`relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                      selectedPlanKey === key
                        ? "bg-blue-50 border-blue-500"
                        : "bg-gray-50"
                    }`}
                    onClick={() => setSelectedPlanKey(key)}
                  >
                    {selectedPlanKey === key && (
                      <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-blue-500" />
                    )}
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{plan.emoji}</span>
                        <CardTitle>{plan.goal}</CardTitle>
                      </div>
                      <CardDescription className="mt-2">
                        {plan.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Activities as mini cards */}
                        <div className="flex flex-row gap-2">
                          {plan.activities.map((activity) => (
                            <ActivityItem
                              key={activity.id}
                              activity={activity as Activity}
                              isSelected={false}
                              className="h-[100px]"
                              onToggle={() => {}}
                            />
                          ))}
                        </div>

                        {/* Plan details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>{plan.times_per_week}x per week</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>
                              {plan.milestones
                                ? `${plan.milestones.length} milestones`
                                : "No milestones"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Create Plan Button */}
              <div className="mt-8 w-full max-w-3xl">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreatePredefinedPlan}
                  disabled={!selectedPlanKey || isLoading}
                  loading={isLoading}
                >
                  Create Plan
                </Button>
              </div>

              {/* Custom plan option */}
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Want to start from scratch instead?
                </p>
                <Button
                  variant="ghost"
                  className="text-gray-500"
                  onClick={async () => {
                    setIsCustomPlan(true);
                    setStep(2);
                  }}
                >
                  Create custom plan
                </Button>
              </div>
            </>
          ) : step === 2 ? (
            <div className="w-full max-w-3xl">
              <PlanConfigurationForm
                title="Custom Plan"
                onConfirm={handleCustomPlanConfirm}
              />
            </div>
          ) : (
            <div className="w-full max-w-3xl space-y-6">
              <h2 className="text-2xl font-bold text-center mb-8">
                Final Optimizations
              </h2>

              {/* Friends Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 self-start">
                      <UserPlus className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Invite Friends</CardTitle>
                      <CardDescription>
                        👉 People who have active friends in the app are 92%
                        more likely to keep to their plan
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleInviteFriends}
                    className="w-full"
                    variant="outline"
                  >
                    Invite Friends
                  </Button>
                </CardContent>
              </Card>

              {/* Notifications Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 self-start">
                      <Bell className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        Enable Notifications
                      </CardTitle>
                      <CardDescription>
                        👉 People who turn notifications on are 40% more likely
                        to stick to the app
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={requestPermission}
                    className="w-full"
                    variant={isPushGranted ? "outline" : "outline"}
                    disabled={isPushGranted}
                  >
                    {isPushGranted ? (
                      <>
                        <Check className="w-4 h-4 text-green-500 mr-2" />
                        Notifications Enabled
                      </>
                    ) : (
                      "Enable Notifications"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Continue Button */}
              <Button
                className="w-full mt-8"
                size="lg"
                onClick={() => router.push("/")}
              >
                Continue to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
