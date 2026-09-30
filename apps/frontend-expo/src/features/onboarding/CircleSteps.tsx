import { Pressable, TextInput } from "react-native";
import { Mail, User, Users } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { MatchPreferencesList } from "@/features/circles/components";
import { StepSequence } from "./interview/StepReveal";
import type { CircleAskProps, CirclePrefsProps } from "./types";

// "Do it with a group?" Tapping a choice moves on, like the coaching question.
export function CircleAsk({ busy, onFind, onInvite, onSolo }: CircleAskProps) {
  const c = useColors();
  const options = [
    { label: "Find me a circle", icon: Users, onPress: onFind },
    { label: "Invite friends", icon: Mail, onPress: onInvite },
    { label: "Just me", icon: User, onPress: onSolo },
  ];
  return (
    <StepSequence start={3} prefix="circle-choice" style={{ gap: 12 }}>
      {options.map((option) => (
        <Pressable
          key={option.label}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          disabled={busy}
          onPress={option.onPress}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            minHeight: 64,
            paddingHorizontal: 18,
            borderRadius: 16,
            backgroundColor: c.card,
            opacity: pressed || busy ? 0.6 : 1,
          })}
        >
          <option.icon size={24} color={c.text} strokeWidth={1.8} />
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>{option.label}</Text>
        </Pressable>
      ))}
    </StepSequence>
  );
}

// "Match me by": the four levers. Nearby asks for location; age asks for an age if we don't have one.
export function CirclePrefs({
  value,
  onChange,
  place,
  age,
  weeklyTarget,
  locating,
  locationDenied,
  onAge,
}: CirclePrefsProps) {
  const c = useColors();
  return (
    <StepSequence start={3} prefix="circle-prefs" style={{ gap: 12 }}>
      <MatchPreferencesList
        value={value}
        onChange={onChange}
        place={locating ? "Finding your area…" : place}
        age={age}
        weeklyTarget={weeklyTarget}
      />
      {value.wantsAge && !age && (
        <TextInput
          accessibilityLabel="Your age"
          keyboardType="number-pad"
          maxLength={3}
          placeholder="Your age"
          placeholderTextColor={c.muted}
          onChangeText={(text) => {
            const n = Number.parseInt(text, 10);
            if (n >= 13 && n <= 120) onAge(n);
          }}
          style={{
            minHeight: 52,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.inputBorder,
            backgroundColor: c.card,
            paddingHorizontal: 16,
            fontSize: 17,
            color: c.text,
          }}
        />
      )}
      <Text style={{ color: c.muted, fontSize: 14, textAlign: "center" }}>
        {locationDenied
          ? "Location is off, so we'll match by time zone instead."
          : "Others only see “same city”."}
      </Text>
    </StepSequence>
  );
}
