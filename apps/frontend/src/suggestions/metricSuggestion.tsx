import { SuggestionHandler } from '../types/suggestions';
import MetricSuggestion from '@/components/MetricSuggestion';

export const metricSuggestionHandler: SuggestionHandler<any> = {
  type: 'metric',
  component: ({ suggestion, disabled, onSuggestionHandled }) => (
    <MetricSuggestion
      metric={suggestion.data.metric}
      entry={suggestion.data.entry}
      disabled={disabled}
      onSuggestionHandled={() => onSuggestionHandled(suggestion)}
    />
  )
}; 