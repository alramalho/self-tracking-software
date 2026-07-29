import { useCurrentUser } from "@/contexts/users";
import { CoachAttentionDrawer } from "@/components/CoachAttentionBanner";
import { type CoachAttentionItem } from "@/contexts/ai/types";
import { type LatestCoachMessagePreview } from "@/contexts/messages/types";
import {
  getCoachAvatar,
  getCoachPersonalityConfig,
} from "@/lib/coachPersonality";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatCoachMessagePreview } from "./coachMessagePreview";
import { HomeCardShell } from "./HomeCardShell";

interface CoachCardProps {
  attentionCount: number;
  activePlanCount: number;
  isLoading?: boolean;
  reviewPlanId?: string;
  latestCoachMessage?: LatestCoachMessagePreview;
  coachAttentionItems?: CoachAttentionItem[];
}

export const CoachCard = ({
  attentionCount,
  activePlanCount,
  isLoading = false,
  reviewPlanId,
  latestCoachMessage,
  coachAttentionItems = [],
}: CoachCardProps) => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [isAttentionDrawerOpen, setIsAttentionDrawerOpen] = useState(false);
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const hasActivePlans = activePlanCount > 0;
  const hasPlanUpdates = coachAttentionItems.length > 0;
  const hasLatestUnreadMessage = latestCoachMessage?.isUnread === true;
  const coachMessagePreview = latestCoachMessage
    ? formatCoachMessagePreview(latestCoachMessage.content)
    : null;
  const archivedCount = coachAttentionItems.filter(
    (item) => item.kind === "SPECIFIC_AUTO_ARCHIVED",
  ).length;
  const pastEndCount = coachAttentionItems.filter(
    (item) => item.kind === "PLAN_PAST_END_DATE",
  ).length;
  const readyToExtendCount = coachAttentionItems.filter(
    (item) =>
      item.severity === "critical" &&
      item.kind !== "SPECIFIC_AUTO_ARCHIVED" &&
      item.kind !== "PLAN_PAST_END_DATE",
  ).length;
  const avatar = getCoachAvatar(
    currentUser?.coachPersonality,
    hasPlanUpdates || attentionCount > 0 || hasLatestUnreadMessage
      ? "thinking"
      : hasActivePlans
        ? "coachSmiling"
        : "sad",
  );

  const openCard = () => {
    if (hasPlanUpdates) {
      setIsAttentionDrawerOpen(true);
      return;
    }

    if (hasLatestUnreadMessage) {
      navigate({ to: "/message-ai" });
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
          hasPlanUpdates
            ? "aspect-[2/1] p-5 ring-amber-500/35 bg-amber-500/10"
            : undefined
        }
      >
        {hasPlanUpdates ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="relative h-20 w-20 shrink-0">
                  <div className="absolute inset-1 rounded-full bg-amber-400/20 motion-safe:animate-ping" />
                  <img
                    src={avatar}
                    alt={aiCoach.label}
                    className="relative z-10 h-20 w-20 rounded-full object-contain"
                  />
                </div>
                <div className="flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-500 px-2 text-background shadow-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {coachAttentionItems.length > 1 && (
                    <span className="ml-1 text-sm font-semibold leading-none">
                      {coachAttentionItems.length}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            </div>

            <div>
              <p className="text-xl font-semibold leading-tight text-foreground">
                {archivedCount > 0
                  ? `${archivedCount} plan${archivedCount === 1 ? "" : "s"} archived`
                  : `${coachAttentionItems.length} plan update${coachAttentionItems.length === 1 ? "" : "s"}`}
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-muted-foreground">
                {archivedCount > 0
                  ? "Coach warning needs review"
                  : pastEndCount > 0
                    ? `${pastEndCount} plan${pastEndCount === 1 ? "" : "s"} past end date`
                    : readyToExtendCount > 0
                      ? `${readyToExtendCount} plan${readyToExtendCount === 1 ? "" : "s"} ready to extend`
                      : "Next week needs planning"}
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
              {(attentionCount > 0 || hasLatestUnreadMessage) && (
                <div className="absolute inset-0 rounded-full animate-ping bg-amber-400/30" />
              )}
              <img
                src={avatar}
                alt={aiCoach.label}
                className="w-14 h-14 rounded-full object-contain relative z-10"
              />
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : hasLatestUnreadMessage && latestCoachMessage ? (
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-500">
                  {`New from ${aiCoach.name}`}
                </p>
                <p className="line-clamp-4 text-base font-medium leading-snug text-foreground">
                  {coachMessagePreview}
                </p>
              </div>
            ) : attentionCount > 0 ? (
              <p className="text-base font-medium text-muted-foreground">
                {`${attentionCount} coach action${attentionCount > 1 ? "s" : ""} pending`}
              </p>
            ) : latestCoachMessage ? (
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {`${aiCoach.name}'s take`}
                </p>
                <p className="line-clamp-4 text-base font-medium leading-snug text-foreground">
                  {coachMessagePreview}
                </p>
              </div>
            ) : (
              <p className="text-base font-medium text-muted-foreground">
                {hasActivePlans
                  ? "Nothing needs your attention"
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
