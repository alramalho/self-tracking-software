import { useRef, useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Copy, Field, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { openEncouragementChat, sendEncouragement } from "./api";
import { firstName, PersonAvatar } from "./components";
import type { MotivateDrawerProps } from "./types";

export function MotivateDrawer({
  circleId,
  member,
  onClose,
}: MotivateDrawerProps) {
  const c = useColors();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>();
  const chatId = useRef<string>(undefined);
  const inFlight = useRef(false);
  const name = firstName(member.user);
  const send = async () => {
    if (!message.trim() || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(undefined);
    try {
      chatId.current ??= await openEncouragementChat(circleId, member.user.id);
      await sendEncouragement(chatId.current, message);
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({
        queryKey: ["messages", chatId.current],
      });
    } catch (failure) {
      setError(failure);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  return (
    <LoggingDrawer
      testID="motivate-drawer"
      dismissLabel="Dismiss encouragement"
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
      keyboardToolbar
    >
      <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 24 }}>
        <PersonAvatar
          name={member.user.name ?? member.user.username ?? null}
          picture={member.user.picture}
          size={64}
        />
        <Text
          accessibilityRole="header"
          style={{
            color: c.text,
            fontSize: 24,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {sent ? `Sent to ${name}` : `Motivate ${name}`}
        </Text>
        <Text style={{ color: c.muted, fontSize: 14, textAlign: "center" }}>
          {sent
            ? "Your encouragement is in your private chat."
            : "A few words from you could make the difference."}
        </Text>
      </View>
      {sent ? (
        <Button onPress={onClose}>Done</Button>
      ) : (
        <>
          <Copy muted>
            Remind them why they started, celebrate their effort, or offer to
            join them for a session.
          </Copy>
          <Field
            label="Your message"
            value={message}
            onChangeText={setMessage}
            multiline
            editable={!sending}
            placeholder={`What would help ${name} keep going?`}
            maxLength={2000}
            inputAccessoryViewID="logging-input-done"
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />
          <Copy
            muted
          >{`Only ${name} will see this message, in your private chat.`}</Copy>
          <Status error={error} />
          <Button
            disabled={!message.trim() || sending}
            busy={sending}
            onPress={() => void send()}
          >
            Send encouragement
          </Button>
        </>
      )}
    </LoggingDrawer>
  );
}
