import { RevealContext, useRevealViewport } from "./reveal/Reveal";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { radii } from "./radii";
import { Text } from "@/components/typography/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorMessage } from "@/data/api";
import type {
  ButtonProps,
  IconButtonProps,
  FieldProps,
  GroupedRowsProps,
  PanelProps,
  ScreenProps,
  SheetProps,
  StatusProps,
} from "./types";
import { useColors } from "./theme";
import { ChevronRight } from "lucide-react-native";
import { VoiceTextArea } from "@/features/dictation/VoiceTextArea";
export { useColors } from "./theme";
export function Screen({
  testID,
  title,
  subtitle,
  children,
  refreshing,
  onRefresh,
  actions,
  leading,
}: ScreenProps) {
  const c = useColors();
  const reveal = useRevealViewport();
  return (
    <RevealContext.Provider value={reveal}>
      <SafeAreaView
        testID={testID}
        collapsable={false}
        edges={
          Platform.OS === "ios" ? ["left", "right"] : ["top", "left", "right"]
        }
        style={{ flex: 1, backgroundColor: c.bg }}
      >
        <KeyboardAvoidingView
          collapsable={false}
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            onScroll={reveal.check}
            onContentSizeChange={reveal.check}
            scrollEventThrottle={100}
            alwaysBounceVertical
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={s.screen}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={c.accent}
                />
              ) : undefined
            }
          >
            <View style={s.row}>
              {leading}
              <View style={{ flex: 1 }}>
                {title && (
                  <Text
                    accessibilityRole="header"
                    style={[s.title, { color: c.text }]}
                  >
                    {title}
                  </Text>
                )}
                {subtitle && (
                  <Text style={{ color: c.muted, marginTop: 6 }}>
                    {subtitle}
                  </Text>
                )}
              </View>
              {actions}
            </View>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </RevealContext.Provider>
  );
}
export function Panel({ children, style, testID }: PanelProps) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={[
        s.panel,
        { backgroundColor: c.card, borderColor: c.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
/** Settings-style card: emoji, **Title** · value, chevron. Used by Schedule/Reminders and Coaching. */
export function GroupedRows({ rows, testID }: GroupedRowsProps) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={{ borderRadius: 20, overflow: "hidden", backgroundColor: c.card }}
    >
      {rows.map((row, index) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`${row.title} · ${row.value}`}
          disabled={row.disabled}
          onPress={row.onPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            minHeight: 64,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderTopWidth: index ? 1 : 0,
            borderColor: c.border,
          }}
        >
          <Text style={{ fontSize: 25 }}>{row.icon}</Text>
          {/* One flowing line, so a long value wraps like a sentence instead of dropping below. */}
          <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: "600" }}>
            {row.title}
            <Text
              style={{
                color: row.attention ? c.accent : c.muted,
                fontWeight: row.attention ? "600" : "400",
              }}
            >
              {" "}· {row.value}
            </Text>
          </Text>
          {row.attention && (
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }}
            />
          )}
          <ChevronRight size={18} color={c.muted} />
        </Pressable>
      ))}
    </View>
  );
}
export function Button({
  children,
  onPress,
  disabled,
  busy,
  secondary,
  danger,
  testID,
}: ButtonProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: disabled || busy }}
      testID={testID}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? c.card : danger ? "#dc2626" : c.accent,
          borderColor: c.border,
          opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.text : "#fff"} />
      ) : (
        <Text
          style={{ fontWeight: "600", color: secondary ? c.text : "white" }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
export function IconButton({
  label,
  icon: Icon,
  disabled,
  onPress,
  testID,
}: IconButtonProps) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Icon size={22} color={c.text} strokeWidth={1.8} />
    </Pressable>
  );
}
export function Field({ label, style, multiline, ...props }: FieldProps) {
  const c = useColors();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: c.muted }}>
        {label}
      </Text>
      {multiline ? (
        <VoiceTextArea
          {...props}
          testID={`field-${props.accessibilityLabel ?? label}`}
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          multiline
          dictationLabel={label.toLowerCase()}
          style={[
            s.input,
            {
              color: c.text,
              borderColor: c.inputBorder,
              backgroundColor: c.card,
            },
            style,
          ]}
        />
      ) : (
        <TextInput
          testID={`field-${props.accessibilityLabel ?? label}`}
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          {...props}
          style={[
            s.input,
            {
              color: c.text,
              borderColor: c.inputBorder,
              backgroundColor: c.card,
            },
            style,
          ]}
        />
      )}
    </View>
  );
}
export function Heading({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: 19, fontWeight: "700", color: c.text }}
    >
      {children}
    </Text>
  );
}
export function Copy({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const c = useColors();
  return (
    <Text style={{ color: muted ? c.muted : c.text, lineHeight: 22 }}>
      {children}
    </Text>
  );
}
export function Status({
  loading,
  error,
  retry,
  secondaryAction,
  empty,
}: StatusProps) {
  const c = useColors();
  if (loading)
    return (
      <ActivityIndicator accessibilityLabel="Loading" style={{ padding: 30 }} />
    );
  if (error)
    return (
      <Panel>
        <Text
          accessibilityRole="alert"
          style={{ color: c.dark ? "#f87171" : "#dc2626" }}
        >
          {errorMessage(error)}
        </Text>
        {retry && (
          <Button secondary onPress={retry}>
            Try again
          </Button>
        )}
        {secondaryAction && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.label}
            onPress={secondaryAction.onPress}
            style={({ pressed }) => ({
              alignItems: "center",
              minHeight: 44,
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: c.muted, fontWeight: "600" }}>
              {secondaryAction.label}
            </Text>
          </Pressable>
        )}
      </Panel>
    );
  return empty ? (
    <Panel>
      <Copy muted>{empty}</Copy>
    </Panel>
  ) : null;
}
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const c = useColors();
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={s.screen}
          >
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Heading>{title}</Heading>
              </View>
              <Button secondary onPress={onClose}>
                Close
              </Button>
            </View>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export const s = StyleSheet.create({
  screen: {
    width: "100%",
    maxWidth: 672,
    alignSelf: "center",
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 100 : 24,
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: "700" },
  panel: { borderRadius: radii.card, borderWidth: 1, padding: 18, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.control,
    padding: 13,
    minHeight: 46,
    fontSize: 16,
    fontFamily: "Inter-Regular",
  },
});
