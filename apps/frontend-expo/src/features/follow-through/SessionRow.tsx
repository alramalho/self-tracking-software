import { Pressable, View } from "react-native";
import { ChevronRight, Check } from "lucide-react-native";
import { router } from "expo-router";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { SessionRowProps } from "./types";
export function SessionRow({
  session,
  plan,
  grouped = false,
}: SessionRowProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plan.goal}, ${session.time || "pick a time"}`}
      onPress={() =>
        router.push(`/session/${encodeURIComponent(session.id)}` as never)
      }
      style={({ pressed }) => ({
        backgroundColor: grouped ? "transparent" : c.card,
        borderRadius: grouped ? 0 : 20,
        padding: 16,
        gap: 12,
        flexDirection: "row",
        alignItems: "center",
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text style={{ fontSize: 30 }}>{plan.emoji}</Text>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>
          {plan.goal}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {session.outcome === "UNCONFIRMED"
            ? `${session.time || "Any time"} · ${session.durationMinutes} min${session.timerRunning ? " · Timer running" : ""}`
            : session.outcome === "SKIPPED"
              ? "Not this time"
              : session.outcome === "PARTLY"
                ? "Partly done"
                : "Logged"}
        </Text>
      </View>
      {session.outcome === "DONE" ? (
        <Check color="#22c55e" size={20} />
      ) : (
        <ChevronRight color={c.muted} size={18} />
      )}
    </Pressable>
  );
}
