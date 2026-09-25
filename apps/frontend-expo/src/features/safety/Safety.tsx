import { useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Status, useColors } from "@/components/ui";
import { api, errorMessage } from "@/data/api";
import { useAction } from "@/data/queries";
import type { Person } from "@/core/types";
import {
  PreviewButton,
  PreviewSheet,
} from "@/features/messages/entities/PreviewSheet";
import type {
  BlockedPerson,
  ReportReason,
  ReportSheetProps,
  SafetyAction,
} from "./types";

// Reporting and blocking (App Store Guideline 1.2). Reports reach the owner,
// who reviews them within 24 hours (see backend routes/moderation.ts).
// Also listed in the Terms at https://tracking.so/terms.
export const SUPPORT_EMAIL = "alex@tracking.so";
const NoteInput = Platform.OS === "web" ? TextInput : BottomSheetTextInput;
const reasons: { value: ReportReason; label: string }[] = [
  { value: "SPAM", label: "Spam or scam" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "HATE", label: "Hate speech" },
  { value: "SEXUAL", label: "Nudity or sexual content" },
  { value: "SELF_HARM", label: "Self-harm or suicide" },
  { value: "OTHER", label: "Something else" },
];
export const personLabel = (person: Partial<Person>) =>
  person.username ? `@${person.username}` : person.name || "this person";

// Native action sheet on iOS, alert buttons on Android, confirm dialogs on web.
export function showActions(title: string, actions: SafetyAction[]) {
  if (Platform.OS === "ios")
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...actions.map((a) => a.label), "Cancel"],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.flatMap((a, i) =>
          a.destructive ? [i] : [],
        ),
      },
      (index) => actions[index]?.onPress(),
    );
  else if (Platform.OS === "android")
    Alert.alert(title, undefined, [
      ...actions.map((a) => ({
        text: a.label,
        style: a.destructive ? ("destructive" as const) : undefined,
        onPress: a.onPress,
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  else actions.find((a) => window.confirm(`${a.label}?`))?.onPress();
}

// Blocking asks first, then hides that person everywhere (all queries refetch).
export function useBlockUser() {
  const block = useAction(async (id: string) =>
    api.post(`/moderation/blocks/${id}`),
  );
  return (person: Partial<Person> & { id: string }, onBlocked?: () => void) => {
    const run = () =>
      block.mutate(person.id, {
        onSuccess: onBlocked,
        onError: (error) =>
          Platform.OS === "web"
            ? window.alert(errorMessage(error))
            : Alert.alert("Couldn't block", errorMessage(error)),
      });
    const title = `Block ${personLabel(person)}?`;
    const message =
      "You won't see each other's activity, comments or messages, and they won't be told. You can unblock them in Settings → Blocked people.";
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) run();
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: run },
    ]);
  };
}

export function ReportSheet({ target, onClose }: ReportSheetProps) {
  const c = useColors();
  const [reason, setReason] = useState<ReportReason>();
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: async () =>
      api.post("/moderation/reports", {
        kind: target!.kind,
        targetId: target!.id,
        reason,
        note: note.trim() || undefined,
      }),
  });
  const close = () => {
    setReason(undefined);
    setNote("");
    send.reset();
    onClose();
  };
  return (
    <PreviewSheet visible={!!target} title="Report" onClose={close}>
      {send.isSuccess ? (
        <View style={{ gap: 12, paddingTop: 8 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>
            Thanks — we'll review this within 24 hours
          </Text>
          <Copy muted>
            We remove content and accounts that break our Terms. You can also
            block this person so you no longer see each other.
          </Copy>
          <PreviewButton label="Done" onPress={close} />
        </View>
      ) : (
        <>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: 18,
              fontWeight: "700",
              paddingRight: 40,
            }}
          >
            Why are you reporting {target?.label}?
          </Text>
          <View
            style={{
              borderRadius: 20,
              overflow: "hidden",
              backgroundColor: c.card,
            }}
          >
            {reasons.map((option, index) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === option.value }}
                onPress={() => setReason(option.value)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 50,
                  paddingHorizontal: 16,
                  borderTopWidth: index ? 1 : 0,
                  borderColor: c.border,
                }}
              >
                <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>
                  {option.label}
                </Text>
                {reason === option.value && (
                  <Check size={20} color={c.accent} />
                )}
              </Pressable>
            ))}
          </View>
          <NoteInput
            accessibilityLabel="Add details (optional)"
            placeholder="Add details (optional)"
            placeholderTextColor={c.muted}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            style={{
              minHeight: 80,
              borderWidth: 1,
              borderRadius: 12,
              borderColor: c.inputBorder,
              backgroundColor: c.card,
              color: c.text,
              padding: 12,
              fontSize: 16,
              fontFamily: "Inter-Regular",
              textAlignVertical: "top",
            }}
          />
          <Status error={send.error} />
          <PreviewButton
            label={send.isPending ? "Sending…" : "Send report"}
            disabled={!reason || send.isPending}
            onPress={() => send.mutate()}
          />
        </>
      )}
    </PreviewSheet>
  );
}

// Settings → Blocked people.
export function BlockedPeople() {
  const c = useColors();
  const blocks = useQuery({
    queryKey: ["blocks"],
    queryFn: async () =>
      (await api.get<{ blocks: BlockedPerson[] }>("/moderation/blocks")).data
        .blocks,
  });
  const unblock = useAction(async (id: string) =>
    api.delete(`/moderation/blocks/${id}`),
  );
  return (
    <>
      <Copy muted>
        People you block can't see your activity or message you, and you won't
        see theirs.
      </Copy>
      <Status
        loading={blocks.isLoading}
        error={blocks.error ?? unblock.error}
        empty={blocks.data?.length === 0 ? "You haven't blocked anyone." : undefined}
      />
      {blocks.data?.map((person) => (
        <View
          key={person.id}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          {person.picture ? (
            <Image
              source={{ uri: person.picture }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: c.soft,
              }}
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: "600" }}>
              {person.name || person.username}
            </Text>
            {!!person.username && (
              <Text style={{ color: c.muted, fontSize: 12 }}>
                @{person.username}
              </Text>
            )}
          </View>
          <Button
            secondary
            busy={unblock.isPending && unblock.variables === person.id}
            onPress={() => unblock.mutate(person.id)}
          >
            Unblock
          </Button>
        </View>
      ))}
    </>
  );
}
