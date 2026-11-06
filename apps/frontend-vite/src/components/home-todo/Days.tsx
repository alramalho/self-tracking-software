import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight } from "lucide-react";
import { dayNumber, longDate, unitLabel, weekday } from "@tsw/prisma/follow-through/session-format";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import type { HomeDayDetailProps, HomeDayTileProps, HomeItemRowProps, HomeTileItemProps, TwoWeeksProps } from "./types";

// Day tiles and a day's rows, shared by the homepage and each plan's page. Same as the iPhone app.
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

function DayTile({ day, selected, onClick, testPrefix }: HomeDayTileProps) {
  const theme = useThemeColors();
  const shown = day.items.slice(0, TILE_EMOJIS);
  const more = day.items.length - shown.length;
  return (
    <button
      type="button"
      data-testid={`${testPrefix}-${day.key}`}
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
  const amount = item.quantity ? ` · ${item.quantity} ${unitLabel(item.measure ?? "", item.quantity)}` : "";
  const fact =
    item.kind === "done"
      ? "Done"
      : item.kind === "flexible"
        ? `Any day works${item.remaining ? ` · ${item.remaining} left ${item.week ? "next week" : "this week"}` : ""}`
        : item.planGoal;
  const loggable = canLog && item.kind !== "done";
  return (
    <button
      type="button"
      data-testid={`home-item-${item.id}`}
      aria-label={`${item.title}${amount}. ${fact}`}
      onClick={() =>
        loggable
          ? navigate({ to: "/add", search: item.anyActivity ? {} : { activityId: item.activityId } })
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
      ) : (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

export function DayDetail({ day, todayKey, testId = "home-day-detail", children }: HomeDayDetailProps) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1 rounded-[18px] bg-muted/60 px-4 py-3">
      <p className="py-1 text-base font-bold">{day.isToday ? "Today" : longDate(day.key)}</p>
      {day.items.length ? (
        day.items.map((item) => <ItemRow key={item.id} item={item} canLog={day.key <= todayKey} />)
      ) : (
        <p className="pb-1 text-sm text-muted-foreground">Nothing planned. A free day.</p>
      )}
      {children}
    </div>
  );
}

/** This week over next, Sunday first, no titles: the same tiles on the homepage and a plan's page. */
export function TwoWeeks({ weeks, selectedKey, onSelect, testPrefix = "home-day" }: TwoWeeksProps) {
  return (
    <div className="flex flex-col gap-[5px]">
      {weeks.map((days, index) => (
        <div key={index} className="flex gap-[5px]">
          {days.map((d) => (
            <DayTile key={d.key} day={d} selected={d.key === selectedKey} onClick={() => onSelect(d.key)} testPrefix={testPrefix} />
          ))}
        </div>
      ))}
    </div>
  );
}
