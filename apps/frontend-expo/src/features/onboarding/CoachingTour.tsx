import { Image, View } from "react-native";
import { Activity, Moon } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { coachIdentity } from "@/features/messages/coach";
import { CoachingChoice } from "@/features/plans/coaching/CoachingFields";
import { StepSequence } from "./interview/StepReveal";
import type { CoachingTourProps } from "./types";
import { AdaptationPreview } from "./coach-tour/AdaptationPreview";
import { AdaptingWeeks } from "./coach-tour/AdaptingWeeks";
import { LockScreenPreview } from "./coach-tour/LockScreenPreview";

/** Three screens that show the coach at work (a check-in, a slipped week, the change it suggests), then the data it may use. */
export const TOUR_STEPS = 4;
const CONTACT_STEP = 0;
const WEEKS_STEP = 1;
const ADAPTS_STEP = 2;
export const DATA_STEP = 3;
const titles = [
  "A timely check-in.",
  "It follows how you do.",
  "Your plan adapts.",
  "You choose what it can see.",
];
const details = [
  "One quick question when a week is at risk.",
  "Miss your week and it eases off. Hit it and it grows.",
  "Your coach suggests the change. You decide.",
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

export function CoachingTour({ locked = false, step, facts, coaching, preferences, onCoaching, onPreferences }: CoachingTourProps) {
  const c = useColors();
  const personality = useCurrentUser().data?.coachPersonality;
  const coach = coachIdentity(personality);
  const strategist = personality === "STRATEGIST";
  return (
    <View testID={["coach-tour-contact", "coach-tour-weeks", "coach-tour-adapts", "coach-tour-data"][step]} style={{ gap: 20 }}>
      <StepSequence prefix="coach-heading" style={{ alignItems: "center", gap: 12 }}>
        {/* The coach introduces itself on every step. */}
        <View style={{ alignItems: "center", gap: 4 }}>
          <Image
            source={coach.name === "Oli" ? require("../../../assets/coaches/oli-3d.png") : require("../../../assets/coaches/helly-3d.png")}
            style={{ width: 64, height: 64 }}
          />
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{coach.name} · your coach</Text>
        </View>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 27, lineHeight: 33, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>
          {titles[step]}
        </Text>
        <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24, textAlign: "center" }}>
          {details[step]}
        </Text>
      </StepSequence>

      {step === CONTACT_STEP && (
        <StepSequence start={3} prefix="coach-content" style={{ gap: 14 }}>
          <LockScreenPreview
            coachName={coach.name}
            message="Two sessions left and four days to go. Which days work?"
          />
          <View>
            <CoachingChoice label="Follow up when useful" detail={coaching.role === "training" ? "Asks after each planned session. No reply counts as missed, and next week adapts." : "One reminder, then a nudge about why you started before offering to archive."} selected={coaching.followUps} onPress={() => onCoaching({ ...coaching, followUps: !coaching.followUps })} />
          </View>
        </StepSequence>
      )}

      {step === WEEKS_STEP && (
        <StepSequence start={3} prefix="coach-content" style={{ gap: 14 }}>
          <AdaptingWeeks strategist={strategist} emoji={facts.emoji || "✅"} />
        </StepSequence>
      )}

      {step === ADAPTS_STEP && (
        <StepSequence start={3} prefix="coach-content" style={{ gap: 14 }}>
          <AdaptationPreview strategist={strategist} />
          {!locked && <View style={{ gap: 10 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: "600", marginBottom: 4 }}>What help do you want?</Text>
            <CoachingChoice card label="Plan and adjust training" detail="For a goal with sessions that need to progress." selected={coaching.role === "training"} onPress={() => onCoaching({ ...coaching, role: "training" })} />
            <CoachingChoice card label="Help me stay consistent" detail="For a habit or routine you already know." selected={coaching.role === "consistency"} onPress={() => onCoaching({ ...coaching, role: "consistency" })} />
          </View>}
        </StepSequence>
      )}

      {step === DATA_STEP && (
        <StepSequence start={3} prefix="coach-content" style={{ gap: 14 }}>
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
        </StepSequence>
      )}
    </View>
  );
}
