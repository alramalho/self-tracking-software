import { useThemeColors } from "@/hooks/useThemeColors";
import { usePlans } from "@/contexts/plans";
import { useDataNotifications } from "@/contexts/notifications";
import { useCurrentUser } from "@/contexts/users";
import { useNavigate } from "@tanstack/react-router";
import { getThemeVariants } from "@/utils/theme";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";

function getCoachInsightText(notification?: {
  title: string | null;
  message: string;
}, coachName = "Helly") {
  if (!notification) return null;

  if (notification.title === "Weekly Recap") {
    return `Weekly review is ready. Review ${coachName}'s notes for this week.`;
  }

  return notification.message
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getRelatedPlanId(notification?: { relatedData: unknown }) {
  const relatedData = notification?.relatedData;
  if (
    relatedData &&
    typeof relatedData === "object" &&
    "planId" in relatedData &&
    typeof relatedData.planId === "string"
  ) {
    return relatedData.planId;
  }

  return null;
}

export const CoachHomeSection = () => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { plans } = usePlans();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const { notifications } = useDataNotifications();
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);

  const latestCoachNotification = notifications
    ?.filter((n) => n.type === "COACH" && n.status !== "CONCLUDED")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

  const activePlans =
    plans?.filter(
      (plan) =>
        plan.deletedAt === null &&
        (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
    ) ?? [];
  const plansNeedingAttention = activePlans.filter((plan) =>
    ["AT_RISK", "FAILED"].includes(plan.currentWeekState || "")
  );
  const notificationPlanId = getRelatedPlanId(latestCoachNotification);
  const reviewPlan =
    activePlans.find((plan) => plan.id === notificationPlanId) ||
    plansNeedingAttention[0] ||
    activePlans[0];
  const hasReviewAction =
    !!latestCoachNotification || plansNeedingAttention.length > 0;

  if (activePlans.length === 0) {
    return null;
  }

  const openCoachReview = () => {
    navigate({ to: `/plans?selectedPlan=${reviewPlan.id}` });
  };

  const latestInsight =
    getCoachInsightText(latestCoachNotification, aiCoach.name) ||
    (plansNeedingAttention.length > 0
      ? `${plansNeedingAttention[0].goal} needs attention this week.`
      : "Your active plans are ready. Check the plan cards below for today's next step.");

  const coachSummary =
    plansNeedingAttention.length > 0
      ? `${activePlans.length} plans · ${plansNeedingAttention.length} needs attention`
      : `${activePlans.length} plan${activePlans.length === 1 ? "" : "s"} · on track`;

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
          <img src={aiCoach.avatar} alt={aiCoach.label} className="w-6 h-6 rounded-full object-contain" />
          <span className="text-md font-semibold text-foreground">
            {aiCoach.name}
          </span>
        </div>
        <button
          onClick={openCoachReview}
          className="text-sm font-medium flex items-center gap-0.5 text-foreground/50 hover:text-foreground transition-colors"
        >
          {hasReviewAction ? "Review" : "View Plan"}
          <ChevronRight size={14} />
        </button>
      </div>

      <button
        onClick={openCoachReview}
        className="rounded-2xl bg-background/55 backdrop-blur-sm px-4 py-3 text-left transition-colors hover:bg-background/70"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {coachSummary}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground line-clamp-2">
              {latestInsight}
            </p>
          </div>
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70 text-foreground/70"
            aria-hidden="true"
          >
            <ClipboardCheck size={18} />
          </span>
        </div>
      </button>
    </div>
  );
};
