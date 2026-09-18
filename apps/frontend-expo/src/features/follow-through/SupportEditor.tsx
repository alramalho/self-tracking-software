import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { useFollowThrough } from "./api";
import { defaultSupport, isFlexiblePlan } from "./model";
import { AssistanceSheet } from "./assistance/AssistanceSheet";
import { days } from "./assistance/Inputs";
import type { Control, AssistanceRow } from "./assistance/types";
import type { SupportEditorProps } from "./types";

/** A plan's current agreement; each row edits only one aspect of it. */
export function SupportEditor({ plan, toolsOnly = false }: SupportEditorProps) {
  const query = useFollowThrough(),
    c = useColors();
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
  const review =
    support.preferences.coaching && support.preferences.weeklyReview
      ? `${days[support.preferences.reviewDay]} · ${support.preferences.reviewTime}`
      : "Off";
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
        { id: "review", icon: "🤖", title: "Weekly review", value: review },
      ];
  return (
    <View testID="plan-assistance" style={{ gap: 8 }}>
      <Status loading={query.isLoading} error={query.error} />
      {query.data && (
        <View
          style={{
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: c.card,
          }}
        >
          {rows.map((row, index) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`${row.title} · ${row.value}`}
              onPress={() => setControl(row.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 64,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderTopWidth: index ? 1 : 0,
                borderColor: c.border,
              }}
            >
              <Text style={{ fontSize: 25 }}>{row.icon}</Text>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 5,
                }}
              >
                <Text
                  style={{ color: c.text, fontSize: 16, fontWeight: "600" }}
                >
                  {row.title}
                </Text>
                <Text style={{ color: c.muted, fontSize: 16 }}>
                  · {row.value}
                </Text>
              </View>
              <ChevronRight size={18} color={c.muted} />
            </Pressable>
          ))}
        </View>
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
