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
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import HeatMap from "@uiw/react-heat-map";
import { addDays } from "date-fns";

interface Plan {
  goal: string;
  finishing_date?: string;
  activity_descriptions: string[];
  sessions: { date: string; descriptive_guide: string }[];
  intensity: string;
}

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [goal, setGoal] = useState("");
  const [finishingDate, setFinishingDate] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [planDescription, setPlanDescription] = useState("");
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const [focusedActivity, setFocusedActivity] = useState<string | null>(null);

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
          setFinishingDate(userData.onboarding_progress.finishing_date || "");
          // Set the appropriate step based on progress
          // This is a simple example, you might want to implement more sophisticated logic
          if (userData.onboarding_progress.name) setStep(1);
          if (userData.onboarding_progress.timezone) setStep(2);
          if (userData.onboarding_progress.goal) setStep(3);
          if (userData.onboarding_progress.finishing_date) {
            await handleGeneratePlans();
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
        planDescription: planDescription.trim() || undefined
      });
      setPlans(response.data.plans);
      console.log({ plans: response.data.plans });
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
    const sessions = plan.sessions.map(session => ({
      date: session.date.replaceAll('-', '/'),
      count: 1 // We'll use this to indicate a session
    }));

    // Add the finishing date to the heatmap data
    if (plan.finishing_date) {
      sessions.push({
        date: plan.finishing_date.replaceAll('-', '/'),
        count: 2 // We'll use 2 to indicate the finishing date
      });
    }

    return sessions;
  };

  const renderHeatMap = (plan: Plan) => {
    const today = new Date();
    const endDate = plan.finishing_date ? addDays(new Date(plan.finishing_date), 1) : undefined;
    const heatmapData = formatSessionsForHeatMap(plan);

    return (
      <div className="mb-4">
        <HeatMap
          value={heatmapData}
          startDate={today}
          endDate={endDate}
          height={200}
          rectSize={14}
          legendCellSize={12}
          rectProps={{
            rx: 3,
          }}
          rectRender={(props, data) => {
            // Customize the color for the finishing date
            if (data.count === 2) {
              props.fill = "#4299E1"; // A shade of blue
            }
            return (
              <rect
                {...props}
                onClick={() => {
                  setFocusedDate(data.date);
                  setFocusedActivity(null); // Reset focused activity when a new date is selected
                }}
              />
            );
          }}
          legendRender={(props) => (
            // @ts-ignore
            <rect {...props} y={props.y + 10} rx={props.range} />
          )}
          panelColors={{
            0: "#EBEDF0",
            1: "#9BE9A8",
            2: "#40C463",
            3: "#30A14E",
            4: "#216E39",
          }}
        />
        {renderActivityViewer(plan)}
      </div>
    );
  };

  const renderActivityViewer = (plan: Plan) => {
    if (!focusedDate) return null;

    const sessionsOnDate = plan.sessions.filter(
      session => session.date === focusedDate.replaceAll('/', '-')
    );

    const isFinishingDate = plan.finishing_date === focusedDate.replaceAll('/', '-');

    return (
      <div className="mt-4 p-4 border rounded-lg bg-white">
        <h3 className="text-lg font-semibold mb-2">
          {isFinishingDate ? (
            <span className="text-blue-600">Finishing Date: {format(new Date(focusedDate), 'MMMM d, yyyy')}</span>
          ) : (
            `Activities on ${format(new Date(focusedDate), 'MMMM d, yyyy')}`
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
                className={`p-2 mb-2 rounded cursor-pointer ${
                  focusedActivity === session.descriptive_guide
                    ? 'bg-blue-100'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => setFocusedActivity(session.descriptive_guide)}
              >
                <p>{session.descriptive_guide}</p>
              </div>
            ))}
            {focusedActivity && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <h4 className="font-semibold mb-2">Activity Details:</h4>
                <p>{focusedActivity}</p>
              </div>
            )}
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
                  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
                selected={finishingDate ? new Date(finishingDate) : undefined}
                onSelect={(date: any) => setFinishingDate(date ? date.toISOString().split('T')[0] : '')}
                className="mb-4"
              />
              <Button
                className="w-full"
                onClick={() => {
                  saveStep("finishing_date", finishingDate);
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
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlanDescription(e.target.value)}
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
                    <CardTitle>Plan {index + 1} - {plan.intensity} Intensity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Finishing Date: {plan.finishing_date || "Not specified"}</p>
                    <p>Activities: {plan.activity_descriptions.join(", ")}</p>
                    <p>Number of sessions: {plan.sessions.length}</p>
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
      <h1 className="text-2xl font-bold mb-8">Welcome to the Onboarding Process</h1>
      {renderStep()}
    </div>
  );
};

export default Onboarding;