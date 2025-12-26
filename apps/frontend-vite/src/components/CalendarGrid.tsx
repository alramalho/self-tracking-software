import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { format, startOfWeek, addDays, isSameDay, isBefore, startOfDay } from "date-fns";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Pencil } from "lucide-react";

export interface CalendarSession {
  id?: string;
  date: Date | string;
  activityId: string;
  quantity?: number;
  descriptiveGuide?: string;
  imageUrls?: string[];
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
}

export const CalendarGrid = ({
  sessions,
  activities,
  className,
  isCompletedOnDay,
  onSessionSelect,
  onSessionEdit,
  showLegend = true,
  weekLabels = { week1: "This week", week2: "Next week" },
}: CalendarGridProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });

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

  const getActivity = (activityId: string) => {
    return activities.find((a) => a.id === activityId);
  };

  const handleSessionClick = (session: CalendarSession, activity: CalendarActivity) => {
    const isCurrentlySelected = selectedSessionId === session.id;

    if (isCurrentlySelected) {
      setSelectedSessionId(null);
    } else {
      setSelectedSessionId(session.id || null);
      onSessionSelect?.(session, activity);
    }
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
          setSelectedSessionId(firstSession.id || null);
          onSessionSelect?.(firstSession, activity);
        }
      }
    }
  };

  const DayCell = ({ day }: { day: Date }) => {
    const daySessions = getSessionsForDay(day);
    const isToday = isSameDay(day, today);
    const isPast = isBefore(startOfDay(day), startOfDay(today));
    const hasSession = daySessions.length > 0;

    return (
      <div
        onClick={() => hasSession && handleDayClick(day)}
        className={cn(
          "flex flex-col items-center p-1 min-h-[72px] rounded-lg border transition-all",
          isToday && cn(variants.brightBorder, variants.veryFadedBg),
          !isToday && "border-border bg-card",
          isPast && !isToday && "opacity-50",
          hasSession && !isPast && "cursor-pointer hover:border-muted-foreground/50"
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
                  <span className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                    <Check className="w-2 h-2 text-white" />
                  </span>
                )}
              </button>
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

      {/* Selected session detail */}
      <AnimatePresence mode="wait">
        {selectedSession && (
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
