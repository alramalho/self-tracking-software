import { useState } from "react";
import { Switch, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, Copy, Field, Heading, IconButton, Panel, Screen, Status } from "@/components/ui";
import { goBack } from "@/core/navigation";
import { useAction, usePlans } from "@/data/queries";
import { api } from "@/data/api";
import type { CircleList } from "@/features/circles/types";
export default function Circles() {
  const plans = usePlans();
  const [search, setSearch] = useState(""), [name, setName] = useState(""), [topic, setTopic] = useState(""), [planId, setPlanId] = useState(""), [code, setCode] = useState("");
  const [creating, setCreating] = useState(false), [discoverable, setDiscoverable] = useState(false);
  const [joinId, setJoinId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["circles", search], queryFn: async () => (await api.get<CircleList>("/circles", { params: { search } })).data });
  const join = useAction(async () => { const { data } = await api.post<{ id: string }>("/circles/join", { planId, ...(code.trim() ? { inviteCode: code.trim() } : { id: joinId }) }); router.push(`/circle/${data.id}` as never); setJoinId(null); });
  const create = useAction(async () => { const { data } = await api.post<{ id: string }>("/circles", { name, topic, planId, discoverable }); setCreating(false); router.push(`/circle/${data.id}` as never); });
  const chooser = <>{plans.data?.filter(p => !p.archivedAt && !p.deletedAt).map(plan => <Button key={plan.id} secondary={planId !== plan.id} onPress={() => setPlanId(plan.id)}>{`${plan.emoji} ${plan.goal}`}</Button>)}<Copy muted>Members see your name and this plan’s title. Share individual activity logs when you choose. No automatic sharing, missed-session scores or private notes.</Copy></>;
  return <Screen title="Circles" leading={<IconButton label="Back" icon={ArrowLeft} onPress={goBack} />}>
    <Copy muted>A small group of people making room for similar things. Everyone keeps their own plan.</Copy>
    <Status loading={query.isLoading} error={query.error ?? join.error ?? create.error} />
    {!!query.data?.mine.length && <Heading>Your circles</Heading>}
    {query.data?.mine.map(circle => <Panel key={circle.id}><Heading>{circle.name}</Heading><Copy muted>{`${circle.topic} · ${circle._count.members}/12 people`}</Copy><Button secondary onPress={() => router.push(`/circle/${circle.id}` as never)}>Open circle</Button></Panel>)}
    <Field label="Find a circle" value={search} onChangeText={setSearch} placeholder="Guitar, running, studying…" />
    {query.data?.discover.map(circle => <Panel key={circle.id}><Heading>{circle.name}</Heading><Copy muted>{`${circle.topic} · ${circle._count.members}/12 people`}</Copy><Button secondary disabled={circle._count.members >= 12} onPress={() => { setCreating(false); setCode(""); setJoinId(circle.id); }}>Choose a plan to join with</Button>{joinId === circle.id && <>{chooser}<Button disabled={!planId} busy={join.isPending} onPress={() => join.mutate()}>Join this circle</Button><Button secondary onPress={() => setJoinId(null)}>Cancel</Button></>}</Panel>)}
    {query.data && !query.data.discover.length && <Copy muted>No matching public circles yet. Create one or use an invite code.</Copy>}
    <Field label="Have an invite code?" value={code} onChangeText={value => { setCode(value); setJoinId(null); }} autoCapitalize="none" />
    {!!code && <>{chooser}<Button disabled={!planId} busy={join.isPending} onPress={() => join.mutate()}>Join with invite</Button></>}
    <Button secondary onPress={() => { setCreating(!creating); setJoinId(null); }}>{creating ? "Cancel creating circle" : "Create a circle"}</Button>
    {creating && <Panel><Field label="Circle name" value={name} onChangeText={setName} /><Field label="Shared interest" value={topic} onChangeText={setTopic} />{chooser}<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Copy>Let people discover this circle</Copy><Switch accessibilityLabel="Public circle discovery" value={discoverable} onValueChange={setDiscoverable} /></View><Copy muted>{discoverable ? "Anyone can find its name and topic and choose to join." : "Only people with your invite code can join."}</Copy><Button disabled={!name.trim() || !topic.trim() || !planId} busy={create.isPending} onPress={() => create.mutate()}>Create circle</Button></Panel>}
  </Screen>;
}
