import type { User } from "@tsw/prisma";
import type { CalendarSession } from "@tsw/prisma/follow-through";
import { snapshot } from "./service";
import { ownedPlans } from "./store";
import { calendarDay, instant, localDate } from "./model";
export async function calendarSessions(user: User): Promise<CalendarSession[]> {
  const { state } = await snapshot(user),
    plans = await ownedPlans(user.id);
  return Object.values(state.sessions).flatMap((session) => {
    const plan = plans.find((p) => p.id === session.planId);
    if (
      !plan ||
      plan.isPaused ||
      (plan.outlineType !== "SPECIFIC" &&
        state.supports[plan.id]?.mode === "WEEKLY") ||
      session.outcome === "SKIPPED" ||
      session.date < calendarDay(localDate(new Date(), session.timezone), -7)
    )
      return [];
    const start = instant(
      session.date,
      session.time || "00:00",
      session.timezone,
    );
    const end =
      session.time && start
        ? new Date(start.getTime() + session.durationMinutes * 60000)
        : instant(calendarDay(session.date, 1), "00:00", session.timezone);
    if (!start || !end) return [];
    return [
      {
        sessionId: session.id,
        planId: plan.id,
        title: `${plan.emoji || ""} ${plan.goal}`.trim(),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        allDay: !session.time,
        timeZone: session.timezone,
        url: `trackingso://session/${encodeURIComponent(session.id)}`,
      },
    ];
  });
}
