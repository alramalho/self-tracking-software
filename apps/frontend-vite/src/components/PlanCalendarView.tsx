import { useActivities } from "@/contexts/activities/useActivities";
import { type CompletePlan } from "@/contexts/plans";
import { cn } from "@/lib/utils";
import { isSameDay } from "date-fns";
import { CalendarGrid, type CalendarSession } from "./CalendarGrid";

interface PlanCalendarViewProps {
  plan: CompletePlan;
  className?: string;
}

export const PlanCalendarView = ({
  plan,
  className,
}: PlanCalendarViewProps) => {
  const { activities, activityEntries } = useActivities();

  // Convert plan sessions to CalendarSession format
  const sessions: CalendarSession[] = (plan.sessions || []).map((session) => ({
    date: new Date(session.date),
    activityId: session.activityId,
    quantity: session.quantity,
    descriptiveGuide: session.descriptiveGuide,
    imageUrls: session.imageUrls,
  }));

  // Get activities for this plan
  const planActivities = (plan.activities || [])
    .map((a) => activities.find((act) => act.id === a.id))
    .filter(Boolean)
    .map((a) => ({
      id: a!.id,
      title: a!.title,
      emoji: a!.emoji || undefined,
      measure: a!.measure,
    }));

  // Check if an activity was completed on a specific day
  const isCompletedOnDay = (activityId: string, day: Date) => {
    return activityEntries.some(
      (entry) =>
        entry.activityId === activityId &&
        isSameDay(new Date(entry.datetime), day)
    );
  };

  return (
    <CalendarGrid
      sessions={sessions}
      activities={planActivities}
      isCompletedOnDay={isCompletedOnDay}
      showLegend={true}
      className={className}
    />
  );
};
