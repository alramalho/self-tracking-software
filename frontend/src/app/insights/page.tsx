"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressDots } from "@/components/ProgressDots";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Bell, ChevronRight, ChartBar, Eclipse } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CorrelationEntry } from "@/components/CorrelationEntry";
import { MetricRater } from "@/components/MetricRater";

const metrics = [
  { title: "Happiness", emoji: "😊" },
  { title: "Mood", emoji: "🌟" },
  { title: "Energy", emoji: "⚡️" },
  { title: "Productivity", emoji: "📈" },
  { title: "Gratitude", emoji: "🙏" },
];

export default function InsightsPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const { isPushGranted, requestPermission } = useNotifications();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [createdMetricId, setCreatedMetricId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApiWithAuth();

  const requestNotificationPermission = async () => {
    try {
      if (isPushGranted) {
        setStep(2);
      } else {
        await requestPermission();
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };


  const handleMetricSubmit = async () => {
    if (!selectedMetric) return;

    setIsLoading(true);
    try {
      // Create the metric in the backend
      const metricData = metrics.find((f) => f.title === selectedMetric);
      if (!metricData) return;

      const response = await api.post("/metrics", {
        title: metricData.title,
        emoji: metricData.emoji,
      });

      setCreatedMetricId(response.data.id);
      setStep(3);
    } catch (error) {
      console.error("Error creating metric:", error);
      toast.error("Failed to create metric");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!createdMetricId || !selectedRating) return;

    try {
      setIsLoading(true);
      await api.post("/log-metric", {
        metric_id: createdMetricId,
        rating: selectedRating,
      });

      toast.success("Rating submitted successfully");
      router.push("/insights/dashboard");
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit rating");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">
                Welcome to your insights dashboard!
              </h1>
              <p className="text-md text-muted-foreground">
                This is a page dedicated to correlate a metric of your choosing
                with your past activities
              </p>
            </div>

            <Card className="p-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">
                    Example correlations
                  </h2>
                  <p className="text-muted-foreground">
                    Metric chosen: Happiness 😊
                  </p>
                </div>

                <div className="space-y-4">
                  <CorrelationEntry 
                    title="💪 Gym in the last day"
                    pearsonValue={0.65}
                  />

                  <CorrelationEntry 
                    title="💪 Gym in the last 7 days"
                    pearsonValue={0.45}
                  />
                </div>

                <p className="text-sm text-muted-foreground italic">
                  These percentages show the Pearson correlation coefficient between your happiness and activities.
                  A positive correlation means the activity tends to increase your happiness, while a negative correlation means it tends to decrease it.
                  The stronger the correlation (closer to 100%), the stronger the relationship.
                </p>
              </div>
            </Card>

            <div className="flex flex-col items-center gap-4">
              <Button
                size="lg"
                className="w-full max-w-sm"
                onClick={requestNotificationPermission}
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
              <h1 className="text-2xl font-bold">Choose your metric</h1>
              <p className="text-md text-muted-foreground">
                Select what you&apos;d like to track and correlate with your activities
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.map((metric) => (
                <Card
                  key={metric.title}
                  className={`p-6 transition-all cursor-pointer hover:scale-105 ${
                    selectedMetric === metric.title ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedMetric(metric.title)}
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
                disabled={!selectedMetric}
                onClick={handleMetricSubmit}
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Next
              </Button>
            </div>
          </>
        );
      case 3:
        const selectedMetricData = metrics.find(
          (f) => f.title === selectedMetric
        );
        if (!selectedMetricData) return null;

        return (
          <MetricRater
            metricId={createdMetricId!}
            metricTitle={selectedMetricData.title}
            metricEmoji={selectedMetricData.emoji}
            onRatingSubmitted={() => router.push("/insights/dashboard")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">
          Insights & AI
        </h1>
        <p className="text-md text-muted-foreground">
          Discover patterns in your activities and get AI-powered assistance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Insights Card */}
        <Card
          className="p-6 transition-all cursor-pointer hover:scale-105"
          onClick={() => router.push("/insights/dashboard")}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <ChartBar className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-2">Activity Insights</h3>
              <p className="text-sm text-muted-foreground">
                Discover patterns and correlations between your activities and well-being metrics
              </p>
            </div>
          </div>
        </Card>

        {/* AI Card */}
        <Card
          className="p-6 transition-all cursor-pointer hover:scale-105"
          onClick={() => router.push("/ai")}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Eclipse className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-2">AI Assistant</h3>
              <p className="text-sm text-muted-foreground">
                Analyze emotions and extract activities from your entries with AI-powered tools
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
