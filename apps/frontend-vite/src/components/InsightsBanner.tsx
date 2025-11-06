import { ExampleCorrelations } from "@/components/ExampleCorrelations";
import { MetricRaters } from "@/components/MetricRaters";
import { Button } from "@/components/ui/button";
import { useMetrics } from "@/contexts/metrics";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import AppleLikePopover from "./AppleLikePopover";

interface InsightsBannerProps {
  open: boolean;
  onClose: () => void;
}

export function InsightsBanner({ open, onClose }: InsightsBannerProps) {
  const navigate = useNavigate();
  const { metrics } = useMetrics();
  const hasMetrics = (metrics?.length ?? 0) > 0;
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeString = `${hours % 12 || 12}:${minutes
    .toString()
    .padStart(2, "0")}${hours >= 12 ? "pm" : "am"}`;

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      {hasMetrics ? (
        <>
          <h2 className="text-xl font-semibold m-4 mt-6 text-center">
            It&apos;s {timeString}, {hours < 19 ? "how's your day going?" : "how was your day?"} 😊
          </h2>
          <MetricRaters onAllRatingsSubmitted={onClose} />
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
              onClick={() => navigate({ to: "/insights/onboarding" })}
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
