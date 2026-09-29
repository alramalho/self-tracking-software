import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { defaultPreferences, useCircleActions, useMyCircles } from "./api";
import { ReasonChips } from "./components";
import type { JoinDialogProps } from "./types";

// Pick which of your plans joins the circle. Plans already in a circle are shown
// but can't be picked: one circle per plan.
export function JoinDialog({ card, inviteCode, onClose, onJoined }: JoinDialogProps) {
  const theme = useThemeColors();
  const { plans, isLoadingPlans } = usePlans();
  const mine = useMyCircles(!!card);
  const { joinCircle, joinByInvite } = useCircleActions();
  const [picked, setPicked] = useState<string>();
  const taken = new Map((mine.data ?? []).map((circle) => [circle.planId, circle.name]));
  const active = (plans ?? []).filter((plan) => !plan.deletedAt && !plan.archivedAt);
  const choice = picked ?? active.find((plan) => !taken.has(plan.id))?.id;
  const join = inviteCode ? joinByInvite : joinCircle;

  const submit = async () => {
    if (!card || !choice) return;
    const joined = inviteCode
      ? await joinByInvite.mutateAsync({ code: inviteCode, planId: choice, preferences: defaultPreferences })
      : await joinCircle.mutateAsync({ circleId: card.id, planId: choice, preferences: defaultPreferences });
    onJoined(joined.id);
  };

  return (
    <AppleLikePopover open={!!card} onClose={onClose} title={card ? `${card.emoji} ${card.name}` : "Join circle"}>
      {card && (
        <div className="flex flex-col gap-3.5 pt-4">
          <h2 className="text-lg font-bold text-foreground pr-10">
            {card.emoji} {card.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {[`${card.memberCount} ${card.memberCount === 1 ? "person" : "people"}`, card.paceLabel, card.place]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <ReasonChips reasons={card.reasons} />
          <p className="text-[15px] font-semibold text-foreground">Join with</p>
          {isLoadingPlans && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          <div role="radiogroup" className="overflow-hidden rounded-2xl bg-card border border-border">
            {active.map((plan, index) => {
              const inCircle = taken.get(plan.id);
              const selected = choice === plan.id && !inCircle;
              return (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!!inCircle}
                  onClick={() => setPicked(plan.id)}
                  className={cn(
                    "flex min-h-[56px] w-full items-center gap-3 px-4 text-left enabled:hover:bg-muted/40 disabled:opacity-45",
                    index > 0 && "border-t border-border"
                  )}
                >
                  <span className="text-xl">{plan.emoji || "✨"}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base text-foreground">{plan.goal}</span>
                    {!!inCircle && (
                      <span className="text-[13px] text-muted-foreground">{`Already in ${inCircle}`}</span>
                    )}
                  </span>
                  {selected && <Check className={cn("h-[22px] w-[22px]", theme.text)} strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            You're in once you post a photo from a session. Members see this plan's week and its logs:
            activity, amount, date, photo and caption. Never your location or private notes.
          </p>
          {join.error && <p className="text-sm text-red-500">{toApiErrorMessage(join.error)}</p>}
          <Button
            className="h-12 w-full"
            loading={join.isPending}
            disabled={!choice || join.isPending}
            onClick={() => void submit().catch(() => {})}
          >
            Join circle
          </Button>
        </div>
      )}
    </AppleLikePopover>
  );
}
