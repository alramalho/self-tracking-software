import { Keyboard, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X } from "lucide-react-native";
import { IconButton, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import {
  Reveal,
  RevealContext,
  useRevealViewport,
} from "@/components/reveal/Reveal";
import { stageLabels, stages } from "./model";
import type { InterviewFrameProps } from "./types";
export function InterviewFrame({
  stage,
  progress,
  preview,
  busy,
  onBack,
  onClose,
  backDisabled,
  children,
  actions,
}: InterviewFrameProps) {
  const c = useColors(),
    viewport = useRevealViewport(),
    index = stages.indexOf(stage);
  const insets = useSafeAreaInsets(), { height } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scroll = useRef<ScrollView>(null);
  // Keep the modal header in the safe area while the keyboard changes iOS insets.
  const topInset = Math.max(insets.top, initialWindowMetrics?.insets.top || 0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const frame = Keyboard.addListener("keyboardWillChangeFrame", event => setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY)));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardHeight(0));
    return () => { frame.remove(); hide.remove(); };
  }, [height]);
  return (
    <SafeAreaView
      testID="onboarding-screen"
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: topInset }}
      edges={["bottom", "left", "right"]}
    >
      <View style={{ paddingHorizontal: 24, paddingBottom: 16, gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <IconButton
            label="Previous question"
            icon={ArrowLeft}
            onPress={onBack}
            disabled={busy || backDisabled}
          />
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "500" }}>
            {preview ? "Preview · " : ""}
            {progress
              ? `${progress.current} of ${progress.total} · ${progress.label}`
              : `${index + 1} of ${stages.length} · ${stageLabels[stage]}`}
          </Text>
          <IconButton
            label="Close onboarding"
            icon={X}
            onPress={onClose}
            disabled={busy}
          />
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Onboarding progress"
          accessibilityValue={{ min: 0, max: progress?.total ?? stages.length, now: progress?.current ?? index + 1 }}
          aria-valuemin={0}
          aria-valuemax={progress?.total ?? stages.length}
          aria-valuenow={progress?.current ?? index + 1}
          style={{ flexDirection: "row", gap: 5 }}
        >
          {Array.from({ length: progress?.total ?? stages.length }, (_, i) => (
            <View
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 3,
                backgroundColor: i < (progress?.current ?? index + 1) ? c.accent : c.soft,
              }}
            />
          ))}
        </View>
      </View>
      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <RevealContext.Provider value={viewport}>
          <ScrollView
            ref={scroll}
            onLayout={() => { if (keyboardHeight > 0) scroll.current?.scrollToEnd({ animated: false }); }}
            key={stage}
            onScroll={viewport.check}
            onContentSizeChange={viewport.check}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 28,
              paddingTop: progress?.label === "Your coach" ? 12 : 32,
              paddingBottom: 32,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 448,
                alignSelf: "center",
                gap: 28,
              }}
            >
              {children}
            </View>
          </ScrollView>
          <Reveal
            key={`actions-${stage}`}
            style={{
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 20,
              borderTopWidth: 1,
              borderColor: c.inputBorder,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 448,
                alignSelf: "center",
                gap: 12,
              }}
            >
              {actions}
            </View>
          </Reveal>
        </RevealContext.Provider>
      </View>
    </SafeAreaView>
  );
}
