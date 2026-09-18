import { useEffect, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
/** A sibling of the page, so it stays reachable while inputs/steps remount. */
export function AnswerKeyboard() {
  const c = useColors(),
    { height } = useWindowDimensions();
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    const frame = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow",
      (event) => setBottom(Math.max(0, height - event.endCoordinates.screenY)),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setBottom(0),
    );
    return () => {
      frame.remove();
      hide.remove();
    };
  }, [height]);
  if (bottom <= 0) return null;
  return (
    <View
      style={{
        position: "absolute",
        bottom,
        left: 0,
        right: 0,
        backgroundColor: c.bg,
        borderTopWidth: 1,
        borderColor: c.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Done editing answer"
        onPress={Keyboard.dismiss}
        style={{
          minHeight: 44,
          paddingHorizontal: 20,
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: c.accent, fontWeight: "600" }}>Done</Text>
      </Pressable>
    </View>
  );
}
