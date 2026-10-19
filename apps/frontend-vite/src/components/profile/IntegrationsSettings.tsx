import { Activity, ChevronRight, HeartPulse } from "lucide-react";

import type { IntegrationsSettingsProps } from "./integrations/types";

export function IntegrationsSettings({
  onOpenAppleHealth,
  onOpenGarmin,
}: IntegrationsSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your health data.
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenAppleHealth}
        className="flex w-full items-center gap-3 rounded-2xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted"
      >
        <span className="rounded-xl bg-red-500/15 p-2.5 text-red-500">
          <HeartPulse className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Apple Health</span>
          <span className="block text-sm text-muted-foreground">
            Sync workouts, sleep, movement, and recovery.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      <button
        type="button"
        onClick={onOpenGarmin}
        className="flex w-full items-center gap-3 rounded-2xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted"
      >
        <span className="rounded-xl bg-sky-500/15 p-2.5 text-sky-500">
          <Activity className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Garmin Connect</span>
          <span className="block text-sm text-muted-foreground">
            Add Garmin health and workout data beside Apple Health.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}
