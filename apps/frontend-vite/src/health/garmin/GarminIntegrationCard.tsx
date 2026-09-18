import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Activity,
  Database,
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

import {
  disconnectGarmin,
  getGarminAuthorizationUrl,
  getGarminStatus,
  syncGarmin,
} from "./service";
import { AppleHealthWorkoutReconciliation } from "../apple/reconciliation/AppleHealthWorkoutReconciliation";

const errorMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "error" in error.response.data &&
    typeof error.response.data.error === "string"
  ) {
    return error.response.data.error;
  }
  return "Garmin Connect sync failed";
};

const formatCount = (value: number): string =>
  new Intl.NumberFormat().format(value);

export function GarminIntegrationCard() {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reconciliationOpenRequest, setReconciliationOpenRequest] = useState(0);

  const statusQuery = useQuery({
    queryKey: ["garmin-status"],
    queryFn: () => getGarminStatus(api),
  });

  const connectMutation = useMutation({
    mutationFn: () => getGarminAuthorizationUrl(api),
    onSuccess: (authorizationUrl) => window.location.assign(authorizationUrl),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncGarmin(api, 7),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["garmin-status"] });
      queryClient.invalidateQueries({
        queryKey: ["apple-health-workout-reconciliation"],
      });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity-entries"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      setReconciliationOpenRequest((request) => request + 1);
      toast.success(
        result
          ? `Garmin synced: ${result.counts.workouts} workouts and ${result.counts.dailyMetrics} daily values`
          : "Garmin sync is already running",
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const disconnectMutation = useMutation({
    mutationFn: (deleteImportedData: boolean) =>
      disconnectGarmin(api, deleteImportedData),
    onSuccess: (_, deleteImportedData) => {
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ["garmin-status"] });
      queryClient.invalidateQueries({
        queryKey: ["apple-health-workout-reconciliation"],
      });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity-entries"] });
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      toast.success(
        deleteImportedData
          ? "Garmin data deleted"
          : "Garmin Connect disconnected",
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const status = statusQuery.data;
  const isWorking =
    statusQuery.isLoading ||
    connectMutation.isPending ||
    syncMutation.isPending ||
    disconnectMutation.isPending;
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-500/20">
          <Activity className="h-8 w-8 text-sky-500" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <h2 className="text-2xl font-bold">Garmin Connect</h2>
          {status?.connected && (
            <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-600">
              Connected
            </span>
          )}
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Bring Garmin workouts, sleep, movement, heart rate, stress, and
          recovery signals into tracking.so.
        </p>
      </div>

      {status?.available === false && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          Garmin Connect is not available yet because the server connection is
          not configured.
        </p>
      )}

      {hasImportedData && importStats && (
        <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-background/70 p-3">
              <Activity className="h-4 w-4 text-sky-500" />
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
          Last sync failed. Try again or reconnect Garmin Connect.
        </p>
      )}

      <AppleHealthWorkoutReconciliation
        enabled={hasImportedData}
        openRequestKey={reconciliationOpenRequest}
      />

      <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Garmin-derived activity views are labeled with Garmin attribution.
          Data is stored in your tracking.so account for personal health
          insights and excluded from AI coach prompts and traces.{" "}
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
        {status?.connected ? (
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl text-base font-semibold"
            disabled={isWorking}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1">Sync now</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl text-base font-semibold"
            disabled={isWorking || status?.available === false}
            onClick={() => connectMutation.mutate()}
          >
            {connectMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            <span className="ml-1">Connect Garmin Connect</span>
          </Button>
        )}

        {confirmDelete ? (
          <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-muted-foreground">
              Delete every Garmin workout, sleep sample, and daily value stored
              in tracking.so? Timeline workouts created from Garmin Connect are
              deleted too; manual logs stay. Nothing is removed from Garmin
              Connect.
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
