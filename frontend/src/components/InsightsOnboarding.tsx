import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ExampleCorrelations } from "@/components/ExampleCorrelations";
import { MetricRater } from "@/components/MetricRater";
import { useUserPlan } from "@/contexts/UserPlanContext";

const metrics = [
  { title: "Happiness", emoji: "😊" },
  { title: "Mood", emoji: "🌟" },
  { title: "Energy", emoji: "⚡️" },
  { title: "Productivity", emoji: "📈" },
  { title: "Gratitude", emoji: "🙏" },
];

export function InsightsOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const metricsQuery = useMetricsAndEntriesQuery();
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

            <ExampleCorrelations />

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
            onRatingSubmitted={() => {
                metricsQuery.refetch();
                router.push("/insights/dashboard")
            }}
          />
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