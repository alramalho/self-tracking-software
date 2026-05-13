import { useThemeColors } from "@/hooks/useThemeColors";
import { usePlans } from "@/contexts/plans";
import { useTheme } from "@/contexts/theme/useTheme";
import { useDataNotifications } from "@/contexts/notifications";
import { useNavigate } from "@tanstack/react-router";
import { getThemeVariants } from "@/utils/theme";
import { ChevronRight, MessageCircle } from "lucide-react";
import { isAfter } from "date-fns";
import { cn } from "@/lib/utils";

function getCoachInsightText(notification?: {
  title: string | null;
  message: string;
}) {
  if (!notification) return null;

  if (notification.title === "Weekly Recap") {
    return "Weekly review is ready. Review Coach Oli's notes for this week.";
  }

  return notification.message
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const CoachHomeSection = () => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { plans } = usePlans();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { notifications } = useDataNotifications();

  const latestCoachNotification = notifications
    ?.filter((n) => n.type === "COACH" && n.status !== "CONCLUDED")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );
  const coachedPlans = activePlans?.filter((plan) => plan.isCoached) ?? [];
  const plansNeedingAttention = coachedPlans.filter((plan) =>
    ["AT_RISK", "FAILED"].includes(plan.currentWeekState || "")
  );

  if (coachedPlans.length === 0) {
    return null;
  }

  const latestInsight =
    getCoachInsightText(latestCoachNotification) ||
    (plansNeedingAttention.length > 0
      ? `${plansNeedingAttention[0].goal} needs attention this week.`
      : "Your coached plans are ready. Check the plan cards below for today's next step.");

  const coachSummary =
    plansNeedingAttention.length > 0
      ? `${coachedPlans.length} coached plans · ${plansNeedingAttention.length} needs attention`
      : `${coachedPlans.length} coached plan${coachedPlans.length === 1 ? "" : "s"} · on track`;

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  return (
    <div
      className={cn(
        "rounded-3xl ring-1 flex flex-col gap-3 p-4 transition-all duration-300 backdrop-blur-sm",
        variants.veryFadedBg,
        variants.ringBright
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <img src={coachIcon} alt="Coach Oli" className="w-6 h-6 rounded-full" />
          <span className="text-md font-semibold text-foreground">
            Coach Oli
          </span>
        </div>
        <button
          onClick={() => navigate({ to: "/message-ai" })}
          className="text-sm font-medium flex items-center gap-0.5 text-foreground/50 hover:text-foreground transition-colors"
        >
          Message Coach
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="rounded-2xl bg-background/55 backdrop-blur-sm px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {coachSummary}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground line-clamp-2">
              {latestInsight}
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/message-ai" })}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70 text-foreground/70 hover:text-foreground transition-colors"
            aria-label="Open coach analysis"
          >
            <MessageCircle size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
