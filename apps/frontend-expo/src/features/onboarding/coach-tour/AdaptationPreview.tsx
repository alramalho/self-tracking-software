import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { CoachNote } from "@/features/messages/adaptation/CoachNote";
import { ChangeHero } from "@/features/messages/PlanSetupChange";
import type { CoachPreviewProps } from "./types";

/** A look-alike button: the preview shows the choice, it doesn't make one. */
function FauxButton({ label, primary }: { label: string; primary?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        minHeight: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: primary ? 0 : 1,
        borderColor: c.border,
        backgroundColor: primary ? c.accent : c.card,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "700", color: primary ? "#fff" : c.text }}>{label}</Text>
    </View>
  );
}

/** The same note, 6 → 5 and choice as the real Review Changes sheet. */
export function AdaptationPreview({ strategist }: CoachPreviewProps) {
  const c = useColors();
  return (
    <View
      testID="adaptation-preview"
      accessible
      accessibilityLabel="Example: after a hard week, your coach suggests going from 6 to 5 sessions a week. You accept or reject."
      style={{ gap: 18, padding: 18, borderRadius: 24, backgroundColor: c.card }}
    >
      <CoachNote strategist={strategist} mood="sad">
        <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>
          Six didn't hold this week. Five keeps the habit going.
        </Text>
      </CoachNote>
      <ChangeHero from="6" to="5" caption="sessions a week" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <FauxButton label="Reject" />
        <FauxButton label="Accept" primary />
      </View>
    </View>
  );
}
