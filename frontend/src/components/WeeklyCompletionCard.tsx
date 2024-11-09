import { Check } from "lucide-react";

export function WeeklyCompletionCard() {
  return (
    <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-green-100 p-2 rounded-full">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-green-700">
            🎉 Fantastic work this week!
          </h3>
          <p className="text-green-600">
            You&apos;ve completed all your planned activities for this week.
          </p>
        </div>
      </div>
    </div>
  );
} 