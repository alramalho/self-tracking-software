import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconButton, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useCurrentUser } from "@/data/queries";
import { coachAvatar } from "@/features/coach/avatar";
import { OnboardingButton } from "@/features/onboarding/interview/OnboardingButton";
import { Orbit } from "@/features/circles/Orbit";
import { ReasonChips, avatarColor } from "@/features/circles/components";
import { defaultPreferences, matchCircle, joinCircle, startCircle } from "@/features/circles/api";
import { takePendingMatch } from "@/features/circles/pendingMatch";
import type { OrbitPerson, PendingMatch } from "@/features/circles/types";

// Shown once the new plan exists: meet the circle that fits, or start one.
export default function CircleMatch() {
  const c = useColors();
  const client = useQueryClient();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const user = useCurrentUser();
  const [pending] = useState<PendingMatch>(
    () => takePendingMatch(planId) ?? { planId, mode: "find", ...defaultPreferences },
  );
  const toPlan = () => router.replace(`/(tabs)/plans?selectedPlan=${planId}` as never);
  // Joining or starting leaves you pending; the circle screen asks for the first photo.
  const openCircle = async (id: string, invite = false) => {
    await client.invalidateQueries();
    router.replace(`/circle/${id}?proof=1${invite ? "&invite=1" : ""}` as never);
  };

  const match = useQuery({
    queryKey: ["circle-match", planId],
    enabled: !!planId && pending.mode === "find",
    staleTime: Infinity,
    queryFn: () => matchCircle(pending),
  });
  const join = useMutation({
    mutationFn: async (circleId: string) => {
      await joinCircle(circleId, planId, pending);
      await openCircle(circleId);
    },
  });
  const start = useMutation({
    mutationFn: async (invite: boolean) => {
      const { id } = await startCircle(planId, pending);
      await openCircle(id, invite);
    },
  });
  // "Invite friends" in onboarding: start the circle, then straight to the share sheet.
  useEffect(() => {
    if (pending.mode === "invite" && start.isIdle) start.mutate(true);
  }, [pending.mode, start]);

  const me: OrbitPerson = {
    key: "me",
    label: user.data?.name ?? user.data?.username ?? "You",
    color: c.accent,
    picture: user.data?.picture,
    isMe: true,
  };
  const found = match.data?.state === "found" ? match.data.circle : null;
  const people: OrbitPerson[] = found
    ? [
        me,
        ...found.members.map((m, i) => ({
          key: `m${i}`,
          label: m.name ?? "?",
          color: avatarColor(m.name ?? String(i)),
          picture: m.picture,
        })),
      ]
    : [me, { key: "e1", label: "", color: "", empty: true }, { key: "e2", label: "", color: "", empty: true }];
  const waiting = match.data?.state === "none" ? match.data.similarPeople : 0;
  const busy = join.isPending || start.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <SafeAreaView edges={["top"]}>
          <Orbit people={people} />
        </SafeAreaView>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16 }}>
        <IconButton label="Not now" icon={X} onPress={toPlan} disabled={busy} />
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 24, paddingTop: 150, paddingBottom: 12, gap: 18 }}>
        <Status loading={match.isLoading || (pending.mode === "invite" && !start.error)} error={match.error ?? join.error ?? start.error} retry={() => void match.refetch()} />
        {found ? (
          <>
            <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, fontWeight: "700", letterSpacing: -0.6, textAlign: "center" }}>
              Meet your circle
            </Text>
            <View style={{ borderRadius: 18, backgroundColor: c.card, padding: 16, gap: 10 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
                {found.emoji} {found.name}
              </Text>
              <ReasonChips reasons={found.reasons} />
            </View>
            <View style={{ borderRadius: 18, backgroundColor: c.card, overflow: "hidden" }}>
              {found.members.map((m, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: c.inputBorder }}>
                  <Text style={{ color: c.muted, fontSize: 15 }}>{m.name}</Text>
                  <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: "500", flexShrink: 1, textAlign: "right" }}>{m.goal}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>
              You're in once you post a photo from a session. They'll see this plan's week and logs, never your location.
            </Text>
          </>
        ) : match.data?.state === "none" ? (
          <>
            <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, fontWeight: "700", letterSpacing: -0.6, textAlign: "center" }}>
              Start your circle
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: c.card, padding: 14 }}>
              <Image source={coachAvatar(user.data?.coachPersonality === "STRATEGIST")} style={{ width: 52, height: 52 }} contentFit="contain" />
              <Text style={{ color: c.text, fontSize: 15, lineHeight: 21, flex: 1 }}>
                {waiting > 0
                  ? `${waiting} ${waiting === 1 ? "person" : "people"} with a similar goal ${waiting === 1 ? "is" : "are"} waiting too. I'll bring you together.`
                  : "No close match yet. I'll bring in people with a similar goal as they join."}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
      {(found || match.data?.state === "none") && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 8 }}>
          <OnboardingButton
            label={found ? "Join" : "Start circle"}
            busy={busy}
            onPress={() => (found ? join.mutate(found.id) : start.mutate(false))}
          />
          <Pressable accessibilityRole="button" onPress={toPlan} disabled={busy} style={{ alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ color: c.muted, fontSize: 16 }}>Not now</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
