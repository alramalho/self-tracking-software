import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMetrics } from '@/contexts/metrics';
import { Check, X } from 'lucide-react';
import React from 'react';

interface MetricSuggestionProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  entry: {
    id: string;
    metric_id: string;
    date: string;
    rating: number;
  };
  disabled: boolean;
  onSuggestionHandled: () => void;
}

const MetricSuggestion: React.FC<MetricSuggestionProps> = ({
  metric,
  entry,
  disabled,
  onSuggestionHandled,
}) => {
  const {logMetrics} = useMetrics();

  const handleReject = () => {
    onSuggestionHandled();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{metric.emoji}</span>
          <div>
            <h3 className="font-semibold">{metric.title}</h3>
            <p className="text-sm text-muted-foreground">
              Rating: {entry.rating}/5 on {new Date(entry.date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReject}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              logMetrics([{
                metricId: metric.id,
                rating: entry.rating,
                date: new Date(entry.date),
              }]);
            }}
            disabled={disabled}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default MetricSuggestion; 