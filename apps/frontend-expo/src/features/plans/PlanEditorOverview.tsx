import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Button, Copy } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import type {
  PlanEditorOverviewItem,
  PlanEditorOverviewProps,
} from "./types";

function OverviewCard({ item }: { item: PlanEditorOverviewItem }) {
  const c = useColors();
  const Icon = item.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.label.toLowerCase()}`}
      onPress={item.onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 68,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.soft,
        }}
      >
        <Icon size={20} color={c.muted} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          {item.label}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: c.text, fontSize: 15, fontWeight: "600" }}
        >
          {item.value}
        </Text>
      </View>
      <ChevronRight size={19} color={c.muted} strokeWidth={1.8} />
    </Pressable>
  );
}

export function PlanEditorOverview({
  emoji,
  items,
  canSave,
  saving,
  onSave,
}: PlanEditorOverviewProps) {
  const c = useColors();
  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", gap: 6, paddingBottom: 4 }}>
        {emoji ? (
          <Text style={{ fontSize: 56, lineHeight: 66 }}>{emoji}</Text>
        ) : null}
        <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>
          Edit Plan
        </Text>
        <Copy muted>Tap any section to edit</Copy>
      </View>

      <View style={{ gap: 8 }}>
        {items.map((item) => (
          <OverviewCard key={item.label} item={item} />
        ))}
      </View>

      <View
        style={{
          gap: 8,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}
      >
        <Button disabled={!canSave} busy={saving} onPress={onSave}>
          Save Changes
        </Button>
        {!canSave && (
          <Copy muted>
            Set a goal to continue
          </Copy>
        )}
      </View>
    </View>
  );
}
