import { useMetrics } from "@/contexts/metrics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isSameDay, subDays } from "date-fns";
import { HomeCardShell } from "./HomeCardShell";

interface MetricsCardProps {
  onLogClick: () => void;
}

export const MetricsCard = ({ onLogClick }: MetricsCardProps) => {
  const { metrics, entries, isLoadingEntries } = useMetrics();

  const last4Days = Array.from({ length: 4 }, (_, i) =>
    subDays(new Date(), 3 - i)
  );
  const todayIndex = last4Days.length - 1;

  const dotGrid = metrics?.slice(0, 4).map((metric) => ({
    emoji: metric.emoji,
    days: last4Days.map((day, index) => {
      const entry = entries?.find(
        (e) =>
          e.metricId === metric.id &&
          isSameDay(new Date(e.createdAt), day)
      );
      const isLogged = !!(entry && (entry.rating > 0 || entry.skipped));

      return {
        isLogged,
        isPendingToday: !isLoadingEntries && index === todayIndex && !isLogged,
      };
    }),
  }));

  return (
    <HomeCardShell>
      <div>
        <p className="text-sm font-semibold text-foreground">Metrics</p>
        <div className="mt-2 space-y-1.5">
          {dotGrid?.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-sm w-5">{row.emoji}</span>
              {row.days.map((day, j) => (
                <div
                  key={j}
                  className={cn(
                    "w-3.5 h-3.5 rounded-full",
                    day.isLogged
                      ? "bg-green-500"
                      : "bg-muted-foreground/25",
                    day.isPendingToday &&
                      "motion-safe:animate-pulse bg-muted-foreground/45 ring-2 ring-muted-foreground/15"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onLogClick} className="w-full">
        Log
      </Button>
    </HomeCardShell>
  );
};
