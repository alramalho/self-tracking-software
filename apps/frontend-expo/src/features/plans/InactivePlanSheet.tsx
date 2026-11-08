import { useState } from "react";
import { View } from "react-native";
import { addMonths } from "date-fns";
import { Archive, ArchiveRestore, RefreshCw, Trash2 } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Sheet, Status, useColors } from "@/components/ui";
import { api } from "@/data/api";
import { useAction } from "@/data/queries";
import { SettingsCard } from "../settings/SettingsCard";
import { inactivePlanStatus, isPlanArchived } from "./plan-status";
import type { InactivePlanSheetProps } from "./types";

type InactiveAction = "reactivate" | "archive" | "unarchive" | "delete";

export function InactivePlanSheet({ plan, onClose }: InactivePlanSheetProps) {
  const c = useColors();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const action = useAction(async (operation: InactiveAction) => {
    if (!plan) return;
    if (operation === "delete") return api.delete(`/plans/${plan.id}`);
    if (operation === "reactivate")
      return api.patch("/plans/bulk-update", {
        updates: [
          { planId: plan.id, updates: { finishingDate: addMonths(new Date(), 1) } },
        ],
      });
    return api.post(`/plans/${plan.id}/${operation}`);
  });
  const close = () => {
    setConfirmDelete(false);
    action.reset();
    onClose();
  };
  const run = (operation: InactiveAction) =>
    action.mutate(operation, { onSuccess: close });
  if (!plan) return null;
  const archived = isPlanArchived(plan);
  return (
    <Sheet
      visible
      title={confirmDelete ? "Delete Plan" : "Manage Plan"}
      onClose={close}
    >
      <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
        <Text style={{ fontSize: 56 }}>{plan.emoji || "📋"}</Text>
        <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
          {plan.goal}
        </Text>
        <Copy muted>{inactivePlanStatus(plan)}</Copy>
      </View>
      {confirmDelete ? (
        <View style={{ gap: 16 }}>
          <Copy>Delete this plan? Your activity logs will remain.</Copy>
          <Copy muted>This action cannot be undone.</Copy>
          <Button danger busy={action.isPending} onPress={() => run("delete")}>
            Confirm Delete
          </Button>
          <Button
            secondary
            disabled={action.isPending}
            onPress={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {archived ? (
            <SettingsCard
              icon={ArchiveRestore}
              title="Restore Plan"
              description="Return this plan to your active plans"
              disabled={action.isPending}
              onPress={() => run("unarchive")}
            />
          ) : (
            <>
              <SettingsCard
                icon={RefreshCw}
                title="Reactivate Plan"
                description="Extend this plan for another month"
                disabled={action.isPending}
                onPress={() => run("reactivate")}
              />
              <SettingsCard
                icon={Archive}
                title="Archive Plan"
                description="Hide this plan from your active plans"
                color={c.muted}
                disabled={action.isPending}
                onPress={() => run("archive")}
              />
            </>
          )}
          <SettingsCard
            icon={Trash2}
            title="Delete Plan"
            description="Permanently delete this plan; activity logs remain"
            color="#dc2626"
            disabled={action.isPending}
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      )}
      <Status error={action.error} />
    </Sheet>
  );
}
