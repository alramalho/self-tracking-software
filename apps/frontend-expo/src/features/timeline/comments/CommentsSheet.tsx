import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetTextInput,
  useBottomSheet,
} from "@gorhom/bottom-sheet";
import type {
  BottomSheetBackdropProps,
  BottomSheetFooterProps,
  BottomSheetFlatListMethods,
} from "@gorhom/bottom-sheet";
import { TextInput, TouchableOpacity } from "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ArrowUp, MessageCircle, X } from "lucide-react-native";
import { formatDistanceToNowStrict, isValid } from "date-fns";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { useAction, useCurrentUser } from "@/data/queries";
import { api, errorMessage } from "@/data/api";
import { DictationButton } from "@/features/dictation/DictationButton";
import { appendDictationText } from "@/features/dictation/VoiceTextArea";
import type { Comment } from "@/core/types";
import type {
  CommentAvatarProps,
  CommentsSheetProps,
  ComposerContextValue,
} from "./types";

const ComposerContext = createContext<ComposerContextValue | null>(null);
const TouchTarget = Platform.OS === "web" ? Pressable : TouchableOpacity;
const CommentInput = Platform.OS === "web" ? TextInput : BottomSheetTextInput;
const snapPoints = ["58%", "94%"];

function Avatar({ person, size = 34 }: CommentAvatarProps) {
  const c = useColors();
  return person?.picture ? (
    <Image
      source={{ uri: person.picture }}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: c.text, fontWeight: "600", fontSize: 14 }}>
        {(person?.name ?? person?.username ?? "t").slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

function Backdrop(props: BottomSheetBackdropProps) {
  const { forceClose } = useBottomSheet();
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.35}
      pressBehavior="close"
      onPress={() => {
        forceClose();
        Keyboard.dismiss();
      }}
      accessibilityLabel="Dismiss comments"
    />
  );
}

// Keep the footer component identity stable so typing never remounts the input.
function Composer(props: BottomSheetFooterProps) {
  const state = useContext(ComposerContext)!;
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <BottomSheetFooter {...props} bottomInset={insets.bottom}>
      <View
        testID="comment-composer"
        style={{
          backgroundColor: c.card,
          borderTopWidth: 0.5,
          borderTopColor: c.border,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 8,
        }}
      >
        {state.replyTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: c.muted, fontSize: 12 }}>
              Replying to @{state.replyTo}
            </Text>
            <TouchTarget
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              onPress={state.cancelReply}
              hitSlop={12}
              style={{ padding: 8 }}
            >
              <X size={16} color={c.muted} />
            </TouchTarget>
          </View>
        )}
        {state.error && (
          <Text
            accessibilityRole="alert"
            style={{ color: c.dark ? "#fca5a5" : "#b91c1c", fontSize: 12 }}
          >
            Couldn't post. Your comment is saved here — tap send to retry.
          </Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar person={state.user} />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "flex-end",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: c.border,
              paddingLeft: 14,
              paddingRight: 3,
              paddingVertical: 3,
            }}
          >
            <CommentInput
              ref={state.input}
              testID="comment-input"
              accessibilityLabel="Comment"
              placeholder="Add a comment…"
              placeholderTextColor={c.muted}
              value={state.text}
              onChangeText={state.setText}
              multiline
              maxLength={5000}
              keyboardAppearance={c.dark ? "dark" : "light"}
              style={{
                flex: 1,
                color: c.text,
                fontSize: 15,
                fontFamily: "Inter-Regular",
                minHeight: 38,
                maxHeight: 110,
                paddingVertical: 9,
                paddingRight: 6,
              }}
            />
            <DictationButton
              accessibilityLabel="Start voice input"
              disabled={state.pending}
              label="comment"
              onError={(error) => Alert.alert("Voice input", errorMessage(error))}
              onTranscript={(transcript) =>
                state.setText(appendDictationText(state.text, transcript))
              }
            />
            <TouchTarget
              accessibilityRole="button"
              accessibilityLabel="Post Comment"
              accessibilityState={{
                disabled: state.pending || !state.text.trim(),
              }}
              disabled={state.pending || !state.text.trim()}
              onPress={state.send}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: state.text.trim() ? c.accent : c.soft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {state.pending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <ArrowUp
                    size={20}
                    color={state.text.trim() ? "white" : c.muted}
                    strokeWidth={2.5}
                  />
                )}
              </View>
            </TouchTarget>
          </View>
        </View>
      </View>
    </BottomSheetFooter>
  );
}

export function CommentsSheet({
  visible,
  base,
  comments,
  loading,
  error,
  retry,
  onClose,
}: CommentsSheetProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const sheet = useRef<BottomSheet>(null);
  const list = useRef<BottomSheetFlatListMethods>(null);
  const input = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string>();
  const [deleteId, setDeleteId] = useState<string>();
  const scrollToNewComment = useRef(false);
  const comment = useAction(async (submitted: string) =>
    api.post(`${base}/comments`, { text: submitted }),
  );
  const remove = useAction(async (id: string) =>
    api.delete(`${base}/comments/${id}`),
  );
  const close = () => {
    // Prevent keyboard restoration from interrupting the dismissal animation.
    sheet.current?.forceClose();
    Keyboard.dismiss();
  };
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") sheet.current?.forceClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [visible]);
  const send = () => {
    const submitted = text.trim();
    if (!submitted || comment.isPending) return;
    comment.mutate(submitted, {
      onSuccess: () => {
        setText((current) => (current.trim() === submitted ? "" : current));
        setReplyTo(undefined);
        scrollToNewComment.current = true;
        list.current?.scrollToEnd({ animated: true });
      },
    });
  };
  return (
    <ComposerContext.Provider
      value={{
        text,
        setText,
        input,
        user: me.data,
        pending: comment.isPending,
        error: comment.error,
        send,
        replyTo,
        cancelReply: () => {
          setReplyTo(undefined);
          setText((current) => current.replace(/^@\S+\s*/, ""));
        },
      }}
    >
      <Modal
        transparent
        visible={visible}
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={close}
      >
        {visible && (
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BottomSheet
                ref={sheet}
                accessible={false}
                index={0}
                snapPoints={snapPoints}
                topInset={insets.top}
                enableDynamicSizing={false}
                enablePanDownToClose
                keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"
                enableBlurKeyboardOnGesture
                android_keyboardInputMode="adjustResize"
                backdropComponent={Backdrop}
                footerComponent={Composer}
                onClose={() => {
                  Keyboard.dismiss();
                  setDeleteId(undefined);
                  onClose();
                }}
                backgroundStyle={{ backgroundColor: c.card, borderRadius: 28 }}
                handleIndicatorStyle={{
                  backgroundColor: c.muted,
                  width: 36,
                  height: 4,
                }}
                handleStyle={{ paddingTop: 10, paddingBottom: 6 }}
              >
                <View
                  testID="comments-sheet"
                  style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
                >
                  <View
                    style={{
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      borderBottomWidth: 0.5,
                      borderBottomColor: c.border,
                    }}
                  >
                    <Text
                      accessibilityRole="header"
                      style={{ color: c.text, fontSize: 16, fontWeight: "600" }}
                    >
                      Comments{comments.length ? ` (${comments.length})` : ""}
                    </Text>
                    <View style={{ position: "absolute", right: 8, top: 0 }}>
                      <TouchTarget
                        accessibilityRole="button"
                        accessibilityLabel="Close comments"
                        onPress={close}
                        style={{
                          width: 44,
                          height: 44,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={20} color={c.muted} />
                      </TouchTarget>
                    </View>
                  </View>
                  <BottomSheetFlatList<Comment>
                    ref={list}
                    style={{ flex: 1, minHeight: 0 }}
                    data={comments}
                    keyExtractor={(item) => item.id}
                    enableFooterMarginAdjustment
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                      paddingHorizontal: 16,
                      paddingTop: 20,
                      paddingBottom: insets.bottom + 16,
                      flexGrow: 1,
                    }}
                    onContentSizeChange={() => {
                      if (scrollToNewComment.current) {
                        scrollToNewComment.current = false;
                        list.current?.scrollToEnd({ animated: true });
                      }
                    }}
                    ListHeaderComponent={
                      <Status
                        loading={loading && !comments.length}
                        error={error ?? remove.error}
                        retry={retry}
                      />
                    }
                    ListEmptyComponent={
                      !loading && !error ? (
                        <View
                          style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            paddingVertical: 35,
                          }}
                        >
                          <MessageCircle size={30} color={c.muted} />
                          <Text
                            style={{
                              color: c.text,
                              fontSize: 18,
                              fontWeight: "600",
                            }}
                          >
                            No comments yet
                          </Text>
                          <Text style={{ color: c.muted, fontSize: 14 }}>
                            Start the conversation.
                          </Text>
                        </View>
                      ) : null
                    }
                    renderItem={({ item }) => {
                      const date = item.createdAt && new Date(item.createdAt);
                      return (
                        <View
                          testID={`comment-${item.id}`}
                          style={{
                            flexDirection: "row",
                            gap: 10,
                            paddingBottom: 22,
                          }}
                        >
                          <Avatar person={item.user} />
                          <View style={{ flex: 1, gap: 5 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <Text
                                style={{
                                  color: c.text,
                                  fontSize: 13,
                                  fontWeight: "600",
                                }}
                              >
                                {item.user.username ?? item.user.name}
                              </Text>
                              {date && isValid(date) && (
                                <Text style={{ color: c.muted, fontSize: 11 }}>
                                  {formatDistanceToNowStrict(date)}
                                </Text>
                              )}
                            </View>
                            <Text
                              selectable
                              style={{
                                color: c.text,
                                fontSize: 14,
                                lineHeight: 21,
                              }}
                            >
                              {item.text}
                            </Text>
                            <View style={{ flexDirection: "row", gap: 18 }}>
                              {!!item.user.username && (
                                <TouchTarget
                                  accessibilityRole="button"
                                  accessibilityLabel={`Reply to ${item.user.username}`}
                                  hitSlop={8}
                                  onPress={() => {
                                    setReplyTo(item.user.username!);
                                    setText(
                                      (current) =>
                                        `@${item.user.username} ${current.replace(/^@\S+\s*/, "")}`,
                                    );
                                    input.current?.focus();
                                  }}
                                  style={{ paddingVertical: 5 }}
                                >
                                  <Text
                                    style={{
                                      color: c.muted,
                                      fontSize: 12,
                                      fontWeight: "500",
                                    }}
                                  >
                                    Reply
                                  </Text>
                                </TouchTarget>
                              )}
                              {(item.userId ?? item.user.id) ===
                                me.data?.id && (
                                <TouchTarget
                                  accessibilityRole="button"
                                  accessibilityLabel={
                                    deleteId === item.id
                                      ? "Confirm delete comment"
                                      : "Delete comment"
                                  }
                                  disabled={remove.isPending}
                                  hitSlop={8}
                                  onPress={() => {
                                    if (deleteId !== item.id)
                                      setDeleteId(item.id);
                                    else
                                      remove.mutate(item.id, {
                                        onSuccess: () => setDeleteId(undefined),
                                      });
                                  }}
                                  style={{ paddingVertical: 5 }}
                                >
                                  <Text
                                    style={{
                                      color:
                                        deleteId === item.id
                                          ? "#ef4444"
                                          : c.muted,
                                      fontSize: 12,
                                    }}
                                  >
                                    {deleteId === item.id
                                      ? "Delete?"
                                      : "Delete"}
                                  </Text>
                                </TouchTarget>
                              )}
                              {deleteId === item.id && (
                                <TouchTarget
                                  accessibilityRole="button"
                                  accessibilityLabel="Cancel delete comment"
                                  hitSlop={8}
                                  onPress={() => setDeleteId(undefined)}
                                  style={{ paddingVertical: 5 }}
                                >
                                  <Text
                                    style={{ color: c.muted, fontSize: 12 }}
                                  >
                                    Cancel
                                  </Text>
                                </TouchTarget>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    }}
                  />
                </View>
              </BottomSheet>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        )}
      </Modal>
    </ComposerContext.Provider>
  );
}
