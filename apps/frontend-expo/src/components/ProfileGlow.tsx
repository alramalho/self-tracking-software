import { useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useColors } from "./theme";

export function ProfileGlow() {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <RadialGradient
          id="profile-glow"
          gradientUnits="userSpaceOnUse"
          cx={width * 0.6}
          cy={height * 0.05}
          r={800}
        >
          <Stop offset="0" stopColor={c.bright} stopOpacity={0.3} />
          <Stop offset="0.4" stopColor={c.bright} stopOpacity={0.05} />
          <Stop offset="1" stopColor={c.bright} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#profile-glow)" />
    </Svg>
  );
}
