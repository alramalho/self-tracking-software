import { useState } from "react";
import { Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, Copy, Heading, IconButton, Panel, Screen, Status } from "@/components/ui";
import { goBack } from "@/core/navigation";
import { useAction, useCurrentUser, useEntries, usePlans } from "@/data/queries";
import { api } from "@/data/api";
import type { CircleDetail } from "@/features/circles/types";
export default function Circle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser(), plans = usePlans(), entries = useEntries();
  const query = useQuery({ queryKey: ["circle", id], queryFn: async () => (await api.get<CircleDetail>(`/circles/${id}`)).data });
  const [sharing, setSharing] = useState(false), [leaving, setLeaving] = useState(false), [error, setError] = useState<unknown>();
  const share = useAction(async (entryId: string) => { await api.post(`/circles/${id}/logs`, { entryId }); setSharing(false); });
  const unshare = useAction(async (postId: string) => api.delete(`/circles/${id}/logs/${postId}`));
  const leave = useAction(async () => { await api.delete(`/circles/${id}/membership`); router.replace("/circles" as never); });
  const membership = query.data?.members.find(m => m.user.id === user.data?.id);
  const plan = plans.data?.find(p => p.id === membership?.plan.id);
  const logs = entries.data?.filter(e => !e.deletedAt && plan?.activities.some(a => a.id === e.activityId) && !query.data?.posts.some(p => p.entry.id === e.id)).slice(0, 30) ?? [];
  return <Screen title={query.data?.name || "Circle"} leading={<IconButton label="Back" icon={ArrowLeft} onPress={goBack} />} onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
    <Status loading={query.isLoading} error={query.error ?? share.error ?? unshare.error ?? leave.error ?? error} />
    {query.data && <>
      <Copy muted>{query.data.topic}</Copy>
      <Button secondary onPress={() => void Share.share({ message: `Join ${query.data!.name} in tracking.so. Open Plans → Circles and paste this invite code: ${query.data!.inviteCode}` }).catch(setError)}>Share invite</Button>
      <Heading>People and their plans</Heading>
      {query.data.members.map(member => <Panel key={member.user.id}><Copy>{`${member.user.name || member.user.username} · ${member.plan.emoji} ${member.plan.goal}`}</Copy></Panel>)}
      <Button onPress={() => setSharing(!sharing)}>{sharing ? "Cancel sharing" : "Share an activity log"}</Button>
      {sharing && <><Copy muted>Only the activity, quantity and date are shared here. Photos, location and private notes stay out.</Copy>{logs.map(log => <Button key={log.id} secondary busy={share.isPending} onPress={() => share.mutate(log.id)}>{`${log.activity?.emoji || plan?.emoji || ""} ${log.activity?.title || "Activity"} · ${log.quantity} ${log.activity?.measure || ""} · ${new Date(log.datetime).toLocaleDateString()}`}</Button>)}{!logs.length && <Copy muted>No unshared logs from your chosen plan yet.</Copy>}</>}
      <Heading>Shared progress</Heading>
      {query.data.posts.map(post => <Panel key={post.id}><Copy>{post.user.name || post.user.username || "Member"}</Copy><Heading>{`${post.entry.activity?.emoji || ""} ${post.entry.activity?.title || "Activity"}`}</Heading><Copy>{`${post.entry.quantity} ${post.entry.activity?.measure || ""} · ${new Date(post.entry.datetime).toLocaleDateString()}`}</Copy>{post.user.id === user.data?.id && <Button secondary busy={unshare.isPending} onPress={() => unshare.mutate(post.id)}>Remove from circle</Button>}</Panel>)}
      {!query.data.posts.length && <Copy muted>No shared logs yet. Share something when you want to.</Copy>}
      {leaving && <Copy>Leave this circle? Your posts will be removed from the circle. Your activity history stays in your account.</Copy>}
      <Button danger busy={leave.isPending} onPress={() => leaving ? leave.mutate() : setLeaving(true)}>{leaving ? "Confirm leave circle" : "Leave circle"}</Button>
      {leaving && <Button secondary onPress={() => setLeaving(false)}>Cancel</Button>}
    </>}
  </Screen>;
}
