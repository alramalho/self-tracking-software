"use client";

import { useApiWithAuth } from "@/api";
import Divider from "@/components/Divider";
import InsightsDemo from "@/components/InsightsDemo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import { useMetrics } from "@/contexts/metrics";
import { MAX_METRICS } from "@/contexts/metrics/lib";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { useNotifications } from "@/hooks/useNotifications";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { todaysLocalDate } from "@/lib/utils";
import { ChevronRight, ScanFace } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { defaultMetrics } from "../metrics";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const { logMetrics, isLoggingMetrics } = useMetrics();
  const { isPushGranted, requestPermission } = useNotifications();
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [description, setDescription] = useState("");
  const [createdMetricIds, setCreatedMetricIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApiWithAuth();
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const isUserOnFreePlan = userPaidPlanType === "FREE";
  const { setShowUpgradePopover } = useUpgrade();
  const router = useRouter()


  const handleContinue = () => {
    if (isUserOnFreePlan) {
      setShowUpgradePopover(true);
    } else {
      router.push("/insights/dashboard");
    }
  };

  const toggleMetricSelection = (title: string) => {
    if (selectedMetrics.includes(title)) {
      setSelectedMetrics(prev => prev.filter(m => m !== title));
      return;
    }
    
    if (selectedMetrics.length >= MAX_METRICS) {
      toast.error(`You can only select up to ${MAX_METRICS} metrics`);
      return;
    }

    setSelectedMetrics(prev => [...prev, title]);
  };

  const handleMetricSubmit = async () => {
    if (selectedMetrics.length === 0) return;

    setIsLoading(true);
    try {
      const createdIds: string[] = [];
      
      // Create all selected metrics in sequence
      for (const metricTitle of selectedMetrics) {
        const metricData = defaultMetrics.find(f => f.title === metricTitle);
        if (!metricData) continue;

        const response = await api.post("/metrics", {
          title: metricData.title,
          emoji: metricData.emoji,
        });

        createdIds.push(response.data.id);
      }

      setCreatedMetricIds(createdIds);
      toast.success("Metrics created successfully");
      setStep(3);
    } catch (error) {
      console.error("Error creating metrics:", error);
      toast.error("Failed to create metrics");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAllRatings = async () => {
    if (Object.keys(ratings).length !== selectedMetrics.length) {
      toast.error("Please rate all metrics");
      return;
    }
    logMetrics(Object.entries(ratings).map(([metricId, rating]) => ({
      metricId,
      rating,
      date: todaysLocalDate(),
      description,
    })));
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <div className="flex flex-col items-center space-y-8">
              <div className="text-center space-y-4">
                <ScanFace className="w-12 h-12 text-blue-500 mx-auto" />
                <h1 className="text-2xl font-bold">
                  Welcome to your insights!
                </h1>
                <p className="text-md text-muted-foreground">
                  This is a page dedicated to correlate metrics of your choosing
                  with your past activities
                </p>
              </div>
            </div>

            <InsightsDemo />

            <div className="flex flex-col items-center gap-4">
              <Button
                size="lg"
                className="w-full max-w-sm"
                onClick={handleContinue}
                loading={isLoading}
                disabled={isLoading}
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                {isUserOnFreePlan ? "Try for free" : "Get Started"}
              </Button>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">Choose your metrics</h1>
              <p className="text-md text-muted-foreground">
                Select up to {MAX_METRICS} metrics you&apos;d like to track and correlate with your activities
              </p>
              <p className="text-sm font-medium">
                Selected: {selectedMetrics.length}/{MAX_METRICS}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {defaultMetrics.map((metric) => (
                <Card
                  key={metric.title}
                  className={`p-6 transition-all cursor-pointer ${
                    selectedMetrics.includes(metric.title) ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => toggleMetricSelection(metric.title)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{metric.emoji}</span>
                    <div>
                      <h3 className="font-semibold">{metric.title}</h3>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex flex-col items-center gap-4">
              <Button
                size="lg"
                className="w-full max-w-sm"
                disabled={selectedMetrics.length === 0 || isLoading}
                onClick={handleMetricSubmit}
                loading={isLoading}
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Next
              </Button>
            </div>
          </>
        );
      case 3:
        return (
          <div className="space-y-8">
            <div className="space-y-8">
              {selectedMetrics.map((metricTitle, index) => {
                const metric = defaultMetrics.find(m => m.title === metricTitle);
                if (!metric) return null;
                
                const metricId = createdMetricIds[index];
                
                return (
                  <div 
                    key={metricId} 
                    className="space-y-4"
                    data-metric-id={metricId}
                  >
                    <div className="text-center space-y-4">
                      <h1 className="text-2xl font-bold">
                        Rate your {metric.title}
                      </h1>
                      <p className="text-md text-muted-foreground">
                        How would you rate your {metric.title.toLowerCase()} today?
                      </p>
                      <div className="text-4xl">{metric.emoji}</div>
                    </div>

                    <div className="flex justify-center gap-2 my-12">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => {
                            setRatings(prev => ({ ...prev, [metricId]: rating }));
                          }}
                          className={`
                            w-16 h-16 rounded-xl text-2xl font-bold
                            transition-all duration-200
                            border-2 bg-background
                            ${
                              {
                                1: "text-red-500",
                                2: "text-orange-500",
                                3: "text-yellow-500",
                                4: "text-lime-500",
                                5: "text-green-500",
                              }[rating]
                            }
                            ${
                              ratings[metricId] === rating
                                ? "ring-2 ring-offset-2 ring-primary scale-110 border-primary"
                                : "border-muted-foreground/20 hover:border-primary hover:scale-105"
                            }
                          `}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <Divider />
            <div className={`space-y-4 transition-opacity duration-200 ${Object.keys(ratings).length !== selectedMetrics.length ? 'opacity-50' : 'opacity-100'}`}>
              <h1 className="text-center font-bold text-lg">
                Why this rating?
              </h1>
              <TextAreaWithVoice
                placeholder="Anything specific that influenced your rating today?"
                value={description}
                onChange={setDescription}
                className="min-h-[100px] bg-white"
                disabled={Object.keys(ratings).length !== selectedMetrics.length}
              />

              <Button
                size="lg"
                className="w-full"
                onClick={handleSubmitAllRatings}
                disabled={isLoading || isLoggingMetrics || Object.keys(ratings).length !== selectedMetrics.length}
                loading={isLoggingMetrics}
              >
                Submit Ratings
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      {renderStep()}
    </div>
  );
}
