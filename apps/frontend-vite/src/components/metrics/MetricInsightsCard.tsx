import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { CorrelationEntry } from "@/components/metrics/CorrelationEntry";

interface Activity {
  id: string;
  title: string;
  emoji?: string;
  measure?: string;
}

interface Correlation {
  activity: Activity;
  correlation: number;
  sampleSize: number;
}

interface MetricInsightsCardProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  correlations: Correlation[];
  onHelpClick: () => void;
}

export function MetricInsightsCard({
  metric,
  correlations,
  onHelpClick,
}: MetricInsightsCardProps) {
  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex flex-row items-center gap-2">
              <span className="text-4xl">{metric.emoji}</span>
              <h2 className="text-lg font-bold">{metric.title} Insights</h2>
            </div>
            <p className="text-muted-foreground">
              Here&apos;s how your activities correlate with{" "}
              {metric.title.toLowerCase()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-gray-600"
            onClick={onHelpClick}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {correlations.map((correlation) => (
            <CorrelationEntry
              key={correlation.activity.id}
              title={`${correlation.activity.emoji || "📊"} ${correlation.activity.title}`}
              pearsonValue={correlation.correlation}
              sampleSize={correlation.sampleSize}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
