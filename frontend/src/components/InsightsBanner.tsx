import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useRouter } from "next/navigation";
import { ExampleCorrelations } from "@/components/ExampleCorrelations";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { MetricRaters } from "@/components/MetricRaters";
import AppleLikePopover from "./AppleLikePopover";

interface InsightsBannerProps {
  open: boolean;
  onClose: () => void;
}

export function InsightsBanner({ open, onClose }: InsightsBannerProps) {
  const router = useRouter();
  const { isPushGranted, requestPermission } = useNotifications();
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
  const hasMetrics = (metricsAndEntriesData?.metrics?.length ?? 0) > 0;

  const requestNotificationPermission = async () => {
    try {
      if (isPushGranted) {
        router.push("/insights/onboarding");
      } else {
        await requestPermission();
      }
      onClose();
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      {hasMetrics ? (
        <div className="space-y-4 p-6">
          <h2 className="text-xl font-semibold mb-4">Activity Logged Successfully! How are you feeling?</h2>
          <MetricRaters />
        </div>
      ) : (
        <Card className="p-8">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">
                Try our Activity Insights!
              </h1>
              <p className="text-md text-muted-foreground">
                See how your activities affect your well-being with our powerful correlation tools
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
          </div>
        </Card>
      )}
    </AppleLikePopover>
  );
}
