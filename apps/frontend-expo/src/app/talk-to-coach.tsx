import { useLocalSearchParams } from "expo-router";
import { TalkToCoach } from "@/features/coach/talk/TalkToCoach";
import type { TalkReason } from "@/features/coach/talk/types";

export default function TalkToCoachRoute() {
  const { planId, reason, missed } = useLocalSearchParams<{ planId: string; reason?: TalkReason; missed?: string }>();
  return <TalkToCoach planId={planId} reason={reason ?? "talk"} missed={missed === "1"} />;
}
