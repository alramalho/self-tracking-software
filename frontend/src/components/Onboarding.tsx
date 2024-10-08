"use client";

import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Calendar } from "@/components/ui/calendar";
import toast from "react-hot-toast";
import { Loader2, ShieldEllipsisIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import HeatMap from "@uiw/react-heat-map";
import { addDays } from "date-fns";
import { Badge } from "./ui/badge";

interface Plan {
  goal: string;
  finishing_date?: Date;
  sessions: {
    date: Date;
    descriptive_guide: string;
    quantity: number;
    activity_name: string;
  }[];
  activities: { title: string; measure: string }[];
  intensity: string;
  overview: string;
}

interface ApiPlan extends Omit<Plan, "finishing_date" | "sessions"> {
  finishing_date?: string;
  sessions: { date: string; descriptive_guide: string; quantity: number }[];
}

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [goal, setGoal] = useState("");
  const [finishingDate, setFinishingDate] = useState<Date | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planDescription, setPlanDescription] = useState("");
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const api = useApiWithAuth();
  const router = useRouter();

  useEffect(() => {
    // Load onboarding progress when component mounts
    const loadOnboardingProgress = async () => {
      try {
        const response = await api.get("/api/onboarding/step");
        const userData = response.data;
        if (userData.onboarding_progress) {
          setName(userData.onboarding_progress.name || "");
          setTimezone(userData.onboarding_progress.timezone || "");
          setGoal(userData.onboarding_progress.goal || "");
          setFinishingDate(
            userData.onboarding_progress.finishing_date
              ? parseISO(userData.onboarding_progress.finishing_date)
              : null
          );
          // Set the appropriate step based on progress
          // This is a simple example, you might want to implement more sophisticated logic
          if (userData.onboarding_progress.name) setStep(1);
          if (userData.onboarding_progress.timezone) setStep(2);
          if (userData.onboarding_progress.goal) setStep(3);
          if (userData.onboarding_progress.finishing_date) {
            if (!isGenerating) {
              await handleGeneratePlans();
            }
            setStep(4);
          }
        }
      } catch (error) {
        console.error("Error loading onboarding progress:", error);
      }
    };
    loadOnboardingProgress();
  }, []);

  const saveStep = async (stepKey: string, stepValue: string) => {
    try {
      await api.post("/api/onboarding/step", { [stepKey]: stepValue });
    } catch (error) {
      console.error("Error saving onboarding step:", error);
    }
  };

  const handleGeneratePlans = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post("/api/onboarding/generate-plans", {
        planDescription: planDescription.trim() || undefined,
      });
      // Convert string dates to Date objects
      const plansWithDateObjects = response.data.plans.map((plan: ApiPlan) => ({
        ...plan,
        finishing_date: plan.finishing_date
          ? parseISO(plan.finishing_date)
          : undefined,
        sessions: plan.sessions.map((session) => ({
          ...session,
          date: parseISO(session.date),
        })),
      }));
      setPlans(plansWithDateObjects);
      setStep(4);
    } catch (error) {
      console.error("Error generating plans:", error);
      toast.error("Failed to generate plans. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlanSelection = async (plan: Plan) => {
    try {
      await api.post("/api/onboarding/select-plan", plan);
      router.push("/dashboard");
    } catch (error) {
      console.error("Plan selection error:", error);
    }
  };

  const formatSessionsForHeatMap = (plan: Plan) => {
    const sessions = plan.sessions.map((session) => ({
      date: format(session.date, "yyyy/MM/dd"),
      count: session.quantity,
    }));

    if (plan.finishing_date) {
      sessions.push({
        date: format(plan.finishing_date, "yyyy/MM/dd"),
        count: -1,
      });
    }

    return sessions;
  };

  const getActivityColorMatrix = () => {
    const baseColors = [
      ["#9AE6B4", "#68D391", "#48BB78", "#38A169", "#2F855A"], // green
      ["#BEE3F8", "#90CDF4", "#63B3ED", "#4299E1", "#3182CE"], // blue
      ["#FEB2B2", "#FC8181", "#F56565", "#E53E3E", "#C53030"], // red
      ["#FAF089", "#F6E05E", "#ECC94B", "#D69E2E", "#B7791F"], // yellow
      ["#E9D8FD", "#D6BCFA", "#B794F4", "#9F7AEA", "#805AD5"], // purple
      ["#FED7E2", "#FBB6CE", "#F687B3", "#ED64A6", "#D53F8C"], // pink
      ["#C3DAFE", "#A3BFFA", "#7F9CF5", "#667EEA", "#5A67D8"], // indigo
      ["#E2E8F0", "#CBD5E0", "#A0AEC0", "#718096", "#4A5568"], // gray
    ];
    return baseColors;
  };

  const getActivityColor = (activityIndex: number, intensityLevel: number) => {
    const colorMatrix = getActivityColorMatrix();
    const row = colorMatrix[activityIndex % colorMatrix.length];
    return row[Math.min(intensityLevel, row.length - 1)];
  };

  const renderHeatMap = (plan: Plan) => {
    const today = new Date();
    const endDate = plan.finishing_date
      ? addDays(plan.finishing_date, 1)
      : undefined;
    const heatmapData = formatSessionsForHeatMap(plan);

    // Calculate min and max quantities
    const quantities = plan.sessions.map((session) => session.quantity);
    const minQuantity = Math.min(...quantities);
    const maxQuantity = Math.max(...quantities);

    // Define intensity levels (excluding 0)
    const intensityLevels = 5;
    const intensityStep = (maxQuantity - minQuantity) / intensityLevels;

    return (
      <div className="mb-4">
        <div className="flex justify-center">
          <div className="flex flex-col">
            <HeatMap
              value={heatmapData}
              startDate={today}
              endDate={endDate}
              height={200}
              rectSize={14}
              legendRender={() => <></>}
              rectProps={{
                rx: 3,
              }}
              rectRender={(props, data) => {
                const session = plan.sessions.find(
                  (s) =>
                    format(s.date, "yyyy-MM-dd") ===
                    format(new Date(data.date), "yyyy-MM-dd")
                );

                let color = "#EBEDF0"; // Default color for no activity

                if (session) {
                  const activityIndex = plan.activities.findIndex(
                    (a) => a.title === session.activity_name
                  );
                  const intensityLevel = Math.min(
                    Math.floor(
                      (session.quantity - minQuantity) / intensityStep
                    ),
                    intensityLevels - 1
                  );
                  color = getActivityColor(activityIndex, intensityLevel);
                }

                return (
                  <rect
                    key={data.index}
                    {...props}
                    fill={color}
                    onClick={() => {
                      try {
                        const clickedDate = new Date(data.date);
                        console.log({ clickedDate });
                        if (!isNaN(clickedDate.getTime())) {
                          setFocusedDate(clickedDate);
                        } else {
                          console.error("Invalid date:", data.date);
                        }
                      } catch (error) {
                        console.error("Invalid date:", data.date);
                        console.error("Error setting focused date:", error);
                      }
                    }}
                  />
                );
              }}
            />
          </div>
          <div className="flex justify-center mt-4">
            {renderActivityLegend(plan)}
          </div>
        </div>
        <div className="flex justify-center mt-4">
          {renderActivityViewer(plan)}
        </div>
      </div>
    );
  };

  const renderActivityLegend = (plan: Plan) => {
    const colorMatrix = getActivityColorMatrix();
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {plan.activities.map((activity, index) => (
          <div key={index} className="flex flex-col items-center">
            <span className="text-sm font-semibold mb-1">
              {activity.title} ({activity.measure})
            </span>
            <div className="flex">
              {colorMatrix[index % colorMatrix.length].map(
                (color, intensityIndex) => (
                  <div
                    key={intensityIndex}
                    className="w-4 h-4 mr-1"
                    style={{ backgroundColor: color }}
                    title={`Intensity level ${intensityIndex + 1}`}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderActivityViewer = (plan: Plan) => {
    if (!focusedDate) return null;

    const sessionsOnDate = plan.sessions.filter(
      (session) =>
        format(session.date, "yyyy-MM-dd") === format(focusedDate, "yyyy-MM-dd")
    );

    const isFinishingDate =
      plan.finishing_date &&
      format(plan.finishing_date, "yyyy-MM-dd") ===
        format(focusedDate, "yyyy-MM-dd");

    return (
      <div className="mt-4 p-4 border rounded-lg bg-white w-full max-w-md w-96">
        <h3 className="text-lg font-semibold mb-2">
          {isFinishingDate ? (
            <span>
              🎉 Finishing Date: {format(focusedDate, "MMMM d, yyyy")}
            </span>
          ) : (
            `Activities on ${format(focusedDate, "MMMM d, yyyy")}`
          )}
        </h3>
        {isFinishingDate ? (
          <p>This is your goal completion date!</p>
        ) : sessionsOnDate.length === 0 ? (
          <p>No activities scheduled for this date.</p>
        ) : (
          <div>
            {sessionsOnDate.map((session, index) => (
              <div
                key={index}
                className="p-2 mb-2 rounded border border-gray-200"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  {plan.activities.map((activity, actIndex) => {
                    if (
                      plan.sessions.find(
                        (s) =>
                          format(s.date, "yyyy-MM-dd") ===
                            format(focusedDate, "yyyy-MM-dd") &&
                          s.activity_name === activity.title
                      )
                    ) {
                      return (
                        <Badge
                          key={actIndex}
                          className={`${getActivityColor(
                            actIndex,
                            session.quantity
                          )}`}
                        >
                          {activity.title}
                        </Badge>
                      );
                    }
                    return null;
                  })}
                </div>
                <p className="text-sm font-semibold">
                  Intensity: {session.quantity}{" "}
                  {
                    plan.activities.find(
                      (a) => a.title === session.activity_name
                    )?.measure
                  }
                </p>
                <p className="text-sm">{session.descriptive_guide}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
                  saveStep("name", name);
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
              <CardTitle>What is your location?</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => {
                  const timezone =
                    Intl.DateTimeFormat().resolvedOptions().timeZone;
                  setTimezone(timezone);
                  saveStep("timezone", timezone);
                  setStep(2);
                  toast.success("Timezone set successfully to " + timezone);
                }}
              >
                Get Location
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
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Enter your goal"
                className="mb-4"
              />
              <Button
                className="w-full"
                onClick={() => {
                  saveStep("goal", goal);
                  setStep(3);
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
              <CardTitle>Do you have a finishing date? (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <DatePicker
                selected={finishingDate!}
                onSelect={(date: Date | undefined) => setFinishingDate(date!)}
              />
              <Button
                className="w-full"
                onClick={() => {
                  saveStep(
                    "finishing_date",
                    finishingDate
                      ? finishingDate.toISOString().split("T")[0]
                      : ""
                  );
                  handleGeneratePlans();
                }}
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
      case 4:
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Select a Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe your ideal plan (optional)"
                value={planDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setPlanDescription(e.target.value)
                }
                className="mb-4"
              />
              <Button
                className="w-full mb-4"
                onClick={() => handleGeneratePlans()}
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
              <p>Goal: {goal}</p>
              {plans.map((plan, index) => (
                <Card key={index} className="mb-8">
                  <CardHeader>
                    <CardTitle>
                      Plan {index + 1} - {plan.intensity} Intensity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>
                      Finishing Date:{" "}
                      {plan.finishing_date
                        ? format(plan.finishing_date, "yyyy-MM-dd")
                        : "Not specified"}
                    </p>
                    <p>Number of sessions: {plan.sessions.length}</p>
                    <div className="mt-4 mb-4">
                      <h3 className="text-lg font-semibold mb-2">
                        Plan Overview:
                      </h3>
                      <p className="text-sm text-gray-600">{plan.overview}</p>
                    </div>
                    {renderHeatMap(plan)}
                    <Button
                      className="w-full mt-2"
                      onClick={() => handlePlanSelection(plan)}
                    >
                      Select This Plan
                    </Button>
                  </CardContent>
                </Card>
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
        Welcome to the Onboarding Process
      </h1>
      {renderStep()}
    </div>
  );
};

export default Onboarding;
