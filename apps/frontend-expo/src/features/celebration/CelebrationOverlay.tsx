/**
 * The moment after a log (designed with the owner, 14 Nov 2026, from Strava's "Nice work!"): a wave in the
 * accent colour floods up from the button, line icons burst, the screen settles dark (or light) with two
 * thick ribbons drawn in, and "Nice work!", the activity and the plan card come in one after another. The
 * plan's stepper fills the new step with a pop, a tiny tilt, a sound and a haptic. When that step completes
 * the week, the bar fuses and flashes, confetti bursts and rains, the flame wakes, the ribbons turn warm,
 * "Nice work!" blurs into "Week done" with a chord, and the streak goes up. It closes by itself (a tap closes
 * it sooner) and fades into the "Saved" sheet already open underneath, which holds "Share more" (20 Nov 2026).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Check, Circle, Flame, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { Celebration } from "./model";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const W = 390;
const H = 844;
const SLOW = 1.35;
const ms = (value: number) => value * SLOW;
const out = Easing.bezier(0.22, 1, 0.36, 1);
const GREEN = "#22c55e";
const WARM = "#f97316";
const STEP_SOUNDS = [
  require("../../../assets/sounds/step-0.wav"),
  require("../../../assets/sounds/step-1.wav"),
  require("../../../assets/sounds/step-2.wav"),
  require("../../../assets/sounds/step-3.wav"),
  require("../../../assets/sounds/step-4.wav"),
  require("../../../assets/sounds/step-5.wav"),
];
const WEEK_SOUND = require("../../../assets/sounds/week-done.wav");

const RIBBON_TOP = "M 470 -40 C 380 120, 260 160, 150 210 S -40 330, -80 380";
const RIBBON_BOTTOM = "M -80 760 C 40 700, 140 690, 230 720 S 380 800, 480 740";
const RIBBON_LENGTH = 1400;

// ---- timeline (ms after the overlay opens) ----
const T_WAVE = 0;
const T_ICONS = ms(380);
const T_SETTLE = ms(650);
const T_ENTER = T_SETTLE + ms(250);
const STAGGER = ms(110);
const T_CARD_PARTS = T_ENTER + 3 * STAGGER + ms(160);
const PART_STAGGER = ms(70);

function playSound(player: AudioPlayer | undefined) {
  try {
    if (!player) return;
    player.seekTo(0);
    player.play();
  } catch {}
}
function haptic(kind: "step" | "week") {
  if (Platform.OS === "web") return;
  void (kind === "step"
    ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  ).catch(() => {});
}

export function CelebrationOverlay({
  celebration,
  onDone,
  embedded,
}: {
  celebration: Celebration;
  onDone: () => void;
  /** Drawn inside another modal (the Saved sheet's, via LoggingDrawer's overlay) instead of opening its own. */
  embedded?: boolean;
}) {
  const c = useColors();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const sx = width / W;
  const sy = height / H;
  const plan = celebration.plan;
  const steps = plan ? Math.max(1, plan.target) : 0;
  const moves = !!plan && plan.after > plan.before;
  const [done, setDone] = useState(plan?.before ?? 0);
  const [streak, setStreak] = useState(plan?.streakBefore ?? 0);
  const players = useRef<{ step?: AudioPlayer; week?: AudioPlayer }>({});
  const closed = useRef(false);

  const wave = useSharedValue(0);
  const settle = useSharedValue(0);
  const ribbons = useSharedValue(0);
  const ribbons2 = useSharedValue(0);
  const warm = useSharedValue(0);
  const fill = useSharedValue(0);
  const pop = useSharedValue(0);
  const fuse = useSharedValue(0);
  const roll = useSharedValue(0);
  const flame = useSharedValue(0);
  const fade = useSharedValue(1);
  const enter = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const parts = Array.from({ length: 8 }, () => useSharedValue(0)); // icon, up to 5 steps, flame, count
  const iconBurst = useSharedValue(0);
  const stepBurst = useSharedValue(0);
  const weekBurst = useSharedValue(0);
  const rain = useSharedValue(0);

  // A slow fade, so the "Saved" sheet underneath shows through rather than popping in.
  const finish = () => {
    if (closed.current) return;
    closed.current = true;
    fade.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
    setTimeout(onDone, 440);
  };

  useEffect(() => {
    try {
      if (moves) players.current.step = createAudioPlayer(STEP_SOUNDS[Math.min(plan!.before, STEP_SOUNDS.length - 1)]);
      if (celebration.weekDone) players.current.week = createAudioPlayer(WEEK_SOUND);
    } catch {}
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (t: number, fn: () => void) => timers.push(setTimeout(fn, t));
    const spring = { damping: 12, stiffness: 180, mass: 0.8 };

    if (reduced) {
      settle.value = 1;
      ribbons.value = 1;
      ribbons2.value = 1;
      enter.forEach((v) => (v.value = 1));
      parts.forEach((v) => (v.value = 1));
      at(300, () => {
        if (!moves) return;
        fill.value = withTiming(1, { duration: 200 });
        setDone(plan!.after);
        playSound(players.current.step);
        haptic("step");
        if (celebration.weekDone) {
          fuse.value = 1;
          roll.value = 1;
          warm.value = 1;
          setStreak(plan!.streakAfter);
          playSound(players.current.week);
          haptic("week");
        }
      });
      at(2400, () => finish());
      return () => timers.forEach(clearTimeout);
    }

    wave.value = withDelay(T_WAVE, withTiming(1, { duration: ms(650), easing: Easing.out(Easing.cubic) }));
    iconBurst.value = withDelay(T_ICONS, withTiming(1, { duration: ms(1300), easing: Easing.linear }));
    settle.value = withDelay(T_SETTLE, withTiming(1, { duration: ms(380), easing: out }));
    ribbons.value = withDelay(T_SETTLE, withTiming(1, { duration: ms(900) * 1.15, easing: out }));
    ribbons2.value = withDelay(T_SETTLE + ms(220), withTiming(1, { duration: ms(900) * 1.15, easing: out }));
    enter.forEach((v, i) => (v.value = withDelay(T_ENTER + i * STAGGER, withSpring(1, spring))));
    const partCount = 3 + steps;
    parts.slice(0, partCount).forEach((v, i) => (v.value = withDelay(T_CARD_PARTS + i * PART_STAGGER, withSpring(1, spring))));
    const tStep = T_CARD_PARTS + partCount * PART_STAGGER + ms(380);

    if (moves) {
      // One smooth fill that stops at full: the spring here overshot and pulled the bar back to ~75% (18 Nov 2026).
      fill.value = withDelay(tStep, withTiming(1, { duration: 420, easing: out }));
      pop.value = withDelay(tStep, withSequence(withTiming(1, { duration: 150 }), withTiming(-0.25, { duration: 160 }), withTiming(0, { duration: 170 })));
      stepBurst.value = withDelay(tStep, withTiming(1, { duration: 700, easing: Easing.linear }));
      at(tStep, () => {
        playSound(players.current.step);
        haptic("step");
      });
      at(tStep + 160, () => setDone(plan!.after));
    }
    let end = tStep + ms(900);
    if (moves && celebration.weekDone) {
      const tFuse = tStep + ms(750);
      const tBoom = tFuse + ms(380);
      fuse.value = withDelay(tFuse, withTiming(1, { duration: ms(260), easing: out }));
      roll.value = withDelay(tBoom, withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }));
      flame.value = withDelay(tBoom, withSpring(1, { damping: 8, stiffness: 120 }));
      warm.value = withDelay(tBoom, withTiming(1, { duration: ms(700) }));
      weekBurst.value = withDelay(tBoom, withTiming(1, { duration: 1800, easing: Easing.linear }));
      rain.value = withDelay(tBoom, withTiming(1, { duration: 4200, easing: Easing.linear }));
      at(tBoom, () => {
        playSound(players.current.week);
        haptic("week");
      });
      at(tBoom + ms(300), () => setStreak(plan!.streakAfter));
      end = tBoom + ms(2200);
    }
    at(end + 1100, () => finish());
    return () => {
      timers.forEach(clearTimeout);
      for (const p of Object.values(players.current)) {
        try {
          p?.remove();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalBg = c.dark ? "#0b0b0c" : "#f7f7f8";
  const track = c.dark ? "#3a3a3d" : "#e4e4e7";

  const waveProps = useAnimatedProps(() => {
    const p = wave.value;
    const y = H - p * 960;
    const amp = 70 * (1 - p) + 10;
    const bx = 195 + Math.sin(p * 3) * 40;
    return {
      d: `M0 ${H} L0 ${y + amp} C ${bx - 160} ${y + amp}, ${bx - 90} ${y - amp}, ${bx} ${y - amp} S ${bx + 150} ${y + amp * 0.6}, ${W} ${y + amp * 0.4} L${W} ${H} Z`,
    };
  });
  const ribbonProps = (v: SharedValue<number>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedProps(() => ({
      strokeDashoffset: RIBBON_LENGTH * (1 - v.value),
      strokeOpacity: v.value > 0 ? 1 : 0,
    }));
  const ribbonLayers = [
    [ribbonProps(ribbons), ribbonProps(ribbons2)],
    [ribbonProps(ribbons), ribbonProps(ribbons2)],
  ];
  const settleStyle = useAnimatedStyle(() => ({ opacity: settle.value }));
  // Week done: an orange copy of the ribbons fades in over the accent ones (an animated stroke colour
  // didn't repaint on web; an opacity fade looks the same and works everywhere).
  const warmStyle = useAnimatedStyle(() => ({ opacity: warm.value }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const enterStyle = (v: SharedValue<number>, dy: number, from = 0.96) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      opacity: Math.min(1, v.value * 1.4),
      transform: [{ translateY: (1 - v.value) * dy }, { scale: from + (1 - from) * v.value }],
    }));
  const headlineStyle = enterStyle(enter[0], 10, 0.7);
  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: enter[1].value }, { rotate: `${(1 - enter[1].value) * -20}deg` }],
  }));
  const lineStyle = enterStyle(enter[2], 14);
  const cardEnter = enterStyle(enter[3], 22);
  const cardPop = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.018 }, { rotate: `${pop.value * -0.6}deg` }],
  }));

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + flame.value * 0.25 }, { rotate: `${flame.value * -4}deg` }] }));
  const fusedStyle = useAnimatedStyle(() => ({ opacity: fuse.value }));
  const gapStyle = useAnimatedStyle(() => ({ gap: 6 * (1 - fuse.value) }));

  const body = (
      <Animated.View style={[StyleSheet.absoluteFill, rootStyle]} testID="log-celebration">
        <Pressable style={StyleSheet.absoluteFill} onPress={() => finish()} accessibilityRole="button" accessibilityLabel="Close">
          {!reduced && (
            <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <AnimatedPath animatedProps={waveProps} fill={c.accent} />
            </Svg>
          )}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: finalBg }, reduced ? null : settleStyle]} />
          {[c.accent, WARM].map((color, layer) => (
            <Animated.View key={color} pointerEvents="none" style={[StyleSheet.absoluteFill, layer ? warmStyle : null]}>
              <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <AnimatedPath d={RIBBON_TOP} fill="none" stroke={color} strokeWidth={58} strokeLinecap="round" strokeDasharray={`${RIBBON_LENGTH} ${RIBBON_LENGTH}`} animatedProps={ribbonLayers[layer][0]} />
                <AnimatedPath d={RIBBON_BOTTOM} fill="none" stroke={color} strokeWidth={58} strokeLinecap="round" strokeDasharray={`${RIBBON_LENGTH} ${RIBBON_LENGTH}`} animatedProps={ribbonLayers[layer][1]} />
              </Svg>
            </Animated.View>
          ))}

          {!reduced && <IconBurst progress={iconBurst} x={195 * sx} y={560 * sy} />}

          <View style={[styles.headline, { top: 190 * sy }]}>
            <Animated.View style={headlineStyle}>
              <View style={styles.rollWindow}>
                <BlurText text="Nice work!" progress={roll} out color={c.text} />
                <BlurText text="Week done" progress={roll} color={c.text} />
              </View>
            </Animated.View>
          </View>

          <View style={[styles.center, { top: 290 * sy }]}>
            <Animated.Text style={[styles.emoji, emojiStyle]}>{celebration.emoji}</Animated.Text>
            <Animated.View style={lineStyle}>
              <Text style={[styles.line, { color: c.text }]} testID="log-celebration-line">
                {celebration.line}
              </Text>
            </Animated.View>
            {plan && (
              <Animated.View style={[styles.card, { backgroundColor: c.dark ? "#232325" : "#ffffff" }, cardEnter]}>
                <Animated.View style={cardPop}>
                  <View style={styles.row}>
                    <Part v={parts[0]}>
                      <Text style={styles.planEmoji}>{plan.emoji}</Text>
                    </Part>
                    <Animated.View style={[styles.steps, gapStyle]}>
                      {Array.from({ length: steps }, (_, i) => (
                        <Part key={i} v={parts[1 + Math.min(i, 4)]} grow>
                          <Step
                            index={i}
                            filled={i < plan.before}
                            filling={moves && i === plan.before}
                            fill={fill}
                            pop={pop}
                            track={track}
                          />
                        </Part>
                      ))}
                      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fused, fusedStyle]} />
                      {moves && <StepBurst progress={stepBurst} index={plan.before} steps={steps} />}
                    </Animated.View>
                    <Part v={parts[1 + Math.min(steps, 5)]}>
                      <Animated.View style={flameStyle}>
                        <Flame size={22} color={WARM} strokeWidth={2.2} />
                      </Animated.View>
                    </Part>
                  </View>
                  <Part v={parts[2 + Math.min(steps, 5)]}>
                    <View style={styles.count}>
                      <Text style={[styles.countText, { color: c.muted }]} testID="log-celebration-count">
                        <Text style={[styles.countNum, { color: c.text }]}>{done}</Text> of {plan.target} this week
                      </Text>
                      <Text style={[styles.countText, { color: celebration.weekDone && streak > plan.streakBefore ? WARM : c.muted }]}>
                        <Text style={[styles.countNum, { color: celebration.weekDone && streak > plan.streakBefore ? WARM : c.text }]}>{streak}</Text>{" "}
                        {streak === 1 ? "week" : "weeks"}
                      </Text>
                    </View>
                  </Part>
                </Animated.View>
              </Animated.View>
            )}
          </View>


          {celebration.weekDone && !reduced && (
            <>
              <ConfettiBurst progress={weekBurst} x={195 * sx} y={(290 + 200) * sy} />
              <Rain progress={rain} width={width} height={height} />
            </>
          )}
        </Pressable>
      </Animated.View>
  );
  if (embedded) return body;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => finish()}>
      {body}
    </Modal>
  );
}

/**
 * A quick blur cross-fade ("Nice work!" → "Week done"). Text can't be blurred on iOS, so faint copies spread
 * around the word stand in for the blur, widest halfway through, while the word itself fades.
 */
const GHOSTS = [
  [-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7],
] as const;
function BlurText({ text, progress, out, color }: { text: string; progress: SharedValue<number>; out?: boolean; color: string }) {
  // 0 = sharp and shown, 1 = fully blurred away. Inline: a worklet can't call a plain JS function on the UI thread.
  const mainStyle = useAnimatedStyle(() => {
    const a = out ? progress.value : 1 - progress.value;
    return { opacity: Math.max(0, 1 - a * 1.6), transform: [{ scale: 1 + a * 0.06 }] };
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {GHOSTS.map(([gx, gy], i) => (
        <Ghost key={i} text={text} progress={progress} out={out} color={color} gx={gx} gy={gy} />
      ))}
      <Animated.Text testID={out ? "log-celebration-nice" : "log-celebration-week"} style={[styles.headlineText, styles.headlineAbs, { color }, mainStyle]}>
        {text}
      </Animated.Text>
    </View>
  );
}
function Ghost({ text, progress, out, color, gx, gy }: { text: string; progress: SharedValue<number>; out?: boolean; color: string; gx: number; gy: number }) {
  const style = useAnimatedStyle(() => {
    const a = out ? progress.value : 1 - progress.value;
    const spread = a * 7;
    // The blur is strongest while the word is leaving or arriving, and gone when it's sharp.
    const opacity = a <= 0 || a >= 1 ? 0 : 0.22 * Math.sin(Math.PI * Math.min(1, a * 1.2));
    return { opacity, transform: [{ translateX: gx * spread }, { translateY: gy * spread }, { scale: 1 + a * 0.06 }] };
  });
  return (
    <Animated.Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.headlineText, styles.headlineAbs, { color }, style]}>
      {text}
    </Animated.Text>
  );
}

function Part({ v, children, grow }: { v: SharedValue<number>; children: React.ReactNode; grow?: boolean }) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.value * 1.4),
    transform: [{ translateY: (1 - v.value) * 6 }, { scale: 0.85 + 0.15 * v.value }],
  }));
  return <Animated.View style={[grow ? { flex: 1 } : null, style]}>{children}</Animated.View>;
}

function Step(props: { index: number; filled: boolean; filling: boolean; fill: SharedValue<number>; pop: SharedValue<number>; track: string }) {
  const { filled, filling, fill, pop } = props;
  const fillStyle = useAnimatedStyle(() => ({ width: `${(filled ? 1 : filling ? Math.min(1, fill.value) : 0) * 100}%` }));
  const popStyle = useAnimatedStyle(() =>
    filling ? { transform: [{ scaleX: 1 + pop.value * 0.08 }, { scaleY: 1 + pop.value * 0.15 }, { rotate: `${pop.value * -1.5}deg` }] } : {},
  );
  return (
    <Animated.View style={[styles.step, { backgroundColor: props.track }, popStyle]}>
      <Animated.View testID={props.filling ? "log-celebration-filling" : undefined} style={[styles.stepFill, fillStyle]} />
    </Animated.View>
  );
}

// ---- particles: a fixed set of random paths, played by one progress value each ----
type Particle = { vx: number; vy: number; rot: number; vr: number; size: number; color: string; icon: number; delay: number; x: number };
const rand = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
function particles(n: number, seed: number, speed: number, colors: string[]) {
  const r = rand(seed);
  return Array.from({ length: n }, (_, i): Particle => {
    const a = (Math.PI * 2 * i) / n + r() * 0.5;
    const v = speed * (0.5 + r());
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, rot: r() * 6, vr: (r() - 0.5) * 0.3, size: 0.9 + r() * 0.9, color: colors[i % colors.length], icon: i % 4, delay: 0, x: r() };
  });
}
/** Frame-based physics from the prototype (60 fps): velocity damped by 1.5% a frame, constant gravity. */
function Flying({ p, progress, frames, gravity, x, y, children, w, h }: { p: Particle; progress: SharedValue<number>; frames: number; gravity: number; x: number; y: number; children?: React.ReactNode; w?: number; h?: number }) {
  const style = useAnimatedStyle(() => {
    const f = progress.value * frames;
    const damp = (1 - Math.pow(0.985, f)) / 0.015;
    return {
      opacity: progress.value <= 0 || progress.value >= 1 ? 0 : Math.max(0, 1 - f / frames),
      transform: [
        { translateX: x + p.vx * damp },
        { translateY: y + p.vy * f + (gravity * f * f) / 2 },
        { rotate: `${p.rot + p.vr * f}rad` },
        { scale: p.size },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.particle, w ? { width: w, height: h, backgroundColor: p.color } : null, style]}>{children}</Animated.View>;
}
const ICONS = [Check, Flame, Plus, Circle];
function IconBurst({ progress, x, y }: { progress: SharedValue<number>; x: number; y: number }) {
  const list = useMemo(() => particles(26, 7, 10, ["rgba(255,255,255,0.95)"]), []);
  return (
    <>
      {list.map((p, i) => {
        const Icon = ICONS[p.icon];
        return (
          <Flying key={i} p={p} progress={progress} frames={80} gravity={0.05} x={x} y={y}>
            <Icon size={18} color="white" strokeWidth={2} />
          </Flying>
        );
      })}
    </>
  );
}
function StepBurst({ progress, index, steps }: { progress: SharedValue<number>; index: number; steps: number }) {
  const list = useMemo(() => particles(10, 11, 4, [GREEN]), []);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { left: `${((index + 0.5) / steps) * 100}%` }]}>
      {list.map((p, i) => (
        <Flying key={i} p={p} progress={progress} frames={40} gravity={0.12} x={0} y={6} w={5} h={3} />
      ))}
    </View>
  );
}
const CONFETTI = ["#22c55e", "#a3e635", "#f97316", "#facc15", "#3b82f6", "#ffffff", "#f43f5e"];
function ConfettiBurst({ progress, x, y }: { progress: SharedValue<number>; x: number; y: number }) {
  const list = useMemo(() => particles(110, 23, 11, CONFETTI), []);
  return (
    <>
      {list.map((p, i) => (
        <Flying key={i} p={p} progress={progress} frames={110} gravity={0.2} x={x + (p.x - 0.5) * 220} y={y} w={6 + p.size * 4} h={3 + p.size * 2} />
      ))}
    </>
  );
}
function Rain({ progress, width, height }: { progress: SharedValue<number>; width: number; height: number }) {
  const list = useMemo(() => {
    const r = rand(41);
    return Array.from({ length: 110 }, (_, i) => ({ x: r() * width, vx: (r() - 0.5) * 2, vy: 2 + r() * 3, rot: r() * 6, vr: (r() - 0.5) * 0.3, w: 6 + r() * 7, h: 3 + r() * 4, color: CONFETTI[i % CONFETTI.length], delay: i * 0.84 }));
  }, [width]);
  return (
    <>
      {list.map((p, i) => (
        <RainBit key={i} p={p} progress={progress} height={height} />
      ))}
    </>
  );
}
function RainBit({ p, progress, height }: { p: { x: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string; delay: number }; progress: SharedValue<number>; height: number }) {
  const style = useAnimatedStyle(() => {
    const f = progress.value * 250 - p.delay; // frames since this bit started
    const life = 160;
    if (f <= 0 || f >= life) return { opacity: 0 };
    return {
      opacity: 1 - f / life,
      transform: [{ translateX: p.x + p.vx * f }, { translateY: -10 + p.vy * f + (0.04 * f * f) / 2 }, { rotate: `${p.rot + p.vr * f}rad` }],
    };
  });
  void height;
  return <Animated.View pointerEvents="none" style={[styles.particle, { width: p.w, height: p.h, backgroundColor: p.color }, style]} />;
}

const styles = StyleSheet.create({
  headline: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  rollWindow: { height: 52, width: 320 },
  headlineAbs: { position: "absolute", left: 0, right: 0 },
  headlineText: { fontSize: 40, lineHeight: 52, height: 52, fontWeight: "900", letterSpacing: -1, textAlign: "center" },
  center: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 14 },
  emoji: { fontSize: 76, lineHeight: 90 },
  line: { fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  card: { marginTop: 26, width: 300, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 22, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  planEmoji: { fontSize: 24 },
  steps: { flex: 1, flexDirection: "row", height: 12 },
  step: { flex: 1, height: 12, borderRadius: 6, overflow: "hidden" },
  stepFill: { height: 12, borderRadius: 6, backgroundColor: GREEN },
  fused: { borderRadius: 6, backgroundColor: "#4ade80" },
  count: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  countText: { fontSize: 13, fontWeight: "600" },
  countNum: { fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  particle: { position: "absolute", left: 0, top: 0 },
});
