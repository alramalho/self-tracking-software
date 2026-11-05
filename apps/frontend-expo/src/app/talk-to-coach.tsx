import { useLocalSearchParams } from "expo-router";
import { TalkToCoach } from "@/features/coach/talk/TalkToCoach";
import type { TalkReason } from "@/features/coach/talk/types";

export default function TalkToCoachRoute() {
  const { planId, reason } = useLocalSearchParams<{ planId: string; reason?: TalkReason }>();
  return <TalkToCoach planId={planId} reason={reason ?? "talk"} />;
}
