import { CalendarGrid, type CalendarActivity, type CalendarSession } from "@/components/CalendarGrid";
import { type CompletePlan } from "@/contexts/plans";
import { cn } from "@/lib/utils";
import { isSameDay } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ActivityEntry, PlanSession } from "@tsw/prisma";

interface UpcomingSessionsCardProps {
  plans: CompletePlan[];
}

function isSessionCompleted(
  session: PlanSession,
  plans: CompletePlan[],
  day: Date
) {
  return plans.some((plan) =>
    plan.progress?.weeks?.some((week: any) =>
      (week.completedActivities || []).some(
        (entry: ActivityEntry) =>
          entry.activityId === session.activityId &&
          isSameDay(new Date(entry.datetime), day)
      )
    )
  );
}

export const UpcomingSessionsCard = ({ plans }: UpcomingSessionsCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const specificPlans = plans.filter((plan) => plan.outlineType === "SPECIFIC");

  const sessions: CalendarSession[] = specificPlans.flatMap((plan) =>
    (plan.sessions || []).map((session) => ({
      id: session.id,
      date: session.date,
      activityId: session.activityId,
      planId: plan.id,
      planTitle: plan.goal,
      planEmoji: plan.emoji || undefined,
      quantity: session.quantity,
      descriptiveGuide: session.descriptiveGuide ?? undefined,
      imageUrls: session.imageUrls ?? undefined,
    }))
  );

  const activityMap = new Map<string, CalendarActivity>();
  for (const plan of specificPlans) {
    for (const activity of plan.activities || []) {
      if (!activityMap.has(activity.id)) {
        activityMap.set(activity.id, {
          id: activity.id,
          title: activity.title,
          emoji: activity.emoji ?? undefined,
          measure: activity.measure ?? undefined,
        });
      }
    }
  }

  if (sessions.length === 0) return null;

  const today = new Date();
  const incompleteTodayCount = specificPlans
    .flatMap((plan) => plan.sessions || [])
    .filter(
      (session) =>
        isSameDay(new Date(session.date), today) &&
        !isSessionCompleted(session, specificPlans, today)
    ).length;
  const hasTodaySessions = incompleteTodayCount > 0;

  return (
    <div className="col-span-2 rounded-3xl ring-1 ring-border bg-card p-4">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              Upcoming sessions
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                hasTodaySessions
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {incompleteTodayCount}
              {hasTodaySessions ? (
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute h-full w-full rounded-full bg-amber-400/70 motion-safe:animate-ping" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-amber-400" />
                </span>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              )}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            All scheduled plans
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-4">
            <CalendarGrid
              sessions={sessions}
              activities={Array.from(activityMap.values())}
              isCompletedOnDay={(activityId, day) => {
                const matchingSession = specificPlans
                  .flatMap((plan) => plan.sessions || [])
                  .find(
                    (session) =>
                      session.activityId === activityId &&
                      isSameDay(new Date(session.date), day)
                  );
                return matchingSession
                  ? isSessionCompleted(matchingSession, specificPlans, day)
                  : false;
              }}
              showLegend={false}
              weekLabels={{ week1: "Next 7 days", week2: "Following 7 days" }}
              weekCount={1}
              rangeMode="rolling-days"
              selectedSessionDisplay="card"
              allDaysSelectable
            />
          </div>
        </div>
      </div>
    </div>
  );
};
