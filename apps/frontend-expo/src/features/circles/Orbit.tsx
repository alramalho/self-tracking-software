import { useEffect, useState } from "react";
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

// Onboarding: the dashed track is wider than the screen, so only its lower arc shows.
// Ring (the circle page): the whole ellipse fits its container.
function ellipseFor(width: number, height: number, ring: boolean): OrbitEllipse {
  return ring
    ? { cx: width / 2, cy: height / 2, rx: width / 2 - 26, ry: height / 2 - 24 }
    : { cx: width / 2, cy: -10, rx: width * 0.53, ry: width * 0.44 };
}

function Person({ person, index, slots, small, turn, ellipse }: OrbitPersonViewProps) {
  const c = useColors();
  const size = small ? (person.isMe ? 38 : 34) : person.isMe ? 46 : 40;
  const style = useAnimatedStyle(() => {
    // Same ellipse as the dashed line, so people always sit on it.
    const t = turn.value + PHASE + (index / slots) * TWO_PI;
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
          borderWidth: person.empty ? 1.5 : small ? 2 : 3,
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
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: small ? 13 : person.isMe ? 17 : 15 }}>
            {person.label.slice(0, 1).toUpperCase()}
          </Text>
        )
      )}
    </Animated.View>
  );
}

// People in the circle drifting slowly around a dashed orbit at the top of the screen.
export function Orbit({ people, height = 190, ring = false }: OrbitProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const window = useWindowDimensions();
  // The ring takes its container's width; the onboarding arc spans the screen.
  const [measured, setMeasured] = useState(0);
  const width = ring ? measured : window.width;
  const ellipse = ellipseFor(width, height, ring);
  const shown = people.slice(0, ring ? 8 : SLOTS);
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(withTiming(TWO_PI, { duration: PERIOD_MS, easing: Easing.linear }), -1, false);
  }, [reduced, turn]);
  return (
    <View
      accessibilityLabel={`${people.filter((p) => !p.empty).length} people in this circle`}
      onLayout={ring ? (event) => setMeasured(event.nativeEvent.layout.width) : undefined}
      style={{ height, width: ring ? "100%" : width, overflow: "hidden", alignSelf: "center" }}
    >
      {width > 0 && (
        <Svg width={width} height={height} style={{ position: "absolute" }}>
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
      )}
      {width > 0 &&
        shown.map((person, index) => (
          <Person
            key={person.key}
            person={person}
            index={index}
            slots={ring ? shown.length : SLOTS}
            small={ring}
            turn={turn}
            ellipse={ellipse}
          />
        ))}
    </View>
  );
}
