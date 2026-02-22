import { useThemeColors } from "@/hooks/useThemeColors";
import { usePlans } from "@/contexts/plans";
import { useTheme } from "@/contexts/theme/useTheme";
import { useDataNotifications } from "@/contexts/notifications";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNavigate } from "@tanstack/react-router";
import { getThemeVariants } from "@/utils/theme";
import { ChevronRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { PulsatingCirclePill } from "@/components/ui/pulsating-circle-pill";

function readableText(text: string) {
  return text.replace("_", " ")
}

export const CoachHomeSection = () => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { plans } = usePlans();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { notifications } = useDataNotifications();
  const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(
    "coach-section-collapsed",
    true
  );

  const weekAnalysisNotification = notifications
    ?.filter(
      (n) =>
        n.type === "COACH" &&
        n.title === "Weekly Recap" &&
        n.status !== "CONCLUDED"
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  const hasPendingWeekAnalysis = !!weekAnalysisNotification;

  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );

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
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={hasPendingWeekAnalysis ? () => setIsCollapsed((prev) => !prev) : undefined}
          className={cn("flex items-center gap-2", !hasPendingWeekAnalysis && "cursor-default")}
        >
          {hasPendingWeekAnalysis && (
            isCollapsed ? (
              <ChevronRight size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )
          )}
          <img src={coachIcon} alt="Coach Oli" className="w-6 h-6 rounded-full" />
          <span className="text-md font-semibold text-foreground">
            Coach Oli
          </span>
        </button>
        {(
          <button
            onClick={() => navigate({ to: "/message-ai" })}
            className={cn("text-sm font-medium flex items-center gap-0.5 text-foreground/50")}
          >
            Message Coach
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Plan pills (always shown when collapsed, or when no pending actions) */}
      {(isCollapsed || !hasPendingWeekAnalysis) && activePlans && activePlans.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activePlans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                "bg-background/60 backdrop-blur-sm"
              )}
            >
              <span className="text-sm leading-none">{plan.emoji || "📋"}</span>
              <span className="text-sm font-medium text-foreground">
                {readableText(plan.category || plan.goal)}
              </span>
              {hasPendingWeekAnalysis && (
                <PulsatingCirclePill variant="yellow" size="sm" className="ml-0.5" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Expanded: plan cards (only when pending actions) */}
      <AnimatePresence initial={false}>
        {!isCollapsed && hasPendingWeekAnalysis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              {activePlans?.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-2xl p-3 bg-background/60 backdrop-blur-sm",
                    variants.ringBright
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{plan.emoji || "📋"}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {readableText(plan.category || plan.goal)}
                    </span>
                  </div>
                  {hasPendingWeekAnalysis && (
                    <button
                      onClick={() => navigate({ to: "/message-ai" })}
                      className={cn(
                        "mt-2 text-xs font-medium flex items-center gap-0.5 text-foreground/50",
                      )}
                    >
                      See week analysis
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
