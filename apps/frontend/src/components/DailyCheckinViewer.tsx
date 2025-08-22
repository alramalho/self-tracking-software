import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyCheckinViewerProps {
  entries: { date: string }[];
}

export function DailyCheckinViewer({ entries }: DailyCheckinViewerProps) {
  // Get last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  }).reverse();

  // Format day labels
  const getDayLabel = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    return `${date.toLocaleDateString('en-US', { weekday: 'short' })}`;
  };

  // Check if there's an entry for a given date
  const hasEntryForDate = (date: Date) => {
    return entries.some(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.toDateString() === date.toDateString();
    });
  };

  return (
    <div className="flex justify-between items-start gap-1">
      {days.map((date, index) => (
        <div key={index} className="flex flex-col items-center gap-1">
          <div
            className={cn(
              "w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-300",
              hasEntryForDate(date)
                ? "border-green-500 bg-green-500 scale-100"
                : "border-gray-300 scale-90"
            )}
          >
            {hasEntryForDate(date) && (
              <Check className="w-5 h-5 text-white" />
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-normal max-w-10 text-center">
            {getDayLabel(date)}
          </span>
        </div>
      ))}
    </div>
  );
} 