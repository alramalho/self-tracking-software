import { useNavigate } from "@tanstack/react-router";
import { Flame, Rocket, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeProgressProps, HomeStepsProps } from "./types";

// Under the two weeks: one thin line per plan, this week's sessions then the streak. Same as the iPhone app.
/** Steps shown before the rest becomes "+n". */
const MAX_STEPS = 9;

function Steps({ value, target, color, label }: HomeStepsProps) {
  const count = Math.min(MAX_STEPS, Math.max(0, target));
  const filled = Math.min(count, value);
  const overflow = Math.max(0, value - count);
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(target, value)}
      aria-valuenow={value}
      className="flex flex-1 items-center gap-[3px]"
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < filled ? color : "bg-muted")} />
      ))}
      {overflow > 0 && <span className="text-[11px] font-bold">+{overflow}</span>}
    </span>
  );
}

export function HomeProgress({ rows }: HomeProgressProps) {
  const navigate = useNavigate();
  if (!rows.length) return null;
  return (
    <div data-testid="home-progress" className="flex flex-col gap-0.5">
      {rows.map((row) => {
        const lifestyle = row.streak.stage === "Lifestyle";
        const StreakIcon = lifestyle ? Rocket : Sprout;
        return (
          <button
            key={row.planId}
            type="button"
            data-testid={`home-progress-${row.planId}`}
            aria-label={`${row.goal}: ${row.week.done} of ${row.week.target} this week, ${row.streak.value} of ${row.streak.target} weeks towards ${row.streak.stage}`}
            onClick={() => navigate({ to: "/plans", search: { selectedPlan: row.planId } })}
            className="flex w-full items-center gap-2 py-[3px] transition-opacity active:opacity-60"
          >
            <span className="w-[22px] shrink-0 text-center text-[15px] leading-none">{row.emoji}</span>
            <Steps value={row.week.done} target={row.week.target} color="bg-green-500" label="This week" />
            <Flame size={14} className="shrink-0 text-orange-400" />
            <span className="w-1 shrink-0" />
            <Steps
              value={row.streak.value}
              target={row.streak.target}
              color={lifestyle ? "bg-amber-400" : "bg-lime-400"}
              label={lifestyle ? "Lifestyle progress" : "Habit progress"}
            />
            <StreakIcon size={14} className={cn("shrink-0", lifestyle ? "text-amber-400" : "text-lime-500")} />
          </button>
        );
      })}
    </div>
  );
}
