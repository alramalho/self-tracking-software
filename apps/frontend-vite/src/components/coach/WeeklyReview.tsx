import { reviewWeekLine, type CoachPlan, type ReviewWeek } from "@tsw/prisma/follow-through/coach-inbox";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** "8–14 Nov", the week a review looks back on. */
export function reviewRange(week: Pick<ReviewWeek, "days">) {
  const from = new Date(`${week.days[0].key}T12:00:00`);
  const to = new Date(`${week.days[6].key}T12:00:00`);
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
  return month(from) === month(to)
    ? `${from.getDate()}–${to.getDate()} ${month(to)}`
    : `${from.getDate()} ${month(from)} – ${to.getDate()} ${month(to)}`;
}

/** One plan's reviewed week: the plan, the count, and the seven days with the logged ones filled. */
export function ReviewWeekCard({ week }: { week: ReviewWeek<CoachPlan & { activities: { id: string; emoji?: string | null }[] }> }) {
  const met = week.target > 0 && week.done >= week.target;
  return (
    <div data-testid="review-week" aria-label={`${week.plan.goal}: ${reviewWeekLine(week)}`} className="flex flex-col gap-3.5 rounded-2xl bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-[22px] leading-7">{week.plan.emoji || week.plan.activities[0]?.emoji || "🎯"}</span>
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{week.plan.goal}</span>
        <span className={`text-[15px] font-bold ${met ? "text-primary" : "text-muted-foreground"}`}>
          {week.target ? `${week.done} of ${week.target}` : week.done}
        </span>
      </div>
      <div className="flex justify-between">
        {week.days.map((day, i) => (
          <div key={day.key} className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{DAY_LETTERS[i]}</span>
            <span
              data-testid={day.logged ? "review-day-logged" : "review-day"}
              className={`h-7 w-7 rounded-full ${day.logged ? "bg-primary" : "border-[1.5px] border-border"}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** What the coach said, as a quiet bubble next to its face. */
export function CoachLine({ text, face }: { text: string; face: string }) {
  return (
    <div data-testid="review-coach-line" className="flex items-end gap-2.5">
      <img src={face} alt="" className="h-9 w-9" />
      <p className="flex-1 rounded-[18px] rounded-bl-md bg-muted px-3.5 py-3 text-base leading-snug">{text}</p>
    </div>
  );
}
