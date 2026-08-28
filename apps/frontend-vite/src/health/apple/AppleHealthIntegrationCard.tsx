import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Activity,
  Database,
  HeartPulse,
  ListChecks,
  Loader2,
  Moon,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { AppleHealth } from "./plugin";
import {
  disconnectAppleHealth,
  getAppleHealthStatus,
  uploadPreparedAppleHealthSync,
} from "./service";
import { AppleHealthWorkoutReconciliation } from "./reconciliation/AppleHealthWorkoutReconciliation";

const isNativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

const errorMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Apple Health sync failed";
};

const formatCount = (value: number): string =>
  new Intl.NumberFormat().format(value);

export function AppleHealthIntegrationCard() {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reconciliationOpenRequest, setReconciliationOpenRequest] =
    useState(0);

  const statusQuery = useQuery({
    queryKey: ["apple-health-status"],
    queryFn: () => getAppleHealthStatus(api),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const availability = await AppleHealth.isAvailable();
      if (!availability.available) {
        throw new Error("Apple Health is not available on this device");
      }

      if (!status?.connected) {
        // The server may have been disconnected or deleted from another
        // device. Reset local anchors so reconnecting restores the full
        // initial window instead of sending only post-deletion changes.
        await AppleHealth.resetSync();
      }

      await AppleHealth.requestAuthorization();
      const preparedSync = await AppleHealth.prepareSync({
        initialLookbackDays: 180,
        refreshLookbackDays: 14,
      });
      const totals = await uploadPreparedAppleHealthSync(api, preparedSync);
      await AppleHealth.commitSync({ syncToken: preparedSync.syncToken });
      return totals;
    },
    onSuccess: (totals) => {
      queryClient.invalidateQueries({ queryKey: ["apple-health-status"] });
      queryClient.invalidateQueries({
        queryKey: ["apple-health-workout-reconciliation"],
      });
      setReconciliationOpenRequest((request) => request + 1);
      toast.success(
        `Apple Health synced: ${totals.workouts} workouts and ${totals.dailyMetrics} daily values`,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (deleteImportedData: boolean) => {
      await disconnectAppleHealth(api, deleteImportedData);
      if (isNativeIos) {
        await AppleHealth.resetSync();
      }
    },
    onSuccess: (_, deleteImportedData) => {
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ["apple-health-status"] });
      queryClient.invalidateQueries({
        queryKey: ["apple-health-workout-reconciliation"],
      });
      toast.success(
        deleteImportedData
          ? "Apple Health data deleted"
          : "Apple Health disconnected",
      );
    },
    onError: () => toast.error("Could not disconnect Apple Health"),
  });

  const status = statusQuery.data;
  const isWorking =
    syncMutation.isPending ||
    disconnectMutation.isPending ||
    statusQuery.isLoading;
  const importStats = status?.importStats;
  const hasImportedData = Boolean(
    importStats &&
      (importStats.workoutCount > 0 ||
        importStats.sleepSampleCount > 0 ||
        importStats.dailyMetricCount > 0),
  );
  const coverageLabel =
    importStats?.dataStartDate && importStats.dataEndDate
      ? `${format(parseISO(importStats.dataStartDate), "MMM d, yyyy")} – ${format(
          parseISO(importStats.dataEndDate),
          "MMM d, yyyy",
        )}`
      : null;

  return (
    <section className="space-y-5 pb-2 pt-1">
      <div className="px-2 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-red-500/20">
          <HeartPulse className="h-8 w-8 text-red-500" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <h2 className="text-2xl font-bold">Apple Health</h2>
          {status?.connected && (
            <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-600">
              Connected
            </span>
          )}
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Bring workouts, sleep, movement, and recovery signals into
          tracking.so—ready for personal trends and future correlations.
        </p>
      </div>

      {!isNativeIos && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          {status?.connected
            ? "Use the tracking.so iPhone app to change Health permissions or run a sync."
            : "Open this setting in the tracking.so iPhone app to connect Apple Health."}
        </p>
      )}

      {hasImportedData && importStats && (
        <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-background/70 p-3">
              <Activity className="h-4 w-4 text-red-500" />
              <p className="mt-2 text-xl font-bold">
                {formatCount(importStats.workoutCount)}
              </p>
              <p className="text-xs text-muted-foreground">Workouts</p>
            </div>
            <div className="rounded-xl bg-background/70 p-3">
              <Moon className="h-4 w-4 text-indigo-400" />
              <p className="mt-2 text-xl font-bold">
                {formatCount(importStats.sleepDayCount)}
              </p>
              <p className="text-xs text-muted-foreground">Sleep days</p>
            </div>
            <div className="rounded-xl bg-background/70 p-3">
              <Database className="h-4 w-4 text-blue-500" />
              <p className="mt-2 text-xl font-bold">
                {formatCount(importStats.dailyMetricCount)}
              </p>
              <p className="text-xs text-muted-foreground">Daily values</p>
            </div>
            <div className="rounded-xl bg-background/70 p-3">
              <ListChecks className="h-4 w-4 text-emerald-500" />
              <p className="mt-2 text-xl font-bold">
                {formatCount(importStats.signalTypeCount)}
              </p>
              <p className="text-xs text-muted-foreground">Signal types</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 px-1 text-xs text-muted-foreground">
            {coverageLabel && <span>Coverage {coverageLabel}</span>}
            <span>
              {formatCount(importStats.sleepSampleCount)} sleep-stage samples
            </span>
          </div>
        </div>
      )}

      {status?.lastSyncError && (
        <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-600">
          Last sync failed. Try again from the iPhone app.
        </p>
      )}

      <AppleHealthWorkoutReconciliation
        enabled={hasImportedData}
        openRequestKey={reconciliationOpenRequest}
      />

      <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Stored in your tracking.so account for personal health insights—not
          advertising, and currently excluded from AI coach prompts and traces.{" "}
          <a
            className="font-medium text-foreground underline underline-offset-2"
            href="https://tracking.so/privacy"
            rel="noreferrer"
            target="_blank"
          >
            Privacy policy
          </a>
        </p>
      </div>

      {status?.lastSyncCompletedAt && (
        <p className="text-center text-xs text-muted-foreground">
          Last synced{" "}
          {format(new Date(status.lastSyncCompletedAt), "MMM d, yyyy 'at' p")}
        </p>
      )}

      <div className="space-y-2">
        {isNativeIos && (
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl text-base font-semibold"
            disabled={isWorking}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status?.connected ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <HeartPulse className="h-4 w-4" />
            )}
            <span className="ml-1">
              {status?.connected ? "Sync now" : "Connect and import"}
            </span>
          </Button>
        )}

        {confirmDelete ? (
          <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-muted-foreground">
              Delete every Apple Health workout, sleep sample, and daily value
              stored in tracking.so? Timeline workouts created from Apple
              Health are deleted too; manual logs stay. Nothing will be removed
              from Apple Health.
            </p>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={isWorking}
              onClick={() => disconnectMutation.mutate(true)}
            >
              Delete all imported data
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          (status?.connected || hasImportedData) && (
            <div className="grid grid-cols-2 gap-2">
              {status?.connected && (
                <Button
                  type="button"
                  variant="outline"
                  className={hasImportedData ? undefined : "col-span-2"}
                  disabled={isWorking}
                  onClick={() => disconnectMutation.mutate(false)}
                >
                  <Unplug className="h-4 w-4" />
                  <span className="ml-1">Disconnect</span>
                </Button>
              )}
              {hasImportedData && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isWorking}
                  className={
                    status?.connected
                      ? "text-muted-foreground hover:text-red-600"
                      : "col-span-2 text-muted-foreground hover:text-red-600"
                  }
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="ml-1">Delete data</span>
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}
