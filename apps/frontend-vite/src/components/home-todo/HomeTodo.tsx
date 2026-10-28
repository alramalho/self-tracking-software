import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight } from "lucide-react";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { homeDays } from "@tsw/prisma/home-todo";
import { dayNumber, longDate, unitLabel, weekday } from "@tsw/prisma/follow-through/session-format";
import { useActivities } from "@/contexts/activities/useActivities";
import { usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { CoachNote } from "./CoachNote";
import type { HomeDayDetailProps, HomeDayTileProps, HomeItemRowProps, HomeTileItemProps } from "./types";

/** A day tile has room for two emojis; the rest show as "+n". */
const TILE_EMOJIS = 2;

/** One thing on a day tile: done as a green square with a tick, planned with its amount, an open slot dashed. */
function TileItem({ item }: HomeTileItemProps) {
  if (item.kind === "done")
    return (
      <span className="relative rounded-md bg-green-100 p-1 text-base leading-none dark:bg-green-900">
        {item.emoji}
        <span className="absolute -right-1 -top-1.5 text-sm font-bold text-green-500">✓</span>
      </span>
    );
  if (item.kind === "flexible")
    return (
      <span className="rounded-md border border-dashed border-muted-foreground p-[3px] text-[15px] leading-none">
        {item.emoji}
      </span>
    );
  return (
    <span className="truncate text-[13px]">
      {item.emoji}
      {item.quantity ? ` ${item.quantity}` : ""}
    </span>
  );
}

function DayTile({ day, selected, onClick }: HomeDayTileProps) {
  const theme = useThemeColors();
  const shown = day.items.slice(0, TILE_EMOJIS);
  const more = day.items.length - shown.length;
  return (
    <button
      type="button"
      data-testid={`home-day-${day.key}`}
      aria-label={`${longDate(day.key)}, ${day.items.length ? `${day.items.length} planned` : "nothing planned"}`}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-[84px] min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg border px-0.5 py-1.5",
        selected ? cn(theme.brightBorder, theme.veryFadedBg) : "border-border bg-card",
        day.isPast && "opacity-55",
      )}
    >
      <span className={cn("text-[10px]", day.isToday ? theme.text : "text-muted-foreground")}>
        {weekday(day.key).toUpperCase()}
      </span>
      <span className={cn("text-sm font-bold", day.isToday && theme.text)}>{dayNumber(day.key)}</span>
      {shown.map((item) => (
        <TileItem key={item.id} item={item} />
      ))}
      {more > 0 && <span className="text-[11px] font-semibold text-muted-foreground">+{more}</span>}
    </button>
  );
}

function ItemRow({ item, canLog }: HomeItemRowProps) {
  const navigate = useNavigate();
  const theme = useThemeColors();
  const amount = item.quantity ? ` · ${item.quantity} ${unitLabel(item.measure ?? "", item.quantity)}` : "";
  const fact =
    item.kind === "done"
      ? "Done"
      : item.kind === "flexible"
        ? `Any day works${item.remaining ? ` · ${item.remaining} left this week` : ""}`
        : item.planGoal;
  const loggable = canLog && item.kind !== "done";
  return (
    <button
      type="button"
      data-testid={`home-item-${item.id}`}
      aria-label={`${item.title}${amount}. ${fact}`}
      onClick={() =>
        loggable
          ? navigate({ to: "/add", search: { activityId: item.activityId } })
          : navigate({ to: "/plans", search: { selectedPlan: item.planId } })
      }
      className="flex min-h-14 w-full items-center gap-3 py-2 text-left transition-opacity active:opacity-60"
    >
      <span className="w-8 shrink-0 text-center text-[22px]">{item.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {item.title}
          {amount}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">{fact}</span>
      </span>
      {item.kind === "done" ? (
        <Check className="h-5 w-5 shrink-0 text-green-500" strokeWidth={3} />
      ) : loggable ? (
        <span className={cn("shrink-0 rounded-full px-3.5 py-[7px] text-sm font-bold text-white", theme.bg)}>
          Log
        </span>
      ) : (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function DayDetail({ day, todayKey }: HomeDayDetailProps) {
  return (
    <div data-testid="home-day-detail" className="flex flex-col gap-1 rounded-[18px] bg-muted/60 px-4 py-3">
      <p className="py-1 text-base font-bold">{day.isToday ? "Today" : longDate(day.key)}</p>
      {day.items.length ? (
        day.items.map((item) => <ItemRow key={item.id} item={item} canLog={day.key <= todayKey} />)
      ) : (
        <p className="pb-1 text-sm text-muted-foreground">Nothing planned. A free day.</p>
      )}
    </div>
  );
}

/** Top of the homepage: the coach's note when it matters, then what's on this week and next. Same as the iPhone app. */
export const HomeTodo = () => {
  const { plans } = usePlans();
  const { activityEntries } = useActivities();
  const visible = useMemo(() => {
    const now = new Date();
    return (plans ?? []).filter(
      (plan) =>
        !plan.deletedAt &&
        !plan.archivedAt &&
        !plan.isPaused &&
        (!plan.finishingDate || new Date(plan.finishingDate) >= now),
    );
  }, [plans]);
  const logs = useMemo(() => (activityEntries ?? []).filter((entry) => !entry.deletedAt), [activityEntries]);
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: visible, entries: logs, now: new Date(), weekCount: 2 }),
    [visible, logs],
  );
  const weeks = useMemo(() => homeDays({ projection, plans: visible, entries: logs }), [projection, visible, logs]);
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  return (
    <div data-testid="home-todo" className="flex flex-col gap-3">
      <CoachNote />
      {visible.length > 0 && (
        <section className="flex flex-col gap-3.5 rounded-3xl bg-card p-4">
          <h2 className="text-[19px] font-bold">Next two weeks</h2>
          {weeks.map((days, index) => (
            <div key={index} className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{index ? "Next week" : "This week"}</p>
              <div className="flex gap-[5px]">
                {days.map((d) => (
                  <DayTile key={d.key} day={d} selected={d.key === day.key} onClick={() => setSelectedKey(d.key)} />
                ))}
              </div>
            </div>
          ))}
          <DayDetail day={day} todayKey={projection.todayKey} />
        </section>
      )}
    </div>
  );
};
