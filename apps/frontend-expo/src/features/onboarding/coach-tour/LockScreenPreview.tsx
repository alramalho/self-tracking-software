import { Image, ImageBackground, View } from "react-native";
import { format } from "date-fns";
import { Text } from "@/components/typography/Text";
import type { LockScreenPreviewProps } from "./types";

const BEZEL = "#2b2b2e";

/** The top of an iPhone's lock screen with the coach's push, as on the website. */
export function LockScreenPreview({ coachName, message }: LockScreenPreviewProps) {
  return (
    <View
      testID="lock-screen-preview"
      accessible
      accessibilityLabel={`Example notification from ${coachName}: ${message}`}
      style={{
        height: 236,
        borderWidth: 9,
        borderBottomWidth: 0,
        borderColor: BEZEL,
        borderTopLeftRadius: 52,
        borderTopRightRadius: 52,
        overflow: "hidden",
        backgroundColor: "#0f2a3d",
      }}
    >
      <ImageBackground
        source={require("../../../../assets/onboarding/lock-screen-wallpaper.jpg")}
        resizeMode="cover"
        style={{ flex: 1, alignItems: "center", paddingHorizontal: 10 }}
      >
        <View style={{ marginTop: 10, width: 92, height: 27, borderRadius: 14, backgroundColor: "#000" }} />
        <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" }}>
          {format(new Date(), "EEEE d MMMM")}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 50, lineHeight: 56, fontWeight: "700", letterSpacing: -1 }}>
          9:41
        </Text>
        <View
          style={{
            alignSelf: "stretch",
            marginTop: 6,
            flexDirection: "row",
            gap: 10,
            padding: 12,
            borderRadius: 22,
            backgroundColor: "rgba(28,28,30,0.9)",
          }}
        >
          <Image source={require("../../../../assets/icon.png")} style={{ width: 38, height: 38, borderRadius: 9 }} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{coachName}</Text>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>now</Text>
            </View>
            <Text style={{ color: "#fff", fontSize: 15, lineHeight: 20 }}>{message}</Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}
