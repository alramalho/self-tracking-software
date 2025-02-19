import { Activity, ActivityEntry } from "./activities";

export interface SuggestionBase {
  id: string;
  type: string;
  data: any;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ActivitySuggestionData extends SuggestionBase {
  type: "activity";
  data: {
    activity: Activity;
    entry: ActivityEntry;
  };
}

export interface SuggestionHandler<T extends SuggestionBase> {
  type: string;
  component: React.ComponentType<{
    suggestion: T;
    disabled: boolean;
    onSuggestionHandled: (suggestion: T) => void;
  }>;
}
