import {
  Modal,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import {
  GestureHandlerRootView,
  TouchableOpacity,
} from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { PreviewButtonProps, PreviewSheetProps } from "./types";

export const PreviewTouch =
  Platform.OS === "web" ? Pressable : TouchableOpacity;
function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      opacity={0.4}
      accessibilityLabel="Dismiss preview"
    />
  );
}
function Content({ title, onClose, children }: PreviewSheetProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      accessible={false}
      maxDynamicContentSize={height - insets.top - 20}
      onClose={onClose}
      backdropComponent={Backdrop}
      backgroundStyle={{ backgroundColor: c.bg, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: c.muted, width: 36 }}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 20),
          gap: 16,
        }}
      >
        <View style={{ position: "absolute", right: 12, top: 0, zIndex: 10 }}>
          <PreviewTouch
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={24} color={c.muted} />
          </PreviewTouch>
        </View>
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
export function PreviewSheet(props: PreviewSheetProps) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      {props.visible && (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <Content {...props} />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      )}
    </Modal>
  );
}
export function PreviewButton({
  label,
  onPress,
  secondary,
  disabled,
  children,
}: PreviewButtonProps) {
  const c = useColors();
  return (
    <PreviewTouch
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: secondary ? 1 : 0,
        borderColor: c.border,
        backgroundColor: secondary ? c.card : c.accent,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children ?? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: secondary ? c.text : "white",
          }}
        >
          {label}
        </Text>
      )}
    </PreviewTouch>
  );
}
