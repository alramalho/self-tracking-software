import { useState } from "react";
import { View } from "react-native";
import { GroupedRows, Status } from "@/components/ui";
import { useFollowThrough } from "./api";
import { defaultSupport, isFlexiblePlan } from "./model";
import { AssistanceSheet } from "./assistance/AssistanceSheet";
import { days } from "./assistance/Inputs";
import type { Control, AssistanceRow } from "./assistance/types";
import type { SupportEditorProps } from "./types";

/** A plan's current agreement; each row edits only one aspect of it. */
export function SupportEditor({ plan, toolsOnly = false }: SupportEditorProps) {
  const query = useFollowThrough();
  const [control, setControl] = useState<Control>();
  const support = query.data?.state.supports[plan.id] ?? defaultSupport(plan);
  const flexible = isFlexiblePlan(plan, support);
  const schedule =
    plan.outlineType === "SPECIFIC"
      ? "Planned dates"
      : flexible
        ? "Anytime"
        : `${support.weekdays.map((d) => days[d]).join(", ")}${support.mode === "TIMED" ? ` · ${support.time}` : " · Any time"}`;
  const reminders =
    flexible || !support.preferences.reminder
      ? "Off"
      : support.mode === "TIMED"
        ? support.preferences.reminderMinutes === 0
          ? "At the start"
          : `${support.preferences.reminderMinutes} min before`
        : `${support.preferences.dayReminderTime} on planned days`;
  const rows: AssistanceRow[] = toolsOnly
    ? [
        {
          id: "tools",
          icon: "⏱️",
          title: "Session tools",
          value:
            support.format === "TIMER"
              ? "Timer"
              : support.format === "RESOURCE"
                ? support.resourceName || "Resource"
                : "Just log",
        },
        {
          id: "check-in",
          icon: "💬",
          title: "After-session check",
          value:
            support.preferences.coaching && support.preferences.checkIn
              ? "On"
              : "Off",
        },
      ]
    : [
        { id: "schedule", icon: "📅", title: "Schedule", value: schedule },
        { id: "reminders", icon: "🔔", title: "Reminders", value: reminders },
      ];
  return (
    <View testID="plan-assistance" style={{ gap: 8 }}>
      <Status loading={query.isLoading} error={query.error} />
      {query.data && (
        <GroupedRows
          rows={rows.map((row) => ({ ...row, onPress: () => setControl(row.id) }))}
        />
      )}
      {control && (
        <AssistanceSheet
          key={`${plan.id}-${control}`}
          control={control}
          plan={plan}
          support={support}
          canCoach={!!query.data?.canCoach}
          onClose={() => setControl(undefined)}
          onSaved={() => setControl(undefined)}
        />
      )}
    </View>
  );
}
