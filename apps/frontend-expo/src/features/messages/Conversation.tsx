import { useReducedMotion } from "react-native-reanimated";
import { PlanCoachingRow } from "@/features/plans/coaching/PlanCoachingRow";
import { IconButton } from "./IconButton";
import { ConversationHeader } from "./chrome/ConversationHeader";
import { AttentionIsland } from "./chrome/AttentionIsland";
import { Fade } from "./chrome/Fade";
import { useKeyboardVisible } from "./chrome/useKeyboardVisible";
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
  StyleSheet,
  TextInput,
  View,
  AppState,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react-native";
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
import { useTranscriptionFeedback } from "@/features/dictation/TranscriptionFeedback";
import { useAiConsent } from "@/features/ai-consent/AiConsent";
import {
  ReportSheet,
  personLabel,
  showActions,
  useBlockUser,
} from "@/features/safety/Safety";
import type { ReportTarget } from "@/features/safety/types";
import type {
  ConversationProps,
  ImageAttachment,
  Message,
  ResponseState,
  CoachAttentionItem,
} from "./types";

export function Conversation({ id }: ConversationProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const aiConsent = useAiConsent();
  const transcriptionFeedback = useTranscriptionFeedback();
  const keyboardVisible = useKeyboardVisible();
  const focused = useIsFocused();
  const client = useQueryClient();
  const user = useCurrentUser();
  const params = useLocalSearchParams<{ type?: string; prompt?: string; planId?: string; messageId?: string; send?: string }>();
  const [selectedPlan, setSelectedPlan] = useState(params.planId ?? "");
  const focusedMessage = useRef<string | undefined>(undefined);
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
  const [contextPlan, setContextPlan] = useState<string>();
  const [clear, setClear] = useState(false);
  const [attachmentError, setAttachmentError] = useState<unknown>();
  const [picking, setPicking] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const nearBottom = useRef(true);
  // FlatList.scrollToEnd trusts item measurements that can lag behind layout,
  // so scroll to the measured content height instead.
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const scrollToLatest = (animated = false) =>
    list.current?.scrollToOffset({
      offset: Math.max(0, contentHeight.current - viewportHeight.current),
      animated,
    });
  const [showLatest, setShowLatest] = useState(false);
  const reducedMotion = useReducedMotion();
  const [inputHeight, setInputHeight] = useState(40);
  const read = useRef(new Set<string>());
  const [pending, setPending] = useState<Message | null>(null);
  const [report, setReport] = useState<ReportTarget>();
  const blockUser = useBlockUser();
  // Hide the island once its current items have been drafted into the composer.
  const [draftedAttention, setDraftedAttention] = useState<string>();
  // The header and composer float over the thread, which pads itself by their heights.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);
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
            planId: selectedPlan || undefined,
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
  // The other person in a direct chat, for Report / Block.
  const other =
    chat?.type === "DIRECT"
      ? chat.participants?.find((p) => p.userId !== user.data?.id)
      : undefined;
  const otherPerson = other && { ...other, id: other.userId };
  const attentionKey = attention.data?.map((item) => item.dedupeKey).join("|");
  const showAttention = !!attention.data?.length && attentionKey !== draftedAttention;
  const ready = !busy && !picking && (!!text.trim() || !!images.length);
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
  const focusRequestedMessage = () => {
    if (!params.messageId || focusedMessage.current === params.messageId) return false;
    const index = visibleMessages.findIndex(m => m.id === params.messageId);
    if (index < 0) return false;
    nearBottom.current = false;
    list.current?.scrollToIndex({ index, animated: false, viewPosition: 0.2 });
    return true;
  };
  // Measuring the floating chrome changes the thread's padding after the first scroll.
  useEffect(() => {
    if (nearBottom.current && !focusRequestedMessage())
      requestAnimationFrame(() => scrollToLatest());
  }, [headerHeight, dockHeight]);
  useEffect(() => { setSelectedPlan(params.planId ?? ""); focusedMessage.current = undefined; }, [params.planId, params.messageId]);
  // A one-tap answer from elsewhere (why a week was missed) arrives ready to send: send it once.
  const autoSent = useRef(false);
  useEffect(() => {
    if (params.send !== "1" || !params.prompt || !chat || !user.data || busy || autoSent.current) return;
    autoSent.current = true;
    router.setParams({ send: undefined });
    void (async () => {
      if (coach && !(await aiConsent.ask())) return;
      mutation.mutate();
    })();
  }, [params.send, params.prompt, chat, user.data, busy]);
  useEffect(() => {
    if (!coach || !focused) return;
    const ping = () => { if (AppState.currentState === "active") void api.post("/follow-through/coaching/presence").catch(() => {}); };
    ping(); const interval = setInterval(ping, 60000);
    const listener = AppState.addEventListener("change", ping);
    return () => { clearInterval(interval); listener.remove(); };
  }, [coach, focused]);
  const viewer = useRef({ id, userId: user.data?.id, coach, messageId: params.messageId });
  viewer.current = { id, userId: user.data?.id, coach, messageId: params.messageId };
  const markVisible = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<Message>[] }) => {
      const groups = new Map<string, string[]>();
      for (const { item } of viewableItems) {
        if (item.id === viewer.current.messageId) focusedMessage.current = item.id;
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={list}
            testID="conversation-messages"
            style={{ flex: 1 }}
            onLayout={(event) => {
              viewportHeight.current = event.nativeEvent.layout.height;
              if (focusRequestedMessage()) return;
              if (nearBottom.current)
                requestAnimationFrame(() => scrollToLatest());
            }}
            data={visibleMessages}
            onContentSizeChange={(_, height) => {
              contentHeight.current = height;
              if (focusRequestedMessage()) return;
              if (nearBottom.current) scrollToLatest();
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
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
              requestAnimationFrame(() => list.current?.scrollToIndex({ index, animated: false, viewPosition: 0.2 }));
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: headerHeight + (showAttention ? 64 : 12),
              gap: 20,
            }}
            ListHeaderComponent={
              <Status
                loading={chats.isPending || query.isPending}
                error={chats.error ?? query.error}
                retry={() => {
                  void chats.refetch();
                  void query.refetch();
                }}
              />
            }
            // Room for the floating composer, so the newest message rests above it.
            ListFooterComponent={<View style={{ height: dockHeight }} />}
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
              <View style={{ gap: 12 }}>
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
                      fontWeight: "500",
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
                  onReport={
                    !coach && item.senderId && item.senderId !== user.data?.id
                      ? () =>
                          setReport({
                            kind: "MESSAGE",
                            id: item.id,
                            label: "this message",
                          })
                      : undefined
                  }
                />
              </View>
            )}
          />
          {showLatest && (
            <View
              style={{
                position: "absolute",
                bottom: dockHeight + 8,
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
                  scrollToLatest(!reducedMotion)
                }
              >
                <ArrowDown size={22} color={c.text} />
              </IconButton>
            </View>
          )}
          {showAttention && (
            <AttentionIsland
              count={attention.data!.length}
              top={headerHeight + 8}
              onPress={() => {
                setText(attention.data![0].primaryAction.prompt);
                setDraftedAttention(attentionKey);
              }}
            />
          )}
          <View
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
            pointerEvents="box-none"
          >
            <View
              onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
              style={{ paddingTop: insets.top, backgroundColor: c.bg }}
            >
              <ConversationHeader
                title={
                  coach
                    ? identity.name
                    : chat
                      ? chatTitle(chat, user.data?.id)
                      : "Conversation"
                }
                coach={coach}
                avatar={coach ? identity.avatar : undefined}
                onBack={() => {
                  Keyboard.dismiss();
                  router.dismissTo("/messages");
                }}
                onOpenSettings={() => setSettings(true)}
                onOpenContext={() => setContext(true)}
                onOpenMenu={() => setMenu(true)}
                onOpenPersonMenu={
                  otherPerson
                    ? () =>
                        showActions(personLabel(otherPerson), [
                          {
                            label: `Report ${personLabel(otherPerson)}`,
                            onPress: () =>
                              setReport({
                                kind: "USER",
                                id: otherPerson.id,
                                label: personLabel(otherPerson),
                              }),
                          },
                          {
                            label: `Block ${personLabel(otherPerson)}`,
                            destructive: true,
                            onPress: () =>
                              blockUser(otherPerson, () =>
                                router.dismissTo("/messages"),
                              ),
                          },
                        ])
                    : undefined
                }
              />
            </View>
            <Fade color={c.bg} toward="top" height={32} />
          </View>
          <View
            onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
            pointerEvents="box-none"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
          >
            <Fade color={c.bg} toward="bottom" height={28} />
            <View
              style={{
                backgroundColor: c.bg,
                paddingHorizontal: 12,
                paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8),
                gap: 8,
              }}
            >
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
              {busy && (
                <View style={[s.row, { paddingHorizontal: 4 }]}>
                  <ActivityIndicator size="small" color={c.muted} />
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
              {editing && (
                <View style={[s.row, { paddingLeft: 4 }]}>
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
              {transcriptionFeedback.banner}
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
                style={{
                  backgroundColor: c.dark ? "#1f1f21" : "#ffffff",
                  borderColor: c.dark ? "#ffffff1f" : "#00000014",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 26,
                  paddingTop: 6,
                  paddingBottom: 6,
                  paddingHorizontal: 6,
                }}
              >
                <TextInput
                  testID="chat-message-input"
                  accessibilityLabel="Message"
                  placeholder={
                    editing ? "Edit your message…" : `Message ${coach ? identity.name : ""}`.trim()
                  }
                  placeholderTextColor={c.muted}
                  multiline
                  value={text}
                  onChangeText={setText}
                  onContentSizeChange={(event) =>
                    setInputHeight(
                      Math.max(
                        40,
                        Math.min(132, event.nativeEvent.contentSize.height),
                      ),
                    )
                  }
                  style={{
                    color: c.text,
                    fontFamily: "Inter-Regular",
                    fontSize: 16,
                    lineHeight: 22,
                    height: inputHeight,
                    minHeight: 40,
                    maxHeight: 132,
                    paddingTop: 9,
                    paddingBottom: 9,
                    paddingHorizontal: 10,
                  }}
                />
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <IconButton
                    label="Attach photos"
                    disabled={busy || picking || !!editing}
                    onPress={() => void pickImages()}
                  >
                    <Plus color={c.text} size={24} strokeWidth={1.8} />
                  </IconButton>
                  <View style={{ flex: 1 }} />
                  <DictationButton
                    quiet
                    accessibilityLabel="Start voice input"
                    disabled={busy || picking}
                    label="message"
                    onError={setAttachmentError}
                    onTranscript={(transcript) =>
                      setText((current) => appendDictationText(current, transcript))
                    }
                    onTranscription={transcriptionFeedback.ask}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      editing ? "Save edited message" : "Send message"
                    }
                    disabled={!ready || !chat}
                    onPress={async () => {
                      // Coach replies come from AI providers; messages to people don't.
                      if (coach && !(await aiConsent.ask())) return;
                      mutation.mutate();
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      marginLeft: 6,
                      marginRight: 2,
                      borderRadius: 18,
                      backgroundColor: ready ? c.text : c.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ArrowUp color={ready ? c.bg : c.muted} size={20} strokeWidth={2.4} />
                  </Pressable>
                </View>
              </View>
            </View>
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
          onClose={() => { setContext(false); setContextPlan(undefined); }}
        >
          {!contextPlan && <Copy muted>
            Your coach uses your plans, app logs, ratings, and conversation.
            Watch workouts and sleep require permission for each plan.
          </Copy>}
          {plans.data
            ?.filter((p) => !p.deletedAt && !p.archivedAt && (!contextPlan || p.id === contextPlan))
            .map((plan) => (
              <PlanCoachingRow key={plan.id} plan={plan} showPlanTitle inlineEditor onEditingChange={editing => setContextPlan(editing ? plan.id : undefined)} />
            ))}
        </Sheet>
        <ReportSheet target={report} onClose={() => setReport(undefined)} />
        {aiConsent.sheet}
      </KeyboardAvoidingView>
    </View>
  );
}
