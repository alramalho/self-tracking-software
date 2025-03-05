import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useApiWithAuth } from '@/api';
import { useUserPlan } from '@/contexts/UserPlanContext';
import toast from 'react-hot-toast';

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
  const api = useApiWithAuth();
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();

  const handleAccept = async () => {
    try {
      await api.post('/log-metric', {
        metric_id: entry.metric_id,
        rating: entry.rating,
        date: entry.date,
      });
      
      metricsAndEntriesQuery.refetch();
      toast.success('Metric logged successfully');
      onSuggestionHandled();
    } catch (error) {
      console.error('Error logging metric:', error);
      toast.error('Failed to log metric');
    }
  };

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
            onClick={handleAccept}
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