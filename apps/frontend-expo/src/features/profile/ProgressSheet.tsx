import { Image, View } from "react-native";
import {
  Check,
  Crown,
  Gem,
  Medal,
  Rocket,
  Sprout,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { User } from "@/core/types";
import { LoggingDrawer } from "../activities/logging/LoggingDrawer";
import { accountLevels, profileStats } from "./model";

interface ProgressSheetProps {
  user: User;
  stats: ReturnType<typeof profileStats>;
  onClose: () => void;
}

const levelIcons: Record<string, LucideIcon> = {
  New: Target,
  Bronze: Medal,
  Silver: Medal,
  Gold: Crown,
  Platinum: Star,
  Diamond: Gem,
};

const levelIconColors: Record<string, [string, string]> = {
  New: ["#99a1af", "#6a7282"],
  Bronze: ["#e17100", "#fe9a00"],
  Silver: ["#90a1b9", "#cad5e2"],
  Gold: ["#efb100", "#fdc700"],
  Platinum: ["#cad5e2", "#90a1b9"],
  Diamond: ["#00d3f2", "#53eafd"],
};

const bonusGreen = "#00c950";

function levelColor(level: (typeof accountLevels)[number], dark: boolean) {
  return dark ? level.dark : level.light;
}

export function ProgressSheet({ user, stats, onClose }: ProgressSheetProps) {
  const c = useColors();
  const currentIconColor =
    levelIconColors[stats.level.name]?.[c.dark ? 1 : 0] ?? c.muted;
  const CurrentIcon = levelIcons[stats.level.name] ?? Target;

  return (
    <LoggingDrawer
      testID="progress-details"
      dismissLabel="Dismiss progress details"
      contentPadding={40}
      onClose={onClose}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ position: "relative" }}>
          {user.picture ? (
            <Image
              source={{ uri: user.picture }}
              style={{ width: 56, height: 56, borderRadius: 28 }}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.soft,
              }}
            >
              <Text style={{ color: c.text, fontSize: 24 }}>
                {(user.name ?? "U")[0]}
              </Text>
            </View>
          )}
          <CurrentIcon
            size={24}
            color={currentIconColor}
            style={{ position: "absolute", right: -6, bottom: -6 }}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ color: c.text, fontSize: 20, fontWeight: "700" }}
          >
            {user.name ?? user.username ?? "Your account"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                color: levelColor(stats.level, c.dark),
                fontSize: 17,
                fontWeight: "500",
              }}
            >
              {stats.level.name}
            </Text>
            <Text style={{ color: c.muted, fontSize: 18 }}>•</Text>
            <Text style={{ color: c.muted, fontSize: 17 }}>
              {stats.points} points
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>
              ({stats.activities} from activities)
            </Text>
            {stats.bonusPoints > 0 && (
              <Text style={{ color: bonusGreen, fontSize: 14 }}>
                (+{stats.bonusPoints} bonus)
              </Text>
            )}
          </View>
        </View>
      </View>

      {stats.next ? (
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: c.muted, fontSize: 18 }}>
              Next: {" "}
              <Text
                style={{ color: levelColor(stats.next, c.dark), fontWeight: "500" }}
              >
                {stats.next.name}
              </Text>
            </Text>
            <View
              style={{
                minWidth: 52,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
                backgroundColor: c.soft,
                alignItems: "center",
              }}
            >
              <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
                {Math.round(stats.percentage)}%
              </Text>
            </View>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Progress to next level"
            accessibilityValue={{ min: 0, max: 100, now: stats.percentage }}
            style={{
              height: 10,
              overflow: "hidden",
              borderRadius: 6,
              backgroundColor: c.card,
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, stats.percentage))}%`,
                height: "100%",
                borderRadius: 6,
                backgroundColor: levelColor(stats.next, c.dark),
              }}
            />
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderColor: c.border,
              paddingTop: 16,
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text style={{ color: c.muted, fontSize: 18 }}>
              Total: <Text style={{ color: c.text }}>{stats.points} points</Text>
            </Text>
            <View style={{ alignItems: "center", gap: 10, opacity: 0.58 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Target size={24} color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 16 }}>
                  activity worth 1 point
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sprout size={24} color="#84cc16" />
                <Text style={{ color: "#84cc16", fontSize: 16 }}>
                  habit <Text style={{ color: c.muted }}>worth 25 bonus points</Text>
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Rocket size={24} color="#f97316" />
                <Text style={{ color: "#f97316", fontSize: 16 }}>
                  lifestyle <Text style={{ color: c.muted }}>worth 100 bonus points</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 16 }}>
          <Trophy size={28} color={c.muted} />
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
            Max Level Reached
          </Text>
          <Text style={{ color: c.muted, textAlign: "center" }}>
            You&apos;ve unlocked all available levels
          </Text>
        </View>
      )}

      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Target size={24} color={c.muted} />
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
            All Levels
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          {accountLevels.map((level) => {
            const unlocked = stats.points >= level.threshold;
            const current = stats.level.name === level.name;
            const Icon = levelIcons[level.name] ?? Target;
            const iconColor =
              levelIconColors[level.name]?.[c.dark ? 1 : 0] ?? c.muted;
            return (
              <View
                key={level.name}
                accessibilityLabel={`${level.name} level${current ? ", current" : ""}`}
                style={{
                  minHeight: 74,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: unlocked ? c.border : `${c.border}66`,
                  borderRadius: 14,
                  backgroundColor: unlocked ? c.card : c.soft,
                  opacity: unlocked ? 1 : 0.58,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.soft,
                  }}
                >
                  <Icon size={28} color={iconColor} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: unlocked ? c.text : c.muted,
                        fontSize: 18,
                        fontWeight: "600",
                      }}
                    >
                      {level.name}
                    </Text>
                    {current ? (
                      <View
                        style={{
                          paddingHorizontal: 13,
                          paddingVertical: 5,
                          borderRadius: 18,
                          backgroundColor: c.dark ? "#fafafa" : c.text,
                        }}
                      >
                        <Text
                          style={{
                            color: c.dark ? "#18181b" : c.bg,
                            fontSize: 15,
                            fontWeight: "600",
                          }}
                        >
                          Current
                        </Text>
                      </View>
                    ) : (
                      unlocked && <Check size={28} color={c.muted} />
                    )}
                  </View>
                  <Text style={{ color: c.muted, fontSize: 15 }}>
                    {level.threshold === 0
                      ? "Starting level"
                      : `${level.threshold} points required`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderTopWidth: 1,
          borderColor: c.border,
          paddingTop: 18,
        }}
      >
        <Zap size={30} color={c.muted} />
        <Text style={{ flex: 1, color: c.muted, fontSize: 15, lineHeight: 21 }}>
          Keep logging activities and create plans to unlock new levels!
        </Text>
      </View>
    </LoggingDrawer>
  );
}
