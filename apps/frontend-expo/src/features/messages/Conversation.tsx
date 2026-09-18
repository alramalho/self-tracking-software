import { useReducedMotion } from "react-native-reanimated";
import { IconButton } from "./IconButton";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  EllipsisVertical,
  ImagePlus,
  X,
  Eye,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COACH_CONVERSATION_STARTER_IDS,
  getCoachConversationStarter,
  type CoachConversationStarterId,
} from "@tsw/prisma/coach-conversation-starters";
import { Button, Copy, Sheet, Status, s, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { api } from "@/data/api";
import { DictationButton } from "@/features/dictation/DictationButton";
import { appendDictationText } from "@/features/dictation/VoiceTextArea";
import {
  useCurrentUser,
  usePlans,
  useActivities,
  useEntries,
  useMetrics,
} from "@/data/queries";
import { CoachSettings } from "./CoachSettings";
import { MessageCard } from "./MessageCard";
import {
  chatTitle,
  createCoachChat,
  getChats,
  getMessages,
  sendMessage,
} from "./service";
import { coachIdentity } from "./coach";
import type {
  ConversationProps,
  ImageAttachment,
  Message,
  ResponseState,
  CoachAttentionItem,
} from "./types";

export function Conversation({ id }: ConversationProps) {
  const c = useColors();
  const focused = useIsFocused();
  const client = useQueryClient();
  const user = useCurrentUser();
  const params = useLocalSearchParams<{ type?: string; prompt?: string }>();
  const chats = useQuery({ queryKey: ["chats"], queryFn: getChats });
  const chat = chats.data?.find((chat) => chat.id === id);
  const coach = chat?.type === "COACH" || params.type === "COACH";
  const identity = coachIdentity(user.data?.coachPersonality);
  const query = useQuery({
    queryKey: ["messages", id, coach],
    enabled: focused && (!!chat || coach),
    queryFn: () => getMessages(id, coach),
    refetchInterval: 10000,
  });
  const response = useQuery({
    queryKey: ["coach-response", id],
    enabled: focused && coach,
    queryFn: async () =>
      (
        await api.get<{ status: ResponseState | null }>(
          `/chats/${id}/coach-response-status`,
        )
      ).data.status,
    refetchInterval: 2000,
  });
  const attention = useQuery({
    queryKey: ["coach-attention"],
    enabled: focused && coach,
    queryFn: async () =>
      (
        await api.get<{ attentionItems: CoachAttentionItem[] }>(
          "/ai/coach/attention",
        )
      ).data.attentionItems,
  });
  const plans = usePlans();
  const activities = useActivities();
  const entries = useEntries();
  const metrics = useMetrics();
  const [text, setText] = useState(params.prompt ?? "");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [editing, setEditing] = useState<Message | null>(null);
  const [starter, setStarter] = useState<CoachConversationStarterId>();
  const [progress, setProgress] = useState<ResponseState["status"] | null>(
    null,
  );
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState(false);
  const [context, setContext] = useState(false);
  const [clear, setClear] = useState(false);
  const [attachmentError, setAttachmentError] = useState<unknown>();
  const [picking, setPicking] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const nearBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const reducedMotion = useReducedMotion();
  const [inputHeight, setInputHeight] = useState(44);
  const read = useRef(new Set<string>());
  const [pending, setPending] = useState<Message | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      nearBottom.current = true;
      const content = text.trim();
      const source = editing;
      const attachments = images;
      setText("");
      setImages([]);
      setProgress(coach ? "thinking" : null);
      setPending({
        id: "pending-message",
        role: "USER",
        senderId: user.data?.id,
        content,
        imageAttachments: images,
        createdAt: new Date().toISOString(),
      });
      try {
        await sendMessage(
          {
            chatId: source?.chatId || id,
            message: content,
            imageAttachments: attachments,
            coachStarterId: starter,
            rewriteId: source?.id,
            coach,
          },
          setProgress,
        );
        setEditing(null);
        setStarter(undefined);
        await query.refetch();
        await client.invalidateQueries({ queryKey: ["chats"] });
      } catch (error) {
        setText((current) => (current ? `${content}\n\n${current}` : content));
        setImages((current) => (current.length ? current : attachments));
        throw error;
      } finally {
        setProgress(null);
        setPending(null);
        await query.refetch();
      }
    },
  });
  const action = useMutation({
    mutationFn: async (kind: "new" | "assess" | "clear") => {
      if (kind === "new") {
        const next = await createCoachChat();
        router.replace({
          pathname: "/chat/[id]",
          params: { id: next.id, type: "COACH" },
        });
      }
      if (kind === "assess")
        await api.post("/ai/coach/run-assessment", undefined, {
          timeout: 300000,
        });
      if (kind === "clear") {
        await api.delete("/ai/coach/history");
        const next = await createCoachChat();
        router.replace({
          pathname: "/chat/[id]",
          params: { id: next.id, type: "COACH" },
        });
      }
      setMenu(false);
      setClear(false);
      await client.invalidateQueries();
    },
  });
  const activeStatus = progress ?? response.data?.status;
  const remoteBusy =
    response.data &&
    response.data.status !== "error" &&
    new Date(response.data.timeoutAt).getTime() > Date.now();
  const busy = mutation.isPending || !!remoteBusy;
  const messages = [...(query.data ?? [])];
  if (starter)
    messages.push({
      id: "starter",
      role: "COACH",
      content: getCoachConversationStarter(
        starter,
        user.data?.name?.split(" ")[0] || "there",
      ),
      createdAt: new Date().toISOString(),
    });
  if (
    pending &&
    !messages.some(
      (m) =>
        m.role === "USER" &&
        m.content === pending.content &&
        +new Date(m.createdAt) > +new Date(pending.createdAt) - 2000,
    )
  )
    messages.push(pending);
  // Keep the composer outside the list and preserve the position while reading history.
  const visibleMessages = messages.filter(
    (m) => m.role !== "SYSTEM" || !!m.coachAttentionItems?.length,
  );
  const viewer = useRef({ id, userId: user.data?.id, coach });
  viewer.current = { id, userId: user.data?.id, coach };
  const markVisible = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<Message>[] }) => {
      const groups = new Map<string, string[]>();
      for (const { item } of viewableItems) {
        const own = viewer.current.coach
          ? item.role === "USER"
          : item.senderId === viewer.current.userId;
        if (own || item.status !== "SENT" || read.current.has(item.id))
          continue;
        read.current.add(item.id);
        const chatId = item.chatId || viewer.current.id;
        groups.set(chatId, [...(groups.get(chatId) ?? []), item.id]);
      }
      for (const [chatId, messageIds] of groups)
        void api
          .post(`/chats/${chatId}/messages/mark-read`, { messageIds })
          .then(() => client.invalidateQueries({ queryKey: ["chats"] }))
          .catch(() =>
            messageIds.forEach((messageId) => read.current.delete(messageId)),
          );
    },
  ).current;
  useEffect(() => {
    read.current.clear();
    setText(params.prompt ?? "");
    setImages([]);
    setEditing(null);
    setStarter(undefined);
  }, [id]);
  async function pickImages() {
    setPicking(true);
    setAttachmentError(undefined);
    try {
      if (images.length >= 4) throw new Error("Attach up to 4 images");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 4 - images.length,
        base64: true,
        quality: 0.6,
      });
      if (result.canceled) return;
      const next = result.assets.map((asset) => {
        if (!asset.base64)
          throw new Error("Could not read this photo. Please choose another.");
        const mediaType =
          Platform.OS === "web" ? asset.mimeType || "image/jpeg" : "image/jpeg";
        const url = `data:${mediaType};base64,${asset.base64}`;
        if (url.length > 1600000)
          throw new Error(
            "This photo is too large. Please choose a smaller image.",
          );
        return {
          id: asset.assetId || asset.uri,
          url,
          mediaType,
          filename: asset.fileName || "image.jpg",
        };
      });
      if (images.length + next.length > 4)
        throw new Error("Attach up to 4 images");
      setImages((previous) => [...previous, ...next]);
    } catch (error) {
      setAttachmentError(error);
    } finally {
      setPicking(false);
    }
  }
  const label = {
    thinking: "Thinking…",
    searching: "Searching the web…",
    browsing: "Browsing the web (might take a minute)…",
    drafting: "Drafting…",
    error: "Unable to complete the response",
  }[activeStatus || "thinking"];
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.bg }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            s.row,
            {
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
          ]}
        >
          <IconButton
            label="Back to messages"
            onPress={() => {
              Keyboard.dismiss();
              router.dismissTo("/messages");
            }}
          >
            <ArrowLeft color={c.text} size={20} />
          </IconButton>
          <Pressable
            accessible={coach}
            accessibilityRole={coach ? "button" : undefined}
            accessibilityLabel={
              coach ? `${identity.name} coach settings` : undefined
            }
            disabled={!coach}
            onPress={() => setSettings(true)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            {coach && (
              <Image
                source={{ uri: identity.avatar }}
                style={{ width: 40, height: 40 }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
                {coach
                  ? identity.name
                  : chat
                    ? chatTitle(chat, user.data?.id)
                    : "Conversation"}
              </Text>
              {coach && (
                <Text style={{ color: c.muted, fontSize: 12 }}>AI Coach</Text>
              )}
            </View>
          </Pressable>
          {coach && (
            <>
              <IconButton
                label={`What ${identity.name} can see`}
                onPress={() => setContext(true)}
              >
                <Eye size={18} color={c.text} />
              </IconButton>
              <IconButton
                label="Conversation options"
                onPress={() => setMenu(true)}
              >
                <EllipsisVertical size={18} color={c.text} />
              </IconButton>
            </>
          )}
        </View>
        <Status
          loading={chats.isPending || query.isPending}
          error={chats.error ?? query.error}
          retry={() => {
            void chats.refetch();
            void query.refetch();
          }}
        />
        <View style={{ flex: 1 }}>
          <FlatList
            ref={list}
            testID="conversation-messages"
            style={{ flex: 1 }}
            onLayout={() => {
              if (nearBottom.current)
                requestAnimationFrame(() =>
                  list.current?.scrollToEnd({ animated: false }),
                );
            }}
            data={visibleMessages}
            onContentSizeChange={() => {
              if (nearBottom.current)
                list.current?.scrollToEnd({ animated: false });
            }}
            onScroll={({ nativeEvent: e }) => {
              nearBottom.current =
                e.contentSize.height -
                  e.layoutMeasurement.height -
                  e.contentOffset.y <
                100;
              setShowLatest(!nearBottom.current);
            }}
            scrollEventThrottle={100}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              gap: 16,
            }}
            onViewableItemsChanged={markVisible}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 60,
              minimumViewTime: 600,
            }}
            refreshControl={
              <RefreshControl
                refreshing={query.isRefetching}
                onRefresh={() => void query.refetch()}
                tintColor={c.accent}
              />
            }
            renderItem={({ item, index }) => (
              <View style={{ gap: 14 }}>
                {(!visibleMessages[index - 1] ||
                  new Date(
                    visibleMessages[index - 1].createdAt,
                  ).toDateString() !==
                    new Date(item.createdAt).toDateString()) && (
                  <Text
                    style={{
                      textAlign: "center",
                      color: c.muted,
                      fontSize: 12,
                    }}
                  >
                    {new Date(item.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                )}
                <MessageCard
                  message={item}
                  own={
                    coach
                      ? item.role === "USER"
                      : item.senderId === user.data?.id
                  }
                  coach={coach}
                  onEdit={(m) => {
                    setEditing(m);
                    setText(m.content);
                    setImages([]);
                  }}
                  onPrompt={setText}
                />
              </View>
            )}
          />
          {showLatest && (
            <View
              style={{
                position: "absolute",
                bottom: 12,
                left: "50%",
                marginLeft: -22,
                borderRadius: 22,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.inputBorder,
                shadowColor: "#000",
                shadowOpacity: c.dark ? 0.25 : 0.12,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <IconButton
                label="Scroll to latest message"
                onPress={() =>
                  list.current?.scrollToEnd({ animated: !reducedMotion })
                }
              >
                <ArrowDown size={22} color={c.text} />
              </IconButton>
            </View>
          )}
        </View>
        {coach && !query.isPending && !messages.length && (
          <View style={{ padding: 16, gap: 10 }}>
            <Copy muted>Start a conversation with {identity.name}</Copy>
            {COACH_CONVERSATION_STARTER_IDS.map((id) => (
              <Button key={id} secondary onPress={() => setStarter(id)}>
                {getCoachConversationStarter(
                  id,
                  user.data?.name?.split(" ")[0] || "there",
                )}
              </Button>
            ))}
          </View>
        )}
        {!!attention.data?.length && (
          <Button
            secondary
            onPress={() => setText(attention.data![0].primaryAction.prompt)}
          >{`${attention.data.length} plan updates need attention`}</Button>
        )}
        {busy && (
          <View style={[s.row, { paddingHorizontal: 20, paddingVertical: 8 }]}>
            <ActivityIndicator color={c.muted} />
            <Copy muted>{label}</Copy>
          </View>
        )}
        <Status
          error={
            mutation.error ??
            attachmentError ??
            (response.data?.status === "error"
              ? new Error(
                  response.data.errorMessage ||
                    "The coach could not respond. Please try again.",
                )
              : null)
          }
        />
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
          {editing && (
            <View style={s.row}>
              <Copy muted>Editing message</Copy>
              <IconButton
                label="Cancel edit"
                onPress={() => {
                  setEditing(null);
                  setText("");
                }}
              >
                <X color={c.muted} size={18} />
              </IconButton>
            </View>
          )}
          {!!images.length && (
            <View style={s.row}>
              {images.map((image, index) => (
                <View key={index}>
                  <Image
                    source={{ uri: image.url }}
                    style={{ width: 64, height: 64, borderRadius: 12 }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove attachment ${index + 1}`}
                    onPress={() =>
                      setImages((values) =>
                        values.filter((_, i) => i !== index),
                      )
                    }
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      backgroundColor: c.card,
                      borderRadius: 12,
                      padding: 5,
                    }}
                  >
                    <X size={16} color={c.text} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <View
            style={[
              s.row,
              {
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 28,
                padding: 5,
                alignItems: "flex-end",
              },
            ]}
          >
            <IconButton
              label="Attach photos"
              disabled={busy || picking || !!editing}
              onPress={() => void pickImages()}
            >
              <ImagePlus color={c.muted} size={22} />
            </IconButton>
            <TextInput
              testID="chat-message-input"
              accessibilityLabel="Message"
              placeholder={editing ? "Edit your message…" : "Type a message…"}
              placeholderTextColor={c.muted}
              multiline
              value={text}
              onChangeText={setText}
              onContentSizeChange={(event) =>
                setInputHeight(
                  Math.max(
                    44,
                    Math.min(120, event.nativeEvent.contentSize.height),
                  ),
                )
              }
              style={{
                flex: 1,
                color: c.text,
                fontSize: 16,
                lineHeight: 22,
                height: inputHeight,
                minHeight: 44,
                maxHeight: 120,
                paddingTop: 11,
                paddingBottom: 11,
              }}
            />
            <DictationButton
              accessibilityLabel="Start voice input"
              disabled={busy || picking}
              label="message"
              onError={setAttachmentError}
              onTranscript={(transcript) =>
                setText((current) => appendDictationText(current, transcript))
              }
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                editing ? "Save edited message" : "Send message"
              }
              disabled={
                busy || picking || (!text.trim() && !images.length) || !chat
              }
              onPress={() => mutation.mutate()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: c.accent,
                opacity: busy || (!text.trim() && !images.length) ? 0.4 : 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUp color="white" size={24} />
            </Pressable>
          </View>
        </View>
        <CoachSettings visible={settings} onClose={() => setSettings(false)} />
        <Sheet
          visible={menu}
          title="Conversation"
          onClose={() => setMenu(false)}
        >
          <Status error={action.error} />
          <Button busy={action.isPending} onPress={() => action.mutate("new")}>
            New conversation
          </Button>
          <Button
            secondary
            busy={action.isPending}
            onPress={() => action.mutate("assess")}
          >
            Assess
          </Button>
          <Button
            secondary
            onPress={() => {
              setMenu(false);
              setSettings(true);
            }}
          >
            Coach settings
          </Button>
          <Button
            secondary
            onPress={() => {
              setMenu(false);
              setClear(true);
            }}
          >
            Clear history
          </Button>
        </Sheet>
        <Sheet
          visible={clear}
          title="Clear coach history?"
          onClose={() => setClear(false)}
        >
          <Copy>
            This removes all coach conversations and coach memory. This cannot
            be undone.
          </Copy>
          <Status error={action.error} />
          <Button
            busy={action.isPending}
            onPress={() => action.mutate("clear")}
          >
            Clear history and memory
          </Button>
          <Button secondary onPress={() => setClear(false)}>
            Cancel
          </Button>
        </Sheet>
        <Sheet
          visible={context}
          title={`What ${identity.name} can see`}
          onClose={() => setContext(false)}
        >
          <Copy muted>
            Your coach uses your plans, activities, progress, metrics, and what
            you share in conversation.
          </Copy>
          <Copy>
            {plans.data?.length ?? 0} plans · {activities.data?.length ?? 0}{" "}
            activities · {entries.data?.length ?? 0} logs ·{" "}
            {metrics.data?.length ?? 0} metrics
          </Copy>
          {plans.data
            ?.filter((p) => !p.deletedAt && !p.archivedAt)
            .map((plan) => (
              <Button
                key={plan.id}
                secondary
                onPress={() => {
                  setContext(false);
                  router.push(`/plan/${plan.id}`);
                }}
              >{`${plan.emoji ?? ""} ${plan.goal}`}</Button>
            ))}
        </Sheet>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
