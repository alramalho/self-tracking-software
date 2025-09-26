import { Metric, MetricEntry, Prisma } from "@tsw/prisma";
import { AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";

export type MetricsBatchUpdateResult = Prisma.BatchPayload;

type MetricApiResponse = Omit<Metric, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type MetricEntryApiResponse = Omit<
  MetricEntry,
  "date" | "createdAt" | "updatedAt"
> & {
  date: string;
  createdAt: string;
  updatedAt: string;
};

const deserializeMetric = (metric: MetricApiResponse): Metric =>
  normalizeApiResponse<Metric>(metric, ['createdAt', 'updatedAt']);

const deserializeMetricEntry = (
  entry: MetricEntryApiResponse
): MetricEntry => normalizeApiResponse<MetricEntry>(entry, ['date', 'createdAt', 'updatedAt']);

export async function getMetrics(api: AxiosInstance) {
  const response = await api.get<MetricApiResponse[]>("/metrics");
  return response.data.map(deserializeMetric);
}

export async function getMetricEntries(api: AxiosInstance) {
  const response = await api.get<MetricEntryApiResponse[]>("/metrics/entries");
  return response.data.map(deserializeMetricEntry);
}

export async function upsertMetric(
  api: AxiosInstance,
  data: { title: string; emoji: string }
) {
  const response = await api.post<MetricApiResponse>("/metrics", data);
  return deserializeMetric(response.data);
}

export interface UpsertMetricEntryInput {
  metricId: string;
  rating?: number;
  date?: Date;
  description?: string;
  skipped?: boolean;
  descriptionSkipped?: boolean;
}

export async function upsertMetricEntry(
  api: AxiosInstance,
  data: UpsertMetricEntryInput
) {
  const payload: Record<string, unknown> = {
    metricId: data.metricId,
  };

  if (data.rating !== undefined) payload.rating = data.rating;
  if (data.description !== undefined) payload.description = data.description;
  if (data.skipped !== undefined) payload.skipped = data.skipped;
  if (data.descriptionSkipped !== undefined)
    payload.descriptionSkipped = data.descriptionSkipped;
  if (data.date) payload.date = data.date.toISOString();

  const response = await api.post<MetricEntryApiResponse>(
    "/metrics/entries",
    payload
  );

  return deserializeMetricEntry(response.data);
}

export async function updateTodaysNote(
  api: AxiosInstance,
  data: { note?: string; skip?: boolean }
) {
  const response = await api.patch<MetricsBatchUpdateResult>(
    "/metrics/entries/today-note",
    data
  );
  return response.data;
}

export async function deleteMetric(api: AxiosInstance, metricId: string) {
  await api.delete(`/metrics/${metricId}`);
}
