import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ConfidenceDialProps } from "../types";
import { confidenceLabel, scoreAt } from "./confidence";

// A half-circle gauge from 1 (left) to 10 (right). Drag or tap along it, or use the arrow keys.
// On first appearance the needle sweeps to full and settles back, like a car dashboard waking up.
export function ConfidenceDial({ score, onChange, compact = false }: ConfidenceDialProps) {
  const theme = useThemeColors();
  const reduced = useReducedMotion();
  const gradient = useId();
  const width = compact ? 180 : 300;
  const stroke = compact ? 14 : 22;
  const radius = (width - stroke) / 2 - 6;
  const cx = width / 2;
  const cy = radius + stroke / 2 + 6;
  const height = cy + (compact ? 10 : 18);
  const length = Math.PI * radius;
  const fill = useMotionValue(reduced || compact ? score / 10 : 0);
  const offset = useTransform(fill, (value) => length * (1 - value));
  const knobX = useTransform(fill, (value) => cx + radius * Math.cos(Math.PI * (1 - value)));
  const knobY = useTransform(fill, (value) => cy - radius * Math.sin(Math.PI * (1 - value)));
  const first = useRef(true);
  const dragging = useRef(false);

  useEffect(() => {
    if (first.current && !reduced && !compact) {
      first.current = false;
      const sweep = animate(fill, [0, 1, score / 10], { duration: 1.4, delay: 0.25, times: [0, 0.46, 1], ease: "easeInOut" });
      return () => sweep.stop();
    }
    first.current = false;
    if (reduced) fill.set(score / 10);
    else animate(fill, score / 10, { duration: 0.28, ease: "easeOut" });
    // The sweep runs once; later changes only follow the score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onChange) return;
    const box = event.currentTarget.getBoundingClientRect();
    const next = scoreAt(event.clientX - box.left, event.clientY - box.top, cx, cy);
    if (next !== score) onChange(next);
  };
  const arc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        data-testid={compact ? "confidence-dial-compact" : "confidence-dial"}
        role={onChange ? "slider" : "img"}
        tabIndex={onChange ? 0 : undefined}
        aria-label="How sure you are"
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={score}
        aria-valuetext={`${score} out of 10, ${confidenceLabel(score)}`}
        onKeyDown={(event) => {
          if (!onChange) return;
          const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
          if (!delta) return;
          event.preventDefault();
          onChange(Math.max(1, Math.min(10, score + delta)));
        }}
        className="relative touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ width, height }}
      >
        <svg
          width={width}
          height={height}
          className={onChange ? "cursor-pointer" : undefined}
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            pick(event);
          }}
          onPointerMove={(event) => dragging.current && pick(event)}
          onPointerUp={() => (dragging.current = false)}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={theme.hex} stopOpacity={0.45} />
              <stop offset="1" stopColor={theme.hex} />
            </linearGradient>
          </defs>
          <path d={arc} className="stroke-muted" strokeWidth={stroke} fill="none" strokeLinecap="round" />
          <motion.path
            d={arc}
            stroke={`url(#${gradient})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${length} ${length}`}
            style={{ strokeDashoffset: offset }}
          />
          {!compact && <motion.circle r={stroke / 2 + 5} fill="#fff" stroke={theme.hex} strokeWidth={3} cx={knobX} cy={knobY} />}
        </svg>
        <div className={`pointer-events-none absolute inset-x-0 flex flex-col items-center ${compact ? "bottom-0" : "bottom-1.5"}`}>
          <motion.span
            key={score}
            initial={reduced || compact ? false : { scale: 1.12 }}
            animate={{ scale: 1 }}
            data-testid="confidence-score"
            className={`font-bold tabular-nums text-foreground ${compact ? "text-[40px] leading-[46px]" : "text-[72px] leading-[80px]"}`}
          >
            {score}
          </motion.span>
          {!compact && <span className="text-[15px] font-semibold text-muted-foreground">{confidenceLabel(score)}</span>}
        </div>
      </div>
      {onChange && (
        <div className="flex justify-between text-[13px] text-muted-foreground" style={{ width: width - 12 }}>
          <span>1</span>
          <span>10</span>
        </div>
      )}
    </div>
  );
}
