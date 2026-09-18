import axios from "axios";

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000] as const;

export function isTransientHealthError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

export function nextHealthSyncRetryDelay(attempt: number): number | null {
  if (attempt < 0 || attempt >= RETRY_DELAYS_MS.length) return null;
  return RETRY_DELAYS_MS[attempt];
}
