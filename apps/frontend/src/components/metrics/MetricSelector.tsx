import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { usePaidPlan } from "@/hooks/usePaidPlan";

interface Metric {
  id: string;
  title: string;
  emoji: string;
}

interface MetricSelectorProps {
  metrics: Metric[];
  selectedMetricId: string | null;
  onMetricSelect: (metricId: string) => void;
}

export function MetricSelector({
  metrics,
  selectedMetricId,
  onMetricSelect,
}: MetricSelectorProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-2 flex-wrap flex-1">
        {metrics.map((metric) => (
          <Button
            key={metric.id}
            variant={selectedMetricId === metric.id ? "default" : "outline"}
            onClick={() => onMetricSelect(metric.id)}
            className="flex items-center gap-2"
          >
            <span>{metric.emoji}</span>
            <span>{metric.title}</span>
          </Button>
        ))}
      </div>
    </div>
  );
} 