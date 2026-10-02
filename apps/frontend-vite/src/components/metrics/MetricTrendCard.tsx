import AppleLikePopover from "@/components/AppleLikePopover";
import { Card } from "@/components/ui/card";
import { useThemeColors } from "@/hooks/useThemeColors";
import { dailyRatings, localDayKey, metricSummary } from "@/lib/metricFindings";
import { trendLine } from "@/lib/metricWords";
import { type MetricEntry } from "@tsw/prisma";
import { subDays } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

const BAR_HEIGHT = 44;

interface MetricTrendCardProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  // Rated check-ins for this metric.
  entries: MetricEntry[];
}

// One line and one shape: the last fourteen days, last week faded. The two
// averages sit behind a tap.
export function MetricTrendCard({ metric, entries }: MetricTrendCardProps) {
  const themeColors = useThemeColors();
  const [open, setOpen] = useState(false);
  const summary = metricSummary(entries);
  const ratings = dailyRatings(entries);
  const line = trendLine(summary);
  const days = Array.from(
    { length: 14 },
    (_, i) => ratings.get(localDayKey(subDays(new Date(), 13 - i))) ?? 0
  );

  return (
    <Card className="p-5 rounded-2xl">
      <button
        type="button"
        aria-label={`${metric.title} this week: ${line}`}
        onClick={() => setOpen(true)}
        className="block w-full space-y-3 text-left active:opacity-60"
      >
        <div className="flex items-center text-muted-foreground">
          <span className="flex-1 text-[13px]">This week</span>
          <ChevronRight className="h-[18px] w-[18px]" />
        </div>
        <p className="text-[17px] font-semibold">{line}</p>
        <div className="flex items-end gap-1" style={{ height: BAR_HEIGHT }}>
          {days.map((rating, i) => (
            <div
              key={i}
              className={`flex-1 rounded-[3px] ${themeColors.bg}`}
              style={{
                // A day without a rating keeps a hairline so the week reads
                // as seven days.
                height: rating ? (rating / 5) * BAR_HEIGHT : 2,
                opacity: i < 7 ? 0.3 : 1,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Last week</span>
          <span>This week</span>
        </div>
      </button>

      <AppleLikePopover
        open={open}
        onClose={() => setOpen(false)}
        title={`${metric.title} this week`}
      >
        <div className="pt-8 pb-2 space-y-3">
          <h3 className="text-xl font-bold pr-9">
            {metric.emoji} {line}
          </h3>
          <p>
            This week: {summary.currentAverage?.toFixed(1) ?? "no check-ins yet"}
          </p>
          <p>
            Last week: {summary.previousAverage?.toFixed(1) ?? "no check-ins"}
          </p>
          <p className="text-muted-foreground">
            Average rating out of 5, over the last seven days and the seven
            before. Skipped and missing days are left out.
          </p>
        </div>
      </AppleLikePopover>
    </Card>
  );
}
