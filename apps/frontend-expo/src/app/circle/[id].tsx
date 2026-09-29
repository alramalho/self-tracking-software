import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Camera, ChevronLeft, Flame, MessageCircle, MoreHorizontal, UserPlus } from "lucide-react-native";
import { Copy, Field, Heading, IconButton, Panel, Screen, Sheet, Status, Button, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { goBack } from "@/core/navigation";
import { api, errorMessage } from "@/data/api";
import { useAction, useCurrentUser, usePlans } from "@/data/queries";
import { coachAvatar } from "@/features/coach/avatar";
import { MemberRow, OpenSpots, firstName } from "@/features/circles/components";
import { inviteLink, openCircleChat, skipProof, useCircle, useCircleFeed } from "@/features/circles/api";
import { OnboardingButton } from "@/features/onboarding/interview/OnboardingButton";
import { recapLine } from "@/features/circles/model";
import { FeedCard } from "@/features/timeline/FeedCard";
import type { FeedItem } from "@/features/timeline/types";
import { ReportSheet, personLabel, showActions, useBlockUser } from "@/features/safety/Safety";
import type { ReportTarget } from "@/features/safety/types";
import type { BoardMember } from "@/features/circles/types";

export default function Circle() {
  const c = useColors();
  const { id, invite, proof } = useLocalSearchParams<{ id: string; invite?: string; proof?: string }>();
  const user = useCurrentUser();
  const plans = usePlans();
  const board = useCircle(id);
  const feed = useCircleFeed(id);
  const [report, setReport] = useState<ReportTarget>();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const blockUser = useBlockUser();
  const data = board.data;
  const isOwner = data?.me.role === "OWNER";

  const nudge = useAction(async (member: BoardMember) => api.post(`/circles/${id}/nudges`, { toUserId: member.user.id }));
  const update = useAction(async (changes: { name: string }) => api.patch(`/circles/${id}`, changes));
  const [proofDismissed, setProofDismissed] = useState(false);
  const loggingStarted = useRef(false);
  const openChat = useAction(async () => {
    const { chatId } = await openCircleChat(id);
    router.push(`/chat/${chatId}` as never);
  });
  const leave = useAction(async () => {
    await api.delete(`/circles/${id}/membership`);
    goBack();
  });
  const remove = useAction(async (member: BoardMember) => api.delete(`/circles/${id}/members/${member.user.id}`));

  const shareInvite = () => {
    if (!data) return;
    void Share.share({
      message: `Join my circle "${data.emoji} ${data.name}" on tracking.so: ${inviteLink(data.inviteCode)}`,
    }).catch(() => {});
  };
  // Straight from "Invite friends" in onboarding: open the share sheet once.
  const invited = useRef(false);
  useEffect(() => {
    if (invite && data && !invited.current) {
      invited.current = true;
      shareInvite();
    }
  });

  // Right after joining, leaving without logging counts as "Later", so the coach can remind them.
  const pending = !!data?.me.pending;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => {
      if (proof && pendingRef.current && !loggingStarted.current) void skipProof(id).catch(() => {});
    },
    [id, proof],
  );
  const later = () => {
    loggingStarted.current = true;
    setProofDismissed(true);
    void skipProof(id).catch(() => {});
  };

  const confirmLeave = () =>
    Alert.alert("Leave this circle?", "Your own history stays in your account.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => leave.mutate() },
    ]);

  const memberActions = (member: BoardMember) => {
    const name = firstName(member.user);
    const canNudge = member.week.toGo > 0 && !member.week.isNew && !member.nudgedToday;
    showActions(`${name} · ${member.week.done} of ${member.week.target} this week`, [
      ...(canNudge ? [{ label: `Nudge ${name}`, onPress: () => nudge.mutate(member) }] : []),
      ...(member.user.username ? [{ label: "View profile", onPress: () => router.push(`/profile/${member.user.username}` as never) }] : []),
      { label: `Report ${name}`, destructive: true, onPress: () => setReport({ kind: "USER", id: member.user.id, label: personLabel(member.user) }) },
      { label: `Block ${name}`, destructive: true, onPress: () => blockUser(member.user) },
      ...(isOwner ? [{ label: `Remove ${name} from the circle`, destructive: true, onPress: () => remove.mutate(member) }] : []),
    ]);
  };

  const circleActions = () => {
    if (!data) return;
    showActions(`${data.emoji} ${data.name}`, [
      { label: "Invite friends", onPress: shareInvite },
      ...(isOwner ? [{ label: "Rename", onPress: () => { setName(data.name); setRenaming(true); } }] : []),
      { label: "Report circle", destructive: true, onPress: () => setReport({ kind: "CIRCLE", id: data.id, label: "this circle" }) },
      { label: "Leave circle", destructive: true, onPress: confirmLeave },
    ]);
  };

  const myPlan = plans.data?.find((p) => p.id === data?.me.planId);
  const logActivityId = myPlan?.activities?.[0]?.id;
  const introIds = new Set(feed.data?.introIds ?? []);
  const items: FeedItem[] = (feed.data?.entries ?? []).map((entry) => ({
    id: entry.id,
    date: new Date(entry.datetime).getTime(),
    entry,
    user: entry.user as FeedItem["user"],
    activity: (entry.activity ?? undefined) as FeedItem["activity"],
  }));
  const forming = data?.status === "FORMING";
  const daysLeft = data?.members.find((m) => m.user.id === user.data?.id)?.week.daysLeft;
  const sub = data
    ? [`${data.members.length} of ${data.cap}`, data.place, data.paceLabel].filter(Boolean).join(" · ")
    : "";

  const logWithPhoto = () => {
    loggingStarted.current = true;
    router.push((logActivityId ? `/(tabs)/add?activityId=${logActivityId}` : "/(tabs)/add") as never);
  };
  // One main action: the circle chat for members, the first photo while pending.
  const footer = data ? (
    data.me.pending ? (
      <OnboardingButton label="Log with a photo" icon={Camera} onPress={logWithPhoto} />
    ) : (
      <OnboardingButton label="Circle chat" icon={MessageCircle} busy={openChat.isPending} onPress={() => openChat.mutate()} />
    )
  ) : undefined;

  return (
    <Screen
      footer={footer}
      title={data ? `${data.emoji} ${data.name}` : "Circle"}
      subtitle={sub}
      leading={<IconButton label="Back" icon={ChevronLeft} onPress={goBack} />}
      actions={data && <IconButton label="Circle options" icon={MoreHorizontal} onPress={circleActions} />}
      refreshing={board.isRefetching}
      onRefresh={() => void Promise.all([board.refetch(), feed.refetch()])}
    >
      <Status
        loading={board.isLoading}
        error={board.error ?? nudge.error ?? update.error ?? leave.error ?? remove.error ?? openChat.error}
        retry={() => void board.refetch()}
      />
      {data && (
        <>
          {data.me.pending && !proofDismissed && (
            <Panel style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image source={coachAvatar(user.data?.coachPersonality === "STRATEGIST")} style={{ width: 52, height: 52 }} contentFit="contain" />
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>You're almost in</Text>
                <Copy muted>Post a photo from a session to join. Members see you once it's up, and it's your intro.</Copy>
                <Pressable accessibilityRole="button" onPress={later} style={{ alignItems: "center", paddingVertical: 6 }}>
                  <Text style={{ color: c.muted, fontSize: 15 }}>Later</Text>
                </Pressable>
              </View>
            </Panel>
          )}

          {forming ? (
            <Panel>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>Forming</Text>
              <Copy muted>The weekly board starts once 2 people have posted their first photo.</Copy>
              {data.members.map((m) => (
                <MemberRow key={m.user.id} member={{ ...m, week: { ...m.week, isNew: true } }} isMe={m.user.id === user.data?.id} onPress={m.user.id === user.data?.id ? undefined : () => memberActions(m)} />
              ))}
              <OpenSpots members={data.members.length} />
            </Panel>
          ) : (
            <>
              {data.togetherStreak > 0 && (
                <Panel style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Flame size={26} color="#ff9500" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
                      {data.togetherStreak === 1 ? "1 week together" : `${data.togetherStreak} weeks together`}
                    </Text>
                    <Copy muted>Everyone hit their week</Copy>
                  </View>
                </Panel>
              )}
              <Panel>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>This week</Text>
                  {daysLeft !== undefined && <Copy muted>{daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}</Copy>}
                </View>
                {data.members.map((m) => {
                  const isMe = m.user.id === user.data?.id;
                  return (
                    <MemberRow
                      key={m.user.id}
                      member={m}
                      isMe={isMe}
                      onPress={isMe ? undefined : () => memberActions(m)}
                      onNudge={!isMe && m.week.behind && !m.nudgedToday ? () => nudge.mutate(m) : undefined}
                    />
                  );
                })}
                <OpenSpots members={data.members.length} />
              </Panel>
              {data.recap && (
                <Panel style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Image source={coachAvatar(user.data?.coachPersonality === "STRATEGIST")} style={{ width: 44, height: 44 }} contentFit="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Last week</Text>
                    <Copy muted>{recapLine(data.recap, data.togetherStreak)}</Copy>
                  </View>
                </Panel>
              )}
            </>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={shareInvite}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
          >
            <UserPlus size={22} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16 }}>Invite friends</Text>
              <Copy muted>{`${data.members.length} of ${data.cap} spots used`}</Copy>
            </View>
          </Pressable>

          <Heading>Latest</Heading>
          <Status loading={feed.isLoading} error={feed.error} empty={!feed.isLoading && !items.length ? "No sessions yet. Yours could be the first." : undefined} />
          {items.map((item) => (
            <View key={item.id} style={{ gap: 6 }}>
              {introIds.has(item.id) && (
                <Text style={{ color: c.muted, fontSize: 13 }}>👋 Intro</Text>
              )}
              <FeedCard item={item} />
            </View>
          ))}
        </>
      )}
      <Sheet visible={renaming} title="Rename circle" onClose={() => setRenaming(false)}>
        <Field label="Name" value={name} onChangeText={setName} maxLength={60} autoFocus />
        <Button
          busy={update.isPending}
          disabled={!name.trim()}
          onPress={() =>
            update.mutate({ name: name.trim() }, {
              onSuccess: () => setRenaming(false),
              onError: (error) => Alert.alert("Couldn't rename", errorMessage(error)),
            })
          }
        >
          Save
        </Button>
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(undefined)} />
    </Screen>
  );
}
