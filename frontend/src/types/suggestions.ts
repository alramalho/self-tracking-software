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

export interface PlanGoalSuggestionData extends SuggestionBase {
  type: "plan_goal";
  data: {
    goal: string;
  };
}

export interface PlanActivitySuggestionData extends SuggestionBase {
  type: "plan_activities";
  data: {
    activities: Array<{
      activity_name: string;
      emoji: string;
      measure: string;
    }>;
  };
}

export interface PlanTypeSuggestionData extends SuggestionBase {
  type: "plan_type";
  data: {
    plan_type: "specific" | "times_per_week";
  };
}

export interface PlanSessionsSuggestionData extends SuggestionBase {
  type: "plan_sessions";
  data: {
    sessions:
      | Array<{
          date: string;
          activity_name: string;
          quantity: number;
        }>
      | number; // number for times_per_week frequency
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
