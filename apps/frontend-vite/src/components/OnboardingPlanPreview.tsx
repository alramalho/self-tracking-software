import { cn } from "@/lib/utils";
import { CalendarGrid, type CalendarSession, type CalendarActivity } from "./CalendarGrid";

interface Session {
  date: Date | string;
  activityId: string;
  quantity: number;
  // Support both camelCase and snake_case from backend
  descriptiveGuide?: string;
  descriptive_guide?: string;
  imageUrls?: string[];
}

interface Activity {
  id: string;
  title: string;
  emoji?: string;
  measure: string;
}

interface OnboardingPlanPreviewProps {
  sessions: Session[];
  activities: Activity[];
  className?: string;
  onSessionSelect?: (session: Session, activity: Activity) => void;
}

// Helper to get descriptive guide regardless of casing
const getDescriptiveGuide = (session: Session): string | undefined => {
  return session.descriptiveGuide || session.descriptive_guide;
};

export const OnboardingPlanPreview = ({
  sessions,
  activities,
  className,
  onSessionSelect,
}: OnboardingPlanPreviewProps) => {
  // Convert sessions to CalendarSession format
  const calendarSessions: CalendarSession[] = sessions.map((session) => ({
    date: session.date,
    activityId: session.activityId,
    quantity: session.quantity,
    descriptiveGuide: getDescriptiveGuide(session),
    imageUrls: session.imageUrls,
  }));

  // Convert activities to CalendarActivity format
  const calendarActivities: CalendarActivity[] = activities.map((activity) => ({
    id: activity.id,
    title: activity.title,
    emoji: activity.emoji,
    measure: activity.measure,
  }));

  const handleSessionSelect = (
    calendarSession: CalendarSession,
    calendarActivity: CalendarActivity
  ) => {
    // Find the original session and activity to pass to the callback
    const originalSession = sessions.find(
      (s) =>
        s.activityId === calendarSession.activityId &&
        new Date(s.date).getTime() === new Date(calendarSession.date).getTime()
    );
    const originalActivity = activities.find(
      (a) => a.id === calendarActivity.id
    );

    if (originalSession && originalActivity && onSessionSelect) {
      onSessionSelect(originalSession, originalActivity);
    }
  };

  return (
    <CalendarGrid
      sessions={calendarSessions}
      activities={calendarActivities}
      onSessionSelect={handleSessionSelect}
      showLegend={true}
      className={className}
    />
  );
};
