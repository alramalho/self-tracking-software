import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { Plus, Smile, Trash2 } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { useAction, useCurrentUser } from "@/data/queries";
import { api } from "@/data/api";
import { EditorButton } from "@/features/activities/editor/controls";
import {
  isReactionEmoji,
  MAX_REACTION_EMOJIS,
  normalizeReactionEmojiInput,
  normalizeReactionEmojis,
  REACTION_EMOJI_CATEGORIES,
} from "./types";

interface ReactionEmojiEditorProps {
  onClose?: () => void;
}

export function ReactionEmojiEditor({ onClose }: ReactionEmojiEditorProps) {
  const user = useCurrentUser();
  const c = useColors();
  const savedEmojis = normalizeReactionEmojis(user.data?.reactionEmojis);
  const [emojis, setEmojis] = useState(savedEmojis);
  const [newEmoji, setNewEmoji] = useState("");
  const emojiInput = useRef<TextInput>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<Error>();
  const save = useAction(async (nextEmojis: string[]) => {
    await api.patch("/users/user", { reactionEmojis: nextEmojis });
  });

  useEffect(() => {
    setEmojis(savedEmojis);
  }, [user.data?.reactionEmojis]);

  const addEmoji = () => {
    const emoji = newEmoji.trim();
    if (!isReactionEmoji(emoji)) {
      return;
    }
    if (emojis.includes(emoji)) {
      setError(new Error("That emoji is already in your reaction tray."));
      return;
    }
    if (emojis.length >= MAX_REACTION_EMOJIS) {
      setError(new Error(`You can choose up to ${MAX_REACTION_EMOJIS} reactions.`));
      return;
    }
    setEmojis((current) => [...current, emoji]);
    setNewEmoji("");
    setPickerOpen(false);
    setError(undefined);
  };

  const saveEmojis = () => {
    save.mutate(emojis, {
      onSuccess: onClose,
    });
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: c.muted, lineHeight: 20 }}>
        Choose the emojis that appear in your reaction tray. Pick one below or
        type or paste one emoji from your device keyboard.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {emojis.map((emoji) => (
          <View
            key={emoji}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 16,
              paddingLeft: 8,
              paddingVertical: 4,
              backgroundColor: c.soft,
            }}
          >
            <Text style={{ fontSize: 26, lineHeight: 34 }}>{emoji}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${emoji}`}
              disabled={emojis.length === 1}
              onPress={() =>
                setEmojis((current) => current.filter((item) => item !== emoji))
              }
              hitSlop={8}
              style={{ opacity: emojis.length === 1 ? 0.35 : 1, padding: 6 }}
            >
              <Trash2 size={16} color={c.muted} />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <TextInput
          ref={emojiInput}
          accessibilityLabel="Add a reaction emoji"
          value={newEmoji}
          onChangeText={(value) => {
            const emoji = normalizeReactionEmojiInput(value);
            if (value !== emoji && Platform.OS !== "web") {
              emojiInput.current?.setNativeProps({ text: emoji });
            }
            setNewEmoji(emoji);
          }}
          onSubmitEditing={addEmoji}
          placeholder="Choose one emoji"
          placeholderTextColor={c.muted}
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={32}
          editable={emojis.length < MAX_REACTION_EMOJIS}
          style={{
            flex: 1,
            minHeight: 44,
            borderWidth: 1,
            borderRadius: 12,
            borderColor: c.inputBorder,
            backgroundColor: c.soft,
            color: c.text,
            paddingHorizontal: 12,
            fontSize: 16,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open emoji picker"
          accessibilityState={{ expanded: pickerOpen }}
          disabled={emojis.length >= MAX_REACTION_EMOJIS}
          onPress={() => setPickerOpen((open) => !open)}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderRadius: 12,
            borderColor: c.inputBorder,
            backgroundColor: c.soft,
            opacity: emojis.length >= MAX_REACTION_EMOJIS ? 0.45 : 1,
          }}
        >
          <Smile size={20} color={c.text} />
        </Pressable>
        <EditorButton
          label="Add"
          icon={Plus}
          secondary
          disabled={!newEmoji.trim() || emojis.length >= MAX_REACTION_EMOJIS}
          onPress={addEmoji}
        />
      </View>
      {pickerOpen && (
        <View accessibilityLabel="Emoji picker" style={{ gap: 10 }}>
          {REACTION_EMOJI_CATEGORIES.map((category) => (
            <View key={category.name} style={{ gap: 6 }}>
              <Text style={{ color: c.muted, fontWeight: "600" }}>
                {category.name}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {category.emojis.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${emoji}`}
                    onPress={() => {
                      setNewEmoji(emoji);
                      setPickerOpen(false);
                      setError(undefined);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
      {!!error && <Status error={error} />}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {onClose && (
          <View style={{ flex: 1 }}>
            <EditorButton label="Cancel" secondary onPress={onClose} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <EditorButton
            label="Save reactions"
            busy={save.isPending}
            onPress={saveEmojis}
          />
        </View>
      </View>
      <Status error={save.error} />
    </View>
  );
}
