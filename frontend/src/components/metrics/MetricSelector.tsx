import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Metric {
  id: string;
  title: string;
  emoji: string;
}

interface MetricSelectorProps {
  metrics: Metric[];
  selectedMetricId: string | null;
  onMetricSelect: (metricId: string) => void;
  onAddMetricClick: () => void;
}

export function MetricSelector({
  metrics,
  selectedMetricId,
  onMetricSelect,
  onAddMetricClick,
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
      <Button
        variant="outline"
        size="icon"
        onClick={onAddMetricClick}
        className="ml-2"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
} 