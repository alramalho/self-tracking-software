import type { AxiosInstance } from "axios";

import type { GarminStatus, GarminSyncResult } from "./types";

export async function getGarminStatus(
  api: AxiosInstance,
): Promise<GarminStatus> {
  const response = await api.get<GarminStatus>("/health/garmin/status");
  return response.data;
}

export async function getGarminAuthorizationUrl(
  api: AxiosInstance,
): Promise<string> {
  const response = await api.get<{ authorizationUrl: string }>(
    "/health/garmin/connect",
  );
  return response.data.authorizationUrl;
}

export async function syncGarmin(
  api: AxiosInstance,
  days = 30,
): Promise<GarminSyncResult | null> {
  const response = await api.post<{ result: GarminSyncResult | null }>(
    "/health/garmin/sync",
    { days },
  );
  return response.data.result;
}

export async function disconnectGarmin(
  api: AxiosInstance,
  deleteImportedData: boolean,
): Promise<void> {
  await api.delete("/health/garmin", {
    params: { deleteData: deleteImportedData },
  });
}
