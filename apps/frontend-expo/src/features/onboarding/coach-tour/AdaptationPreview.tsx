import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { CoachNote } from "@/features/messages/adaptation/CoachNote";
import { ChangeHero } from "@/features/messages/PlanSetupChange";
import type { CoachPreviewProps } from "./types";

/** The same note and 6 → 5 as the real Review Changes sheet, without its buttons. */
export function AdaptationPreview({ strategist }: CoachPreviewProps) {
  const c = useColors();
  return (
    <View
      testID="adaptation-preview"
      accessible
      accessibilityLabel="Example: after a hard week, your coach suggests going from 6 to 5 sessions a week."
      style={{ gap: 18, padding: 18, borderRadius: 24, backgroundColor: c.card }}
    >
      <CoachNote strategist={strategist} mood="sad">
        <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>
          Six didn't hold this week. Five keeps the habit going.
        </Text>
      </CoachNote>
      <ChangeHero from="6" to="5" caption="sessions a week" />
    </View>
  );
}
