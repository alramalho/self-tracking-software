import { Pressable, View } from "react-native";
import { Activity, Check, Moon } from "lucide-react-native";
import { Copy, useColors } from "@/components/ui";
import {
  DaysInput,
  TimeInput,
} from "@/features/follow-through/assistance/Inputs";
import type { PlanCoaching } from "@tsw/prisma/follow-through";
import type { CoachingFieldsProps, CoachingChoiceProps } from "./types";

export const initialCoaching = (): PlanCoaching => ({
  role: "tracking",
  followUps: false,
  dataAccess: { workouts: false, sleep: false },
});
export function CoachingChoice({
  label,
  icon: Icon,
  detail,
  selected,
  card = false,
  disabled,
  onPress,
}: CoachingChoiceProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={card ? "radio" : "checkbox"}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: card ? 78 : 56,
        paddingVertical: card ? 15 : 12,
        paddingHorizontal: card ? 16 : 0,
        opacity: disabled ? 0.5 : 1,
        borderWidth: card ? 1 : 0,
        borderBottomWidth: 1,
        borderColor: card && selected ? c.accent : c.border,
        borderRadius: card ? 18 : 0,
        backgroundColor: card && selected ? c.selectedBg : card ? c.card : "transparent",
      }}
    >
      {Icon && <Icon size={22} strokeWidth={1.7} color={c.accent} />}
      <View style={{ flex: 1, gap: 4 }}>
        <Copy>{label}</Copy>
        {detail && <Copy muted>{detail}</Copy>}
      </View>
      {selected && <Check size={23} color={c.text} />}
    </Pressable>
  );
}
export function CoachingFields({
  value,
  preferences,
  onChange,
  onPreferences,
  canCoach,
}: CoachingFieldsProps) {
  return (
    <View style={{ gap: 12 }}>
      <Copy>How your coach helps</Copy>
      {(
        [
          [
            "tracking",
            "Just track",
            "Progress and activity logs, without proactive coaching.",
          ],
          [
            "consistency",
            "Help me stay consistent",
            "Review the habit and help with obstacles.",
          ],
          [
            "training",
            "Plan and adjust training",
            "Explain sessions and propose changes for your approval.",
          ],
        ] as const
      ).map(([role, label, detail]) => (
        <CoachingChoice
          key={role}
          label={label}
          detail={detail}
          selected={value.role === role}
          disabled={role !== "tracking" && !canCoach}
          onPress={() => {
            onChange({ ...value, role });
            onPreferences({
              ...preferences,
              coaching: role !== "tracking",
              weeklyReview: role !== "tracking" && preferences.weeklyReview,
            });
          }}
        />
      ))}
      {!canCoach && (
        <Copy muted>Coaching requires an active trial or subscription.</Copy>
      )}
      {value.role !== "tracking" && (
        <>
          <CoachingChoice
            label="Weekly review"
            detail="One message in your coach conversation."
            selected={preferences.weeklyReview}
            onPress={() =>
              onPreferences({
                ...preferences,
                coaching: true,
                weeklyReview: !preferences.weeklyReview,
              })
            }
          />
          {preferences.weeklyReview && (
            <>
              <DaysInput
                single
                value={[preferences.reviewDay]}
                onChange={([reviewDay]) =>
                  onPreferences({ ...preferences, reviewDay })
                }
              />
              <TimeInput
                value={preferences.reviewTime}
                onChange={(reviewTime) =>
                  onPreferences({ ...preferences, reviewTime })
                }
              />
            </>
          )}
          <CoachingChoice
            label="Follow up when useful"
            detail={value.role === "training" ? "A question after reported difficulty or a planned session. No reply counts as missed." : "One reminder after three days, then a nudge about why you started before offering to archive."}
            selected={value.followUps}
            onPress={() => onChange({ ...value, followUps: !value.followUps })}
          />
          <Copy>Information your coach can use</Copy>
          <Copy muted>
            Optional. Selected data is sent to the external AI services used by
            your coach for this plan. Connecting a watch does not enable this
            sharing. Turning it off stops future retrieval; earlier messages
            remain.
          </Copy>
          <CoachingChoice
            label="Watch workouts"
            icon={Activity}
            detail="Apple Health or Garmin: distance, duration and heart rate."
            selected={value.dataAccess.workouts}
            onPress={() =>
              onChange({
                ...value,
                dataAccess: {
                  ...value.dataAccess,
                  workouts: !value.dataAccess.workouts,
                },
              })
            }
          />
          <CoachingChoice
            label="Sleep summaries"
            icon={Moon}
            detail="Sleep duration and score, when available."
            selected={value.dataAccess.sleep}
            onPress={() =>
              onChange({
                ...value,
                dataAccess: {
                  ...value.dataAccess,
                  sleep: !value.dataAccess.sleep,
                },
              })
            }
          />
        </>
      )}
    </View>
  );
}
