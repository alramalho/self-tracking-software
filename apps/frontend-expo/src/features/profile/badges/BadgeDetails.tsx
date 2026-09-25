import { Image, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flame, Medal, Sprout, X, ChevronRight } from "lucide-react-native";
import { router } from "expo-router";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import type { BadgeDetailsProps } from "./types";
const Touch = Pressable;
export function BadgeDetails({ user, kind, onClose }: BadgeDetailsProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const plans = (user.plans ?? []).filter(
    (p) =>
      !p.deletedAt &&
      (kind === "streaks"
        ? (p.progress?.achievement?.streak ?? 0) > 0
        : kind === "habits"
          ? p.progress?.habitAchievement?.isAchieved
          : p.progress?.lifestyleAchievement?.isAchieved),
  );
  const celebration = kind !== "streaks" && plans.length > 0;
  const color = kind === "lifestyles" ? "#f59e0b" : "#84cc16";
  const Icon = kind === "lifestyles" ? Medal : Sprout;
  const close = onClose;
  return (
    <View
      accessibilityViewIsModal
      testID="badge-details"
      style={{ flex: 1, paddingTop: 12, backgroundColor: c.card }}
    >
      <View
        style={{
          height: 48,
          alignItems: "center",
          justifyContent: "center",
          borderBottomWidth: 0.5,
          borderColor: c.border,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontWeight: "600", fontSize: 18 }}
        >
          Badge Details
        </Text>
        <View style={{ position: "absolute", right: 8, top: 0 }}>
          <Touch
            accessibilityRole="button"
            accessibilityLabel="Close badge details"
            onPress={close}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X color={c.muted} size={22} />
          </Touch>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {celebration && (
          <View
            style={{
              padding: 24,
              borderRadius: 16,
              backgroundColor: `${color}25`,
              gap: 12,
              alignItems: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {user.picture ? (
                <Image
                  source={{ uri: user.picture }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    borderWidth: 4,
                    borderColor: `${color}55`,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.soft,
                  }}
                >
                  <Text style={{ fontSize: 24, color: c.text }}>
                    {(user.name || "U")[0]}
                  </Text>
                </View>
              )}
              <Icon size={52} color={color} />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: c.text,
                textAlign: "center",
              }}
            >
              {user.name} achieved{" "}
              {plans.length > 1 ? `${plans.length} ` : "a "}
              {kind.slice(0, -1)} badge{plans.length > 1 ? "s" : ""}! 🎉
            </Text>
            <Text style={{ color: c.muted, textAlign: "center" }}>
              {plans.length > 1
                ? `Across ${plans.length} different plans!`
                : `By maintaining a ${plans[0].progress?.achievement?.streak ?? 0}-week streak on the plan`}
            </Text>
            {plans.length === 1 && (
              <Text
                style={{
                  fontSize: 18,
                  color: c.text,
                  textAlign: "center",
                }}
              >
                {plans[0].emoji} {plans[0].goal}
              </Text>
            )}
          </View>
        )}
        {plans.length > 0 ? (
          <View style={{ gap: 12 }}>
            <Text
              style={{
                color: c.text,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {user.name} Achievements:
            </Text>
            {plans.map((p) => (
              <Touch
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Explore streak for ${p.goal}`}
                onPress={() => {
                  router.replace(`/plan/${p.id}`);
                }}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 12,
                  backgroundColor: c.soft,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: c.text,
                      fontWeight: "500",
                    }}
                  >
                    {p.goal}
                  </Text>
                  <ChevronRight size={18} color={c.muted} />
                </View>
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 14,
                    marginTop: 8,
                  }}
                >
                  {kind === "streaks"
                    ? "Current streak:"
                    : kind === "habits"
                      ? "Habit achieved with"
                      : "Lifestyle achieved with"}{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {p.progress?.achievement?.streak ?? 0}
                  </Text>{" "}
                  {kind === "streaks" ? "weeks" : "week streak"}
                </Text>
              </Touch>
            ))}
          </View>
        ) : (
          <Text style={{ color: c.muted, fontSize: 14 }}>
            No{" "}
            {kind === "streaks"
              ? "active streaks"
              : `${kind.slice(0, -1)} badges`}{" "}
            yet.
          </Text>
        )}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "600",
            color: c.text,
            marginTop: 8,
          }}
        >
          🏆 How badges are earned
        </Text>
        {[
          {
            title: "Streaks:",
            Icon: Flame,
            color: "#ef4444",
            rules: [
              "Each completed week adds +1 to your streak",
              "Each missed week subtracts -1 from your streak, starting with the first",
              "Streak score cannot go below 0",
            ],
          },
          {
            title: "Habit badge:",
            Icon: Sprout,
            color: "#84cc16",
            rules: [
              "You get a habit badge if you achieve a streak of 4 weeks!",
            ],
          },
          {
            title: "Lifestyle badge:",
            Icon: Medal,
            color: "#eab308",
            rules: [
              "You get a lifestyle badge if you achieve a streak of 9 weeks!",
            ],
          },
        ].map(({ title, Icon, color, rules }) => (
          <View
            key={title}
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: c.soft,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon size={24} color={color} />
              <Text
                style={{
                  color: c.text,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                {title}
              </Text>
            </View>
            {rules.map((rule) => (
              <Text
                key={rule}
                style={{
                  color: c.muted,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                • {rule}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
