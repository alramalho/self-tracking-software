import { ActivitySuggestionData, SuggestionHandler } from '../types/suggestions';
import ActivitySuggestion from '@/components/ActivitySuggestion';

export const activitySuggestionHandler: SuggestionHandler<ActivitySuggestionData> = {
  type: 'activity',
  component: ({ suggestion, disabled, onSuggestionHandled }) => (
    <ActivitySuggestion
      activity={suggestion.data.activity}
      activityEntry={suggestion.data.entry}
      disabled={disabled}
      onSuggestionHandled={() => onSuggestionHandled(suggestion)}
    />
  )
}; 