import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/data/api";
import { useCurrentUser } from "@/data/queries";
import {
  Button,
  Copy,
  Heading,
  Panel,
  Status,
  s,
  useColors,
} from "@/components/ui";
import type { Chat, Message } from "@/features/social/types";
import type { CoachOverviewProps } from "./types";
import { Markdown } from "@/features/messages/Markdown";
import { WeekCalendar } from "./WeekCalendar";

export function CoachOverview({ plans, entries }: CoachOverviewProps) {
  const [expanded, setExpanded] = useState(false);
  const c = useColors();
  const user = useCurrentUser();
  const active = plans.filter(
    (plan) =>
      !plan.archivedAt &&
      !plan.deletedAt &&
      (!plan.finishingDate || new Date(plan.finishingDate) > new Date()),
  );
  const chats = useQuery({
    queryKey: ["chats"],
    enabled: active.length > 0,
    queryFn: async () =>
      (await api.get<{ chats: Chat[] }>("/chats")).data.chats,
  });
  const chat = chats.data
    ?.filter((chat) => chat.type === "COACH")
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime(),
    )[0];
  const messages = useQuery({
    queryKey: ["coach-plans-overview-messages", chat?.id],
    enabled: !!chat,
    staleTime: 60000,
    queryFn: async () =>
      (
        await api.get<{ messages: Message[] }>(`/chats/${chat!.id}/messages`, {
          params: { includeCoachHistory: true },
        })
      ).data.messages,
  });
  const assessments =
    messages.data
      ?.filter(
        (message) =>
          message.role === "COACH" && message.source === "autonomous_coach",
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ) ?? [];
  const latest = assessments.at(-1);
  const recent = latest
    ? assessments.filter(
        (message) =>
          new Date(latest.createdAt).getTime() -
            new Date(message.createdAt).getTime() <=
          600000,
      )
    : [];
  const strategist = user.data?.coachPersonality === "STRATEGIST";
  if (!active.length) return null;
  return (
    <Panel testID="coach-overview" style={{ padding: 16, gap: 20 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Coach overview"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={[s.row, { justifyContent: "space-between" }]}
      >
        <View style={s.row}>
          <Sparkles size={20} color={c.text} />
          <Heading>Coach overview</Heading>
        </View>
        {expanded ? (
          <ChevronUp size={20} color={c.muted} />
        ) : (
          <ChevronDown size={20} color={c.muted} />
        )}
      </Pressable>
      {expanded && (
        <>
          <View style={{ gap: 12 }}>
            <View style={s.row}>
              <Sparkles size={12} color={c.text} />
              <Copy>{strategist ? "Oli" : "Helly"} assessment</Copy>
            </View>
            <Status
              loading={chats.isPending || (!!chat && messages.isPending)}
              error={chats.error ?? messages.error}
              retry={() => {
                void chats.refetch();
                if (chat) void messages.refetch();
              }}
            />
            {recent.length ? (
              <View style={{ gap: 12 }}>
                <Image
                  source={
                    strategist
                      ? require("../../../assets/coaches/oli.png")
                      : require("../../../assets/coaches/helly.png")
                  }
                  style={{ width: 48, height: 48 }}
                  resizeMode="contain"
                />
                {recent.map((message) => (
                  <View
                    key={message.id}
                    style={{
                      borderRadius: 16,
                      padding: 12,
                      gap: 8,
                      backgroundColor: c.soft,
                    }}
                  >
                    <Markdown message={message}>{message.content}</Markdown>
                    <Copy muted>
                      {formatDistanceToNow(new Date(message.createdAt), {
                        addSuffix: true,
                      })}
                    </Copy>
                  </View>
                ))}
                <Button
                  secondary
                  onPress={() => router.push(`/chat/${chat!.id}`)}
                >
                  Open coach conversation
                </Button>
              </View>
            ) : (
              !chats.isPending &&
              !messages.isFetching &&
              !chats.error &&
              !messages.error && (
                <View
                  style={{
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: c.border,
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <Copy muted>No coach assessment yet.</Copy>
                </View>
              )
            )}
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderColor: c.border,
              paddingTop: 16,
              gap: 14,
            }}
          >
            <View style={s.row}>
              <CalendarDays size={16} color={c.muted} />
              <Copy>This week / next week</Copy>
            </View>
            <WeekCalendar
              plans={active}
              entries={entries}
              selectionDisplay="card"
            />
          </View>
        </>
      )}
    </Panel>
  );
}
