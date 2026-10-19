import { useState } from "react";
import { Switch } from "react-native";
import { router } from "expo-router";
import { Status, useColors } from "@/components/ui";
import { Drawer, DrawerButton, DrawerHeader, DrawerOptions } from "@/components/drawer/Drawer";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import { useCoachingSwitches } from "@/features/coach/useCoaching";
import type { PlanDrawerProps, PlanDrawerView } from "./types";

// The plan's settings: coaching on or off, then edit, pause, archive and delete.
export function PlanDrawer({ plan, visible, onClose }: PlanDrawerProps) {
  const c = useColors();
  const [view, setView] = useState<PlanDrawerView>("settings");
  const coaching = useCoachingSwitches();
  const action = useAction(async (operation: "pause" | "resume" | "archive" | "unarchive" | "delete") =>
    operation === "delete" ? api.delete(`/plans/${plan.id}`) : api.post(`/plans/${plan.id}/${operation}`, {}),
  );
  const close = () => {
    setView("settings");
    action.reset();
    onClose();
  };
  const run = (operation: Parameters<typeof action.mutate>[0]) => action.mutate(operation, { onSuccess: close });
  const coachingOn = coaching.master && coaching.planOn(plan.id);
  return (
    <Drawer visible={visible} label={plan.goal} onClose={close}>
      {view === "settings" ? (
        <>
          <DrawerHeader emoji={plan.emoji} title={plan.goal} />
          <DrawerOptions
            options={[
              {
                label: "Coaching",
                testID: "plan-coaching-switch-row",
                disabled: !coaching.ready,
                trailing: (
                  <Switch
                    testID="plan-coaching-switch"
                    accessibilityLabel={`Coaching for ${plan.goal}`}
                    value={coachingOn}
                    disabled={!coaching.canChangePlan}
                    onValueChange={(on) => coaching.setPlan(plan, on)}
                    trackColor={{ true: c.accent }}
                  />
                ),
              },
            ]}
          />
          <DrawerOptions
            options={[
              { label: "Edit plan", onPress: () => { close(); router.push(`/edit-plan/${plan.id}`); } },
              plan.isPaused
                ? { label: "Resume plan", onPress: () => run("resume"), disabled: action.isPending }
                : { label: "Pause plan", onPress: () => setView("pause") },
              plan.archivedAt
                ? { label: "Restore plan", onPress: () => run("unarchive"), disabled: action.isPending }
                : { label: "Archive plan", onPress: () => run("archive"), disabled: action.isPending },
              { label: "Delete plan", destructive: true, onPress: () => setView("delete") },
            ]}
          />
        </>
      ) : view === "pause" ? (
        <>
          <DrawerHeader emoji="⏸️" title="Pause this plan?" subtitle="Streaks still count down while paused" />
          <DrawerButton label="Pause plan" busy={action.isPending} onPress={() => run("pause")} />
        </>
      ) : (
        <>
          <DrawerHeader emoji={plan.emoji} title="Delete this plan?" subtitle="Your activity logs stay" />
          <DrawerOptions
            options={[
              { label: "Delete plan", destructive: true, disabled: action.isPending, onPress: () => run("delete") },
              { label: "Keep plan", onPress: () => setView("settings") },
            ]}
          />
        </>
      )}
      <Status error={action.error ?? coaching.error} />
      {coaching.consentSheet}
    </Drawer>
  );
}
