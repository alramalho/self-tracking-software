import { Link } from "@tanstack/react-router";
import { subDays } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useMetrics } from "@/contexts/metrics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { dailyRatings, localDayKey, metricSummary } from "@/lib/metricFindings";
import type { SparklineProps } from "./types";

/** Daily ratings on the 1–5 scale, oldest to newest, with the latest point marked. */
function Sparkline({ values }: SparklineProps) {
  const theme = useThemeColors();
  const w = 300;
  const h = 44;
  if (values.length < 2) return null;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, h - 4 - ((v - 1) / 4) * (h - 8)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg className={cn("h-11 w-full", theme.text)} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path d={`${line} L${lx.toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z`} fill="currentColor" fillOpacity={0.15} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={lx} cy={ly} r={3.5} fill="currentColor" />
    </svg>
  );
}

/** Your own check-ins, as on iPhone: this week's average against last week's, and the last ten days. */
export function CheckinsCard() {
  const { metrics, entries } = useMetrics();
  const metric = metrics?.[0];
  const mine = (entries ?? []).filter((e) => e.metricId === metric?.id);
  const summary = metricSummary(mine);
  const ratings = dailyRatings(mine);
  const values = Array.from({ length: 10 }, (_, i) => ratings.get(localDayKey(subDays(new Date(), 9 - i)))).filter(
    (v): v is number => v !== undefined,
  );
  const now = summary.currentAverage;
  const before = summary.previousAverage;
  const subtitle = !metric
    ? "Track how you feel each day"
    : now === null
      ? `No ${metric.title.toLowerCase()} check-ins this week`
      : `${metric.title} ${now.toFixed(1)} avg this week${before !== null && Math.abs(now - before) >= 0.1 ? ` · ${now > before ? "up" : "down"} from ${before.toFixed(1)}` : ""}`;
  return (
    <Link
      to="/insights/dashboard"
      data-testid="profile-checkins"
      className="mt-3 flex w-full flex-col gap-3 rounded-[20px] bg-card p-4 transition-opacity hover:opacity-80"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{metric?.emoji ?? "⚡"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Check-ins</p>
          <p className="text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
      </div>
      <Sparkline values={values} />
    </Link>
  );
}
