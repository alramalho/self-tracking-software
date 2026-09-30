import { Keyboard, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { ChevronLeft, X } from "lucide-react-native";
import { IconButton, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import {
  RevealContext,
  useRevealViewport,
} from "@/components/reveal/Reveal";
import { stages } from "./model";
import { StepReveal } from "./StepReveal";
import type { FooterFadeProps, InterviewFrameProps } from "./types";

// Content scrolls under the buttons and fades out, instead of a dividing line.
function FooterFade({ color }: FooterFadeProps) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: -28, height: 28 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="onboarding-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#onboarding-fade)" />
      </Svg>
    </View>
  );
}

export function InterviewFrame({
  stage,
  transitionKey = stage,
  progress,
  preview,
  busy,
  onBack,
  onClose,
  onSkip,
  bare,
  backInBare = false,
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
  const current = progress?.current ?? index + 1;
  const total = progress?.total ?? stages.length;
  return (
    <SafeAreaView
      testID="onboarding-screen"
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: topInset }}
      edges={["bottom", "left", "right"]}
    >
      {/* Back, one continuous line with no step count, then Skip or close. */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ width: 64, alignItems: "flex-start" }}>
          {(!bare || backInBare) && (
            <IconButton
              label="Previous question"
              icon={ChevronLeft}
              onPress={onBack}
              disabled={busy || backDisabled}
            />
          )}
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          {!bare && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Onboarding progress"
              accessibilityValue={{ min: 0, max: total, now: current }}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={current}
              style={{ width: 88, height: 4, borderRadius: 999, backgroundColor: c.soft, overflow: "hidden" }}
            >
              <View
                style={{
                  width: `${Math.min(100, (current / total) * 100)}%`,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: c.accent,
                }}
              />
            </View>
          )}
          {preview && <Text style={{ color: c.muted, fontSize: 11, fontWeight: "500" }}>Preview</Text>}
        </View>
        <View style={{ width: 64, alignItems: "flex-end" }}>
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip this question"
              disabled={busy}
              onPress={onSkip}
              hitSlop={12}
              style={{ paddingVertical: 10, opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ color: c.muted, fontSize: 16 }}>Skip</Text>
            </Pressable>
          ) : (
            <IconButton label="Close onboarding" icon={X} onPress={onClose} disabled={busy} />
          )}
        </View>
      </View>
      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <RevealContext.Provider value={viewport}>
          <ScrollView
            ref={scroll}
            onLayout={() => { if (keyboardHeight > 0) scroll.current?.scrollToEnd({ animated: false }); }}
            key={transitionKey}
            onScroll={viewport.check}
            onContentSizeChange={viewport.check}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: 28,
              paddingTop: 12,
              paddingBottom: 40,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 448,
                alignSelf: "center",
                gap: 24,
              }}
            >
              {children}
            </View>
          </ScrollView>
          <StepReveal
            key={`actions-${transitionKey}`}
            name="actions"
            order={7}
            style={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: 20,
              backgroundColor: c.bg,
            }}
          >
            <FooterFade color={c.bg} />
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
          </StepReveal>
        </RevealContext.Provider>
      </View>
    </SafeAreaView>
  );
}
