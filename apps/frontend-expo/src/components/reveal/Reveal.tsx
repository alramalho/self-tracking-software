import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  View,
  useWindowDimensions,
} from "react-native";
import type { RevealProps, RevealViewport } from "./types";

// UIKit glass must mount after ancestor opacity animations finish.
export const RevealSettledContext = createContext(true);

export const RevealContext = createContext<RevealViewport | undefined>(
  undefined,
);

// Only unrevealed sections are measured. Scrolling never updates React state,
// and the native driver handles the actual fade independently of JS.
export function useRevealViewport(): RevealViewport {
  const callbacks = useRef(new Set<() => void>());
  const frame = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return useMemo(
    () => ({
      seen: new Set<string>(),
      register(check) {
        callbacks.current.add(check);
        return () => {
          callbacks.current.delete(check);
        };
      },
      check() {
        if (frame.current !== undefined) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = undefined;
          callbacks.current.forEach((check) => check());
        });
      },
    }),
    [],
  );
}

export function Reveal({
  children,
  id,
  delay = 0,
  style,
  onReveal,
}: RevealProps) {
  const viewport = useContext(RevealContext);
  const { height: screenHeight } = useWindowDimensions();
  const view = useRef<View>(null);
  const shown = useRef(!!id && !!viewport?.seen.has(id));
  const [settled, setSettled] = useState(shown.current);
  const progress = useRef(new Animated.Value(shown.current ? 1 : 0)).current;
  const reduced = useRef<boolean | undefined>(undefined);
  const unregister = useRef<(() => void) | undefined>(undefined);
  const animation = useRef<Animated.CompositeAnimation | undefined>(undefined);
  const mounted = useRef(true);
  const check = useRef(() => {});
  check.current = () => {
    if (shown.current || reduced.current === undefined) return;
    view.current?.measureInWindow((_x, y, width, height) => {
      if (!mounted.current || shown.current || width <= 0 || height <= 0)
        return;
      if (!reduced.current && (y >= screenHeight - 50 || y + height <= 0))
        return;
      shown.current = true;
      if (id) viewport?.seen.add(id);
      unregister.current?.();
      onReveal?.(!!reduced.current);
      if (reduced.current) {
        progress.setValue(1);
        setSettled(true);
        return;
      }
      animation.current = Animated.timing(progress, {
        toValue: 1,
        duration: 500,
        delay: Math.min(delay, 200),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      });
      animation.current.start(({ finished }) => {
        if (finished && mounted.current) setSettled(true);
      });
    });
  };
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    const update = (value: boolean) => {
      if (!alive) return;
      reduced.current = value;
      if (value) {
        onReveal?.(true);
        animation.current?.stop();
        progress.setValue(1);
        setSettled(true);
        shown.current = true;
        if (id) viewport?.seen.add(id);
        unregister.current?.();
      } else check.current();
    };
    unregister.current = viewport?.register(() => check.current());
    void AccessibilityInfo.isReduceMotionEnabled().then(update, () =>
      update(true),
    );
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      update,
    );
    return () => {
      alive = false;
      mounted.current = false;
      unregister.current?.();
      subscription.remove();
      animation.current?.stop();
    };
  }, [viewport, progress, id]);
  return (
    <Animated.View
      ref={view}
      collapsable={false}
      testID={id ? `reveal-${id}` : undefined}
      onLayout={() => {
        check.current();
        viewport?.check();
      }}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <RevealSettledContext.Provider value={settled}>
        {children}
      </RevealSettledContext.Provider>
    </Animated.View>
  );
}
