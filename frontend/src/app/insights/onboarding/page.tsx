"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ScanFace } from "lucide-react";
import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ExampleCorrelations } from "@/components/ExampleCorrelations";
import { MetricRater } from "@/components/MetricRater";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import Divider from "@/components/Divider";

const metrics = [
  { title: "Happiness", emoji: "😊" },
  { title: "Mood", emoji: "🌟" },
  { title: "Energy", emoji: "⚡️" },
  { title: "Productivity", emoji: "📈" },
  { title: "Gratitude", emoji: "🙏" },
];

const MAX_METRICS = 2;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const metricsQuery = useMetricsAndEntriesQuery();
  const { isPushGranted, requestPermission } = useNotifications();
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [description, setDescription] = useState("");
  const [createdMetricIds, setCreatedMetricIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApiWithAuth();

  const requestNotificationPermission = async () => {
    try {
      setIsLoading(true);
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
      }, 3000);

      if (isPushGranted) {
        setStep(2);
      } else {
        await requestPermission();
      }

      clearTimeout(timeoutId);
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    } finally {
      setIsLoading(false);
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

  const handleRatingSubmitted = (metricId: string) => {
    // When a rating is submitted via MetricRater, we'll intercept it here
    // instead of letting it submit to the API
    const ratingButton = document.querySelector(`[data-metric-id="${metricId}"] .ring-primary`);
    if (ratingButton) {
      const rating = parseInt(ratingButton.textContent || "0", 10);
      if (rating > 0) {
        setRatings(prev => ({ ...prev, [metricId]: rating }));
      }
    }
    // Don't actually submit to API yet
    return Promise.resolve();
  };

  const handleMetricSubmit = async () => {
    if (selectedMetrics.length === 0) return;

    setIsLoading(true);
    try {
      const createdIds: string[] = [];
      
      // Create all selected metrics in sequence
      for (const metricTitle of selectedMetrics) {
        const metricData = metrics.find(f => f.title === metricTitle);
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

    setIsLoading(true);
    try {
      // Submit all ratings in sequence
      for (const metricId of createdMetricIds) {
        await api.post(`/metrics/${metricId}/entries`, {
          rating: ratings[metricId],
          description: description,
        });
      }

      toast.success("Ratings submitted successfully");
      metricsQuery.refetch();
      router.push("/insights/dashboard");
    } catch (error) {
      console.error("Error submitting ratings:", error);
      toast.error("Failed to submit ratings");
    } finally {
      setIsLoading(false);
    }
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

            <ExampleCorrelations />

            <div className="flex flex-col items-center gap-4">
              <Button
                size="lg"
                className="w-full max-w-sm"
                onClick={requestNotificationPermission}
                loading={isLoading}
                disabled={isLoading}
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Get Started
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
              {metrics.map((metric) => (
                <Card
                  key={metric.title}
                  className={`p-6 transition-all cursor-pointer hover:scale-105 ${
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
                const metric = metrics.find(m => m.title === metricTitle);
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
                disabled={isLoading || Object.keys(ratings).length !== selectedMetrics.length}
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
