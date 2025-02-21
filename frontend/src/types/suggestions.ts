import {
  Activity,
  ActivityEntry,
  PlanMilestone,
} from "@/contexts/UserPlanContext";

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
      id: string;
      name: string;
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
    sessions: Array<{
      date: string;
      activity_id: string;
      activity_name: string;
      quantity: number;
      created_at?: string;
    }>;
  };
}

export interface PlanMilestoneSuggestionData extends SuggestionBase {
  type: "plan_milestones";
  data: {
    milestones: PlanMilestone[];
  };
}

export interface PlanFinishingDateSuggestionData extends SuggestionBase {
  type: "plan_finishing_date";
  data: {
    finishing_date: string; // YYYY-MM-DD format
    explanation?: string; // Optional explanation for the suggested date
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
