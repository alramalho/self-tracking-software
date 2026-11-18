import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { FadeProps } from "../types";

// A strip that dissolves the thread into the page colour where chrome floats over it.
export function Fade({ color, toward, height, style }: FadeProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Stops must run in ascending order, so the opacity flips instead of the offsets.
  const opacityAt = (offset: number) => (toward === "top" ? 1 - offset : offset);
  return (
    <View pointerEvents="none" style={[{ height }, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={color} stopOpacity={opacityAt(0)} />
            <Stop offset={0.5} stopColor={color} stopOpacity={0.6} />
            <Stop offset={1} stopColor={color} stopOpacity={opacityAt(1)} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
