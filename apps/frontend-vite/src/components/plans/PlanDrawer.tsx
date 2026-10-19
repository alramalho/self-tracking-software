import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ActionDrawer, DrawerButton, DrawerHeader, DrawerOptions } from "@/components/drawer/ActionDrawer";
import { useCoachingSwitches } from "@/components/coach/useCoaching";
import { Switch } from "@/components/ui/switch";
import { usePlans } from "@/contexts/plans";
import type { PlanDrawerProps, PlanDrawerView, PlanOperation } from "./types";

// The plan's settings, as on iPhone: coaching on or off, then edit, pause, archive and delete.
export function PlanDrawer({ plan, open, onClose }: PlanDrawerProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<PlanDrawerView>("settings");
  const coaching = useCoachingSwitches();
  const { pausePlan, resumePlan, archivePlan, unarchivePlan, deletePlan } = usePlans();
  const close = () => {
    setView("settings");
    onClose();
  };
  const action = useMutation({
    mutationFn: (operation: PlanOperation) =>
      ({
        pause: () => pausePlan(plan.id),
        resume: () => resumePlan(plan.id),
        archive: () => archivePlan(plan.id),
        unarchive: () => unarchivePlan(plan.id),
        delete: () => deletePlan(plan.id),
      })[operation](),
    onSuccess: close,
  });
  const run = (operation: PlanOperation) => action.mutate(operation);
  return (
    <ActionDrawer open={open} label={plan.goal} onClose={close}>
      {view === "settings" ? (
        <>
          <DrawerHeader emoji={plan.emoji} title={plan.goal} />
          <DrawerOptions
            options={[
              {
                label: "Coaching",
                testId: "plan-coaching-switch-row",
                disabled: !coaching.ready,
                trailing: (
                  <Switch
                    data-testid="plan-coaching-switch"
                    aria-label={`Coaching for ${plan.goal}`}
                    checked={coaching.master && coaching.planOn(plan.id)}
                    disabled={!coaching.canChangePlan}
                    onCheckedChange={(on) => coaching.setPlan(plan, on)}
                  />
                ),
              },
            ]}
          />
          <DrawerOptions
            options={[
              { label: "Edit plan", onClick: () => { close(); navigate({ to: "/edit-plan/$planId", params: { planId: plan.id } }); } },
              plan.isPaused
                ? { label: "Resume plan", disabled: action.isPending, onClick: () => run("resume") }
                : { label: "Pause plan", onClick: () => setView("pause") },
              plan.archivedAt
                ? { label: "Restore plan", disabled: action.isPending, onClick: () => run("unarchive") }
                : { label: "Archive plan", disabled: action.isPending, onClick: () => run("archive") },
              { label: "Delete plan", destructive: true, onClick: () => setView("delete") },
            ]}
          />
        </>
      ) : view === "pause" ? (
        <>
          <DrawerHeader emoji="⏸️" title="Pause this plan?" subtitle="Streaks still count down while paused" />
          <DrawerButton label="Pause plan" busy={action.isPending} onClick={() => run("pause")} />
        </>
      ) : (
        <>
          <DrawerHeader emoji={plan.emoji} title="Delete this plan?" subtitle="Your activity logs stay" />
          <DrawerOptions
            options={[
              { label: "Delete plan", destructive: true, disabled: action.isPending, onClick: () => run("delete") },
              { label: "Keep plan", onClick: () => setView("settings") },
            ]}
          />
        </>
      )}
    </ActionDrawer>
  );
}
