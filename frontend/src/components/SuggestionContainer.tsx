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
        console.log('Processing suggestion:', suggestion);
        const handler = suggestionRegistry.getHandler(suggestion.type);
        console.log('Found handler:', handler ? 'yes' : 'no', 'for type:', suggestion.type);
        
        if (!handler) {
          console.warn('No handler found for suggestion type:', suggestion.type);
          return null
        };
        
        const Component = handler.component;
        console.log('Rendering component for suggestion:', suggestion.id);
        
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