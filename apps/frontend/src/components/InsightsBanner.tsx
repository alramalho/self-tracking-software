import { ExampleCorrelations } from "@/components/ExampleCorrelations";
import { MetricRaters } from "@/components/MetricRaters";
import { Button } from "@/components/ui/button";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { ChevronRight, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import AppleLikePopover from "./AppleLikePopover";

interface InsightsBannerProps {
  open: boolean;
  onClose: () => void;
}

export function InsightsBanner({ open, onClose }: InsightsBannerProps) {
  const router = useRouter();
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
  const hasMetrics = (metricsAndEntriesData?.metrics?.length ?? 0) > 0;
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeString = `${hours % 12 || 12}:${minutes
    .toString()
    .padStart(2, "0")}${hours >= 12 ? "pm" : "am"}`;
  const canLogMetrics = true
    // process.env.NEXT_PUBLIC_ENVIRONMENT === "development" ? true : hours >= 16;

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      {hasMetrics ? (
        <>
          {canLogMetrics ? (
            <>
              <h2 className="text-xl font-semibold m-4 mt-6 text-center">
                It&apos;s {timeString}, {hours < 19 ? "how's your day going?" : "how was your day?"} 😊
              </h2>
              <MetricRaters onAllRatingsSubmitted={onClose} />
            </>
          ) : (
            <div className="text-center space-y-4 py-8">
              <Clock className="w-12 h-12 mx-auto text-gray-400" />
              <h2 className="text-xl font-semibold">
                Metrics can be logged after 4 PM
              </h2>
              <p className="text-gray-500">
                This helps you reflect on your entire day. Come back at 4 PM to
                log your metrics!
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold mt-8">
              📊 Try our Activity Insights!
            </h1>
            <p className="text-md text-muted-foreground">
              See how your activities affect your well-being with our powerful
              correlation tools
            </p>
          </div>

          <ExampleCorrelations />

          <div className="flex flex-col items-center gap-4">
            <Button
              size="lg"
              className="w-full max-w-sm"
              onClick={() => router.push("/insights/onboarding")}
            >
              <ChevronRight className="w-4 h-4 mr-2" />
              Go to insights page
            </Button>
          </div>
        </div>
      )}
    </AppleLikePopover>
  );
}
