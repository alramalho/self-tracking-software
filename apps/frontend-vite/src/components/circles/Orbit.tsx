import { useThemeColors } from "@/hooks/useThemeColors";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { OrbitAvatarProps, OrbitEllipse, OrbitProps } from "./types";

const TWO_PI = Math.PI * 2;
const PERIOD_MS = 36000;
// Start so that the first two people sit on the visible arc when motion is off.
const PHASE = 0.9;
const SLOTS = 5;
const MAX_WIDTH = 520;

// The dashed track is wider than the orbit box, so only its lower arc shows.
function ellipseFor(width: number): OrbitEllipse {
  return { cx: width / 2, cy: -10, rx: width * 0.53, ry: width * 0.44 };
}

// Where slot `index` sits at `turn`: on the same ellipse as the dashed line.
function positionOn(ellipse: OrbitEllipse, index: number, turn: number) {
  const t = turn + PHASE + (index / SLOTS) * TWO_PI;
  return {
    x: ellipse.cx + ellipse.rx * Math.cos(t),
    y: ellipse.cy + ellipse.ry * Math.sin(t),
    scale: 0.9 + 0.2 * Math.sin(t),
  };
}

const avatarSize = (isMe?: boolean) => (isMe ? 46 : 40);

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function OrbitAvatar({ person }: OrbitAvatarProps) {
  const theme = useThemeColors();
  const size = avatarSize(person.isMe);
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: person.empty ? "var(--color-background)" : person.color,
        border: person.empty
          ? "1.5px dashed var(--color-muted-foreground)"
          : `3px solid ${person.isMe ? theme.hex : "var(--color-background)"}`,
      }}
    >
      {person.picture ? (
        <img src={person.picture} alt={person.label} className="h-full w-full object-cover" />
      ) : (
        !person.empty && (
          <span className="font-bold text-white" style={{ fontSize: person.isMe ? 17 : 15 }}>
            {person.label.slice(0, 1).toUpperCase()}
          </span>
        )
      )}
    </div>
  );
}

// People in the circle drifting slowly around a dashed orbit at the top of the page.
export function Orbit({ people, height = 190 }: OrbitProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const avatarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const reduced = usePrefersReducedMotion();
  const shown = people.slice(0, SLOTS);
  const ellipse = ellipseFor(width);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // One clock for the page's lifetime, so a re-render never makes people jump.
  const startRef = useRef(performance.now());

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setWidth(box.clientWidth));
    observer.observe(box);
    setWidth(box.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Moves the avatars every frame straight on the DOM, so React doesn't re-render 60 times a second.
  useLayoutEffect(() => {
    if (!width) return;
    const track = ellipseFor(width);
    const place = (turn: number) =>
      shownRef.current.forEach((person, index) => {
        const element = avatarRefs.current[index];
        if (!element) return;
        const size = avatarSize(person.isMe);
        const { x, y, scale } = positionOn(track, index, turn);
        element.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) scale(${scale})`;
      });
    if (reduced) {
      place(0);
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      place((((now - startRef.current) % PERIOD_MS) / PERIOD_MS) * TWO_PI);
      frame = requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [width, reduced, shown.length]);

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={`${people.filter((person) => !person.empty).length} people in this circle`}
      className="relative mx-auto w-full overflow-hidden"
      style={{ height, maxWidth: MAX_WIDTH }}
    >
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0" aria-hidden>
          <ellipse
            cx={ellipse.cx}
            cy={ellipse.cy}
            rx={ellipse.rx}
            ry={ellipse.ry}
            fill="none"
            stroke="var(--color-muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="5 7"
            strokeLinecap="round"
            opacity={0.7}
          />
        </svg>
      )}
      {width > 0 &&
        shown.map((person, index) => (
          <div
            key={person.key}
            ref={(element) => {
              avatarRefs.current[index] = element;
            }}
            className="absolute left-0 top-0 will-change-transform"
          >
            <OrbitAvatar person={person} />
          </div>
        ))}
    </div>
  );
}
