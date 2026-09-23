import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Settings2, Smile } from "lucide-react-native";
import { errorMessage } from "@/data/api";
import { useCurrentUser } from "@/data/queries";
import { useColors } from "@/components/theme";
import { ReactionEmojiSheet } from "./ReactionEmojiSheet";
import {
  MAX_REACTION_EMOJIS,
  normalizeReactionEmojis,
} from "./types";
import type { ReactionAnchor, ReactionPickerProps } from "./types";

const reactionButtonSize = 40;
const pickerPadding = 2;
const pickerWidth =
  (MAX_REACTION_EMOJIS + 1) * reactionButtonSize + pickerPadding * 2;
const pickerHeight = 48;
const gap = 8;

export function ReactionPicker({
  overlay = false,
  disabled,
  onSelect,
  selectedEmojis = [],
}: ReactionPickerProps) {
  const c = useColors();
  const user = useCurrentUser();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<ReactionAnchor>();
  const [error, setError] = useState<unknown>();
  const [customizing, setCustomizing] = useState(false);
  const reactions = normalizeReactionEmojis(user.data?.reactionEmojis);
  const close = () => setAnchor(undefined);
  useEffect(() => setAnchor(undefined), [window.width, window.height]);
  const width = Math.min(
    pickerWidth,
    window.width - insets.left - insets.right - 16,
  );
  const buttonWidth = (width - pickerPadding * 2 - 2) / (MAX_REACTION_EMOJIS + 1);
  const left = anchor
    ? Math.max(
        insets.left + 8,
        Math.min(
          anchor.x + anchor.width - width,
          window.width - insets.right - width - 8,
        ),
      )
    : 0;
  const top = anchor
    ? anchor.y - pickerHeight - gap >= insets.top + gap
      ? anchor.y - pickerHeight - gap
      : Math.min(
          anchor.y + anchor.height + gap,
          window.height - insets.bottom - pickerHeight - gap,
        )
    : 0;

  return (
    <>
      <Pressable
        ref={trigger}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel="React"
        accessibilityState={{ expanded: !!anchor, disabled }}
        disabled={disabled}
        onPress={() =>
          trigger.current?.measureInWindow((x, y, width, height) => {
            setError(undefined);
            setAnchor({ x, y, width, height });
          })
        }
        style={[
          styles.trigger,
          overlay && {
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
            backgroundColor: c.dark
              ? "rgba(39,39,42,0.7)"
              : "rgba(250,250,250,0.7)",
          },
        ]}
      >
        <Smile size={24} color={c.text} />
      </Pressable>
      {anchor && (
        <Modal
          transparent
          animationType={Platform.OS === "web" ? "none" : "fade"}
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={close}
        >
          <View
            style={styles.screen}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            <Pressable
              testID="reaction-picker-backdrop"
              accessibilityRole="button"
              accessibilityLabel="Dismiss reactions"
              onPress={close}
              style={StyleSheet.absoluteFill}
            />
            <View
              testID="reaction-picker"
              style={[
                styles.picker,
                {
                  left,
                  top,
                  width,
                  backgroundColor: overlay ? "rgba(255,255,255,0.86)" : "#fff",
                  borderColor: overlay
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(128,128,128,0.2)",
                },
              ]}
            >
              <View style={styles.pickerRow}>
                {reactions.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={emoji}
                    disabled={disabled}
                    accessibilityState={{
                      disabled,
                      selected: selectedEmojis.includes(emoji),
                    }}
                    onPress={async () => {
                      try {
                        await onSelect(emoji);
                        close();
                      } catch (error) {
                        setError(error);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.emojiButton,
                      {
                        width: buttonWidth,
                        opacity: disabled ? 0.5 : 1,
                        borderRadius: 22,
                        backgroundColor: selectedEmojis.includes(emoji)
                          ? `${c.accent}40`
                          : "transparent",
                        transform: [{ scale: pressed ? 1.2 : 1 }],
                      },
                    ]}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Customize reaction emojis"
                  onPress={() => {
                    close();
                    setCustomizing(true);
                  }}
                  style={({ pressed }) => [
                    styles.emojiButton,
                    {
                      width: buttonWidth,
                      opacity: pressed ? 0.72 : 1,
                      backgroundColor: "transparent",
                    },
                  ]}
                >
                  <Settings2 size={22} color="#111827" strokeWidth={2.75} />
                </Pressable>
              </View>
            </View>
            {!!error && (
              <View
                style={{
                  position: "absolute",
                  left: 16,
                  right: 16,
                  bottom: insets.bottom + 24,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: c.card,
                }}
              >
                <Text
                  accessibilityRole="alert"
                  style={{ color: c.dark ? "#f87171" : "#dc2626" }}
                >
                  {errorMessage(error)}
                </Text>
              </View>
            )}
          </View>
        </Modal>
      )}
      <ReactionEmojiSheet
        visible={customizing}
        onClose={() => setCustomizing(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  trigger: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
  },
  picker: {
    position: "absolute",
    alignItems: "center",
    height: pickerHeight,
    padding: 2,
    borderRadius: 50,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 5,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  emojiButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 24, lineHeight: 32 },
});
