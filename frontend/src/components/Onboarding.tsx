import React, { useState, useEffect } from "react";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react"; // Add this import

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
  const [isGenerating, setIsGenerating] = useState(false); // Add this state

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
    setIsGenerating(true); // Set loading state to true
    try {
      const response = await api.post("/api/onboarding/generate-plans");
      setPlans(response.data.plans);
      console.log({ plans: response.data.plans });
      setStep(4);
    } catch (error) {
      console.error("Error generating plans:", error);
      toast.error("Failed to generate plans. Please try again.");
    } finally {
      setIsGenerating(false); // Set loading state to false when done
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
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Select a Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {plans.map((plan, index) => (
                <Card key={index} className="mb-4">
                  <CardHeader>
                    <CardTitle>Plan {index + 1} - {plan.intensity} Intensity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Goal: {plan.goal || "Not specified"}</p>
                    <p>Finishing Date: {plan.finishing_date || "Not specified"}</p>
                    <p>Activities: {plan.activity_descriptions.join(", ")}</p>
                    <p>Number of sessions: {plan.sessions.length}</p>
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
