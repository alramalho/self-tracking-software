import { SuggestionBase } from '../types/suggestions';
import { suggestionRegistry } from '../lib/suggestionRegistry';

export const SuggestionContainer: React.FC<{
  suggestions: SuggestionBase[];
  onSuggestionHandled: (suggestion: SuggestionBase) => void;
  isConnected: boolean;
}> = ({ suggestions, onSuggestionHandled, isConnected }) => {
  return (
    <div className="flex flex-col gap-4 px-4 mb-4">
      {suggestions.map((suggestion) => {
        const handler = suggestionRegistry.getHandler(suggestion.type);
        
        if (!handler) {
          return null
        };
        
        const Component = handler.component;
        
        return (
          <Component
            key={suggestion.id}
            suggestion={suggestion}
            onSuggestionHandled={onSuggestionHandled}
            disabled={!isConnected}
          />
        );
      })}
    </div>
  );
}; 