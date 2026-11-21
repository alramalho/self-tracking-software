/**
 * The moment after a log (designed with the owner, 14 Nov 2026, from Strava's "Nice work!"): a wave in the
 * accent colour floods up from the button, line icons burst, the screen settles dark (or light) with two
 * thick ribbons drawn in, and "Nice work!", the activity and the plan card come in one after another. The
 * plan's stepper fills the new step with a pop, a tiny tilt, a sound and a haptic. When that step completes
 * the week, the bar fuses and flashes, confetti bursts and rains, the flame wakes, the ribbons turn warm,
 * "Nice work!" blurs into "Week done" with a chord, and the streak goes up. It closes by itself (a tap closes
 * it sooner) and fades into the "Saved" sheet already open underneath, which holds "Share more" (20 Nov 2026).
 *
 * When that week takes the streak to 4 weeks (Habit) or 9 (Lifestyle), a third act follows with no pause
 * (21 Nov 2026): the card sinks away, "Week done" gives way to "Habit formed!" or "It's a lifestyle!", the
 * profile badge's seed (or rocket) grows in a glowing disc, the ribbons turn green (or gold), a chime plays
 * and a second confetti burst rains. The same act plays alone ("recap") on opening the app when a badge was
 * earned somewhere the log moment couldn't tell.
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
import LottieView from "lottie-react-native";
import { Check, Circle, Flame, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { MILESTONE_WEEKS, type Celebration, type Milestone } from "./model";

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
const MILESTONE_SOUND = require("../../../assets/sounds/milestone.wav");
const GOLD = "#f5b70a";
export const MILESTONE_LOOK: Record<Milestone, { title: string; color: string; glow: string; animation: any; confetti: string[] }> = {
  habit: {
    title: "Habit formed!",
    color: GREEN,
    glow: "rgba(34,197,94,0.22)",
    animation: require("../../../assets/animations/seed.json"),
    confetti: ["#22c55e", "#4ade80", "#a3e635", "#bbf7d0", "#ffffff", "#facc15"],
  },
  lifestyle: {
    title: "It's a lifestyle!",
    color: GOLD,
    glow: "rgba(245,183,10,0.24)",
    animation: require("../../../assets/animations/rocket.json"),
    confetti: ["#f5b70a", "#fde047", "#f97316", "#ffffff", "#a855f7", "#fef3c7"],
  },
};

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
function haptic(kind: "step" | "week" | "milestone") {
  if (Platform.OS === "web") return;
  if (kind === "milestone") {
    // A success, then a heavy thump as the badge lands.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 220);
    return;
  }
  void (kind === "step"
    ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  ).catch(() => {});
}

export function CelebrationOverlay({
  celebration,
  onDone,
  embedded,
  onShow,
}: {
  celebration: Celebration;
  onDone: () => void;
  /** Drawn inside another modal (the Saved sheet's, via LoggingDrawer's overlay) instead of opening its own. */
  embedded?: boolean;
  /** Its own modal is on screen (iOS refuses one while another sheet is up, and then this never fires). */
  onShow?: () => void;
}) {
  const c = useColors();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const sx = width / W;
  const sy = height / H;
  const plan = celebration.plan;
  const steps = plan ? Math.max(1, plan.target) : 0;
  const moves = !!plan && plan.after > plan.before;
  const recap = !!celebration.recap;
  const milestone: Milestone | null = celebration.milestone && (recap || (moves && celebration.weekDone)) ? celebration.milestone : null;
  const look = milestone ? MILESTONE_LOOK[milestone] : null;
  const [done, setDone] = useState(plan?.before ?? 0);
  const [streak, setStreak] = useState(plan?.streakBefore ?? 0);
  const players = useRef<{ step?: AudioPlayer; week?: AudioPlayer; milestone?: AudioPlayer }>({});
  const lottie = useRef<LottieView>(null);
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
  const mile = useSharedValue(0);
  const badge = useSharedValue(0);
  const mileBurst = useSharedValue(0);
  const mileRain = useSharedValue(0);

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
      if (celebration.weekDone && !recap) players.current.week = createAudioPlayer(WEEK_SOUND);
      if (milestone) players.current.milestone = createAudioPlayer(MILESTONE_SOUND);
    } catch {}
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (t: number, fn: () => void) => timers.push(setTimeout(fn, t));
    const spring = { damping: 12, stiffness: 180, mass: 0.8 };
    const landMilestone = () => {
      playSound(players.current.milestone);
      haptic("milestone");
      lottie.current?.play();
    };

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
      if (milestone) {
        at(recap ? 300 : 1500, () => {
          mile.value = 1;
          badge.value = 1;
          landMilestone();
        });
      }
      at(milestone ? 4200 : 2400, () => finish());
      return () => timers.forEach(clearTimeout);
    }

    wave.value = withDelay(T_WAVE, withTiming(1, { duration: ms(650), easing: Easing.out(Easing.cubic) }));
    iconBurst.value = withDelay(T_ICONS, withTiming(1, { duration: ms(1300), easing: Easing.linear }));
    settle.value = withDelay(T_SETTLE, withTiming(1, { duration: ms(380), easing: out }));
    ribbons.value = withDelay(T_SETTLE, withTiming(1, { duration: ms(900) * 1.15, easing: out }));
    ribbons2.value = withDelay(T_SETTLE + ms(220), withTiming(1, { duration: ms(900) * 1.15, easing: out }));
    if (recap) {
      // Only the badge act, straight after the wave settles.
      const tMile = T_ENTER;
      enter[0].value = withDelay(tMile, withSpring(1, spring));
      mile.value = withDelay(tMile, withTiming(1, { duration: ms(420), easing: out }));
      badge.value = withDelay(tMile + ms(120), withSpring(1, { damping: 9, stiffness: 110 }));
      mileBurst.value = withDelay(tMile + ms(260), withTiming(1, { duration: 2000, easing: Easing.linear }));
      mileRain.value = withDelay(tMile + ms(260), withTiming(1, { duration: 4200, easing: Easing.linear }));
      at(tMile + ms(260), landMilestone);
      at(tMile + ms(3400), () => finish());
      return () => {
        timers.forEach(clearTimeout);
        try {
          players.current.milestone?.remove();
        } catch {}
      };
    }
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
      if (milestone) {
        // Straight on from "Week done": just long enough to read the streak tick up, then the badge.
        const tMile = tBoom + ms(1300);
        mile.value = withDelay(tMile, withTiming(1, { duration: ms(520), easing: out }));
        badge.value = withDelay(tMile + ms(150), withSpring(1, { damping: 9, stiffness: 110 }));
        mileBurst.value = withDelay(tMile + ms(300), withTiming(1, { duration: 2000, easing: Easing.linear }));
        mileRain.value = withDelay(tMile + ms(300), withTiming(1, { duration: 4200, easing: Easing.linear }));
        at(tMile + ms(300), landMilestone);
        end = tMile + ms(2700);
      }
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
  // The badge act: what was there sinks and fades, the badge headline and disc come up in its place.
  const mileStyle = useAnimatedStyle(() => ({ opacity: mile.value }));
  const leaveStyle = useAnimatedStyle(() => ({
    opacity: 1 - mile.value,
    transform: [{ translateY: mile.value * 40 }, { scale: 1 - mile.value * 0.08 }],
  }));
  const headLeave = useAnimatedStyle(() => ({ opacity: 1 - mile.value, transform: [{ translateY: -mile.value * 16 }] }));
  const headCome = useAnimatedStyle(() => ({ opacity: mile.value, transform: [{ translateY: (1 - mile.value) * 16 }, { scale: 0.85 + 0.15 * mile.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.value * 2),
    transform: [{ scale: 0.3 + 0.7 * badge.value }, { rotate: `${(1 - badge.value) * -14}deg` }],
  }));
  const badgeText = useAnimatedStyle(() => ({ opacity: Math.max(0, badge.value * 1.6 - 0.6), transform: [{ translateY: (1 - badge.value) * 12 }] }));

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
          {[c.accent, WARM, ...(look ? [look.color] : [])].map((color, layer) => (
            <Animated.View key={`${layer}-${color}`} pointerEvents="none" style={[StyleSheet.absoluteFill, layer === 1 ? warmStyle : layer === 2 ? mileStyle : null]}>
              <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <AnimatedPath d={RIBBON_TOP} fill="none" stroke={color} strokeWidth={58} strokeLinecap="round" strokeDasharray={`${RIBBON_LENGTH} ${RIBBON_LENGTH}`} animatedProps={ribbonLayers[Math.min(layer, 1)][0]} />
                <AnimatedPath d={RIBBON_BOTTOM} fill="none" stroke={color} strokeWidth={58} strokeLinecap="round" strokeDasharray={`${RIBBON_LENGTH} ${RIBBON_LENGTH}`} animatedProps={ribbonLayers[Math.min(layer, 1)][1]} />
              </Svg>
            </Animated.View>
          ))}

          {!reduced && <IconBurst progress={iconBurst} x={195 * sx} y={560 * sy} />}

          <View style={[styles.headline, { top: 190 * sy }]}>
            <Animated.View style={headlineStyle}>
              <View style={styles.rollWindow}>
                {!recap && (
                  <Animated.View style={[StyleSheet.absoluteFill, headLeave]}>
                    <BlurText text="Nice work!" progress={roll} out color={c.text} />
                    <BlurText text="Week done" progress={roll} color={c.text} />
                  </Animated.View>
                )}
                {look && (
                  <Animated.View style={[StyleSheet.absoluteFill, headCome]}>
                    <Text testID="log-celebration-milestone" style={[styles.headlineText, styles.headlineAbs, { color: c.text }]}>
                      {look.title}
                    </Text>
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          </View>

          {look && milestone && (
            <View pointerEvents="none" style={[styles.center, { top: 285 * sy }]}>
              <Animated.View style={[styles.disc, { backgroundColor: look.glow, borderColor: look.color }, badgeStyle]}>
                <View style={[styles.discInner, { backgroundColor: c.dark ? "#18181b" : "#ffffff" }]}>
                  <LottieView
                    ref={lottie}
                    source={look.animation}
                    autoPlay={reduced}
                    loop
                    progress={reduced && Platform.OS !== "web" ? 0.5 : undefined}
                    resizeMode="cover"
                    style={{ width: 150, height: 150 }}
                    webStyle={{ width: 150, height: 150 }}
                  />
                </View>
              </Animated.View>
              <Animated.View style={[{ alignItems: "center", gap: 6 }, badgeText]}>
                <Text style={[styles.line, { color: look.color }]} testID="log-celebration-milestone-weeks">
                  {MILESTONE_WEEKS[milestone]} weeks in a row
                </Text>
                {celebration.plan && (
                  <Text style={[styles.mileGoal, { color: c.muted }]} numberOfLines={2}>
                    {celebration.plan.emoji} {celebration.plan.goal}
                  </Text>
                )}
              </Animated.View>
            </View>
          )}

          {!recap && (
          <Animated.View style={[styles.center, { top: 290 * sy }, leaveStyle]}>
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
          </Animated.View>
          )}

          {celebration.weekDone && !recap && !reduced && (
            <>
              <ConfettiBurst progress={weekBurst} x={195 * sx} y={(290 + 200) * sy} />
              <Rain progress={rain} width={width} height={height} />
            </>
          )}
          {look && !reduced && (
            <>
              <ConfettiBurst progress={mileBurst} x={195 * sx} y={(285 + 100) * sy} colors={look.confetti} seed={57} />
              <Rain progress={mileRain} width={width} height={height} colors={look.confetti} seed={83} />
            </>
          )}
        </Pressable>
      </Animated.View>
  );
  if (embedded) return body;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onShow={onShow} onRequestClose={() => finish()}>
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
function ConfettiBurst({ progress, x, y, colors = CONFETTI, seed = 23 }: { progress: SharedValue<number>; x: number; y: number; colors?: string[]; seed?: number }) {
  const list = useMemo(() => particles(110, seed, 11, colors), [colors, seed]);
  return (
    <>
      {list.map((p, i) => (
        <Flying key={i} p={p} progress={progress} frames={110} gravity={0.2} x={x + (p.x - 0.5) * 220} y={y} w={6 + p.size * 4} h={3 + p.size * 2} />
      ))}
    </>
  );
}
function Rain({ progress, width, height, colors = CONFETTI, seed = 41 }: { progress: SharedValue<number>; width: number; height: number; colors?: string[]; seed?: number }) {
  const list = useMemo(() => {
    const r = rand(seed);
    return Array.from({ length: 110 }, (_, i) => ({ x: r() * width, vx: (r() - 0.5) * 2, vy: 2 + r() * 3, rot: r() * 6, vr: (r() - 0.5) * 0.3, w: 6 + r() * 7, h: 3 + r() * 4, color: colors[i % colors.length], delay: i * 0.84 }));
  }, [width, colors, seed]);
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
  disc: { width: 210, height: 210, borderRadius: 105, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  discInner: { width: 172, height: 172, borderRadius: 86, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  mileGoal: { fontSize: 16, lineHeight: 22, fontWeight: "600", textAlign: "center", maxWidth: 300 },
});
