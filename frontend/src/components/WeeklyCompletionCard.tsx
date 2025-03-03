import { Check } from "lucide-react";

export function WeeklyCompletionCard({ username, planName, small }: { username?: string, planName?: string, small?: boolean }) {
  return (
    <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-green-100 p-2 rounded-full">
          <Check className={`text-green-600 ${small ? "h-4 w-4" : "h-6 w-6"}`} />
        </div>
        <div>
          <h3 className={`font-semibold text-green-700 ${small ? "text-lg" : "text-xl"}`}>
            🔥 Fantastic work this week!
          </h3>
          <p className={`text-green-600 ${small ? "text-sm" : ""}`}>
            {`${username ? `${username} has` : "You've"} completed all ${username ? "their" : "your"} planned activities for this week ${planName ? ` for plan '${planName}'` : ""}.`}
          </p>
        </div>
      </div>
    </div>
  );
} 