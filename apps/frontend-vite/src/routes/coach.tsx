import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight, Loader2 } from "lucide-react";
import { CoachItemDrawer } from "@/components/coach/CoachItemDrawer";
import { useCoachInbox } from "@/components/coach/useCoachInbox";
import { useCoachingSwitches } from "@/components/coach/useCoaching";
import { coachFace } from "@/components/coach/face";
import type { CoachItem, CoachRowProps, SectionLabelProps } from "@/components/coach/types";
import { MetricsLogPopover } from "@/components/MetricsLogPopover";
import { Switch } from "@/components/ui/switch";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/coach")({
  component: CoachPage,
});

function CoachRow({ item, onClick }: CoachRowProps) {
  const theme = useThemeColors();
  return (
    <button
      type="button"
      data-testid={`coach-item-${item.id}`}
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 border-t border-border py-2.5 text-left transition-opacity hover:opacity-70"
    >
      <span className="w-9 shrink-0 text-center text-[22px]">{item.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{item.title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {/* Alerts and today's check-in are states, not messages: no time. */}
          {item.kind === "alert" || item.kind === "checkin"
            ? item.label
            : `${item.label} · ${formatDistanceToNowStrict(new Date(item.at), { addSuffix: true })}`}
        </span>
      </span>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", theme.bg)} aria-hidden />
    </button>
  );
}

const SectionLabel = ({ children }: SectionLabelProps) => (
  <p className="px-1 text-[13px] font-semibold text-muted-foreground">{children}</p>
);

// Who keeps you on track: the coach, one switch for everything, what the coach is waiting on you
// for, and one switch per plan. Same screen as the iPhone app's Coach tab.
function CoachPage() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { plans } = usePlans();
  const inbox = useCoachInbox();
  const coaching = useCoachingSwitches();
  const coach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const face = coachFace(currentUser?.coachPersonality);
  const [open, setOpen] = useState<CoachItem>();
  const [checkIn, setCheckIn] = useState(false);
  const active = (plans ?? []).filter(
    (p) => !p.archivedAt && !p.deletedAt && (!p.finishingDate || new Date(p.finishingDate) >= new Date()),
  );
  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-28" data-testid="coach-screen">
      <h1 className="pt-2 text-3xl font-bold">Coach</h1>

      <div className="flex flex-col gap-3.5 rounded-[18px] border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <img src={face} alt="" className="h-12 w-12" />
          <div>
            <p className="font-semibold">{coach.name}</p>
            <p className="text-[13px] text-muted-foreground">{coach.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-3.5">
          <div className="flex-1">
            <p className="text-[15px] font-semibold">Coaching</p>
            <p className="text-[13px] text-muted-foreground">
              {coaching.canCoach || !coaching.ready
                ? "Check-ins, weekly reviews and messages after you log"
                : "Coaching comes with Plus"}
            </p>
          </div>
          <Switch
            data-testid="coach-master-switch"
            aria-label="Coaching for all plans"
            checked={coaching.canCoach && coaching.master}
            disabled={!coaching.ready || !coaching.canCoach || coaching.busy}
            onCheckedChange={coaching.setMaster}
          />
        </div>
      </div>

      <SectionLabel>Recent</SectionLabel>
      <div className="rounded-[18px] border border-border bg-card px-4 py-1">
        <button
          type="button"
          data-testid="coach-messages"
          onClick={() => navigate({ to: "/message-ai" })}
          className="flex min-h-16 w-full items-center gap-3 text-left transition-opacity hover:opacity-70"
        >
          <img src={face} alt="" className="h-9 w-9" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Messages</span>
            <span className="block text-[13px] text-muted-foreground">Your conversation with {coach.name}</span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
        </button>
        {inbox.loading && <Loader2 className="mx-auto my-3 h-5 w-5 animate-spin text-muted-foreground" />}
        {inbox.items.map((item) => (
          <CoachRow key={item.id} item={item} onClick={() => setOpen(item)} />
        ))}
      </div>

      {active.length > 0 && <SectionLabel>Your plans</SectionLabel>}
      {!coaching.master && coaching.canCoach && (
        <p className="px-1 text-[13px] text-muted-foreground">
          Coaching is off for every plan. Each plan keeps its own setting for when you turn it back on.
        </p>
      )}
      {active.map((plan) => {
        const on = coaching.planOn(plan.id);
        return (
          <div
            key={plan.id}
            data-testid={`coach-plan-${plan.id}`}
            className={cn(
              "flex items-center gap-3 rounded-[18px] border border-border bg-card p-4",
              !coaching.master && "opacity-50",
            )}
          >
            <span className="text-[28px]">{plan.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{plan.goal}</p>
              <p className="text-[13px] text-muted-foreground">
                {!coaching.master ? "Off for all plans" : on ? "Coached" : "Just tracking"}
              </p>
            </div>
            <Switch
              data-testid={`coach-plan-switch-${plan.id}`}
              aria-label={`Coaching for ${plan.goal}`}
              checked={coaching.master && on}
              disabled={!coaching.canChangePlan}
              onCheckedChange={(next) => coaching.setPlan(plan, next)}
            />
          </div>
        );
      })}
      <CoachItemDrawer item={open} onClose={() => setOpen(undefined)} onCheckIn={() => setCheckIn(true)} />
      <MetricsLogPopover open={checkIn} onClose={() => setCheckIn(false)} />
    </div>
  );
}
