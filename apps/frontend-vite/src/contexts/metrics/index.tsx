/* eslint-disable react-refresh/only-export-components */

"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useLogError } from "@/hooks/useLogError";
import { normalizeApiResponse } from "@/utils/dateUtils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Metric, type MetricEntry } from "@tsw/prisma";
import { isSameDay } from "date-fns";
import React, { createContext, useContext } from "react";
import { toast } from "react-hot-toast";
import {
  deleteMetric,
  getMetricEntries,
  getMetrics,
  updateTodaysNote,
  upsertMetric,
  upsertMetricEntry,
} from "./service";

interface MetricsContextType {
  metrics: Metric[] | undefined;
  entries: MetricEntry[] | undefined;
  isLoadingMetrics: boolean;
  isLoadingEntries: boolean;

  createMetric: (data: { title: string; emoji: string }) => Promise<void>;
  isCreatingMetric: boolean;

  logMetrics: (
    data: Array<{
      metricId: string;
      rating: number;
      date: Date;
      description?: string;
    }>
  ) => Promise<void>;
  isLoggingMetrics: boolean;

  logIndividualMetric: (metricId: string, rating: number, description?: string) => Promise<void>;
  skipMetric: (metricId: string, date?: string) => Promise<void>;
  logTodaysNote: (note: string) => Promise<void>;
  skipTodaysNote: () => Promise<void>;
  deleteMetric: (metricId: string) => Promise<void>;

  hasLoadedMetricsAndEntries: boolean;
}

const MetricsContext = createContext<MetricsContextType | undefined>(undefined);

export const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, isLoaded } = useSession();
  const queryClient = useQueryClient();
  const { handleQueryError } = useLogError();
  const api = useApiWithAuth();
  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: () => getMetrics(api),
    select: (data) => data.map(metric => normalizeApiResponse<Metric>(metric, ["createdAt", "updatedAt"])),
    enabled: isLoaded && isSignedIn,
    staleTime: 1000 * 60 * 5,
  });

  const metricsEntriesQuery = useQuery({
    queryKey: ["metricsEntries"],
    queryFn: () => getMetricEntries(api),
    select: (data) => data.map(entry => normalizeApiResponse<MetricEntry>(entry, ["date", "createdAt", "updatedAt"])),
    enabled: isLoaded && isSignedIn,
    staleTime: 1000 * 60 * 5,
  });

  const createMetricMutation = useMutation({
    mutationFn: async (data: { title: string; emoji: string }) => {
      return await upsertMetric(api, data);
    },
    onSuccess: (newMetric) => {
      queryClient.setQueryData(["metrics"], (old: Metric[]) => {
        if (!old || !Array.isArray(old)) {
          queryClient.refetchQueries({ queryKey: ["metrics"] });
          return old; // Keep existing data, let refetch handle the update
        }
        return [newMetric, ...old];
      });
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      toast.success("Metric created successfully!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to create metric`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const upsertMetricEntriesMutation = useMutation({
    mutationFn: async (
      data: Array<{
        metricId: string;
        rating?: number;
        date?: Date;
        description?: string;
        skipped?: boolean;
      }>
    ) => {
      console.log("upserting metric entries", data);
      const result = await Promise.all(
        data.map((metric) =>
          upsertMetricEntry(api, {
            metricId: metric.metricId,
            rating: metric.rating,
            date: metric.date,
            description: metric.description,
            skipped: metric.skipped,
          })
        )
      );
      return result;
    },
    onSuccess: (newEntries) => {
      queryClient.setQueryData(["metricsEntries"], (old: MetricEntry[]) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
        let updated = [...old];
        newEntries.forEach(newEntry => {
          const existingIndex = updated.findIndex(entry => 
            entry.metricId === newEntry.metricId && 
            isSameDay(entry.date, newEntry.date)
          );
          if (existingIndex >= 0) {
            updated[existingIndex] = newEntry;
          } else {
            updated = [newEntry, ...updated];
          }
        });
        return updated;
      });
      queryClient.refetchQueries({ queryKey: ["current-user"] });
    },
    onError: (error) => {
      const customErrorMessage = `Failed to update metric entries`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });


  const updateTodaysNoteMutation = useMutation({
    mutationFn: async (data: { note?: string; skip?: boolean }) => {
      return await updateTodaysNote(api, data);
    },
    onSuccess: (_, variables) => {
      queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
      if (variables.note !== undefined) {
        toast.success("Note added to today's entries!");
      } else if (variables.skip) {
        toast.success("Today's note skipped successfully!");
      }
    },
    onError: (error) => {
      const customErrorMessage = `Failed to update today's note`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });

  const deleteMetricMutation = useMutation({
    mutationFn: async (metricId: string) => {
      await deleteMetric(api, metricId);
      return metricId;
    },
    onSuccess: (metricId) => {
      queryClient.setQueryData(["metrics"], (old: Metric[]) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["metrics"] });
        return old.filter((metric) => metric.id !== metricId);
      });
      queryClient.setQueryData(["metricsEntries"], (old: MetricEntry[]) => {
        if (!old) return queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
        return old.filter((entry) => entry.metricId !== metricId);
      });
      toast.success("Metric deleted successfully!");
    },
    onError: (error) => {
      const customErrorMessage = `Failed to delete metric`;
      handleQueryError(error, customErrorMessage);
      toast.error(customErrorMessage);
    },
  });


  const context: MetricsContextType = {
    // Data access
    metrics: metricsQuery.data || [],
    entries: metricsEntriesQuery.data || [],
    isLoadingMetrics: metricsQuery.isLoading,
    isLoadingEntries: metricsEntriesQuery.isLoading,
    hasLoadedMetricsAndEntries: metricsQuery.isSuccess && metricsEntriesQuery.isSuccess,
    
    // Actions
    createMetric: async (data: { title: string; emoji: string }) => {
      await createMetricMutation.mutateAsync(data);
    },
    isCreatingMetric: createMetricMutation.isPending,

    logMetrics: async (data: Array<{metricId: string; rating: number; date: Date; description?: string}>) => {
      await upsertMetricEntriesMutation.mutateAsync(data);
      toast.success("Metrics logged successfully!");
    },
    isLoggingMetrics: upsertMetricEntriesMutation.isPending,

    logIndividualMetric: async (metricId: string, rating: number, description?: string) => {
      await upsertMetricEntriesMutation.mutateAsync([{ metricId, rating, description }]);
      toast.success("Metric logged successfully!");
    },
    skipMetric: async (metricId: string, date?: string) => {
      const dateObj = date ? new Date(date) : undefined;
      await upsertMetricEntriesMutation.mutateAsync([{ metricId, date: dateObj, skipped: true }]);
      toast.success("Metric skipped successfully!");
    },
    logTodaysNote: async (note: string) => {
      await updateTodaysNoteMutation.mutateAsync({ note });
    },
    skipTodaysNote: async () => {
      await updateTodaysNoteMutation.mutateAsync({ skip: true });
    },
    deleteMetric: async (metricId: string) => {
      await deleteMetricMutation.mutateAsync(metricId);
    },
  };

  return (
    <MetricsContext.Provider value={context}>
      {children}
    </MetricsContext.Provider>
  );
};

export const useMetrics = () => {
  const context = useContext(MetricsContext);
  if (context === undefined) {
    throw new Error("useMetrics must be used within a MetricsProvider");
  }
  return context;
};
