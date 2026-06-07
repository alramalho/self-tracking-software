import { useCurrentUser } from "@/contexts/users";
import {
  CoachAttentionDrawer,
} from "@/components/CoachAttentionBanner";
import { type CoachAttentionItem } from "@/contexts/ai/types";
import { getCoachAvatar, getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { HomeCardShell } from "./HomeCardShell";

interface CoachCardProps {
  attentionCount: number;
  activePlanCount: number;
  isLoadingPlans?: boolean;
  reviewPlanId?: string;
  lastCoachNoReportAt?: string | null;
  coachAttentionItems?: CoachAttentionItem[];
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const NO_REPORT_VISIBLE_MS = HOUR_MS;

const getNextAssessmentAt = (now: Date, preferredHour: number) => {
  const next = new Date(now);
  next.setHours(preferredHour, 0, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
};

const formatSingleUnitDuration = (from: Date, to: Date) => {
  const diffMs = Math.max(0, to.getTime() - from.getTime());

  const days = Math.floor(diffMs / DAY_MS);
  if (days >= 1) return `${days}d`;

  const hours = Math.floor(diffMs / HOUR_MS);
  if (hours >= 1) return `${hours}h`;

  return `${Math.max(1, Math.ceil(diffMs / MINUTE_MS))}m`;
};

export const CoachCard = ({
  attentionCount,
  activePlanCount,
  isLoadingPlans = false,
  reviewPlanId,
  lastCoachNoReportAt,
  coachAttentionItems = [],
}: CoachCardProps) => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [isAttentionDrawerOpen, setIsAttentionDrawerOpen] = useState(false);
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const hasActivePlans = activePlanCount > 0;
  const hasPlanWarnings = coachAttentionItems.length > 0;
  const criticalWarningCount = coachAttentionItems.filter(
    (item) => item.severity === "critical"
  ).length;
  const preferredCoachingHour = currentUser?.preferredCoachingHour ?? 6;
  const nextAssessmentAt = getNextAssessmentAt(now, preferredCoachingHour);
  const nextAssessmentLabel = formatSingleUnitDuration(now, nextAssessmentAt);
  const noReportAtMs = lastCoachNoReportAt
    ? new Date(lastCoachNoReportAt).getTime()
    : Number.NaN;
  const hasRecentNoReport =
    Number.isFinite(noReportAtMs) &&
    now.getTime() - noReportAtMs < NO_REPORT_VISIBLE_MS;
  const avatar = getCoachAvatar(
    currentUser?.coachPersonality,
    hasPlanWarnings || attentionCount > 0
      ? "thinking"
      : hasActivePlans
        ? "coachSmiling"
        : "sad"
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const openCard = () => {
    if (hasPlanWarnings) {
      setIsAttentionDrawerOpen(true);
      return;
    }

    if (attentionCount > 0 && reviewPlanId) {
      navigate({ to: `/plans?selectedPlan=${reviewPlanId}` });
      return;
    }

    navigate({ to: "/message-ai" });
  };

  return (
    <>
      <HomeCardShell
        onClick={openCard}
        className={
          hasPlanWarnings
            ? "aspect-[2/1] p-5 ring-amber-500/35 bg-amber-500/10"
            : undefined
        }
      >
        {hasPlanWarnings ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <div className="absolute inset-1 rounded-full bg-amber-400/20 motion-safe:animate-ping" />
                <img
                  src={avatar}
                  alt={aiCoach.label}
                  className="relative z-10 h-20 w-20 rounded-full object-contain"
                />
                <div className="absolute -right-1 bottom-1 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-background shadow-sm">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            </div>

            <div>
              <p className="text-xl font-semibold leading-tight text-foreground">
                {coachAttentionItems.length} plan warning
                {coachAttentionItems.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-muted-foreground">
                {criticalWarningCount > 0
                  ? `${criticalWarningCount} plan${criticalWarningCount === 1 ? "" : "s"} with no sessions left`
                  : "Schedules run out this week"}
              </p>
              <p className="mt-3 inline-flex items-center text-sm font-semibold text-amber-500">
                Expand
                <ChevronRight className="ml-1 h-4 w-4" />
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="relative w-14 h-14">
              {attentionCount > 0 && (
                <div className="absolute inset-0 rounded-full animate-ping bg-amber-400/30" />
              )}
              <img
                src={avatar}
                alt={aiCoach.label}
                className="w-14 h-14 rounded-full object-contain relative z-10"
              />
            </div>
            {isLoadingPlans ? (
              <div className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <p className="text-base font-medium text-muted-foreground">
                {attentionCount > 0
                  ? `${attentionCount} coach action${attentionCount > 1 ? "s" : ""} pending`
                  : hasActivePlans
                    ? hasRecentNoReport
                      ? "Coach has nothing to report"
                      : `Next coach assessment in ${nextAssessmentLabel}`
                    : "No active plans"}
              </p>
            )}
          </>
        )}
      </HomeCardShell>

      <CoachAttentionDrawer
        open={isAttentionDrawerOpen}
        onOpenChange={setIsAttentionDrawerOpen}
        items={coachAttentionItems}
      />
    </>
  );
};
