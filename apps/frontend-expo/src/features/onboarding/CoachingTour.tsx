import { View } from "react-native";
import { Activity, MessageCircle, Moon, Sparkles } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { CoachingChoice } from "@/features/plans/coaching/CoachingFields";
import { DaysInput, TimeInput } from "@/features/follow-through/assistance/Inputs";
import type { CoachingTourProps } from "./types";

const titles = [
  "A coach for this plan.",
  "A timely check-in.",
  "You choose what it can see.",
];
const details = [
  "See a first step, session explanations and changes for your approval.",
  "Questions and proposals open in Messages.",
  "Choose the watch summaries your coach may use for this plan.",
];

function Example({ label, children }: { label: string; children: string }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 18, padding: 20, gap: 10 }}>
      <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text style={{ color: c.text, fontSize: 17, lineHeight: 25 }}>
        {children}
      </Text>
    </View>
  );
}

export function CoachingTour({ step, facts, coaching, preferences, onCoaching, onPreferences }: CoachingTourProps) {
  const c = useColors();
  const Icon = [Sparkles, MessageCircle, Activity][step];
  return (
    <View testID={["coach-tour-role", "coach-tour-contact", "coach-tour-data"][step]} style={{ gap: 20 }}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <View style={{ height: 68, justifyContent: "center" }}>
          <Icon size={58} strokeWidth={1.4} color={c.accent} />
        </View>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 27, lineHeight: 33, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>
          {titles[step]}
        </Text>
        <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24, textAlign: "center" }}>
          {details[step]}
        </Text>
      </View>

      {step === 0 && (
        <View style={{ gap: 14 }}>
          <Example label="EXAMPLE · YOUR PLAN">
            {`“Let’s start with the ${facts.activityTitle.toLowerCase()} routine you described. I’ll suggest a first week for you to review.”`}
          </Example>
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: "600", marginBottom: 4 }}>What help do you want?</Text>
            <CoachingChoice card label="Plan and adjust training" detail="For a goal with sessions that need to progress." selected={coaching.role === "training"} onPress={() => onCoaching({ ...coaching, role: "training" })} />
            <CoachingChoice card label="Help me stay consistent" detail="For a habit or routine you already know." selected={coaching.role === "consistency"} onPress={() => onCoaching({ ...coaching, role: "consistency" })} />
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: 14 }}>
          <Example label="EXAMPLE · AFTER A DIFFICULT WEEK">
            “Hard week. Should we keep the plan or make it lighter?”
          </Example>
          <View>
            <CoachingChoice label="Weekly review" detail="One message at the day and time you choose." selected={preferences.weeklyReview} onPress={() => onPreferences({ ...preferences, weeklyReview: !preferences.weeklyReview })} />
            {preferences.weeklyReview && <View style={{ gap: 12, paddingVertical: 12 }}><DaysInput single value={[preferences.reviewDay]} onChange={([reviewDay]) => onPreferences({ ...preferences, reviewDay })} /><TimeInput value={preferences.reviewTime} onChange={(reviewTime) => onPreferences({ ...preferences, reviewTime })} /></View>}
            <CoachingChoice label="Follow up when useful" detail={coaching.role === "training" ? "Asks after each planned session. No reply counts as missed, and next week adapts." : "One reminder, then a nudge about why you started before offering to archive."} selected={coaching.followUps} onPress={() => onCoaching({ ...coaching, followUps: !coaching.followUps })} />
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 14 }}>
          <Example label={coaching.role === "training" ? "EXAMPLE · WITH WORKOUT ACCESS" : "EXAMPLE · FROM THIS PLAN'S LOGS"}>
            {coaching.role === "training"
              ? "“I can see yesterday’s workout. Did it feel comfortable enough to repeat?”"
              : `“I saw a ${facts.activityTitle.toLowerCase()} session logged this week. How did it go?”`}
          </Example>
          <View>
            <CoachingChoice icon={Activity} label="Watch workouts" detail="Apple Health or Garmin: distance, duration and heart rate." selected={coaching.dataAccess.workouts} onPress={() => onCoaching({ ...coaching, dataAccess: { ...coaching.dataAccess, workouts: !coaching.dataAccess.workouts } })} />
            <CoachingChoice icon={Moon} label="Sleep summaries" detail="Duration and score, when available." selected={coaching.dataAccess.sleep} onPress={() => onCoaching({ ...coaching, dataAccess: { ...coaching.dataAccess, sleep: !coaching.dataAccess.sleep } })} />
          </View>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
            Selected data goes to the external AI services used by your coach. You can change this in the plan later. Turning access off stops future retrieval; earlier messages remain.
          </Text>
        </View>
      )}
    </View>
  );
}
