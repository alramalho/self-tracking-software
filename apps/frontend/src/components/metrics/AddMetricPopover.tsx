import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AppleLikePopover from "@/components/AppleLikePopover";

interface DefaultMetric {
  title: string;
  emoji: string;
}

interface AddMetricPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMetrics: DefaultMetric[];
  existingMetrics: DefaultMetric[];
  selectedMetric: string | null;
  onMetricSelect: (metric: string) => void;
  onAddMetric: () => void;
  isCreating: boolean;
}

export function AddMetricPopover({
  isOpen,
  onClose,
  defaultMetrics,
  existingMetrics,
  selectedMetric,
  onMetricSelect,
  onAddMetric,
  isCreating,
}: AddMetricPopoverProps) {
  return (
    <AppleLikePopover
      open={isOpen}
      onClose={() => {
        onClose();
        onMetricSelect("");
      }}
      title="Add New Metric"
    >
      <div className="pt-8 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Add a new metric</h1>
          <p className="text-md text-muted-foreground">
            Select a metric you&apos;d like to track and correlate with your
            activities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {defaultMetrics
            .filter(
              (m) =>
                !existingMetrics.some((existing) => existing.title === m.title)
            )
            .map((metric) => (
              <Card
                key={metric.title}
                className={`p-6 transition-all cursor-pointer ${
                  selectedMetric === metric.title ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => onMetricSelect(metric.title)}
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{metric.emoji}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{metric.title}</h3>
                  </div>
                </div>
              </Card>
            ))}
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            className="w-full max-w-sm"
            disabled={!selectedMetric || isCreating}
            onClick={onAddMetric}
            loading={isCreating}
          >
            Add Metric
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );
} 