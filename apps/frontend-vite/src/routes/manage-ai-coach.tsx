import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/contexts/users";
import { usePlans } from "@/contexts/plans";
import { ArrowLeft, Bell, Trash2, Loader2, RefreshCw, Calendar, CalendarCheck } from "lucide-react";
import { format, isToday, isTomorrow, differenceInCalendarDays, isSameWeek, isThisYear, addDays, startOfDay } from "date-fns";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Reminder {
  id: string;
  message: string;
  triggerAt: string;
  isRecurring: boolean;
  recurringType: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  recurringDays: string[];
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

export const Route = createFileRoute("/manage-ai-coach")({
  component: ManageAICoachPage,
});

function ManageAICoachPage() {
  const navigate = useNavigate();
  const api = useApiWithAuth();
  const { currentUser, updateUser, isUpdatingUser } = useCurrentUser();
  const { plans } = usePlans();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/reminders");
      setReminders(response.data.reminders || []);
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
      toast.error("Failed to load reminders");
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleDelete = async (reminderId: string) => {
    try {
      setDeletingId(reminderId);
      await api.delete(`/reminders/${reminderId}`);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      toast.success("Reminder deleted");
    } catch (error) {
      console.error("Failed to delete reminder:", error);
      toast.error("Failed to delete reminder");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleReminders = async (enabled: boolean) => {
    try {
      await updateUser({ updates: { activityRemindersEnabled: enabled }, muteNotifications: true });
      toast.success(
        enabled ? "Activity reminders enabled" : "Activity reminders disabled"
      );
    } catch {
      toast.error("Failed to update preference");
    }
  };

  const formatTriggerDate = (triggerAt: string) => {
    const date = new Date(triggerAt);
    const time = format(date, "h:mm a");

    if (isToday(date)) return `Today, ${time}`;
    if (isTomorrow(date)) return `Tomorrow, ${time}`;

    const daysAway = differenceInCalendarDays(date, new Date());
    if (daysAway > 1 && daysAway <= 7) {
      return `${format(date, "EEEE")}, ${time}`;
    }
    if (daysAway > 7 && daysAway <= 14) {
      return `Next ${format(date, "EEEE")}, ${time}`;
    }

    if (isThisYear(date)) {
      return format(date, "d MMMM, EEEE");
    }
    return format(date, "d MMMM yyyy, EEEE");
  };

  const formatRecurring = (reminder: Reminder) => {
    if (!reminder.isRecurring) return "One-time";

    switch (reminder.recurringType) {
      case "DAILY":
        return "Daily";
      case "WEEKLY":
        if (reminder.recurringDays.length > 0) {
          const days = reminder.recurringDays.map(d => d.slice(0, 3)).join(", ");
          return `Weekly (${days})`;
        }
        return "Weekly";
      case "MONTHLY":
        return "Monthly";
      default:
        return "Recurring";
    }
  };

  const upcomingReminderGroups = useMemo(() => {
    if (!plans) return [];

    const tomorrow = startOfDay(addDays(new Date(), 1));
    const activePlans = plans.filter(
      (p) => !p.deletedAt && !p.archivedAt && !p.isPaused
    );

    const activityMap = new Map<string, { emoji: string; title: string }>();
    for (const plan of activePlans) {
      for (const activity of plan.activities) {
        if (!activityMap.has(activity.id)) {
          activityMap.set(activity.id, {
            emoji: activity.emoji,
            title: activity.title,
          });
        }
      }
    }

    const grouped = new Map<
      string,
      { date: Date; activities: Map<string, { emoji: string; title: string }> }
    >();

    for (const plan of activePlans) {
      for (const session of plan.sessions) {
        const sessionDate = startOfDay(new Date(session.date));
        if (sessionDate < tomorrow) continue;

        const key = sessionDate.toISOString();
        if (!grouped.has(key)) {
          grouped.set(key, { date: sessionDate, activities: new Map() });
        }

        const activity = activityMap.get(session.activityId);
        if (activity && !grouped.get(key)!.activities.has(session.activityId)) {
          grouped.get(key)!.activities.set(session.activityId, activity);
        }
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 3)
      .map((group) => ({
        sessionDate: group.date,
        reminderDate: addDays(group.date, -1),
        activities: Array.from(group.activities.values()),
      }));
  }, [plans]);

  const formatReminderDate = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";

    const daysAway = differenceInCalendarDays(date, new Date());
    if (daysAway > 1 && daysAway <= 7) return format(date, "EEEE");
    if (daysAway > 7 && daysAway <= 14) return `Next ${format(date, "EEEE")}`;
    if (isThisYear(date)) return format(date, "d MMMM");
    return format(date, "d MMMM yyyy");
  };

  const activeReminders = reminders.filter((r) => r.status === "PENDING");
  const pastReminders = reminders.filter((r) => r.status === "COMPLETED");

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="w-full max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: "/message-ai" })}
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground">Coach Oli</h1>
                <p className="text-xs text-muted-foreground">Settings</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchReminders}
              disabled={isLoading}
            >
              <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* How coaching works */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              How coaching works
            </h2>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CalendarCheck size={20} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Every Saturday afternoon, your coach analyzes your week and
                suggests plan adjustments.
              </p>
            </div>
          </div>

          {/* Activity Reminders toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Activity Reminders
              </p>
              <p className="text-xs text-muted-foreground">
                Get reminded the day before a planned session
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Bell size={20} className="text-muted-foreground" />
              <Switch
                checked={currentUser?.activityRemindersEnabled ?? false}
                onCheckedChange={handleToggleReminders}
                disabled={isUpdatingUser}
              />
            </div>
          </div>

          {/* Upcoming Activity Reminders */}
          <AnimatePresence>
            {currentUser?.activityRemindersEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2"
                >
                  <Calendar size={14} />
                  Upcoming Reminders
                </motion.h2>
                {upcomingReminderGroups.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingReminderGroups.map((group, index) => (
                      <motion.div
                        key={group.sessionDate.toISOString()}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                        className="rounded-xl p-4 bg-muted/50 border border-border"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Bell size={14} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Reminder {formatReminderDate(group.reminderDate)} at
                            8pm
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {format(group.sessionDate, "EEEE, d MMMM")}:{" "}
                          {group.activities
                            .map((a) => `${a.emoji} ${a.title}`)
                            .join(", ")}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-xl p-6 text-center bg-muted/50 border border-border"
                  >
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No upcoming sessions planned
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Reminders will appear here when you have sessions scheduled
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Custom Reminders Section */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Bell size={14} />
              Custom Reminders
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeReminders.length === 0 ? (
              <div className="rounded-xl p-6 text-center bg-muted/50 border border-border">
                <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No active reminders
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Ask Coach Oli to create a reminder for you
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="rounded-xl p-4 bg-muted/50 border border-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {reminder.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar size={12} />
                          <span>Next in {formatTriggerDate(reminder.triggerAt)}</span>
                          <span className="text-muted-foreground/50">•</span>
                          <span>{formatRecurring(reminder)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(reminder.id)}
                        disabled={deletingId === reminder.id}
                      >
                        {deletingId === reminder.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Reminders Section */}
          {pastReminders.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Past Reminders
              </h2>
              <div className="space-y-2">
                {pastReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={cn(
                      "rounded-xl p-3 opacity-60",
                      "bg-muted/30",
                      "border border-border/50"
                    )}
                  >
                    <p className="text-sm text-foreground/70">
                      {reminder.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Triggered {format(new Date(reminder.triggerAt), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManageAICoachPage;
