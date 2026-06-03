import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { format, startOfWeek, addDays, isSameDay, isBefore, startOfDay } from "date-fns";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Pencil } from "lucide-react";
import type { GhostCell } from "@/utils/ghostGrid";

export interface CalendarSession {
  id?: string;
  date: Date | string;
  activityId: string;
  quantity?: number;
  descriptiveGuide?: string;
  imageUrls?: string[];
  imagesLoading?: boolean;
}

export interface CalendarActivity {
  id: string;
  title: string;
  emoji?: string;
  measure?: string;
}

interface CalendarGridProps {
  sessions: CalendarSession[];
  activities: CalendarActivity[];
  /** Non-committed cells (frequency-plan suggestions + overflow) rendered muted, by day. */
  ghostCells?: GhostCell[];
  className?: string;
  /** Function to check if an activity is completed on a day. If not provided, completion indicators won't show */
  isCompletedOnDay?: (activityId: string, day: Date) => boolean;
  /** Callback when a session is selected */
  onSessionSelect?: (session: CalendarSession, activity: CalendarActivity) => void;
  /** Callback when edit button is clicked on a session */
  onSessionEdit?: (session: CalendarSession, activity: CalendarActivity) => void;
  /** Whether to show the legend at the bottom */
  showLegend?: boolean;
  /** Custom week labels */
  weekLabels?: { week1: string; week2: string };
  /** How selected scheduled sessions are shown below the grid */
  selectedSessionDisplay?: "detail" | "card";
  /** Allows days without sessions or suggestions to be selected visually */
  allDaysSelectable?: boolean;
  /** Optional date used to choose the two visible weeks. Defaults to today. */
  visibleStartDate?: Date | string;
}

export const CalendarGrid = ({
  sessions,
  activities,
  ghostCells = [],
  className,
  isCompletedOnDay,
  onSessionSelect,
  onSessionEdit,
  showLegend = true,
  weekLabels = { week1: "This week", week2: "Next week" },
  selectedSessionDisplay = "detail",
  allDaysSelectable = false,
  visibleStartDate,
}: CalendarGridProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedGhostDay, setSelectedGhostDay] = useState<Date | null>(null);
  const [selectedEmptyDay, setSelectedEmptyDay] = useState<Date | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Derive selectedSession from props to always have fresh data
  const selectedSession = selectedSessionId
    ? (() => {
        const session = sessions.find((s) => s.id === selectedSessionId);
        if (!session) return null;
        const activity = activities.find((a) => a.id === session.activityId);
        if (!activity) return null;
        return { session, activity };
      })()
    : null;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const today = new Date();
  const calendarStartDate = visibleStartDate ? new Date(visibleStartDate) : today;
  const weekStart = startOfWeek(calendarStartDate, { weekStartsOn: 0 });

  const formatSessionCardDate = (date: Date) => {
    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, addDays(today, 1))) return "Tomorrow";
    return format(date, "EEEE, MMM d");
  };

  // Generate 2 weeks of days
  const days = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));
  const week1 = days.slice(0, 7);
  const week2 = days.slice(7, 14);

  const getSessionsForDay = (day: Date) => {
    return sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return isSameDay(sessionDate, day);
    });
  };

  const getGhostsForDay = (day: Date) => {
    return ghostCells.filter((cell) => isSameDay(cell.date, day));
  };

  const getActivity = (activityId: string) => {
    return activities.find((a) => a.id === activityId);
  };

  const getGhostDisplay = (cell: GhostCell) => {
    const activity = getActivity(cell.activityId);
    return {
      title: cell.title || activity?.title || "This plan",
      emoji: cell.emoji || activity?.emoji || "📋",
    };
  };

  const getCompletedItemsForDay = (day: Date) => {
    const scheduledCompleted = getSessionsForDay(day)
      .filter((session) => isCompletedOnDay?.(session.activityId, day) ?? false)
      .map((session) => {
        const activity = getActivity(session.activityId);
        return activity
          ? {
              key: `scheduled-${session.id || session.activityId}`,
              title: activity.title,
              emoji: activity.emoji || "📋",
            }
          : null;
      })
      .filter(Boolean) as Array<{ key: string; title: string; emoji: string }>;

    const flexibleCompleted = getGhostsForDay(day)
      .filter((cell) => cell.kind === "completed")
      .map((cell, index) => {
        const display = getGhostDisplay(cell);
        return {
          key: `completed-${cell.activityId}-${index}`,
          title: display.title,
          emoji: display.emoji,
        };
      });

    const seen = new Set<string>();
    return [...scheduledCompleted, ...flexibleCompleted].filter((item) => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    });
  };

  const getSelectedEmptyDayMessage = (
    day: Date,
    completedItems: Array<{ key: string; title: string; emoji: string }>
  ) => {
    if (completedItems.length > 0) return null;
    if (isBefore(startOfDay(day), startOfDay(today))) {
      return "Nothing done.";
    }
    if (isSameDay(day, today)) {
      return "Nothing planned today.";
    }
    return "Nothing planned.";
  };

  const handleSessionClick = (session: CalendarSession, activity: CalendarActivity) => {
    setSelectedGhostDay(null);
    setSelectedEmptyDay(null);
    const isCurrentlySelected = selectedSessionId === session.id;

    if (isCurrentlySelected) {
      setSelectedSessionId(null);
    } else {
      setSelectedSessionId(session.id || null);
      onSessionSelect?.(session, activity);
    }
  };

  const handleGhostDayClick = (day: Date) => {
    setSelectedSessionId(null);
    setSelectedEmptyDay(null);
    setSelectedGhostDay((prev) => (prev && isSameDay(prev, day) ? null : day));
  };

  const handleDayClick = (day: Date) => {
    const daySessions = getSessionsForDay(day);
    if (daySessions.length > 0) {
      const firstSession = daySessions[0];
      const activity = getActivity(firstSession.activityId);
      if (activity) {
        const isCurrentlySelected = selectedSessionId === firstSession.id;

        if (isCurrentlySelected) {
          setSelectedSessionId(null);
        } else {
          setSelectedGhostDay(null);
          setSelectedEmptyDay(null);
          setSelectedSessionId(firstSession.id || null);
          onSessionSelect?.(firstSession, activity);
        }
      }
    } else if (getGhostsForDay(day).some((c) => c.kind === "ghost" || c.kind === "overflow")) {
      handleGhostDayClick(day);
    } else if (allDaysSelectable) {
      setSelectedSessionId(null);
      setSelectedGhostDay(null);
      setSelectedEmptyDay((prev) => (prev && isSameDay(prev, day) ? null : day));
    }
  };

  const DayCell = ({ day }: { day: Date }) => {
    const daySessions = getSessionsForDay(day);
    const dayGhosts = getGhostsForDay(day);
    const isToday = isSameDay(day, today);
    const isPast = isBefore(startOfDay(day), startOfDay(today));
    const hasSession = daySessions.length > 0;
    const hasSuggestion = dayGhosts.some(
      (c) => c.kind === "ghost" || c.kind === "overflow"
    );
    const isGhostSelected = !!selectedGhostDay && isSameDay(selectedGhostDay, day);
    const isSessionSelected =
      !!selectedSession &&
      isSameDay(new Date(selectedSession.session.date), day);
    const isEmptySelected = !!selectedEmptyDay && isSameDay(selectedEmptyDay, day);
    const isSelectedDay = isSessionSelected || isGhostSelected || isEmptySelected;

    return (
      <div
        onClick={() => handleDayClick(day)}
        className={cn(
          "flex flex-col items-center p-1 min-h-[72px] rounded-lg border transition-all",
          // Today: outline only (no fill) so it stays distinct from the selected day.
          isToday || isSelectedDay ? variants.brightBorder : "border-border",
          // Selected day: filled + ring.
          isSelectedDay
            ? cn(variants.veryFadedBg, "ring-2", variants.ring)
            : !isToday && "bg-card",
          isPast && !isToday && !isSelectedDay && "opacity-50",
          (hasSession || hasSuggestion || allDaysSelectable) &&
            "cursor-pointer hover:border-muted-foreground/50"
        )}
      >
        <span
          className={cn(
            "text-[10px] font-medium uppercase",
            isToday ? variants.text : "text-muted-foreground"
          )}
        >
          {format(day, "EEE")}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            isToday ? variants.text : "text-foreground"
          )}
        >
          {format(day, "d")}
        </span>
        <div className="flex flex-col gap-0.5 mt-1">
          {daySessions.map((session, idx) => {
            const activity = getActivity(session.activityId);
            if (!activity) return null;

            const isCompleted = isCompletedOnDay?.(session.activityId, day) ?? false;
            const isSelected = selectedSessionId === session.id;

            return (
              <button
                key={`${session.activityId}-${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSessionClick(session, activity);
                }}
                className={cn(
                  "relative text-lg leading-none rounded-md p-0.5 transition-all",
                  isSelected && cn(variants.fadedBg, "ring-2", variants.ring),
                  !isSelected && !isCompleted && "hover:bg-muted",
                  isCompleted && "bg-green-100 dark:bg-green-900/30"
                )}
              >
                {activity.emoji || "📋"}
                {isCompleted && (
                  <span className="absolute -top-1.5 -right-1.5">
                    <Check className="w-3.5 h-3.5 text-green-500 drop-shadow-sm" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
          {dayGhosts.map((cell, idx) => {
            const activity = getActivity(cell.activityId);
            const display = getGhostDisplay(cell);

            if (cell.kind === "completed") {
              return (
                <span
                  key={`done-${cell.activityId}-${idx}`}
                  title={`${activity?.title || "Activity"} — done`}
                  className="relative text-lg leading-none rounded-md p-0.5 bg-green-100 dark:bg-green-900/30"
                >
                  {display.emoji}
                  <span className="absolute -top-1.5 -right-1.5">
                    <Check className="w-3.5 h-3.5 text-green-500 drop-shadow-sm" strokeWidth={3} />
                  </span>
                </span>
              );
            }

            const isOverflow = cell.kind === "overflow";
            return (
              <span
                key={`ghost-${cell.planId}-${idx}`}
                title={
                  isOverflow
                    ? `${display.title} won't fit in the days left this week`
                    : `${display.title} — flexible weekly slot`
                }
                className={cn(
                  "text-lg leading-none rounded-md p-0.5 border border-dashed",
                  isOverflow
                    ? "border-red-400/70 bg-red-100 dark:bg-red-900/30"
                    : variants.brightBorder
                )}
              >
                <span className="opacity-40">{display.emoji}</span>
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const WeekRow = ({ days, label }: { days: Date[]; label: string }) => (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <DayCell key={day.toISOString()} day={day} />
        ))}
      </div>
    </div>
  );

  // Get unique activities that have sessions
  const activeActivities = Array.from(
    new Set(sessions.map((s) => s.activityId))
  )
    .map((id) => getActivity(id))
    .filter(Boolean) as CalendarActivity[];

  return (
    <div className={cn("w-full space-y-4", className)}>
      <WeekRow days={week1} label={weekLabels.week1} />
      <WeekRow days={week2} label={weekLabels.week2} />

      {/* Ghost (suggested session) explanation */}
      <AnimatePresence mode="wait">
        {selectedGhostDay &&
          (() => {
            const ghosts = getGhostsForDay(selectedGhostDay).filter(
              (g) => g.kind === "ghost" || g.kind === "overflow"
            );
            if (ghosts.length === 0) return null;
            const hasOverflow = ghosts.some((g) => g.kind === "overflow");
            const displays = Array.from(
              new Map(
                ghosts.map((ghost) => [
                  ghost.planId,
                  getGhostDisplay(ghost),
                ])
              ).values()
            );
            const label = displays.map((display) => display.title).join(" & ");
            const singular = displays.length === 1;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "p-4 rounded-xl border",
                  variants.brightBorder,
                  variants.veryFadedBg
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {displays.map((display) => display.emoji).join(" ") || "📋"}
                    </span>
                    <div>
                      <h4 className="text-left font-semibold text-foreground">
                        Flexible weekly slot
                      </h4>
                      <p className="text-left text-sm text-muted-foreground">
                        {format(selectedGhostDay, "EEEE, MMM d")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedGhostDay(null)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <p className="mt-3 text-sm text-foreground text-left">
                  {label || "This plan"} {singular ? "has" : "have"} a weekly
                  target rather than fixed days.{" "}
                  {singular ? "This marker is" : "These markers are"} a suggested
                  open day for{" "}
                  {singular
                    ? "one of your remaining weekly sessions."
                    : "remaining weekly sessions."}{" "}
                  Log any activity from {singular ? "this plan" : "these plans"} whenever it works.
                </p>
                {hasOverflow && (
                  <p className="mt-2 text-sm text-left text-red-500">
                    ⚠️ More sessions remain than days left this week — some won't fit
                    unless you double up.
                  </p>
                )}
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {/* Selected session detail */}
      <AnimatePresence mode="wait">
        {selectedEmptyDay &&
          (() => {
            const completedItems = getCompletedItemsForDay(selectedEmptyDay);
            const selectedEmptyDayMessage = getSelectedEmptyDayMessage(
              selectedEmptyDay,
              completedItems
            );

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {selectedEmptyDayMessage && (
                  <div className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                    {selectedEmptyDayMessage}
                  </div>
                )}
                {completedItems.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {completedItems.map((item) => (
                      <div
                        key={item.key}
                        className="relative min-w-[116px] rounded-xl bg-muted/80 p-2 text-center"
                      >
                        <Check
                          className="absolute right-2 top-2 h-5 w-5 -translate-y-1/2 text-green-500"
                          strokeWidth={3}
                        />
                        <div className="text-xl leading-none">{item.emoji}</div>
                        <div className="mt-1 truncate text-sm font-medium text-foreground">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          Done
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })()}

        {selectedSession && selectedSessionDisplay === "card" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-2 overflow-x-auto pb-1"
          >
            <div className="relative min-w-[116px] rounded-xl bg-muted/80 p-2 text-center">
              <Check
                className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 text-green-500"
                strokeWidth={3}
              />
              <div className="text-xl leading-none">
                {selectedSession.activity.emoji || "📋"}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {selectedSession.activity.title}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {formatSessionCardDate(new Date(selectedSession.session.date))}
              </div>
            </div>
          </motion.div>
        )}

        {selectedSession && selectedSessionDisplay === "detail" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-xl border",
              variants.brightBorder,
              variants.veryFadedBg
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {selectedSession.activity.emoji || "📋"}
                </span>
                <div>
                  <h4 className="text-left font-semibold text-foreground">
                    {selectedSession.activity.title}
                  </h4>
                  <p className="text-left text-sm text-muted-foreground">
                    {format(new Date(selectedSession.session.date), "EEEE, MMM d")}
                    {selectedSession.session.quantity && (
                      <>
                        {" "}
                        • {selectedSession.session.quantity}{" "}
                        {selectedSession.activity.measure}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onSessionEdit && (
                  <button
                    onClick={() => onSessionEdit(selectedSession.session, selectedSession.activity)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {selectedSession.session.descriptiveGuide && (
              <p className="mt-3 text-sm text-foreground text-left">
                {selectedSession.session.descriptiveGuide}
              </p>
            )}

            {selectedSession.session.imagesLoading &&
              (!selectedSession.session.imageUrls || selectedSession.session.imageUrls.length === 0) && (
                <div className="mt-3 flex gap-2">
                  <div className="h-24 w-32 rounded-lg bg-muted animate-pulse flex-shrink-0" />
                  <div className="h-24 w-32 rounded-lg bg-muted animate-pulse flex-shrink-0" />
                </div>
              )}

            {selectedSession.session.imageUrls &&
              selectedSession.session.imageUrls.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {selectedSession.session.imageUrls.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setExpandedImage(url)}
                      className={cn(
                        "flex-shrink-0 rounded-lg overflow-hidden hover:ring-2 transition-all",
                        variants.ring
                      )}
                    >
                      <img
                        src={url}
                        alt={`Session reference ${idx + 1}`}
                        className="h-24 w-auto object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

            {isCompletedOnDay &&
              isCompletedOnDay(
                selectedSession.session.activityId,
                new Date(selectedSession.session.date)
              ) && (
                <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Completed</span>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen image dialog */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setExpandedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <img
                src={expandedImage}
                alt="Session reference expanded"
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {showLegend && activeActivities.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
          {activeActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className="text-base">{activity.emoji || "📋"}</span>
              <span>{activity.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
