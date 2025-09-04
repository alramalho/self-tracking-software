"use client";

import { useApiWithAuth } from "@/api";
import { useSession } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Metric, MetricEntry } from "@tsw/prisma";
import React, { createContext, useContext } from "react";
import { toast } from "react-hot-toast";
import {
  deleteMetric,
  getMetricEntries,
  getMetrics,
  logTodaysNote,
  skipTodaysNote,
  upsertMetric,
  upsertMetricEntry
} from "./actions";

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
  const api = useApiWithAuth();

  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      try {
        return await getMetrics();
      } catch (error) {
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn,
    staleTime: 1000 * 60 * 5,
  });
  const metricsEntriesQuery = useQuery({
    queryKey: ["metricsEntries"],
    queryFn: async () => {
      try {
        return await getMetricEntries();
      } catch (error) {
        throw error;
      }
    },
    enabled: isLoaded && isSignedIn,
    staleTime: 1000 * 60 * 5,
  });

  const createMetricMutation = useMutation({
    mutationFn: async (data: { title: string; emoji: string }) => {
      return await upsertMetric(data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["metrics"] });
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      toast.success("Metric created successfully!");
    },
    onError: (error) => {
      console.error("Error creating metric:", error);
      toast.error("Failed to create metric. Please try again.");
    },
  });

  const logMetricsMutation = useMutation({
    mutationFn: async (
      data: Array<{
        metricId: string;
        rating: number;
        date: Date;
        description?: string;
      }>
    ) => {
      await Promise.all(
        data.map((metric) =>
          upsertMetricEntry({
            metricId: metric.metricId,
            rating: metric.rating,
            date: metric.date.toISOString().split("T")[0],
            description: metric.description,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
      queryClient.refetchQueries({ queryKey: ["current-user"] });
      toast.success("Metrics logged successfully!");
    },
    onError: (error) => {
      console.error("Error logging metric:", error);
      toast.error("Failed to log metric. Please try again.");
    },
  });

  const logIndividualMetricMutation = useMutation({
    mutationFn: async (data: { metricId: string; rating: number; description?: string }) => {
      return await upsertMetricEntry({
        metricId: data.metricId,
        rating: data.rating,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
      toast.success("Metric logged successfully!");
    },
    onError: (error) => {
      console.error("Error logging metric:", error);
      toast.error("Failed to log metric. Please try again.");
    },
  });

  const skipMetricMutation = useMutation({
    mutationFn: async (data: { metricId: string; date?: string }) => {
      return await upsertMetricEntry({
        metricId: data.metricId,
        date: data.date,
        skipped: true,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
      toast.success("Metric skipped successfully!");
    },
    onError: (error) => {
      console.error("Error skipping metric:", error);
      toast.error("Failed to skip metric. Please try again.");
    },
  });

  const logTodaysNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      return await logTodaysNote(note);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
      toast.success("Note added to today's entries!");
    },
    onError: (error) => {
      console.error("Error logging today's note:", error);
      toast.error("Failed to add note. Please try again.");
    },
  });

  const skipTodaysNoteMutation = useMutation({
    mutationFn: async () => {
      return await skipTodaysNote();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
      toast.success("Today's note skipped successfully!");
    },
    onError: (error) => {
      console.error("Error skipping today's note:", error);
      toast.error("Failed to skip today's note. Please try again.");
    },
  });

  const deleteMetricMutation = useMutation({
    mutationFn: async (metricId: string) => {
      return await deleteMetric(metricId);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["metrics"] });
      queryClient.refetchQueries({ queryKey: ["metricsEntries"] });
      toast.success("Metric deleted successfully!");
    },
    onError: (error) => {
      console.error("Error deleting metric:", error);
      toast.error("Failed to delete metric. Please try again.");
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
      await logMetricsMutation.mutateAsync(data);
    },
    isLoggingMetrics: logMetricsMutation.isPending,

    logIndividualMetric: async (metricId: string, rating: number, description?: string) => {
      await logIndividualMetricMutation.mutateAsync({ metricId, rating, description });
    },
    skipMetric: async (metricId: string, date?: string) => {
      await skipMetricMutation.mutateAsync({ metricId, date });
    },
    logTodaysNote: async (note: string) => {
      await logTodaysNoteMutation.mutateAsync(note);
    },
    skipTodaysNote: async () => {
      await skipTodaysNoteMutation.mutateAsync();
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
