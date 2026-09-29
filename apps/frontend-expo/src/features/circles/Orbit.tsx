import { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Svg, { Ellipse } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { OrbitEllipse, OrbitPersonViewProps, OrbitProps } from "./types";

const TWO_PI = Math.PI * 2;
const PERIOD_MS = 36000;
// Start so that the first two people sit on the visible arc when motion is off.
const PHASE = 0.9;
const SLOTS = 5;

// The dashed track is wider than the screen, so only its lower arc shows.
function useEllipse(): OrbitEllipse & { width: number } {
  const { width } = useWindowDimensions();
  return { width, cx: width / 2, cy: -10, rx: width * 0.53, ry: width * 0.44 };
}

function Person({ person, index, turn, ellipse }: OrbitPersonViewProps) {
  const c = useColors();
  const size = person.isMe ? 46 : 40;
  const style = useAnimatedStyle(() => {
    // Same ellipse as the dashed line, so people always sit on it.
    const t = turn.value + PHASE + (index / SLOTS) * TWO_PI;
    const x = ellipse.cx + ellipse.rx * Math.cos(t);
    const y = ellipse.cy + ellipse.ry * Math.sin(t);
    const scale = 0.9 + 0.2 * Math.sin(t);
    return { transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }, { scale }] };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: person.empty ? c.bg : person.color,
          borderWidth: person.empty ? 1.5 : 3,
          borderStyle: person.empty ? "dashed" : "solid",
          borderColor: person.empty ? c.muted : person.isMe ? c.accent : c.bg,
        },
        style,
      ]}
    >
      {person.picture ? (
        <Image source={{ uri: person.picture }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        !person.empty && (
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: person.isMe ? 17 : 15 }}>
            {person.label.slice(0, 1).toUpperCase()}
          </Text>
        )
      )}
    </Animated.View>
  );
}

// People in the circle drifting slowly around a dashed orbit at the top of the screen.
export function Orbit({ people, height = 190 }: OrbitProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const ellipse = useEllipse();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(withTiming(TWO_PI, { duration: PERIOD_MS, easing: Easing.linear }), -1, false);
  }, [reduced, turn]);
  return (
    <View
      accessibilityLabel={`${people.filter((p) => !p.empty).length} people in this circle`}
      style={{ height, width: ellipse.width, overflow: "hidden", alignSelf: "center" }}
    >
      <Svg width={ellipse.width} height={height} style={{ position: "absolute" }}>
        <Ellipse
          cx={ellipse.cx}
          cy={ellipse.cy}
          rx={ellipse.rx}
          ry={ellipse.ry}
          fill="none"
          stroke={c.muted}
          strokeWidth={1.5}
          strokeDasharray="5 7"
          strokeLinecap="round"
          opacity={0.7}
        />
      </Svg>
      {people.slice(0, SLOTS).map((person, index) => (
        <Person key={person.key} person={person} index={index} turn={turn} ellipse={ellipse} />
      ))}
    </View>
  );
}
