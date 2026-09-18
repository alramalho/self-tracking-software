import {
  InputAccessoryView,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { Text } from "@/components/typography/Text";
import { IconButton, useColors } from "@/components/ui";
import type { LoggingDrawerProps } from "./types";

// Match the PWA's content-sized drawer instead of stretching a short form to a full page.
export function LoggingDrawer({
  title,
  testID = "activity-logging-drawer",
  dismissLabel = "Dismiss activity logger",
  titleAlign = "center",
  contentPadding = 24,
  keyboardToolbar = false,
  scrollToEndOnKeyboard = true,
  onClose,
  children,
}: LoggingDrawerProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const availableHeight = height - keyboardHeight;
  const drawerMaxHeight =
    keyboardHeight > 0
      ? Math.max(120, availableHeight - insets.top - 12)
      : Math.max(120, height * 0.88);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY));
    });
    const hide = Keyboard.addListener("keyboardWillHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      change.remove();
      hide.remove();
    };
  }, [height]);
  const drag = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      gesture.dy > 8 && Math.abs(gesture.dx) < gesture.dy,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 48 || gesture.vy > 0.7) onClose();
    },
  });
  return (
    <Modal
      transparent
      visible
      animationType={reduced ? "none" : "slide"}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar style={c.dark ? "light" : "dark"} />
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingBottom: keyboardHeight,
        }}
      >
        <Pressable
          accessibilityLabel={dismissLabel}
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.8)" },
          ]}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            flexShrink: 1,
            width: "100%",
            maxWidth: 540,
            alignSelf: "center",
            maxHeight: drawerMaxHeight,
            backgroundColor: c.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: "hidden",
          }}
        >
          <View
            {...drag.panHandlers}
            style={{
              height: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 50,
                height: 5,
                borderRadius: 3,
                backgroundColor: c.muted,
                opacity: 0.2,
              }}
            />
          </View>
          <ScrollView
            ref={scroll}
            onLayout={() => {
              if (
                keyboardToolbar &&
                scrollToEndOnKeyboard &&
                keyboardHeight > 0
              )
                scroll.current?.scrollToEnd({ animated: !reduced });
            }}
            style={{ flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: contentPadding,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
              gap: 20,
            }}
          >
            {title && (
              <Text
                accessibilityRole="header"
                style={{
                  color: c.text,
                  fontSize: 24,
                  fontWeight: "700",
                  textAlign: titleAlign,
                  paddingLeft: titleAlign === "center" ? 32 : 0,
                  paddingRight: 32,
                }}
              >
                {title}
              </Text>
            )}
            {children}
          </ScrollView>
          {keyboardToolbar && keyboardHeight > 0 && (
            <View
              style={{
                borderTopWidth: 1,
                borderColor: c.inputBorder,
                alignItems: "flex-end",
                backgroundColor: c.bg,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done editing input"
                onPress={Keyboard.dismiss}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 20,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: c.accent, fontWeight: "600" }}>Done</Text>
              </Pressable>
            </View>
          )}
          <View style={{ position: "absolute", top: 20, right: 12 }}>
            <IconButton label="Close" icon={X} onPress={onClose} />
          </View>
        </View>
        {Platform.OS === "ios" && (
          <InputAccessoryView
            nativeID="logging-input-done"
            backgroundColor={c.bg}
          >
            <View
              style={{
                alignItems: "flex-end",
                borderTopWidth: 1,
                borderColor: c.inputBorder,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done editing input"
                onPress={Keyboard.dismiss}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 20,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: c.accent, fontWeight: "600" }}>Done</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}
      </View>
    </Modal>
  );
}
