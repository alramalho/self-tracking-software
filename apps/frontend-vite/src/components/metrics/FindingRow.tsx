import { CLEAR_DIFFERENCE } from "@/lib/metricFindings";
import { percent } from "@/lib/metricWords";

// A bar is full at a 50% difference; larger ones are rare on a 1-5 scale.
const FULL_BAR = 0.5;

interface FindingRowProps {
  label: string;
  difference: number | null;
  // Zero to three bars.
  signal: number;
  // Shown in place of the number while there is too little to go on.
  waiting: string;
  onClick?: () => void;
  isVisible?: boolean;
  animationDelay?: number;
}

// Three rising bars, like phone reception: how much there is to go on.
function Signal({ strength }: { strength: number }) {
  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {[6, 10, 14].map((height, index) => (
        <span
          key={height}
          className={`w-1 rounded-[1px] ${
            index < strength ? "bg-muted-foreground" : "bg-muted-foreground/30"
          }`}
          style={{ height }}
        />
      ))}
    </span>
  );
}

// One signal each: bar colour is the direction, the number and bar length are
// the size, and the small bars are how much there is to go on.
export function FindingRow({
  label,
  difference,
  signal,
  waiting,
  onClick,
  isVisible = true,
  animationDelay = 0,
}: FindingRowProps) {
  const size = Math.min(Math.abs(difference ?? 0) / FULL_BAR, 1) * 100;
  const value = difference === null ? waiting : percent(difference);
  const color =
    Math.abs(difference ?? 0) < CLEAR_DIFFERENCE
      ? "#9ca3af"
      : (difference ?? 0) > 0
        ? "#22c55e"
        : "#ef4444";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}, signal ${signal} of 3`}
      className={`block w-full space-y-2 text-left active:opacity-60 ${
        difference === null ? "opacity-45" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-[15px]">
        <span className="min-w-0 truncate">{label}</span>
        <Signal strength={signal} />
        <span className="flex-1" />
        <span
          className={`shrink-0 tabular-nums ${
            difference === null ? "text-muted-foreground" : "font-semibold"
          }`}
        >
          {value}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={size}
        aria-label={`${label} difference`}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{
            width: `${isVisible ? size : 0}%`,
            backgroundColor: color,
            transitionDelay: `${animationDelay}ms`,
          }}
        />
      </div>
    </button>
  );
}
