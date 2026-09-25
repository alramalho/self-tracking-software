import { Pressable, View } from "react-native";
import { Activity, CalendarClock, Check, Dumbbell, ListChecks, MessageCircle, Moon, Repeat } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
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
/** Small uppercase label above a group, as in the app's other editors. */
function SectionLabel({ children }: { children: string }) {
  const c = useColors();
  return (
    <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.6, marginTop: 8 }}>
      {children.toUpperCase()}
    </Text>
  );
}

/** Toggle rows grouped in one rounded card. */
function ChoiceGroup({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 16 }}>
      {children}
    </View>
  );
}

const ROLES = [
  { role: "tracking", icon: ListChecks, label: "Just track", detail: "Your logs and progress. No coach messages." },
  { role: "consistency", icon: Repeat, label: "Help me stay consistent", detail: "Weekly check-ins, and a nudge when it slips." },
  { role: "training", icon: Dumbbell, label: "Plan and adjust training", detail: "Dated sessions with instructions, adapted each week." },
] as const;

export function CoachingFields({
  value,
  preferences,
  onChange,
  onPreferences,
  canCoach,
  timezone,
}: CoachingFieldsProps) {
  const c = useColors();
  return (
    <View style={{ gap: 10 }}>
      <SectionLabel>Coaching style</SectionLabel>
      {ROLES.map(({ role, icon, label, detail }) => (
        <CoachingChoice
          key={role}
          card
          icon={icon}
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
          <SectionLabel>Contact</SectionLabel>
          <ChoiceGroup>
            <CoachingChoice
              icon={CalendarClock}
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
              <View style={{ gap: 10, paddingVertical: 12 }}>
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
                {timezone && (
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    Times use {timezone.replaceAll("_", " ")}
                  </Text>
                )}
              </View>
            )}
            <CoachingChoice
              icon={MessageCircle}
              label="Follow up when useful"
              detail={value.role === "training" ? "A question after reported difficulty or a planned session. No reply counts as missed." : "A quiet nudge when it slips, one reminder, then an offer to archive."}
              selected={value.followUps}
              onPress={() => onChange({ ...value, followUps: !value.followUps })}
            />
          </ChoiceGroup>
          <SectionLabel>Data your coach can use</SectionLabel>
          <ChoiceGroup>
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
          </ChoiceGroup>
          <Copy muted>
            Optional. Selected data is sent to the external AI services your coach uses for
            this plan. Connecting a watch alone does not share it.
          </Copy>
        </>
      )}
    </View>
  );
}
