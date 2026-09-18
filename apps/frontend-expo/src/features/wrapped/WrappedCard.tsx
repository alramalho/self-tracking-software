import { Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { ArrowRight, Sparkles } from "lucide-react-native";
import { router } from "expo-router";
import { useColors } from "@/components/theme";
import { Text } from "@/components/typography/Text";
import { WRAPPED_YEAR } from "./model";
export function WrappedCard() {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your ${WRAPPED_YEAR} wrapped`}
      onPress={() => router.push("/wrapped")}
      style={{ borderRadius: 16, padding: 2, marginTop: 12 }}
    >
      <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="wrapped-shine" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#f97316" />
              <Stop offset="0.33" stopColor="#ec4899" />
              <Stop offset="0.66" stopColor="#8b5cf6" />
              <Stop offset="1" stopColor="#06b6d4" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={16} fill="url(#wrapped-shine)" />
        </Svg>
      </View>
      <View
        style={{
          backgroundColor: c.card,
          padding: 16,
          borderRadius: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Sparkles size={20} color="#f59e0b" />
        <Text
          style={{
            flex: 1,
            fontFamily: "ZalandoExpanded-Italic",
            fontSize: 20,
            color: c.text,
          }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          Your {WRAPPED_YEAR} wrapped
        </Text>
        <ArrowRight size={20} color={c.muted} />
      </View>
    </Pressable>
  );
}
