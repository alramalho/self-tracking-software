import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { CalendarDays, Target, Users } from "lucide-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { InterviewFrame } from "./interview/Frame";
import { OnboardingArt } from "./interview/OnboardingArt";
import { OnboardingButton } from "./interview/OnboardingButton";
import { NumberPicker } from "./interview/NumberPicker";
import { StepSequence } from "./interview/StepReveal";
import type { WelcomeProps } from "./types";

export function Welcome({ age: savedAge, preview, busy, error, onContinue, onEdit, onClose }: WelcomeProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const [ageStep, setAgeStep] = useState(false);
  const [age, setAge] = useState(savedAge && savedAge >= 13 && savedAge <= 120 ? savedAge : 25);
  const edited = useRef(false);
  const [changing, setChanging] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation | undefined>(undefined);
  useEffect(() => {
    if (!edited.current && savedAge && savedAge >= 13 && savedAge <= 120) setAge(savedAge);
  }, [savedAge]);
  useEffect(() => () => animation.current?.stop(), []);
  // The target and Welcome title stay put while only the body changes.
  useEffect(() => { opacity.setValue(1); }, [ageStep, opacity]);
  function changeStep(next: boolean) {
    if (busy || changing) return;
    if (reduced) { setAgeStep(next); return; }
    setChanging(true);
    animation.current = Animated.timing(opacity, { toValue: 0, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" });
    animation.current.start(({ finished }) => {
      if (!finished) return;
      setAgeStep(next);
      setChanging(false);
    });
  }
  return (
    <InterviewFrame stage="goal" transitionKey="welcome" bare backInBare={ageStep} preview={preview} busy={busy || changing} onBack={() => changeStep(false)} onClose={onClose}
      actions={<OnboardingButton label={ageStep ? "Continue" : "I'm ready!"} disabled={busy || changing} busy={busy} onPress={() => ageStep ? onContinue(age) : changeStep(true)} />}
    >
      <View style={{ gap: 20 }}>
        <StepSequence prefix="welcome-heading" style={{ alignItems: "center", gap: 10 }}>
          <OnboardingArt name="welcome" size={120} />
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center", letterSpacing: -0.6 }}>Welcome to tracking.so</Text>
        </StepSequence>
        <Animated.View testID="onboarding-welcome-body" style={{ opacity, minHeight: 286 }}>
          {ageStep ? (
            <StepSequence key="age" prefix="welcome-age" start={2} style={{ alignItems: "center", gap: 16 }}>
              <Text accessibilityRole="header" style={{ color: c.text, fontSize: 26, lineHeight: 32, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>What is your age?</Text>
              <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24, textAlign: "center" }}>This helps us find people of a similar age.</Text>
              <NumberPicker value={age} onChange={value => { edited.current = true; setAge(value); onEdit(); }} disabled={busy || changing} min={13} max={120} unit="years old" decreaseLabel="Decrease age" increaseLabel="Increase age" valueLabel={`${age} years old`} testID="onboarding-welcome-age" />
              <Status error={error} retry={() => onContinue(age)} />
            </StepSequence>
          ) : (
            <StepSequence key="intro" prefix="welcome-intro" start={2} style={{ gap: 16 }}>
              <Text style={{ color: c.muted, fontSize: 16, lineHeight: 22, textAlign: "center" }}>Tracking Software is a year-old app, built from the ground up to help you stay more consistent. We’ll focus on:</Text>
              <View style={{ borderRadius: 16, backgroundColor: c.card, overflow: "hidden" }}>
                {[
                  { icon: Target, label: "Your goal" },
                  { icon: CalendarDays, label: "Your week" },
                  { icon: Users, label: "Coach and circle" },
                ].map((row, i) => (
                  <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 48, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderColor: c.inputBorder }}>
                    <row.icon size={22} color={c.text} strokeWidth={1.8} />
                    <Text style={{ color: c.text, fontSize: 17 }}>{row.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: c.muted, fontSize: 16, lineHeight: 22, textAlign: "center" }}>Naturally, most of the work will come from you. Are you ready?</Text>
            </StepSequence>
          )}
        </Animated.View>
      </View>
    </InterviewFrame>
  );
}
