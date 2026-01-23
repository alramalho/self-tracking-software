import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { cn } from "@/lib/utils";
import { ArrowLeft, Bell, Trash2, Loader2, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

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
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

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
                <h1 className="font-semibold text-foreground">AI Coach Settings</h1>
                <p className="text-xs text-muted-foreground">Manage reminders</p>
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
          {/* Active Reminders Section */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Bell size={14} />
              Active Reminders
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeReminders.length === 0 ? (
              <div className={cn(
                "rounded-xl p-6 text-center",
                variants.veryFadedBg,
                "border",
                variants.border
              )}>
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
                    className={cn(
                      "rounded-xl p-4",
                      variants.veryFadedBg,
                      "border",
                      variants.border
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {reminder.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar size={12} />
                          <span>
                            {format(new Date(reminder.triggerAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
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
