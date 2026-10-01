import { View } from "react-native";
import { Clock, Dumbbell, Footprints, Gauge, Target } from "lucide-react-native";
import type { SessionTargets } from "@tsw/prisma/follow-through";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { liftText, paceText } from "@/features/onboarding/design/format";

function Row({ icon: Icon, children }: { icon: typeof Clock; children: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <Icon size={18} color={c.muted} strokeWidth={1.8} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

/**
 * What a coached session asks for, in numbers: time, effort, pace (or sets, reps, load and rest) and how you'll
 * know it worked. One component for onboarding, the plan page, today's session and coach proposals.
 */
export function SessionTargetRows({ targets }: { targets: SessionTargets }) {
  const pace = paceText(targets);
  const lift = liftText(targets);
  return (
    <View testID="session-targets" style={{ gap: 10 }}>
      <Row icon={Clock}>{`${targets.durationMinutes} min`}</Row>
      <Row icon={Gauge}>{targets.effort}</Row>
      {pace && <Row icon={Footprints}>{pace}</Row>}
      {lift && <Row icon={Dumbbell}>{`${targets.exercise ? `${targets.exercise} · ` : ""}${lift}`}</Row>}
      <Row icon={Target}>{targets.progressMeasure}</Row>
    </View>
  );
}
