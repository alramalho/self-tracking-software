import { ChevronRight, HeartPulse, KeyRound } from "lucide-react";

import type { IntegrationsSettingsProps } from "./integrations/types";

export function IntegrationsSettings({
  onOpenAppleHealth,
  onOpenApiKeys,
}: IntegrationsSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect health data or let another assistant work with tracking.so.
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
        onClick={onOpenApiKeys}
        className="flex w-full items-center gap-3 rounded-2xl bg-muted/50 p-4 text-left transition-colors hover:bg-muted"
      >
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <KeyRound className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">API keys</span>
          <span className="block text-sm text-muted-foreground">
            Connect Codex, Claude, or another MCP client.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}
