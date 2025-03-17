import { getRelativeDate } from "./DailyCheckinBanner";

interface EntryCardProps {
  emoji: string;
  title: string;
  description: string;
  date?: Date;
}

export function EntryCard({ emoji, title, description, date }: EntryCardProps) {
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-md p-2">
      <div className="flex flex-row items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs font-normal">{description}</span>
          {date && <span className="text-xs text-gray-400">{getRelativeDate(date)}</span>}
        </div>
      </div>
    </div>
  );
}
