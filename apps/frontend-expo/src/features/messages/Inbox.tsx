import { IconButton } from "./IconButton";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronRight, Search } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Copy,
  Field,
  Screen,
  Status,
  s,
  useColors,
} from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { api } from "@/data/api";
import { useCurrentUser, usePlans } from "@/data/queries";
import { goBack } from "@/core/navigation";
import type { Person } from "@/core/types";
import type { Chat, Coach } from "./types";
import { getChats, createCoachChat, chatTitle } from "./service";
import { coachIdentity } from "./coach";

export function Inbox() {
  const c = useColors();
  const client = useQueryClient();
  const { prompt } = useLocalSearchParams<{ prompt?: string | string[] }>();
  const user = useCurrentUser();
  const plans = usePlans();
  const [search, setSearch] = useState("");
  const chats = useQuery({
    queryKey: ["chats"],
    queryFn: getChats,
    refetchOnMount: "always",
  });
  const coaches = useQuery({
    queryKey: ["human-coaches"],
    queryFn: async () => (await api.get<Coach[]>("/coaches")).data,
  });
  const people = useQuery({
    queryKey: ["message-search", search.trim()],
    enabled: search.trim().length >= 2,
    queryFn: async () =>
      (
        await api.get<Person[]>(
          `/users/search-users/${encodeURIComponent(search.trim())}`,
        )
      ).data,
  });
  const openCoach = useMutation({
    mutationFn: async () => {
      const existing = chats.data
        ?.filter((chat) => chat.type === "COACH")
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
      const chat = existing ?? (await createCoachChat());
      await client.invalidateQueries({ queryKey: ["chats"] });
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: chat.id,
          type: "COACH",
          ...(prompt
            ? { prompt: Array.isArray(prompt) ? prompt[0] : prompt }
            : {}),
        },
      });
    },
  });
  const direct = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post<{ chat: Chat }>("/chats/direct", {
        userId,
      });
      await client.invalidateQueries({ queryKey: ["chats"] });
      router.push(`/chat/${data.chat.id}`);
    },
  });
  const identity = coachIdentity(user.data?.coachPersonality);
  const pinned = (coaches.data ?? []).filter((coach) =>
    plans.data?.some((p) => p.coachId === coach.id),
  );
  const seen = new Set<string>();
  const otherChats = [...(chats.data ?? [])]
    .filter((chat) => chat.type !== "COACH")
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .filter((chat) => {
      if (chat.type !== "DIRECT") return true;
      const person = chat.participants?.find((p) => p.userId !== user.data?.id);
      if (
        !person ||
        seen.has(person.userId) ||
        pinned.some((c) => c.ownerId === person.userId)
      )
        return false;
      seen.add(person.userId);
      return true;
    });
  const unread =
    chats.data
      ?.filter((chat) => chat.type === "COACH")
      .reduce((n, chat) => n + (chat.unreadCount ?? 0), 0) ?? 0;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen
        title="Messages"
        refreshing={chats.isRefetching}
        onRefresh={() => void chats.refetch()}
        actions={
          <IconButton label="Back" onPress={() => goBack()}>
            <ArrowLeft color={c.text} size={24} />
          </IconButton>
        }
      >
        <Field
          label="Search conversations"
          placeholder="Search for someone…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        <Status
          loading={chats.isPending}
          error={chats.error ?? openCoach.error ?? direct.error}
          retry={() => void chats.refetch()}
        />
        {search.trim().length >= 2 ? (
          <>
            <Status loading={people.isPending} error={people.error} />
            {people.data?.map((person) => (
              <Button
                secondary
                key={person.id}
                busy={direct.isPending}
                onPress={() => direct.mutate(person.id)}
              >
                {person.name || person.username || "Member"}
              </Button>
            ))}
          </>
        ) : (
          <>
            {pinned.map((coach) => (
              <Pressable
                key={coach.id}
                accessibilityRole="button"
                onPress={() => direct.mutate(coach.ownerId)}
                style={[
                  s.row,
                  { padding: 16, borderRadius: 24, backgroundColor: c.card },
                ]}
              >
                <Image
                  source={{ uri: coach.owner.picture }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
                <View style={{ flex: 1 }}>
                  <Copy>
                    {coach.owner.name || coach.owner.username} · Coach
                  </Copy>
                  <Copy muted>
                    {plans.data?.find((p) => p.coachId === coach.id)?.goal}
                  </Copy>
                </View>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Message ${identity.name}, AI Coach`}
              disabled={openCoach.isPending || chats.isPending}
              onPress={() => openCoach.mutate()}
              style={[
                s.row,
                {
                  borderRadius: 24,
                  padding: 16,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                },
              ]}
            >
              <Image
                source={{ uri: identity.avatar }}
                style={{ width: 48, height: 48 }}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{ color: c.text, fontSize: 16, fontWeight: "600" }}
                >
                  {identity.name}{" "}
                  <Text style={{ color: c.muted, fontSize: 12 }}>AI</Text>
                </Text>
                <Copy muted>Your AI assistant</Copy>
              </View>
              {unread > 0 && (
                <Text
                  style={{
                    color: "white",
                    backgroundColor: c.accent,
                    borderRadius: 12,
                    padding: 5,
                  }}
                >
                  {unread}
                </Text>
              )}
              <ChevronRight color={c.muted} size={18} />
            </Pressable>
            {otherChats.map((chat) => {
              const person = chat.participants?.find(
                (p) => p.userId !== user.data?.id,
              );
              return (
                <Pressable
                  key={chat.id}
                  accessibilityRole="button"
                  accessibilityLabel={chatTitle(chat, user.data?.id)}
                  onPress={() => router.push(`/chat/${chat.id}`)}
                  style={[
                    s.row,
                    {
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: c.soft,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {person?.picture ? (
                      <Image
                        source={{ uri: person.picture }}
                        style={{ width: 44, height: 44 }}
                      />
                    ) : (
                      <Copy>{chatTitle(chat, user.data?.id).slice(0, 1)}</Copy>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Copy>{chatTitle(chat, user.data?.id)}</Copy>
                    <Text numberOfLines={1} style={{ color: c.muted }}>
                      {chat.lastMessage?.content || "Start a conversation"}
                    </Text>
                  </View>
                  {!!chat.unreadCount && <Copy>{chat.unreadCount}</Copy>}
                </Pressable>
              );
            })}
            {!otherChats.length && (
              <Copy muted>
                Search for someone above to start a conversation
              </Copy>
            )}
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
